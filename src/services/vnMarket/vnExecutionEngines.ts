import { Candle, MacroIntelligenceSnapshot, MarketSymbol } from '../../types';
import {
  getVnExchangeBoard,
  getVnStockSectorInfo,
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
  roundToVnTickSize,
  VnExchangeBoard,
} from './vnStockMicrostructure';
import {
  getCachedVnForeignFlow,
  getCachedVnFundamentals,
  VnSymbolLiquidityAndPt,
} from './vnStockInsightsClient';
import {
  computeGlobalPaperTradeNetPnl,
  isCryptoSymbol,
  isUsOrGlobalEquitySymbol,
} from '../globalMarket/globalExecutionEngines';

// ============================================================================
// 1. INTRADAY SHARK TAPE, ACTIVE BUY/SELL IMBALANCE & PUT-THROUGH ANALYTICS
// ============================================================================

export interface VnWhaleBarItem {
  time: number;
  timeLabelVi: string;
  price: number;
  volume: number;
  valueBillionVnd: number;
  side: 'ACTIVE_BUY' | 'ACTIVE_SELL';
  sideLabelVi: string;
  volumeMultiple: number;
}

export interface VnActiveOrderFlowSummary {
  symbol: string;
  board: VnExchangeBoard;
  activeBuyPct: number;
  activeSellPct: number;
  activeBuyVolume: number;
  activeSellVolume: number;
  netActiveVolume: number;
  regime: 'STRONG_BUY_ABSORPTION' | 'MILD_BUY' | 'BALANCED' | 'MILD_SELL' | 'HEAVY_DISTRIBUTION';
  regimeLabelVi: string;
  vwapPrice: number | null;
  priceVsVwapPct: number | null;
  ptVolume: number;
  ptValueBillionVnd: number;
  ptSharePct: number;
  whaleBars: VnWhaleBarItem[];
}

export function computeVnActiveOrderFlow(
  candles: Candle[],
  marketSymbol: MarketSymbol,
  liquidityAndPt?: VnSymbolLiquidityAndPt | null
): VnActiveOrderFlowSummary {
  const sym = marketSymbol.symbol.toUpperCase();
  const board = getVnExchangeBoard(sym);
  const isDerivOrIdx = board === 'HNX_DERIVATIVE' || board === 'INDEX';
  // For corporate stocks: price is in 1,000 VND -> price * volume / 1e6 = Billion VND
  // For VN30F1M: 1 contract = price * 100,000 VND -> price * volume / 1e4 = Billion VND
  const valueDivisorToBillion = board === 'HNX_DERIVATIVE' ? 10_000 : isDerivOrIdx ? 1_000_000 : 1_000_000;

  const recentBars = candles.filter((c) => c.volume > 0 && c.close > 0).slice(-32);

  let buyVolSum = 0;
  let sellVolSum = 0;
  let sumPV = 0;
  let sumV = 0;

  for (let i = 0; i < recentBars.length; i++) {
    const c = recentBars[i];
    const prevClose = i > 0 ? recentBars[i - 1].close : c.open;
    const span = c.high - c.low;

    // Hybrid CLV (Close Location Value) + Lee-Ready Tick Rule on real OHLCV bars
    let buyRatio = 0.5;
    if (span > 1e-8) {
      const clv = (c.close - c.low) / span; // 0..1
      const tickBias = c.close > prevClose ? 0.12 : c.close < prevClose ? -0.12 : 0;
      buyRatio = Math.min(0.92, Math.max(0.08, clv * 0.76 + 0.12 + tickBias));
    } else {
      buyRatio = c.close > prevClose ? 0.72 : c.close < prevClose ? 0.28 : 0.5;
    }

    buyVolSum += c.volume * buyRatio;
    sellVolSum += c.volume * (1 - buyRatio);

    const typical = (c.high + c.low + c.close) / 3;
    sumPV += typical * c.volume;
    sumV += c.volume;
  }

  const totalBarVol = buyVolSum + sellVolSum;
  let activeBuyPct = 50;
  if (totalBarVol > 0) {
    activeBuyPct = parseFloat(((buyVolSum / totalBarVol) * 100).toFixed(1));
  } else if (marketSymbol.high24h > marketSymbol.low24h) {
    const pos =
      (marketSymbol.price - marketSymbol.low24h) /
      Math.max(1e-8, marketSymbol.high24h - marketSymbol.low24h);
    activeBuyPct = parseFloat(Math.min(85, Math.max(15, pos * 70 + 15)).toFixed(1));
  }
  const activeSellPct = parseFloat((100 - activeBuyPct).toFixed(1));

  const refMatchedVol =
    liquidityAndPt?.nmVolume && liquidityAndPt.nmVolume > 0
      ? liquidityAndPt.nmVolume
      : Math.round(totalBarVol || marketSymbol.volume24h || 0);

  const activeBuyVolume = Math.round(refMatchedVol * (activeBuyPct / 100));
  const activeSellVolume = Math.max(0, refMatchedVol - activeBuyVolume);
  const netActiveVolume = activeBuyVolume - activeSellVolume;

  let regime: VnActiveOrderFlowSummary['regime'] = 'BALANCED';
  let regimeLabelVi = 'Cung cầu cân bằng';
  if (activeBuyPct >= 62) {
    regime = 'STRONG_BUY_ABSORPTION';
    regimeLabelVi = '🔥 Cá mập Mua chủ động áp đảo';
  } else if (activeBuyPct >= 54) {
    regime = 'MILD_BUY';
    regimeLabelVi = 'Mua chủ động chiếm ưu thế';
  } else if (activeBuyPct <= 38) {
    regime = 'HEAVY_DISTRIBUTION';
    regimeLabelVi = '⚠️ Áp lực Bán chủ động xả mạnh';
  } else if (activeBuyPct <= 46) {
    regime = 'MILD_SELL';
    regimeLabelVi = 'Bán chủ động nhỉnh hơn';
  }

  const computedVwap =
    sumV > 0 ? parseFloat((sumPV / sumV).toFixed(board === 'HNX_DERIVATIVE' ? 1 : 2)) : null;
  const vwapPrice = liquidityAndPt?.vwapPrice ?? computedVwap;
  const priceVsVwapPct =
    vwapPrice && vwapPrice > 0 && marketSymbol.price > 0
      ? parseFloat((((marketSymbol.price - vwapPrice) / vwapPrice) * 100).toFixed(2))
      : null;

  // Detect Whale Volume Spike Bars (Lô lớn Cá mập nội ngày)
  const whaleBars: VnWhaleBarItem[] = [];
  if (recentBars.length >= 5) {
    const sortedVols = recentBars
      .map((b) => b.volume)
      .slice()
      .sort((a, b) => a - b);
    const medianVol = Math.max(1, sortedVols[Math.floor(sortedVols.length / 2)]);

    const dtf = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });

    for (let i = recentBars.length - 1; i >= 0 && whaleBars.length < 4; i--) {
      const b = recentBars[i];
      const prevC = i > 0 ? recentBars[i - 1].close : b.open;
      const mult = b.volume / medianVol;
      const valBillion = (b.close * b.volume) / valueDivisorToBillion;

      if (mult >= 1.55 || valBillion >= 8) {
        const isBuySide =
          b.close > b.open || (b.close === b.open && b.close >= prevC);
        whaleBars.push({
          time: b.time,
          timeLabelVi: dtf.format(new Date(b.time * 1000)),
          price: b.close,
          volume: Math.round(b.volume),
          valueBillionVnd: parseFloat(valBillion.toFixed(2)),
          side: isBuySide ? 'ACTIVE_BUY' : 'ACTIVE_SELL',
          sideLabelVi: isBuySide ? 'MUA ĐẨY' : 'BÁN XẢ',
          volumeMultiple: parseFloat(mult.toFixed(1)),
        });
      }
    }
  }

  return {
    symbol: sym,
    board,
    activeBuyPct,
    activeSellPct,
    activeBuyVolume,
    activeSellVolume,
    netActiveVolume,
    regime,
    regimeLabelVi,
    vwapPrice,
    priceVsVwapPct,
    ptVolume: liquidityAndPt?.ptVolume ?? 0,
    ptValueBillionVnd: liquidityAndPt?.ptValueBillionVnd ?? 0,
    ptSharePct: liquidityAndPt?.ptSharePct ?? 0,
    whaleBars,
  };
}

// ============================================================================
// 2. VIETNAM T+2.5 SETTLEMENT LOCK (13:00 DAY T+2) & REAL FEE/TAX/MARGIN PNL
// ============================================================================

export interface VnT2SettlementState {
  isVnEquityT2: boolean;
  isLocked: boolean;
  settlementReadyAtMs: number;
  businessDaysElapsed: number;
  statusBadge: string;
  unlockTimeLabelVi: string;
}

const VN_TZ_OFFSET_MS = 7 * 3600 * 1000;

/**
 * Computes exact Vietnam VSD T+2 settlement unlock timestamp:
 * - Only applies to Vietnam corporate equities (HOSE / HNX / UPCOM).
 * - VN30F1M Derivative & Crypto/FX/US are T+0 (never locked).
 * - Counts 2 business days (Mon-Fri) in Asia/Ho_Chi_Minh from the fill date,
 *   unlocking strictly at 13:00 GMT+7 (06:00 UTC) on day T+2.
 */
export function computeVnT2SettlementState(
  filledTimeMs: number | undefined,
  nowMs: number,
  symbol: string,
  quoteAsset: string
): VnT2SettlementState {
  const cleanSym = symbol.trim().toUpperCase();
  const isVnCorpEquity =
    (quoteAsset === 'VND' || isVnStockOrIndexSymbol(cleanSym)) &&
    !isVnDerivativeSymbol(cleanSym) &&
    cleanSym !== 'VNINDEX' &&
    cleanSym !== 'VN30';

  if (!isVnCorpEquity || !filledTimeMs || filledTimeMs <= 0) {
    return {
      isVnEquityT2: false,
      isLocked: false,
      settlementReadyAtMs: filledTimeMs || nowMs,
      businessDaysElapsed: 2,
      statusBadge: isVnDerivativeSymbol(cleanSym) ? 'T+0 Phái sinh' : 'T+0 Khả dụng',
      unlockTimeLabelVi: 'Khả dụng đóng lệnh ngay (T+0)',
    };
  }

  // Shift to VN local calendar (UTC+7) so day boundaries align with 00:00 GMT+7
  const vnFill = new Date(filledTimeMs + VN_TZ_OFFSET_MS);
  let y = vnFill.getUTCFullYear();
  let m = vnFill.getUTCMonth();
  let d = vnFill.getUTCDate();

  // If filled on Saturday/Sunday (edge test case), roll trade date to Monday first
  let cursor = new Date(Date.UTC(y, m, d, 0, 0, 0));
  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor = new Date(cursor.getTime() + 86_400_000);
  }

  // Advance 2 business days (Mon..Fri) -> Day T+2
  let bizAdded = 0;
  let tPlus2Cursor = new Date(cursor.getTime());
  while (bizAdded < 2) {
    tPlus2Cursor = new Date(tPlus2Cursor.getTime() + 86_400_000);
    const dow = tPlus2Cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      bizAdded++;
    }
  }

  // 13:00 GMT+7 on tPlus2Cursor = 06:00 UTC on that calendar date
  const settlementReadyAtMs = Date.UTC(
    tPlus2Cursor.getUTCFullYear(),
    tPlus2Cursor.getUTCMonth(),
    tPlus2Cursor.getUTCDate(),
    6, // 06:00 UTC == 13:00 GMT+7!
    0,
    0
  );

  const isLocked = nowMs < settlementReadyAtMs;

  // Compute business days elapsed for badge ("T+0", "T+1", "T+2")
  const vnNow = new Date(nowMs + VN_TZ_OFFSET_MS);
  const nowDayStart = Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate());
  const fillDayStart = cursor.getTime();
  let bizElapsed = 0;
  let walk = fillDayStart;
  while (walk < nowDayStart && bizElapsed < 5) {
    walk += 86_400_000;
    const dw = new Date(walk).getUTCDay();
    if (dw !== 0 && dw !== 6) bizElapsed++;
  }

  const dd = String(tPlus2Cursor.getUTCDate()).padStart(2, '0');
  const mm = String(tPlus2Cursor.getUTCMonth() + 1).padStart(2, '0');
  const unlockTimeLabelVi = `13:00 ngày ${dd}/${mm}`;

  const statusBadge = !isLocked
    ? '🟢 T+2 Khả dụng bán'
    : bizElapsed === 0
    ? `🔒 T+0 Chờ về (${unlockTimeLabelVi})`
    : bizElapsed === 1
    ? `🔒 T+1 Chờ về (${unlockTimeLabelVi})`
    : `🔒 Chờ 13:00 (${dd}/${mm})`;

  return {
    isVnEquityT2: true,
    isLocked,
    settlementReadyAtMs,
    businessDaysElapsed: bizElapsed,
    statusBadge,
    unlockTimeLabelVi,
  };
}

/**
 * Computes net realized/floating PnL after Vietnam brokerage fees (0.15%/leg),
 * Personal Income Tax on sale (0.10%), and Margin loan interest (12.0%/year when leverage > 1).
 */
export function computeVnNetPaperPnl(params: {
  symbol: string;
  quoteAsset: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  capital: number;
  leverage: number;
  filledTimeMs?: number;
  evalTimeMs: number;
}): {
  netPnlPercent: number;
  netPnlAmount: number;
  frictionPctOnCapital: number;
  holdingDays: number;
} {
  const lev = Math.max(1, params.leverage || 1);
  const isBuy = params.action === 'BUY';
  const rawPricePct =
    params.entryPrice > 0
      ? ((isBuy ? params.exitPrice - params.entryPrice : params.entryPrice - params.exitPrice) /
          params.entryPrice) *
        100
      : 0;
  const grossPctOnCapital = rawPricePct * lev;

  const cleanSym = params.symbol.trim().toUpperCase();
  const isVN = params.quoteAsset === 'VND' || isVnStockOrIndexSymbol(cleanSym);

  if (!isVN) {
    const marketKind =
      params.quoteAsset === 'USDT' || isCryptoSymbol(cleanSym)
        ? 'crypto'
        : isUsOrGlobalEquitySymbol(cleanSym)
        ? 'us_equity'
        : 'commodity';
    const globalRes = computeGlobalPaperTradeNetPnl({
      marketKind,
      direction: isBuy ? 'LONG' : 'SHORT',
      entryPrice: params.entryPrice,
      currentPrice: params.exitPrice,
      leverage: lev,
      openedAtMs: params.filledTimeMs || params.evalTimeMs,
      closedOrNowMs: params.evalTimeMs,
    });
    const friction = globalRes.feeCostPct + globalRes.carryOrMarginCostPct;
    const globalDays = params.filledTimeMs
      ? Math.max(0, Math.floor((params.evalTimeMs - params.filledTimeMs) / 86_400_000))
      : 0;
    return {
      netPnlPercent: globalRes.netPnlPct,
      netPnlAmount: parseFloat((params.capital * (globalRes.netPnlPct / 100)).toFixed(2)),
      frictionPctOnCapital: parseFloat(friction.toFixed(2)),
      holdingDays: globalDays,
    };
  }

  const holdingDays = params.filledTimeMs
    ? Math.max(1, Math.ceil((params.evalTimeMs - params.filledTimeMs) / 86_400_000))
    : 1;

  if (isVnDerivativeSymbol(cleanSym)) {
    // VN30F1M roundtrip fee + derivative tax ~ 0.04% of notional
    const derivFeePct = 0.04 * lev;
    const netPct = grossPctOnCapital - derivFeePct;
    return {
      netPnlPercent: parseFloat(netPct.toFixed(2)),
      netPnlAmount: parseFloat((params.capital * (netPct / 100)).toFixed(2)),
      frictionPctOnCapital: parseFloat(derivFeePct.toFixed(2)),
      holdingDays,
    };
  }

  // Corporate Vietnam Equities:
  // Buy fee 0.15% + Sell fee 0.15% + Sell PIT Tax 0.10% = 0.40% of notional position
  const feeAndTaxPctOnCap = 0.4 * lev;
  // Margin interest ~12.0%/year on borrowed portion (lev - 1) * capital
  const borrowedRatio = Math.max(0, lev - 1);
  const marginInterestPctOnCap = borrowedRatio * (12.0 / 365) * holdingDays;

  const totalFrictionPct = feeAndTaxPctOnCap + marginInterestPctOnCap;
  const netPct = grossPctOnCapital - totalFrictionPct;

  return {
    netPnlPercent: parseFloat(netPct.toFixed(2)),
    netPnlAmount: parseFloat((params.capital * (netPct / 100)).toFixed(2)),
    frictionPctOnCapital: parseFloat(totalFrictionPct.toFixed(2)),
    holdingDays,
  };
}

// ============================================================================
// 3. VIETNAM INSTITUTIONAL MOMENTUM, VCP & POCKET PIVOT SCREENER (CANSLIM VN)
// ============================================================================

export type VnMomentumSetupType =
  | 'BREAKOUT_LEADER'
  | 'VCP_TIGHT_BASE'
  | 'POCKET_PIVOT'
  | 'LAGGING_AVOID';

export interface VnMomentumCandidate {
  symbol: string;
  name: string;
  board: VnExchangeBoard;
  sectorName: string;
  currentPrice: number;
  change24h: number;
  rsSpreadVsVnIndex: number;
  rsRating: number; // 1 - 99 IBD-style Relative Strength
  intradayRangePct: number;
  closeInRangePct: number; // 0 - 100% (100% = closed at session high)
  setupType: VnMomentumSetupType;
  setupLabelVi: string;
  momentumScore: number; // 0 - 100
  pivotBuyPrice: number;
  stopLossPrice: number; // -6% CANSLIM rule, tick-rounded
  targetProfitPrice: number; // +18% target, tick-rounded
  roePct: number | null;
  peRatio: number | null;
  foreignNet10dBillion: number | null;
  catalysts: string[];
}

export interface VnMarketMomentumSummary {
  vnIndexPrice: number;
  vnIndexChangePct: number;
  marketRegime: 'FTD_CONFIRMED' | 'UPTREND_ROTATION' | 'CONSOLIDATION' | 'CORRECTION_DEFENSE';
  marketRegimeLabelVi: string;
  marketGuidanceVi: string;
  breakoutCount: number;
  vcpCount: number;
  candidates: VnMomentumCandidate[];
}

export function scanVnMomentumBreakouts(symbols: MarketSymbol[]): VnMarketMomentumSummary {
  const vnIdx = symbols.find((s) => s.symbol.toUpperCase() === 'VNINDEX');
  const vnIndexPrice = vnIdx?.price ?? 1250;
  const vnIndexChangePct = vnIdx?.change24h ?? 0;

  const corpStocks = symbols.filter((s) => {
    const u = s.symbol.toUpperCase();
    return (
      isVnStockOrIndexSymbol(s) &&
      !isVnDerivativeSymbol(u) &&
      u !== 'VNINDEX' &&
      u !== 'VN30' &&
      s.price > 0
    );
  });

  // Compute raw outperformance to assign percentile RS Rating (1..99)
  const sortedByPerf = corpStocks
    .slice()
    .sort((a, b) => a.change24h - b.change24h);
  const rankMap = new Map<string, number>();
  sortedByPerf.forEach((s, idx) => {
    const pctile = Math.round(((idx + 1) / Math.max(1, sortedByPerf.length)) * 98) + 1;
    rankMap.set(s.symbol.toUpperCase(), Math.min(99, Math.max(1, pctile)));
  });

  const advCount = corpStocks.filter((s) => s.change24h > 0).length;
  const advRatio = corpStocks.length > 0 ? advCount / corpStocks.length : 0.5;

  let marketRegime: VnMarketMomentumSummary['marketRegime'] = 'CONSOLIDATION';
  let marketRegimeLabelVi = 'Tích lũy Phân hóa (Chọn lọc cổ phiếu kênh trên)';
  let marketGuidanceVi =
    'VN-Index đang đi ngang phân hóa — Ưu tiên gom tại nền siết biên độ VCP, hạn chế mua đuổi khi giá đã kéo xa nền > 5%.';

  if (vnIndexChangePct >= 1.1 && advRatio >= 0.65) {
    marketRegime = 'FTD_CONFIRMED';
    marketRegimeLabelVi = '🔥 Bùng Nổ Theo Đà (Follow-Through Day — Dòng tiền lan tỏa)';
    marketGuidanceVi =
      'Độ rộng thị trường đồng thuận bùng nổ (>65% mã xanh) — Thời điểm vàng giải ngân cổ phiếu dẫn sóng vượt Pivot!';
  } else if (vnIndexChangePct >= 0.25 && advRatio >= 0.5) {
    marketRegime = 'UPTREND_ROTATION';
    marketRegimeLabelVi = '🟢 Xu hướng Tăng Luân Phiên Nhóm Ngành';
    marketGuidanceVi =
      'Dòng tiền luân chuyển lành mạnh giữa các nhóm ngành có RS > 75. Giải ngân từng phần tại các điểm Pocket Pivot.';
  } else if (vnIndexChangePct <= -1.0 || advRatio <= 0.3) {
    marketRegime = 'CORRECTION_DEFENSE';
    marketRegimeLabelVi = '⚠️ Thị Trường Chịu Áp Lực Điều Chỉnh';
    marketGuidanceVi =
      'Độ rộng nghiêng mạnh về bên bán — Chỉ đưa các mã giữ giá khỏe nhất (RS ≥ 85, nền VCP không thủng) vào Watchlist theo dõi!';
  }

  const candidates: VnMomentumCandidate[] = corpStocks.map((s) => {
    const sym = s.symbol.toUpperCase();
    const board = getVnExchangeBoard(sym);
    const sec = getVnStockSectorInfo(sym);
    const rsSpread = parseFloat((s.change24h - vnIndexChangePct).toFixed(2));
    const rsRating = rankMap.get(sym) ?? 50;

    const hi = Math.max(s.price, s.high24h || s.price);
    const lo = Math.min(s.price, s.low24h > 0 ? s.low24h : s.price);
    const intradayRangePct =
      lo > 0 ? parseFloat((((hi - lo) / lo) * 100).toFixed(2)) : 0;
    const closeInRangePct =
      hi > lo ? Math.round(((s.price - lo) / (hi - lo)) * 100) : 50;

    const fund = getCachedVnFundamentals(sym);
    const foreign = getCachedVnForeignFlow(sym);

    let score = 48;
    const catalysts: string[] = [];

    if (rsRating >= 80) {
      score += 18;
      catalysts.push(`Sức mạnh giá RS ${rsRating}/99 dẫn đầu toàn sàn`);
    } else if (rsRating >= 65) {
      score += 10;
    } else if (rsRating <= 30) {
      score -= 14;
    }

    if (rsSpread >= 1.5) {
      score += 12;
      catalysts.push(`Vượt trội VN-Index +${rsSpread}% trong phiên`);
    } else if (rsSpread < -1.0) {
      score -= 10;
    }

    if (closeInRangePct >= 75 && s.change24h > 0) {
      score += 10;
      catalysts.push(`Đóng nến sát đỉnh phiên (${closeInRangePct}% biên độ) — Cầu hấp thụ tốt`);
    }

    // Fundamental CANSLIM bonus (ROE >= 15%)
    if (fund?.roePct != null && fund.roePct >= 15) {
      score += 8;
      catalysts.push(`Chuẩn CANSLIM: ROE đạt ${fund.roePct}%`);
    }
    if (foreign && foreign.total10dNetBillionVnd > 15) {
      score += 7;
      catalysts.push(`Khối ngoại gom ròng +${foreign.total10dNetBillionVnd} tỷ (10P)`);
    } else if (foreign && foreign.total10dNetBillionVnd < -80) {
      score -= 6;
    }

    let setupType: VnMomentumSetupType = 'LAGGING_AVOID';
    let setupLabelVi = 'Chờ tích lũy thêm';

    if (s.change24h >= 2.0 && rsSpread >= 1.2 && closeInRangePct >= 68) {
      setupType = 'BREAKOUT_LEADER';
      setupLabelVi = '🚀 Bứt Phá Dẫn Sóng';
      score += 8;
    } else if (
      intradayRangePct > 0 &&
      intradayRangePct <= 2.3 &&
      s.change24h >= -0.6 &&
      s.change24h <= 1.6 &&
      rsRating >= 55
    ) {
      setupType = 'VCP_TIGHT_BASE';
      setupLabelVi = '💎 Nền Siết Biên VCP';
      score += 9;
      catalysts.unshift(`Biên độ siết chặt ${intradayRangePct}% (Nền phẳng VCP chờ nổ)`);
    } else if (s.change24h >= 0.8 && rsSpread >= 0.3 && closeInRangePct >= 60) {
      setupType = 'POCKET_PIVOT';
      setupLabelVi = '⚡ Pocket Pivot Hút Tiền';
      score += 5;
    }

    score = Math.min(99, Math.max(15, Math.round(score)));

    const rawPivot =
      setupType === 'VCP_TIGHT_BASE' ? Math.max(s.price, hi * 1.005) : s.price;
    const pivotBuyPrice = roundToVnTickSize(rawPivot, board);
    const stopLossPrice = roundToVnTickSize(pivotBuyPrice * 0.94, board); // -6% Minervini/CANSLIM hard stop
    const targetProfitPrice = roundToVnTickSize(pivotBuyPrice * 1.18, board); // +18% swing target

    if (catalysts.length === 0) {
      catalysts.push(`Ngành ${sec?.shortName || 'Cơ sở'} • RS ${rsRating}/99`);
    }

    return {
      symbol: sym,
      name: s.name,
      board,
      sectorName: sec?.shortName || 'Thị trường VN',
      currentPrice: s.price,
      change24h: s.change24h,
      rsSpreadVsVnIndex: rsSpread,
      rsRating,
      intradayRangePct,
      closeInRangePct,
      setupType,
      setupLabelVi,
      momentumScore: score,
      pivotBuyPrice,
      stopLossPrice,
      targetProfitPrice,
      roePct: fund?.roePct ?? null,
      peRatio: fund?.peRatio ?? null,
      foreignNet10dBillion: foreign?.total10dNetBillionVnd ?? null,
      catalysts: catalysts.slice(0, 3),
    };
  });

  candidates.sort((a, b) => b.momentumScore - a.momentumScore || b.rsRating - a.rsRating);

  return {
    vnIndexPrice,
    vnIndexChangePct,
    marketRegime,
    marketRegimeLabelVi,
    marketGuidanceVi,
    breakoutCount: candidates.filter((c) => c.setupType === 'BREAKOUT_LEADER').length,
    vcpCount: candidates.filter((c) => c.setupType === 'VCP_TIGHT_BASE').length,
    candidates,
  };
}

// ============================================================================
// 4. SBV USD/VND FX CEILING & DOMESTIC LIQUIDITY PRESSURE GAUGE
// ============================================================================

export interface VnSbvFxLiquidityGauge {
  usdVndRate: number;
  usdVndChangePct: number;
  dxyValue: number | null;
  us10yYield: number | null;
  pressureScore: number; // 0 (cool) -> 100 (extreme SBV intervention risk)
  regime:
    | 'EASING_SUPPORTIVE'
    | 'NEUTRAL_STABLE'
    | 'FX_WATCH_OMO'
    | 'SEVERE_FX_STRESS';
  regimeLabelVi: string;
  recommendedMaxEquityPct: number;
  recommendedMarginCapVi: string;
  actionGuidanceVi: string;
}

export function computeVnSbvFxPressure(
  macroSnapshot?: MacroIntelligenceSnapshot | null
): VnSbvFxLiquidityGauge | null {
  if (!macroSnapshot || !Array.isArray(macroSnapshot.indicators)) return null;

  const fxInd = macroSnapshot.indicators.find((i) => i.id === 'USDVND');
  if (!fxInd || !(fxInd.value > 15_000)) return null;

  const dxyInd = macroSnapshot.indicators.find((i) => i.id === 'DXY');
  const us10yInd = macroSnapshot.indicators.find((i) => i.id === 'US10Y');

  const usdVndRate = fxInd.value;
  const usdVndChangePct = fxInd.changePercent || 0;
  const dxyValue = dxyInd ? dxyInd.value : null;
  const us10yYield = us10yInd ? us10yInd.value : null;

  let score = 35;

  // Evaluate USD/VND level & momentum
  if (usdVndRate >= 25_650) score += 28;
  else if (usdVndRate >= 25_400) score += 16;
  else if (usdVndRate <= 24_950) score -= 12;

  if (usdVndChangePct >= 0.35) score += 18;
  else if (usdVndChangePct >= 0.15) score += 8;
  else if (usdVndChangePct <= -0.15) score -= 8;

  // DXY & US10Y external carry pressure on VND
  if (dxyValue !== null) {
    if (dxyValue >= 106.0) score += 16;
    else if (dxyValue >= 104.2) score += 8;
    else if (dxyValue <= 101.5) score -= 10;
  }

  if (us10yYield !== null) {
    if (us10yYield >= 4.5) score += 10;
    else if (us10yYield <= 3.9) score -= 8;
  }

  const pressureScore = Math.min(98, Math.max(8, Math.round(score)));

  if (pressureScore >= 75) {
    return {
      usdVndRate,
      usdVndChangePct,
      dxyValue,
      us10yYield,
      pressureScore,
      regime: 'SEVERE_FX_STRESS',
      regimeLabelVi: '🔴 Tỷ giá Căng thẳng — Rủi ro NHNN Hút Tín phiếu / Bán Ngoại tệ',
      recommendedMaxEquityPct: 40,
      recommendedMarginCapVi: '0% Margin (Chỉ giữ tiền mặt)',
      actionGuidanceVi:
        'USD/VND & DXY gây sức ép lớn lên trần tỷ giá NHNN: Lịch sử VN-Index thường rung lắc mạnh ở nhóm Ngân hàng & Chứng khoán. Tuyệt đối tắt Margin, ưu tiên nhóm Xuất khẩu/Dầu khí/Tiền mặt.',
    };
  }

  if (pressureScore >= 55) {
    return {
      usdVndRate,
      usdVndChangePct,
      dxyValue,
      us10yYield,
      pressureScore,
      regime: 'FX_WATCH_OMO',
      regimeLabelVi: '🟠 Tỷ giá Nhạy cảm — Quan sát Điều hành OMO/Tín phiếu NHNN',
      recommendedMaxEquityPct: 65,
      recommendedMarginCapVi: 'Margin ≤ 20%',
      actionGuidanceVi:
        'Tỷ giá USD/VND nhích lên vùng theo dõi: Khối ngoại có xu hướng cơ cấu thận trọng. Giữ tỷ trọng cổ phiếu vừa phải, không full-margin ở vùng kháng cự.',
    };
  }

  if (pressureScore <= 28) {
    return {
      usdVndRate,
      usdVndChangePct,
      dxyValue,
      us10yYield,
      pressureScore,
      regime: 'EASING_SUPPORTIVE',
      regimeLabelVi: '🟢 Tỷ giá Hạ nhiệt — Dư địa Thanh khoản VND Rộng mở',
      recommendedMaxEquityPct: 90,
      recommendedMarginCapVi: 'Margin an toàn ≤ 50%',
      actionGuidanceVi:
        'Áp lực tỷ giá và DXY suy yếu giúp NHNN duy trì lãi suất liên ngân hàng thấp — Gió thuận vĩ mô cho nhóm Ngân hàng, Chứng khoán và BĐS!',
    };
  }

  return {
    usdVndRate,
    usdVndChangePct,
    dxyValue,
    us10yYield,
    pressureScore,
    regime: 'NEUTRAL_STABLE',
    regimeLabelVi: '🟡 Tỷ giá Ổn định trong Biên độ Điều hành NHNN (±5%)',
    recommendedMaxEquityPct: 80,
    recommendedMarginCapVi: 'Margin ≤ 35%',
    actionGuidanceVi:
      'Tỷ giá USD/VND vận động ổn định, không gây cú sốc thanh khoản hệ thống. Tập trung chọn cổ phiếu theo dòng tiền ngành và kết quả kinh doanh.',
  };
}
