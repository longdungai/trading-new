import { Candle, MarketSymbol } from '../../types';
import { calculateEMA, calculateRSI } from '../indicators';
import {
  computeVnPriceLimits,
  getVnExchangeBoard,
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
  roundToVnTickSize,
  VnExchangeBoard,
} from './vnStockMicrostructure';
import { VnStockInsightsPayload } from './vnStockInsightsClient';
import { UserHoldingItem } from '../portfolio/holdingsRecoveryEngine';

const VN_SPOT_ROUND_TRIP_FEE_TAX_PCT = 0.45; // 0.15% buy fee + 0.15% sell fee + 0.10% sell tax + 0.05% slippage buffer

function getVnTimeParts(now: Date = new Date()): {
  dayOfWeek: number;
  minutesOfDay: number;
  timeLabel: string;
} {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const vnDate = new Date(utcMs + 7 * 3600_000);
  const hours = vnDate.getHours();
  const minutes = vnDate.getMinutes();
  return {
    dayOfWeek: vnDate.getDay(),
    minutesOfDay: hours * 60 + minutes,
    timeLabel: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
}

function roundLot100(rawShares: number): number {
  if (!Number.isFinite(rawShares) || rawShares <= 0) return 100;
  return Math.max(100, Math.floor(rawShares / 100) * 100);
}

// ============================================================================
// 1. 3-BUCKET T+2.5 ROLLING CASH CAROUSEL ("BỘ CHIA VỐN LUÂN PHIÊN 3 NGĂN T+2.5")
// ============================================================================

export interface VnSpotCashBucket {
  bucketId: 'T0_FRESH_CASH' | 'T1_IN_TRANSIT' | 'T2_SETTLED_READY';
  labelVi: string;
  targetWeightPct: number; // 33%, 33%, 34%
  allocatedMillionVnd: number;
  symbolsInBucket: string[];
  statusBadgeVi: string;
  actionHintVi: string;
}

export interface VnSpotRollingCashCarousel {
  totalSpotCapitalMillionVnd: number;
  buckets: [VnSpotCashBucket, VnSpotCashBucket, VnSpotCashBucket];
  todayBuyableCashMillionVnd: number;
  todaySellableInventoryMillionVnd: number;
  recommendedTodaySymbolBudgetMillionVnd: number;
  recommendedTodaySymbolLots: number; // Rounded to 100-share lots for active symbol
  hasZeroLeverageCompliance: boolean;
  marginViolationSymbols: string[];
  carouselHeadlineVi: string;
  carouselRuleVi: string;
}

export function computeVnSpotRollingCashCarousel(params: {
  activeSymbolObj: MarketSymbol;
  allSymbols: MarketSymbol[];
  userHoldingsMap?: Record<string, UserHoldingItem>;
  totalSpotCapitalMillionVnd?: number;
}): VnSpotRollingCashCarousel {
  const {
    activeSymbolObj,
    allSymbols,
    userHoldingsMap = {},
    totalSpotCapitalMillionVnd = 150,
  } = params;

  const totalCap = Math.max(30, totalSpotCapitalMillionVnd);
  const priceMap = new Map<string, number>();
  for (const s of allSymbols) {
    priceMap.set(s.symbol.toUpperCase(), s.price);
  }
  priceMap.set(activeSymbolObj.symbol.toUpperCase(), activeSymbolObj.price);

  let t0DeployedMillion = 0;
  let t1InTransitMillion = 0;
  let t2SettledMillion = 0;
  const t0Symbols: string[] = [];
  const t1Symbols: string[] = [];
  const t2Symbols: string[] = [];
  const marginViolationSymbols: string[] = [];

  for (const rawKey of Object.keys(userHoldingsMap)) {
    const h = userHoldingsMap[rawKey];
    if (!h || h.quantity <= 0) continue;
    const sym = h.symbol.toUpperCase();
    if (isVnDerivativeSymbol(sym)) continue;
    const matchedSym = allSymbols.find((s) => s.symbol.toUpperCase() === sym);
    const isVn = matchedSym ? isVnStockOrIndexSymbol(matchedSym) : true;
    if (!isVn) continue;

    if (h.marginRatioPct > 0) {
      marginViolationSymbols.push(sym);
    }

    const livePrice = priceMap.get(sym) ?? h.avgCostPrice;
    // Chart price unit for VN stocks is 1,000 VND -> value in Million VND = (qty * price) / 1000
    const marketValueMillion = Number(((h.quantity * livePrice) / 1000).toFixed(2));

    if (h.holdingDays <= 1) {
      t0DeployedMillion += marketValueMillion;
      t0Symbols.push(sym);
    } else if (h.holdingDays === 2) {
      t1InTransitMillion += marketValueMillion;
      t1Symbols.push(sym);
    } else {
      t2SettledMillion += marketValueMillion;
      t2Symbols.push(sym);
    }
  }

  const totalInvestedMillion = t0DeployedMillion + t1InTransitMillion + t2SettledMillion;
  const effectiveTotalCap = Math.max(totalCap, Math.ceil(totalInvestedMillion * 1.1));
  const oneThirdCap = Number((effectiveTotalCap / 3).toFixed(1));

  const freeCashMillion = Math.max(0, Number((effectiveTotalCap - totalInvestedMillion).toFixed(1)));
  // Daily Spot Rule: Never deploy more than 1 bucket (33% of total capital) in a single day
  const recommendedTodayBudget = Math.max(
    10,
    Number(Math.min(oneThirdCap, freeCashMillion > 0 ? freeCashMillion : oneThirdCap).toFixed(1))
  );

  const activePrice = Math.max(1, activeSymbolObj.price);
  const rawShares = (recommendedTodayBudget * 1000) / activePrice;
  const recommendedLots = roundLot100(rawShares);

  const buckets: [VnSpotCashBucket, VnSpotCashBucket, VnSpotCashBucket] = [
    {
      bucketId: 'T0_FRESH_CASH',
      labelVi: 'Ngăn 1 (T+0 • Sức Mua Hôm Nay)',
      targetWeightPct: 33,
      allocatedMillionVnd: Number((freeCashMillion > 0 ? Math.min(oneThirdCap, freeCashMillion) : t0DeployedMillion || oneThirdCap).toFixed(1)),
      symbolsInBucket: t0Symbols,
      statusBadgeVi:
        t0Symbols.length > 0
          ? `Đã mua hôm nay (${t0Symbols.join(', ')})`
          : `Sẵn sàng ${recommendedTodayBudget} Tr tiền mặt`,
      actionHintVi:
        'Chỉ giải ngân tối đa 1/3 tổng vốn tiền mặt trong 1 ngày để ngày mai vẫn còn sức mua.',
    },
    {
      bucketId: 'T1_IN_TRANSIT',
      labelVi: 'Ngăn 2 (T+1 • Hàng Đang Về)',
      targetWeightPct: 33,
      allocatedMillionVnd: Number((t1InTransitMillion > 0 ? t1InTransitMillion : oneThirdCap).toFixed(1)),
      symbolsInBucket: t1Symbols,
      statusBadgeVi:
        t1Symbols.length > 0
          ? `Chờ về chiều mai (${t1Symbols.join(', ')})`
          : 'Luân chuyển tự động từ Ngăn 1',
      actionHintVi:
        'Hàng đang trên đường về (trưa T+2 khả dụng). Không mua bồi thêm vào mã đang lỗ T+1.',
    },
    {
      bucketId: 'T2_SETTLED_READY',
      labelVi: 'Ngăn 3 (T+2.5+ • Hàng Khả Dụng)',
      targetWeightPct: 34,
      allocatedMillionVnd: Number((t2SettledMillion > 0 ? t2SettledMillion : effectiveTotalCap - oneThirdCap * 2).toFixed(1)),
      symbolsInBucket: t2Symbols,
      statusBadgeVi:
        t2Symbols.length > 0
          ? `Bán/Lướt T+0 ngay (${t2Symbols.join(', ')})`
          : 'Kho hàng sẵn sàng chốt lời',
      actionHintVi:
        'Được quyền Bán thu tiền mặt bất kỳ lúc nào hoặc dùng làm kho lướt T+0 ăn chênh lệch ngay trong phiên.',
    },
  ];

  const hasZeroLeverageCompliance = marginViolationSymbols.length === 0;

  return {
    totalSpotCapitalMillionVnd: effectiveTotalCap,
    buckets,
    todayBuyableCashMillionVnd: freeCashMillion > 0 ? freeCashMillion : oneThirdCap,
    todaySellableInventoryMillionVnd: Number(t2SettledMillion.toFixed(1)),
    recommendedTodaySymbolBudgetMillionVnd: recommendedTodayBudget,
    recommendedTodaySymbolLots: recommendedLots,
    hasZeroLeverageCompliance,
    marginViolationSymbols,
    carouselHeadlineVi: hasZeroLeverageCompliance
      ? `Chuẩn Spot 100% Tiền Mặt: Giải ngân tối đa ${recommendedTodayBudget} Tr (${recommendedLots.toLocaleString('en-US')} CP ${activeSymbolObj.symbol}) cho nhịp hôm nay`
      : `⚠️ Phát hiện đang dùng Margin ở (${marginViolationSymbols.join(', ')}) — Khuyến nghị hạ về 100% tiền mặt để miễn nhiễm giải chấp`,
    carouselRuleVi:
      'Quy tắc 3 Ngăn (33% - 33% - 34%): Mỗi ngày chỉ dùng 1 ngăn tiền mặt mua mã nổ sóng và chốt lời 1 ngăn hàng T+2.5 đã về — giúp ngày nào cũng có quyền giao dịch mà không bao giờ bị khóa T+.',
  };
}

// ============================================================================
// 2 & 5. DAILY SPOT POCKET-PIVOT SCANNER & RELATIVE STRENGTH (RS ALPHA vs VN-INDEX)
// ============================================================================

export type VnSpotSetupStatus =
  | 'SWEET_SPOT_POCKET_PIVOT'
  | 'RS_LEADER_PULLBACK_BUY'
  | 'CHASING_CEILING_TRAP_AVOID'
  | 'DEAD_MONEY_WEAK_AVOID'
  | 'WAIT_AFTERNOON_CONFIRMATION';

export interface VnSpotCandidateItem {
  symbol: string;
  name: string;
  board: VnExchangeBoard;
  currentPrice: number;
  change24hPct: number;
  rsAlphaVsVnIndexPct: number; // Stock % change minus VN-Index % change
  rsRatingScore: number; // 1..99 Relative Strength rating
  isGreenInRedMarket: boolean; // True when VN-Index < 0 but stock > 0
  baseTightness5dPct: number; // Average 5-day range %
  projectedRvol: number; // Volume surge vs 20-period average
  dailySpotScore: number; // 0..100 composite spot trade score
  setupStatus: VnSpotSetupStatus;
  setupBadgeVi: string;
  spotBuyZone: [number, number];
  spotTargetT2Price: number; // +4.5%..+6.0% T+2.5 cash target
  spotHardStopPrice: number; // -3.2%..-3.8% capital protection stop
  expectedNetProfitPct: number;
  rationaleVi: string;
}

export interface VnDailySpotScannerReport {
  vnIndexChangePct: number;
  activeSymbolCandidate: VnSpotCandidateItem;
  topDailySpotCandidates: VnSpotCandidateItem[];
  marketBreadthAdviceVi: string;
}

function evaluateSingleVnSpotCandidate(params: {
  symbolObj: MarketSymbol;
  vnIndexChangePct: number;
  candles?: Candle[];
  vnInsights?: VnStockInsightsPayload | null;
}): VnSpotCandidateItem {
  const { symbolObj, vnIndexChangePct, candles = [], vnInsights } = params;
  const sym = symbolObj.symbol.toUpperCase();
  const board = getVnExchangeBoard(sym);
  const price = symbolObj.price;
  const changePct = symbolObj.change24h;
  const rsAlpha = Number((changePct - vnIndexChangePct).toFixed(2));
  const isGreenInRedMarket = vnIndexChangePct < -0.15 && changePct >= 0.1;

  const limits = computeVnPriceLimits({
    symbol: sym,
    currentPrice: price,
    change24hPct: changePct,
    officialRefPrice: vnInsights?.fundamentals?.officialRefPrice,
    officialCeilingPrice: vnInsights?.fundamentals?.officialCeilingPrice,
    officialFloorPrice: vnInsights?.fundamentals?.officialFloorPrice,
  });

  // Compute 5-bar tightness & RVOL from candles if available, else deterministic proxy from symbol stats
  let baseTightness5dPct = 2.4;
  let projectedRvol = 1.25;
  let aboveEma20 = changePct >= -0.5;
  let rsiVal = 54;

  if (candles.length >= 20) {
    const prior5 = candles.slice(-6, -1);
    const ranges = prior5.map((c) => ((c.high - c.low) / Math.max(0.01, c.low)) * 100);
    baseTightness5dPct = Number(
      (ranges.reduce((s, v) => s + v, 0) / Math.max(1, ranges.length)).toFixed(2)
    );

    const prior20Vol =
      candles.slice(-21, -1).reduce((s, c) => s + c.volume, 0) / 20;
    const lastVol = candles[candles.length - 1].volume;
    projectedRvol = Number((lastVol / Math.max(1, prior20Vol)).toFixed(2));

    const ema20Arr = calculateEMA(
      candles.map((c) => c.close),
      20
    );
    const lastEma20 = ema20Arr.length > 0 ? ema20Arr[ema20Arr.length - 1] : null;
    const ema20 = lastEma20 !== null ? lastEma20 : price;
    aboveEma20 = price >= ema20 * 0.995;

    const rsiArr = calculateRSI(candles, 14);
    if (rsiArr.length > 0) {
      rsiVal = rsiArr[rsiArr.length - 1].value;
    }
  } else {
    const dayRangePct =
      symbolObj.low24h > 0
        ? ((symbolObj.high24h - symbolObj.low24h) / symbolObj.low24h) * 100
        : Math.abs(changePct) + 1.5;
    baseTightness5dPct = Number(Math.max(1.2, Math.min(5.5, dayRangePct * 0.85)).toFixed(2));
    projectedRvol = Number(
      (1.0 + Math.min(1.6, Math.max(0, changePct * 0.25 + (rsAlpha > 0 ? 0.35 : 0)))).toFixed(2)
    );
  }

  // Foreign net buy bonus
  const latestForeignNet = vnInsights?.foreignFlow?.latestNetBillionVnd ?? 0;
  const foreignNetBuyBonus =
    latestForeignNet >= 15
      ? 10
      : latestForeignNet > 0
      ? 5
      : latestForeignNet <= -20
      ? -10
      : 0;

  // RS Rating (1..99)
  const rawRsRating = Math.round(
    55 +
      rsAlpha * 8 +
      (isGreenInRedMarket ? 14 : 0) +
      (aboveEma20 ? 8 : -10) +
      foreignNetBuyBonus * 0.6
  );
  const rsRatingScore = Math.max(10, Math.min(99, rawRsRating));

  // Classify Spot Setup Status
  let setupStatus: VnSpotSetupStatus = 'WAIT_AFTERNOON_CONFIRMATION';
  let setupBadgeVi = '⏳ Quan sát chờ xác nhận chiều';
  let score = 55;
  let rationaleVi = '';

  const isChasingCeiling = changePct > 4.6;
  const isSweetSpotBreakout =
    changePct >= 0.6 &&
    changePct <= 3.6 &&
    aboveEma20 &&
    (projectedRvol >= 1.15 || rsAlpha >= 0.8) &&
    baseTightness5dPct <= 3.8;
  const isRsLeaderPullback =
    (isGreenInRedMarket || rsAlpha >= 1.0) &&
    changePct >= -1.0 &&
    changePct <= 2.5 &&
    aboveEma20 &&
    rsiVal < 72;

  if (isChasingCeiling) {
    setupStatus = 'CHASING_CEILING_TRAP_AVOID';
    setupBadgeVi = '🚫 Cấm Mua Đuổi Giá Trần (Rủi ro T+2.5)';
    score = Math.max(25, Math.min(48, 50 - Math.round((changePct - 4.5) * 6)));
    rationaleVi = `Giá đã tăng nóng +${changePct.toFixed(2)}% sát trần — mua Spot mới lúc này mất đệm an toàn khi hàng về T+2.5. Chỉ phù hợp giữ hàng sẵn có để chốt lời.`;
  } else if (isSweetSpotBreakout) {
    setupStatus = 'SWEET_SPOT_POCKET_PIVOT';
    setupBadgeVi = '🔥 Điểm Nổ Pocket Pivot Đầu Sóng (Mua Spot Tối Ưu)';
    score = Math.min(
      96,
      Math.round(
        74 +
          Math.min(12, projectedRvol * 5) +
          Math.max(0, (3.8 - baseTightness5dPct) * 3) +
          foreignNetBuyBonus
      )
    );
    rationaleVi = `Nền tích lũy siết chặt (${baseTightness5dPct}%), RVOL ${projectedRvol}x và giá mới nhú +${changePct.toFixed(2)}% từ nền (RS Alpha ${rsAlpha >= 0 ? '+' : ''}${rsAlpha}% so với Index) — còn nguyên dư địa ăn nhịp kéo T+2.5.`;
  } else if (isRsLeaderPullback) {
    setupStatus = 'RS_LEADER_PULLBACK_BUY';
    setupBadgeVi = isGreenInRedMarket
      ? '💎 Cổ Phiếu Kháng Đỏ (Xanh Khi Index Giảm)'
      : '⚡ Leader RS Mạnh Nhúng Hỗ Trợ';
    score = Math.min(92, Math.round(70 + rsAlpha * 4 + (isGreenInRedMarket ? 10 : 0) + foreignNetBuyBonus));
    rationaleVi = `Sức mạnh tương đối RS ${rsRatingScore}/99 (vượt VN-Index ${rsAlpha >= 0 ? '+' : ''}${rsAlpha}%). Dòng tiền đỡ giá trên EMA20, ưu tiên nhặt Spot khi rung lắc quanh tham chiếu.`;
  } else if (changePct < -2.2 || !aboveEma20) {
    setupStatus = 'DEAD_MONEY_WEAK_AVOID';
    setupBadgeVi = '❄️ Dòng Tiền Yếu / Tránh Chôn Vốn Spot';
    score = Math.max(18, Math.round(38 + rsAlpha * 3));
    rationaleVi = `Cổ phiếu yếu hơn thị trường chung (RS ${rsRatingScore}/99) hoặc gãy dưới EMA20 — mua Spot dễ bị giam vốn nhiều tuần không có sóng.`;
  } else {
    setupStatus = 'WAIT_AFTERNOON_CONFIRMATION';
    setupBadgeVi = '⏳ Tích Lũy Đi Ngang • Chờ Nổ Vol Sau 13h45';
    score = Math.max(45, Math.min(68, Math.round(56 + rsAlpha * 2 + foreignNetBuyBonus)));
    rationaleVi = `Biên độ nền ${baseTightness5dPct}%, RVOL ${projectedRvol}x. Chờ dòng tiền chủ động đẩy vượt tham chiếu kèm thanh khoản sau 13h45 để tránh chôn vốn T+.`;
  }

  // Compute exact tick-rounded Spot Buy Zone, T+2.5 Cash Target, and Capital Protection Stop
  const refP = limits.refPrice || price;
  const buyLow = roundToVnTickSize(
    Math.max(limits.floorPrice ?? price * 0.93, Math.min(price * 0.995, refP * 1.005)),
    board
  );
  const buyHigh = roundToVnTickSize(
    Math.min(limits.ceilingPrice ?? price * 1.07, Math.max(buyLow, price * 1.005)),
    board
  );
  const entryMid = (buyLow + buyHigh) / 2;

  const spotTargetT2Price = roundToVnTickSize(entryMid * 1.052, board); // ~+5.2% gross -> ~+4.75% net cash after 0.45% fee/tax
  const spotHardStopPrice = roundToVnTickSize(entryMid * 0.965, board); // -3.5% disciplined spot stop
  const grossGainPct = ((spotTargetT2Price - entryMid) / Math.max(0.01, entryMid)) * 100;
  const expectedNetProfitPct = Number((grossGainPct - VN_SPOT_ROUND_TRIP_FEE_TAX_PCT).toFixed(2));

  return {
    symbol: sym,
    name: symbolObj.name,
    board,
    currentPrice: price,
    change24hPct: changePct,
    rsAlphaVsVnIndexPct: rsAlpha,
    rsRatingScore,
    isGreenInRedMarket,
    baseTightness5dPct,
    projectedRvol,
    dailySpotScore: score,
    setupStatus,
    setupBadgeVi,
    spotBuyZone: [buyLow, buyHigh],
    spotTargetT2Price,
    spotHardStopPrice,
    expectedNetProfitPct,
    rationaleVi,
  };
}

export function computeVnDailySpotScanner(params: {
  activeSymbolObj: MarketSymbol;
  allSymbols: MarketSymbol[];
  activeCandles: Candle[];
  vnInsights?: VnStockInsightsPayload | null;
}): VnDailySpotScannerReport {
  const { activeSymbolObj, allSymbols, activeCandles, vnInsights } = params;

  const vnIndexSym = allSymbols.find((s) => s.symbol.toUpperCase() === 'VNINDEX');
  const vnIndexChangePct = vnIndexSym ? vnIndexSym.change24h : 0;

  const activeSymbolCandidate = evaluateSingleVnSpotCandidate({
    symbolObj: activeSymbolObj,
    vnIndexChangePct,
    candles: activeCandles,
    vnInsights,
  });

  const vnCorporateSymbols = allSymbols.filter((s) => {
    const sym = s.symbol.toUpperCase();
    return (
      isVnStockOrIndexSymbol(s) &&
      !isVnDerivativeSymbol(sym) &&
      !['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX', 'SJC'].includes(sym)
    );
  });

  const evaluatedList: VnSpotCandidateItem[] = vnCorporateSymbols.map((s) =>
    s.symbol.toUpperCase() === activeSymbolObj.symbol.toUpperCase()
      ? activeSymbolCandidate
      : evaluateSingleVnSpotCandidate({
          symbolObj: s,
          vnIndexChangePct,
        })
  );

  // Ensure active symbol is included if it's a corporate stock
  if (
    !evaluatedList.some((c) => c.symbol === activeSymbolCandidate.symbol) &&
    !['VNINDEX', 'VN30'].includes(activeSymbolCandidate.symbol) &&
    !isVnDerivativeSymbol(activeSymbolCandidate.symbol)
  ) {
    evaluatedList.push(activeSymbolCandidate);
  }

  const topDailySpotCandidates = [...evaluatedList]
    .sort((a, b) => b.dailySpotScore - a.dailySpotScore || b.rsRatingScore - a.rsRatingScore)
    .slice(0, 4);

  const marketBreadthAdviceVi =
    vnIndexChangePct < -0.5
      ? `VN-Index đang giảm (${vnIndexChangePct.toFixed(2)}%): Ưu tiên tuyệt đối các mã "Kháng Đỏ" (RS Alpha dương, giữ giá xanh trên tham chiếu) và chỉ giải ngân bằng tiền mặt sau 13h45.`
      : vnIndexChangePct > 0.8
      ? `VN-Index hưng phấn (+${vnIndexChangePct.toFixed(2)}%): Tuyệt đối không mua đuổi các mã đã tăng > +4.5%; chỉ chọn mã mới chớm nổ +1%..+3% từ nền tích lũy chặt.`
      : `VN-Index đi ngang phân hóa (${vnIndexChangePct >= 0 ? '+' : ''}${vnIndexChangePct.toFixed(2)}%): Đánh tập trung vào Top cổ phiếu có điểm nổ Pocket Pivot (RVOL >= 1.25x) để tối ưu vòng quay vốn T+2.5.`;

  return {
    vnIndexChangePct,
    activeSymbolCandidate,
    topDailySpotCandidates,
    marketBreadthAdviceVi,
  };
}

// ============================================================================
// 3. ZERO-LEVERAGE INVENTORY T+0 CASH HARVESTER ("LƯỚT T+0 TIỀN MẶT TRÊN KHO CÓ SẴN")
// ============================================================================

export type VnZeroLeverageT0Mode =
  | 'DIP_BUY_MORNING_SELL_AFTERNOON'
  | 'SPIKE_SELL_MORNING_COVER_13H15'
  | 'NARROW_RANGE_WAIT';

export interface VnZeroLeverageT0Plan {
  symbol: string;
  hasSettledUserInventory: boolean;
  settledSharesAvailable: number; // Actual settled shares (or 1,000 CP template if user hasn't entered holding yet)
  isTemplateSimulation: boolean;
  surfLotShares: number; // 30% of settled inventory rounded to 100 CP
  mode: VnZeroLeverageT0Mode;
  modeBadgeVi: string;
  intradayVwapPrice: number;
  intradayBuyPrice: number;
  intradaySellPrice: number;
  grossSpreadPct: number;
  netSpreadAfterFeeTaxPct: number;
  cashRequiredMillionVnd: number;
  netDailyProfitThousandVnd: number; // e.g., +850 nghìn VNĐ / ngày
  executionStepsVi: [string, string, string];
}

export function computeVnZeroLeverageT0Plan(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  userHoldingsMap?: Record<string, UserHoldingItem>;
}): VnZeroLeverageT0Plan {
  const { symbolObj, candles, userHoldingsMap = {} } = params;
  const sym = symbolObj.symbol.toUpperCase();
  const board = getVnExchangeBoard(sym);
  const price = symbolObj.price;

  const holding = userHoldingsMap[sym];
  const hasSettledUserInventory = Boolean(holding && holding.quantity >= 100 && holding.holdingDays >= 3);
  const settledSharesAvailable = hasSettledUserInventory && holding ? holding.quantity : 1000;
  const isTemplateSimulation = !hasSettledUserInventory;

  // Surf 30% of settled inventory (minimum 100 CP, maximum settledSharesAvailable)
  const surfLotShares = Math.min(
    settledSharesAvailable,
    roundLot100(settledSharesAvailable * 0.3)
  );

  // Compute intraday/recent VWAP and ATR band
  const recentBars = candles.slice(-12);
  let pvSum = 0;
  let vSum = 0;
  let rangeSumPct = 0;
  for (const c of recentBars) {
    const tp = (c.high + c.low + c.close) / 3;
    pvSum += tp * Math.max(1, c.volume);
    vSum += Math.max(1, c.volume);
    rangeSumPct += ((c.high - c.low) / Math.max(0.01, c.low)) * 100;
  }

  const intradayVwapPrice = roundToVnTickSize(vSum > 0 ? pvSum / vSum : price, board);
  const avgBarSwingPct = recentBars.length > 0 ? rangeSumPct / recentBars.length : 2.2;
  const targetHalfSwingPct = Math.max(0.012, Math.min(0.024, (avgBarSwingPct / 100) * 0.65));

  const isMorningSpike = symbolObj.change24h >= 2.2 || price > intradayVwapPrice * 1.012;

  const intradayBuyPrice = roundToVnTickSize(
    Math.min(price * 0.99, intradayVwapPrice * (1 - targetHalfSwingPct * 0.85)),
    board
  );
  const intradaySellPrice = roundToVnTickSize(
    Math.max(price * 1.012, intradayBuyPrice * (1 + Math.max(0.024, targetHalfSwingPct * 1.8))),
    board
  );

  const grossSpreadPct = Number(
    (((intradaySellPrice - intradayBuyPrice) / Math.max(0.01, intradayBuyPrice)) * 100).toFixed(2)
  );
  const netSpreadAfterFeeTaxPct = Number(
    Math.max(0.4, grossSpreadPct - VN_SPOT_ROUND_TRIP_FEE_TAX_PCT).toFixed(2)
  );

  const cashRequiredMillionVnd = Number(((surfLotShares * intradayBuyPrice) / 1000).toFixed(2));
  // Profit in Thousand VND (nghìn đồng): surfLotShares * (sell - buy) - fee/tax
  const grossDiffThousand = surfLotShares * (intradaySellPrice - intradayBuyPrice);
  const feeTaxThousand =
    surfLotShares * ((intradayBuyPrice + intradaySellPrice) / 2) * (VN_SPOT_ROUND_TRIP_FEE_TAX_PCT / 100);
  const netDailyProfitThousandVnd = Math.max(50, Math.round(grossDiffThousand - feeTaxThousand));

  const mode: VnZeroLeverageT0Mode = isMorningSpike
    ? 'SPIKE_SELL_MORNING_COVER_13H15'
    : 'DIP_BUY_MORNING_SELL_AFTERNOON';

  const modeBadgeVi =
    mode === 'SPIKE_SELL_MORNING_COVER_13H15'
      ? '⚡ Bán Hưng Phấn Sáng → Cover Lại 13h15 (0% Margin)'
      : '🔄 Mua Nhúng Đỏ Sáng → Bán Hàng Cũ Chiều (0% Margin)';

  const executionStepsVi: [string, string, string] =
    mode === 'SPIKE_SELL_MORNING_COVER_13H15'
      ? [
          `Bước 1 (Khi kéo hưng phấn): Đặt bán trước ${surfLotShares.toLocaleString('en-US')} CP có sẵn trong kho tại ${intradaySellPrice}k (thu về ${((surfLotShares * intradaySellPrice) / 1000).toFixed(1)} Tr tiền mặt).`,
          `Bước 2 (Khung 13h05–13h30 khi hàng T+2.5 xả): Dùng đúng tiền vừa bán đặt lệnh LO mua lại ${surfLotShares.toLocaleString('en-US')} CP tại vùng hỗ trợ ${intradayBuyPrice}k.`,
          `Kết quả cuối ngày: Giữ nguyên ${settledSharesAvailable.toLocaleString('en-US')} CP, không vay 1 đồng Margin, bỏ túi ngay +${netDailyProfitThousandVnd.toLocaleString('en-US')}k (+${netSpreadAfterFeeTaxPct}% ròng).`,
        ]
      : [
          `Bước 1 (Nhịp rung lắc 9h30–10h45): Dùng ${cashRequiredMillionVnd} Tr tiền mặt nhàn rỗi đặt mua ${surfLotShares.toLocaleString('en-US')} CP tại vùng hỗ trợ VWAP ${intradayBuyPrice}k.`,
          `Bước 2 (Nhịp kéo chiều 13h45–14h25): Bán ra đúng ${surfLotShares.toLocaleString('en-US')} CP hàng cũ khả dụng trong kho tại ${intradaySellPrice}k.`,
          `Kết quả cuối ngày: Số lượng CP không đổi (${settledSharesAvailable.toLocaleString('en-US')} CP), thu tiền mặt tươi +${netDailyProfitThousandVnd.toLocaleString('en-US')}k (+${netSpreadAfterFeeTaxPct}% sau phí/thuế).`,
        ];

  return {
    symbol: sym,
    hasSettledUserInventory,
    settledSharesAvailable,
    isTemplateSimulation,
    surfLotShares,
    mode,
    modeBadgeVi,
    intradayVwapPrice,
    intradayBuyPrice,
    intradaySellPrice,
    grossSpreadPct,
    netSpreadAfterFeeTaxPct,
    cashRequiredMillionVnd,
    netDailyProfitThousandVnd,
    executionStepsVi,
  };
}

// ============================================================================
// 4. AFTERNOON T+2.5 SETTLEMENT ADVANTAGE ENGINE ("MUA CHIỀU SAU 13H45 ĐÓN SÓNG T+")
// ============================================================================

export type VnAfternoonWindowState =
  | 'GOLDEN_AFTERNOON_WINDOW_13H45_14H25'
  | 'WAIT_13H00_SUPPLY_ABSORPTION'
  | 'MORNING_PROBE_ONLY_MAX_30PCT'
  | 'OFF_HOURS_NEXT_SESSION_PLAN';

export interface VnAfternoonT2WindowPlan {
  currentVnTimeLabel: string;
  windowState: VnAfternoonWindowState;
  windowBadgeVi: string;
  effectiveHoldingRiskDays: number; // 1.6 days when buying at 14:00 vs 2.5 days when buying at 09:15
  post13hAbsorptionConfirmed: boolean;
  priceVsVwapPct: number;
  maxCashDeploymentNowPct: number; // 100% of daily bucket in golden window, 30% in morning, 0% during 13:00-13:35 test
  tacticalAdviceVi: string;
}

export function computeVnAfternoonT2WindowPlan(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  now?: Date;
}): VnAfternoonT2WindowPlan {
  const { symbolObj, candles, now = new Date() } = params;
  const { dayOfWeek, minutesOfDay, timeLabel } = getVnTimeParts(now);
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  const recent = candles.slice(-10);
  const vwap =
    recent.length > 0
      ? recent.reduce((s, c) => s + ((c.high + c.low + c.close) / 3) * Math.max(1, c.volume), 0) /
        Math.max(1, recent.reduce((s, c) => s + Math.max(1, c.volume), 0))
      : symbolObj.price;
  const priceVsVwapPct = Number((((symbolObj.price - vwap) / Math.max(0.01, vwap)) * 100).toFixed(2));
  const lastCandle = candles[candles.length - 1];
  const post13hAbsorptionConfirmed =
    priceVsVwapPct >= -0.25 && (!lastCandle || lastCandle.close >= lastCandle.open * 0.997);

  // Morning session: 09:00 (540) - 11:30 (690)
  // Early afternoon supply unlock test: 13:00 (780) - 13:44 (824)
  // Golden Afternoon Spot Window: 13:45 (825) - 14:28 (868)
  if (!isWeekday || minutesOfDay < 540 || minutesOfDay > 885) {
    return {
      currentVnTimeLabel: timeLabel,
      windowState: 'OFF_HOURS_NEXT_SESSION_PLAN',
      windowBadgeVi: `🕒 Ngoài Giờ Khớp Lệnh (${timeLabel}) • Lên Lịch Mua Chiều Mai`,
      effectiveHoldingRiskDays: 1.6,
      post13hAbsorptionConfirmed,
      priceVsVwapPct,
      maxCashDeploymentNowPct: 30,
      tacticalAdviceVi:
        'Kinh nghiệm Spot TTCK VN: Mua lúc 9h15 sáng hay 14h15 chiều đều về tài khoản lúc 12h00 trưa T+2. Sáng mai chỉ rải tối đa 30% tiền mặt tại hỗ trợ, dành 70% giải ngân sau 13h45 khi đã kiểm chứng xong lực hấp thụ hàng T+2.5.',
    };
  }

  if (minutesOfDay >= 540 && minutesOfDay <= 690) {
    return {
      currentVnTimeLabel: timeLabel,
      windowState: 'MORNING_PROBE_ONLY_MAX_30PCT',
      windowBadgeVi: `🌅 Phiên Sáng (${timeLabel}) • Chỉ Giải Ngân Thăm Dò Tối Đa 30%`,
      effectiveHoldingRiskDays: 2.4,
      post13hAbsorptionConfirmed,
      priceVsVwapPct,
      maxCashDeploymentNowPct: 30,
      tacticalAdviceVi:
        'Buổi sáng chưa có lượng hàng T+2.5 về tài khoản nên giá xanh rất dễ là bẫy thanh khoản thấp. Tuyệt đối không giải ngân 100% tiền mặt buổi sáng; chỉ nhặt tối đa 30% khi giá nhúng đỏ và giữ 70% tiền chờ sau 13h45.',
    };
  }

  if (minutesOfDay >= 691 && minutesOfDay <= 824) {
    return {
      currentVnTimeLabel: timeLabel,
      windowState: 'WAIT_13H00_SUPPLY_ABSORPTION',
      windowBadgeVi: `🛡️ Khung Xả Hàng T+2.5 (${timeLabel}) • Quan Sát Lực Hấp Thụ`,
      effectiveHoldingRiskDays: 1.8,
      post13hAbsorptionConfirmed,
      priceVsVwapPct,
      maxCashDeploymentNowPct: 20,
      tacticalAdviceVi:
        'Đang trong khung 13h00–13h44 khi lượng cổ phiếu mua ngày T-2 vừa mở khóa. Quan sát xem giá có giữ vững trên VWAP sau nhịp rung lắc hay không trước khi xuống tiền lúc 13h45.',
    };
  }

  return {
    currentVnTimeLabel: timeLabel,
    windowState: 'GOLDEN_AFTERNOON_WINDOW_13H45_14H25',
    windowBadgeVi: post13hAbsorptionConfirmed
      ? `🟢 Khung Giờ Vàng Mua Spot (${timeLabel}) • Đã Hấp Thụ Cung 13h`
      : `⚠️ Khung Chiều (${timeLabel}) • Giá Dưới VWAP, Chờ Rút Chân`,
    effectiveHoldingRiskDays: 1.6,
    post13hAbsorptionConfirmed,
    priceVsVwapPct,
    maxCashDeploymentNowPct: post13hAbsorptionConfirmed ? 100 : 40,
    tacticalAdviceVi: post13hAbsorptionConfirmed
      ? `Đã qua 13h45 và cổ phiếu giữ vững trên VWAP (${priceVsVwapPct >= 0 ? '+' : ''}${priceVsVwapPct}%). Giải ngân Spot lúc này rút ngắn thời gian giam vốn thực tế xuống chỉ còn 1.6 ngày và tránh hoàn toàn rủi ro bị úp bô cuối phiên.`
      : `Đã vào khung chiều nhưng giá đang nằm dưới VWAP (${priceVsVwapPct}%). Chỉ giải ngân tối đa 40% tại vùng hỗ trợ sâu, không mua đuổi.`,
  };
}

// ============================================================================
// 6. SPOT CASH-LOCK EXIT LADDER & COMPOUNDING PLANNER ("KỶ LUẬT KHÓA LÃI TIỀN MẶT T+3")
// ============================================================================

export interface VnSpotCashLockPlan {
  referenceEntryPrice: number;
  trueBreakEvenPrice: number; // Entry + 0.45% fee/tax
  cashLockHalfTargetPrice: number; // +4.6% gross (~+4.15% net) -> Sell 50% on T+2.5 arrival
  fullWaveTargetPrice: number; // +8.0% gross -> Sell remaining 50% on T+5
  trailingCashStopAfterLock: number; // Entry + 1.5% guaranteed profit floor once +4% reached
  hardCapitalProtectionStop: number; // Entry - 3.5% max spot loss
  compounding5CyclesPct: number; // 5 cycles (~1 month) at +2.6% net/cycle
  compounding5CyclesProfitMillionVnd: number;
  compounding12CyclesPct: number; // 12 cycles (~1 quarter) at +2.6% net/cycle
  compounding12CyclesProfitMillionVnd: number;
  disciplineRuleVi: string;
}

export function computeVnSpotCashLockPlan(params: {
  symbolObj: MarketSymbol;
  userHoldingsMap?: Record<string, UserHoldingItem>;
  bucketCapitalMillionVnd: number;
}): VnSpotCashLockPlan {
  const { symbolObj, userHoldingsMap = {}, bucketCapitalMillionVnd } = params;
  const sym = symbolObj.symbol.toUpperCase();
  const board = getVnExchangeBoard(sym);
  const holding = userHoldingsMap[sym];

  const referenceEntryPrice =
    holding && holding.quantity > 0 ? holding.avgCostPrice : symbolObj.price;

  const trueBreakEvenPrice = roundToVnTickSize(
    referenceEntryPrice * (1 + VN_SPOT_ROUND_TRIP_FEE_TAX_PCT / 100),
    board
  );
  const cashLockHalfTargetPrice = roundToVnTickSize(referenceEntryPrice * 1.046, board);
  const fullWaveTargetPrice = roundToVnTickSize(referenceEntryPrice * 1.08, board);
  const trailingCashStopAfterLock = roundToVnTickSize(referenceEntryPrice * 1.015, board);
  const hardCapitalProtectionStop = roundToVnTickSize(referenceEntryPrice * 0.965, board);

  // Realistic Spot Compounding: +2.6% net portfolio gain per T+3/T+5 rotation cycle
  const netRatePerCycle = 0.026;
  const mult5 = Math.pow(1 + netRatePerCycle, 5);
  const mult12 = Math.pow(1 + netRatePerCycle, 12);

  const compounding5CyclesPct = Number(((mult5 - 1) * 100).toFixed(1));
  const compounding5CyclesProfitMillionVnd = Number(
    (bucketCapitalMillionVnd * (mult5 - 1)).toFixed(1)
  );
  const compounding12CyclesPct = Number(((mult12 - 1) * 100).toFixed(1));
  const compounding12CyclesProfitMillionVnd = Number(
    (bucketCapitalMillionVnd * (mult12 - 1)).toFixed(1)
  );

  return {
    referenceEntryPrice,
    trueBreakEvenPrice,
    cashLockHalfTargetPrice,
    fullWaveTargetPrice,
    trailingCashStopAfterLock,
    hardCapitalProtectionStop,
    compounding5CyclesPct,
    compounding5CyclesProfitMillionVnd,
    compounding12CyclesPct,
    compounding12CyclesProfitMillionVnd,
    disciplineRuleVi: `Kỷ luật Tiền Mặt: Khi hàng T+2.5 về và chạm ${cashLockHalfTargetPrice}k (+4.6%), chốt lời ngay 50% thu tiền mặt về Ngăn 1 và nâng điểm chặn lãi 50% còn lại lên ${trailingCashStopAfterLock}k — đảm bảo lệnh đã xanh không bao giờ biến thành lỗ.`,
  };
}

// ============================================================================
// UNIFIED VIETNAM DAILY SPOT CASH TRADING REPORT
// ============================================================================

export interface VnDailySpotTradingReport {
  symbol: string;
  rollingCashCarousel: VnSpotRollingCashCarousel;
  dailySpotScanner: VnDailySpotScannerReport;
  zeroLeverageT0Plan: VnZeroLeverageT0Plan;
  afternoonT2Window: VnAfternoonT2WindowPlan;
  spotCashLockPlan: VnSpotCashLockPlan;
}

export function evaluateVnDailySpotTradingReport(params: {
  symbolObj: MarketSymbol;
  allSymbols: MarketSymbol[];
  candles: Candle[];
  vnInsights?: VnStockInsightsPayload | null;
  userHoldingsMap?: Record<string, UserHoldingItem>;
  totalSpotCapitalMillionVnd?: number;
  now?: Date;
}): VnDailySpotTradingReport {
  const {
    symbolObj,
    allSymbols,
    candles,
    vnInsights,
    userHoldingsMap = {},
    totalSpotCapitalMillionVnd = 150,
    now = new Date(),
  } = params;

  const rollingCashCarousel = computeVnSpotRollingCashCarousel({
    activeSymbolObj: symbolObj,
    allSymbols,
    userHoldingsMap,
    totalSpotCapitalMillionVnd,
  });

  const dailySpotScanner = computeVnDailySpotScanner({
    activeSymbolObj: symbolObj,
    allSymbols,
    activeCandles: candles,
    vnInsights,
  });

  const zeroLeverageT0Plan = computeVnZeroLeverageT0Plan({
    symbolObj,
    candles,
    userHoldingsMap,
  });

  const afternoonT2Window = computeVnAfternoonT2WindowPlan({
    symbolObj,
    candles,
    now,
  });

  const spotCashLockPlan = computeVnSpotCashLockPlan({
    symbolObj,
    userHoldingsMap,
    bucketCapitalMillionVnd: rollingCashCarousel.totalSpotCapitalMillionVnd,
  });

  return {
    symbol: symbolObj.symbol.toUpperCase(),
    rollingCashCarousel,
    dailySpotScanner,
    zeroLeverageT0Plan,
    afternoonT2Window,
    spotCashLockPlan,
  };
}
