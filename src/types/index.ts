// Core Market Data Types
import { FedPivotIntelligenceV2 } from './fedPivotV2';
export * from './fedPivotV2';

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type MarketType = 'crypto' | 'stock' | 'vn30' | 'index' | 'forex' | 'commodity';

export interface MarketSymbol {
  symbol: string;
  name: string;
  type: MarketType;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  category?: string;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W' | '1M';

// Indicators Settings & Data
export interface IndicatorSettings {
  ema20: boolean;
  ema50: boolean;
  ema200: boolean;
  bollingerBands: boolean;
  supertrend: boolean;
  ichimoku: boolean;
  rsi: boolean;
  macd: boolean;
  stochastic: boolean;
  vwap: boolean;
  volumeProfile: boolean;
  autoSupportResistance: boolean;
  autoFibonacci: boolean;
  smartMoneyConcepts: boolean;
  aiForecast: boolean;
  monteCarloPaths: boolean;
  kronosGhostCandles: boolean;
  kronosWalkForward: boolean;
  vnPriceLimits?: boolean;
  globalOptionsAndLiqLines?: boolean;
  recommendedPlanLines?: boolean;
  holdingCostLines?: boolean;
}

export type KronosModelKey = 'kronos-mini' | 'kronos-small' | 'kronos-base';

export interface KronosConfig {
  modelKey: KronosModelKey;
  predLen: number;
  temperature: number;
  topP: number;
  sampleCount: number;
  endpointUrl?: string;
}

export interface KronosMetadata {
  modelName: string;
  params: string;
  contextLength: number;
  engineMode: 'KRONOS_CLOUD_PYTORCH' | 'KRONOS_LOCAL_TRANSFORMER';
  s1Bits: number;
  s2Bits: number;
  tokenEntropy: number;
  latencyMs: number;
}

export interface KronosWalkForwardValidation {
  holdoutBars: number;
  directionalAccuracy: number; // 0 - 100%
  mapePercent: number;
  rmse: number;
  anchorTime: number;
  anchorPrice: number;
  backtestPath: { time: number; price: number }[];
  grade: 'EXCELLENT' | 'GOOD' | 'MODERATE';
}

export interface KronosVolumeProfile {
  avgHistoricalVolume: number;
  avgPredictedVolume: number;
  peakPredictedVolume: number;
  peakBarOffset: number;
  volumeChangePercent: number;
  surgeDetected: boolean;
  liquidityRegime: 'SURGE' | 'ACCUMULATION' | 'NORMAL' | 'DRY_UP';
}

export interface KronosMTFItem {
  timeframe: '15m' | '1h' | '4h' | '1D';
  label: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  expectedReturnPct: number;
  bullProb: number;
  confidence: number;
  isRealFetched?: boolean;
}

export interface KronosMTFConfluence {
  items: KronosMTFItem[];
  alignmentCount: number;
  dominantDirection: 'BULLISH' | 'BEARISH' | 'MIXED';
  summaryLabel: string;
}

export interface KronosAlphaRankItem {
  symbol: string;
  name: string;
  type: MarketType;
  quoteAsset: string;
  currentPrice: number;
  change24h: number;
  volume24h: number;
  expectedReturn24Bar: number;
  targetPriceP50: number;
  tailRiskP05Pct: number;
  bullProbability: number;
  alphaScore: number;
  signalTag: 'TOP_LONG' | 'ACCUMULATE' | 'NEUTRAL' | 'REDUCE' | 'TOP_SHORT';
}

export interface SupportResistanceLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number; // 1 - 5 stars
  touches: number;
  lastTouchTime?: number;
  isBreakout?: boolean;
}

export interface FibonacciLevel {
  ratio: number;
  price: number;
  label: string;
  color: string;
  isKeyZone: boolean;
}

export interface OrderBlock {
  type: 'bullish_ob' | 'bearish_ob' | 'fvg_bull' | 'fvg_bear';
  top: number;
  bottom: number;
  time: number;
  mitigated: boolean;
  strength: number;
}

// AI Price Path Forecasting
export interface AIPredictionScenario {
  name: string;
  type: 'BULLISH' | 'BASE' | 'BEARISH';
  color: string;
  path: { time: number; price: number }[];
  probability: number;
  targetPrice: number;
  priceChangePercent: number;
  invalidationPrice: number;
  timeHorizon: string;
  description: string;
  triggers: string[];
  actionPlan: string;
  riskReward: string;
}

export interface AIPrediction {
  symbol: string;
  currentPrice: number;
  trend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  confidenceScore: number; // 0 - 100%
  expectedPriceChangePercent: number;
  forecastHorizonBars: number;
  upperConfidenceBound: { time: number; price: number }[]; // 95% (Kronos P95)
  lowerConfidenceBound: { time: number; price: number }[]; // 95% (Kronos P05)
  medianForecast: { time: number; price: number }[]; // Kronos P50
  predictedCandles: Candle[]; // Kronos Full OHLCV Ghost Candlesticks
  kronosMeta: KronosMetadata;
  walkForward?: KronosWalkForwardValidation;
  volumeProfile?: KronosVolumeProfile;
  mtfConfluence?: KronosMTFConfluence;
  scenarios: AIPredictionScenario[];
  volatilityForecast: number;
  aiReasoning: string[];
  keyDrivers: string[];
  macroImpact?: SymbolMacroImpact;
}

// Trading Signals & Strategies
export type SignalAction = 'STRONG_BUY' | 'BUY' | 'WAIT' | 'SELL' | 'STRONG_SELL';

export interface TradeSetup {
  action: SignalAction;
  symbol: string;
  timeframe: Timeframe;
  entryZone: [number, number];
  currentPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  winProbability: number;
  strategyName: string;
  strategyReason: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: number;
}

export interface StrategyHubItem {
  id: string;
  name: string;
  shortName?: string;
  category: string;
  description: string;
  action: SignalAction;
  score: number; // 0-100
  entryZone: [number, number];
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  winProbability: number;
  triggers: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  isOptimal?: boolean;
}

export interface StrategyAnalysisHub {
  symbol: string;
  timeframe: Timeframe;
  currentPrice: number;
  overallConsensus: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  confluenceCount: { buy: number; sell: number; neutral: number };
  bestStrategy: StrategyHubItem;
  strategies: StrategyHubItem[];
  macroImpact?: SymbolMacroImpact;
}

// Backtesting Result
export interface BacktestTrade {
  id: string;
  type: 'BUY' | 'SELL';
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  profitPercent: number;
  pnlAmount: number;
  reason: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'SIGNAL_CLOSE';
  status: 'WIN' | 'LOSS';
}

export interface BacktestResult {
  strategyName: string;
  totalTrades: number;
  winRate: number; // percentage
  profitFactor: number;
  totalReturnPercent: number;
  maxDrawdownPercent: number;
  trades: BacktestTrade[];
  equityCurve: { time: number; balance: number }[];
  sharpeRatio: number;
}

// Market Depth / Order Book
export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  spreadPercent: number;
}

// Market Sentiment & Metrics
export interface MarketSentiment {
  fearAndGreedIndex: number; // 0 - 100
  sentimentClassification: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  longShortRatio: number;
  fundingRate: number;
  volatilityIndex: number;
  isLiveCryptoFng?: boolean;
  sourceLabel?: string;
  advancers?: number;
  decliners?: number;
  totalTracked?: number;
  rsi14?: number;
}

// ================= MACROECONOMIC INTELLIGENCE & LIVE AUDIT LOG =================
export type MacroRegime = 'RISK_ON' | 'NEUTRAL' | 'CAUTIOUS' | 'RISK_OFF';
export type MacroAlertSeverity = 'CRITICAL' | 'WARNING' | 'POSITIVE' | 'INFO';

export interface MacroIndicatorItem {
  id:
    | 'FED_FUNDS'
    | 'DXY'
    | 'USDVND'
    | 'US10Y'
    | 'US3M'
    | 'VIX'
    | 'BRENT'
    | 'SP500'
    | 'NASDAQ'
    | 'BTC_FUNDING';
  label: string;
  shortLabel: string;
  value: number;
  displayValue: string;
  changePercent: number;
  status: 'NORMAL' | 'ELEVATED' | 'STRESS' | 'FAVORABLE';
  impactSummary: string;
  source: string;
}

export type FedPivotStance =
  | 'DOVISH_PIVOT'
  | 'EMERGENCY_EASING'
  | 'ON_HOLD_WATCH'
  | 'HAWKISH_TIGHTENING';

export interface FedPivotFactorCheck {
  id: string;
  label: string;
  metricValue: string;
  thresholdRule: string;
  state: 'PASSED' | 'WATCH' | 'BLOCKED';
  detail: string;
}

export interface FedRateCurvePoint {
  horizonLabel: string;
  contractSymbol: string;
  impliedRate: number;
  deltaBps: number;
}

export interface FedPivotWatchSnapshot {
  stance: FedPivotStance;
  stanceLabel: string;
  summary: string;
  effectiveRate: number; // Official NY Fed EFFR (or ZQ front-month implied)
  effectiveDate: string;
  targetRangeLow: number;
  targetRangeHigh: number;
  implied3mRate: number;
  implied6mRate: number;
  delta3mBps: number; // Implied 3M - EFFR in basis points
  delta6mBps: number; // Implied 6M - EFFR in basis points
  pricedMoves6m: number; // Number of 25bps moves (+hike / -cut)
  cutProb3mPct: number; // 0..100
  holdProb3mPct: number; // 0..100
  hikeProb3mPct: number; // 0..100
  passedConditionsCount: number;
  totalConditionsCount: number;
  rateCurve: FedRateCurvePoint[];
  checklist: FedPivotFactorCheck[];
  nextFomc: {
    title: string;
    dateLabel: string;
    daysRemaining: number;
    hoursRemaining: number;
    hasDotPlot: boolean;
  } | null;
  sourceLabel: string;
}

export interface MacroAlertItem {
  id: string;
  severity: MacroAlertSeverity;
  title: string;
  message: string;
  affectedAssets: string[];
  metricBadge: string;
}

export interface MacroCalendarEvent {
  id: string;
  title: string;
  market: 'VN' | 'GLOBAL' | 'CRYPTO';
  dateISO: string;
  dateLabel: string;
  daysRemaining: number;
  hoursRemaining: number;
  impactLevel: 'HIGH' | 'MEDIUM';
  guidance: string;
}

export interface MacroIntelligenceSnapshot {
  updatedAt: number;
  regime: MacroRegime;
  regimeLabel: string;
  regimeScore: number; // -100 .. +100
  kellyDamper: number; // 0.45 .. 1.05 multiplier on Half-Kelly sizing
  yieldCurveSpread: number; // US10Y - US3M percentage points
  fedPivot?: FedPivotWatchSnapshot;
  fedPivotV2?: FedPivotIntelligenceV2;
  indicators: MacroIndicatorItem[];
  globalAlerts: MacroAlertItem[];
  upcomingEvents: MacroCalendarEvent[];
}

export interface SymbolMacroImpact {
  bias: 'TAILWIND' | 'NEUTRAL' | 'HEADWIND' | 'SEVERE_HEADWIND';
  scoreAdjustment: number; // -18 .. +12
  headline: string;
  bullets: string[];
  relevantAlerts: MacroAlertItem[];
}

export interface ForecastAuditEntry {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  createdAt: number; // unix sec
  targetTimestamp: number; // unix sec
  horizonBars: number;
  entryPrice: number;
  predictedPriceP50: number;
  predictedChangePct: number;
  predictedDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  modelKey: string;
  status: 'PENDING' | 'VERIFIED';
  actualPrice?: number;
  actualChangePct?: number;
  absErrorPct?: number;
  directionHit?: boolean;
  verifiedAt?: number;
}

export interface ForecastAuditStats {
  totalRecorded: number;
  verifiedCount: number;
  pendingCount: number;
  directionalHitRate: number | null; // null if 0 verified
  meanAbsErrorPct: number | null;
}
