import { TimeSeriesObservation, ValidatedMacroSeries } from '../../../types/fedPivotV2';

export const CADENCE_MAX_STALE_DAYS: Record<ValidatedMacroSeries['cadence'], number> = {
  DAILY: 12, // Covers weekends + US holidays + T+1/T+2 H.15 publication lag
  WEEKLY: 24, // Covers weekly ICSA / STLFSI4 release schedule
  MONTHLY: 105, // FRED monthly observation_date is YYYY-MM-01 (~30d month + ~30-45d BEA/BLS release lag)
};

export const PUBLICATION_LAG_DAYS: Record<string, number> = {
  PCEPILFE: 58, // Sept PCE (2026-09-01) is released late Oct (~58 days after YYYY-MM-01)
  CPIAUCSL: 42, // Sept CPI (2026-09-01) is released mid Oct (~42 days after YYYY-MM-01)
  PAYEMS: 35, // Sept NFP (2026-09-01) is released first Friday of Oct (~35 days after YYYY-MM-01)
  UNRATE: 35,
  ICSA: 5, // Released Thursday for prior Saturday week
  STLFSI4: 6,
  DGS2: 1,
  DFII10: 1,
  EFFR: 1,
  DTWEXBGS: 5,
  BAMLH0A0HYM2: 1,
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFredCsvText(csvText: string): TimeSeriesObservation[] {
  if (!csvText || typeof csvText !== 'string') return [];
  // Guard against HTML error pages returned by proxies or captive portals
  if (csvText.trimStart().startsWith('<')) return [];

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const byDate = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const commaIdx = rawLine.indexOf(',');
    if (commaIdx <= 0) continue;

    const datePart = rawLine.slice(0, commaIdx).trim();
    const valPart = rawLine.slice(commaIdx + 1).trim();

    if (!ISO_DATE_RE.test(datePart)) continue;
    if (!valPart || valPart === '.' || valPart.toLowerCase() === 'nan') continue;

    const num = Number(valPart);
    if (!Number.isFinite(num)) continue;

    byDate.set(datePart, num);
  }

  return Array.from(byDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function validateMacroSeries(params: {
  seriesId: string;
  source: string;
  cadence: ValidatedMacroSeries['cadence'];
  observations: TimeSeriesObservation[];
  fetchedAtMs?: number;
  minRequiredObservations?: number;
}): ValidatedMacroSeries {
  const {
    seriesId,
    source,
    cadence,
    observations,
    fetchedAtMs = Date.now(),
    minRequiredObservations = 2,
  } = params;

  const fetchedAtISO = new Date(fetchedAtMs).toISOString();
  const cleanObs = observations
    .filter(o => ISO_DATE_RE.test(o.date) && Number.isFinite(o.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (cleanObs.length < minRequiredObservations) {
    return {
      seriesId,
      source,
      cadence,
      observations: cleanObs,
      fetchedAtISO,
      latestDate: cleanObs[cleanObs.length - 1]?.date ?? null,
      ageDays: null,
      isValid: false,
      isStale: false,
      invalidReason:
        cleanObs.length === 0
          ? 'Không nhận được dữ liệu hợp lệ từ nguồn chính thức'
          : `Số kỳ quan sát (${cleanObs.length}) chưa đủ tối thiểu (${minRequiredObservations})`,
    };
  }

  const latest = cleanObs[cleanObs.length - 1];
  const latestMs = Date.parse(`${latest.date}T00:00:00Z`);
  if (!Number.isFinite(latestMs)) {
    return {
      seriesId,
      source,
      cadence,
      observations: cleanObs,
      fetchedAtISO,
      latestDate: null,
      ageDays: null,
      isValid: false,
      isStale: false,
      invalidReason: 'Định dạng ngày quan sát không hợp lệ',
    };
  }

  const ageDays = Math.max(0, Math.floor((fetchedAtMs - latestMs) / 86_400_000));
  const maxAge = CADENCE_MAX_STALE_DAYS[cadence];
  const isStale = ageDays > maxAge;

  return {
    seriesId,
    source,
    cadence,
    observations: cleanObs,
    fetchedAtISO,
    latestDate: latest.date,
    ageDays,
    isValid: !isStale,
    isStale,
    invalidReason: isStale
      ? `Dữ liệu quá hạn kiểm định (${ageDays} ngày > ngưỡng ${maxAge} ngày)`
      : undefined,
  };
}

/**
 * Retrieve observations strictly available on or before `asOfDateMs` accounting for real-world publication lag,
 * preventing any look-ahead bias when computing historical Pivot Score curves.
 */
export function getObservationsAsOf(
  series: ValidatedMacroSeries,
  asOfDateMs: number
): TimeSeriesObservation[] {
  if (!series || series.observations.length === 0) return [];
  const lagDays = PUBLICATION_LAG_DAYS[series.seriesId] ?? 1;
  const lagMs = lagDays * 86_400_000;

  return series.observations.filter(obs => {
    const obsMs = Date.parse(`${obs.date}T00:00:00Z`);
    return Number.isFinite(obsMs) && obsMs + lagMs <= asOfDateMs;
  });
}

/**
 * Estimate official statistical agency release date string for display clarity on monthly/weekly series.
 */
export function formatEffectiveReleaseDate(series: ValidatedMacroSeries): string {
  if (!series.latestDate) return 'N/A';
  if (series.cadence === 'DAILY') return series.latestDate;

  const baseMs = Date.parse(`${series.latestDate}T00:00:00Z`);
  if (!Number.isFinite(baseMs)) return series.latestDate;

  if (series.cadence === 'WEEKLY') {
    const rel = new Date(baseMs + 5 * 86_400_000).toISOString().slice(0, 10);
    return `${rel} (kỳ ${series.latestDate})`;
  }

  // Monthly FRED series use YYYY-MM-01 to denote reference month YYYY-MM
  const ym = series.latestDate.slice(0, 7);
  const lag = PUBLICATION_LAG_DAYS[series.seriesId] ?? 35;
  const approxRel = new Date(baseMs + lag * 86_400_000).toISOString().slice(0, 10);
  return `Kỳ ${ym} (công bố ~${approxRel})`;
}
