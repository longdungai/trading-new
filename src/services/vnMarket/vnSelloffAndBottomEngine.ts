import { Candle, MarketSymbol, Timeframe } from '../../types';
import { calculateEMA, calculateRSI } from '../indicators';
import { calculateSupportResistance } from '../analysis/supportResistance';
import { detectOrderBlocks } from '../analysis/smartMoney';
import { calculateVisibleVolumeProfile } from '../analysis/volumeProfileMtf';
import {
  computeVn30BasisAnalytics,
  computeVnPriceLimits,
  getVnExchangeBoard,
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
  roundToVnTickSize,
  VnExchangeBoard,
  VnPriceLimits,
} from './vnStockMicrostructure';
import { VnActiveOrderFlowSummary, computeVnActiveOrderFlow } from './vnExecutionEngines';
import { VnStockInsightsPayload } from './vnStockInsightsClient';
import { UserHoldingItem } from '../portfolio/holdingsRecoveryEngine';
import {
  evaluateVnDailySpotTradingReport,
  VnDailySpotTradingReport,
} from './vnSpotDailyCashEngine';

// ============================================================================
// 1. PANIC SELLOFF, O'NEIL DISTRIBUTION DAYS & 13:45-14:15 FORCE-SELL RADAR
// ============================================================================

export type VnSelloffRiskLevel =
  | 'LOW_SAFE'
  | 'DISTRIBUTION_WATCH'
  | 'HIGH_SELLOFF_RISK'
  | 'ACTIVE_FORCE_SELL_WAVE'
  | 'FORCE_SELL_EXHAUSTING';

export interface VnPanicAndForceSellRadar {
  symbol: string;
  distributionDays25d: number; // O'Neil distribution days in last 25 daily bars
  stallingDays25d: number; // High-volume stalling/churning days without price progress
  totalDistributionCluster: number;
  recentDistributionDates: string[];
  forceSellProbabilityPct: number; // 0..100% probability of CTCK margin call / force-sell pressure
  isInAfternoonForceSellWindow: boolean; // 13:30 - 14:25 GMT+7
  crossLiquidationWarning: boolean; // True when liquid VN30/leader stocks face cross-margin liquidation
  marketFloorOrNearFloorCount: number;
  marketDeclinerRatioPct: number;
  vn30BasisPoints: number | null;
  selloffRiskLevel: VnSelloffRiskLevel;
  riskBadgeVi: string;
  headlineVi: string;
  bulletsVi: string[];
  actionGuidanceVi: string;
}

// ============================================================================
// 2. SMART 3-RUNG BOTTOM-FISHING LIMIT LADDER ("RẢI ĐINH BẮT ĐÁY") & FLOOR RESCUE
// ============================================================================

export type VnFloorAbsorptionState =
  | 'FLOOR_LOCKED_NO_RESCUE'
  | 'FLOOR_RESCUE_ABSORPTION'
  | 'SHARP_FLUSH_SUPPORT'
  | 'NORMAL_TRADING';

export interface VnBottomFishingRung {
  rungIndex: 1 | 2 | 3;
  weightPct: number; // 20%, 30%, 50%
  labelVi: string;
  anchorVi: string;
  limitPrice: number;
  discountFromRefPct: number;
  discountFromCurrentPct: number;
  recommendedShares: number; // Rounded to 100-share HOSE/HNX lot (or 1 contract for VN30F1M)
  capitalMillionVnd: number;
  status: 'READY_LIMIT_ORDER' | 'UNLOCKED_RESCUE_CONFIRMED' | 'LOCKED_WAIT_ABSORPTION';
  statusBadgeVi: string;
  executionConditionVi: string;
}

export interface VnT2BottomStressTest {
  weightedAvgBuyPrice: number;
  totalShares: number;
  totalDeployedMillionVnd: number;
  ifOneMoreFloorPrice: number; // Floor price of T+1 if another -7%/-10% hit occurs
  lossIfOneMoreFloorPct: number;
  lossIfOneMoreFloorMillionVnd: number;
  reboundTargetPrice: number;
  expectedReboundGainPct: number;
  expectedReboundProfitMillionVnd: number;
  safetyNoteVi: string;
}

export interface VnBottomFishingPlan {
  symbol: string;
  board: VnExchangeBoard;
  budgetMillionVnd: number;
  floorAbsorptionState: VnFloorAbsorptionState;
  floorAbsorptionBadgeVi: string;
  floorAbsorptionDetailVi: string;
  isSafeToPlacePassiveLimits: boolean;
  rungs: [VnBottomFishingRung, VnBottomFishingRung, VnBottomFishingRung];
  t2StressTest: VnT2BottomStressTest;
}

// ============================================================================
// 3. T+2.5 COHORT ARRIVAL SUPPLY SHOCK TRACKER (13:00 AFTERNOON UNLOCK)
// ============================================================================

export type VnT2SupplyShockRegime =
  | 'HIGH_PROFIT_TAKING_13H'
  | 'PANIC_CUTLOSS_FLUSH_13H'
  | 'HIGH_VOLUME_NEUTRAL_13H'
  | 'LOW_SUPPLY_ABSORBED';

export interface VnT2CohortSupplyShock {
  symbol: string;
  tMinus2DateLabel: string;
  tMinus2Volume: number;
  avg20SessionVolume: number;
  volumeVsAvgRatio: number; // e.g., 1.85x
  tMinus2VwapPrice: number;
  tMinus2ClosePrice: number;
  currentPrice: number;
  cohortFloatingPnlPct: number; // % gain/loss of traders who bought on T-2
  isUnlockedInCurrentSession: boolean; // True after 13:00 GMT+7
  supplyShockRegime: VnT2SupplyShockRegime;
  badgeVi: string;
  headlineVi: string;
  tacticalAdviceVi: string;
}

// ============================================================================
// 4. ATC AUCTION DISTORTION (14:30 - 14:45) & MARKING-THE-CLOSE SHIELD
// ============================================================================

export type VnAtcDistortionType =
  | 'ARTIFICIAL_ATC_MARKUP'
  | 'ATC_MARKDOWN_TRAP'
  | 'GENUINE_CLOSING_BREAKOUT'
  | 'CLEAN_CONTINUOUS_MATCH';

export interface VnAtcDistortionAnalysis {
  symbol: string;
  isAtcOrPostClosePhase: boolean;
  sessionVwapPrice: number;
  preAtcReferencePrice: number;
  closingOrCurrentPrice: number;
  gapVsVwapPct: number;
  gapVsPreAtcPct: number;
  lateBarVolumeRatio: number;
  distortionType: VnAtcDistortionType;
  badgeVi: string;
  headlineVi: string;
  nextMorningGuidanceVi: string;
}

// ============================================================================
// 5. MARKET-WIDE CAPITULATION & WASHOUT CYCLE METER (4 PHASES)
// ============================================================================

export type VnCapitulationPhase =
  | 'PHASE_1_MARGIN_EUPHORIA'
  | 'PHASE_2_EARLY_MARKDOWN'
  | 'PHASE_3_PANIC_WASHOUT'
  | 'PHASE_4_DRY_UP_SPRING';

export interface VnCapitulationCycleMeter {
  phase: VnCapitulationPhase;
  phaseNumber: 1 | 2 | 3 | 4;
  phaseBadgeVi: string;
  washoutCompletionScore: number; // 0 (top/early drop) -> 100 (washout complete & spring ready)
  rsi14Value: number;
  rvol20Ratio: number;
  breadthOversoldPct: number;
  headlineVi: string;
  checklistVi: Array<{ labelVi: string; passed: boolean }>;
  cycleGuidanceVi: string;
}

// ============================================================================
// 6. POST-CRASH FOLLOW-THROUGH DAY (FTD) TRACKER & VN30F1M PORTFOLIO BETA HEDGE
// ============================================================================

export type VnPostCrashFtdState =
  | 'FTD_CONFIRMED_BUY_SIGNAL'
  | 'DEAD_CAT_BOUNCE_WARNING'
  | 'RALLY_ATTEMPT_COUNTING'
  | 'SEEKING_BOTTOM_DAY_1'
  | 'UPTREND_NORMAL';

export interface VnFirstMoverLeader {
  symbol: string;
  name: string;
  price: number;
  change24hPct: number;
  bounceFromLowPct: number;
  reasonVi: string;
}

export interface VnPortfolioBetaHedgePlan {
  hasVnEquityExposure: boolean;
  totalEquityValueMillionVnd: number;
  lockedT2EquityValueMillionVnd: number;
  vn30f1mPrice: number;
  contractMultiplierNotionalMillionVnd: number; // 1 contract = price * 0.1 Million VND
  marginPerContractMillionVnd: number; // ~17% of contract notional
  recommendedShortContractsFullHedge: number;
  recommendedShortContractsHalfHedge: number;
  requiredMarginMillionVnd: number;
  hedgeStopLossPoints: number;
  hedgeTargetPoints: number;
  hedgeSummaryVi: string;
}

export interface VnPostCrashAndHedgeSummary {
  ftdState: VnPostCrashFtdState;
  ftdBadgeVi: string;
  rallyAttemptDayCount: number; // Day 1..12 since recent swing low
  recentSwingLowPrice: number;
  reboundFromLowPct: number;
  ftdHeadlineVi: string;
  ftdGuidanceVi: string;
  firstMoverLeaders: VnFirstMoverLeader[];
  betaHedgePlan: VnPortfolioBetaHedgePlan;
}

export interface VnComprehensiveTacticalReport {
  symbol: string;
  panicAndForceSell: VnPanicAndForceSellRadar;
  bottomFishingPlan: VnBottomFishingPlan;
  t2CohortShock: VnT2CohortSupplyShock;
  atcDistortion: VnAtcDistortionAnalysis;
  capitulationMeter: VnCapitulationCycleMeter;
  postCrashAndHedge: VnPostCrashAndHedgeSummary;
  spotDailyCash: VnDailySpotTradingReport;
}

// ============================================================================
// HELPER UTILITIES
// ============================================================================

const LIQUID_CROSS_SELL_VULNERABLE_TICKERS = new Set([
  'HPG',
  'SSI',
  'FPT',
  'STB',
  'MBB',
  'MWG',
  'TCB',
  'VPB',
  'ACB',
  'VND',
  'VCI',
  'HCM',
  'CTG',
  'SHB',
  'VIC',
  'VHM',
  'GVR',
  'DGC',
  'MSN',
]);

function getVnClockParts(now: Date = new Date()): {
  dayOfWeek: number;
  minutesOfDay: number;
  isTradingWeekday: boolean;
  isInForceSellWindow: boolean;
  isAfter13hUnlock: boolean;
  isAtcOrPostClose: boolean;
} {
  const vnString = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(vnString);
  const dayOfWeek = vnDate.getDay();
  const hours = vnDate.getHours();
  const minutes = vnDate.getMinutes();
  const minutesOfDay = hours * 60 + minutes;
  const isTradingWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  // CTCK afternoon margin call & force-sell execution window: 13:30 (810) to 14:25 (865)
  const isInForceSellWindow =
    isTradingWeekday && minutesOfDay >= 13 * 60 + 30 && minutesOfDay <= 14 * 60 + 25;
  const isAfter13hUnlock = isTradingWeekday && minutesOfDay >= 13 * 60;
  // ATC starts at 14:30 (870); after close >= 14:45 (885)
  const isAtcOrPostClose = !isTradingWeekday || minutesOfDay >= 14 * 60 + 28 || minutesOfDay < 9 * 60;

  return {
    dayOfWeek,
    minutesOfDay,
    isTradingWeekday,
    isInForceSellWindow,
    isAfter13hUnlock,
    isAtcOrPostClose,
  };
}

function formatShortDateVi(unixSeconds: number): string {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return '—';
  const d = new Date(unixSeconds * 1000);
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

/**
 * Aggregates intraday candles into daily session bars if 1D MTF candles are not supplied,
 * ensuring O'Neil Distribution Day & T-2 Cohort calculations always operate on true daily sessions.
 */
export function resolveDailySessionCandles(
  activeCandles: Candle[],
  mtfCandlesMap?: Partial<Record<Timeframe, Candle[]>>
): Candle[] {
  const mtf1d = mtfCandlesMap?.['1D'];
  if (mtf1d && mtf1d.length >= 8) {
    return mtf1d;
  }
  if (activeCandles.length === 0) return [];

  // Check median bar interval; if already >= 12 hours, treat activeCandles as daily
  if (activeCandles.length >= 2) {
    const dt = Math.abs(
      activeCandles[activeCandles.length - 1].time - activeCandles[activeCandles.length - 2].time
    );
    if (dt >= 43_200) {
      return activeCandles;
    }
  }

  // Group intraday bars by Vietnam calendar date (UTC+7)
  const grouped = new Map<string, Candle>();
  for (const c of activeCandles) {
    const vnMs = c.time * 1000 + 7 * 3600 * 1000;
    const dayKey = new Date(vnMs).toISOString().slice(0, 10);
    const existing = grouped.get(dayKey);
    if (!existing) {
      grouped.set(dayKey, { ...c });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
    }
  }

  const dailyList = Array.from(grouped.values());
  return dailyList.length >= 5 ? dailyList : activeCandles;
}

// ============================================================================
// ENGINE 1: PANIC SELLOFF, DISTRIBUTION DAYS & 13:45-14:15 FORCE-SELL RADAR
// ============================================================================

export function evaluateVnPanicAndForceSellRadar(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  mtfCandlesMap?: Partial<Record<Timeframe, Candle[]>>;
  allSymbols: MarketSymbol[];
  orderFlow?: VnActiveOrderFlowSummary | null;
  now?: Date;
}): VnPanicAndForceSellRadar {
  const { symbolObj, candles, mtfCandlesMap, allSymbols, now = new Date() } = params;
  const symUpper = symbolObj.symbol.toUpperCase();
  const dailyCandles = resolveDailySessionCandles(candles, mtfCandlesMap);
  const windowBars = dailyCandles.slice(-26);

  let distributionDays25d = 0;
  let stallingDays25d = 0;
  const recentDistributionDates: string[] = [];

  const avgVol20 =
    windowBars.length > 0
      ? windowBars.reduce((acc, b) => acc + b.volume, 0) / windowBars.length
      : 1;

  for (let i = 1; i < windowBars.length; i++) {
    const prev = windowBars[i - 1];
    const cur = windowBars[i];
    if (prev.close <= 0 || prev.volume <= 0) continue;

    const pctChange = ((cur.close - prev.close) / prev.close) * 100;
    const span = Math.max(1e-8, cur.high - cur.low);
    const clv = (cur.close - cur.low) / span;

    // O'Neil Distribution Day: drops <= -0.20% on higher volume than prior session
    if (pctChange <= -0.2 && cur.volume > prev.volume) {
      distributionDays25d++;
      recentDistributionDates.push(formatShortDateVi(cur.time));
    } else if (
      // Stalling Day: high volume (>= 1.1x avg20 and > prev.volume), tiny gain (-0.19%..+0.45%), weak close in lower 45% of range
      pctChange > -0.2 &&
      pctChange <= 0.45 &&
      cur.volume > prev.volume &&
      cur.volume >= avgVol20 * 1.1 &&
      clv <= 0.45
    ) {
      stallingDays25d++;
      recentDistributionDates.push(`${formatShortDateVi(cur.time)} (Kéo xả)`);
    }
  }

  const totalDistributionCluster = distributionDays25d + Math.min(2, stallingDays25d);

  // Market-wide VN breadth & floor-lock scan
  const vnEquities = allSymbols.filter((s) => {
    const u = s.symbol.toUpperCase();
    return (
      isVnStockOrIndexSymbol(s) &&
      !isVnDerivativeSymbol(u) &&
      !['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX'].includes(u)
    );
  });

  let marketFloorOrNearFloorCount = 0;
  let decliners = 0;
  for (const s of vnEquities) {
    if (s.change24h < 0) decliners++;
    const lim = computeVnPriceLimits({
      symbol: s.symbol,
      currentPrice: s.price,
      change24hPct: s.change24h,
    });
    if (lim.colorState === 'FLOOR' || lim.isNearFloor || s.change24h <= -5.5) {
      marketFloorOrNearFloorCount++;
    }
  }
  const marketDeclinerRatioPct =
    vnEquities.length > 0 ? Math.round((decliners / vnEquities.length) * 100) : 50;

  const basisInfo = computeVn30BasisAnalytics(allSymbols, now);
  const vn30BasisPoints = basisInfo ? basisInfo.basisPoints : null;
  const clock = getVnClockParts(now);
  const flow = params.orderFlow ?? computeVnActiveOrderFlow(candles, symbolObj);

  // Compute Force-Sell / Call Margin Probability (0..100%)
  let forceScore = 10;
  if (totalDistributionCluster >= 5) forceScore += 22;
  else if (totalDistributionCluster >= 3) forceScore += 12;

  if (marketDeclinerRatioPct >= 75) forceScore += 20;
  else if (marketDeclinerRatioPct >= 60) forceScore += 10;

  if (marketFloorOrNearFloorCount >= 3) forceScore += 20;
  else if (marketFloorOrNearFloorCount >= 1) forceScore += 10;

  if (symbolObj.change24h <= -4.5) forceScore += 18;
  else if (symbolObj.change24h <= -2.5) forceScore += 10;

  if (flow.activeSellPct >= 62) forceScore += 14;
  else if (flow.activeSellPct >= 55) forceScore += 7;

  if (vn30BasisPoints !== null && vn30BasisPoints <= -8) forceScore += 12;
  else if (vn30BasisPoints !== null && vn30BasisPoints <= -4) forceScore += 6;

  if (clock.isInForceSellWindow && (symbolObj.change24h <= -2.0 || marketDeclinerRatioPct >= 65)) {
    forceScore += 12;
  }

  const forceSellProbabilityPct = Math.min(98, Math.max(5, Math.round(forceScore)));

  // Cross-Liquidation Warning: when current stock is a liquid VN30/leader stock AND market has floor-locked stocks or high force-sell pressure
  const crossLiquidationWarning =
    LIQUID_CROSS_SELL_VULNERABLE_TICKERS.has(symUpper) &&
    (marketFloorOrNearFloorCount >= 1 || forceSellProbabilityPct >= 60) &&
    (symbolObj.change24h <= -1.8 || flow.activeSellPct >= 56);

  // Check if last bar shows strong lower-wick absorption after heavy selloff (Force-Sell Exhausting!)
  const lastBar = candles[candles.length - 1];
  const lastSpan = lastBar ? Math.max(1e-8, lastBar.high - lastBar.low) : 0;
  const lastClv = lastBar && lastSpan > 0 ? (lastBar.close - lastBar.low) / lastSpan : 0.5;
  const isExhaustingBounce =
    forceSellProbabilityPct >= 55 &&
    lastClv >= 0.48 &&
    flow.activeBuyPct >= 48 &&
    symbolObj.change24h <= -1.5;

  let selloffRiskLevel: VnSelloffRiskLevel = 'LOW_SAFE';
  let riskBadgeVi = '🟢 AN TOÀN — CHƯA CÓ ÁP LỰC BÁN THÁO';
  let headlineVi = `Mật độ phân phối thấp (${distributionDays25d}/25 phiên) • Xác suất Call Margin ${forceSellProbabilityPct}%.`;
  let actionGuidanceVi =
    'Thị trường chưa xuất hiện dấu hiệu bán tháo cưỡng bức hay phân phối đỉnh. Có thể giao dịch theo điểm mua kỹ thuật bình thường.';

  if (isExhaustingBounce) {
    selloffRiskLevel = 'FORCE_SELL_EXHAUSTING';
    riskBadgeVi = '⚡ HẤP THỤ GIẢI CHẤP — CẠN LỰC FORCE-SELL';
    headlineVi = `Lực xả Call Margin (${forceSellProbabilityPct}%) đang được dòng tiền lớn hấp thụ rút chân (CLV ${Math.round(lastClv * 100)}%).`;
    actionGuidanceVi =
      'Cú quét giải chấp cưỡng bức đã kích hoạt cầu bắt đáy chủ động vào đỡ giá. Có thể giải ngân Bậc 1–2 theo bảng Rải Đinh Lệnh Chờ bên dưới.';
  } else if (forceSellProbabilityPct >= 72) {
    selloffRiskLevel = 'ACTIVE_FORCE_SELL_WAVE';
    riskBadgeVi = '🚨 BÁO ĐỘNG ĐỎ: SÓNG GIẢI CHẤP / BÁN THÁO CHÉO';
    headlineVi = `Xác suất quét Force-Sell CTCK lên tới ${forceSellProbabilityPct}% • ${marketDeclinerRatioPct}% mã giảm (${marketFloorOrNearFloorCount} mã nằm/sát sàn).`;
    actionGuidanceVi =
      'Tuyệt đối KHÔNG đặt lệnh MP mua đuổi giữa nhịp xả 13:45–14:15. Chỉ kê sẵn Lệnh Chờ LO ở Bậc 2 (sát giá Sàn) để đón râu nến giải chấp hoặc dùng Short VN30F1M phòng vệ.';
  } else if (totalDistributionCluster >= 4 || forceSellProbabilityPct >= 52) {
    selloffRiskLevel = 'HIGH_SELLOFF_RISK';
    riskBadgeVi = `⚠️ RỦI RO BÁN THÁO CAO (${totalDistributionCluster} PHIÊN PHÂN PHỐI)`;
    headlineVi = `Tích lũy ${distributionDays25d} ngày phân phối + ${stallingDays25d} phiên kéo xả (25 phiên) • Áp lực Margin ${forceSellProbabilityPct}%.`;
    actionGuidanceVi =
      'Cấu trúc chuẩn O’Neil cảnh báo vùng phân phối dày. Hạ ngay tỷ lệ vay Margin về 0%, thu gọn danh mục và chuyển sang chế độ Kê Lệnh Chờ Bắt Đáy chiết khấu sâu.';
  } else if (totalDistributionCluster >= 2 || forceSellProbabilityPct >= 35) {
    selloffRiskLevel = 'DISTRIBUTION_WATCH';
    riskBadgeVi = `🟡 CẢNH GIÁC PHÂN PHỐI (${totalDistributionCluster}/5 PHIÊN)`;
    headlineVi = `Đã xuất hiện ${distributionDays25d} phiên phân phối và ${stallingDays25d} phiên chững giá nổ Vol trong 25 phiên gần nhất.`;
    actionGuidanceVi =
      'Hạn chế mua đuổi (Breakout FOMO) khi giá kéo xanh đầu phiên sáng. Ưu tiên chốt lời từng phần ở kháng cự và chờ nhịp rũ chiều.';
  }

  const bulletsVi: string[] = [
    `Bộ đếm O'Neil (25 phiên): ${distributionDays25d} phiên Phân phối + ${stallingDays25d} phiên Kéo xả ngầm${
      recentDistributionDates.length > 0
        ? ` (${recentDistributionDates.slice(-3).join(', ')})`
        : ''
    }.`,
    `Độ rộng & Áp lực bán: ${marketDeclinerRatioPct}% cổ phiếu VN giảm giá • Bán chủ động tại ${symUpper} chiếm ${flow.activeSellPct}%.`,
  ];

  if (crossLiquidationWarning) {
    bulletsVi.push(
      `⚠️ Cảnh báo Bán Giải Chấp Chéo: ${symUpper} thuộc nhóm thanh khoản cao dễ bị CTCK mang ra bán thu hồi nợ khi các mã đầu cơ/BĐS bị tắc thanh khoản sàn.`
    );
  }
  if (vn30BasisPoints !== null && vn30BasisPoints <= -5) {
    bulletsVi.push(
      `Phái sinh VN30F1M chiết khấu sâu (${vn30BasisPoints} điểm) — Dòng tiền tổ chức đang Short phòng vệ trước nhịp rung lắc cơ sở.`
    );
  }

  return {
    symbol: symUpper,
    distributionDays25d,
    stallingDays25d,
    totalDistributionCluster,
    recentDistributionDates: recentDistributionDates.slice(-5),
    forceSellProbabilityPct,
    isInAfternoonForceSellWindow: clock.isInForceSellWindow,
    crossLiquidationWarning,
    marketFloorOrNearFloorCount,
    marketDeclinerRatioPct,
    vn30BasisPoints,
    selloffRiskLevel,
    riskBadgeVi,
    headlineVi,
    bulletsVi,
    actionGuidanceVi,
  };
}

// ============================================================================
// ENGINE 2: SMART 3-RUNG BOTTOM-FISHING LIMIT LADDER & FLOOR-RESCUE DETECTOR
// ============================================================================

function roundVnLotQuantity(
  capitalMillionVnd: number,
  priceInDisplayUnits: number,
  board: VnExchangeBoard
): number {
  if (!Number.isFinite(capitalMillionVnd) || capitalMillionVnd <= 0 || priceInDisplayUnits <= 0) {
    return 0;
  }
  if (board === 'HNX_DERIVATIVE') {
    // 1 contract notional = price * 0.1 Million VND; ~17% margin
    const marginPerContract = priceInDisplayUnits * 0.1 * 0.17;
    return Math.max(1, Math.round(capitalMillionVnd / Math.max(1, marginPerContract)));
  }
  if (board === 'INDEX') return 1;
  // Corporate stock: 1 share = priceInDisplayUnits * 1,000 VND = priceInDisplayUnits * 0.001 Million VND
  const rawShares = (capitalMillionVnd * 1000) / priceInDisplayUnits;
  return Math.max(100, Math.round(rawShares / 100) * 100);
}

export function computeVnBottomFishingLadder(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  priceLimits?: VnPriceLimits | null;
  orderFlow?: VnActiveOrderFlowSummary | null;
  panicRadar?: VnPanicAndForceSellRadar | null;
  budgetMillionVnd?: number;
}): VnBottomFishingPlan {
  const { symbolObj, candles, budgetMillionVnd = 100 } = params;
  const symUpper = symbolObj.symbol.toUpperCase();
  const board = getVnExchangeBoard(symUpper);
  const limits =
    params.priceLimits ??
    computeVnPriceLimits({
      symbol: symUpper,
      currentPrice: symbolObj.price,
      change24hPct: symbolObj.change24h,
    });
  const flow = params.orderFlow ?? computeVnActiveOrderFlow(candles, symbolObj);
  const currentPrice = symbolObj.price || limits.currentPrice || 20;
  const refPrice = limits.refPrice || currentPrice;
  const floorPrice =
    limits.floorPrice ?? roundToVnTickSize(refPrice * (board === 'HNX' ? 0.9 : 0.93), board);
  const tickSize = limits.tickSize || 0.05;

  // Compute relative volume & lower-wick absorption on latest bars
  const recent20 = candles.slice(-20);
  const avgVol =
    recent20.length > 0
      ? recent20.reduce((s, c) => s + c.volume, 0) / recent20.length
      : 1;
  const lastBar = candles[candles.length - 1];
  const rvol = lastBar && avgVol > 0 ? lastBar.volume / avgVol : 1;
  const lastSpan = lastBar ? Math.max(1e-8, lastBar.high - lastBar.low) : 0;
  const lastClv = lastBar && lastSpan > 0 ? (lastBar.close - lastBar.low) / lastSpan : 0.5;
  const touchedNearFloor =
    (lastBar && lastBar.low <= floorPrice + tickSize * 3) ||
    limits.colorState === 'FLOOR' ||
    limits.isNearFloor;

  let floorAbsorptionState: VnFloorAbsorptionState = 'NORMAL_TRADING';
  let floorAbsorptionBadgeVi = '⚪ GIAO DỊCH BÌNH THƯỜNG — KÊ CHỜ DƯỚI HỖ TRỢ';
  let floorAbsorptionDetailVi =
    'Cổ phiếu chưa rơi vào vùng hoảng loạn sàn. Ưu tiên đặt sẵn Lệnh Chờ LO ở các vùng hỗ trợ cấu trúc phía dưới để đón nhịp rũ.';
  let isSafeToPlacePassiveLimits = true;

  if (
    touchedNearFloor &&
    (limits.colorState === 'FLOOR' || lastClv <= 0.22) &&
    (rvol < 1.35 || flow.activeBuyPct < 42)
  ) {
    floorAbsorptionState = 'FLOOR_LOCKED_NO_RESCUE';
    floorAbsorptionBadgeVi = '🔴 NẰM SÀN TẮC THANH KHOẢN — CẤM BẮT DAO RƠI';
    floorAbsorptionDetailVi =
      'Giá bị ép sát/kịch Sàn nhưng chưa có dòng tiền cá mập vào hốt sàn (CLV đóng cửa thấp, thiếu lực mua chủ động). Tuyệt đối khóa Bậc 3, tránh kẹp T+2.5 sàn liên hoàn.';
    isSafeToPlacePassiveLimits = false;
  } else if (
    (touchedNearFloor || symbolObj.change24h <= -3.8) &&
    rvol >= 1.4 &&
    (lastClv >= 0.36 || flow.activeBuyPct >= 50)
  ) {
    floorAbsorptionState = 'FLOOR_RESCUE_ABSORPTION';
    floorAbsorptionBadgeVi = '🟢 HẤP THỤ GIẢI CỨU SÀN — CẦU LỚN VÀO HỐT';
    floorAbsorptionDetailVi = `Khối lượng nổ gấp ${rvol.toFixed(1)}x trung bình kèm nến rút chân từ vùng giá Sàn (CLV ${Math.round(lastClv * 100)}%, Mua chủ động ${flow.activeBuyPct}%) — Tín hiệu tổ chức gom hàng giải chấp!`;
    isSafeToPlacePassiveLimits = true;
  } else if (symbolObj.change24h <= -2.5) {
    floorAbsorptionState = 'SHARP_FLUSH_SUPPORT';
    floorAbsorptionBadgeVi = '🟡 ĐANG RŨ BỎ MẠNH — CANH RẢI ĐINH BẬC 1 & 2';
    floorAbsorptionDetailVi =
      'Giá đang chiết khấu trong phiên về vùng hỗ trợ. Kê sẵn lệnh giới hạn LO ở Bậc 1 (Hỗ trợ VPVR/OB) và Bậc 2 (Sát giá sàn) để khớp giá tốt nhất.';
    isSafeToPlacePassiveLimits = true;
  }

  // Structural supports for Rung 1 & Rung 2
  const srLevels = calculateSupportResistance(candles);
  const orderBlocks = detectOrderBlocks(candles);
  const vpvr = calculateVisibleVolumeProfile(candles, 24, 0.7);

  const validSupports = [
    ...srLevels.filter((l) => l.type === 'support' && l.price < currentPrice).map((l) => l.price),
    ...orderBlocks
      .filter(
        (ob) =>
          (ob.type === 'bullish_ob' || ob.type === 'fvg_bull') &&
          !ob.mitigated &&
          ob.top < currentPrice
      )
      .map((ob) => (ob.top + ob.bottom) / 2),
    vpvr && vpvr.valPrice < currentPrice ? vpvr.valPrice : 0,
    vpvr && vpvr.pocPrice < currentPrice ? vpvr.pocPrice : 0,
  ]
    .filter((p) => p >= floorPrice && p < currentPrice * 0.995)
    .sort((a, b) => b - a);

  // Rung 1 (20% budget): First structural support or -2.8% below current/ref, strictly >= floorPrice + 3 ticks
  const rawRung1 =
    validSupports[0] ?? Math.min(currentPrice * 0.978, refPrice * 0.968);
  const minRung1 = floorPrice + tickSize * 3;
  const rung1Price = roundToVnTickSize(
    Math.max(minRung1, Math.min(currentPrice * 0.992, rawRung1)),
    board
  );

  // Rung 2 (30% budget): Deep Force-Sell Wick Catcher — 1 to 2 ticks above Floor Price (or deeper support)
  const rawRung2 = Math.max(
    floorPrice + tickSize * 1,
    Math.min(rung1Price - tickSize * 2, validSupports[1] ?? floorPrice + tickSize * 2)
  );
  const rung2Price = roundToVnTickSize(Math.max(floorPrice, rawRung2), board);

  // Rung 3 (50% budget): Confirmation / Reclaim entry after Floor Rescue or Spring
  const rawRung3 =
    floorAbsorptionState === 'FLOOR_RESCUE_ABSORPTION'
      ? currentPrice
      : Math.max(rung1Price, roundToVnTickSize(floorPrice * 1.022, board));
  const rung3Price = roundToVnTickSize(rawRung3, board);

  const safeBudget = Math.max(10, budgetMillionVnd);
  const cap1 = Number((safeBudget * 0.2).toFixed(1));
  const cap2 = Number((safeBudget * 0.3).toFixed(1));
  const cap3 = Number((safeBudget * 0.5).toFixed(1));

  const shares1 = roundVnLotQuantity(cap1, rung1Price, board);
  const shares2 = roundVnLotQuantity(cap2, rung2Price, board);
  const shares3 = roundVnLotQuantity(cap3, rung3Price, board);

  const isRung3Unlocked =
    floorAbsorptionState === 'FLOOR_RESCUE_ABSORPTION' ||
    params.panicRadar?.selloffRiskLevel === 'FORCE_SELL_EXHAUSTING';

  const rungs: [VnBottomFishingRung, VnBottomFishingRung, VnBottomFishingRung] = [
    {
      rungIndex: 1,
      weightPct: 20,
      labelVi: 'Bậc 1 (20% Vốn) — Dò Đường Hỗ Trợ',
      anchorVi: validSupports[0] ? 'VPVR VAL / Bullish OB' : 'Chiết khấu rũ bỏ nội phiên',
      limitPrice: rung1Price,
      discountFromRefPct: Number((((rung1Price - refPrice) / refPrice) * 100).toFixed(2)),
      discountFromCurrentPct: Number(
        (((rung1Price - currentPrice) / currentPrice) * 100).toFixed(2)
      ),
      recommendedShares: shares1,
      capitalMillionVnd: cap1,
      status: 'READY_LIMIT_ORDER',
      statusBadgeVi: '🟢 Kê sẵn lệnh LO',
      executionConditionVi:
        'Đặt lệnh chờ LO đầu phiên tại vùng hỗ trợ cấu trúc để khớp khi thị trường rung lắc quét Stop-loss.',
    },
    {
      rungIndex: 2,
      weightPct: 30,
      labelVi: 'Bậc 2 (30% Vốn) — Đón Râu Nến Giải Chấp',
      anchorVi: `Sát Giá Sàn +1..2 lai (${floorPrice}k)`,
      limitPrice: rung2Price,
      discountFromRefPct: Number((((rung2Price - refPrice) / refPrice) * 100).toFixed(2)),
      discountFromCurrentPct: Number(
        (((rung2Price - currentPrice) / currentPrice) * 100).toFixed(2)
      ),
      recommendedShares: shares2,
      capitalMillionVnd: cap2,
      status: 'READY_LIMIT_ORDER',
      statusBadgeVi: '🪝 Hứng Force-Sell 13:45',
      executionConditionVi:
        'Kê trên giá Sàn 1–2 bước giá để ưu tiên khớp trước cục kê mua Sàn trong khung giờ CTCK quét giải chấp 13:45–14:15.',
    },
    {
      rungIndex: 3,
      weightPct: 50,
      labelVi: 'Bậc 3 (50% Vốn) — Chủ Lực Xác Nhận Hấp Thụ',
      anchorVi: 'Nến Giải Cứu Sàn / Rút Chân Vol Lớn',
      limitPrice: rung3Price,
      discountFromRefPct: Number((((rung3Price - refPrice) / refPrice) * 100).toFixed(2)),
      discountFromCurrentPct: Number(
        (((rung3Price - currentPrice) / currentPrice) * 100).toFixed(2)
      ),
      recommendedShares: shares3,
      capitalMillionVnd: cap3,
      status: isRung3Unlocked ? 'UNLOCKED_RESCUE_CONFIRMED' : 'LOCKED_WAIT_ABSORPTION',
      statusBadgeVi: isRung3Unlocked
        ? '🔥 ĐÃ MỞ KHÓA GIẢI NGÂN'
        : '🔒 KHÓA AN TOÀN (Chờ Hốt Sàn)',
      executionConditionVi: isRung3Unlocked
        ? 'Đã xuất hiện dòng tiền lớn hấp thụ rút chân! Có thể giải ngân lô chủ lực 50% để đón sóng hồi T+.'
        : 'Chỉ mở khóa giải ngân 50% vốn cuối khi xuất hiện nến rút chân khỏi giá Sàn kèm RVOL >= 1.4x (tuyệt đối không vào khi dư bán sàn chất đống).',
    },
  ];

  // T+2.5 Stress Test (Assuming Rung 1 & Rung 2 fill during panic)
  const activeShares = isRung3Unlocked ? shares1 + shares2 + shares3 : shares1 + shares2;
  const activeCostVal = isRung3Unlocked
    ? shares1 * rung1Price + shares2 * rung2Price + shares3 * rung3Price
    : shares1 * rung1Price + shares2 * rung2Price;
  const weightedAvgBuyPrice = roundToVnTickSize(
    activeShares > 0 ? activeCostVal / activeShares : rung1Price,
    board
  );
  const totalDeployedMillionVnd = isRung3Unlocked ? safeBudget : Number((cap1 + cap2).toFixed(1));

  const bandRatio = board === 'UPCOM' ? 0.15 : board === 'HNX' ? 0.1 : 0.07;
  const ifOneMoreFloorPrice = roundToVnTickSize(floorPrice * (1 - bandRatio), board);
  const rawStressLossPct =
    weightedAvgBuyPrice > 0
      ? ((ifOneMoreFloorPrice - weightedAvgBuyPrice) / weightedAvgBuyPrice) * 100 - 0.4
      : -7;
  const lossIfOneMoreFloorPct = Number(rawStressLossPct.toFixed(2));
  const lossIfOneMoreFloorMillionVnd = Number(
    ((totalDeployedMillionVnd * lossIfOneMoreFloorPct) / 100).toFixed(2)
  );

  const reboundTargetPrice = roundToVnTickSize(
    Math.max(refPrice, weightedAvgBuyPrice * 1.065),
    board
  );
  const expectedReboundGainPct = Number(
    (
      ((reboundTargetPrice - weightedAvgBuyPrice) / Math.max(1e-8, weightedAvgBuyPrice)) * 100 -
      0.4
    ).toFixed(2)
  );
  const expectedReboundProfitMillionVnd = Number(
    ((totalDeployedMillionVnd * expectedReboundGainPct) / 100).toFixed(2)
  );

  return {
    symbol: symUpper,
    board,
    budgetMillionVnd: safeBudget,
    floorAbsorptionState,
    floorAbsorptionBadgeVi,
    floorAbsorptionDetailVi,
    isSafeToPlacePassiveLimits,
    rungs,
    t2StressTest: {
      weightedAvgBuyPrice,
      totalShares: activeShares,
      totalDeployedMillionVnd,
      ifOneMoreFloorPrice,
      lossIfOneMoreFloorPct,
      lossIfOneMoreFloorMillionVnd,
      reboundTargetPrice,
      expectedReboundGainPct,
      expectedReboundProfitMillionVnd,
      safetyNoteVi: `Nếu khớp Bậc 1+2 (giá vốn bình quân ${weightedAvgBuyPrice}k) mà ngày T+1 thị trường xấu nhất giảm thêm 1 cây Sàn nữa (${ifOneMoreFloorPrice}k), mức âm tạm tính trên tổng ngân sách ${safeBudget} Tr chỉ là ${lossIfOneMoreFloorMillionVnd} Tr VNĐ do đã giữ lại 50% tiền mặt Bậc 3.`,
    },
  };
}

// ============================================================================
// ENGINE 3: T+2.5 COHORT ARRIVAL SUPPLY SHOCK TRACKER (13:00 AFTERNOON UNLOCK)
// ============================================================================

export function evaluateVnT2CohortSupplyShock(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  mtfCandlesMap?: Partial<Record<Timeframe, Candle[]>>;
  now?: Date;
}): VnT2CohortSupplyShock {
  const { symbolObj, candles, mtfCandlesMap, now = new Date() } = params;
  const symUpper = symbolObj.symbol.toUpperCase();
  const dailyCandles = resolveDailySessionCandles(candles, mtfCandlesMap);
  const clock = getVnClockParts(now);

  // In Vietnam T+2.5 settlement: shares bought on session T-2 (index length - 3 in daily array including today's bar)
  // become tradable at 13:00 on today's session (index length - 1).
  const len = dailyCandles.length;
  const tMinus2Bar =
    len >= 3
      ? dailyCandles[len - 3]
      : len >= 2
      ? dailyCandles[0]
      : candles[0] || {
          time: Math.floor(Date.now() / 1000) - 172_800,
          open: symbolObj.price,
          high: symbolObj.price,
          low: symbolObj.price,
          close: symbolObj.price,
          volume: symbolObj.volume24h || 100_000,
        };

  const recent20 = dailyCandles.slice(-20);
  const avg20SessionVolume =
    recent20.length > 0
      ? Math.round(recent20.reduce((s, c) => s + c.volume, 0) / recent20.length)
      : Math.max(1, tMinus2Bar.volume);

  const volumeVsAvgRatio = Number(
    (tMinus2Bar.volume / Math.max(1, avg20SessionVolume)).toFixed(2)
  );
  const board = getVnExchangeBoard(symUpper);
  const tMinus2VwapPrice = roundToVnTickSize(
    (tMinus2Bar.high + tMinus2Bar.low + tMinus2Bar.close) / 3,
    board
  );
  const currentPrice = symbolObj.price || dailyCandles[len - 1]?.close || tMinus2VwapPrice;
  const cohortFloatingPnlPct =
    tMinus2VwapPrice > 0
      ? Number((((currentPrice - tMinus2VwapPrice) / tMinus2VwapPrice) * 100).toFixed(2))
      : 0;
  const tMinus2DateLabel = formatShortDateVi(tMinus2Bar.time);

  let supplyShockRegime: VnT2SupplyShockRegime = 'LOW_SUPPLY_ABSORBED';
  let badgeVi = '🟢 CUNG T+2.5 HIỀN HÒA';
  let headlineVi = `Lượng hàng mua ngày ${tMinus2DateLabel} (${volumeVsAvgRatio}x TB20P) đang ${
    cohortFloatingPnlPct >= 0 ? `lãi nhẹ +${cohortFloatingPnlPct}%` : `lỗ nhẹ ${cohortFloatingPnlPct}%`
  } around giá vốn ${tMinus2VwapPrice}k.`;
  let tacticalAdviceVi =
    'Áp lực hàng T+2.5 về tài khoản lúc 13:00 chiều nay không gây đột biến cung. Có thể giao dịch theo tín hiệu dòng tiền thông thường.';

  if (cohortFloatingPnlPct >= 3.2 && volumeVsAvgRatio >= 1.1) {
    supplyShockRegime = 'HIGH_PROFIT_TAKING_13H';
    badgeVi = `⚠️ ÁP LỰC CHỐT LỜI T+2.5 LÚC 13:00 (+${cohortFloatingPnlPct}%)`;
    headlineVi = `Lô hàng bắt đáy Vol lớn ngày ${tMinus2DateLabel} (${volumeVsAvgRatio}x TB20P, giá vốn ~${tMinus2VwapPrice}k) đang lãi +${cohortFloatingPnlPct}% khi về tài khoản chiều nay!`;
    tacticalAdviceVi =
      'Tránh FOMO mua đuổi giá xanh trong phiên sáng. Chờ nhịp xả chốt lời hàng T+2.5 lúc 13:00–13:30 chiều kiểm định lại VWAP rồi mới kê mua.';
  } else if (cohortFloatingPnlPct <= -3.5 && volumeVsAvgRatio >= 1.1) {
    supplyShockRegime = 'PANIC_CUTLOSS_FLUSH_13H';
    badgeVi = `🚨 RỦI RO XẢ CẮT LỖ HÀNG T+2.5 LÚC 13:00 (${cohortFloatingPnlPct}%)`;
    headlineVi = `Lượng hàng đu giá cao ngày ${tMinus2DateLabel} (${volumeVsAvgRatio}x TB20P, giá vốn ~${tMinus2VwapPrice}k) đang lỗ ${cohortFloatingPnlPct}% khi mở khóa bán chiều nay.`;
    tacticalAdviceVi =
      'Khung 13:00–14:00 chiều dễ xuất hiện nhịp rũ bỏ (Shakeout) do nhà đầu tư ngắn hạn cắt lỗ hàng vừa về. Đây là thời điểm vàng để đặt Lệnh Chờ Bắt Đáy Bậc 1–2 giá thấp.';
  } else if (volumeVsAvgRatio >= 1.45) {
    supplyShockRegime = 'HIGH_VOLUME_NEUTRAL_13H';
    badgeVi = `🟡 LƯỢNG HÀNG T+2.5 LỚN (${volumeVsAvgRatio}x) VỀ LÚC 13:00`;
    headlineVi = `Phiên ${tMinus2DateLabel} khớp khối lượng cao gấp ${volumeVsAvgRatio}x trung bình quanh giá vốn ${tMinus2VwapPrice}k (${cohortFloatingPnlPct >= 0 ? '+' : ''}${cohortFloatingPnlPct}%).`;
    tacticalAdviceVi =
      'Theo dõi sát phản ứng hấp thụ tại mốc 13:00–13:20 chiều: Nếu khối lượng bán ra được nuốt gọn mà không thủng VWAP thì cổ phiếu sẽ bật tăng mạnh sau 13:45.';
  }

  return {
    symbol: symUpper,
    tMinus2DateLabel,
    tMinus2Volume: Math.round(tMinus2Bar.volume),
    avg20SessionVolume,
    volumeVsAvgRatio,
    tMinus2VwapPrice,
    tMinus2ClosePrice: tMinus2Bar.close,
    currentPrice,
    cohortFloatingPnlPct,
    isUnlockedInCurrentSession: clock.isAfter13hUnlock,
    supplyShockRegime,
    badgeVi,
    headlineVi,
    tacticalAdviceVi,
  };
}

// ============================================================================
// ENGINE 4: ATC AUCTION DISTORTION (14:30 - 14:45) & MARKING-THE-CLOSE SHIELD
// ============================================================================

export function evaluateVnAtcDistortionShield(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  orderFlow?: VnActiveOrderFlowSummary | null;
  vnInsights?: VnStockInsightsPayload | null;
  now?: Date;
}): VnAtcDistortionAnalysis {
  const { symbolObj, candles, vnInsights, now = new Date() } = params;
  const symUpper = symbolObj.symbol.toUpperCase();
  const board = getVnExchangeBoard(symUpper);
  const clock = getVnClockParts(now);
  const flow = params.orderFlow ?? computeVnActiveOrderFlow(candles, symbolObj, vnInsights?.liquidityAndPt);

  const closingOrCurrentPrice = symbolObj.price || candles[candles.length - 1]?.close || 0;
  const sessionVwapPrice = roundToVnTickSize(
    vnInsights?.liquidityAndPt?.vwapPrice ?? flow.vwapPrice ?? closingOrCurrentPrice,
    board
  );

  const prevBar =
    candles.length >= 2 ? candles[candles.length - 2] : candles[candles.length - 1];
  const lastBar = candles[candles.length - 1];
  const preAtcReferencePrice = roundToVnTickSize(
    prevBar ? prevBar.close : sessionVwapPrice,
    board
  );

  const gapVsVwapPct =
    sessionVwapPrice > 0
      ? Number((((closingOrCurrentPrice - sessionVwapPrice) / sessionVwapPrice) * 100).toFixed(2))
      : 0;
  const gapVsPreAtcPct =
    preAtcReferencePrice > 0
      ? Number(
          (((closingOrCurrentPrice - preAtcReferencePrice) / preAtcReferencePrice) * 100).toFixed(2)
        )
      : 0;

  const recent10 = candles.slice(-10);
  const avgBarVol =
    recent10.length > 0
      ? recent10.reduce((s, c) => s + c.volume, 0) / recent10.length
      : 1;
  const lateBarVolumeRatio =
    lastBar && avgBarVol > 0 ? Number((lastBar.volume / avgBarVol).toFixed(2)) : 1;

  let distortionType: VnAtcDistortionType = 'CLEAN_CONTINUOUS_MATCH';
  let badgeVi = '🟢 KHỚP LỆNH TRUNG THỰC VỚI VWAP';
  let headlineVi = `Giá khớp (${closingOrCurrentPrice}k) bám sát VWAP cả phiên (${sessionVwapPrice}k, lệch ${gapVsVwapPct >= 0 ? '+' : ''}${gapVsVwapPct}%).`;
  let nextMorningGuidanceVi =
    'Không có dấu hiệu làm giá hay nhiễu ảo cuối phiên ATC. Có thể tin cậy vào tín hiệu đóng nến hiện tại.';

  // Detect Artificial ATC Markup: price pulled >= +1.15% above session VWAP despite weak active buy (< 50%) or low late volume
  if (
    gapVsVwapPct >= 1.15 &&
    (flow.activeBuyPct < 50 || lateBarVolumeRatio < 0.85 || gapVsPreAtcPct >= 0.9)
  ) {
    distortionType = 'ARTIFICIAL_ATC_MARKUP';
    badgeVi = '⚠️ CẢNH BÁO KÉO ẢO CUỐI PHIÊN (ATC MARKUP)';
    headlineVi = `Giá bị kéo vọt +${gapVsVwapPct}% lên trên VWAP phiên (${sessionVwapPrice}k) dù mua chủ động cả ngày chỉ đạt ${flow.activeBuyPct}%.`;
    nextMorningGuidanceVi =
      'Cẩn trọng bẫy "Kéo trụ làm đẹp nến" trong phiên ATC! Tuyệt đối KHÔNG đặt lệnh ATO mua đuổi sáng mai — Giá thường trả điểm test lại vùng VWAP ' +
      `${sessionVwapPrice}k sau 09:30.`;
  } else if (
    // Detect ATC Markdown Trap: price pushed <= -1.15% below session VWAP despite strong intraday absorption (activeBuyPct >= 52%)
    gapVsVwapPct <= -1.15 &&
    (flow.activeBuyPct >= 52 || gapVsPreAtcPct <= -0.9)
  ) {
    distortionType = 'ATC_MARKDOWN_TRAP';
    badgeVi = '💎 ĐÈ GIÁ ATC CUỐI PHIÊN (MARKDOWN TRAP)';
    headlineVi = `Giá bị đè cuối phiên xuống ${gapVsVwapPct}% dưới VWAP (${sessionVwapPrice}k) dù dòng tiền mua chủ động trong phiên đạt tới ${flow.activeBuyPct}%.`;
    nextMorningGuidanceVi =
      'Hiện tượng đè giá ATC (thường do quỹ cơ cấu hoặc ép tâm lý nhỏ lẻ). Không bán tháo đuổi đầu phiên sáng mai — Canh gom giá chiết khấu quanh ' +
      `${closingOrCurrentPrice}k khi mở cửa.`;
  } else if (gapVsVwapPct >= 1.15 && flow.activeBuyPct >= 56 && lateBarVolumeRatio >= 1.1) {
    distortionType = 'GENUINE_CLOSING_BREAKOUT';
    badgeVi = '🔥 ĐÓNG CỬA CAO NHẤT PHIÊN ĐỒNG THUẬN TIỀN LỚN';
    headlineVi = `Giá đóng cửa bứt phá +${gapVsVwapPct}% trên VWAP (${sessionVwapPrice}k) với Mua chủ động áp đảo (${flow.activeBuyPct}%) & Vol cuối phiên ${lateBarVolumeRatio}x.`;
    nextMorningGuidanceVi =
      'Xung lực cầu thực chất đẩy trần/sát đỉnh đến tận phút cuối ATC. Ưu tiên nắm giữ gồng lãi hoặc canh gia tăng khi chỉnh nhẹ.';
  }

  return {
    symbol: symUpper,
    isAtcOrPostClosePhase: clock.isAtcOrPostClose,
    sessionVwapPrice,
    preAtcReferencePrice,
    closingOrCurrentPrice,
    gapVsVwapPct,
    gapVsPreAtcPct,
    lateBarVolumeRatio,
    distortionType,
    badgeVi,
    headlineVi,
    nextMorningGuidanceVi,
  };
}

// ============================================================================
// ENGINE 5: MARKET-WIDE CAPITULATION & WASHOUT CYCLE METER (4 PHASES)
// ============================================================================

export function evaluateVnCapitulationCycleMeter(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  panicRadar: VnPanicAndForceSellRadar;
  bottomPlan: VnBottomFishingPlan;
}): VnCapitulationCycleMeter {
  const { symbolObj, candles, panicRadar, bottomPlan } = params;
  const closes = candles.map((c) => c.close);
  const rsiArr = candles.length >= 15 ? calculateRSI(candles, 14) : [];
  const rsi14Value = Number((rsiArr[rsiArr.length - 1]?.value ?? 50).toFixed(1));
  const ema20Arr = closes.length >= 5 ? calculateEMA(closes, Math.min(20, closes.length)) : [];
  const ema20 = ema20Arr[ema20Arr.length - 1] ?? symbolObj.price;

  const recent20 = candles.slice(-20);
  const avgVol20 =
    recent20.length > 0
      ? recent20.reduce((s, c) => s + c.volume, 0) / recent20.length
      : 1;
  const lastBar = candles[candles.length - 1];
  const rvol20Ratio =
    lastBar && avgVol20 > 0 ? Number((lastBar.volume / avgVol20).toFixed(2)) : 1;

  const distFromEma20Pct =
    ema20 > 0 ? ((symbolObj.price - ema20) / ema20) * 100 : 0;
  const breadthOversoldPct = panicRadar.marketDeclinerRatioPct;

  const checklistVi: Array<{ labelVi: string; passed: boolean }> = [
    {
      labelVi: `Chiết khấu quá bán kỹ thuật (RSI 14 = ${rsi14Value} <= 36 hoặc cách EMA20 <= -5%)`,
      passed: rsi14Value <= 36 || distFromEma20Pct <= -5.0,
    },
    {
      labelVi: `Đã trải qua rũ bỏ diện rộng (${breadthOversoldPct}% mã giảm hoặc đã có nhịp quét Sàn)`,
      passed: breadthOversoldPct >= 62 || panicRadar.marketFloorOrNearFloorCount >= 1,
    },
    {
      labelVi: `Hấp thụ giải cứu Sàn hoặc Kiệt cung bán (${rvol20Ratio}x TB20P)`,
      passed:
        bottomPlan.floorAbsorptionState === 'FLOOR_RESCUE_ABSORPTION' ||
        (rvol20Ratio <= 0.78 && Math.abs(symbolObj.change24h) <= 1.5),
    },
    {
      labelVi: `Không bị khóa sàn trắng bên mua (${bottomPlan.floorAbsorptionBadgeVi.slice(0, 22)}...)`,
      passed: bottomPlan.floorAbsorptionState !== 'FLOOR_LOCKED_NO_RESCUE',
    },
  ];

  const passedCount = checklistVi.filter((c) => c.passed).length;

  let phase: VnCapitulationPhase = 'PHASE_2_EARLY_MARKDOWN';
  let phaseNumber: 1 | 2 | 3 | 4 = 2;
  let phaseBadgeVi = '🟠 PHA 2: NHỊP RƠI ĐẦU / PHÂN PHỐI — CHỜ CHIẾT KHẤU';
  let washoutCompletionScore = 38;
  let headlineVi =
    'Cổ phiếu đang trong pha điều chỉnh hoặc phân phối đầu chu kỳ — Chưa hoàn tất rũ bỏ Margin.';
  let cycleGuidanceVi =
    'Tuyệt đối không all-in bắt đáy ở nhịp rơi đầu tiên. Giữ tỷ trọng tiền mặt cao và chỉ kê sẵn Bậc 1 (20%) tại hỗ trợ sâu.';

  if (rsi14Value >= 66 && distFromEma20Pct >= 4.0) {
    phase = 'PHASE_1_MARGIN_EUPHORIA';
    phaseNumber = 1;
    phaseBadgeVi = '🔴 PHA 1: HƯNG PHẤN CĂNG MARGIN / VÙNG ĐỈNH NGẮN HẠN';
    washoutCompletionScore = 15;
    headlineVi = `RSI đạt ${rsi14Value} và giá kéo giãn +${distFromEma20Pct.toFixed(1)}% trên EMA20 — Rủi ro rung lắc chốt lời cao.`;
    cycleGuidanceVi =
      'Ưu tiên chặn lãi (Trailing Stop) và hạ dần tỷ lệ Margin khi thị trường hưng phấn, không mở mới vị thế mua đuổi.';
  } else if (
    bottomPlan.floorAbsorptionState === 'FLOOR_RESCUE_ABSORPTION' ||
    panicRadar.selloffRiskLevel === 'FORCE_SELL_EXHAUSTING' ||
    (passedCount >= 3 && rvol20Ratio >= 1.35)
  ) {
    phase = 'PHASE_3_PANIC_WASHOUT';
    phaseNumber = 3;
    phaseBadgeVi = '🟡 PHA 3: CAO TRÀO GIẢI CHẤP (WASHOUT) — CÁ MẬP HỐT HÀNG';
    washoutCompletionScore = 78;
    headlineVi = `Đã xuất hiện phiên rũ bỏ cao trào (RSI ${rsi14Value}, RVOL ${rvol20Ratio}x) kèm lực cầu lớn hấp thụ hàng Force-Sell!`;
    cycleGuidanceVi =
      'Thời điểm vàng để khớp Bậc 1 (20%) và Bậc 2 (30%) trong bảng Rải Đinh Lệnh Chờ Bắt Đáy khi nhỏ lẻ hoảng loạn bán ra.';
  } else if (
    (rsi14Value <= 44 || distFromEma20Pct <= -3.0) &&
    rvol20Ratio <= 0.85 &&
    Math.abs(symbolObj.change24h) <= 1.8 &&
    bottomPlan.floorAbsorptionState !== 'FLOOR_LOCKED_NO_RESCUE'
  ) {
    phase = 'PHASE_4_DRY_UP_SPRING';
    phaseNumber = 4;
    phaseBadgeVi = '🟢 PHA 4: KIỆT CUNG TẠO ĐÁY (SPRING) — SẴN SÀNG BẬT TĂNG';
    washoutCompletionScore = 90;
    headlineVi = `Thanh khoản cạn kiệt (${rvol20Ratio}x TB20P) sau nhịp giảm — Nguồn cung đeo bám & Call Margin đã vắt kiệt!`;
    cycleGuidanceVi =
      'Pha an toàn nhất để giải ngân: Áp lực bán đã cạn, chỉ cần dòng tiền mồi nhẹ là cổ phiếu bật tăng vượt nền.';
  }

  return {
    phase,
    phaseNumber,
    phaseBadgeVi,
    washoutCompletionScore,
    rsi14Value,
    rvol20Ratio,
    breadthOversoldPct,
    headlineVi,
    checklistVi,
    cycleGuidanceVi,
  };
}

// ============================================================================
// ENGINE 6: POST-CRASH FTD TRACKER & VN30F1M PORTFOLIO BETA HEDGE
// ============================================================================

export function evaluateVnPostCrashFtdAndBetaHedge(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  mtfCandlesMap?: Partial<Record<Timeframe, Candle[]>>;
  allSymbols: MarketSymbol[];
  userHoldingsMap: Record<string, UserHoldingItem>;
  panicRadar: VnPanicAndForceSellRadar;
}): VnPostCrashAndHedgeSummary {
  const { symbolObj, candles, mtfCandlesMap, allSymbols, userHoldingsMap, panicRadar } = params;
  const dailyCandles = resolveDailySessionCandles(candles, mtfCandlesMap);
  const lookback = dailyCandles.slice(-15);

  let minLow = Infinity;
  let minIdx = 0;
  for (let i = 0; i < lookback.length; i++) {
    if (lookback[i].low < minLow) {
      minLow = lookback[i].low;
      minIdx = i;
    }
  }

  const recentSwingLowPrice = Number.isFinite(minLow) ? minLow : symbolObj.price;
  const rallyAttemptDayCount = Math.max(1, lookback.length - minIdx);
  const currentPrice = symbolObj.price || lookback[lookback.length - 1]?.close || 1;
  const reboundFromLowPct =
    recentSwingLowPrice > 0
      ? Number((((currentPrice - recentSwingLowPrice) / recentSwingLowPrice) * 100).toFixed(2))
      : 0;

  const avgVol20 =
    dailyCandles.length > 0
      ? dailyCandles.slice(-20).reduce((s, c) => s + c.volume, 0) /
        Math.min(20, dailyCandles.length)
      : 1;
  const lastDaily = lookback[lookback.length - 1];
  const prevDaily = lookback.length >= 2 ? lookback[lookback.length - 2] : lastDaily;
  const lastDailyChangePct =
    prevDaily && prevDaily.close > 0
      ? ((lastDaily.close - prevDaily.close) / prevDaily.close) * 100
      : symbolObj.change24h;

  const isFtdConfirmed =
    rallyAttemptDayCount >= 4 &&
    rallyAttemptDayCount <= 12 &&
    lastDailyChangePct >= 1.25 &&
    lastDaily &&
    prevDaily &&
    lastDaily.volume > prevDaily.volume &&
    lastDaily.volume >= avgVol20 * 0.95;

  const isDeadCatWarning =
    rallyAttemptDayCount >= 1 &&
    rallyAttemptDayCount <= 3 &&
    lastDailyChangePct > 0.3 &&
    lastDaily &&
    lastDaily.volume < avgVol20 * 0.85 &&
    panicRadar.totalDistributionCluster >= 3;

  let ftdState: VnPostCrashFtdState = 'UPTREND_NORMAL';
  let ftdBadgeVi = '🟢 XU HƯỚNG VẬN ĐỘNG BÌNH THƯỜNG';
  let ftdHeadlineVi = `Đang ở phiên thứ ${rallyAttemptDayCount} tính từ đáy ngắn hạn ${recentSwingLowPrice}k (+${reboundFromLowPct}%).`;
  let ftdGuidanceVi =
    'Ưu tiên chọn lọc các cổ phiếu có sức mạnh giá RS dẫn đầu ngành và được Khối ngoại mua ròng.';

  if (isFtdConfirmed) {
    ftdState = 'FTD_CONFIRMED_BUY_SIGNAL';
    ftdBadgeVi = `🔥 XÁC NHẬN BÙNG NỔ THEO ĐÀ (FTD NGÀY THỨ ${rallyAttemptDayCount})`;
    ftdHeadlineVi = `Phiên thứ ${rallyAttemptDayCount} sau đáy bùng nổ +${lastDailyChangePct.toFixed(2)}% với thanh khoản vượt phiên trước & vượt TB 20 phiên!`;
    ftdGuidanceVi =
      'Tín hiệu chuẩn William O’Neil xác nhận kết thúc nhịp điều chỉnh. Giải ngân mạnh vào Top cổ phiếu dẫn sóng bật đầu tiên bên dưới.';
  } else if (isDeadCatWarning) {
    ftdState = 'DEAD_CAT_BOUNCE_WARNING';
    ftdBadgeVi = `⚠️ CẢNH BÁO HỒI KỸ THUẬT VOL THẤP (NGÀY ${rallyAttemptDayCount}/3)`;
    ftdHeadlineVi = `Nhịp nảy đầu tiên (+${reboundFromLowPct}% từ đáy ${recentSwingLowPrice}k) có khối lượng thấp dưới TB20P — Rủi ro Bull-trap test lại đáy 2!`;
    ftdGuidanceVi =
      '80% nhịp hồi ngày 1–3 sau bán tháo với Vol thấp sẽ quay lại test đáy lần 2 (Double Bottom). Không mua đuổi giá xanh, tận dụng nhịp nảy để cơ cấu hạ Margin.';
  } else if (rallyAttemptDayCount === 1 && symbolObj.change24h <= -2.0) {
    ftdState = 'SEEKING_BOTTOM_DAY_1';
    ftdBadgeVi = '🔎 ĐANG DÒ ĐÁY NGẮN HẠN (CHỜ PHIÊN NỖ LỰC SỐ 1)';
    ftdHeadlineVi = `Giá đang tìm điểm cân bằng quanh ${recentSwingLowPrice}k — Chờ cây nến rút chân đóng cửa xanh đầu tiên để bắt đầu đếm Ngày Nỗ Lực Phục Hồi.`;
    ftdGuidanceVi =
      'Kiên nhẫn dùng bảng Rải Đinh Lệnh Chờ Bậc 1–2 hoặc giữ phòng vệ VN30F1M cho tới khi xuất hiện phiên nỗ lực phục hồi số 1.';
  } else if (rallyAttemptDayCount >= 2 && rallyAttemptDayCount <= 10) {
    ftdState = 'RALLY_ATTEMPT_COUNTING';
    ftdBadgeVi = `⏱️ ĐẾM NGÀY NỖ LỰC PHỤC HỒI: NGÀY THỨ ${rallyAttemptDayCount}`;
    ftdHeadlineVi = `Đã giữ vững đáy ${recentSwingLowPrice}k qua ${rallyAttemptDayCount} phiên (+${reboundFromLowPct}%) — Đang chờ phiên Bùng Nổ Theo Đà (FTD từ ngày 4–10).`;
    ftdGuidanceVi =
      'Nếu từ phiên thứ 4 trở đi xuất hiện phiên tăng >= +1.25% kèm khối lượng đột biến mà không thủng lại đáy ' +
      `${recentSwingLowPrice}k, chu kỳ tăng mới sẽ chính thức xác nhận.`;
  }

  // Scan First-Mover Leaders across VN equities
  const vnStocks = allSymbols.filter((s) => {
    const u = s.symbol.toUpperCase();
    return (
      isVnStockOrIndexSymbol(s) &&
      !isVnDerivativeSymbol(u) &&
      !['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX'].includes(u) &&
      s.price > 0
    );
  });

  const firstMoverLeaders: VnFirstMoverLeader[] = vnStocks
    .map((s) => {
      const lo = s.low24h > 0 ? Math.min(s.price, s.low24h) : s.price * 0.98;
      const bounceFromLowPct = Number((((s.price - lo) / Math.max(1e-8, lo)) * 100).toFixed(2));
      const score = s.change24h * 1.6 + bounceFromLowPct * 1.2;
      return {
        symbol: s.symbol,
        name: s.name,
        price: s.price,
        change24hPct: s.change24h,
        bounceFromLowPct,
        score,
        reasonVi:
          s.change24h >= 1.5
            ? `Xanh ngược dòng +${s.change24h.toFixed(1)}% (Rút chân +${bounceFromLowPct}%)`
            : `Rút chân +${bounceFromLowPct}% từ đáy phiên • Giữ nền khỏe`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score: _score, ...rest }) => rest);

  // Compute Portfolio VN30F1M Beta Hedge Plan
  const vn30fSymbol = allSymbols.find((s) => isVnDerivativeSymbol(s.symbol));
  const vn30IndexSymbol = allSymbols.find((s) => s.symbol.toUpperCase() === 'VN30');
  const vn30f1mPrice = vn30fSymbol?.price || vn30IndexSymbol?.price || 1320;
  // 1 VN30F1M contract = price * 100,000 VND = price * 0.1 Million VND
  const contractMultiplierNotionalMillionVnd = Number((vn30f1mPrice * 0.1).toFixed(1));
  const marginPerContractMillionVnd = Number(
    (contractMultiplierNotionalMillionVnd * 0.17).toFixed(1)
  );

  let totalEquityValueMillionVnd = 0;
  let lockedT2EquityValueMillionVnd = 0;

  for (const key of Object.keys(userHoldingsMap)) {
    const h = userHoldingsMap[key];
    if (!h || h.quantity <= 0) continue;
    const symUp = h.symbol.toUpperCase();
    if (!isVnStockOrIndexSymbol(symUp) || isVnDerivativeSymbol(symUp)) continue;
    const liveSym = allSymbols.find((s) => s.symbol.toUpperCase() === symUp);
    const px = liveSym?.price || h.avgCostPrice;
    // Corporate VN stock price in 1,000 VND * shares / 1,000 = Million VND
    const valMillion = (px * h.quantity) / 1000;
    totalEquityValueMillionVnd += valMillion;
    if (h.holdingDays < 3) {
      lockedT2EquityValueMillionVnd += valMillion;
    }
  }

  const hasVnEquityExposure = totalEquityValueMillionVnd > 0;
  // If user hasn't entered holdings yet, simulate on a standard 500 Tr VND reference portfolio
  const effectivePortfolioMillion = hasVnEquityExposure
    ? Number(totalEquityValueMillionVnd.toFixed(1))
    : 500;
  const portfolioBeta = 1.1;
  const betaAdjustedExposure = effectivePortfolioMillion * portfolioBeta;

  const recommendedShortContractsFullHedge = Math.max(
    1,
    Math.round(betaAdjustedExposure / Math.max(1, contractMultiplierNotionalMillionVnd))
  );
  const recommendedShortContractsHalfHedge = Math.max(
    1,
    Math.round(recommendedShortContractsFullHedge * 0.5)
  );
  const requiredMarginMillionVnd = Number(
    (recommendedShortContractsHalfHedge * marginPerContractMillionVnd).toFixed(1)
  );

  const hedgeStopLossPoints = Number((vn30f1mPrice + 12.0).toFixed(1));
  const hedgeTargetPoints = Number((vn30f1mPrice - 26.0).toFixed(1));

  const hedgeSummaryVi = hasVnEquityExposure
    ? `Danh mục cơ sở VN đang nắm giữ ${effectivePortfolioMillion.toLocaleString('en-US')} Tr VNĐ${
        lockedT2EquityValueMillionVnd > 0
          ? ` (trong đó ${lockedT2EquityValueMillionVnd.toFixed(1)} Tr đang bị khóa T+2.5 chưa bán được)`
          : ''
      }: Mở lệnh Short ${recommendedShortContractsHalfHedge}–${recommendedShortContractsFullHedge} HĐ VN30F1M quanh ${vn30f1mPrice.toFixed(1)} đ (ký quỹ ~${requiredMarginMillionVnd} Tr VNĐ) để khóa rủi ro giảm giá cơ sở.`
    : `Ví dụ danh mục 500 Tr VNĐ cổ phiếu cơ sở bị kẹp T+2.5: Chỉ cần mở Short ${recommendedShortContractsHalfHedge}–${recommendedShortContractsFullHedge} HĐ VN30F1M quanh ${vn30f1mPrice.toFixed(1)} đ (vốn ký quỹ ~${requiredMarginMillionVnd} Tr VNĐ) để bù đắp thiệt hại khi thị trường chung bán tháo.`;

  return {
    ftdState,
    ftdBadgeVi,
    rallyAttemptDayCount,
    recentSwingLowPrice,
    reboundFromLowPct,
    ftdHeadlineVi,
    ftdGuidanceVi,
    firstMoverLeaders,
    betaHedgePlan: {
      hasVnEquityExposure,
      totalEquityValueMillionVnd: effectivePortfolioMillion,
      lockedT2EquityValueMillionVnd: Number(lockedT2EquityValueMillionVnd.toFixed(1)),
      vn30f1mPrice,
      contractMultiplierNotionalMillionVnd,
      marginPerContractMillionVnd,
      recommendedShortContractsFullHedge,
      recommendedShortContractsHalfHedge,
      requiredMarginMillionVnd,
      hedgeStopLossPoints,
      hedgeTargetPoints,
      hedgeSummaryVi,
    },
  };
}

// ============================================================================
// UNIFIED ORCHESTRATOR FOR ALL 6 VIETNAM TACTICAL ENGINES
// ============================================================================

export function evaluateVnComprehensiveTacticalReport(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  mtfCandlesMap?: Partial<Record<Timeframe, Candle[]>>;
  allSymbols: MarketSymbol[];
  vnInsights?: VnStockInsightsPayload | null;
  userHoldingsMap?: Record<string, UserHoldingItem>;
  bottomBudgetMillionVnd?: number;
  now?: Date;
}): VnComprehensiveTacticalReport {
  const {
    symbolObj,
    candles,
    mtfCandlesMap,
    allSymbols,
    vnInsights,
    userHoldingsMap = {},
    bottomBudgetMillionVnd = 100,
    now = new Date(),
  } = params;

  const orderFlow = computeVnActiveOrderFlow(candles, symbolObj, vnInsights?.liquidityAndPt);
  const priceLimits = computeVnPriceLimits({
    symbol: symbolObj.symbol,
    currentPrice: symbolObj.price,
    change24hPct: symbolObj.change24h,
    officialRefPrice: vnInsights?.fundamentals?.officialRefPrice,
    officialCeilingPrice: vnInsights?.fundamentals?.officialCeilingPrice,
    officialFloorPrice: vnInsights?.fundamentals?.officialFloorPrice,
  });

  const panicAndForceSell = evaluateVnPanicAndForceSellRadar({
    symbolObj,
    candles,
    mtfCandlesMap,
    allSymbols,
    orderFlow,
    now,
  });

  const bottomFishingPlan = computeVnBottomFishingLadder({
    symbolObj,
    candles,
    priceLimits,
    orderFlow,
    panicRadar: panicAndForceSell,
    budgetMillionVnd: bottomBudgetMillionVnd,
  });

  const t2CohortShock = evaluateVnT2CohortSupplyShock({
    symbolObj,
    candles,
    mtfCandlesMap,
    now,
  });

  const atcDistortion = evaluateVnAtcDistortionShield({
    symbolObj,
    candles,
    orderFlow,
    vnInsights,
    now,
  });

  const capitulationMeter = evaluateVnCapitulationCycleMeter({
    symbolObj,
    candles,
    panicRadar: panicAndForceSell,
    bottomPlan: bottomFishingPlan,
  });

  const postCrashAndHedge = evaluateVnPostCrashFtdAndBetaHedge({
    symbolObj,
    candles,
    mtfCandlesMap,
    allSymbols,
    userHoldingsMap,
    panicRadar: panicAndForceSell,
  });

  const spotDailyCash = evaluateVnDailySpotTradingReport({
    symbolObj,
    allSymbols,
    candles,
    vnInsights,
    userHoldingsMap,
    totalSpotCapitalMillionVnd: Math.max(90, bottomBudgetMillionVnd * 1.5),
    now,
  });

  return {
    symbol: symbolObj.symbol.toUpperCase(),
    panicAndForceSell,
    bottomFishingPlan,
    t2CohortShock,
    atcDistortion,
    capitulationMeter,
    postCrashAndHedge,
    spotDailyCash,
  };
}
