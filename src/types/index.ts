// Core Market Data Types
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

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W';

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
  upperConfidenceBound: { time: number; price: number }[]; // 95%
  lowerConfidenceBound: { time: number; price: number }[]; // 95%
  medianForecast: { time: number; price: number }[];
  scenarios: AIPredictionScenario[];
  volatilityForecast: number;
  aiReasoning: string[];
  keyDrivers: string[];
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

// Multi-Strategy Hub & Screener
export interface StrategyHubItem {
  id: string;
  name: string;
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
  longShortRatio: number; // e.g. 1.25
  fundingRate: number; // e.g. 0.01%
  volatilityIndex: number;
}
