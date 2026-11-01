import {
  FedPivotIntelligenceV2,
  RawFedPivotProviderBundle,
} from '../../../types/fedPivotV2';
import { fetchRawFedPivotProviderBundle } from './fedPivotProvider';
import {
  buildHistoricalPivotSeriesAndEvents,
  evaluateFedPivotSignalsAndScore,
  OFFICIAL_FOMC_DATES_V2,
} from './fedPivotRulesEngine';
import {
  evaluateFedPivotAssetImpacts,
  evaluateFedPivotScenarios,
} from './fedPivotScenarioEngine';
import { recordAndDiffFedPivotSnapshot } from './fedPivotHistoryStore';
import { generateFedPivotSmartAlerts } from './fedPivotAlertEngine';

let cachedIntelligenceV2: FedPivotIntelligenceV2 | null = null;
const V2_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes UI memoization

export function buildFedPivotIntelligenceFromBundle(
  bundle: RawFedPivotProviderBundle,
  nowMs: number = bundle.fetchedAtMs
): FedPivotIntelligenceV2 {
  const evaluated = evaluateFedPivotSignalsAndScore(bundle);
  const {
    dominantScenarioId,
    dominantScenarioLabel,
    scenarios,
    macroNarrativeSummary,
  } = evaluateFedPivotScenarios(evaluated);

  const assetImpacts = evaluateFedPivotAssetImpacts(evaluated, dominantScenarioId);

  const { snapshotDiff, savedSnapshots } = recordAndDiffFedPivotSnapshot({
    evaluated,
    dominantScenario: dominantScenarioId,
    nowMs,
  });

  const activeAlerts = generateFedPivotSmartAlerts({
    evaluated,
    dominantScenarioId,
    scenarios,
    snapshotDiff,
    nowMs,
  });

  const { historicalSeries, eventMarkers } = buildHistoricalPivotSeriesAndEvents(bundle);

  // Upcoming FOMC countdown summary
  let nextFomcSummary: FedPivotIntelligenceV2['nextFomcSummary'] = null;
  const upcomingFomc = OFFICIAL_FOMC_DATES_V2.find(f => {
    const ms = Date.parse(`${f.dateISO}T19:00:00Z`);
    return Number.isFinite(ms) && ms >= nowMs - 4 * 3600_000;
  });

  if (upcomingFomc) {
    const fomcMs = Date.parse(`${upcomingFomc.dateISO}T19:00:00Z`);
    const daysRemaining = Math.max(0, Math.ceil((fomcMs - nowMs) / 86_400_000));
    nextFomcSummary = {
      title: upcomingFomc.label,
      dateLabel: upcomingFomc.dateISO,
      daysRemaining,
      hasDotPlot: upcomingFomc.hasDotPlot,
    };
  }

  return {
    version: '2.0',
    updatedAtMs: nowMs,
    updatedAtISO: new Date(nowMs).toISOString(),
    pivotScore: evaluated.pivotScore,
    maxScore: 7,
    status: evaluated.status,
    statusLabel: evaluated.statusLabel,
    statusDescription: evaluated.statusDescription,
    dominantScenarioId,
    dominantScenarioLabel,
    macroNarrativeSummary,
    dataQuality: evaluated.dataQuality,
    snapshotDiff,
    signals: evaluated.signals,
    historicalSeries,
    eventMarkers,
    savedSnapshots,
    scenarios,
    assetImpacts,
    activeAlerts,
    nextFomcSummary,
  };
}

export async function fetchFedPivotIntelligenceV2(
  forceRefresh: boolean = false
): Promise<FedPivotIntelligenceV2> {
  if (
    !forceRefresh &&
    cachedIntelligenceV2 &&
    Date.now() - cachedIntelligenceV2.updatedAtMs < V2_CACHE_TTL_MS
  ) {
    return cachedIntelligenceV2;
  }

  const bundle = await fetchRawFedPivotProviderBundle(forceRefresh);
  const built = buildFedPivotIntelligenceFromBundle(bundle, Date.now());
  cachedIntelligenceV2 = built;
  return built;
}

export * from './fedPivotValidator';
export * from './fedPivotProvider';
export * from './fedPivotRulesEngine';
export * from './fedPivotScenarioEngine';
export * from './fedPivotHistoryStore';
export * from './fedPivotAlertEngine';
