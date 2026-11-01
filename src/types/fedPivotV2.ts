export type FedPivotV2Status =
  | 'NO_PIVOT'
  | 'WATCH'
  | 'EARLY_PIVOT'
  | 'PIVOT_WINDOW'
  | 'STRONG_CONVERGENCE';

export type FedPivotSignalState =
  | 'CONFIRMED'
  | 'PARTIAL'
  | 'UNCONFIRMED'
  | 'CONFLICTING'
  | 'UNKNOWN';

export type FedPivotSignalId =
  | 'CORE_PCE'
  | 'NFP_TREND'
  | 'UNEMPLOYMENT_CLAIMS'
  | 'FED_FUNDS_FUTURES'
  | 'US_TREASURY_2Y'
  | 'REAL_YIELD_DXY'
  | 'CREDIT_FINANCIAL_STRESS';

export interface TimeSeriesObservation {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface ValidatedMacroSeries {
  seriesId: string;
  source: string;
  cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  observations: TimeSeriesObservation[];
  fetchedAtISO: string;
  latestDate: string | null;
  ageDays: number | null;
  isValid: boolean;
  isStale: boolean;
  invalidReason?: string;
}

export interface RawFedPivotProviderBundle {
  fetchedAtMs: number;
  fetchedAtISO: string;
  nyFedEffr: {
    effectiveRate: number;
    targetRangeLow: number;
    targetRangeHigh: number;
    effectiveDate: string;
  } | null;
  futuresQuote: {
    frontRate: number | null;
    implied1mRate: number | null;
    implied3mRate: number | null;
    implied6mRate: number | null;
    contract3m: string;
    contract6m: string;
    dxySpot: number | null;
    dxyChangePct: number | null;
  };
  fredSeries: {
    PCEPILFE: ValidatedMacroSeries;
    CPIAUCSL: ValidatedMacroSeries;
    PAYEMS: ValidatedMacroSeries;
    UNRATE: ValidatedMacroSeries;
    ICSA: ValidatedMacroSeries;
    EFFR: ValidatedMacroSeries;
    DGS2: ValidatedMacroSeries;
    DFII10: ValidatedMacroSeries;
    DTWEXBGS: ValidatedMacroSeries;
    BAMLH0A0HYM2: ValidatedMacroSeries;
    STLFSI4: ValidatedMacroSeries;
  };
}

export interface FedPivotSignalItem {
  id: FedPivotSignalId;
  order: number;
  title: string;
  subtitle: string;
  latestDisplay: string;
  previousDisplay: string;
  deltaDisplay: string;
  latestNumeric: number | null;
  previousNumeric: number | null;
  state: FedPivotSignalState;
  rawScore: number; // 0 | 0.5 | 1.0 (strictly 0 when UNKNOWN)
  effectiveScore: number; // Post anti-collinearity adjustment
  collinearityAdjusted?: boolean;
  collinearityNote?: string;
  rationale: string;
  source: string;
  releaseDate: string;
  fetchedAtISO: string;
  isStale: boolean;
}

export interface FedPivotDataQuality {
  validSignalsCount: number;
  totalSignalsCount: number;
  coverageRatioPct: number;
  confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceLabel: string;
  unknownSignalIds: FedPivotSignalId[];
  staleSignalIds: FedPivotSignalId[];
  collinearityApplied: boolean;
  collinearityExplanation?: string;
}

export interface FedPivotHistoricalPoint {
  dateISO: string;
  timestampSec: number;
  score: number;
  status: FedPivotV2Status;
  validSignalsCount: number;
}

export type FedPivotEventType = 'FOMC' | 'CPI' | 'PCE' | 'NFP';

export interface FedPivotMacroEventMarker {
  id: string;
  dateISO: string;
  timestampSec: number;
  type: FedPivotEventType;
  shortTag: string;
  title: string;
  detail: string;
}

export interface FedPivotUserSnapshot {
  id: string;
  timestampMs: number;
  dateISO: string;
  pivotScore: number;
  status: FedPivotV2Status;
  dominantScenario: FedPivotScenarioId;
  validSignalsCount: number;
  signalStates: Partial<Record<FedPivotSignalId, FedPivotSignalState>>;
  metrics: {
    corePce3mAnn: number | null;
    nfp3mAvgK: number | null;
    unemploymentRate: number | null;
    zqDelta6mBps: number | null;
    us2yYield: number | null;
    real10yYield: number | null;
    hySpreadPct: number | null;
  };
}

export interface FedPivotSnapshotDiff {
  hasPreviousSnapshot: boolean;
  previousTimestampMs: number | null;
  scoreDelta: number;
  statusChanged: boolean;
  previousStatus: FedPivotV2Status | null;
  scenarioChanged: boolean;
  previousScenario: FedPivotScenarioId | null;
  highlights: string[];
}

export type FedPivotScenarioId = 'SOFT_LANDING' | 'RECESSION' | 'FINANCIAL_STRESS';

export interface FedPivotScenarioAnalysis {
  id: FedPivotScenarioId;
  title: string;
  vietnameseTitle: string;
  definition: string;
  confidenceTier: 'HIGH' | 'MODERATE' | 'LOW' | 'INACTIVE';
  confidenceLabel: string;
  methodologyNote: string;
  isDominant: boolean;
  supportingEvidence: string[];
  conflictingSignals: string[];
  confirmationConditions: string[];
  expectedMarketImpact: string;
}

export type FedPivotAssetGroupId =
  | 'GOLD_XAUUSD'
  | 'CRYPTO_MAJORS'
  | 'US_EQUITIES'
  | 'VN_EQUITIES'
  | 'FX_DXY_USDVND';

export interface FedPivotAssetGroupImpact {
  id: FedPivotAssetGroupId;
  groupTitle: string;
  assetsLabel: string;
  directionBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL_SELECTIVE' | 'VOLATILE_TWO_WAY';
  directionLabel: string;
  impactMechanism: string;
  confirmationCondition: string;
  contrarianReversalRisk: string;
  jumpTickers: string[];
}

export type FedPivotAlertTier =
  | 'WATCH'
  | 'EARLY_PIVOT'
  | 'PIVOT_WINDOW'
  | 'STRONG_CONVERGENCE'
  | 'RISK_WARNING';

export interface TelegramDispatchContract {
  readyForBackendPhase: boolean;
  serverEndpoint: string;
  fingerprint: string;
  tier: FedPivotAlertTier;
  markdownSummary: string;
}

export interface FedPivotSmartAlert {
  id: string;
  fingerprint: string;
  tier: FedPivotAlertTier;
  tierLabel: string;
  createdAtMs: number;
  isNew: boolean;
  whatChanged: string;
  confirmingEvidence: string[];
  conflictingSignals: string[];
  affectedAssets: string[];
  actionableChecklist: string[];
  telegramContract: TelegramDispatchContract;
}

export interface FedPivotIntelligenceV2 {
  version: '2.0';
  updatedAtMs: number;
  updatedAtISO: string;
  pivotScore: number; // 0.0 .. 7.0 (Signal Convergence Score, NOT rate-cut probability)
  maxScore: 7;
  status: FedPivotV2Status;
  statusLabel: string;
  statusDescription: string;
  dominantScenarioId: FedPivotScenarioId;
  dominantScenarioLabel: string;
  macroNarrativeSummary: string;
  dataQuality: FedPivotDataQuality;
  snapshotDiff: FedPivotSnapshotDiff;
  signals: FedPivotSignalItem[];
  historicalSeries: FedPivotHistoricalPoint[];
  eventMarkers: FedPivotMacroEventMarker[];
  savedSnapshots: FedPivotUserSnapshot[];
  scenarios: FedPivotScenarioAnalysis[];
  assetImpacts: FedPivotAssetGroupImpact[];
  activeAlerts: FedPivotSmartAlert[];
  nextFomcSummary: {
    title: string;
    dateLabel: string;
    daysRemaining: number;
    hasDotPlot: boolean;
  } | null;
}
