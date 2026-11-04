import { Candle, MarketSymbol } from '../../types';
import {
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateRSI,
} from '../indicators';
import {
  getVnExchangeBoard,
  isVnStockOrIndexSymbol,
  roundToVnTickSize,
} from '../vnMarket/vnStockMicrostructure';
import { isCryptoSymbol } from '../globalMarket/globalExecutionEngines';

export type SpotAssetMarketType = 'VN_STOCK' | 'CRYPTO_COIN' | 'GLOBAL_ASSET';

export interface SpotLotTrancheItem {
  trancheIndex: 1 | 2 | 3;
  labelVi: string;
  weightPct: number;
  limitPrice: number;
  discountFromSpotPct: number;
  /** Exact share count (rounded to 100-share board lot for VN stock) or Coin quantity */
  quantity: number;
  quantityFormatted: string;
  /** Cash committed in VNĐ or USDT */
  cashCommitted: number;
  cashCommittedFormatted: string;
  triggerNoteVi: string;
}

export interface SpotCashAndLotAllocationReport {
  marketType: SpotAssetMarketType;
  currencyUnit: 'VNĐ' | 'USDT' | 'USD';
  inputCapital: number;
  inputCapitalFormatted: string;
  totalCashDeployed: number;
  totalCashDeployedFormatted: string;
  remainingCashReserve: number;
  remainingCashReserveFormatted: string;
  totalQuantity: number;
  totalQuantityFormatted: string;
  weightedAvgEntryPrice: number;
  roundTripFeeAndTaxPct: number;
  allInBreakevenPrice: number;
  tranches: SpotLotTrancheItem[];
  expectedNetProfitTp1: number;
  expectedNetProfitTp1Formatted: string;
  expectedNetProfitTp2: number;
  expectedNetProfitTp2Formatted: string;
  maxStructuralLoss: number;
  maxStructuralLossFormatted: string;
  boardLotRuleVi: string;
}

export interface SpotRelativeStrengthReport {
  symbol: string;
  benchmarkSymbol: string;
  symbolReturn24hPct: number;
  benchmarkReturn24hPct: number;
  rsSpread24hPct: number;
  symbolMomentum5BarPct: number;
  rsScore: number; // 0..100
  rsTier: 'LEADER' | 'OUTPERFORM' | 'INLINE' | 'LAGGARD';
  badgeVi: string;
  topMarketLeaderSymbol: string;
  topMarketLeaderSpreadPct: number;
  adviceVi: string;
}

export interface SpotScaleOutStep {
  step: 'TP1_FREE_RIDE' | 'TP2_MAIN_HARVEST' | 'TP3_MOONBAG_EMA20';
  titleVi: string;
  sellPct: number;
  targetPrice: number;
  gainFromAvgEntryPct: number;
  quantityToSell: number;
  quantityToSellFormatted: string;
  netCashReceivedFormatted: string;
  netProfitLockedFormatted: string;
  actionInstructionVi: string;
}

export interface SpotScaleOutAndFreeRidePlan {
  freeRideStopPrice: number;
  ema20TrailingStopPrice: number;
  steps: SpotScaleOutStep[];
  summaryRuleVi: string;
}

export interface CashIsKingCircuitBreakerReport {
  defenseState: 'OFFENSIVE_DEPLOY' | 'SELECTIVE_CAUTIOUS' | 'CASH_IS_KING_DEFENSE';
  badgeVi: string;
  recommendedMinCashPct: number;
  recommendedMaxSpotDeployPct: number;
  marketBreadthBullishPct: number;
  capitulationCatchLowPrice: number;
  capitulationCatchHighPrice: number;
  capitulationDiscountPct: number;
  reasonsVi: string[];
  actionDirectiveVi: string;
}

export interface SmartDynamicDcaReport {
  dcaZone:
    | 'EUPHORIA_PAUSE'
    | 'FAIR_VALUE_HALF'
    | 'ACCUMULATION_STANDARD'
    | 'DEEP_VALUE_DOUBLE';
  multiplier: 0 | 0.5 | 1 | 1.5 | 2;
  zoneBadgeVi: string;
  basePeriodicBudget: number;
  basePeriodicBudgetFormatted: string;
  recommendedTodayDcaAmount: number;
  recommendedTodayDcaFormatted: string;
  recommendedTodayQuantityFormatted: string;
  rsi14: number;
  distanceFromEma50Pct: number;
  rationaleVi: string;
}

export interface SpotProUpgradeSuiteReport {
  symbol: string;
  marketType: SpotAssetMarketType;
  cashAndLotAllocation: SpotCashAndLotAllocationReport;
  relativeStrength: SpotRelativeStrengthReport;
  scaleOutAndFreeRide: SpotScaleOutAndFreeRidePlan;
  cashCircuitBreaker: CashIsKingCircuitBreakerReport;
  smartDynamicDca: SmartDynamicDcaReport;
}

function roundPrice(price: number, symbolObj: MarketSymbol): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (isVnStockOrIndexSymbol(symbolObj)) {
    const board = getVnExchangeBoard(symbolObj.symbol);
    return roundToVnTickSize(price, board);
  }
  if (price >= 1000) return Number(price.toFixed(2));
  if (price >= 10) return Number(price.toFixed(3));
  if (price >= 1) return Number(price.toFixed(4));
  return Number(price.toFixed(6));
}

function formatCash(amount: number, currency: 'VNĐ' | 'USDT' | 'USD'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  if (currency === 'VNĐ') {
    const sign = safe < 0 ? '-' : '';
    const abs = Math.abs(Math.round(safe));
    if (abs >= 1_000_000_000) {
      return `${sign}${(abs / 1_000_000_000).toFixed(2)} tỷ VNĐ`;
    }
    if (abs >= 1_000_000) {
      return `${sign}${(abs / 1_000_000).toFixed(2)} tr VNĐ`;
    }
    return `${sign}${abs.toLocaleString('vi-VN')} VNĐ`;
  }
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  return `${sign}${abs.toLocaleString('en-US', {
    minimumFractionDigits: abs >= 100 ? 0 : 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatQuantity(qty: number, marketType: SpotAssetMarketType, symbol: string): string {
  if (!Number.isFinite(qty) || qty <= 0) {
    return marketType === 'VN_STOCK' ? '0 CP' : `0 ${symbol.replace(/USDT|USD$/i, '')}`;
  }
  if (marketType === 'VN_STOCK') {
    return `${Math.round(qty).toLocaleString('vi-VN')} CP`;
  }
  const base = symbol.replace(/USDT|USD$/i, '');
  if (qty >= 100) return `${qty.toFixed(2)} ${base}`;
  if (qty >= 1) return `${qty.toFixed(4)} ${base}`;
  return `${qty.toFixed(5)} ${base}`;
}

/**
 * Converts a display quote price into actual cash price per 1 share/unit.
 * For VN stocks quoted in thousands (e.g. FPT = 135.4 -> 135,400 VNĐ/CP).
 */
function toCashUnitPrice(quotePrice: number, marketType: SpotAssetMarketType): number {
  if (marketType === 'VN_STOCK') {
    return quotePrice < 1000 ? quotePrice * 1000 : quotePrice;
  }
  return quotePrice;
}

/**
 * Engine 1: Spot Cash & Board-Lot Allocation Calculator (30% - 40% - 30%)
 */
export function calculateSpotCashAndLotAllocation(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  capitalAmount?: number;
  stopLossPrice?: number;
  tp1Price?: number;
  tp2Price?: number;
}): SpotCashAndLotAllocationReport {
  const { symbolObj, candles } = params;
  const isVn = isVnStockOrIndexSymbol(symbolObj);
  const isCrypto = isCryptoSymbol(symbolObj);
  const marketType: SpotAssetMarketType = isVn
    ? 'VN_STOCK'
    : isCrypto
    ? 'CRYPTO_COIN'
    : 'GLOBAL_ASSET';
  const currencyUnit: 'VNĐ' | 'USDT' | 'USD' = isVn
    ? 'VNĐ'
    : isCrypto
    ? 'USDT'
    : 'USD';

  const defaultCapital = isVn ? 100_000_000 : 2_000;
  const inputCapital =
    params.capitalAmount && params.capitalAmount > 0
      ? params.capitalAmount
      : defaultCapital;

  const spotPrice =
    candles.length > 0 ? candles[candles.length - 1].close : symbolObj.price || 100;
  const atrSeries = calculateATR(candles, 14);
  const latestAtr =
    atrSeries.length > 0 && Number.isFinite(atrSeries[atrSeries.length - 1])
      ? atrSeries[atrSeries.length - 1]
      : spotPrice * 0.022;
  const atrPct = Math.min(Math.max((latestAtr / Math.max(spotPrice, 1e-6)) * 100, 0.8), 4.5);

  const d1Pct = Number(Math.max(0.25, atrPct * 0.25).toFixed(2));
  const d2Pct = Number(Math.max(1.1, atrPct * 0.85).toFixed(2));
  const d3Pct = Number(Math.max(2.3, atrPct * 1.65).toFixed(2));

  const p1 = roundPrice(spotPrice * (1 - d1Pct / 100), symbolObj);
  const p2 = roundPrice(spotPrice * (1 - d2Pct / 100), symbolObj);
  const p3 = roundPrice(spotPrice * (1 - d3Pct / 100), symbolObj);

  const weights: Array<{ idx: 1 | 2 | 3; pct: number; price: number; discount: number; label: string; note: string }> = [
    {
      idx: 1,
      pct: 30,
      price: p1,
      discount: d1Pct,
      label: 'Đợt 1 (30% • Vị thế thăm dò)',
      note: isVn
        ? 'Kê Limit tại hỗ trợ ngắn hạn hoặc khung 14:05–14:25 trước ATC'
        : 'Đặt Limit Maker hứng nhịp lùi nhẹ về EMA20 / VWAP',
    },
    {
      idx: 2,
      pct: 40,
      price: p2,
      discount: d2Pct,
      label: 'Đợt 2 (40% • Gom chủ lực vùng cầu)',
      note: isVn
        ? 'Gom mạnh khi rũ bỏ khối lượng thấp về vùng cầu / hội tụ EMA50'
        : 'Khớp khi râu nến quét thanh khoản Long yếu về vùng Order Block',
    },
    {
      idx: 3,
      pct: 30,
      price: p3,
      discount: d3Pct,
      label: 'Đợt 3 (30% • Hứng râu hoảng loạn)',
      note: isVn
        ? 'Kê sẵn giá chiết khấu sâu phòng nhịp đạp trụ / ép Margin cuối phiên'
        : 'Đặt sẵn lệnh Limit sâu hứng cú Flash-wick quét Stoploss phái sinh',
    },
  ];

  const tranches: SpotLotTrancheItem[] = [];
  let totalCashDeployed = 0;
  let totalQuantity = 0;
  let weightedQuoteSum = 0;

  for (const w of weights) {
    const budgetForTranche = (inputCapital * w.pct) / 100;
    const cashPricePerUnit = toCashUnitPrice(w.price, marketType);

    let qty = 0;
    if (marketType === 'VN_STOCK') {
      // Round down to 100-share board lot on HOSE/HNX
      const rawShares = budgetForTranche / Math.max(cashPricePerUnit, 1);
      qty = Math.floor(rawShares / 100) * 100;
      // If budget is enough for at least 100 shares overall and tranche 2 got 0, try 100 shares if within remaining capital
      if (qty === 0 && inputCapital - totalCashDeployed >= cashPricePerUnit * 100) {
        qty = 100;
      }
    } else {
      qty = Number((budgetForTranche / Math.max(cashPricePerUnit, 1e-8)).toFixed(6));
    }

    const cashCommitted = qty * cashPricePerUnit;
    totalCashDeployed += cashCommitted;
    totalQuantity += qty;
    weightedQuoteSum += qty * w.price;

    tranches.push({
      trancheIndex: w.idx,
      labelVi: w.label,
      weightPct: w.pct,
      limitPrice: w.price,
      discountFromSpotPct: w.discount,
      quantity: qty,
      quantityFormatted: formatQuantity(qty, marketType, symbolObj.symbol),
      cashCommitted,
      cashCommittedFormatted: formatCash(cashCommitted, currencyUnit),
      triggerNoteVi: w.note,
    });
  }

  const weightedAvgEntryPrice =
    totalQuantity > 0
      ? roundPrice(weightedQuoteSum / totalQuantity, symbolObj)
      : roundPrice(spotPrice, symbolObj);

  // Fees: VN Stock = ~0.15% buy + 0.15% sell + 0.10% sell tax = 0.40%; Crypto Spot = 0.10% buy + 0.10% sell = 0.20%
  const roundTripFeeAndTaxPct = marketType === 'VN_STOCK' ? 0.4 : 0.2;
  const allInBreakevenPrice = roundPrice(
    weightedAvgEntryPrice * (1 + roundTripFeeAndTaxPct / 100),
    symbolObj
  );

  const tp1 =
    params.tp1Price && params.tp1Price > weightedAvgEntryPrice
      ? params.tp1Price
      : roundPrice(weightedAvgEntryPrice * (1 + Math.max(atrPct * 1.6, 2.8) / 100), symbolObj);
  const tp2 =
    params.tp2Price && params.tp2Price > tp1
      ? params.tp2Price
      : roundPrice(weightedAvgEntryPrice * (1 + Math.max(atrPct * 3.0, 5.5) / 100), symbolObj);
  const sl =
    params.stopLossPrice && params.stopLossPrice < weightedAvgEntryPrice
      ? params.stopLossPrice
      : roundPrice(weightedAvgEntryPrice * (1 - Math.max(atrPct * 1.4, 2.6) / 100), symbolObj);

  const avgCashUnit = toCashUnitPrice(allInBreakevenPrice, marketType);
  const tp1CashUnit = toCashUnitPrice(tp1, marketType);
  const tp2CashUnit = toCashUnitPrice(tp2, marketType);
  const slCashUnit = toCashUnitPrice(sl, marketType);

  const expectedNetProfitTp1 = Math.max(0, (tp1CashUnit - avgCashUnit) * totalQuantity);
  const expectedNetProfitTp2 = Math.max(0, (tp2CashUnit - avgCashUnit) * totalQuantity);
  const maxStructuralLoss = Math.max(0, (avgCashUnit - slCashUnit) * totalQuantity);
  const remainingCashReserve = Math.max(0, inputCapital - totalCashDeployed);

  return {
    marketType,
    currencyUnit,
    inputCapital,
    inputCapitalFormatted: formatCash(inputCapital, currencyUnit),
    totalCashDeployed,
    totalCashDeployedFormatted: formatCash(totalCashDeployed, currencyUnit),
    remainingCashReserve,
    remainingCashReserveFormatted: formatCash(remainingCashReserve, currencyUnit),
    totalQuantity,
    totalQuantityFormatted: formatQuantity(totalQuantity, marketType, symbolObj.symbol),
    weightedAvgEntryPrice,
    roundTripFeeAndTaxPct,
    allInBreakevenPrice,
    tranches,
    expectedNetProfitTp1,
    expectedNetProfitTp1Formatted: `+${formatCash(expectedNetProfitTp1, currencyUnit)}`,
    expectedNetProfitTp2,
    expectedNetProfitTp2Formatted: `+${formatCash(expectedNetProfitTp2, currencyUnit)}`,
    maxStructuralLoss,
    maxStructuralLossFormatted: `-${formatCash(maxStructuralLoss, currencyUnit)}`,
    boardLotRuleVi:
      marketType === 'VN_STOCK'
        ? 'Chuẩn Lô chẵn HOSE/HNX (Bội số 100 CP) • Đã cộng 0.40% phí 2 chiều + thuế TNCN chiều bán'
        : 'Chuẩn Spot 1x Tiền mặt (Không đòn bẩy, 0% phí Funding) • Đã cộng 0.20% phí Maker/Taker 2 chiều',
  };
}

/**
 * Engine 2: Relative Strength (RS Leader vs. Laggard) against Benchmark (BTCUSDT or VN-Index / Basket)
 */
export function evaluateSpotRelativeStrength(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  allSymbols: MarketSymbol[];
}): SpotRelativeStrengthReport {
  const { symbolObj, candles, allSymbols } = params;
  const isVn = isVnStockOrIndexSymbol(symbolObj);
  const isCrypto = isCryptoSymbol(symbolObj);

  const sameMarketPeers = allSymbols.filter((s) =>
    isVn ? isVnStockOrIndexSymbol(s) : isCrypto ? isCryptoSymbol(s) : true
  );

  const benchmarkObj = isVn
    ? allSymbols.find((s) => s.symbol === 'VNINDEX')
    : allSymbols.find((s) => s.symbol === 'BTCUSDT');

  const peerAvgChange =
    sameMarketPeers.length > 0
      ? sameMarketPeers.reduce((acc, s) => acc + (Number.isFinite(s.change24h) ? s.change24h : 0), 0) /
        sameMarketPeers.length
      : 0;

  const benchmarkSymbol = benchmarkObj
    ? benchmarkObj.symbol
    : isVn
    ? 'Rổ VN30/VN-Index'
    : 'BTCUSDT';

  const benchmarkReturn24hPct = Number(
    (benchmarkObj ? benchmarkObj.change24h : peerAvgChange).toFixed(2)
  );
  const symbolReturn24hPct = Number((symbolObj.change24h || 0).toFixed(2));
  const rsSpread24hPct = Number((symbolReturn24hPct - benchmarkReturn24hPct).toFixed(2));

  const n = candles.length;
  const symbolMomentum5BarPct =
    n >= 6 && candles[n - 6].close > 0
      ? Number((((candles[n - 1].close - candles[n - 6].close) / candles[n - 6].close) * 100).toFixed(2))
      : symbolReturn24hPct;

  const closes = candles.map((c) => c.close);
  const ema20Series = calculateEMA(closes, 20);
  const latestClose = n > 0 ? candles[n - 1].close : symbolObj.price;
  const rawLastEma20 = ema20Series.length > 0 ? ema20Series[ema20Series.length - 1] : null;
  const latestEma20 =
    rawLastEma20 !== null && Number.isFinite(rawLastEma20) ? rawLastEma20 : latestClose;
  const aboveEma20 = latestClose >= latestEma20;

  // Find #1 RS Leader in the same market
  let topLeader = symbolObj;
  let maxChange = -999;
  for (const peer of sameMarketPeers) {
    if (peer.symbol === 'VNINDEX' || peer.symbol === 'VN30F1M') continue;
    if ((peer.change24h || 0) > maxChange) {
      maxChange = peer.change24h || 0;
      topLeader = peer;
    }
  }
  const topMarketLeaderSpreadPct = Number((maxChange - benchmarkReturn24hPct).toFixed(2));

  let rawScore = 55 + rsSpread24hPct * 9 + symbolMomentum5BarPct * 3 + (aboveEma20 ? 10 : -8);
  const rsScore = Math.max(12, Math.min(98, Math.round(rawScore)));

  let rsTier: SpotRelativeStrengthReport['rsTier'] = 'INLINE';
  let badgeVi = '⚖️ SỨC MẠNH TRUNG TÍNH (ĐI CÙNG THỊ TRƯỜNG)';
  let adviceVi = `${symbolObj.symbol} đang biến động tương đương ${benchmarkSymbol}. Có thể giải ngân theo kế hoạch chia 3 đợt tại vùng hỗ trợ.`;

  if (rsScore >= 74 || rsSpread24hPct >= 1.5) {
    rsTier = 'LEADER';
    badgeVi = '👑 MÃ DẪN DẮT DÒNG TIỀN (RS LEADER)';
    adviceVi = `${symbolObj.symbol} mạnh hơn ${benchmarkSymbol} (${
      rsSpread24hPct >= 0 ? '+' : ''
    }${rsSpread24hPct}%). Khi thị trường chung rung lắc mã này giữ giá tốt nhất và bật tăng đầu tiên — Ưu tiên số 1 để đánh Spot!`;
  } else if (rsScore >= 60 || rsSpread24hPct >= 0.4) {
    rsTier = 'OUTPERFORM';
    badgeVi = '🔥 KHỎE HƠN THỊ TRƯỜNG CHUNG (OUTPERFORM)';
    adviceVi = `${symbolObj.symbol} có xung lực khỏe hơn ${benchmarkSymbol} (${
      rsSpread24hPct >= 0 ? '+' : ''
    }${rsSpread24hPct}%), giữ trên cấu trúc EMA20. Phù hợp gom Spot khi lùi nhẹ.`;
  } else if (rsScore < 45 || rsSpread24hPct <= -1.2) {
    rsTier = 'LAGGARD';
    badgeVi = '🐢 YẾU HƠN THỊ TRƯỜNG (LAGGARD — TRÁNH CHÔN VỐN)';
    adviceVi = `Cảnh báo: ${symbolObj.symbol} đang yếu hơn ${benchmarkSymbol} (${rsSpread24hPct}%). Mua Spot mã yếu dễ bị chôn vốn; cân nhắc ưu tiên mã dẫn dắt #1 hiện tại là ${topLeader.symbol}.`;
  }

  return {
    symbol: symbolObj.symbol,
    benchmarkSymbol,
    symbolReturn24hPct,
    benchmarkReturn24hPct,
    rsSpread24hPct,
    symbolMomentum5BarPct,
    rsScore,
    rsTier,
    badgeVi,
    topMarketLeaderSymbol: topLeader.symbol,
    topMarketLeaderSpreadPct,
    adviceVi,
  };
}

/**
 * Engine 3: 3-Stage Spot Scale-Out (40% / 40% / 20% Moonbag) & 0% Risk Free-Ride Plan
 */
export function buildSpotScaleOutAndFreeRidePlan(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  allocation: SpotCashAndLotAllocationReport;
  tp1Price?: number;
  tp2Price?: number;
  tp3Price?: number;
}): SpotScaleOutAndFreeRidePlan {
  const { symbolObj, candles, allocation } = params;
  const avgEntry = allocation.weightedAvgEntryPrice;
  const freeRideStopPrice = roundPrice(
    allocation.allInBreakevenPrice * 1.002,
    symbolObj
  );

  const closes = candles.map((c) => c.close);
  const ema20Series = calculateEMA(closes, 20);
  const lastEma20 = ema20Series.length > 0 ? ema20Series[ema20Series.length - 1] : null;
  const rawEma20 =
    lastEma20 !== null && Number.isFinite(lastEma20) ? lastEma20 : avgEntry * 0.985;
  const ema20TrailingStopPrice = roundPrice(rawEma20, symbolObj);

  const tp1 =
    params.tp1Price && params.tp1Price > avgEntry
      ? roundPrice(params.tp1Price, symbolObj)
      : roundPrice(avgEntry * 1.032, symbolObj);
  const tp2 =
    params.tp2Price && params.tp2Price > tp1
      ? roundPrice(params.tp2Price, symbolObj)
      : roundPrice(avgEntry * 1.068, symbolObj);
  const tp3 =
    params.tp3Price && params.tp3Price > tp2
      ? roundPrice(params.tp3Price, symbolObj)
      : roundPrice(avgEntry * 1.125, symbolObj);

  const totalQty = allocation.totalQuantity;
  const isVn = allocation.marketType === 'VN_STOCK';

  let qty1 = isVn ? Math.floor((totalQty * 0.4) / 100) * 100 : Number((totalQty * 0.4).toFixed(6));
  let qty2 = isVn ? Math.floor((totalQty * 0.4) / 100) * 100 : Number((totalQty * 0.4).toFixed(6));
  let qty3 = Math.max(0, Number((totalQty - qty1 - qty2).toFixed(6)));

  if (isVn && totalQty >= 100 && qty1 === 0) {
    qty1 = 100;
    qty2 = Math.max(0, totalQty - qty1);
    qty3 = 0;
  }

  const breakevenCashUnit = toCashUnitPrice(allocation.allInBreakevenPrice, allocation.marketType);

  const buildStep = (
    step: SpotScaleOutStep['step'],
    titleVi: string,
    sellPct: number,
    targetPrice: number,
    qty: number,
    instructionVi: string
  ): SpotScaleOutStep => {
    const targetCashUnit = toCashUnitPrice(targetPrice, allocation.marketType);
    const grossCash = qty * targetCashUnit;
    const netProfit = Math.max(0, (targetCashUnit - breakevenCashUnit) * qty);
    const gainPct =
      avgEntry > 0 ? Number((((targetPrice - avgEntry) / avgEntry) * 100).toFixed(2)) : 0;

    return {
      step,
      titleVi,
      sellPct,
      targetPrice,
      gainFromAvgEntryPct: gainPct,
      quantityToSell: qty,
      quantityToSellFormatted: formatQuantity(qty, allocation.marketType, symbolObj.symbol),
      netCashReceivedFormatted: formatCash(grossCash, allocation.currencyUnit),
      netProfitLockedFormatted: `+${formatCash(netProfit, allocation.currencyUnit)}`,
      actionInstructionVi: instructionVi,
    };
  };

  const steps: SpotScaleOutStep[] = [
    buildStep(
      'TP1_FREE_RIDE',
      'Bước 1 (TP1 • Khóa Lãi 40% & Đưa Kèo Về 0% Rủi Ro)',
      40,
      tp1,
      qty1,
      `Chốt 40% (${formatQuantity(
        qty1,
        allocation.marketType,
        symbolObj.symbol
      )}) đút túi lãi ròng, đồng thời dời điểm chặn của 60% hàng còn lại lên Giá Hòa Vốn + Phí (${freeRideStopPrice}) → Kèo đấu chính thức BẤT BẠI (0% rủi ro lỗ).`
    ),
    buildStep(
      'TP2_MAIN_HARVEST',
      'Bước 2 (TP2 • Thu Hoạch Chủ Lực 40%)',
      40,
      tp2,
      qty2,
      `Chốt tiếp 40% (${formatQuantity(
        qty2,
        allocation.marketType,
        symbolObj.symbol
      )}) tại vùng kháng cự mục tiêu để thu hồi gần như toàn bộ vốn + lãi lớn.`
    ),
    buildStep(
      'TP3_MOONBAG_EMA20',
      'Bước 3 (Moonbag 20% • Gồng Siêu Sóng Theo EMA20)',
      20,
      tp3,
      qty3,
      `Giữ 20% (${formatQuantity(
        qty3,
        allocation.marketType,
        symbolObj.symbol
      )}) còn lại gồng lãi tự do; chỉ bán khi chạm ${tp3} hoặc khi nến đóng cửa thủng đường EMA20 (${ema20TrailingStopPrice}).`
    ),
  ];

  return {
    freeRideStopPrice,
    ema20TrailingStopPrice,
    steps,
    summaryRuleVi:
      'Kỷ luật Vàng Spot: Chạm TP1 chốt 40% + khóa chặn lãi hòa vốn. Không bao giờ để một lệnh Spot đang lãi đẹp quay ngược thành lỗ!',
  };
}

/**
 * Engine 4: Cash-Is-King Circuit Breaker & Capitulation Catch Zone
 */
export function evaluateCashIsKingCircuitBreaker(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  allSymbols: MarketSymbol[];
}): CashIsKingCircuitBreakerReport {
  const { symbolObj, candles, allSymbols } = params;
  const isVn = isVnStockOrIndexSymbol(symbolObj);
  const isCrypto = isCryptoSymbol(symbolObj);

  const peers = allSymbols.filter((s) =>
    isVn ? isVnStockOrIndexSymbol(s) : isCrypto ? isCryptoSymbol(s) : true
  );
  const greenCount = peers.filter((s) => (s.change24h || 0) >= 0).length;
  const marketBreadthBullishPct =
    peers.length > 0 ? Math.round((greenCount / peers.length) * 100) : 50;

  const n = candles.length;
  const spotPrice = n > 0 ? candles[n - 1].close : symbolObj.price;
  const closes = candles.map((c) => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const rsi14Series = calculateRSI(candles, 14);
  const atr14Series = calculateATR(candles, 14);

  const rawE20 = ema20.length > 0 ? ema20[ema20.length - 1] : null;
  const latestEma20 = rawE20 !== null && Number.isFinite(rawE20) ? rawE20 : spotPrice;
  const rawE50 = ema50.length > 0 ? ema50[ema50.length - 1] : null;
  const latestEma50 = rawE50 !== null && Number.isFinite(rawE50) ? rawE50 : spotPrice;
  const rawRsiItem = rsi14Series.length > 0 ? rsi14Series[rsi14Series.length - 1] : null;
  const latestRsi =
    rawRsiItem && Number.isFinite(rawRsiItem.value) ? rawRsiItem.value : 50;
  const latestAtr =
    atr14Series.length > 0 && Number.isFinite(atr14Series[atr14Series.length - 1])
      ? atr14Series[atr14Series.length - 1]
      : spotPrice * 0.025;

  const belowBothEmas = spotPrice < latestEma20 && spotPrice < latestEma50;
  const sharpDrop = (symbolObj.change24h || 0) <= -3.5;

  // Capitulation Catch Zone: 2.2x to 3.4x ATR below current price (or -4.5% to -7.0% for VN stock / Coin flush)
  const capHighRaw = Math.min(spotPrice * 0.96, spotPrice - latestAtr * 2.1);
  const capLowRaw = Math.min(spotPrice * 0.935, spotPrice - latestAtr * 3.2);
  const capitulationCatchHighPrice = roundPrice(capHighRaw, symbolObj);
  const capitulationCatchLowPrice = roundPrice(capLowRaw, symbolObj);
  const capitulationDiscountPct = Number(
    (((spotPrice - capitulationCatchHighPrice) / Math.max(spotPrice, 1e-6)) * 100).toFixed(2)
  );

  const reasonsVi: string[] = [];
  let defenseState: CashIsKingCircuitBreakerReport['defenseState'] = 'OFFENSIVE_DEPLOY';
  let badgeVi = '🟢 THỊ TRƯỜNG THUẬN LỢI — CHO PHÉP GIẢI NGÂN SPOT (GIỮ 20–30% TIỀN MẶT)';
  let recommendedMinCashPct = 25;
  let recommendedMaxSpotDeployPct = 75;
  let actionDirectiveVi =
    'Cấu trúc xu hướng và độ rộng thị trường ủng hộ chiều Mua Spot. Giải ngân theo 3 đợt Limit và giữ 25% tiền mặt dự phòng.';

  if ((belowBothEmas && marketBreadthBullishPct <= 35) || sharpDrop) {
    defenseState = 'CASH_IS_KING_DEFENSE';
    badgeVi = '🛑 CẦU DAO NGẮT MẠCH BẬT: ƯU TIÊN CẦM 75%–100% TIỀN MẶT (CASH IS KING)';
    recommendedMinCashPct = 80;
    recommendedMaxSpotDeployPct = 20;
    if (belowBothEmas) {
      reasonsVi.push(`Giá đang nằm dưới cả EMA20 và EMA50 (Cấu trúc giảm ngắn-trung hạn).`);
    }
    if (marketBreadthBullishPct <= 35) {
      reasonsVi.push(`Độ rộng thị trường suy yếu: Chỉ có ${marketBreadthBullishPct}% mã giữ được sắc xanh.`);
    }
    if (sharpDrop) {
      reasonsVi.push(`Áp lực xả mạnh trong 24h (${symbolObj.change24h}%), rủi ro bắt dao rơi nếu vào lệnh sớm.`);
    }
    actionDirectiveVi = `Ngưng mua đuổi! Giữ tối thiểu 80% tiền mặt (${
      isVn ? 'VNĐ' : 'USDT'
    }) và chỉ kê sẵn lệnh Limit "vợt xác hoảng loạn" tại vùng ${capitulationCatchLowPrice} – ${capitulationCatchHighPrice}.`;
  } else if (spotPrice < latestEma20 || marketBreadthBullishPct < 50 || latestRsi > 72) {
    defenseState = 'SELECTIVE_CAUTIOUS';
    badgeVi = '🟡 PHÒNG THỦ CHỌN LỌC — GIỮ 50% TIỀN MẶT, CHỈ MUA KHI RŨ VỀ HỖ TRỢ';
    recommendedMinCashPct = 50;
    recommendedMaxSpotDeployPct = 50;
    reasonsVi.push(
      `Độ rộng thị trường ở mức phân hóa (${marketBreadthBullishPct}% mã xanh), RSI(14) = ${latestRsi.toFixed(
        1
      )}.`
    );
    actionDirectiveVi = `Giải ngân tối đa 50% sức mua vào các mã RS Leader; giữ 50% tiền mặt chờ nhịp rũ sâu hoặc kê sẵn vùng hoảng loạn ${capitulationCatchLowPrice} – ${capitulationCatchHighPrice}.`;
  } else {
    reasonsVi.push(
      `Giá giữ vững trên EMA20/EMA50 cùng độ rộng thị trường tích cực (${marketBreadthBullishPct}% mã xanh).`
    );
  }

  return {
    defenseState,
    badgeVi,
    recommendedMinCashPct,
    recommendedMaxSpotDeployPct,
    marketBreadthBullishPct,
    capitulationCatchLowPrice,
    capitulationCatchHighPrice,
    capitulationDiscountPct,
    reasonsVi,
    actionDirectiveVi,
  };
}

/**
 * Engine 5: Smart Dynamic DCA Valuation Multiplier (0x / 0.5x / 1.0x / 1.5x / 2.0x)
 */
export function calculateSmartDynamicDca(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  allocation: SpotCashAndLotAllocationReport;
}): SmartDynamicDcaReport {
  const { symbolObj, candles, allocation } = params;
  const n = candles.length;
  const spotPrice = n > 0 ? candles[n - 1].close : symbolObj.price;

  const closes = candles.map((c) => c.close);
  const rsiSeries = calculateRSI(candles, 14);
  const ema50Series = calculateEMA(closes, 50);
  const bb = calculateBollingerBands(candles, 20, 2);

  const lastRsiObj = rsiSeries.length > 0 ? rsiSeries[rsiSeries.length - 1] : null;
  const rsi14 = Number(
    (lastRsiObj && Number.isFinite(lastRsiObj.value) ? lastRsiObj.value : 50).toFixed(1)
  );
  const lastE50 = ema50Series.length > 0 ? ema50Series[ema50Series.length - 1] : null;
  const ema50 = lastE50 !== null && Number.isFinite(lastE50) ? lastE50 : spotPrice;
  const distanceFromEma50Pct = Number(
    (((spotPrice - ema50) / Math.max(ema50, 1e-6)) * 100).toFixed(2)
  );
  const lastBb = bb.length > 0 ? bb[bb.length - 1] : null;
  const lowerBb =
    lastBb && Number.isFinite(lastBb.lower) ? lastBb.lower : spotPrice * 0.96;

  // Base periodic DCA budget = 25% of input capital
  const basePeriodicBudget = allocation.inputCapital * 0.25;

  let dcaZone: SmartDynamicDcaReport['dcaZone'] = 'ACCUMULATION_STANDARD';
  let multiplier: SmartDynamicDcaReport['multiplier'] = 1;
  let zoneBadgeVi = '📦 VÙNG TÍCH SẢN TIÊU CHUẨN (HỆ SỐ 1.0x)';
  let rationaleVi = `RSI(14) = ${rsi14}, giá cách EMA50 ${
    distanceFromEma50Pct >= 0 ? '+' : ''
  }${distanceFromEma50Pct}%. Giải ngân đúng 1.0x định mức tích sản định kỳ.`;

  if (rsi14 >= 71 || distanceFromEma50Pct >= 7.5) {
    dcaZone = 'EUPHORIA_PAUSE';
    multiplier = 0;
    zoneBadgeVi = '⏸️ VÙNG HƯNG PHẤN QUÁ MUA — TẠM NGƯNG GOM DCA (HỆ SỐ 0x)';
    rationaleVi = `RSI(14) = ${rsi14} và giá đã kéo xa EMA50 (+${distanceFromEma50Pct}%). Không mua tích sản ở vùng giá hưng phấn; giữ tiền mặt chờ nhịp điều chỉnh.`;
  } else if (rsi14 <= 34 || spotPrice <= lowerBb * 1.005 || distanceFromEma50Pct <= -4.5) {
    dcaZone = 'DEEP_VALUE_DOUBLE';
    multiplier = 2;
    zoneBadgeVi = '💎 VÙNG CHIẾT KHẤU VÀNG / QUÁ BÁN — NHÂN ĐÔI ĐỊNH MỨC GOM (HỆ SỐ 2.0x)';
    rationaleVi = `RSI(14) = ${rsi14} về vùng quá bán / sát dải dưới Bollinger. Cơ hội gom được nhiều cổ phiếu/Coin giá rẻ nhất — Tăng gấp đôi (2.0x) định mức tích sản!`;
  } else if (rsi14 <= 44 || distanceFromEma50Pct <= -1.5) {
    dcaZone = 'ACCUMULATION_STANDARD';
    multiplier = 1.5;
    zoneBadgeVi = '🔥 VÙNG GIÁ CHIẾT KHẤU TỐT — TĂNG ĐỊNH MỨC GOM (HỆ SỐ 1.5x)';
    rationaleVi = `Giá điều chỉnh lành mạnh (${distanceFromEma50Pct}% so với EMA50, RSI ${rsi14}). Tăng hệ số giải ngân lên 1.5x định mức cơ sở.`;
  } else if (rsi14 >= 62 || distanceFromEma50Pct >= 3.5) {
    dcaZone = 'FAIR_VALUE_HALF';
    multiplier = 0.5;
    zoneBadgeVi = '⚖️ VÙNG GIÁ ĐÃ TĂNG — GIẢM NỬA ĐỊNH MỨC GOM (HỆ SỐ 0.5x)';
    rationaleVi = `Giá đang ở vùng cao ngắn hạn (RSI ${rsi14}). Chỉ gom 0.5x định mức cơ sở, giữ lại 50% tiền mặt phòng khi giá lùi về EMA20/EMA50.`;
  }

  const recommendedTodayDcaAmount = basePeriodicBudget * multiplier;
  const cashUnit = toCashUnitPrice(spotPrice, allocation.marketType);
  let dcaQty =
    allocation.marketType === 'VN_STOCK'
      ? Math.floor(recommendedTodayDcaAmount / Math.max(cashUnit, 1) / 100) * 100
      : Number((recommendedTodayDcaAmount / Math.max(cashUnit, 1e-8)).toFixed(6));

  return {
    dcaZone,
    multiplier,
    zoneBadgeVi,
    basePeriodicBudget,
    basePeriodicBudgetFormatted: formatCash(basePeriodicBudget, allocation.currencyUnit),
    recommendedTodayDcaAmount,
    recommendedTodayDcaFormatted: formatCash(recommendedTodayDcaAmount, allocation.currencyUnit),
    recommendedTodayQuantityFormatted: formatQuantity(
      dcaQty,
      allocation.marketType,
      symbolObj.symbol
    ),
    rsi14,
    distanceFromEma50Pct,
    rationaleVi,
  };
}

/**
 * Unified builder for the 5-Engine Pro Spot Suite (VN Stock & Crypto Coin)
 */
export function buildSpotProUpgradeSuite(params: {
  symbolObj: MarketSymbol;
  candles: Candle[];
  allSymbols: MarketSymbol[];
  capitalAmount?: number;
  stopLossPrice?: number;
  tp1Price?: number;
  tp2Price?: number;
  tp3Price?: number;
}): SpotProUpgradeSuiteReport {
  const cashAndLotAllocation = calculateSpotCashAndLotAllocation({
    symbolObj: params.symbolObj,
    candles: params.candles,
    capitalAmount: params.capitalAmount,
    stopLossPrice: params.stopLossPrice,
    tp1Price: params.tp1Price,
    tp2Price: params.tp2Price,
  });

  const relativeStrength = evaluateSpotRelativeStrength({
    symbolObj: params.symbolObj,
    candles: params.candles,
    allSymbols: params.allSymbols,
  });

  const scaleOutAndFreeRide = buildSpotScaleOutAndFreeRidePlan({
    symbolObj: params.symbolObj,
    candles: params.candles,
    allocation: cashAndLotAllocation,
    tp1Price: params.tp1Price,
    tp2Price: params.tp2Price,
    tp3Price: params.tp3Price,
  });

  const cashCircuitBreaker = evaluateCashIsKingCircuitBreaker({
    symbolObj: params.symbolObj,
    candles: params.candles,
    allSymbols: params.allSymbols,
  });

  const smartDynamicDca = calculateSmartDynamicDca({
    symbolObj: params.symbolObj,
    candles: params.candles,
    allocation: cashAndLotAllocation,
  });

  return {
    symbol: params.symbolObj.symbol,
    marketType: cashAndLotAllocation.marketType,
    cashAndLotAllocation,
    relativeStrength,
    scaleOutAndFreeRide,
    cashCircuitBreaker,
    smartDynamicDca,
  };
}
