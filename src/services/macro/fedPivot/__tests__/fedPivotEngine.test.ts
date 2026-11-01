import { beforeEach, describe, expect, it } from 'vitest';
import {
  RawFedPivotProviderBundle,
  TimeSeriesObservation,
  ValidatedMacroSeries,
} from '../../../../types/fedPivotV2';
import {
  buildFedPivotIntelligenceFromBundle,
  evaluateFedPivotScenarios,
  evaluateFedPivotSignalsAndScore,
  generateFedPivotSmartAlerts,
  getObservationsAsOf,
  mapPivotScoreToStatus,
  parseFredCsvText,
  recordAndDiffFedPivotSnapshot,
  resetFedPivotHistoryStoreForTests,
  resetFedPivotSeenAlertsForTests,
  validateMacroSeries,
} from '../index';

const NOW_MS = Date.parse('2026-11-01T12:00:00Z');
const NOW_ISO = new Date(NOW_MS).toISOString();

function makeMonthlyObs(values: number[], endYear = 2026, endMonth = 9): TimeSeriesObservation[] {
  const out: TimeSeriesObservation[] = [];
  const totalMonthsEnd = endYear * 12 + (endMonth - 1);
  for (let i = 0; i < values.length; i++) {
    const mTotal = totalMonthsEnd - (values.length - 1 - i);
    const y = Math.floor(mTotal / 12);
    const m = (mTotal % 12) + 1;
    out.push({
      date: `${y}-${String(m).padStart(2, '0')}-01`,
      value: values[i],
    });
  }
  return out;
}

function makeDailyObs(values: number[], endDateISO = '2026-10-30'): TimeSeriesObservation[] {
  const endMs = Date.parse(`${endDateISO}T00:00:00Z`);
  return values.map((v, idx) => {
    const ms = endMs - (values.length - 1 - idx) * 86_400_000;
    return {
      date: new Date(ms).toISOString().slice(0, 10),
      value: v,
    };
  });
}

function makeWeeklyObs(values: number[], endDateISO = '2026-10-24'): TimeSeriesObservation[] {
  const endMs = Date.parse(`${endDateISO}T00:00:00Z`);
  return values.map((v, idx) => {
    const ms = endMs - (values.length - 1 - idx) * 7 * 86_400_000;
    return {
      date: new Date(ms).toISOString().slice(0, 10),
      value: v,
    };
  });
}

function buildValidated(
  seriesId: string,
  cadence: ValidatedMacroSeries['cadence'],
  observations: TimeSeriesObservation[],
  minReq = 2
): ValidatedMacroSeries {
  return validateMacroSeries({
    seriesId,
    source: `TEST (${seriesId})`,
    cadence,
    observations,
    fetchedAtMs: NOW_MS,
    minRequiredObservations: minReq,
  });
}

function createHawkishBaselineBundle(): RawFedPivotProviderBundle {
  // Core PCE growing ~3.4% annualized (120 -> ~124.1 over 12 months)
  const pceVals = Array.from({ length: 14 }, (_, i) =>
    parseFloat((120 * Math.pow(1.034, i / 12)).toFixed(4))
  );
  // CPI growing steadily
  const cpiVals = Array.from({ length: 14 }, (_, i) => 310 + i * 0.8);
  // NFP strong +210K/month (in thousands)
  const payemsVals = Array.from({ length: 14 }, (_, i) => 158_000 + i * 210);
  // Unemployment tight and flat at 3.8%
  const unrateVals = Array.from({ length: 14 }, () => 3.8);
  // Low weekly jobless claims 195K
  const icsaVals = Array.from({ length: 8 }, () => 195_000);
  // EFFR at 4.50%
  const effrVals = Array.from({ length: 30 }, () => 4.5);
  // US 2Y at 4.82% (+32 bps above EFFR -> CONFLICTING)
  const dgs2Vals = Array.from({ length: 30 }, () => 4.82);
  // US 10Y Real Yield high at 2.25%
  const dfii10Vals = Array.from({ length: 30 }, () => 2.25);
  // Broad USD strong & rising
  const dtwexVals = Array.from({ length: 30 }, (_, i) => 122 + i * 0.08);
  // Tight credit spread 3.10% & negative STLFSI4 (-0.45)
  const hyVals = Array.from({ length: 30 }, () => 3.1);
  const fsiVals = Array.from({ length: 8 }, () => -0.45);

  return {
    fetchedAtMs: NOW_MS,
    fetchedAtISO: NOW_ISO,
    nyFedEffr: {
      effectiveRate: 4.5,
      targetRangeLow: 4.5,
      targetRangeHigh: 4.75,
      effectiveDate: '2026-10-30',
    },
    futuresQuote: {
      frontRate: 4.5,
      implied1mRate: 4.55,
      implied3mRate: 4.65,
      implied6mRate: 4.72, // +22 bps -> CONFLICTING
      contract3m: 'ZQF27',
      contract6m: 'ZQJ27',
      dxySpot: 105.1,
      dxyChangePct: 0.45,
    },
    fredSeries: {
      PCEPILFE: buildValidated('PCEPILFE', 'MONTHLY', makeMonthlyObs(pceVals), 7),
      CPIAUCSL: buildValidated('CPIAUCSL', 'MONTHLY', makeMonthlyObs(cpiVals), 3),
      PAYEMS: buildValidated('PAYEMS', 'MONTHLY', makeMonthlyObs(payemsVals), 4),
      UNRATE: buildValidated('UNRATE', 'MONTHLY', makeMonthlyObs(unrateVals), 12),
      ICSA: buildValidated('ICSA', 'WEEKLY', makeWeeklyObs(icsaVals), 4),
      EFFR: buildValidated('EFFR', 'DAILY', makeDailyObs(effrVals), 5),
      DGS2: buildValidated('DGS2', 'DAILY', makeDailyObs(dgs2Vals), 21),
      DFII10: buildValidated('DFII10', 'DAILY', makeDailyObs(dfii10Vals), 21),
      DTWEXBGS: buildValidated('DTWEXBGS', 'DAILY', makeDailyObs(dtwexVals), 21),
      BAMLH0A0HYM2: buildValidated('BAMLH0A0HYM2', 'DAILY', makeDailyObs(hyVals), 21),
      STLFSI4: buildValidated('STLFSI4', 'WEEKLY', makeWeeklyObs(fsiVals), 2),
    },
  };
}

function createStrongConvergencePivotBundle(): RawFedPivotProviderBundle {
  // Core PCE cooling to ~2.1% annualized
  const pceVals = Array.from({ length: 14 }, (_, i) =>
    parseFloat((120 * Math.pow(1.021, i / 12)).toFixed(4))
  );
  const cpiVals = Array.from({ length: 14 }, (_, i) => 310 + i * 0.4);
  // NFP cooling to +85K/month
  const payemsVals = Array.from({ length: 14 }, (_, i) => 158_000 + i * 85);
  // Unemployment rising from 3.8% to 4.4% (Sahm ~0.50%)
  const unrateVals = [3.8, 3.8, 3.8, 3.9, 3.9, 4.0, 4.0, 4.1, 4.1, 4.2, 4.2, 4.3, 4.4, 4.4];
  // Claims elevated at 245K
  const icsaVals = Array.from({ length: 8 }, () => 245_000);
  // EFFR at 4.50%
  const effrVals = Array.from({ length: 30 }, () => 4.5);
  // US 2Y dropping from 4.35% -> 3.95% (-55 bps below EFFR, -40 bps over 20d)
  const dgs2Vals = Array.from({ length: 30 }, (_, i) =>
    parseFloat((4.38 - i * 0.015).toFixed(3))
  );
  // US 10Y Real Yield dropping to 1.55%
  const dfii10Vals = Array.from({ length: 30 }, (_, i) =>
    parseFloat((1.95 - i * 0.014).toFixed(3))
  );
  // USD broad weakening
  const dtwexVals = Array.from({ length: 30 }, (_, i) => 122 - i * 0.12);
  // Credit spread widening to 4.65% (+60 bps) -> CONFIRMED
  const hyVals = Array.from({ length: 30 }, (_, i) =>
    parseFloat((3.95 + i * 0.025).toFixed(3))
  );
  const fsiVals = Array.from({ length: 8 }, () => 0.82);

  return {
    fetchedAtMs: NOW_MS,
    fetchedAtISO: NOW_ISO,
    nyFedEffr: {
      effectiveRate: 4.5,
      targetRangeLow: 4.5,
      targetRangeHigh: 4.75,
      effectiveDate: '2026-10-30',
    },
    futuresQuote: {
      frontRate: 4.48,
      implied1mRate: 4.35,
      implied3mRate: 4.15,
      implied6mRate: 3.95, // -55 bps -> CONFIRMED
      contract3m: 'ZQF27',
      contract6m: 'ZQJ27',
      dxySpot: 99.8,
      dxyChangePct: -0.62,
    },
    fredSeries: {
      PCEPILFE: buildValidated('PCEPILFE', 'MONTHLY', makeMonthlyObs(pceVals), 7),
      CPIAUCSL: buildValidated('CPIAUCSL', 'MONTHLY', makeMonthlyObs(cpiVals), 3),
      PAYEMS: buildValidated('PAYEMS', 'MONTHLY', makeMonthlyObs(payemsVals), 4),
      UNRATE: buildValidated('UNRATE', 'MONTHLY', makeMonthlyObs(unrateVals), 12),
      ICSA: buildValidated('ICSA', 'WEEKLY', makeWeeklyObs(icsaVals), 4),
      EFFR: buildValidated('EFFR', 'DAILY', makeDailyObs(effrVals), 5),
      DGS2: buildValidated('DGS2', 'DAILY', makeDailyObs(dgs2Vals), 21),
      DFII10: buildValidated('DFII10', 'DAILY', makeDailyObs(dfii10Vals), 21),
      DTWEXBGS: buildValidated('DTWEXBGS', 'DAILY', makeDailyObs(dtwexVals), 21),
      BAMLH0A0HYM2: buildValidated('BAMLH0A0HYM2', 'DAILY', makeDailyObs(hyVals), 21),
      STLFSI4: buildValidated('STLFSI4', 'WEEKLY', makeWeeklyObs(fsiVals), 2),
    },
  };
}

describe('Fed Pivot Intelligence V2 — Deterministic Quantitative Engine', () => {
  beforeEach(() => {
    resetFedPivotHistoryStoreForTests();
    resetFedPivotSeenAlertsForTests();
  });

  it('parses FRED CSV safely and rejects HTML pages, missing "." entries, and stale series', () => {
    const rawCsv = [
      'observation_date,DGS2',
      '2026-10-27,4.12',
      '2026-10-28,.',
      '2026-10-29,NaN',
      '2026-10-30,4.08',
    ].join('\n');

    const parsed = parseFredCsvText(rawCsv);
    expect(parsed).toEqual([
      { date: '2026-10-27', value: 4.12 },
      { date: '2026-10-30', value: 4.08 },
    ]);

    expect(parseFredCsvText('<!DOCTYPE html><html>Error</html>')).toEqual([]);

    // Stale daily series (45 days old > 12-day SLA)
    const staleSeries = validateMacroSeries({
      seriesId: 'DGS2',
      source: 'FRED',
      cadence: 'DAILY',
      observations: makeDailyObs([4.1, 4.12, 4.15], '2026-09-01'),
      fetchedAtMs: NOW_MS,
      minRequiredObservations: 2,
    });
    expect(staleSeries.isStale).toBe(true);
    expect(staleSeries.isValid).toBe(false);

    // Point-in-time lag guard prevents look-ahead bias on monthly PCE
    const pceSeries = buildValidated(
      'PCEPILFE',
      'MONTHLY',
      [
        { date: '2026-08-01', value: 123.1 },
        { date: '2026-10-01', value: 123.6 }, // Not yet released on Nov 1 (needs ~58d lag from Oct 1)
      ],
      1
    );
    const availableNov1 = getObservationsAsOf(pceSeries, NOW_MS);
    expect(availableNov1.map(o => o.date)).toEqual(['2026-08-01']);
  });

  it('scores Hawkish / Conflicting data as 0.00 (NO_PIVOT) and flags CONFLICTING signals', () => {
    const bundle = createHawkishBaselineBundle();
    const res = evaluateFedPivotSignalsAndScore(bundle);

    expect(res.pivotScore).toBe(0);
    expect(res.status).toBe('NO_PIVOT');
    expect(res.dataQuality.validSignalsCount).toBe(7);
    expect(res.dataQuality.coverageRatioPct).toBe(100);

    const conflictingIds = res.signals
      .filter(s => s.state === 'CONFLICTING')
      .map(s => s.id);
    expect(conflictingIds).toContain('CORE_PCE');
    expect(conflictingIds).toContain('NFP_TREND');
    expect(conflictingIds).toContain('FED_FUNDS_FUTURES');
    expect(conflictingIds).toContain('US_TREASURY_2Y');
    expect(conflictingIds).toContain('REAL_YIELD_DXY');
  });

  it('scores full convergence up to 7.00 (STRONG_CONVERGENCE) and maps all 5 score tiers accurately', () => {
    const bundle = createStrongConvergencePivotBundle();
    const res = evaluateFedPivotSignalsAndScore(bundle);

    expect(res.pivotScore).toBeGreaterThanOrEqual(6.5);
    expect(res.pivotScore).toBeLessThanOrEqual(7.0);
    expect(res.status).toBe('STRONG_CONVERGENCE');

    expect(mapPivotScoreToStatus(0.5).status).toBe('NO_PIVOT');
    expect(mapPivotScoreToStatus(1.5).status).toBe('WATCH');
    expect(mapPivotScoreToStatus(3.0).status).toBe('EARLY_PIVOT');
    expect(mapPivotScoreToStatus(4.5).status).toBe('PIVOT_WINDOW');
    expect(mapPivotScoreToStatus(6.0).status).toBe('STRONG_CONVERGENCE');
  });

  it('prevents double-counting correlated S4 (Fed Funds Futures) and S5 (US 2Y) when real-economy signals are unconfirmed', () => {
    const bundle = createHawkishBaselineBundle();
    // Flip ONLY S4 (ZQ Futures) and S5 (US 2Y) to dovish cuts while S1..S3 remain hot/hawkish
    bundle.futuresQuote.implied3mRate = 4.2;
    bundle.futuresQuote.implied6mRate = 4.05; // -45 bps -> rawScore 1.0
    bundle.fredSeries.DGS2 = buildValidated(
      'DGS2',
      'DAILY',
      makeDailyObs(Array.from({ length: 30 }, (_, i) => 4.35 - i * 0.015)), // ends ~3.91% (-59 bps) -> rawScore 1.0
      21
    );

    const res = evaluateFedPivotSignalsAndScore(bundle);
    const s4 = res.signals.find(s => s.id === 'FED_FUNDS_FUTURES')!;
    const s5 = res.signals.find(s => s.id === 'US_TREASURY_2Y')!;

    expect(s4.rawScore).toBe(1.0);
    expect(s5.rawScore).toBe(1.0);
    expect(res.dataQuality.collinearityApplied).toBe(true);
    // Instead of 1.0 + 1.0 = 2.0, combined effective score is capped at 1.25
    expect(s4.effectiveScore + s5.effectiveScore).toBe(1.25);
  });

  it('assigns UNKNOWN (0 points) to missing or failed API data and blocks false alerts', () => {
    const emptyInvalid = (id: string, cadence: ValidatedMacroSeries['cadence']) =>
      validateMacroSeries({
        seriesId: id,
        source: 'OFFLINE',
        cadence,
        observations: [],
        fetchedAtMs: NOW_MS,
      });

    const brokenBundle: RawFedPivotProviderBundle = {
      fetchedAtMs: NOW_MS,
      fetchedAtISO: NOW_ISO,
      nyFedEffr: null,
      futuresQuote: {
        frontRate: null,
        implied1mRate: null,
        implied3mRate: null,
        implied6mRate: null,
        contract3m: 'ZQF27',
        contract6m: 'ZQJ27',
        dxySpot: null,
        dxyChangePct: null,
      },
      fredSeries: {
        PCEPILFE: emptyInvalid('PCEPILFE', 'MONTHLY'),
        CPIAUCSL: emptyInvalid('CPIAUCSL', 'MONTHLY'),
        PAYEMS: emptyInvalid('PAYEMS', 'MONTHLY'),
        UNRATE: emptyInvalid('UNRATE', 'MONTHLY'),
        ICSA: emptyInvalid('ICSA', 'WEEKLY'),
        EFFR: emptyInvalid('EFFR', 'DAILY'),
        DGS2: emptyInvalid('DGS2', 'DAILY'),
        DFII10: emptyInvalid('DFII10', 'DAILY'),
        DTWEXBGS: emptyInvalid('DTWEXBGS', 'DAILY'),
        BAMLH0A0HYM2: emptyInvalid('BAMLH0A0HYM2', 'DAILY'),
        STLFSI4: emptyInvalid('STLFSI4', 'WEEKLY'),
      },
    };

    const full = buildFedPivotIntelligenceFromBundle(brokenBundle, NOW_MS);
    expect(full.pivotScore).toBe(0);
    expect(full.dataQuality.validSignalsCount).toBe(0);
    expect(full.dataQuality.coverageRatioPct).toBe(0);
    expect(full.dataQuality.unknownSignalIds).toHaveLength(7);
    expect(full.historicalSeries).toEqual([]); // Never fabricates fake history
    expect(full.activeAlerts).toEqual([]); // Never fires alerts from missing/broken data
  });

  it('distinguishes Soft Landing vs Financial Stress scenarios accurately', () => {
    // 1. Soft Landing setup: PCE 2.2%, steady NFP +105K, tight HY spread 3.20%, ZQ/2Y pricing cuts
    const softBundle = createStrongConvergencePivotBundle();
    softBundle.fredSeries.PAYEMS = buildValidated(
      'PAYEMS',
      'MONTHLY',
      makeMonthlyObs(Array.from({ length: 14 }, (_, i) => 158_000 + i * 105)),
      4
    );
    softBundle.fredSeries.UNRATE = buildValidated(
      'UNRATE',
      'MONTHLY',
      makeMonthlyObs(Array.from({ length: 14 }, () => 4.1)),
      12
    );
    softBundle.fredSeries.BAMLH0A0HYM2 = buildValidated(
      'BAMLH0A0HYM2',
      'DAILY',
      makeDailyObs(Array.from({ length: 30 }, () => 3.2)),
      21
    );
    softBundle.fredSeries.STLFSI4 = buildValidated(
      'STLFSI4',
      'WEEKLY',
      makeWeeklyObs(Array.from({ length: 8 }, () => -0.1)),
      2
    );

    const softEval = evaluateFedPivotSignalsAndScore(softBundle);
    const softScen = evaluateFedPivotScenarios(softEval);
    expect(softScen.dominantScenarioId).toBe('SOFT_LANDING');

    // 2. Financial Stress setup: HY OAS jumps to 5.6% & STLFSI4 jumps to +1.8
    const stressBundle = createStrongConvergencePivotBundle();
    stressBundle.fredSeries.BAMLH0A0HYM2 = buildValidated(
      'BAMLH0A0HYM2',
      'DAILY',
      makeDailyObs(Array.from({ length: 30 }, (_, i) => 4.2 + i * 0.05)), // ~5.65%
      21
    );
    stressBundle.fredSeries.STLFSI4 = buildValidated(
      'STLFSI4',
      'WEEKLY',
      makeWeeklyObs(Array.from({ length: 8 }, () => 1.8)),
      2
    );

    const stressEval = evaluateFedPivotSignalsAndScore(stressBundle);
    const stressScen = evaluateFedPivotScenarios(stressEval);
    expect(stressScen.dominantScenarioId).toBe('FINANCIAL_STRESS');
  });

  it('detects new smart alerts with all 5 mandatory answers and suppresses duplicate notifications on unchanged state', () => {
    const pivotBundle = createStrongConvergencePivotBundle();
    const eval1 = evaluateFedPivotSignalsAndScore(pivotBundle);
    const scen1 = evaluateFedPivotScenarios(eval1);
    const diff1 = recordAndDiffFedPivotSnapshot({
      evaluated: eval1,
      dominantScenario: scen1.dominantScenarioId,
      nowMs: NOW_MS,
    });

    // First run -> Alert is NEW
    const alertsRun1 = generateFedPivotSmartAlerts({
      evaluated: eval1,
      dominantScenarioId: scen1.dominantScenarioId,
      scenarios: scen1.scenarios,
      snapshotDiff: diff1.snapshotDiff,
      nowMs: NOW_MS,
    });

    expect(alertsRun1.length).toBeGreaterThanOrEqual(1);
    const primaryAlert = alertsRun1.find(a => a.tier === 'STRONG_CONVERGENCE')!;
    expect(primaryAlert).toBeDefined();
    expect(primaryAlert.isNew).toBe(true);
    expect(primaryAlert.telegramContract.readyForBackendPhase).toBe(true);
    expect(primaryAlert.whatChanged.length).toBeGreaterThan(10);
    expect(primaryAlert.confirmingEvidence.length).toBeGreaterThan(0);
    expect(primaryAlert.conflictingSignals.length).toBeGreaterThan(0);
    expect(primaryAlert.affectedAssets.length).toBeGreaterThan(0);
    expect(primaryAlert.actionableChecklist.length).toBeGreaterThan(0);

    // Second run with identical macro state -> Deduplicated (isNew === false, Telegram dispatch suppressed)
    const alertsRun2 = generateFedPivotSmartAlerts({
      evaluated: eval1,
      dominantScenarioId: scen1.dominantScenarioId,
      scenarios: scen1.scenarios,
      snapshotDiff: diff1.snapshotDiff,
      nowMs: NOW_MS + 60_000,
    });

    const repeatAlert = alertsRun2.find(a => a.tier === 'STRONG_CONVERGENCE')!;
    expect(repeatAlert.isNew).toBe(false);
    expect(repeatAlert.telegramContract.readyForBackendPhase).toBe(false);
  });
});
