import { RawFedPivotProviderBundle, ValidatedMacroSeries } from '../../../types/fedPivotV2';
import { parseFredCsvText, validateMacroSeries } from './fedPivotValidator';

const FRED_BASES = ['/api/fred', 'https://fred.stlouisfed.org'];
const YAHOO_BASES = ['/api/yahoo', 'https://query1.finance.yahoo.com'];
const NYFED_EFFR_URL = 'https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json';
const CME_MONTH_CODES = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];

// Split-tier real-time caching:
// - Live CBOT ZQ Fed Funds Futures, DXY & NY Fed EFFR refresh every 20 seconds
// - Official FRED CSV statistical series refresh every 5 minutes (or immediately on forceRefresh)
const LIVE_RATES_TTL_MS = 20_000;
const FRED_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedBundle: RawFedPivotProviderBundle | null = null;
let cachedFredSeriesMap: RawFedPivotProviderBundle['fredSeries'] | null = null;
let lastFredFetchedAtMs = 0;
let bundleInFlight: Promise<RawFedPivotProviderBundle> | null = null;

interface FredSeriesSpec {
  id: keyof RawFedPivotProviderBundle['fredSeries'];
  source: string;
  cadence: ValidatedMacroSeries['cadence'];
  minObs: number;
}

const FRED_SERIES_SPECS: FredSeriesSpec[] = [
  { id: 'PCEPILFE', source: 'BEA / FRED (PCEPILFE)', cadence: 'MONTHLY', minObs: 7 },
  { id: 'CPIAUCSL', source: 'BLS / FRED (CPIAUCSL)', cadence: 'MONTHLY', minObs: 3 },
  { id: 'PAYEMS', source: 'BLS / FRED (PAYEMS)', cadence: 'MONTHLY', minObs: 4 },
  { id: 'UNRATE', source: 'BLS / FRED (UNRATE)', cadence: 'MONTHLY', minObs: 12 },
  { id: 'ICSA', source: 'US DOL / FRED (ICSA)', cadence: 'WEEKLY', minObs: 5 },
  { id: 'EFFR', source: 'NY Fed / FRED (EFFR)', cadence: 'DAILY', minObs: 5 },
  { id: 'DGS2', source: 'Fed H.15 / FRED (DGS2)', cadence: 'DAILY', minObs: 22 },
  { id: 'DFII10', source: 'Fed H.15 TIPS / FRED (DFII10)', cadence: 'DAILY', minObs: 22 },
  { id: 'DTWEXBGS', source: 'Fed H.10 / FRED (DTWEXBGS)', cadence: 'DAILY', minObs: 22 },
  { id: 'BAMLH0A0HYM2', source: 'ICE BofA / FRED (BAMLH0A0HYM2)', cadence: 'DAILY', minObs: 22 },
  { id: 'STLFSI4', source: 'St. Louis Fed (STLFSI4)', cadence: 'WEEKLY', minObs: 4 },
];

export function getForwardCbotZqSymbol(now: Date, monthsAhead: number): string {
  const totalMonths = now.getUTCFullYear() * 12 + now.getUTCMonth() + monthsAhead;
  const year = Math.floor(totalMonths / 12);
  const monthIdx = totalMonths % 12;
  const yy = String(year % 100).padStart(2, '0');
  return `ZQ${CME_MONTH_CODES[monthIdx]}${yy}.CBT`;
}

async function fetchSingleFredSeries(
  spec: FredSeriesSpec,
  startDateISO: string,
  fetchedAtMs: number
): Promise<ValidatedMacroSeries> {
  const isBrowser = typeof window !== 'undefined';
  const bases = isBrowser ? FRED_BASES : ['https://fred.stlouisfed.org', '/api/fred'];
  const path = `/graph/fredgraph.csv?id=${encodeURIComponent(spec.id)}&cosd=${encodeURIComponent(startDateISO)}`;

  for (const base of bases) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);
      const res = await fetch(`${base}${path}`, {
        headers: { Accept: 'text/csv,text/plain,*/*' },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;

      const text = await res.text();
      const observations = parseFredCsvText(text);
      if (observations.length > 0) {
        return validateMacroSeries({
          seriesId: spec.id,
          source: spec.source,
          cadence: spec.cadence,
          observations,
          fetchedAtMs,
          minRequiredObservations: spec.minObs,
        });
      }
    } catch {
      // Try next base safely without throwing
    }
  }

  return validateMacroSeries({
    seriesId: spec.id,
    source: spec.source,
    cadence: spec.cadence,
    observations: [],
    fetchedAtMs,
    minRequiredObservations: spec.minObs,
  });
}

async function fetchNyFedEffrOfficial(): Promise<RawFedPivotProviderBundle['nyFedEffr']> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(NYFED_EFFR_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const row = json?.refRates?.[0];
    if (!row || typeof row.percentRate !== 'number' || !Number.isFinite(row.percentRate)) {
      return null;
    }
    return {
      effectiveRate: parseFloat(row.percentRate.toFixed(2)),
      targetRangeLow:
        typeof row.targetRateFrom === 'number'
          ? parseFloat(row.targetRateFrom.toFixed(2))
          : parseFloat((Math.floor(row.percentRate * 4) / 4).toFixed(2)),
      targetRangeHigh:
        typeof row.targetRateTo === 'number'
          ? parseFloat(row.targetRateTo.toFixed(2))
          : parseFloat((Math.floor(row.percentRate * 4) / 4 + 0.25).toFixed(2)),
      effectiveDate: typeof row.effectiveDate === 'string' ? row.effectiveDate : '',
    };
  } catch {
    return null;
  }
}

async function fetchFuturesAndDxyQuotes(now: Date): Promise<RawFedPivotProviderBundle['futuresQuote']> {
  const zq1m = getForwardCbotZqSymbol(now, 1);
  const zq3m = getForwardCbotZqSymbol(now, 3);
  const zq6m = getForwardCbotZqSymbol(now, 6);
  const symbols = ['ZQ=F', zq1m, zq3m, zq6m, 'DX-Y.NYB'];
  const query = `/v8/finance/spark?symbols=${encodeURIComponent(symbols.join(','))}&range=5d&interval=1d`;
  const isBrowser = typeof window !== 'undefined';
  const bases = isBrowser ? YAHOO_BASES : ['https://query1.finance.yahoo.com', '/api/yahoo'];

  const extractLast = (entry: any): { last: number | null; changePct: number | null } => {
    if (!entry || !Array.isArray(entry.close)) return { last: null, changePct: null };
    const closes = entry.close.filter(
      (v: any): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
    );
    if (closes.length === 0) return { last: null, changePct: null };
    const last = closes[closes.length - 1];
    let changePct: number | null = null;
    if (typeof entry.fulldayChangePercent === 'number' && Number.isFinite(entry.fulldayChangePercent)) {
      changePct = parseFloat(entry.fulldayChangePercent.toFixed(2));
    } else if (closes.length >= 2 && closes[closes.length - 2] > 0) {
      changePct = parseFloat(
        (((last - closes[closes.length - 2]) / closes[closes.length - 2]) * 100).toFixed(2)
      );
    }
    return { last, changePct };
  };

  for (const base of bases) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      const res = await fetch(`${base}${query}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const raw = await res.json();

      const front = extractLast(raw?.['ZQ=F']).last;
      const m1 = extractLast(raw?.[zq1m]).last;
      const m3 = extractLast(raw?.[zq3m]).last;
      const m6 = extractLast(raw?.[zq6m]).last;
      const dxy = extractLast(raw?.['DX-Y.NYB']);

      const toRate = (price: number | null) =>
        price !== null && price > 50 && price <= 102 ? parseFloat((100 - price).toFixed(2)) : null;

      return {
        frontRate: toRate(front),
        implied1mRate: toRate(m1),
        implied3mRate: toRate(m3),
        implied6mRate: toRate(m6),
        contract3m: zq3m.replace('.CBT', ''),
        contract6m: zq6m.replace('.CBT', ''),
        dxySpot: dxy.last !== null ? parseFloat(dxy.last.toFixed(2)) : null,
        dxyChangePct: dxy.changePct,
      };
    } catch {
      // try next base
    }
  }

  return {
    frontRate: null,
    implied1mRate: null,
    implied3mRate: null,
    implied6mRate: null,
    contract3m: zq3m.replace('.CBT', ''),
    contract6m: zq6m.replace('.CBT', ''),
    dxySpot: null,
    dxyChangePct: null,
  };
}

export async function fetchRawFedPivotProviderBundle(
  forceRefresh: boolean = false
): Promise<RawFedPivotProviderBundle> {
  if (!forceRefresh && cachedBundle && Date.now() - cachedBundle.fetchedAtMs < LIVE_RATES_TTL_MS) {
    return cachedBundle;
  }

  if (bundleInFlight) {
    return bundleInFlight;
  }

  bundleInFlight = (async () => {
    try {
      const now = new Date();
      const fetchedAtMs = now.getTime();
      const shouldRefreshFred =
        forceRefresh ||
        !cachedFredSeriesMap ||
        fetchedAtMs - lastFredFetchedAtMs >= FRED_CACHE_TTL_MS;

      // 830 days lookback ensures 1Y (365d) historical Pivot Score curve has 12+ months prior lookback for YoY PCE & Sahm Rule
      const startDateISO = new Date(fetchedAtMs - 830 * 86_400_000).toISOString().slice(0, 10);

      const [nyFedEffr, futuresQuote, fredMap] = await Promise.all([
        fetchNyFedEffrOfficial(),
        fetchFuturesAndDxyQuotes(now),
        (async () => {
          if (!shouldRefreshFred && cachedFredSeriesMap) {
            return cachedFredSeriesMap;
          }
          const fredResults = await Promise.all(
            FRED_SERIES_SPECS.map(spec => fetchSingleFredSeries(spec, startDateISO, fetchedAtMs))
          );
          const map = {} as RawFedPivotProviderBundle['fredSeries'];
          FRED_SERIES_SPECS.forEach((spec, idx) => {
            map[spec.id] = fredResults[idx];
          });
          // Only cache FRED map if at least half of official series resolved cleanly
          const resolvedCount = Object.values(map).filter(s => s.observations.length > 0).length;
          if (resolvedCount >= 5) {
            cachedFredSeriesMap = map;
            lastFredFetchedAtMs = fetchedAtMs;
          }
          return map;
        })(),
      ]);

      const bundle: RawFedPivotProviderBundle = {
        fetchedAtMs,
        fetchedAtISO: now.toISOString(),
        nyFedEffr,
        futuresQuote,
        fredSeries: fredMap,
      };

      cachedBundle = bundle;
      return bundle;
    } finally {
      bundleInFlight = null;
    }
  })();

  return bundleInFlight;
}
