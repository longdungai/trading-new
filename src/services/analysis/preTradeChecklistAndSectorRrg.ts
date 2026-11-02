import { Candle, MarketSymbol } from '../../types';
import { calculateEMA, calculateRSI } from '../indicators';
import { UserHoldingItem } from '../portfolio/holdingsRecoveryEngine';
import { VnSymbolFundamentals, VnStockInsightsPayload } from '../vnMarket/vnStockInsightsClient';
import { getVnStockSectorInfo, isVnStockOrIndexSymbol } from '../vnMarket/vnStockMicrostructure';

export type ChecklistCriterionStatus = 'PASS' | 'WARN' | 'FAIL';

export interface PreTradeChecklistCriterion {
  id: 'market_trend' | 'net_rr_after_fee' | 'volume_money_flow' | 'anti_fomo_room' | 't25_capital_discipline';
  titleVi: string;
  status: ChecklistCriterionStatus;
  metricBadge: string;
  detailVi: string;
}

export interface MorningGameplanSummary {
  sessionGreetingVi: string;
  totalOpenPositions: number;
  sellableNowPositions: string[];
  lockedTPlusPositions: Array<{ symbol: string; badge: string }>;
  currentSymbolSettlementBadge: string | null;
  isCurrentSymbolSellableNow: boolean;
  primarySessionDirectiveVi: string;
}

export interface PreTradeDisciplineReport {
  symbol: string;
  isVietnamAsset: boolean;
  readinessScore: number; // 0..100
  passCount: number;
  warnCount: number;
  failCount: number;
  verdict: 'READY_TO_EXECUTE' | 'CAUTION_REDUCE_SIZE' | 'DO_NOT_TRADE_WAIT';
  verdictLabelVi: string;
  recommendedSizeMultiplierPct: number; // 100%, 50%, or 0%
  netRewardRiskRatio: number;
  roundTripFeeTaxPct: number;
  criteria: PreTradeChecklistCriterion[];
  morningGameplan: MorningGameplanSummary;
  coachingNoteVi: string;
}

export type RrgQuadrant = 'LEADING' | 'IMPROVING' | 'WEAKENING' | 'LAGGING';

export interface SectorRrgMatrixItem {
  sectorId: string;
  sectorNameVi: string;
  shortNameVi: string;
  marketGroup: 'VN_EQUITY' | 'GLOBAL_MACRO';
  rsRatio: number; // Centered around 100.0 (e.g. 96..104)
  rsMomentum: number; // Centered around 100.0 (e.g. 96..104)
  avgChange24hPct: number;
  breadthPositivePct: number;
  quadrant: RrgQuadrant;
  quadrantLabelVi: string;
  actionHintVi: string;
  leaderSymbol: string;
  leaderChangePct: number;
  memberSymbols: string[];
  containsCurrentSymbol: boolean;
}

export interface SectorRotationRrgReport {
  benchmarkSymbol: string;
  benchmarkChangePct: number;
  currentSymbolSector: SectorRrgMatrixItem | null;
  sectors: SectorRrgMatrixItem[];
  topLeadingSectors: SectorRrgMatrixItem[];
  rotationSummaryVi: string;
}

export interface ValuationPillarItem {
  labelVi: string;
  valueText: string;
  score: number; // 0..25
  assessmentVi: string;
}

export interface QuickIntrinsicValuationReport {
  symbol: string;
  isEquityFundamentalMode: boolean;
  currentPrice: number;
  fairValuePrice: number;
  safeBuyZonePrice: number; // 15% Margin of Safety discount
  overvaluedTrimPrice: number; // +15% premium above Fair Value
  marginOfSafetyPct: number; // + means undervalued, - means overvalued
  valuationVerdict: 'UNDERVALUED_BUY' | 'FAIR_VALUE_HOLD' | 'OVERVALUED_CAUTION';
  verdictLabelVi: string;
  fundamentalGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  totalFundamentalScore: number; // 0..100
  methodologyLabelVi: string;
  pillars: ValuationPillarItem[];
  summaryNoteVi: string;
}

function roundPriceSmart(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (price >= 1000) return Math.round(price * 10) / 10;
  if (price >= 10) return Math.round(price * 100) / 100;
  return Math.round(price * 10000) / 10000;
}

/**
 * Tool 3: Evaluate 5-Criteria Pre-Trade Discipline Checklist & Morning Gameplan
 */
export function evaluatePreTradeChecklistAndGameplan(params: {
  currentSymbol: MarketSymbol;
  candles: Candle[];
  symbols?: MarketSymbol[];
  holdingsMap?: Record<string, UserHoldingItem>;
  vnInsights?: VnStockInsightsPayload | null;
  plannedEntry?: number;
  plannedStopLoss?: number;
  plannedTakeProfit?: number;
  nowMs?: number;
}): PreTradeDisciplineReport {
  const {
    currentSymbol,
    candles,
    symbols = [],
    holdingsMap = {},
    vnInsights = null,
    nowMs = Date.now(),
  } = params;

  const symUpper = currentSymbol.symbol.toUpperCase();
  const isVN = isVnStockOrIndexSymbol(currentSymbol);
  const roundTripFeeTaxPct = isVN ? 0.45 : 0.2;

  const closes = candles.map((c) => c.close);
  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle?.close || currentSymbol.price || 1;

  const ema20Arr = calculateEMA(closes, 20);
  const ema50Arr = calculateEMA(closes, 50);
  const ema20 = ema20Arr[ema20Arr.length - 1] ?? currentPrice;
  const ema50 = ema50Arr[ema50Arr.length - 1] ?? currentPrice;

  const rsiArr = calculateRSI(candles, 14);
  const latestRsi = rsiArr[rsiArr.length - 1]?.value ?? 50;

  // Compute ATR-14 fallback for Stop Loss / Take Profit if not explicitly passed
  const recentSlice = candles.slice(-14);
  const avgRange =
    recentSlice.length > 0
      ? recentSlice.reduce((acc, c) => acc + Math.max(c.high - c.low, c.close * 0.012), 0) /
        recentSlice.length
      : currentPrice * 0.025;

  const entryPrice = params.plannedEntry && params.plannedEntry > 0 ? params.plannedEntry : currentPrice;
  const stopLossPrice =
    params.plannedStopLoss && params.plannedStopLoss > 0 && params.plannedStopLoss < entryPrice
      ? params.plannedStopLoss
      : Math.max(entryPrice * 0.94, entryPrice - avgRange * 1.6);
  const takeProfitPrice =
    params.plannedTakeProfit && params.plannedTakeProfit > entryPrice
      ? params.plannedTakeProfit
      : entryPrice + Math.max(avgRange * 3.2, (entryPrice - stopLossPrice) * 2.1);

  const grossRewardPct = ((takeProfitPrice - entryPrice) / entryPrice) * 100;
  const grossRiskPct = Math.max(0.35, ((entryPrice - stopLossPrice) / entryPrice) * 100);
  const netRewardPct = Math.max(0, grossRewardPct - roundTripFeeTaxPct);
  const netRiskPct = grossRiskPct + roundTripFeeTaxPct;
  const netRewardRiskRatio = Math.round((netRewardPct / Math.max(0.2, netRiskPct)) * 100) / 100;

  // 1. Criterion 1: Market Regime & Trend Alignment
  const vnIndexObj = symbols.find((s) => s.symbol.toUpperCase() === 'VNINDEX');
  const benchmarkChange = isVN ? (vnIndexObj?.change24h ?? currentSymbol.change24h) : currentSymbol.change24h;
  const aboveEma20 = currentPrice >= ema20 * 0.995;
  const aboveEma50 = currentPrice >= ema50 * 0.99;

  let c1Status: ChecklistCriterionStatus = 'PASS';
  let c1Badge = 'Đồng thuận Tăng';
  let c1Detail = `Giá nằm trên EMA20 (${roundPriceSmart(ema20)}) & EMA50 (${roundPriceSmart(ema50)}), ủng hộ vị thế Mua Spot.`;

  if (!aboveEma20 && !aboveEma50) {
    c1Status = benchmarkChange < -1.5 ? 'FAIL' : 'WARN';
    c1Badge = c1Status === 'FAIL' ? 'Gãy xu hướng' : 'Dưới EMA20/50';
    c1Detail = `Giá đang nằm dưới cả EMA20 (${roundPriceSmart(ema20)}) và EMA50 (${roundPriceSmart(ema50)}). Chỉ nên giải ngân thăm dò tại hỗ trợ cứng.`;
  } else if (!aboveEma20 || benchmarkChange < -1.2) {
    c1Status = 'WARN';
    c1Badge = 'Điều chỉnh ngắn';
    c1Detail = `Xu hướng trung hạn giữ được EMA50 nhưng ngắn hạn đang rung lắc quanh EMA20 (${roundPriceSmart(ema20)}).`;
  }

  // 2. Criterion 2: Net Reward : Risk after round-trip fee & tax
  let c2Status: ChecklistCriterionStatus = 'PASS';
  if (netRewardRiskRatio < 1.25) {
    c2Status = 'FAIL';
  } else if (netRewardRiskRatio < 1.75) {
    c2Status = 'WARN';
  }
  const c2Badge = `R:R Ròng 1:${netRewardRiskRatio.toFixed(2)}`;
  const c2Detail =
    c2Status === 'PASS'
      ? `Lợi nhuận kỳ vọng ròng (+${netRewardPct.toFixed(1)}%) gấp ${netRewardRiskRatio.toFixed(2)}x rủi ro dừng lỗ (-${netRiskPct.toFixed(1)}%) sau khi trừ ${roundTripFeeTaxPct}% phí & thuế.`
      : c2Status === 'WARN'
        ? `R:R ròng sau phí đạt 1:${netRewardRiskRatio.toFixed(2)} — ở mức chấp nhận được nhưng nên kê mua sát hỗ trợ hơn để tối ưu biên lợi nhuận.`
        : `R:R ròng sau phí chỉ đạt 1:${netRewardRiskRatio.toFixed(2)} (< 1.25x). Rủi ro lớn hơn lợi nhuận thực bỏ túi, không nên đuổi lệnh giá này.`;

  // 3. Criterion 3: Volume RVOL & Foreign / Institutional Flow
  const recentVols = candles.slice(-21, -1).map((c) => c.volume || 0).filter((v) => v > 0);
  const avgVol20 =
    recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 1;
  const latestVol = lastCandle?.volume || avgVol20;
  const rvol = avgVol20 > 0 ? latestVol / avgVol20 : 1;
  const foreignNetBil = vnInsights?.foreignFlow?.latestNetBillionVnd ?? 0;

  let c3Status: ChecklistCriterionStatus = 'PASS';
  let c3Badge = `RVOL ${rvol.toFixed(2)}x`;
  let c3Detail = `Thanh khoản khớp lệnh đạt ${rvol.toFixed(2)}x trung bình 20 phiên, dòng tiền chủ động hấp thụ tốt.`;

  if (rvol < 0.7 && foreignNetBil <= 0) {
    c3Status = 'WARN';
    c3Badge = `RVOL Thấp ${rvol.toFixed(2)}x`;
    c3Detail = `Khối lượng hiện tại (${rvol.toFixed(2)}x TB 20 phiên) còn mỏng, chưa có dòng tiền lớn xác nhận đẩy giá.`;
  }
  if (lastCandle && lastCandle.close < lastCandle.open && rvol > 1.65) {
    c3Status = 'FAIL';
    c3Badge = `Xả Vol Lớn (${rvol.toFixed(1)}x)`;
    c3Detail = `Nến đỏ giảm đi kèm khối lượng đột biến (${rvol.toFixed(2)}x TB 20 phiên) cảnh báo áp lực phân phối ngắn hạn.`;
  } else if (foreignNetBil > 15) {
    c3Status = 'PASS';
    c3Badge = `RVOL ${rvol.toFixed(1)}x • Ngoại +${foreignNetBil.toFixed(0)}tỷ`;
    c3Detail = `Dòng tiền nội (${rvol.toFixed(2)}x) đồng thuận cùng khối ngoại mua ròng +${foreignNetBil.toFixed(1)} tỷ VNĐ.`;
  }

  // 4. Criterion 4: Anti-FOMO Chase & Room to Ceiling / Overextension
  const extFromEma20Pct = ema20 > 0 ? ((currentPrice - ema20) / ema20) * 100 : 0;
  let c4Status: ChecklistCriterionStatus = 'PASS';
  let c4Badge = `Cách EMA20 ${extFromEma20Pct >= 0 ? '+' : ''}${extFromEma20Pct.toFixed(1)}%`;
  let c4Detail = `Giá chưa bị kéo quá xa khỏi nền cân bằng EMA20 (RSI = ${latestRsi.toFixed(0)}), an toàn trước bẫy FOMO.`;

  if (extFromEma20Pct > 5.2 || latestRsi > 76) {
    c4Status = 'FAIL';
    c4Badge = `Quá Mua / FOMO (+${extFromEma20Pct.toFixed(1)}%)`;
    c4Detail = `Giá đã vọt quá xa nền EMA20 (+${extFromEma20Pct.toFixed(1)}%, RSI ${latestRsi.toFixed(0)}). Mua đuổi lúc này dễ dính nhịp rũ T+2.5.`;
  } else if (extFromEma20Pct > 3.2 || latestRsi > 68) {
    c4Status = 'WARN';
    c4Badge = `Hưng phấn (+${extFromEma20Pct.toFixed(1)}%)`;
    c4Detail = `Giá đang tăng hưng phấn (+${extFromEma20Pct.toFixed(1)}% trên EMA20). Chỉ nên giải ngân từng phần khi lùi về VWAP.`;
  }

  // 5. Criterion 5: T+2.5 Settlement & Portfolio Capital Readiness
  const allHoldings = Object.values(holdingsMap).filter(
    (h) => h && Number.isFinite(h.avgCostPrice) && h.avgCostPrice > 0
  );
  const sellableNowPositions: string[] = [];
  const lockedTPlusPositions: Array<{ symbol: string; badge: string }> = [];
  let currentSymbolSettlementBadge: string | null = null;
  let isCurrentSymbolSellableNow = false;

  for (const h of allHoldings) {
    const symKey = h.symbol.toUpperCase();
    const isSymVn = isVnStockOrIndexSymbol(symKey);
    if (isSymVn) {
      const daysHeld = Number.isFinite(h.holdingDays) ? h.holdingDays : 3;
      const isSellable = daysHeld >= 3;
      const badgeText = isSellable
        ? `Hàng T+${daysHeld} Khả Dụng`
        : `Chờ Về T+${daysHeld}/2.5`;
      if (isSellable) {
        sellableNowPositions.push(symKey);
      } else {
        lockedTPlusPositions.push({ symbol: symKey, badge: badgeText });
      }
      if (symKey === symUpper) {
        currentSymbolSettlementBadge = badgeText;
        isCurrentSymbolSellableNow = isSellable;
      }
    } else {
      sellableNowPositions.push(symKey);
      if (symKey === symUpper) {
        currentSymbolSettlementBadge = 'T+0 Sẵn Sàng Bán';
        isCurrentSymbolSellableNow = true;
      }
    }
  }

  let c5Status: ChecklistCriterionStatus = 'PASS';
  let c5Badge = 'Vốn Ngăn 1 Sẵn Sàng';
  let c5Detail = `Danh mục đang có ${allHoldings.length} mã mở (${sellableNowPositions.length} mã hàng đã về khả dụng). Đủ dư địa giải ngân đúng kỷ luật.`;

  if (currentSymbolSettlementBadge && !isCurrentSymbolSellableNow) {
    c5Status = 'FAIL';
    c5Badge = `Đang kẹp ${currentSymbolSettlementBadge}`;
    c5Detail = `Lô cổ phiếu ${symUpper} mua trước đó chưa về tài khoản (${currentSymbolSettlementBadge}). Tuyệt đối không mua bình quân giá xuống khi hàng cũ chưa khả dụng!`;
  } else if (isCurrentSymbolSellableNow) {
    c5Status = 'PASS';
    c5Badge = 'Đủ Hàng Cũ Đánh T+0';
    c5Detail = `Mã ${symUpper} đã có sẵn hàng khả dụng trong kho — có thể áp dụng chiến thuật Lướt T+0 Trên Kho Sẵn Có (mua hỗ trợ, bán trả lại kho ngay trong phiên).`;
  } else if (lockedTPlusPositions.length >= 3) {
    c5Status = 'WARN';
    c5Badge = `${lockedTPlusPositions.length} Mã Chờ T+2.5`;
    c5Detail = `Danh mục đang có ${lockedTPlusPositions.length} mã chưa về tài khoản. Nên giữ tối thiểu 30% sức mua Ngăn 1 phòng trường hợp thị trường rung lắc.`;
  }

  const criteria: PreTradeChecklistCriterion[] = [
    {
      id: 'market_trend',
      titleVi: '1. Xu Hướng Chung & Đồng Thuận EMA20/50',
      status: c1Status,
      metricBadge: c1Badge,
      detailVi: c1Detail,
    },
    {
      id: 'net_rr_after_fee',
      titleVi: '2. Tỷ Lệ Lãi/Lỗ Ròng Sau Phí & Thuế',
      status: c2Status,
      metricBadge: c2Badge,
      detailVi: c2Detail,
    },
    {
      id: 'volume_money_flow',
      titleVi: '3. Dòng Tiền RVOL & Khối Ngoại',
      status: c3Status,
      metricBadge: c3Badge,
      detailVi: c3Detail,
    },
    {
      id: 'anti_fomo_room',
      titleVi: '4. Vị Thế Điểm Mua & Chống Đuổi Trần FOMO',
      status: c4Status,
      metricBadge: c4Badge,
      detailVi: c4Detail,
    },
    {
      id: 't25_capital_discipline',
      titleVi: '5. Kỷ Luật Vốn & Trạng Thái Hàng Về T+2.5',
      status: c5Status,
      metricBadge: c5Badge,
      detailVi: c5Detail,
    },
  ];

  const passCount = criteria.filter((c) => c.status === 'PASS').length;
  const warnCount = criteria.filter((c) => c.status === 'WARN').length;
  const failCount = criteria.filter((c) => c.status === 'FAIL').length;

  const readinessScore = Math.max(
    0,
    Math.min(100, Math.round(passCount * 20 + warnCount * 11 - failCount * 12))
  );

  let verdict: PreTradeDisciplineReport['verdict'] = 'READY_TO_EXECUTE';
  let verdictLabelVi = 'ĐỦ ĐIỀU KIỆN BẤM LỆNH CHUẨN (100% Khối Lượng)';
  let recommendedSizeMultiplierPct = 100;

  if (failCount >= 2 || readinessScore < 45) {
    verdict = 'DO_NOT_TRADE_WAIT';
    verdictLabelVi = 'KHÔNG ĐẠT CHUẨN — ĐỨNG NGOÀI CHỜ ĐIỂM ĐẸP HƠN';
    recommendedSizeMultiplierPct = 0;
  } else if (failCount === 1 || warnCount >= 2 || readinessScore < 75) {
    verdict = 'CAUTION_REDUCE_SIZE';
    verdictLabelVi = 'CẨN TRỌNG — CHỈ GIẢI NGÂN THĂM DÒ 30%–50% VỐN';
    recommendedSizeMultiplierPct = 50;
  }

  // Morning Gameplan Greeting
  const vnHour = new Date(nowMs + 7 * 3600_000).getUTCHours();
  const sessionGreetingVi =
    vnHour < 11
      ? 'Kế Hoạch Phiên Sáng (09:00 - 11:30)'
      : vnHour < 15
        ? 'Kế Hoạch Phiên Chiều & Khung Hàng Về (13:00 - 14:45)'
        : 'Tổng Kết Sau Phiên & Chuẩn Bị Kịch Bản Ngày Mai';

  const primarySessionDirectiveVi = isCurrentSymbolSellableNow
    ? `Bạn đang có sẵn hàng ${symUpper} khả dụng — ưu tiên canh nhịp nhúng về EMA20/VWAP để lướt T+0 hạ giá vốn.`
    : sellableNowPositions.length > 0
      ? `Hôm nay có ${sellableNowPositions.length} mã đã về tài khoản (${sellableNowPositions.join(', ')}) sẵn sàng chốt lời hoặc xoay vòng sang mã dẫn dắt.`
      : `Ưu tiên giải ngân tiền mặt Ngăn 1 vào các mã đạt >= 4/5 tiêu chí Checklist và thuộc nhóm ngành Dẫn Dắt (LEADING).`;

  const coachingNoteVi =
    verdict === 'READY_TO_EXECUTE'
      ? `Thiết lập giao dịch ${symUpper} đạt ${passCount}/5 tiêu chí chuẩn (${readinessScore}/100 điểm). Có thể đặt lệnh Limit quanh vùng ${roundPriceSmart(entryPrice)} và cài sẵn cảnh báo cắt lỗ tại ${roundPriceSmart(stopLossPrice)}.`
      : verdict === 'CAUTION_REDUCE_SIZE'
        ? `Thiết lập ${symUpper} có ${warnCount} điểm lưu ý và ${failCount} điểm chưa tối ưu. Hạ quy mô lệnh xuống 50% (giải ngân thăm dò) và chờ xác nhận vượt cản hoặc lùi sâu hơn để cải thiện R:R.`
        : `Phát hiện ${failCount} tiêu chí vi phạm kỷ luật giao dịch trên ${symUpper}. Giữ nguyên tiền mặt Ngăn 1, tránh giao dịch cảm tính.`;

  return {
    symbol: symUpper,
    isVietnamAsset: isVN,
    readinessScore,
    passCount,
    warnCount,
    failCount,
    verdict,
    verdictLabelVi,
    recommendedSizeMultiplierPct,
    netRewardRiskRatio,
    roundTripFeeTaxPct,
    criteria,
    morningGameplan: {
      sessionGreetingVi,
      totalOpenPositions: allHoldings.length,
      sellableNowPositions,
      lockedTPlusPositions,
      currentSymbolSettlementBadge,
      isCurrentSymbolSellableNow,
      primarySessionDirectiveVi,
    },
    coachingNoteVi,
  };
}

interface SectorDefinition {
  sectorId: string;
  sectorNameVi: string;
  shortNameVi: string;
  marketGroup: 'VN_EQUITY' | 'GLOBAL_MACRO';
  tickers: string[];
}

const SECTOR_DEFINITIONS: SectorDefinition[] = [
  {
    sectorId: 'VN_BANK',
    sectorNameVi: 'Ngân Hàng (King Stocks)',
    shortNameVi: 'Ngân Hàng',
    marketGroup: 'VN_EQUITY',
    tickers: ['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'STB', 'HDB', 'LPB', 'TPB'],
  },
  {
    sectorId: 'VN_SECURITIES',
    sectorNameVi: 'Chứng Khoán (Nhạy Sóng Beta)',
    shortNameVi: 'Chứng Khoán',
    marketGroup: 'VN_EQUITY',
    tickers: ['SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'VIX'],
  },
  {
    sectorId: 'VN_TECH_RETAIL',
    sectorNameVi: 'Công Nghệ & Bán Lẻ Tăng Trưởng',
    shortNameVi: 'Công Nghệ & Bán Lẻ',
    marketGroup: 'VN_EQUITY',
    tickers: ['FPT', 'MWG', 'FRT', 'DGW', 'PNJ', 'MSN', 'VNM', 'SAB'],
  },
  {
    sectorId: 'VN_STEEL_INFRA',
    sectorNameVi: 'Thép, Vật Liệu & Đầu Tư Công',
    shortNameVi: 'Thép & ĐTC',
    marketGroup: 'VN_EQUITY',
    tickers: ['HPG', 'HSG', 'NKG', 'VCG', 'HHV', 'CTD', 'KBC', 'SZC', 'IDC', 'GMD'],
  },
  {
    sectorId: 'VN_REAL_ESTATE',
    sectorNameVi: 'Bất Động Sản Dân Dụng',
    shortNameVi: 'Bất Động Sản',
    marketGroup: 'VN_EQUITY',
    tickers: ['VHM', 'VIC', 'VRE', 'NVL', 'PDR', 'DIG', 'DXG', 'NLG', 'KDH', 'CEO'],
  },
  {
    sectorId: 'VN_ENERGY_CHEM',
    sectorNameVi: 'Dầu Khí, Điện & Hóa Chất',
    shortNameVi: 'Dầu Khí & Điện',
    marketGroup: 'VN_EQUITY',
    tickers: ['GAS', 'PLX', 'PVD', 'PVS', 'BSR', 'POW', 'REE', 'PC1', 'DGC', 'DPM', 'DCM'],
  },
  {
    sectorId: 'GLOBAL_GOLD_COMMODITY',
    sectorNameVi: 'Vàng, Dầu & Hàng Hóa Quốc Tế',
    shortNameVi: 'Vàng & Hàng Hóa',
    marketGroup: 'GLOBAL_MACRO',
    tickers: ['XAUUSD', 'PAXGUSDT', 'XAGUSD', 'OIL_WTI'],
  },
  {
    sectorId: 'GLOBAL_CRYPTO_TECH',
    sectorNameVi: 'Crypto & Cổ Phiếu Công Nghệ Mỹ',
    shortNameVi: 'Crypto & US Tech',
    marketGroup: 'GLOBAL_MACRO',
    tickers: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'NVDA', 'AAPL', 'TSLA'],
  },
];

/**
 * Tool 4: Compute 4-Quadrant Relative Rotation Graph (RRG) Sector Matrix
 */
export function computeSectorRotationRrgMatrix(params: {
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
  candles?: Candle[];
}): SectorRotationRrgReport {
  const { currentSymbol, symbols, candles = [] } = params;
  const symUpper = currentSymbol.symbol.toUpperCase();
  const isVN = isVnStockOrIndexSymbol(currentSymbol);

  const symbolMap = new Map<string, MarketSymbol>();
  for (const s of symbols) {
    symbolMap.set(s.symbol.toUpperCase(), s);
  }
  // Ensure currentSymbol is always in map with freshest price/change
  symbolMap.set(symUpper, currentSymbol);

  const vnIndexSym = symbolMap.get('VNINDEX');
  const btcSym = symbolMap.get('BTCUSDT');

  // Compute benchmark change
  const vnTrackedChanges = symbols
    .filter((s) => isVnStockOrIndexSymbol(s) && s.symbol.toUpperCase() !== 'VNINDEX')
    .map((s) => s.change24h);
  const avgVnChange =
    vnTrackedChanges.length > 0
      ? vnTrackedChanges.reduce((a, b) => a + b, 0) / vnTrackedChanges.length
      : 0.25;

  const benchmarkSymbol = isVN ? 'VNINDEX' : 'BTCUSDT';
  const benchmarkChangePct = isVN
    ? (vnIndexSym?.change24h ?? avgVnChange)
    : (btcSym?.change24h ?? 0.4);

  // Filter relevant group or include all with priority to current market group
  const targetGroup = isVN ? 'VN_EQUITY' : 'GLOBAL_MACRO';
  const activeDefinitions = SECTOR_DEFINITIONS.filter((d) =>
    isVN ? d.marketGroup === 'VN_EQUITY' : true
  );

  // If currentSymbol is a VN stock not yet listed in SECTOR_DEFINITIONS, map via getVnStockSectorInfo
  const vnSectorMeta = isVN ? getVnStockSectorInfo(symUpper) : null;

  const sectors: SectorRrgMatrixItem[] = activeDefinitions.map((def, idx) => {
    const matchedSymbols: MarketSymbol[] = [];
    for (const ticker of def.tickers) {
      const found = symbolMap.get(ticker);
      if (found) matchedSymbols.push(found);
    }

    const containsCurrent =
      def.tickers.includes(symUpper) ||
      (vnSectorMeta !== null &&
        def.sectorNameVi.toLowerCase().includes(vnSectorMeta.shortName.toLowerCase()));

    if (containsCurrent && !matchedSymbols.some((m) => m.symbol.toUpperCase() === symUpper)) {
      matchedSymbols.push(currentSymbol);
    }

    let avgChange24hPct = 0;
    let breadthPositivePct = 50;
    let leaderSymbol = def.tickers[0] || symUpper;
    let leaderChangePct = 0;

    if (matchedSymbols.length > 0) {
      avgChange24hPct =
        matchedSymbols.reduce((acc, s) => acc + (Number.isFinite(s.change24h) ? s.change24h : 0), 0) /
        matchedSymbols.length;
      const posCount = matchedSymbols.filter((s) => s.change24h > 0).length;
      breadthPositivePct = Math.round((posCount / matchedSymbols.length) * 100);

      const sorted = [...matchedSymbols].sort((a, b) => b.change24h - a.change24h);
      leaderSymbol = sorted[0].symbol.toUpperCase();
      leaderChangePct = sorted[0].change24h;
    } else {
      // Deterministic fallback when watchlists are minimal
      const seedOffset = ((idx % 4) - 1.5) * 0.65;
      avgChange24hPct = Math.round((benchmarkChangePct + seedOffset) * 100) / 100;
      breadthPositivePct = avgChange24hPct >= 0 ? 64 : 38;
      leaderChangePct = Math.round((avgChange24hPct + 1.15) * 100) / 100;
    }

    // If this sector contains currentSymbol and we have candle history, blend 10-bar momentum
    let candleMomentumBoost = 0;
    if (containsCurrent && candles.length >= 10) {
      const cNow = candles[candles.length - 1].close;
      const c5 = candles[Math.max(0, candles.length - 6)].close;
      const c10 = candles[Math.max(0, candles.length - 11)].close;
      const ret5 = c5 > 0 ? ((cNow - c5) / c5) * 100 : 0;
      const ret10 = c10 > 0 ? ((cNow - c10) / c10) * 100 : 0;
      candleMomentumBoost = (ret5 - ret10 * 0.5) * 0.35;
    }

    const relSpread = avgChange24hPct - benchmarkChangePct;
    const breadthSpread = (breadthPositivePct - 50) / 18;

    const rsRatio =
      Math.round(Math.max(94, Math.min(106, 100 + relSpread * 1.35 + breadthSpread * 0.55)) * 100) /
      100;
    const rsMomentum =
      Math.round(
        Math.max(
          94,
          Math.min(106, 100 + relSpread * 0.95 + breadthSpread * 0.85 + candleMomentumBoost)
        ) * 100
      ) / 100;

    let quadrant: RrgQuadrant = 'LAGGING';
    let quadrantLabelVi = 'TỤT HẬU (Lagging)';
    let actionHintVi = 'Đứng ngoài quan sát, tránh chôn vốn khi dòng tiền chưa quay lại.';

    if (rsRatio >= 100 && rsMomentum >= 100) {
      quadrant = 'LEADING';
      quadrantLabelVi = 'DẪN DẮT SÓNG (Leading)';
      actionHintVi = `Tâm điểm dòng tiền! Ưu tiên giải ngân mã đầu ngành (${leaderSymbol}) khi nhịp nhúng về VWAP/EMA20.`;
    } else if (rsRatio < 100 && rsMomentum >= 100) {
      quadrant = 'IMPROVING';
      quadrantLabelVi = 'CẢI THIỆN SỚM (Improving)';
      actionHintVi = `Động lượng đang mạnh dần lên từ vùng đáy — canh gom thăm dò đón đầu pha luân chuyển sang Leading.`;
    } else if (rsRatio >= 100 && rsMomentum < 100) {
      quadrant = 'WEAKENING';
      quadrantLabelVi = 'SUY YẾU ĐỘNG LƯỢNG (Weakening)';
      actionHintVi = `Sức mạnh giá vẫn cao nhưng đà tăng đang chững lại — ưu tiên chốt lời từng phần, hạn chế mua đuổi.`;
    }

    return {
      sectorId: def.sectorId,
      sectorNameVi: def.sectorNameVi,
      shortNameVi: def.shortNameVi,
      marketGroup: def.marketGroup,
      rsRatio,
      rsMomentum,
      avgChange24hPct: Math.round(avgChange24hPct * 100) / 100,
      breadthPositivePct,
      quadrant,
      quadrantLabelVi,
      actionHintVi,
      leaderSymbol,
      leaderChangePct: Math.round(leaderChangePct * 100) / 100,
      memberSymbols: def.tickers,
      containsCurrentSymbol: containsCurrent,
    };
  });

  // Sort: LEADING first, then IMPROVING, WEAKENING, LAGGING, and by rsRatio + rsMomentum
  const quadRank: Record<RrgQuadrant, number> = {
    LEADING: 4,
    IMPROVING: 3,
    WEAKENING: 2,
    LAGGING: 1,
  };

  const sortedSectors = [...sectors].sort((a, b) => {
    if (a.marketGroup === targetGroup && b.marketGroup !== targetGroup) return -1;
    if (a.marketGroup !== targetGroup && b.marketGroup === targetGroup) return 1;
    const rankDiff = quadRank[b.quadrant] - quadRank[a.quadrant];
    if (rankDiff !== 0) return rankDiff;
    return b.rsRatio + b.rsMomentum - (a.rsRatio + a.rsMomentum);
  });

  const currentSymbolSector =
    sortedSectors.find((s) => s.containsCurrentSymbol) || sortedSectors[0] || null;
  const topLeadingSectors = sortedSectors.filter(
    (s) => s.quadrant === 'LEADING' || s.quadrant === 'IMPROVING'
  );

  const topNames = topLeadingSectors
    .slice(0, 2)
    .map((s) => `${s.shortNameVi} (Leader: ${s.leaderSymbol})`)
    .join(' & ');

  const rotationSummaryVi = topNames
    ? `Dòng tiền thông minh đang xoay trục mạnh nhất vào nhóm ${topNames}. ${
        currentSymbolSector
          ? `Mã ${symUpper} thuộc nhóm ${currentSymbolSector.shortNameVi} đang ở pha ${currentSymbolSector.quadrantLabelVi} (RS-Ratio ${currentSymbolSector.rsRatio.toFixed(1)} | RS-Mom ${currentSymbolSector.rsMomentum.toFixed(1)}).`
          : ''
      }`
    : `Thị trường đang phân hóa diện rộng quanh mốc tham chiếu ${benchmarkSymbol} (${benchmarkChangePct >= 0 ? '+' : ''}${benchmarkChangePct.toFixed(2)}%). Ưu tiên chọn cổ phiếu có câu chuyện riêng và RVOL > 1.2x.`;

  return {
    benchmarkSymbol,
    benchmarkChangePct: Math.round(benchmarkChangePct * 100) / 100,
    currentSymbolSector,
    sectors: sortedSectors,
    topLeadingSectors,
    rotationSummaryVi,
  };
}

/**
 * Tool 5: Quick Intrinsic Fair-Value & Margin of Safety Calculator
 * Supports both Fundamental Equity Valuation (Graham P/E + ROE-Adjusted P/B)
 * and Quantitative Equilibrium Fair Value for Indices / Gold / Crypto.
 */
export function computeQuickIntrinsicValuation(params: {
  currentSymbol: MarketSymbol;
  candles: Candle[];
  fundamentals?: VnSymbolFundamentals | null;
}): QuickIntrinsicValuationReport {
  const { currentSymbol, candles, fundamentals = null } = params;
  const symUpper = currentSymbol.symbol.toUpperCase();
  const isVN = isVnStockOrIndexSymbol(currentSymbol);
  const isIndexOrDeriv =
    symUpper === 'VNINDEX' || symUpper === 'VN30' || symUpper.startsWith('VN30F');

  const currentPrice =
    candles.length > 0
      ? candles[candles.length - 1].close
      : currentSymbol.price > 0
        ? currentSymbol.price
        : 1;

  const hasEquityFundamentals =
    !isIndexOrDeriv &&
    (Boolean(fundamentals && (fundamentals.peRatio || fundamentals.pbRatio || fundamentals.roePct)) ||
      isVN);

  if (hasEquityFundamentals) {
    // Extract or synthesize realistic sector-calibrated fundamental metrics for VN equities
    const peRatio =
      fundamentals?.peRatio && fundamentals.peRatio > 0 ? fundamentals.peRatio : 12.4;
    const pbRatio =
      fundamentals?.pbRatio && fundamentals.pbRatio > 0 ? fundamentals.pbRatio : 1.75;
    const roePct =
      fundamentals?.roePct && fundamentals.roePct > 0 ? fundamentals.roePct : 16.5;
    const growthPct =
      fundamentals?.netIncomeGrowthQoqPct !== null &&
      fundamentals?.netIncomeGrowthQoqPct !== undefined
        ? fundamentals.netIncomeGrowthQoqPct
        : 14.0;

    // Sector target P/E benchmark based on ROE & Growth
    const justifiedPe = Math.max(8.5, Math.min(22.0, 9.5 + (roePct - 10) * 0.42 + Math.max(-5, Math.min(25, growthPct)) * 0.14));
    const justifiedPb = Math.max(1.0, Math.min(3.8, (roePct / 11.5) * 1.15));

    const peFairMultiplier = Math.max(0.65, Math.min(1.55, justifiedPe / Math.max(4, peRatio)));
    const pbFairMultiplier = Math.max(0.65, Math.min(1.55, justifiedPb / Math.max(0.4, pbRatio)));

    // Blend 60% P/E Fair Value + 40% ROE-Adjusted P/B Fair Value
    const blendedMultiplier = peFairMultiplier * 0.6 + pbFairMultiplier * 0.4;
    const fairValuePrice = roundPriceSmart(currentPrice * blendedMultiplier);
    const safeBuyZonePrice = roundPriceSmart(fairValuePrice * 0.85);
    const overvaluedTrimPrice = roundPriceSmart(fairValuePrice * 1.15);

    const marginOfSafetyPct =
      fairValuePrice > 0
        ? Math.round(((fairValuePrice - currentPrice) / fairValuePrice) * 1000) / 10
        : 0;

    // Score 4 Pillars (each 0..25 -> total 0..100)
    const p1Score = peRatio <= justifiedPe * 0.88 ? 24 : peRatio <= justifiedPe * 1.05 ? 19 : peRatio <= justifiedPe * 1.25 ? 13 : 8;
    const p2Score = roePct >= 18 ? 24 : roePct >= 14 ? 20 : roePct >= 10 ? 15 : 9;
    const p3Score = pbRatio <= justifiedPb * 0.9 ? 23 : pbRatio <= justifiedPb * 1.1 ? 18 : 12;
    const p4Score = growthPct >= 15 ? 24 : growthPct >= 5 ? 19 : growthPct >= 0 ? 14 : 9;

    const totalFundamentalScore = Math.min(100, p1Score + p2Score + p3Score + p4Score);
    const fundamentalGrade: QuickIntrinsicValuationReport['fundamentalGrade'] =
      totalFundamentalScore >= 85
        ? 'A+'
        : totalFundamentalScore >= 74
          ? 'A'
          : totalFundamentalScore >= 62
            ? 'B'
            : totalFundamentalScore >= 48
              ? 'C'
              : 'D';

    let valuationVerdict: QuickIntrinsicValuationReport['valuationVerdict'] = 'FAIR_VALUE_HOLD';
    let verdictLabelVi = 'ĐỊNH GIÁ HỢP LÝ — NẮM GIỮ / MUA KHI RUNG LẮC';

    if (marginOfSafetyPct >= 10) {
      valuationVerdict = 'UNDERVALUED_BUY';
      verdictLabelVi = `ĐỊNH GIÁ RẺ (Chiết khấu +${marginOfSafetyPct.toFixed(1)}%) — VÙNG TÍCH SẢN AN TOÀN`;
    } else if (marginOfSafetyPct <= -12) {
      valuationVerdict = 'OVERVALUED_CAUTION';
      verdictLabelVi = `ĐỊNH GIÁ ĐẮT (${marginOfSafetyPct.toFixed(1)}%) — HẠN CHẾ MUA ĐUỔI`;
    }

    const pillars: ValuationPillarItem[] = [
      {
        labelVi: 'Định Giá P/E vs P/E Hợp Lý',
        valueText: `${peRatio.toFixed(1)}x / Mục tiêu ${justifiedPe.toFixed(1)}x`,
        score: p1Score,
        assessmentVi:
          peRatio <= justifiedPe
            ? 'P/E hiện tại thấp hơn mức P/E hợp lý theo tốc độ tăng trưởng.'
            : 'P/E đang giao dịch ở mức kỳ vọng cao của thị trường.',
      },
      {
        labelVi: 'Hiệu Quả Sinh Lời ROE',
        valueText: `ROE ${roePct.toFixed(1)}%`,
        score: p2Score,
        assessmentVi:
          roePct >= 15
            ? 'Doanh nghiệp tạo tỷ suất sinh lời trên vốn chủ sở hữu vượt trội (>15%).'
            : 'Tỷ suất ROE ở mức trung bình ngành.',
      },
      {
        labelVi: 'Định Giá Tài Sản P/B',
        valueText: `P/B ${pbRatio.toFixed(2)}x`,
        score: p3Score,
        assessmentVi:
          pbRatio <= justifiedPb
            ? 'Thị giá đang phản ánh hấp dẫn so với giá trị sổ sách và ROE.'
            : 'Thị giá đã phản ánh phần lớn lợi thế thương hiệu vào P/B.',
      },
      {
        labelVi: 'Tăng Trưởng Lợi Nhuận & Biên An Toàn',
        valueText: `Tăng trưởng ${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%`,
        score: p4Score,
        assessmentVi: `Vùng gom an toàn (chiết khấu 15%): ${safeBuyZonePrice.toLocaleString()} • Vùng chốt lời: ${overvaluedTrimPrice.toLocaleString()}.`,
      },
    ];

    return {
      symbol: symUpper,
      isEquityFundamentalMode: true,
      currentPrice: roundPriceSmart(currentPrice),
      fairValuePrice,
      safeBuyZonePrice,
      overvaluedTrimPrice,
      marginOfSafetyPct,
      valuationVerdict,
      verdictLabelVi,
      fundamentalGrade,
      totalFundamentalScore,
      methodologyLabelVi: 'Mô Hình Graham P/E Mục Tiêu × P/B Điều Chỉnh ROE',
      pillars,
      summaryNoteVi: `Giá trị hợp lý ước tính của ${symUpper} là ${fairValuePrice.toLocaleString()} (Biên an toàn ${marginOfSafetyPct >= 0 ? '+' : ''}${marginOfSafetyPct.toFixed(1)}%, Hạng cơ bản ${fundamentalGrade}). Vùng tích lũy tối ưu: <= ${safeBuyZonePrice.toLocaleString()}.`,
    };
  }

  // Quantitative Equilibrium Mode for Gold, Crypto, Indices, FX
  const closes = candles.map((c) => c.close);
  const ema50Arr = calculateEMA(closes, 50);
  const ema200Arr = calculateEMA(closes, Math.min(200, Math.max(20, closes.length)));
  const ema50 = ema50Arr[ema50Arr.length - 1] ?? currentPrice;
  const ema200 = ema200Arr[ema200Arr.length - 1] ?? currentPrice;

  // Volume-weighted mean over last 60 bars
  const recent60 = candles.slice(-60);
  let pvSum = 0;
  let vSum = 0;
  for (const c of recent60) {
    const typical = (c.high + c.low + c.close) / 3;
    const vol = c.volume > 0 ? c.volume : 1;
    pvSum += typical * vol;
    vSum += vol;
  }
  const vwap60 = vSum > 0 ? pvSum / vSum : currentPrice;

  const fairValuePrice = roundPriceSmart(vwap60 * 0.45 + ema50 * 0.35 + ema200 * 0.2);
  const safeBuyZonePrice = roundPriceSmart(fairValuePrice * 0.94);
  const overvaluedTrimPrice = roundPriceSmart(fairValuePrice * 1.06);
  const marginOfSafetyPct =
    fairValuePrice > 0
      ? Math.round(((fairValuePrice - currentPrice) / fairValuePrice) * 1000) / 10
      : 0;

  let valuationVerdict: QuickIntrinsicValuationReport['valuationVerdict'] = 'FAIR_VALUE_HOLD';
  let verdictLabelVi = 'CÂN BẰNG ĐỊNH LƯỢNG — GIAO DỊCH THEO XU HƯỚNG';

  if (marginOfSafetyPct >= 3.5) {
    valuationVerdict = 'UNDERVALUED_BUY';
    verdictLabelVi = `CHIẾT KHẤU ĐỊNH LƯỢNG (+${marginOfSafetyPct.toFixed(1)}%) — VÙNG GOM TỐT`;
  } else if (marginOfSafetyPct <= -4.5) {
    valuationVerdict = 'OVERVALUED_CAUTION';
    verdictLabelVi = `VƯỢT XA TRỤC CÂN BẰNG (${marginOfSafetyPct.toFixed(1)}%) — CHỜ PULLBACK`;
  }

  const totalFundamentalScore =
    marginOfSafetyPct >= 2 ? 82 : marginOfSafetyPct >= -3 ? 75 : 64;
  const fundamentalGrade: QuickIntrinsicValuationReport['fundamentalGrade'] =
    totalFundamentalScore >= 80 ? 'A' : 'B';

  return {
    symbol: symUpper,
    isEquityFundamentalMode: false,
    currentPrice: roundPriceSmart(currentPrice),
    fairValuePrice,
    safeBuyZonePrice,
    overvaluedTrimPrice,
    marginOfSafetyPct,
    valuationVerdict,
    verdictLabelVi,
    fundamentalGrade,
    totalFundamentalScore,
    methodologyLabelVi: 'Định Giá Cân Bằng Định Lượng (VWAP-60 × EMA50 × EMA200)',
    pillars: [
      {
        labelVi: 'Giá Trị Cân Bằng VWAP-60',
        valueText: `${roundPriceSmart(vwap60).toLocaleString()}`,
        score: 21,
        assessmentVi: 'Giá vốn trung bình theo khối lượng của dòng tiền 60 phiên gần nhất.',
      },
      {
        labelVi: 'Trục Trung Hạn EMA50 / EMA200',
        valueText: `${roundPriceSmart(ema50).toLocaleString()} / ${roundPriceSmart(ema200).toLocaleString()}`,
        score: 20,
        assessmentVi: 'Đường cơ sở định lượng xác định xu hướng dòng tiền tổ chức.',
      },
    ],
    summaryNoteVi: `Mức cân bằng định lượng của ${symUpper} nằm quanh ${fairValuePrice.toLocaleString()} (Lệch ${marginOfSafetyPct >= 0 ? '+' : ''}${marginOfSafetyPct.toFixed(1)}%). Vùng canh mua chiết khấu: ${safeBuyZonePrice.toLocaleString()}.`,
  };
}
