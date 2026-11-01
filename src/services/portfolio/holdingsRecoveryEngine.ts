import { Candle, MarketSymbol } from '../../types';
import { calculateEMA } from '../indicators';
import { calculateSupportResistance } from '../analysis/supportResistance';
import { detectOrderBlocks } from '../analysis/smartMoney';
import { calculateVisibleVolumeProfile } from '../analysis/volumeProfileMtf';
import {
  ChartRecommendationVerdict,
  normalizeSmartPlanPrice,
} from '../ai/chartVerdictEngine';
import {
  getVnExchangeBoard,
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
  roundToVnTickSize,
  VnExchangeBoard,
} from '../vnMarket/vnStockMicrostructure';
import { getCachedGlobalInsights } from '../globalMarket/globalMarketInsightsClient';
import { pushLocalWorkspaceToCloud } from '../storage/cloudSyncClient';

export const USER_HOLDINGS_STORAGE_KEY = 'trading_new_user_holdings_v1';
export const USER_HOLDINGS_UPDATED_EVENT = 'trading_new_user_holdings_updated';

export interface UserHoldingItem {
  symbol: string;
  quantity: number;
  avgCostPrice: number; // Stored in chart price units (1,000 VND for VN corporate stocks, USD for Crypto/US)
  marginRatioPct: number; // 0..70 (% borrowed margin)
  holdingDays: number; // Days held (for margin interest & T+2.5 settlement check)
  extraDcaBudget: number | null; // Optional extra cash in Million VND (for VN) or USD (for Global/Crypto); null = auto 50% position match
  note?: string;
  updatedAtMs: number;
}

export type RecoveryPrimaryMode =
  | 'PROFIT_TRAILING_GUARD'
  | 'NEAR_SHORE_HOLD'
  | 'SMART_DCA_AT_SUPPORT'
  | 'T0_INVENTORY_SURFING'
  | 'ANTI_FALLING_KNIFE_VETO';

export interface OverheadObstacleItem {
  labelVi: string;
  price: number;
  distanceFromSpotPct: number;
}

export interface SmartDcaPlan {
  allowed: boolean;
  blockedReasonVi: string | null;
  dcaBuyPrice: number;
  dcaAnchorVi: string;
  addQuantity: number;
  additionalCapitalRequired: number; // Million VND for VN, USD for USD assets
  newTotalQuantity: number;
  newAvgCostPrice: number;
  newTrueBreakEvenPrice: number;
  oldGainNeededPct: number;
  newGainNeededPct: number;
  isReachableWithinTp2: boolean;
  dcaTrancheStopLoss: number;
  summaryVi: string;
}

export interface T0InventorySurfPlan {
  eligible: boolean;
  ineligibleReasonVi: string | null;
  surfQuantity: number;
  buySupportPrice: number;
  sellBouncePrice: number;
  grossSpreadPct: number;
  netSpreadAfterFeeTaxPct: number;
  netCashEarnedPerCycle: number; // Million VND for VN, USD for USD assets
  costReductionPerUnit: number;
  estimatedCyclesToBreakEven: number | null;
  summaryVi: string;
}

export interface DefensiveTrimPlan {
  trimQuantity: number;
  bounceTrimPrice: number;
  reentrySupportPrice: number;
  cashFreed: number; // Million VND for VN, USD for USD assets
  extraUnitsReacquired: number;
  hardStopLossPrice: number;
  summaryVi: string;
}

export interface PositionRecoveryPlan {
  symbol: string;
  isVN: boolean;
  isVnCorporateStock: boolean;
  isVnDerivative: boolean;
  currencyUnitLabel: string; // 'Tr VNĐ' | 'USD'
  priceUnitSuffix: string; // 'k' | ' đ' | ''
  quantityLabel: string; // 'CP' | 'HĐ' | 'ĐV'
  holding: UserHoldingItem;
  currentPrice: number;
  trueBreakEvenPrice: number;
  costBasisTotal: number; // Million VND for VN, USD for USD assets
  marketValueTotal: number;
  accruedFeeTaxAndMargin: number;
  netUnrealizedPnlValue: number;
  netUnrealizedPnlPct: number;
  gainRequiredToBreakEvenPct: number; // 0 if already at/above break-even
  difficultyGrade: 'IN_PROFIT' | 'EASY' | 'MODERATE' | 'HARD' | 'CRITICAL';
  difficultyLabelVi: string;
  primaryMode: RecoveryPrimaryMode;
  primaryBadgeVi: string;
  primaryHeadlineVi: string;
  actionStepsVi: string[];
  trailingStopForProfit: number | null;
  obstaclesBeforeBreakEven: OverheadObstacleItem[];
  smartDcaPlan: SmartDcaPlan;
  t0SurfPlan: T0InventorySurfPlan;
  defensiveTrimPlan: DefensiveTrimPlan;
}

function emitHoldingsUpdated(symbol?: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(USER_HOLDINGS_UPDATED_EVENT, { detail: { symbol } })
    );
  }
}

export function loadUserHoldings(): Record<string, UserHoldingItem> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(USER_HOLDINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, UserHoldingItem>;
  } catch {
    return {};
  }
}

export function getUserHoldingForSymbol(symbol: string): UserHoldingItem | null {
  if (!symbol) return null;
  const map = loadUserHoldings();
  return map[symbol.trim().toUpperCase()] ?? null;
}

/**
 * Auto-normalizes VN stock price input so whether the investor types `132.5` (k VND)
 * or `132500` (full VND), it seamlessly converts to the chart's `1,000 VND` unit.
 */
export function normalizeHoldingInputPrice(
  rawInputPrice: number,
  symbol: string,
  referenceChartPrice: number
): number {
  if (!Number.isFinite(rawInputPrice) || rawInputPrice <= 0) return 0;
  const symUpper = symbol.trim().toUpperCase();
  const isVnCorp =
    isVnStockOrIndexSymbol(symUpper) &&
    !isVnDerivativeSymbol(symUpper) &&
    !['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX'].includes(symUpper);

  if (
    isVnCorp &&
    rawInputPrice >= 1000 &&
    referenceChartPrice > 0 &&
    referenceChartPrice < 1000 &&
    rawInputPrice / referenceChartPrice > 25
  ) {
    return Number((rawInputPrice / 1000).toFixed(2));
  }
  return rawInputPrice;
}

export function saveUserHolding(
  input: Omit<UserHoldingItem, 'updatedAtMs'>,
  referenceChartPrice: number = 0
): UserHoldingItem | null {
  const symUpper = (input.symbol || '').trim().toUpperCase();
  if (!symUpper || !Number.isFinite(input.quantity) || input.quantity <= 0) {
    return null;
  }
  const normalizedAvg = normalizeHoldingInputPrice(
    input.avgCostPrice,
    symUpper,
    referenceChartPrice
  );
  if (normalizedAvg <= 0) return null;

  const cleanItem: UserHoldingItem = {
    symbol: symUpper,
    quantity: Number(input.quantity),
    avgCostPrice: normalizedAvg,
    marginRatioPct: Math.max(0, Math.min(80, Number(input.marginRatioPct) || 0)),
    holdingDays: Math.max(0, Math.round(Number(input.holdingDays) || 3)),
    extraDcaBudget:
      input.extraDcaBudget !== null &&
      input.extraDcaBudget !== undefined &&
      Number(input.extraDcaBudget) >= 0
        ? Number(input.extraDcaBudget)
        : null,
    note: input.note?.trim() || undefined,
    updatedAtMs: Date.now(),
  };

  const map = loadUserHoldings();
  map[symUpper] = cleanItem;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(USER_HOLDINGS_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore quota error
    }
  }
  emitHoldingsUpdated(symUpper);
  if (typeof window !== 'undefined') {
    void pushLocalWorkspaceToCloud();
  }
  return cleanItem;
}

export function removeUserHolding(symbol: string): void {
  const symUpper = (symbol || '').trim().toUpperCase();
  if (!symUpper) return;
  const map = loadUserHoldings();
  if (!(symUpper in map)) return;
  delete map[symUpper];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(USER_HOLDINGS_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }
  emitHoldingsUpdated(symUpper);
  if (typeof window !== 'undefined') {
    void pushLocalWorkspaceToCloud();
  }
}

function roundQuantityForMarket(
  rawQty: number,
  isVnCorporateStock: boolean,
  isVnDerivative: boolean
): number {
  if (!Number.isFinite(rawQty) || rawQty <= 0) return 0;
  if (isVnCorporateStock) {
    // Official HOSE/HNX/UPCOM board lot = 100 shares
    return Math.max(100, Math.round(rawQty / 100) * 100);
  }
  if (isVnDerivative) {
    return Math.max(1, Math.round(rawQty));
  }
  if (rawQty >= 100) return Math.round(rawQty);
  if (rawQty >= 1) return Number(rawQty.toFixed(2));
  return Number(rawQty.toFixed(4));
}

function fmtPriceInline(
  price: number,
  isVN: boolean,
  isVnIdxOrDeriv: boolean
): string {
  if (!Number.isFinite(price) || price <= 0) return '—';
  if (isVN) {
    return isVnIdxOrDeriv ? `${price.toFixed(1)} đ` : `${price.toFixed(2)}k`;
  }
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toPrecision(4)}`;
}

/**
 * Deterministic Institutional Position Recovery ("Chiến Lược Về Bờ") & Profit-Guard Engine.
 * Combines real transaction fees, taxes, margin carry, 6-Pillar Chart Verdict, VPVR, SMC, and Options Walls.
 */
export function evaluatePositionRecovery(params: {
  holding: UserHoldingItem;
  symbolObj: MarketSymbol;
  candles: Candle[];
  chartVerdict: ChartRecommendationVerdict;
}): PositionRecoveryPlan {
  const { holding, symbolObj, candles, chartVerdict } = params;
  const symUpper = holding.symbol.trim().toUpperCase();
  const isVN = isVnStockOrIndexSymbol(symbolObj) || symbolObj.quoteAsset === 'VND';
  const isVnDeriv = isVnDerivativeSymbol(symUpper);
  const isVnIdx = ['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX'].includes(symUpper);
  const isVnCorp = isVN && !isVnDeriv && !isVnIdx;
  const isVnIdxOrDeriv = isVnDeriv || isVnIdx;
  const vnBoard: VnExchangeBoard | null = isVN ? getVnExchangeBoard(symUpper) : null;

  const currentPrice = chartVerdict.currentPrice || symbolObj.price || holding.avgCostPrice;
  const avgCost = normalizeHoldingInputPrice(holding.avgCostPrice, symUpper, currentPrice);
  const qty = holding.quantity;

  // Value conversion factor:
  // - VN corporate stock: price (in 1,000 VND) * shares / 1,000 = Million VND (Triệu VNĐ)
  // - VN30F1M derivative: points * contracts * 0.1 = Million VND (1 point = 100k VND)
  // - Crypto / US Stock: price * qty = USD
  const unitValueScale = isVnCorp ? 0.001 : isVnDeriv ? 0.1 : isVnIdx ? 0.001 : 1;
  const currencyUnitLabel = isVN ? 'Tr VNĐ' : 'USD';
  const priceUnitSuffix = isVN ? (isVnIdxOrDeriv ? ' đ' : 'k') : '';
  const quantityLabel = isVnCorp ? 'CP' : isVnDeriv ? 'HĐ' : symbolObj.type === 'stock' ? 'CP' : 'ĐV';

  // Real fee + sell tax + margin carry rates
  const buyFeeRate = isVnCorp ? 0.0015 : isVnDeriv ? 0.0002 : symbolObj.type === 'crypto' ? 0.001 : 0.0002;
  const exitFeeAndTaxRate = isVnCorp
    ? 0.0025 // 0.15% broker sell fee + 0.10% VN personal income tax on securities transfer
    : isVnDeriv
    ? 0.0002
    : symbolObj.type === 'crypto'
    ? 0.001
    : 0.0003;
  const annualMarginRate = isVN ? 0.135 : 0.08;
  const marginCarryRate =
    (Math.max(0, holding.marginRatioPct) / 100) *
    annualMarginRate *
    (Math.max(0, holding.holdingDays) / 365);

  const rawTrueBreakEven = (avgCost * (1 + buyFeeRate + marginCarryRate)) / (1 - exitFeeAndTaxRate);
  const trueBreakEvenPrice =
    vnBoard && vnBoard !== 'INDEX'
      ? roundToVnTickSize(rawTrueBreakEven, vnBoard)
      : normalizeSmartPlanPrice(rawTrueBreakEven, symbolObj, vnBoard);

  const rawCostBasis = avgCost * qty * unitValueScale;
  const grossMarketVal = currentPrice * qty * unitValueScale;
  const entryFeeAndMarginVal = rawCostBasis * (buyFeeRate + marginCarryRate);
  const exitFeeAndTaxVal = grossMarketVal * exitFeeAndTaxRate;
  const accruedFeeTaxAndMargin = Number((entryFeeAndMarginVal + exitFeeAndTaxVal).toFixed(3));

  const netMarketExitVal = grossMarketVal - exitFeeAndTaxVal;
  const totalEffectiveCost = rawCostBasis + entryFeeAndMarginVal;
  const netUnrealizedPnlValue = Number((netMarketExitVal - totalEffectiveCost).toFixed(2));
  const netUnrealizedPnlPct =
    totalEffectiveCost > 0
      ? Number(((netUnrealizedPnlValue / totalEffectiveCost) * 100).toFixed(2))
      : 0;

  const gainRequiredToBreakEvenPct =
    currentPrice > 0 && trueBreakEvenPrice > currentPrice
      ? Number((((trueBreakEvenPrice - currentPrice) / currentPrice) * 100).toFixed(2))
      : 0;

  // ==========================================================================
  // SCAN STRUCTURAL OVERHEAD OBSTACLES BETWEEN CURRENT PRICE & BREAK-EVEN
  // ==========================================================================
  const obstacles: OverheadObstacleItem[] = [];
  if (trueBreakEvenPrice > currentPrice * 1.005 && candles.length >= 25) {
    const vpvr = calculateVisibleVolumeProfile(candles, 24, 0.7);
    if (vpvr) {
      if (vpvr.pocPrice > currentPrice * 1.004 && vpvr.pocPrice < trueBreakEvenPrice * 0.997) {
        obstacles.push({
          labelVi: 'Cản thanh khoản lớn VPVR POC',
          price: normalizeSmartPlanPrice(vpvr.pocPrice, symbolObj, vnBoard),
          distanceFromSpotPct: Number((((vpvr.pocPrice - currentPrice) / currentPrice) * 100).toFixed(1)),
        });
      }
      if (vpvr.vahPrice > currentPrice * 1.004 && vpvr.vahPrice < trueBreakEvenPrice * 0.997) {
        obstacles.push({
          labelVi: 'Biên trên vùng giá trị VPVR VAH',
          price: normalizeSmartPlanPrice(vpvr.vahPrice, symbolObj, vnBoard),
          distanceFromSpotPct: Number((((vpvr.vahPrice - currentPrice) / currentPrice) * 100).toFixed(1)),
        });
      }
    }

    const closes = candles.map((c) => c.close);
    const ema50 = calculateEMA(closes, Math.min(50, closes.length));
    const ema200 = calculateEMA(closes, Math.min(200, closes.length));
    const lastE50 = ema50[ema50.length - 1];
    const lastE200 = ema200[ema200.length - 1];

    if (lastE50 && lastE50 > currentPrice * 1.006 && lastE50 < trueBreakEvenPrice * 0.995) {
      obstacles.push({
        labelVi: 'Đường trung bình EMA 50',
        price: normalizeSmartPlanPrice(lastE50, symbolObj, vnBoard),
        distanceFromSpotPct: Number((((lastE50 - currentPrice) / currentPrice) * 100).toFixed(1)),
      });
    }
    if (lastE200 && lastE200 > currentPrice * 1.006 && lastE200 < trueBreakEvenPrice * 0.995) {
      obstacles.push({
        labelVi: 'Cản xu hướng dài hạn EMA 200',
        price: normalizeSmartPlanPrice(lastE200, symbolObj, vnBoard),
        distanceFromSpotPct: Number((((lastE200 - currentPrice) / currentPrice) * 100).toFixed(1)),
      });
    }

    const obs = detectOrderBlocks(candles);
    const bearOb = obs.find(
      (o) =>
        (o.type === 'bearish_ob' || o.type === 'fvg_bear') &&
        !o.mitigated &&
        o.bottom > currentPrice * 1.005 &&
        o.bottom < trueBreakEvenPrice * 0.996
    );
    if (bearOb) {
      obstacles.push({
        labelVi: 'Khối lệnh bán tổ chức Bearish OB',
        price: normalizeSmartPlanPrice(bearOb.bottom, symbolObj, vnBoard),
        distanceFromSpotPct: Number((((bearOb.bottom - currentPrice) / currentPrice) * 100).toFixed(1)),
      });
    }

    const srs = calculateSupportResistance(candles);
    for (const r of srs) {
      if (
        r.type === 'resistance' &&
        r.price > currentPrice * 1.006 &&
        r.price < trueBreakEvenPrice * 0.996
      ) {
        obstacles.push({
          labelVi: 'Kháng cự đỉnh cũ S/R',
          price: normalizeSmartPlanPrice(r.price, symbolObj, vnBoard),
          distanceFromSpotPct: Number((((r.price - currentPrice) / currentPrice) * 100).toFixed(1)),
        });
        break;
      }
    }

    if (!chartVerdict.isReplayMode) {
      const gOpt = getCachedGlobalInsights(symUpper)?.optionsSummary;
      if (
        gOpt?.callWallPrice &&
        gOpt.callWallPrice > currentPrice * 1.005 &&
        gOpt.callWallPrice < trueBreakEvenPrice * 0.997
      ) {
        obstacles.push({
          labelVi: `Tường quyền chọn Call Wall`,
          price: gOpt.callWallPrice,
          distanceFromSpotPct: Number(
            (((gOpt.callWallPrice - currentPrice) / currentPrice) * 100).toFixed(1)
          ),
        });
      }
    }
  }

  // Deduplicate close obstacles within 0.8% of each other and sort ascending
  const sortedObstacles: OverheadObstacleItem[] = [];
  for (const item of obstacles.sort((a, b) => a.price - b.price)) {
    const prev = sortedObstacles[sortedObstacles.length - 1];
    if (!prev || Math.abs(item.price - prev.price) / prev.price >= 0.008) {
      sortedObstacles.push(item);
    }
  }
  const topObstacles = sortedObstacles.slice(0, 4);

  // ==========================================================================
  // SCENARIO 1: STRUCTURE-ANCHORED SMART DCA PLAN
  // ==========================================================================
  const hasBearishBreakdown =
    chartVerdict.directionalBiasScore <= -18 ||
    chartVerdict.verdictCode === 'REDUCE_TAKE_PROFIT' ||
    chartVerdict.verdictCode === 'SELL_SHORT';
  const hasEventHardVeto = chartVerdict.vetoes.some(
    (v) => v.code === 'US_IMMINENT_EARNINGS' && v.severity === 'HARD_VETO'
  );
  const isOverMarginLimit = holding.marginRatioPct >= 50;

  const dcaAllowed =
    netUnrealizedPnlPct < -1.0 &&
    !hasBearishBreakdown &&
    !hasEventHardVeto &&
    !isOverMarginLimit &&
    (holding.extraDcaBudget === null || holding.extraDcaBudget > 0);

  let dcaBlockedReasonVi: string | null = null;
  if (netUnrealizedPnlPct >= -1.0) {
    dcaBlockedReasonVi = 'Vị thế đang có lãi hoặc sát giá hòa vốn — Không cần mua trung bình giá.';
  } else if (hasEventHardVeto) {
    dcaBlockedReasonVi =
      'CẤM DCA: Cổ phiếu sắp công bố BCTC (≤ 2 ngày) với rủi ro nhảy Gap lớn hai chiều.';
  } else if (hasBearishBreakdown) {
    dcaBlockedReasonVi = `CẤM BẮT DAO RƠI: Hội đồng 6 tầng đang báo suy yếu (${chartVerdict.directionalBiasScore} điểm) — Tuyệt đối không nạp thêm tiền bình quân giá lúc này.`;
  } else if (isOverMarginLimit) {
    dcaBlockedReasonVi = `CẤM DCA THÊM: Tỷ lệ vay Margin đang cao (${holding.marginRatioPct}%) — Ưu tiên an toàn tài khoản tránh Call Margin / Force Sell.`;
  } else if (holding.extraDcaBudget === 0) {
    dcaBlockedReasonVi = 'Ngân sách tiền mặt dự phòng đang đặt bằng 0 — Ưu tiên phương án Lướt T+0 trên kho có sẵn.';
  }

  // Anchor DCA buy price at real support below/near currentPrice
  const rawDcaPrice = !chartVerdict.isShortPlan
    ? Math.min(currentPrice, chartVerdict.entryZone[1])
    : currentPrice * 0.96;
  const dcaBuyPrice = normalizeSmartPlanPrice(rawDcaPrice, symbolObj, vnBoard);

  // Determine DCA quantity from either user's extraDcaBudget or optimal 60% position match
  let rawAddQty = qty * 0.6;
  if (holding.extraDcaBudget !== null && holding.extraDcaBudget > 0 && dcaBuyPrice > 0) {
    rawAddQty = holding.extraDcaBudget / (dcaBuyPrice * unitValueScale * (1 + buyFeeRate));
  }
  const addQuantity = roundQuantityForMarket(rawAddQty, isVnCorp, isVnDeriv);
  const additionalCapitalRequired = Number(
    (addQuantity * dcaBuyPrice * unitValueScale * (1 + buyFeeRate)).toFixed(2)
  );
  const newTotalQuantity = Number((qty + addQuantity).toFixed(4));
  const rawNewAvg =
    newTotalQuantity > 0 ? (qty * avgCost + addQuantity * dcaBuyPrice) / newTotalQuantity : avgCost;
  const newAvgCostPrice = normalizeSmartPlanPrice(rawNewAvg, symbolObj, vnBoard);
  const rawNewBe =
    (rawNewAvg * (1 + buyFeeRate) +
      (qty * avgCost * marginCarryRate) / Math.max(1e-8, newTotalQuantity)) /
    (1 - exitFeeAndTaxRate);
  const newTrueBreakEvenPrice = normalizeSmartPlanPrice(rawNewBe, symbolObj, vnBoard);
  const newGainNeededPct =
    dcaBuyPrice > 0 && newTrueBreakEvenPrice > dcaBuyPrice
      ? Number((((newTrueBreakEvenPrice - dcaBuyPrice) / dcaBuyPrice) * 100).toFixed(2))
      : 0;

  const targetBounceRef = !chartVerdict.isShortPlan
    ? chartVerdict.takeProfit2
    : currentPrice * 1.04;
  const isReachableWithinTp2 = newTrueBreakEvenPrice <= targetBounceRef * 1.005;
  const dcaTrancheStopLoss = !chartVerdict.isShortPlan
    ? chartVerdict.stopLoss
    : normalizeSmartPlanPrice(dcaBuyPrice * 0.95, symbolObj, vnBoard);

  const smartDcaPlan: SmartDcaPlan = {
    allowed: dcaAllowed,
    blockedReasonVi: dcaBlockedReasonVi,
    dcaBuyPrice,
    dcaAnchorVi: !chartVerdict.isShortPlan ? chartVerdict.entryAnchorVi : 'Hỗ trợ kỹ thuật dưới',
    addQuantity,
    additionalCapitalRequired,
    newTotalQuantity,
    newAvgCostPrice,
    newTrueBreakEvenPrice,
    oldGainNeededPct: gainRequiredToBreakEvenPct,
    newGainNeededPct,
    isReachableWithinTp2,
    dcaTrancheStopLoss,
    summaryVi: dcaAllowed
      ? `Mua kê thêm ${addQuantity.toLocaleString('en-US')} ${quantityLabel} tại ${fmtPriceInline(dcaBuyPrice, isVN, isVnIdxOrDeriv)} (${chartVerdict.entryAnchorVi}, cần ${additionalCapitalRequired.toLocaleString('en-US')} ${currencyUnitLabel}) → Hạ giá hòa vốn thực từ ${fmtPriceInline(trueBreakEvenPrice, isVN, isVnIdxOrDeriv)} xuống ${fmtPriceInline(newTrueBreakEvenPrice, isVN, isVnIdxOrDeriv)} (chỉ cần hồi +${newGainNeededPct}% là về bờ${isReachableWithinTp2 ? ' — nằm gọn trong mục tiêu sóng hồi TP2!' : ''}). Cắt ngay lô mua thêm nếu thủng ${fmtPriceInline(dcaTrancheStopLoss, isVN, isVnIdxOrDeriv)}.`
      : dcaBlockedReasonVi || 'Chưa đủ điều kiện an toàn để trung bình giá.',
  };

  // ==========================================================================
  // SCENARIO 2: T+0 INVENTORY SURFING (LƯỚT HẠ GIÁ VỐN TRÊN HÀNG CÓ SẴN)
  // ==========================================================================
  const isVnSettled = !isVnCorp || holding.holdingDays >= 3;
  const surfEligible =
    netUnrealizedPnlPct < -1.0 &&
    isVnSettled &&
    (!isVnCorp || qty >= 100) &&
    !hasEventHardVeto;

  const surfQuantity = roundQuantityForMarket(qty * 0.3, isVnCorp, isVnDeriv);
  const rawSurfBuy = Math.min(
    currentPrice * 0.992,
    !chartVerdict.isShortPlan ? chartVerdict.entryZone[0] : currentPrice * 0.98
  );
  const buySupportPrice = normalizeSmartPlanPrice(rawSurfBuy, symbolObj, vnBoard);

  const minProfitableBounce = buySupportPrice * (1 + buyFeeRate + exitFeeAndTaxRate + 0.022);
  const rawSurfSell = !chartVerdict.isShortPlan
    ? Math.max(minProfitableBounce, Math.min(trueBreakEvenPrice, chartVerdict.takeProfit1))
    : minProfitableBounce;
  const sellBouncePrice = normalizeSmartPlanPrice(rawSurfSell, symbolObj, vnBoard);

  const grossSpreadPct =
    buySupportPrice > 0
      ? Number((((sellBouncePrice - buySupportPrice) / buySupportPrice) * 100).toFixed(2))
      : 0;
  const roundTripFrictionPct = (buyFeeRate + exitFeeAndTaxRate) * 100;
  const netSpreadAfterFeeTaxPct = Number(
    Math.max(0, grossSpreadPct - roundTripFrictionPct).toFixed(2)
  );
  const netCashEarnedPerCycle = Number(
    Math.max(
      0,
      surfQuantity *
        (sellBouncePrice * (1 - exitFeeAndTaxRate) - buySupportPrice * (1 + buyFeeRate)) *
        unitValueScale
    ).toFixed(3)
  );
  const costReductionPerUnit =
    qty > 0 && unitValueScale > 0
      ? Number((netCashEarnedPerCycle / (qty * unitValueScale)).toFixed(4))
      : 0;

  const priceGapToBreakEven = Math.max(0, trueBreakEvenPrice - currentPrice);
  const estimatedCyclesToBreakEven =
    costReductionPerUnit > 0 && priceGapToBreakEven > 0
      ? Math.min(25, Math.max(1, Math.ceil(priceGapToBreakEven / costReductionPerUnit)))
      : null;

  const t0SurfPlan: T0InventorySurfPlan = {
    eligible: surfEligible,
    ineligibleReasonVi: !isVnSettled
      ? `Hàng cơ sở VN mới nắm giữ ${holding.holdingDays} ngày (chưa đủ T+2.5 về tài khoản) — Chờ hàng khả dụng mới lướt T+0 được.`
      : isVnCorp && qty < 100
      ? 'Khối lượng lô lẻ (< 100 CP) khó khớp nhanh để lướt T+0 trong phiên.'
      : hasEventHardVeto
      ? 'Tạm ngưng lướt T+0 trước giờ công bố BCTC.'
      : null,
    surfQuantity,
    buySupportPrice,
    sellBouncePrice,
    grossSpreadPct,
    netSpreadAfterFeeTaxPct,
    netCashEarnedPerCycle,
    costReductionPerUnit,
    estimatedCyclesToBreakEven,
    summaryVi: surfEligible
      ? `Dùng sức mua lướt ${surfQuantity.toLocaleString('en-US')} ${quantityLabel} (30% kho): Kê mua tại ${fmtPriceInline(buySupportPrice, isVN, isVnIdxOrDeriv)} và bán ra ngay ${surfQuantity.toLocaleString('en-US')} ${quantityLabel} hàng có sẵn khi nảy lên ${fmtPriceInline(sellBouncePrice, isVN, isVnIdxOrDeriv)} (+${netSpreadAfterFeeTaxPct}% ròng sau phí/thuế) → Thu về ${netCashEarnedPerCycle.toLocaleString('en-US')} ${currencyUnitLabel}/vòng, giữ nguyên tổng lượng cổ phiếu không sợ kẹp thêm${estimatedCyclesToBreakEven ? ` (~${estimatedCyclesToBreakEven} vòng là hạ giá vốn về bờ)` : ''}.`
      : !isVnSettled
      ? `Chờ hàng về tài khoản khả dụng (T+2.5) để mở khóa chiến thuật lướt T+0 hạ giá vốn.`
      : 'Chưa phù hợp lướt T+0 ở trạng thái hiện tại.',
  };

  // ==========================================================================
  // SCENARIO 3: DEFENSIVE TRIM ON BOUNCE & RE-COVER LOWER (WHEN BEARISH)
  // ==========================================================================
  const trimQuantity = roundQuantityForMarket(qty * 0.4, isVnCorp, isVnDeriv);
  const rawBounceTrim = hasBearishBreakdown
    ? Math.max(currentPrice, chartVerdict.entryZone[1])
    : Math.max(currentPrice * 1.015, chartVerdict.takeProfit1);
  const bounceTrimPrice = normalizeSmartPlanPrice(rawBounceTrim, symbolObj, vnBoard);

  const rawReentrySup = hasBearishBreakdown
    ? Math.min(currentPrice * 0.93, chartVerdict.takeProfit1)
    : Math.min(currentPrice * 0.94, chartVerdict.stopLoss);
  const reentrySupportPrice = normalizeSmartPlanPrice(rawReentrySup, symbolObj, vnBoard);

  const netProceedsFromTrim = trimQuantity * bounceTrimPrice * (1 - exitFeeAndTaxRate);
  const sharesReboughtWithSameCash =
    reentrySupportPrice > 0
      ? netProceedsFromTrim / (reentrySupportPrice * (1 + buyFeeRate))
      : trimQuantity;
  const extraUnitsReacquired = Number(
    Math.max(0, sharesReboughtWithSameCash - trimQuantity).toFixed(2)
  );
  const cashFreed = Number((netProceedsFromTrim * unitValueScale).toFixed(2));
  const hardStopLossPrice = hasBearishBreakdown
    ? normalizeSmartPlanPrice(currentPrice * 0.965, symbolObj, vnBoard)
    : chartVerdict.stopLoss;

  const defensiveTrimPlan: DefensiveTrimPlan = {
    trimQuantity,
    bounceTrimPrice,
    reentrySupportPrice,
    cashFreed,
    extraUnitsReacquired,
    hardStopLossPrice,
    summaryVi: `Canh nhịp hồi kỹ thuật lên ${fmtPriceInline(bounceTrimPrice, isVN, isVnIdxOrDeriv)} hạ ${trimQuantity.toLocaleString('en-US')} ${quantityLabel} (thu về ${cashFreed.toLocaleString('en-US')} ${currencyUnitLabel} tiền mặt bảo vệ tài khoản). Chờ tạo đáy xác nhận quanh ${fmtPriceInline(reentrySupportPrice, isVN, isVnIdxOrDeriv)} dùng chính số tiền đó gom lại được nhiều hơn +${extraUnitsReacquired.toLocaleString('en-US')} ${quantityLabel} mà không tốn thêm vốn mới.`,
  };

  // ==========================================================================
  // DETERMINE DIFFICULTY GRADE & PRIMARY RECOMMENDED ACTION PLAN
  // ==========================================================================
  let difficultyGrade: PositionRecoveryPlan['difficultyGrade'] = 'EASY';
  let difficultyLabelVi = 'Dễ về bờ (Sát giá hòa vốn)';
  if (netUnrealizedPnlPct >= 0) {
    difficultyGrade = 'IN_PROFIT';
    difficultyLabelVi = 'Đang có lãi ròng (Bảo vệ thành quả)';
  } else if (gainRequiredToBreakEvenPct <= 5 && topObstacles.length <= 1) {
    difficultyGrade = 'EASY';
    difficultyLabelVi = `Khả thi cao (Cần +${gainRequiredToBreakEvenPct}% • Ít cản)`;
  } else if (gainRequiredToBreakEvenPct <= 14 && !hasBearishBreakdown) {
    difficultyGrade = 'MODERATE';
    difficultyLabelVi = `Trung bình (Cần +${gainRequiredToBreakEvenPct}% • ${topObstacles.length} cản trên)`;
  } else if (gainRequiredToBreakEvenPct <= 28) {
    difficultyGrade = 'HARD';
    difficultyLabelVi = `Khó nếu chỉ gồng thụ động (Cần +${gainRequiredToBreakEvenPct}%)`;
  } else {
    difficultyGrade = 'CRITICAL';
    difficultyLabelVi = `Âm sâu — Cần cơ cấu chủ động từng bước (Cần +${gainRequiredToBreakEvenPct}%)`;
  }

  let primaryMode: RecoveryPrimaryMode = 'NEAR_SHORE_HOLD';
  let primaryBadgeVi = 'SÁT BỜ — KIÊN NHẪN NẮM GIỮ';
  let primaryHeadlineVi = 'Vị thế đang rất sát ngưỡng hòa vốn — Kiên nhẫn nắm giữ theo kỷ luật.';
  let trailingStopForProfit: number | null = null;
  const actionStepsVi: string[] = [];

  if (netUnrealizedPnlPct >= 0.25) {
    primaryMode = 'PROFIT_TRAILING_GUARD';
    primaryBadgeVi = 'ĐANG LÃI — CHẶN LÃI & GỒNG SÓNG';
    const rawTrail = !chartVerdict.isShortPlan
      ? Math.max(trueBreakEvenPrice, chartVerdict.stopLoss)
      : trueBreakEvenPrice;
    trailingStopForProfit = normalizeSmartPlanPrice(rawTrail, symbolObj, vnBoard);
    primaryHeadlineVi = `Vị thế đang lãi ròng +${netUnrealizedPnlValue.toLocaleString('en-US')} ${currencyUnitLabel} (+${netUnrealizedPnlPct}%) sau khi trừ toàn bộ phí/thuế.`;
    actionStepsVi.push(
      `Dời điểm Chặn Lãi (Trailing Stop) lên tối thiểu ${fmtPriceInline(trailingStopForProfit, isVN, isVnIdxOrDeriv)} để khóa chặt trạng thái không thể lỗ ngược.`
    );
    if (!chartVerdict.isShortPlan) {
      actionStepsVi.push(
        `Chốt lời từng phần 40%–50% khối lượng khi giá chạm vùng kháng cự ${fmtPriceInline(chartVerdict.takeProfit1, isVN, isVnIdxOrDeriv)} (${chartVerdict.tpAnchorVi}), phần còn lại gồng tới ${fmtPriceInline(chartVerdict.takeProfit2, isVN, isVnIdxOrDeriv)}.`
      );
    } else {
      actionStepsVi.push(
        `Cấu trúc ngắn hạn đang xuất hiện áp lực cung (${chartVerdict.verdictLabelVi}) — Ưu tiên hiện thực hóa 50%–70% lợi nhuận quanh vùng giá hiện tại.`
      );
    }
  } else if (netUnrealizedPnlPct >= -1.5 && !hasBearishBreakdown) {
    primaryMode = 'NEAR_SHORE_HOLD';
    primaryBadgeVi = 'SÁT GIÁ VỐN — GIỮ KỶ LUẬT';
    primaryHeadlineVi = `Chỉ còn cách giá hòa vốn thực (+phí/thuế) +${gainRequiredToBreakEvenPct}% (${fmtPriceInline(trueBreakEvenPrice, isVN, isVnIdxOrDeriv)}).`;
    actionStepsVi.push(
      `Không cần mua trung bình giá thêm để tránh phát sinh phí giao dịch không cần thiết.`
    );
    actionStepsVi.push(
      `Đặt mốc quản trị rủi ro tại ${fmtPriceInline(chartVerdict.stopLoss, isVN, isVnIdxOrDeriv)} (${chartVerdict.slAnchorVi}) và chờ nhịp đẩy qua ${fmtPriceInline(trueBreakEvenPrice, isVN, isVnIdxOrDeriv)}.`
    );
  } else if (hasBearishBreakdown || hasEventHardVeto || isOverMarginLimit) {
    primaryMode = 'ANTI_FALLING_KNIFE_VETO';
    primaryBadgeVi = hasEventHardVeto
      ? 'NÉ GAP BCTC — KHÔNG BÌNH QUÂN GIÁ'
      : isOverMarginLimit
      ? 'HẠ MARGIN AN TOÀN — CẤM DCA'
      : 'CẤM BẮT DAO RƠI — CƠ CẤU NHỊP HỒI';
    primaryHeadlineVi =
      dcaBlockedReasonVi ||
      'Xu hướng đang bất lợi — Ưu tiên bảo vệ sức mua và hạ tỷ trọng khi có nhịp hồi kỹ thuật.';
    actionStepsVi.push(defensiveTrimPlan.summaryVi);
    if (holding.marginRatioPct > 0) {
      actionStepsVi.push(
        `Đưa tỷ lệ vay Margin (${holding.marginRatioPct}%) về 0% trước tiên để triệt tiêu chi phí lãi vay ăn mòn giá vốn mỗi ngày.`
      );
    }
    actionStepsVi.push(
      `Mốc phòng thủ tối hậu: Nếu giá đóng cửa thủng dứt khoát ${fmtPriceInline(defensiveTrimPlan.hardStopLossPrice, isVN, isVnIdxOrDeriv)}, bắt buộc thu hẹp vị thế bảo toàn vốn gốc.`
    );
  } else if (
    (holding.extraDcaBudget === 0 ||
      (chartVerdict.directionalBiasScore >= -17 && chartVerdict.directionalBiasScore < 16)) &&
    t0SurfPlan.eligible
  ) {
    primaryMode = 'T0_INVENTORY_SURFING';
    primaryBadgeVi = 'LƯỚT T+0 TRÊN HÀNG CÓ SẴN';
    primaryHeadlineVi = `Thị trường đang đi ngang tích lũy — Tối ưu nhất là lướt T+0 hạ giá vốn trên kho sẵn có mà không tăng tổng rủi ro cổ phiếu.`;
    actionStepsVi.push(t0SurfPlan.summaryVi);
    if (smartDcaPlan.allowed) {
      actionStepsVi.push(
        `Phương án kết hợp (nếu có vốn nhàn rỗi): Chỉ gom thêm tại đúng hỗ trợ ${fmtPriceInline(smartDcaPlan.dcaBuyPrice, isVN, isVnIdxOrDeriv)} để kéo hòa vốn xuống ${fmtPriceInline(smartDcaPlan.newTrueBreakEvenPrice, isVN, isVnIdxOrDeriv)}.`
      );
    }
  } else if (smartDcaPlan.allowed) {
    primaryMode = 'SMART_DCA_AT_SUPPORT';
    primaryBadgeVi = 'DCA CẤU TRÚC TẠI HỖ TRỢ';
    primaryHeadlineVi = `Hội đồng 6 tầng ủng hộ chiều hồi phục (${chartVerdict.verdictLabelVi}) — Khả thi gom thêm tại hỗ trợ cứng để kéo nhanh giá hòa vốn về dưới cản.`;
    actionStepsVi.push(smartDcaPlan.summaryVi);
    if (t0SurfPlan.eligible) {
      actionStepsVi.push(
        `Song song trong phiên: Có thể lướt T+0 ${t0SurfPlan.surfQuantity.toLocaleString('en-US')} ${quantityLabel} biên ${fmtPriceInline(t0SurfPlan.buySupportPrice, isVN, isVnIdxOrDeriv)} → ${fmtPriceInline(t0SurfPlan.sellBouncePrice, isVN, isVnIdxOrDeriv)} để rút ngắn thêm thời gian về bờ.`
      );
    }
  } else {
    primaryMode = 'NEAR_SHORE_HOLD';
    primaryBadgeVi = 'QUAN SÁT & CHỜ HỖ TRỢ';
    primaryHeadlineVi = `Cần +${gainRequiredToBreakEvenPct}% để chạm giá hòa vốn thực ${fmtPriceInline(trueBreakEvenPrice, isVN, isVnIdxOrDeriv)}.`;
    actionStepsVi.push(defensiveTrimPlan.summaryVi);
  }

  return {
    symbol: symUpper,
    isVN,
    isVnCorporateStock: isVnCorp,
    isVnDerivative: isVnDeriv,
    currencyUnitLabel,
    priceUnitSuffix,
    quantityLabel,
    holding: { ...holding, avgCostPrice: avgCost },
    currentPrice,
    trueBreakEvenPrice,
    costBasisTotal: Number(totalEffectiveCost.toFixed(2)),
    marketValueTotal: Number(grossMarketVal.toFixed(2)),
    accruedFeeTaxAndMargin,
    netUnrealizedPnlValue,
    netUnrealizedPnlPct,
    gainRequiredToBreakEvenPct,
    difficultyGrade,
    difficultyLabelVi,
    primaryMode,
    primaryBadgeVi,
    primaryHeadlineVi,
    actionStepsVi,
    trailingStopForProfit,
    obstaclesBeforeBreakEven: topObstacles,
    smartDcaPlan,
    t0SurfPlan,
    defensiveTrimPlan,
  };
}
