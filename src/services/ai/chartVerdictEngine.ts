import {
  AIPrediction,
  Candle,
  MacroIntelligenceSnapshot,
  MarketSentiment,
  MarketSymbol,
  SignalAction,
  Timeframe,
} from '../../types';
import {
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSuperTrend,
} from '../indicators';
import { calculateSupportResistance } from '../analysis/supportResistance';
import { calculateFibonacciLevels } from '../analysis/fibonacci';
import { detectOrderBlocks } from '../analysis/smartMoney';
import {
  calculateRollingVWAP,
  calculateVisibleVolumeProfile,
  evaluateTechnicalMtfConfluence,
} from '../analysis/volumeProfileMtf';
import { evaluateSymbolMacroImpact } from '../macro/macroIntelligence';
import {
  computeVn30BasisAnalytics,
  computeVnIntradaySessionPulse,
  computeVnPriceLimits,
  getVnExchangeBoard,
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
  roundToVnTickSize,
  VnExchangeBoard,
} from '../vnMarket/vnStockMicrostructure';
import { computeVnActiveOrderFlow } from '../vnMarket/vnExecutionEngines';
import { VnStockInsightsPayload } from '../vnMarket/vnStockInsightsClient';
import {
  computeCryptoCapitalCycle,
  computeCryptoLiquidationAndCarry,
  computeUsExtendedHoursPulse,
  isCryptoSymbol,
  isUsOrGlobalEquitySymbol,
} from '../globalMarket/globalExecutionEngines';
import { GlobalMarketInsightsResponse } from '../globalMarket/globalMarketInsightsClient';

export type VerdictCode =
  | 'STRONG_BUY'
  | 'ACCUMULATE_LIMIT'
  | 'HOLD_OBSERVE'
  | 'REDUCE_TAKE_PROFIT'
  | 'SELL_SHORT'
  | 'STAND_ASIDE_VETO';

export interface RecommendationPillarScore {
  id: 'mtf_trend' | 'smc_vpvr' | 'kronos_ai' | 'microstructure' | 'macro_sentiment' | 'risk_guard';
  nameVi: string;
  shortNameVi: string;
  score: number; // -100 .. +100
  weight: number; // 0 .. 1
  status: 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'WARNING';
  summaryVi: string;
}

export interface RiskVetoItem {
  code:
    | 'US_IMMINENT_EARNINGS'
    | 'VN_NEAR_CEILING_T25'
    | 'VN_ATC_NOISE'
    | 'VN_EX_DIVIDEND_GAP'
    | 'CRYPTO_HOT_FUNDING'
    | 'HTF_COUNTER_TREND'
    | 'SEVERE_MACRO_HEADWIND'
    | 'OVERBOUGHT_CHASE';
  severity: 'HARD_VETO' | 'CAUTION';
  titleVi: string;
  detailVi: string;
}

export interface ChartRecommendationVerdict {
  symbol: string;
  timeframe: Timeframe;
  currentPrice: number;
  isReplayMode: boolean;
  marketClass: 'VN_EQUITY' | 'VN_DERIVATIVE_OR_INDEX' | 'CRYPTO' | 'US_GLOBAL_EQUITY' | 'MACRO_FX_COMMODITY';
  canShortAsset: boolean;
  verdictCode: VerdictCode;
  signalAction: SignalAction;
  verdictLabelVi: string;
  verdictTaglineVi: string;
  convictionScore: number; // 0 .. 100
  directionalBiasScore: number; // -100 .. +100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedAllocationPct: number; // 0 .. 70
  executionStyleVi: string;
  leverageGuidanceVi: string;
  isShortPlan: boolean;
  hasActionablePlan: boolean;
  entryZone: [number, number];
  entryMidPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  winProbability: number;
  entryAnchorVi: string;
  slAnchorVi: string;
  tpAnchorVi: string;
  pillars: RecommendationPillarScore[];
  bullishDriversVi: string[];
  riskFactorsVi: string[];
  vetoes: RiskVetoItem[];
}

export interface ChartRecommendationInput {
  symbolObj: MarketSymbol;
  candles: Candle[];
  timeframe: Timeframe;
  mtfCandlesMap?: Partial<Record<Timeframe, Candle[]>>;
  aiPrediction?: AIPrediction | null;
  macroSnapshot?: MacroIntelligenceSnapshot | null;
  marketSentiment?: MarketSentiment | null;
  vnInsights?: VnStockInsightsPayload | null;
  globalInsights?: GlobalMarketInsightsResponse | null;
  allSymbols?: MarketSymbol[];
  isReplayMode?: boolean;
  now?: Date;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function normalizeSmartPlanPrice(
  rawPrice: number,
  symbolObj: MarketSymbol,
  vnBoard: VnExchangeBoard | null
): number {
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) return 0;

  if (vnBoard && vnBoard !== 'INDEX') {
    return roundToVnTickSize(rawPrice, vnBoard);
  }
  if (vnBoard === 'INDEX') {
    return Number(rawPrice.toFixed(2));
  }

  if (rawPrice >= 1000) return Number(rawPrice.toFixed(2));
  if (rawPrice >= 10) return Number(rawPrice.toFixed(2));
  if (rawPrice >= 1) return Number(rawPrice.toFixed(4));
  if (rawPrice >= 0.01) return Number(rawPrice.toFixed(5));
  if (rawPrice >= 0.0001) return Number(rawPrice.toFixed(7));
  return Number(rawPrice.toPrecision(4));
}

function formatCompactPriceLabel(price: number, isVND: boolean, isVnIdxOrDeriv: boolean): string {
  if (!Number.isFinite(price) || price <= 0) return '—';
  if (isVND) {
    return isVnIdxOrDeriv ? `${price.toFixed(1)} đ` : `${price.toFixed(2)}k`;
  }
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toPrecision(4)}`;
}

/**
 * Unified 6-Pillar Institutional Recommendation Engine for On-Chart & Sidebar Decision Support.
 * Strictly deterministic on real fetched market data; enforces Zero Look-Ahead in Bar Replay mode.
 */
export function evaluateChartRecommendation(
  input: ChartRecommendationInput
): ChartRecommendationVerdict {
  const {
    symbolObj,
    candles,
    timeframe,
    mtfCandlesMap = {},
    aiPrediction = null,
    macroSnapshot = null,
    marketSentiment = null,
    isReplayMode = false,
    now = new Date(),
  } = input;

  // Enforce strict Zero Look-Ahead during historical Bar Replay
  const vnInsights = isReplayMode ? null : input.vnInsights ?? null;
  const globalInsights = isReplayMode ? null : input.globalInsights ?? null;
  const allSymbols = isReplayMode ? [] : input.allSymbols ?? [];

  const symUpper = symbolObj.symbol.trim().toUpperCase();
  const isVN = isVnStockOrIndexSymbol(symbolObj);
  const isVnDeriv = isVnDerivativeSymbol(symUpper);
  const isVnIdx = ['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX'].includes(symUpper);
  const isCrypto = !isVN && isCryptoSymbol(symbolObj);
  const isUsGlobal = !isVN && !isCrypto && isUsOrGlobalEquitySymbol(symbolObj);
  const vnBoard: VnExchangeBoard | null = isVN ? getVnExchangeBoard(symUpper) : null;
  const isVND = isVN || symbolObj.quoteAsset === 'VND';
  const isVnIdxOrDeriv = isVnIdx || isVnDeriv;

  const marketClass: ChartRecommendationVerdict['marketClass'] = isVN
    ? isVnIdxOrDeriv
      ? 'VN_DERIVATIVE_OR_INDEX'
      : 'VN_EQUITY'
    : isCrypto
    ? 'CRYPTO'
    : isUsGlobal
    ? 'US_GLOBAL_EQUITY'
    : 'MACRO_FX_COMMODITY';

  // Vietnam corporate stocks & cash indices do NOT allow naked short selling
  const canShortAsset =
    marketClass === 'CRYPTO' ||
    marketClass === 'US_GLOBAL_EQUITY' ||
    marketClass === 'MACRO_FX_COMMODITY' ||
    isVnDeriv;

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const currentPrice =
    isReplayMode && lastCandle
      ? lastCandle.close
      : lastCandle?.close || symbolObj.price || 100;

  if (!candles || candles.length < 25) {
    const pLow = normalizeSmartPlanPrice(currentPrice * 0.99, symbolObj, vnBoard);
    const pHigh = normalizeSmartPlanPrice(currentPrice * 1.005, symbolObj, vnBoard);
    const sl = normalizeSmartPlanPrice(currentPrice * 0.96, symbolObj, vnBoard);
    const tp1 = normalizeSmartPlanPrice(currentPrice * 1.03, symbolObj, vnBoard);
    const tp2 = normalizeSmartPlanPrice(currentPrice * 1.06, symbolObj, vnBoard);
    const tp3 = normalizeSmartPlanPrice(currentPrice * 1.1, symbolObj, vnBoard);
    return {
      symbol: symUpper,
      timeframe,
      currentPrice,
      isReplayMode,
      marketClass,
      canShortAsset,
      verdictCode: 'HOLD_OBSERVE',
      signalAction: 'WAIT',
      verdictLabelVi: 'ĐANG NẠP DỮ LIỆU NẾN',
      verdictTaglineVi: 'Cần tối thiểu 25 nến lịch sử để chấm điểm hội tụ 6 tầng.',
      convictionScore: 45,
      directionalBiasScore: 0,
      riskLevel: 'LOW',
      suggestedAllocationPct: 0,
      executionStyleVi: 'Chờ nạp hoàn tất chuỗi nến OHLCV thực tế',
      leverageGuidanceVi: 'Đứng ngoài chờ dữ liệu',
      isShortPlan: false,
      hasActionablePlan: false,
      entryZone: [pLow, pHigh],
      entryMidPrice: currentPrice,
      stopLoss: sl,
      takeProfit1: tp1,
      takeProfit2: tp2,
      takeProfit3: tp3,
      riskRewardRatio: 2.0,
      winProbability: 50,
      entryAnchorVi: 'Giá tham chiếu tạm thời',
      slAnchorVi: 'Biên an toàn mặc định',
      tpAnchorVi: 'Mục tiêu cơ sở',
      pillars: [],
      bullishDriversVi: [],
      riskFactorsVi: ['Chưa đủ số lượng nến lịch sử trên khung hiện tại'],
      vetoes: [],
    };
  }

  const closes = candles.map((c) => c.close);
  const atrArr = calculateATR(candles, 14);
  const atr = atrArr[atrArr.length - 1] || currentPrice * 0.02;
  const ema20Arr = calculateEMA(closes, 20);
  const ema50Arr = calculateEMA(closes, Math.min(50, closes.length));
  const ema200Arr = calculateEMA(closes, Math.min(200, closes.length));
  const rsiArr = calculateRSI(candles, 14);
  const macdArr = calculateMACD(candles);
  const bbArr = calculateBollingerBands(candles, 20, 2);
  const stArr = calculateSuperTrend(candles, 10, 3);

  const lastEma20 = ema20Arr[ema20Arr.length - 1] ?? currentPrice;
  const lastEma50 = ema50Arr[ema50Arr.length - 1] ?? currentPrice;
  const lastEma200 = ema200Arr[ema200Arr.length - 1] ?? currentPrice;
  const lastRsi = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1].value : 50;
  const lastMacd = macdArr.length > 0 ? macdArr[macdArr.length - 1] : null;
  const lastBb = bbArr.length > 0 ? bbArr[bbArr.length - 1] : null;
  const lastSt = stArr.length > 0 ? stArr[stArr.length - 1] : null;

  const bullishDrivers: Array<{ priority: number; text: string }> = [];
  const riskFactors: Array<{ priority: number; text: string }> = [];
  const vetoes: RiskVetoItem[] = [];

  // ==========================================================================
  // PILLAR 1: MULTI-TIMEFRAME CONFLUENCE & ACTIVE TECHNICAL MOMENTUM (Weight 24%)
  // ==========================================================================
  const mtfSummary = evaluateTechnicalMtfConfluence(symUpper, timeframe, candles, mtfCandlesMap);
  let p1Score = mtfSummary.availableCount > 0 ? mtfSummary.overallScore * 0.62 : 0;

  if (currentPrice > lastEma20 && lastEma20 > lastEma50) p1Score += 18;
  else if (currentPrice < lastEma20 && lastEma20 < lastEma50) p1Score -= 18;

  if (currentPrice > lastEma200) p1Score += 10;
  else p1Score -= 10;

  if (lastSt?.direction === 1) p1Score += 12;
  else if (lastSt?.direction === -1) p1Score -= 12;

  if (lastMacd) {
    if (lastMacd.macd > lastMacd.signal && lastMacd.histogram > 0) p1Score += 8;
    else if (lastMacd.macd < lastMacd.signal && lastMacd.histogram < 0) p1Score -= 8;
  }

  p1Score = clamp(Math.round(p1Score), -100, 100);

  if (mtfSummary.bullCount >= 3 && mtfSummary.overallScore >= 35) {
    bullishDrivers.push({
      priority: 92,
      text: `Đồng thuận đa khung ${mtfSummary.bullCount}/${mtfSummary.availableCount} khung Tăng (${mtfSummary.regimeLabel})`,
    });
  } else if (mtfSummary.bearCount >= 3 && mtfSummary.overallScore <= -35) {
    riskFactors.push({
      priority: 92,
      text: `Áp lực giảm đồng loạt ${mtfSummary.bearCount}/${mtfSummary.availableCount} khung thời gian (${mtfSummary.regimeLabel})`,
    });
  } else if (currentPrice > lastEma20 && lastSt?.direction === 1) {
    bullishDrivers.push({
      priority: 74,
      text: `Giá giữ vững trên EMA20 (${formatCompactPriceLabel(lastEma20, isVND, isVnIdxOrDeriv)}) & SuperTrend Tăng`,
    });
  } else if (currentPrice < lastEma20 && lastSt?.direction === -1) {
    riskFactors.push({
      priority: 74,
      text: `Giá gãy dưới EMA20 (${formatCompactPriceLabel(lastEma20, isVND, isVnIdxOrDeriv)}) & SuperTrend chuyển Giảm`,
    });
  }

  if (mtfSummary.conflictWarning && mtfSummary.conflictWarning.includes('Bull Trap')) {
    vetoes.push({
      code: 'HTF_COUNTER_TREND',
      severity: 'CAUTION',
      titleVi: 'Ngược sóng lớn H4/D1',
      detailVi: mtfSummary.conflictWarning,
    });
    riskFactors.push({ priority: 89, text: mtfSummary.conflictWarning });
  }

  if (lastRsi >= 76) {
    vetoes.push({
      code: 'OVERBOUGHT_CHASE',
      severity: 'CAUTION',
      titleVi: `RSI(${lastRsi.toFixed(0)}) Quá mua căng`,
      detailVi: `RSI khung ${timeframe} đạt ${lastRsi.toFixed(1)} — Tránh FOMO mua đuổi giá cao, ưu tiên chờ nhịp test lại EMA20/POC.`,
    });
    riskFactors.push({
      priority: 80,
      text: `RSI(${lastRsi.toFixed(1)}) tiến vào vùng quá mua — Dễ xuất hiện nhịp rũ ngắn hạn`,
    });
  } else if (lastRsi <= 28) {
    bullishDrivers.push({
      priority: 72,
      text: `RSI(${lastRsi.toFixed(1)}) chiết khấu quá bán sâu — Xác suất bật hồi kỹ thuật cao`,
    });
  }

  const p1Summary =
    mtfSummary.availableCount >= 2
      ? `${mtfSummary.bullCount}/${mtfSummary.availableCount} khung Tăng • RSI ${lastRsi.toFixed(0)}`
      : `${lastSt?.direction === 1 ? 'SuperTrend Tăng' : 'SuperTrend Giảm'} • RSI ${lastRsi.toFixed(0)}`;

  // ==========================================================================
  // PILLAR 2: SMART MONEY CONCEPTS (OB/FVG) & VOLUME PROFILE VPVR (Weight 20%)
  // ==========================================================================
  const vpvr = calculateVisibleVolumeProfile(candles, 24, 0.7);
  const vwapArr = calculateRollingVWAP(candles);
  const lastVwap = vwapArr.length > 0 ? vwapArr[vwapArr.length - 1].vwap : null;
  const orderBlocks = detectOrderBlocks(candles);
  const srLevels = calculateSupportResistance(candles);
  const fibLevels = calculateFibonacciLevels(candles);

  let p2Score = 0;
  if (vpvr) {
    if (currentPrice >= vpvr.pocPrice) p2Score += 18;
    else p2Score -= 14;

    if (vpvr.buyPressurePct >= 56) {
      p2Score += 22;
      bullishDrivers.push({
        priority: 81,
        text: `VPVR Buy Pressure áp đảo ${vpvr.buyPressurePct.toFixed(0)}% (POC đỡ tại ${formatCompactPriceLabel(vpvr.pocPrice, isVND, isVnIdxOrDeriv)})`,
      });
    } else if (vpvr.buyPressurePct <= 44) {
      p2Score -= 22;
      riskFactors.push({
        priority: 81,
        text: `Áp lực xả chủ động VPVR chiếm ${(100 - vpvr.buyPressurePct).toFixed(0)}% quanh POC ${formatCompactPriceLabel(vpvr.pocPrice, isVND, isVnIdxOrDeriv)}`,
      });
    }
  }

  if (lastVwap) {
    if (currentPrice >= lastVwap) p2Score += 12;
    else p2Score -= 12;
  }

  const activeBullOb = orderBlocks.find(
    (ob) =>
      (ob.type === 'bullish_ob' || ob.type === 'fvg_bull') &&
      !ob.mitigated &&
      ob.top <= currentPrice * 1.015 &&
      currentPrice - ob.top <= atr * 2.4
  );
  const activeBearOb = orderBlocks.find(
    (ob) =>
      (ob.type === 'bearish_ob' || ob.type === 'fvg_bear') &&
      !ob.mitigated &&
      ob.bottom >= currentPrice * 0.985 &&
      ob.bottom - currentPrice <= atr * 2.4
  );

  if (activeBullOb) {
    p2Score += 26;
    bullishDrivers.push({
      priority: 85,
      text: `Đệm cầu tổ chức SMC Bullish OB đỡ ngay vùng ${formatCompactPriceLabel(activeBullOb.bottom, isVND, isVnIdxOrDeriv)}–${formatCompactPriceLabel(activeBullOb.top, isVND, isVnIdxOrDeriv)}`,
    });
  }
  if (activeBearOb) {
    p2Score -= 24;
    riskFactors.push({
      priority: 83,
      text: `Khối lệnh cung SMC Bearish OB chặn trên tại ${formatCompactPriceLabel(activeBearOb.bottom, isVND, isVnIdxOrDeriv)}–${formatCompactPriceLabel(activeBearOb.top, isVND, isVnIdxOrDeriv)}`,
    });
  }

  const fib618 = fibLevels.find((f) => f.ratio === 0.618);
  if (fib618 && Math.abs(currentPrice - fib618.price) / currentPrice <= 0.015) {
    p2Score += currentPrice >= fib618.price ? 14 : -8;
  }

  p2Score = clamp(Math.round(p2Score), -100, 100);
  const p2Summary = vpvr
    ? `${currentPrice >= vpvr.pocPrice ? 'Trên POC' : 'Dưới POC'} ${formatCompactPriceLabel(vpvr.pocPrice, isVND, isVnIdxOrDeriv)} • Mua ${vpvr.buyPressurePct.toFixed(0)}%`
    : activeBullOb
    ? 'Có Bullish Order Block đỡ'
    : activeBearOb
    ? 'Gặp cản Bearish Order Block'
    : 'Cấu trúc cung cầu cân bằng';

  // ==========================================================================
  // PILLAR 3: KRONOS FOUNDATION AI & WALK-FORWARD EMPIRICAL CALIBRATION (18%)
  // ==========================================================================
  let p3Score = 0;
  let p3Summary = 'Đang đồng bộ Kronos AI';

  if (aiPrediction) {
    const expMove = aiPrediction.expectedPriceChangePercent;
    const wfAcc = aiPrediction.walkForward?.directionalAccuracy ?? 58;
    // Calibrate AI trust factor by actual out-of-sample Walk-Forward accuracy on this symbol
    const wfTrustMultiplier =
      wfAcc >= 68 ? 1.2 : wfAcc >= 56 ? 1.0 : wfAcc >= 48 ? 0.72 : 0.45;

    let rawAi = clamp(expMove * 18, -75, 75);
    if (aiPrediction.trend === 'STRONG_BULLISH') rawAi += 20;
    else if (aiPrediction.trend === 'BULLISH') rawAi += 10;
    else if (aiPrediction.trend === 'STRONG_BEARISH') rawAi -= 20;
    else if (aiPrediction.trend === 'BEARISH') rawAi -= 10;

    p3Score = clamp(Math.round(rawAi * wfTrustMultiplier), -100, 100);
    p3Summary = `Kỳ vọng ${expMove >= 0 ? '+' : ''}${expMove.toFixed(2)}% • WF đúng ${wfAcc}%`;

    if (p3Score >= 24 && wfAcc >= 55) {
      bullishDrivers.push({
        priority: 84,
        text: `AI Kronos dự báo P50 ${expMove >= 0 ? '+' : ''}${expMove.toFixed(2)}% (Kiểm định lùi đúng hướng ${wfAcc}%)`,
      });
    } else if (p3Score <= -24 && wfAcc >= 55) {
      riskFactors.push({
        priority: 84,
        text: `AI Kronos cảnh báo suy yếu ${expMove.toFixed(2)}% trong ${aiPrediction.forecastHorizonBars} nến tới (WF ${wfAcc}%)`,
      });
    } else if (wfAcc < 48) {
      riskFactors.push({
        priority: 62,
        text: `Độ hội tụ kiểm định lùi Kronos hiện đạt ${wfAcc}% — Giảm trọng số dự báo AI tự động`,
      });
    }
  }

  // ==========================================================================
  // PILLAR 4: ASSET-SPECIFIC INSTITUTIONAL MICROSTRUCTURE (Weight 22% Live)
  // ==========================================================================
  let p4Score = 0;
  let p4Weight = isReplayMode ? 0.06 : 0.22;
  let p4Summary = isReplayMode ? 'Chế độ Replay (Tắt dữ liệu hôm nay chống nhìn trước)' : 'Đang đồng bộ vi cấu trúc';

  // Store structural walls / limits for Smart Trade Plan Snapping in Step 7
  let vnCeilingPrice: number | null = null;
  let vnFloorPrice: number | null = null;
  let optionsCallWall: number | null = null;
  let optionsPutWall: number | null = null;
  let optionsMaxPain: number | null = null;
  let cryptoShortLiq25x: number | null = null;
  let cryptoLongLiq25x: number | null = null;
  let analystTargetUsd: number | null = null;

  if (!isReplayMode) {
    if (isVN) {
      const fund = vnInsights?.fundamentals ?? null;
      const foreign = vnInsights?.foreignFlow ?? null;
      const liqPt = vnInsights?.liquidityAndPt ?? null;
      const corpEvents = vnInsights?.corporateEvents ?? [];

      const vnLimits = computeVnPriceLimits({
        symbol: symUpper,
        currentPrice,
        change24hPct: symbolObj.change24h,
        officialRefPrice: fund?.officialRefPrice,
        officialCeilingPrice: fund?.officialCeilingPrice,
        officialFloorPrice: fund?.officialFloorPrice,
      });
      vnCeilingPrice = vnLimits.ceilingPrice;
      vnFloorPrice = vnLimits.floorPrice;

      const orderFlow = computeVnActiveOrderFlow(candles, symbolObj, liqPt);
      if (orderFlow.activeBuyPct >= 58) {
        p4Score += 22;
        bullishDrivers.push({
          priority: 86,
          text: `Dòng tiền khớp lệnh Mua chủ động chiếm ${orderFlow.activeBuyPct.toFixed(0)}% (${orderFlow.regimeLabelVi})`,
        });
      } else if (orderFlow.activeBuyPct <= 42) {
        p4Score -= 22;
        riskFactors.push({
          priority: 86,
          text: `Áp lực Bán chủ động khớp xuống chiếm ${orderFlow.activeSellPct.toFixed(0)}% (${orderFlow.regimeLabelVi})`,
        });
      }

      if (foreign) {
        if (foreign.latestNetBillionVnd >= 15 || foreign.consecutiveNetBuyDays >= 3) {
          p4Score += 26;
          bullishDrivers.push({
            priority: 94,
            text: `Khối ngoại mua ròng +${foreign.latestNetBillionVnd.toFixed(1)} tỷ (${foreign.consecutiveNetBuyDays > 1 ? `${foreign.consecutiveNetBuyDays} phiên liên tiếp, ` : ''}10P: ${foreign.total10dNetBillionVnd >= 0 ? '+' : ''}${foreign.total10dNetBillionVnd.toFixed(0)} tỷ)`,
          });
        } else if (foreign.latestNetBillionVnd <= -20 || foreign.consecutiveNetSellDays >= 3) {
          p4Score -= 24;
          riskFactors.push({
            priority: 90,
            text: `Khối ngoại xả ròng ${foreign.latestNetBillionVnd.toFixed(1)} tỷ (10 phiên: ${foreign.total10dNetBillionVnd.toFixed(0)} tỷ VND)`,
          });
        }
      }

      // Relative Strength vs VNINDEX
      const vnIdxSym = allSymbols.find((s) => s.symbol === 'VNINDEX');
      if (vnIdxSym && symUpper !== 'VNINDEX') {
        const rsVn = symbolObj.change24h - vnIdxSym.change24h;
        if (rsVn >= 1.2) {
          p4Score += 16;
          bullishDrivers.push({
            priority: 79,
            text: `Sức mạnh giá RS vượt trội VNINDEX +${rsVn.toFixed(2)}% trong phiên`,
          });
        } else if (rsVn <= -1.2) {
          p4Score -= 16;
          riskFactors.push({
            priority: 76,
            text: `Cổ phiếu yếu hơn mặt bằng VNINDEX (${rsVn.toFixed(2)}% RS)`,
          });
        }
      }

      // Valuation Sanity (P/E & ROE)
      if (fund?.peRatio && fund.peRatio > 0) {
        if (fund.peRatio <= 14.5 && (fund.roePct ?? 0) >= 15) {
          p4Score += 14;
          bullishDrivers.push({
            priority: 75,
            text: `Định giá cơ bản hấp dẫn: P/E ${fund.peRatio.toFixed(1)}x • ROE ${(fund.roePct ?? 0).toFixed(1)}%`,
          });
        } else if (fund.peRatio >= 35) {
          p4Score -= 8;
        }
      }

      // VN30F1M Basis Analytics
      if (isVnIdxOrDeriv && allSymbols.length > 0) {
        const basis = computeVn30BasisAnalytics(allSymbols, now);
        if (basis) {
          if (basis.basisPoints >= 4) p4Score += 14;
          else if (basis.basisPoints <= -6) {
            p4Score -= 16;
            riskFactors.push({
              priority: 82,
              text: `Phái sinh VN30F1M chiết khấu Basis ${basis.basisPoints.toFixed(1)} điểm (${basis.regimeLabel})`,
            });
          }
        }
      }

      // VN Hard Guardrails: Near Ceiling + T+2.5 Trap, ATC Noise, Imminent Ex-Dividend
      if (
        vnLimits.board !== 'INDEX' &&
        vnLimits.distToCeilingPct !== null &&
        vnLimits.distToCeilingPct <= 1.3
      ) {
        vetoes.push({
          code: 'VN_NEAR_CEILING_T25',
          severity: 'HARD_VETO',
          titleVi: `Sát giá Trần ${vnLimits.board} (+${vnLimits.bandPct}%) & Rủi ro T+2.5`,
          detailVi: `Giá chỉ còn cách Trần ${vnLimits.distToCeilingPct.toFixed(2)}% — Tuyệt đối không mua đuổi giá Tím/Xanh căng vì hàng T+2.5 chiều ngày T+2 mới về tài khoản.`,
        });
        riskFactors.push({
          priority: 97,
          text: `Cách Trần ${vnLimits.board} chỉ ${vnLimits.distToCeilingPct.toFixed(2)}% — Chặn lệnh mua đuổi FOMO do giam vốn T+2.5`,
        });
      }

      const sessionPulse = computeVnIntradaySessionPulse(candles, now);
      if (sessionPulse.phase === 'ATC') {
        vetoes.push({
          code: 'VN_ATC_NOISE',
          severity: 'CAUTION',
          titleVi: 'Đang trong phiên khớp lệnh định kỳ ATC (14:30–14:45)',
          detailVi: 'Sổ lệnh 14:30–14:40 dễ nhiễu bởi lệnh kê/hủy ảo — Chờ sau 14:42 hoặc đặt lệnh LO có giới hạn giá.',
        });
      }

      const imminentEvent = corpEvents.find((ev) => ev.isImminentExDateWarning);
      if (imminentEvent) {
        vetoes.push({
          code: 'VN_EX_DIVIDEND_GAP',
          severity: 'CAUTION',
          titleVi: `Sắp giao dịch không hưởng quyền (${imminentEvent.effectiveDate})`,
          detailVi: imminentEvent.riskHint || `Lưu ý điều chỉnh giá tham chiếu ngày GDKHQ và thuế cổ tức 5%.`,
        });
      }

      p4Summary = foreign
        ? `Ngoại ${foreign.latestNetBillionVnd >= 0 ? '+' : ''}${foreign.latestNetBillionVnd.toFixed(0)} tỷ • Mua chủ động ${orderFlow.activeBuyPct.toFixed(0)}%`
        : `Mua chủ động ${orderFlow.activeBuyPct.toFixed(0)}%${fund?.peRatio ? ` • P/E ${fund.peRatio.toFixed(1)}x` : ''}`;
    } else if (isCrypto) {
      const liq = computeCryptoLiquidationAndCarry(
        symUpper,
        currentPrice,
        candles,
        globalInsights?.perpCarry
      );
      cryptoShortLiq25x = liq.shortLiq25x;
      cryptoLongLiq25x = liq.longLiq25x;

      if (liq.fundingRegime === 'SHORT_SQUEEZE_SETUP') {
        p4Score += 28;
        bullishDrivers.push({
          priority: 91,
          text: `Funding 8h âm (${liq.fundingRate8hPct.toFixed(4)}%) — Phe Short trả phí, dễ kích hoạt Short Squeeze lên ${formatCompactPriceLabel(liq.shortLiq25x, false, false)}`,
        });
      } else if (liq.fundingRegime === 'OVERLEVERAGED_LONGS') {
        p4Score -= 22;
        vetoes.push({
          code: 'CRYPTO_HOT_FUNDING',
          severity: 'CAUTION',
          titleVi: `Funding 8h nóng (+${liq.fundingRate8hPct.toFixed(4)}%)`,
          detailVi: `Đòn bẩy Long đang quá tải (${liq.annualizedFundingPct.toFixed(1)}%/năm) — Không mua Market đuổi, ưu tiên kê Limit đề phòng quét Long 25x (${formatCompactPriceLabel(liq.longLiq25x, false, false)}).`,
        });
        riskFactors.push({
          priority: 91,
          text: `Funding 8h cao +${liq.fundingRate8hPct.toFixed(4)}% — Rủi ro rũ đòn bẩy về cụm Long Liq 25x (${formatCompactPriceLabel(liq.longLiq25x, false, false)})`,
        });
      } else if (liq.fundingRegime === 'CONTANGO_HEALTHY') {
        p4Score += 10;
      }

      const opt = globalInsights?.optionsSummary;
      if (opt && 'isDirectUnderlying' in opt && opt.isDirectUnderlying) {
        optionsCallWall = opt.callWallPrice;
        optionsPutWall = opt.putWallPrice;
        optionsMaxPain = opt.maxPainPrice;

        if (opt.putCallOiRatio !== null && opt.putCallOiRatio <= 0.72) {
          p4Score += 16;
          bullishDrivers.push({
            priority: 82,
            text: `Quyền chọn Deribit nghiêng Tăng (P/C OI ${opt.putCallOiRatio.toFixed(2)} • Call Wall ${formatCompactPriceLabel(opt.callWallPrice || 0, false, false)})`,
          });
        } else if (opt.putCallOiRatio !== null && opt.putCallOiRatio >= 1.2) {
          p4Score -= 16;
          riskFactors.push({
            priority: 82,
            text: `Hợp đồng Put phòng vệ tăng cao trên Deribit (P/C OI ${opt.putCallOiRatio.toFixed(2)})`,
          });
        }
      }

      if (allSymbols.length > 0) {
        const capCycle = computeCryptoCapitalCycle(allSymbols, globalInsights?.cryptoMacro);
        if (capCycle.regime === 'LIQUIDITY_INFLOW_BULL' || capCycle.regime === 'ALTSEASON_EXPANSION') {
          p4Score += 18;
          bullishDrivers.push({
            priority: 80,
            text: `${capCycle.regimeLabelVi}${capCycle.stablecoin7dNetMintBillionUsd ? ` (Mint 7d: +$${capCycle.stablecoin7dNetMintBillionUsd.toFixed(2)}B)` : ''}`,
          });
        } else if (capCycle.regime === 'RISK_OFF_DRAIN') {
          p4Score -= 20;
          riskFactors.push({ priority: 84, text: capCycle.summaryVi });
        }
      }

      p4Summary = `Funding ${liq.fundingRate8hPct >= 0 ? '+' : ''}${liq.fundingRate8hPct.toFixed(4)}%${optionsMaxPain ? ` • MaxPain $${optionsMaxPain.toLocaleString('en-US')}` : ''}`;
    } else if (isUsGlobal) {
      const uq = globalInsights?.usQuote ?? null;
      const opt = globalInsights?.optionsSummary ?? null;
      if (opt) {
        optionsCallWall = opt.callWallPrice;
        optionsPutWall = opt.putWallPrice;
        optionsMaxPain = opt.maxPainPrice;
      }
      analystTargetUsd = uq?.analystTargetPrice ?? null;

      const usPulse = computeUsExtendedHoursPulse(
        symUpper,
        currentPrice,
        uq,
        opt?.impliedMovePct ?? null,
        (atr * 1.6 / currentPrice) * 100,
        now
      );

      // Extended-hours Pre-Market / After-Hours institutional gap
      if (usPulse.extendedGapPct !== null && Math.abs(usPulse.extendedGapPct) >= 0.6) {
        if (usPulse.extendedGapPct > 0) {
          p4Score += clamp(Math.round(usPulse.extendedGapPct * 8), 8, 26);
          bullishDrivers.push({
            priority: 88,
            text: `Dòng tiền phiên phụ Mỹ kéo tăng +${usPulse.extendedGapPct.toFixed(2)}% (${formatCompactPriceLabel(usPulse.extendedPrice || currentPrice, false, false)})`,
          });
        } else {
          p4Score += clamp(Math.round(usPulse.extendedGapPct * 8), -28, -8);
          riskFactors.push({
            priority: 88,
            text: `Áp lực bán phiên phụ Mỹ ${usPulse.extendedGapPct.toFixed(2)}% (${formatCompactPriceLabel(usPulse.extendedPrice || currentPrice, false, false)})`,
          });
        }
      }

      // CBOE Options Gamma Regime
      if (opt) {
        if (opt.gammaRegime === 'POSITIVE_GAMMA_PIN') {
          p4Score += 14;
          bullishDrivers.push({
            priority: 83,
            text: `CBOE Gamma Dương đỡ biên độ (Put Wall $${opt.putWallPrice} • Call Wall $${opt.callWallPrice})`,
          });
        } else if (opt.gammaRegime === 'NEGATIVE_GAMMA_ACCELERATION') {
          p4Score -= 16;
          riskFactors.push({
            priority: 85,
            text: `CBOE Gamma Âm — Biến động dễ trượt mạnh nếu thủng Put Wall $${opt.putWallPrice}`,
          });
        }
      }

      // Relative Strength vs SPY
      const spySym = allSymbols.find((s) => s.symbol === 'SPY');
      if (spySym && symUpper !== 'SPY') {
        const rsSpy = symbolObj.change24h - spySym.change24h;
        if (rsSpy >= 0.8) {
          p4Score += 14;
          bullishDrivers.push({
            priority: 77,
            text: `Cổ phiếu mạnh hơn chuẩn S&P 500 (RS vs SPY +${rsSpy.toFixed(2)}%)`,
          });
        } else if (rsSpy <= -0.8) {
          p4Score -= 14;
          riskFactors.push({
            priority: 75,
            text: `Hiệu suất kém hơn S&P 500 (RS vs SPY ${rsSpy.toFixed(2)}%)`,
          });
        }
      }

      // Street Analyst Target Upside
      if (analystTargetUsd && analystTargetUsd > 0 && currentPrice > 0) {
        const targetUpsidePct = ((analystTargetUsd - currentPrice) / currentPrice) * 100;
        if (targetUpsidePct >= 15) {
          p4Score += 12;
          bullishDrivers.push({
            priority: 73,
            text: `Dư địa tới giá mục tiêu Phố Wall ($${analystTargetUsd.toFixed(0)}) còn +${targetUpsidePct.toFixed(1)}%`,
          });
        } else if (targetUpsidePct <= -8) {
          p4Score -= 10;
        }
      }

      // HARD VETO: Imminent US Earnings Gap Trap (<= 2 days) or Caution (3-5 days)
      if (usPulse.isImminentEarningsTrap && usPulse.daysToEarnings !== null) {
        const isHard = usPulse.daysToEarnings <= 2;
        vetoes.push({
          code: 'US_IMMINENT_EARNINGS',
          severity: isHard ? 'HARD_VETO' : 'CAUTION',
          titleVi: `Bẫy Gap BCTC Mỹ (${usPulse.daysToEarnings === 0 ? 'HÔM NAY' : `còn ${usPulse.daysToEarnings} ngày`})`,
          detailVi:
            usPulse.earningsWarningVi ||
            `Sắp công bố BCTC (${usPulse.earningsDateIso}) — Rủi ro nhảy Gap hai chiều vượt qua Stop-Loss.`,
        });
        riskFactors.push({
          priority: 99,
          text: `Sắp công bố BCTC (${usPulse.earningsDateIso}${opt?.impliedMovePct ? ` • Implied Move ±${opt.impliedMovePct.toFixed(1)}%` : ''}) — Cẩn trọng nhảy Gap qua đêm`,
        });
      }

      p4Summary = opt?.callWallPrice
        ? `CBOE Wall $${opt.putWallPrice}–$${opt.callWallPrice}${usPulse.extendedGapPct ? ` • Ext ${usPulse.extendedGapPct >= 0 ? '+' : ''}${usPulse.extendedGapPct}%` : ''}`
        : uq?.forwardPe
        ? `Fwd P/E ${uq.forwardPe.toFixed(1)}x${analystTargetUsd ? ` • Target $${analystTargetUsd.toFixed(0)}` : ''}`
        : `SEC T+1 • Phiên ${usPulse.activeSession}`;
    } else {
      // Macro / Forex / Gold / Oil
      p4Score = clamp(Math.round(symbolObj.change24h * 12), -45, 45);
      p4Summary = `Biến động 24h: ${symbolObj.change24h >= 0 ? '+' : ''}${symbolObj.change24h.toFixed(2)}%`;
    }
  }

  p4Score = clamp(Math.round(p4Score), -100, 100);

  // ==========================================================================
  // PILLAR 5: CROSS-MARKET MACRO & FEAR-GREED SENTIMENT (Weight 16%)
  // ==========================================================================
  const macroImpact = isReplayMode ? null : evaluateSymbolMacroImpact(symbolObj, macroSnapshot);
  let p5Score = 0;
  let p5Summary = isReplayMode ? 'Tạm ẩn vĩ mô hiện tại khi Replay' : 'Vĩ mô trung tính';

  if (macroImpact) {
    p5Score += clamp(macroImpact.scoreAdjustment * 4, -75, 75);
    const topMacroBullet = macroImpact.bullets[0] || macroImpact.headline;
    if (macroImpact.bias === 'TAILWIND') {
      bullishDrivers.push({ priority: 82, text: `Trợ lực vĩ mô: ${topMacroBullet}` });
      p5Summary = 'Trợ lực vĩ mô thuận lợi';
    } else if (macroImpact.bias === 'SEVERE_HEADWIND') {
      vetoes.push({
        code: 'SEVERE_MACRO_HEADWIND',
        severity: 'CAUTION',
        titleVi: 'Áp lực ngược gió Vĩ mô mạnh',
        detailVi: topMacroBullet,
      });
      riskFactors.push({ priority: 93, text: `Ngược gió vĩ mô: ${topMacroBullet}` });
      p5Summary = 'Ngược gió vĩ mô mạnh';
    } else if (macroImpact.bias === 'HEADWIND') {
      riskFactors.push({ priority: 78, text: `Áp lực vĩ mô: ${topMacroBullet}` });
      p5Summary = 'Cản trở vĩ mô nhẹ';
    }
  }

  if (!isReplayMode && marketSentiment) {
    const fng = marketSentiment.fearAndGreedIndex;
    if (fng <= 22 && p1Score >= -15) {
      p5Score += 15;
      bullishDrivers.push({
        priority: 70,
        text: `Tâm lý Sợ hãi tột độ (${fng}/100) tại vùng nền — Cơ hội tích lũy ngược đám đông`,
      });
    } else if (fng >= 82 && lastRsi >= 68) {
      p5Score -= 15;
      riskFactors.push({
        priority: 72,
        text: `Tâm lý Tham lam cực độ (${fng}/100) — Cẩn trọng nhịp chốt lời bất ngờ`,
      });
    }
    if (!macroImpact) {
      p5Summary = `Tâm lý F&G: ${fng}/100`;
    } else {
      p5Summary = `${p5Summary} • F&G ${fng}`;
    }
  }

  p5Score = clamp(Math.round(p5Score), -100, 100);

  // ==========================================================================
  // PILLAR 6: RISK GUARDRAILS & VOLATILITY EXECUTION SANITY
  // ==========================================================================
  const hardVetoCount = vetoes.filter((v) => v.severity === 'HARD_VETO').length;
  const cautionCount = vetoes.filter((v) => v.severity === 'CAUTION').length;
  const atrPct = currentPrice > 0 ? (atr / currentPrice) * 100 : 2.0;

  let p6Score = 30 - hardVetoCount * 55 - cautionCount * 22;
  if (atrPct > 5.5) p6Score -= 18;
  p6Score = clamp(Math.round(p6Score), -100, 100);

  const p6Summary =
    hardVetoCount > 0
      ? `Kích hoạt ${hardVetoCount} chốt chặn rủi ro cứng`
      : cautionCount > 0
      ? `${cautionCount} lưu ý kiểm soát vị thế • ATR ${atrPct.toFixed(1)}%`
      : `An toàn thực thi • Biến động ATR ${atrPct.toFixed(1)}%`;

  // ==========================================================================
  // COMPOSITE WEIGHTED DIRECTIONAL BIAS & CONVICTION SCORE
  // ==========================================================================
  const pillars: RecommendationPillarScore[] = [
    {
      id: 'mtf_trend',
      nameVi: 'Đa Khung & Xu Hướng',
      shortNameVi: 'Đa Khung MTF',
      score: p1Score,
      weight: isReplayMode ? 0.34 : 0.24,
      status: p1Score >= 18 ? 'BULLISH' : p1Score <= -18 ? 'BEARISH' : 'NEUTRAL',
      summaryVi: p1Summary,
    },
    {
      id: 'smc_vpvr',
      nameVi: 'Dòng Tiền SMC & VPVR',
      shortNameVi: 'VPVR & SMC',
      score: p2Score,
      weight: isReplayMode ? 0.28 : 0.20,
      status: p2Score >= 18 ? 'BULLISH' : p2Score <= -18 ? 'BEARISH' : 'NEUTRAL',
      summaryVi: p2Summary,
    },
    {
      id: 'kronos_ai',
      nameVi: 'Dự Báo AI Kronos',
      shortNameVi: 'Kronos AI',
      score: p3Score,
      weight: isReplayMode ? 0.24 : 0.18,
      status: p3Score >= 18 ? 'BULLISH' : p3Score <= -18 ? 'BEARISH' : 'NEUTRAL',
      summaryVi: p3Summary,
    },
    {
      id: 'microstructure',
      nameVi: 'Vi Cấu Trúc Định Chế',
      shortNameVi: isVN ? 'Ngoại & Khớp Lệnh' : isCrypto ? 'Funding & Options' : 'Options & Phiên Phụ',
      score: p4Score,
      weight: p4Weight,
      status: p4Score >= 18 ? 'BULLISH' : p4Score <= -18 ? 'BEARISH' : 'NEUTRAL',
      summaryVi: p4Summary,
    },
    {
      id: 'macro_sentiment',
      nameVi: 'Vĩ Mô & Tâm Lý',
      shortNameVi: 'Vĩ Mô & F&G',
      score: p5Score,
      weight: isReplayMode ? 0.04 : 0.16,
      status: p5Score >= 15 ? 'BULLISH' : p5Score <= -15 ? 'BEARISH' : 'NEUTRAL',
      summaryVi: p5Summary,
    },
    {
      id: 'risk_guard',
      nameVi: 'Bộ Lọc Quản Trị Rủi Ro',
      shortNameVi: 'Khiên Rủi Ro',
      score: p6Score,
      weight: 0.0, // Acts as explicit Veto / Conviction Multiplier rather than directional push
      status: hardVetoCount > 0 || cautionCount >= 2 ? 'WARNING' : p6Score >= 15 ? 'BULLISH' : 'NEUTRAL',
      summaryVi: p6Summary,
    },
  ];

  const totalDirWeight = pillars.reduce((acc, p) => acc + p.weight, 0) || 1;
  const directionalBiasScore = clamp(
    Math.round(pillars.reduce((acc, p) => acc + p.score * p.weight, 0) / totalDirWeight),
    -100,
    100
  );

  // Agreement bonus when major pillars point in the same direction
  const activeDirPillars = pillars.filter((p) => p.weight > 0);
  const bullPillars = activeDirPillars.filter((p) => p.score >= 15).length;
  const bearPillars = activeDirPillars.filter((p) => p.score <= -15).length;
  const agreementRatio =
    Math.max(bullPillars, bearPillars) / Math.max(1, activeDirPillars.length);

  let convictionScore = Math.round(
    46 + Math.abs(directionalBiasScore) * 0.44 + agreementRatio * 14 - hardVetoCount * 14 - cautionCount * 4
  );
  convictionScore = clamp(convictionScore, 38, 96);

  // ==========================================================================
  // DETERMINE ACTIONABLE VERDICT WITH HARD VETO GUARDRAILS
  // ==========================================================================
  const hasImminentUsEarningsHard = vetoes.some(
    (v) => v.code === 'US_IMMINENT_EARNINGS' && v.severity === 'HARD_VETO'
  );
  const hasVnCeilingVeto = vetoes.some((v) => v.code === 'VN_NEAR_CEILING_T25');
  const hasHotFundingOrOverbought = vetoes.some(
    (v) =>
      v.code === 'CRYPTO_HOT_FUNDING' ||
      v.code === 'OVERBOUGHT_CHASE' ||
      v.code === 'HTF_COUNTER_TREND'
  );

  let verdictCode: VerdictCode = 'HOLD_OBSERVE';
  let signalAction: SignalAction = 'WAIT';
  let verdictLabelVi = 'QUAN SÁT / CHỜ XÁC NHẬN';
  let verdictTaglineVi = 'Tín hiệu giữa các tầng đang phân hóa — Kiên nhẫn chờ giá về vùng biên thanh khoản.';
  let isShortPlan = false;

  if (hasImminentUsEarningsHard) {
    verdictCode = 'STAND_ASIDE_VETO';
    signalAction = 'WAIT';
    verdictLabelVi = 'ĐỨNG NGOÀI — NÉ BẪY GAP BCTC';
    verdictTaglineVi =
      'Sắp công bố BCTC Mỹ (≤ 2 ngày) với biên nhảy Gap lớn — Ưu tiên bảo toàn vốn hoặc giảm 50% vị thế trước giờ ra tin.';
  } else if (directionalBiasScore >= 42 && !hasVnCeilingVeto && !hasHotFundingOrOverbought) {
    verdictCode = 'STRONG_BUY';
    signalAction = 'STRONG_BUY';
    verdictLabelVi = 'MUA THUẬN XU HƯỚNG';
    verdictTaglineVi =
      'Đa khung thời gian, dòng tiền VPVR/SMC và vi cấu trúc định chế đồng thuận ủng hộ chiều Tăng.';
  } else if (directionalBiasScore >= 16) {
    verdictCode = 'ACCUMULATE_LIMIT';
    signalAction = 'BUY';
    verdictLabelVi = hasVnCeilingVeto
      ? 'KHÔNG ĐUỔI TRẦN — CHỜ GOM KÊ LIMIT'
      : 'GOM KÊ LIMIT (CHỜ PULLBACK)';
    verdictTaglineVi = hasVnCeilingVeto
      ? 'Xu hướng tốt nhưng giá sát Trần HOSE/HNX — Chỉ đặt lệnh Limit chờ nhịp trùng xuống hỗ trợ để tránh kẹp T+2.5.'
      : 'Ưu thế nghiêng Tăng — Tối ưu giá vốn bằng lệnh Limit quanh vùng hỗ trợ POC / EMA20 thay vì mua đuổi.';
  } else if (directionalBiasScore <= -20) {
    if (canShortAsset) {
      verdictCode = 'SELL_SHORT';
      signalAction = directionalBiasScore <= -44 ? 'STRONG_SELL' : 'SELL';
      verdictLabelVi = directionalBiasScore <= -44 ? 'BÁN / ƯU TIÊN SHORT' : 'CANH HỒI SHORT / HẠ TỶ TRỌNG';
      verdictTaglineVi =
        'Áp lực cung chiếm ưu thế trên đa tầng dữ liệu — Canh nhịp hồi về kháng cự POC/EMA20 để mở Short hoặc giảm vị thế.';
      isShortPlan = true;
    } else {
      verdictCode = 'REDUCE_TAKE_PROFIT';
      signalAction = directionalBiasScore <= -44 ? 'STRONG_SELL' : 'SELL';
      verdictLabelVi = 'CHỐT LỜI / HẠ TỶ TRỌNG — ĐỨNG NGOÀI';
      verdictTaglineVi =
        'Cổ phiếu cơ sở VN không bán khống — Ưu tiên hạ tỷ trọng khi hồi lên kháng cự và giữ sức mua chờ nền chiết khấu sâu.';
      isShortPlan = false;
    }
  }

  // ==========================================================================
  // STRUCTURE-SNAPPED ENTRY, STOP LOSS & TAKE PROFIT LEVELS
  // ==========================================================================
  // Gather real structural supports below currentPrice & resistances above currentPrice
  const supportCandidates: Array<{ price: number; label: string }> = [];
  const resistanceCandidates: Array<{ price: number; label: string }> = [];

  if (vpvr) {
    if (vpvr.pocPrice < currentPrice * 1.002) {
      supportCandidates.push({ price: vpvr.pocPrice, label: 'VPVR POC' });
    } else {
      resistanceCandidates.push({ price: vpvr.pocPrice, label: 'VPVR POC' });
    }
    if (vpvr.valPrice < currentPrice) {
      supportCandidates.push({ price: vpvr.valPrice, label: 'VPVR VAL 70%' });
    }
    if (vpvr.vahPrice > currentPrice) {
      resistanceCandidates.push({ price: vpvr.vahPrice, label: 'VPVR VAH 70%' });
    }
  }

  if (activeBullOb) {
    supportCandidates.push({ price: activeBullOb.top, label: 'Đỉnh Bullish OB' });
    supportCandidates.push({ price: activeBullOb.bottom, label: 'Đáy Bullish OB' });
  }
  if (activeBearOb) {
    resistanceCandidates.push({ price: activeBearOb.bottom, label: 'Đáy Bearish OB' });
    resistanceCandidates.push({ price: activeBearOb.top, label: 'Đỉnh Bearish OB' });
  }

  if (lastEma20 < currentPrice) supportCandidates.push({ price: lastEma20, label: 'EMA 20' });
  else resistanceCandidates.push({ price: lastEma20, label: 'EMA 20' });

  for (const s of srLevels) {
    if (s.type === 'support' && s.price < currentPrice * 0.998) {
      supportCandidates.push({ price: s.price, label: 'Hỗ trợ S/R' });
    } else if (s.type === 'resistance' && s.price > currentPrice * 1.002) {
      resistanceCandidates.push({ price: s.price, label: 'Kháng cự S/R' });
    }
  }

  if (fib618) {
    if (fib618.price < currentPrice) supportCandidates.push({ price: fib618.price, label: 'Fib 0.618' });
    else resistanceCandidates.push({ price: fib618.price, label: 'Fib 0.618' });
  }

  if (optionsPutWall && optionsPutWall < currentPrice && optionsPutWall > currentPrice * 0.84) {
    supportCandidates.push({
      price: optionsPutWall,
      label: isCrypto ? 'Deribit Put Wall' : 'CBOE Put Wall',
    });
  }
  if (optionsCallWall && optionsCallWall > currentPrice && optionsCallWall < currentPrice * 1.25) {
    resistanceCandidates.push({
      price: optionsCallWall * 0.996, // Front-run massive Call Wall by 0.4% for higher fill probability
      label: isCrypto ? 'Trước Deribit Call Wall' : 'Trước CBOE Call Wall',
    });
  }
  if (cryptoShortLiq25x && cryptoShortLiq25x > currentPrice) {
    resistanceCandidates.push({ price: cryptoShortLiq25x, label: 'Nam châm Short Liq 25x' });
  }
  if (
    vnCeilingPrice &&
    vnCeilingPrice > currentPrice &&
    (timeframe === '15m' || timeframe === '1h' || timeframe === '5m')
  ) {
    resistanceCandidates.push({ price: vnCeilingPrice, label: `Giá Trần ${vnBoard}` });
  }

  // Sort nearest first
  const nearSupports = supportCandidates
    .filter((c) => c.price > 0 && c.price <= currentPrice && currentPrice - c.price <= atr * 3.5)
    .sort((a, b) => b.price - a.price);

  const nearResistances = resistanceCandidates
    .filter((c) => c.price >= currentPrice && c.price - currentPrice <= atr * 5.0)
    .sort((a, b) => a.price - b.price);

  let rawEntryLow: number;
  let rawEntryHigh: number;
  let rawSl: number;
  let rawTp1: number;
  let rawTp2: number;
  let rawTp3: number;
  let entryAnchorVi = 'Quanh vùng giá khớp hiện tại';
  let slAnchorVi = 'Đệm biến động 1.6x ATR';
  let tpAnchorVi = 'Mục tiêu mở rộng theo R:R';

  if (!isShortPlan && verdictCode !== 'REDUCE_TAKE_PROFIT') {
    // LONG / PULLBACK ACCUMULATION PLAN
    const primaryPullbackSup = nearSupports[0];
    if (verdictCode === 'ACCUMULATE_LIMIT' && primaryPullbackSup) {
      rawEntryHigh = Math.min(currentPrice * 0.996, primaryPullbackSup.price * 1.003);
      rawEntryLow = Math.max(primaryPullbackSup.price * 0.992, currentPrice - atr * 1.35);
      entryAnchorVi = `Kê Limit đón tại ${primaryPullbackSup.label}`;
    } else if (primaryPullbackSup && currentPrice - primaryPullbackSup.price <= atr * 0.9) {
      rawEntryLow = primaryPullbackSup.price;
      rawEntryHigh = currentPrice * 1.003;
      entryAnchorVi = `Tựa sát ${primaryPullbackSup.label}`;
    } else {
      rawEntryLow = currentPrice - atr * 0.45;
      rawEntryHigh = currentPrice + atr * 0.15;
    }

    if (rawEntryLow > rawEntryHigh) {
      const mid = (rawEntryLow + rawEntryHigh) / 2;
      rawEntryLow = mid * 0.997;
      rawEntryHigh = mid * 1.003;
    }

    const refEntry = (rawEntryLow + rawEntryHigh) / 2;
    const deeperStructSup = nearSupports.find(
      (s) => refEntry - s.price >= atr * 0.7 && refEntry - s.price <= atr * 2.8
    );

    if (deeperStructSup) {
      rawSl = deeperStructSup.price - atr * 0.3;
      slAnchorVi = `Dưới ${deeperStructSup.label}`;
    } else {
      rawSl = refEntry - Math.max(atr * 1.55, refEntry * 0.018);
      slAnchorVi = 'Dưới nền biến động 1.55x ATR';
    }

    const risk = Math.max(refEntry * 0.008, refEntry - rawSl);

    const viableTp1Res = nearResistances.find(
      (r) => r.price - refEntry >= risk * 1.15 && r.price - refEntry <= risk * 2.6
    );
    if (viableTp1Res) {
      rawTp1 = viableTp1Res.price;
      tpAnchorVi = viableTp1Res.label;
    } else {
      rawTp1 = refEntry + risk * 1.55;
      tpAnchorVi = 'Mục tiêu 1.55R';
    }

    const viableTp2Res = nearResistances.find((r) => r.price > rawTp1 + risk * 0.55);
    rawTp2 = viableTp2Res ? viableTp2Res.price : Math.max(rawTp1 + risk * 0.95, refEntry + risk * 2.5);
    rawTp3 = Math.max(rawTp2 + risk * 1.1, refEntry + risk * 3.8);
  } else {
    // SHORT PLAN (Crypto / VN30F1M / US) OR SPOT REDUCE PLAN (VN Equities)
    const primaryRes = nearResistances[0];
    if (primaryRes && primaryRes.price - currentPrice <= atr * 1.1) {
      rawEntryLow = currentPrice * 0.997;
      rawEntryHigh = primaryRes.price;
      entryAnchorVi = isShortPlan
        ? `Canh Short tại cản ${primaryRes.label}`
        : `Vùng hạ tỷ trọng sát ${primaryRes.label}`;
    } else {
      rawEntryLow = currentPrice - atr * 0.15;
      rawEntryHigh = currentPrice + atr * 0.45;
      entryAnchorVi = isShortPlan ? 'Quanh vùng kháng cự ngắn hạn' : 'Vùng canh chốt / hạ tỷ trọng';
    }

    const refEntry = (rawEntryLow + rawEntryHigh) / 2;
    const upperInvalidationRes = nearResistances.find(
      (r) => r.price - refEntry >= atr * 0.7 && r.price - refEntry <= atr * 2.8
    );

    if (upperInvalidationRes) {
      rawSl = upperInvalidationRes.price + atr * 0.3;
      slAnchorVi = `Vượt trên ${upperInvalidationRes.label}`;
    } else {
      rawSl = refEntry + Math.max(atr * 1.55, refEntry * 0.018);
      slAnchorVi = 'Vượt biên 1.55x ATR';
    }

    const risk = Math.max(refEntry * 0.008, rawSl - refEntry);
    const viableSup1 = nearSupports.find(
      (s) => refEntry - s.price >= risk * 1.15 && refEntry - s.price <= risk * 2.6
    );
    if (viableSup1) {
      rawTp1 = viableSup1.price;
      tpAnchorVi = isShortPlan ? viableSup1.label : `Chờ gom lại tại ${viableSup1.label}`;
    } else {
      rawTp1 = Math.max(refEntry * 0.5, refEntry - risk * 1.55);
      tpAnchorVi = isShortPlan ? 'Mục tiêu chốt Short 1.55R' : 'Nền chiết khấu chờ gom lại';
    }

    const viableSup2 = nearSupports.find((s) => s.price < rawTp1 - risk * 0.55);
    rawTp2 = viableSup2 ? viableSup2.price : Math.max(refEntry * 0.4, Math.min(rawTp1 - risk * 0.9, refEntry - risk * 2.45));
    rawTp3 = Math.max(refEntry * 0.3, Math.min(rawTp2 - risk * 1.0, refEntry - risk * 3.6));
  }

  const entryLow = normalizeSmartPlanPrice(Math.min(rawEntryLow, rawEntryHigh), symbolObj, vnBoard);
  const entryHigh = normalizeSmartPlanPrice(Math.max(rawEntryLow, rawEntryHigh), symbolObj, vnBoard);
  const entryMidPrice = normalizeSmartPlanPrice((entryLow + entryHigh) / 2, symbolObj, vnBoard);
  const stopLoss = normalizeSmartPlanPrice(rawSl, symbolObj, vnBoard);
  const takeProfit1 = normalizeSmartPlanPrice(rawTp1, symbolObj, vnBoard);
  const takeProfit2 = normalizeSmartPlanPrice(rawTp2, symbolObj, vnBoard);
  const takeProfit3 = normalizeSmartPlanPrice(rawTp3, symbolObj, vnBoard);

  const planRisk = Math.max(1e-8, Math.abs(entryMidPrice - stopLoss));
  const planReward = Math.abs(takeProfit2 - entryMidPrice);
  const riskRewardRatio = Number(clamp(planReward / planRisk, 1.1, 6.5).toFixed(2));
  const winProbability = clamp(Math.round(48 + (convictionScore - 50) * 0.62), 45, 84);

  // ==========================================================================
  // CAPITAL ALLOCATION & EXECUTION SIZING GUIDANCE
  // ==========================================================================
  const riskLevel: ChartRecommendationVerdict['riskLevel'] =
    hardVetoCount > 0 || cautionCount >= 2 || atrPct >= 5.2
      ? 'HIGH'
      : cautionCount === 1 || atrPct >= 3.2
      ? 'MEDIUM'
      : 'LOW';

  let suggestedAllocationPct = 0;
  let executionStyleVi = 'Giữ tiền mặt quan sát, chưa giải ngân vị thế mới';
  let leverageGuidanceVi = '1x Cơ sở (Không dùng Margin/Đòn bẩy)';

  if (verdictCode === 'STRONG_BUY') {
    suggestedAllocationPct = riskLevel === 'LOW' ? 50 : 35;
    executionStyleVi = `Giải ngân 2 phần: 50% quanh giá hiện tại + 50% kê Limit tại ${formatCompactPriceLabel(entryLow, isVND, isVnIdxOrDeriv)}`;
    leverageGuidanceVi = isCrypto
      ? 'Spot hoặc Perp Isolated tối đa 2x–3x'
      : isVN
      ? 'Tiền thịt 1x (Hạn chế Margin khi chưa có đệm lãi T+2.5)'
      : 'Tài khoản Cash / Margin tối đa 1.2x (SEC T+1)';
  } else if (verdictCode === 'ACCUMULATE_LIMIT') {
    suggestedAllocationPct = riskLevel === 'HIGH' ? 20 : 30;
    executionStyleVi = `Không mua đuổi giá Xanh — Chỉ kê Limit đón quanh ${formatCompactPriceLabel(entryLow, isVND, isVnIdxOrDeriv)}–${formatCompactPriceLabel(entryHigh, isVND, isVnIdxOrDeriv)}`;
    leverageGuidanceVi = '1x Spot / Cơ sở (Không dùng đòn bẩy khi bắt nhịp chỉnh)';
  } else if (verdictCode === 'SELL_SHORT') {
    suggestedAllocationPct = convictionScore >= 75 && riskLevel !== 'HIGH' ? 30 : 20;
    executionStyleVi = `Canh nhịp hồi kỹ thuật lên vùng ${formatCompactPriceLabel(entryLow, isVND, isVnIdxOrDeriv)}–${formatCompactPriceLabel(entryHigh, isVND, isVnIdxOrDeriv)} để vào Short, đặt SL chặt tại ${formatCompactPriceLabel(stopLoss, isVND, isVnIdxOrDeriv)}`;
    leverageGuidanceVi = isVnDeriv
      ? 'Tối đa 20–30% sức mua Ký quỹ Phái sinh VSD'
      : isCrypto
      ? 'Perp Isolated tối đa 2x–3x (Đặt Hard Stop-Loss)'
      : 'Quyền chọn Put hoặc vị thế phòng vệ tỷ trọng nhỏ';
  } else if (verdictCode === 'REDUCE_TAKE_PROFIT') {
    suggestedAllocationPct = 0;
    executionStyleVi = `Chốt lời / hạ 50%–70% cổ phiếu đang nắm giữ quanh ${formatCompactPriceLabel(entryLow, isVND, isVnIdxOrDeriv)}–${formatCompactPriceLabel(entryHigh, isVND, isVnIdxOrDeriv)}; chờ nền ${formatCompactPriceLabel(takeProfit1, isVND, isVnIdxOrDeriv)} mới xét gom lại`;
    leverageGuidanceVi = 'Đưa tỷ lệ vay Margin về 0% (Bảo toàn sức mua)';
  } else if (verdictCode === 'STAND_ASIDE_VETO') {
    suggestedAllocationPct = 0;
    executionStyleVi = 'Tạm ngưng mở lệnh mới trước sự kiện rủi ro hai chiều; nếu đang có lãi nên chốt bảo vệ 50%';
    leverageGuidanceVi = 'Tuyệt đối không dùng đòn bẩy qua đêm';
  }

  // Deduplicate & pick top 3 highest-priority concrete pros and risks
  const topBullish = bullishDrivers
    .sort((a, b) => b.priority - a.priority)
    .map((d) => d.text)
    .slice(0, 3);

  const topRisks = riskFactors
    .sort((a, b) => b.priority - a.priority)
    .map((r) => r.text)
    .slice(0, 3);

  if (topBullish.length === 0) {
    topBullish.push(
      `Biên hỗ trợ kỹ thuật gần nhất đặt quanh ${formatCompactPriceLabel(entryLow, isVND, isVnIdxOrDeriv)}`
    );
  }
  if (topRisks.length === 0) {
    topRisks.push(
      `Kỷ luật cắt lỗ bắt buộc nếu thủng mốc ${formatCompactPriceLabel(stopLoss, isVND, isVnIdxOrDeriv)} (${slAnchorVi})`
    );
  }

  const hasActionablePlan =
    verdictCode === 'STRONG_BUY' ||
    verdictCode === 'ACCUMULATE_LIMIT' ||
    verdictCode === 'SELL_SHORT' ||
    verdictCode === 'REDUCE_TAKE_PROFIT';

  return {
    symbol: symUpper,
    timeframe,
    currentPrice,
    isReplayMode,
    marketClass,
    canShortAsset,
    verdictCode,
    signalAction,
    verdictLabelVi,
    verdictTaglineVi,
    convictionScore,
    directionalBiasScore,
    riskLevel,
    suggestedAllocationPct,
    executionStyleVi,
    leverageGuidanceVi,
    isShortPlan,
    hasActionablePlan,
    entryZone: [entryLow, entryHigh],
    entryMidPrice,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskRewardRatio,
    winProbability,
    entryAnchorVi,
    slAnchorVi,
    tpAnchorVi,
    pillars,
    bullishDriversVi: topBullish,
    riskFactorsVi: topRisks,
    vetoes,
  };
}
