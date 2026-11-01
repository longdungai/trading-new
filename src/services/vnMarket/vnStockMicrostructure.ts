import { Candle, MarketSymbol } from '../../types';

export type VnExchangeBoard =
  | 'HOSE'
  | 'HNX'
  | 'UPCOM'
  | 'HNX_DERIVATIVE'
  | 'INDEX';

export type VnBoardColorState =
  | 'CEILING' // Tím (Kịch trần)
  | 'UP' // Xanh lá (Tăng giá)
  | 'REF' // Vàng (Tham chiếu)
  | 'DOWN' // Đỏ (Giảm giá)
  | 'FLOOR'; // Xanh lơ (Nằm sàn)

export interface VnPriceLimits {
  board: VnExchangeBoard;
  bandPct: number; // 7, 10, 15, or 0 for index
  tickSize: number; // in display price units (1,000 VND for stocks, points for index/derivative)
  lotSize: number; // 100 shares for equities, 1 contract for VN30F1M
  refPrice: number;
  ceilingPrice: number | null;
  floorPrice: number | null;
  currentPrice: number;
  colorState: VnBoardColorState;
  distToCeilingPct: number | null;
  distToFloorPct: number | null;
  isNearCeiling: boolean;
  isNearFloor: boolean;
  liquidityWarning: string | null;
}

export interface Vn30BasisAnalytics {
  spotPrice: number;
  futuresPrice: number;
  basisPoints: number;
  basisPct: number;
  regime:
    | 'STRONG_PREMIUM'
    | 'MILD_PREMIUM'
    | 'FAIR_VALUE'
    | 'DISCOUNT_HEDGING'
    | 'DEEP_DISCOUNT_SHORT';
  regimeLabel: string;
  expiryDateISO: string;
  daysToExpiry: number;
  isExpiryWeek: boolean;
  headline: string;
  guidance: string;
}

export type VnIntradayPhase =
  | 'PRE_OPEN'
  | 'ATO'
  | 'MORNING_CONTINUOUS'
  | 'LUNCH_BREAK'
  | 'AFTERNOON_CONTINUOUS'
  | 'ATC'
  | 'AFTER_HOURS_PLO'
  | 'CLOSED';

export interface VnIntradaySessionPulse {
  phase: VnIntradayPhase;
  phaseLabel: string;
  countdownLabel: string;
  isT2SettlementReleased: boolean;
  t2Note: string;
  expectedVolumeWeight: number; // 0.05..1.00 cumulative intraday volume curve
  rawTodayVolume: number | null;
  avg20SessionVolume: number | null;
  timeNormalizedRvol: number | null;
  projectedFullDayVolume: number | null;
  rvolState: 'EXPLOSIVE' | 'ACTIVE' | 'NORMAL' | 'DRY' | 'UNKNOWN';
  rvolLabel: string;
}

export type VnSectorQuad = 'LEADING' | 'IMPROVING' | 'WEAKENING' | 'LAGGING';

export interface VnSectorRotationItem {
  sectorId: string;
  sectorName: string;
  shortName: string;
  tickers: string[];
  trackedCount: number;
  advancers: number;
  decliners: number;
  avgChangePct: number;
  rsSpreadVsVnIndex: number;
  breadthAdvPct: number;
  quadrant: VnSectorQuad;
  quadrantLabel: string;
  leaderSymbol: string | null;
  leaderChangePct: number | null;
  laggardSymbol: string | null;
  laggardChangePct: number | null;
}

export interface VnPositionSizingResult {
  isDerivative: boolean;
  board: VnExchangeBoard;
  lotSize: number;
  recommendedSharesOrContracts: number;
  recommendedLots: number;
  notionalMillionVnd: number;
  marginRequiredMillionVnd: number;
  estimatedFeeAndTaxThousandVnd: number;
  maxRiskMillionVnd: number;
  roundedEntry: number;
  roundedStopLoss: number;
  settlementRuleNote: string;
}

const HNX_STOCKS = new Set([
  'PVS',
  'SHS',
  'IDC',
  'MBS',
  'CEO',
  'TNG',
  'VCS',
  'HUT',
  'NVB',
  'THD',
  'PVI',
  'BVS',
  'LAS',
  'DTD',
  'VGS',
]);

const UPCOM_STOCKS = new Set([
  'ACV',
  'VEA',
  'OIL',
  'QNS',
  'VGI',
  'MCH',
  'VGT',
  'FOX',
  'SJC',
]);

const VN_INDEX_SYMBOLS = new Set(['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX']);

export function isVnDerivativeSymbol(symbol: string): boolean {
  return /^VN30F\d/i.test(symbol.trim().toUpperCase());
}

export function isVnStockOrIndexSymbol(
  item: Pick<MarketSymbol, 'symbol' | 'type' | 'quoteAsset'> | string
): boolean {
  if (typeof item === 'string') {
    const u = item.trim().toUpperCase();
    if (VN_INDEX_SYMBOLS.has(u) || isVnDerivativeSymbol(u)) return true;
    return VN_SECTOR_LOOKUP.has(u) || HNX_STOCKS.has(u) || UPCOM_STOCKS.has(u);
  }
  const u = item.symbol.trim().toUpperCase();
  if (VN_INDEX_SYMBOLS.has(u) || isVnDerivativeSymbol(u)) return true;
  return item.quoteAsset === 'VND' || item.type === 'vn30';
}

export function getVnExchangeBoard(symbol: string): VnExchangeBoard {
  const u = symbol.trim().toUpperCase();
  if (isVnDerivativeSymbol(u)) return 'HNX_DERIVATIVE';
  if (VN_INDEX_SYMBOLS.has(u)) return 'INDEX';
  if (UPCOM_STOCKS.has(u)) return 'UPCOM';
  if (HNX_STOCKS.has(u)) return 'HNX';
  return 'HOSE';
}

/**
 * Official HOSE / HNX / UPCOM / HNX Derivatives tick size in app display units
 * - HOSE Equities (displayed in 1,000 VND):
 *   < 10.00k  -> 0.01k (10 VND)
 *   10..49.95 -> 0.05k (50 VND)
 *   >= 50.00k -> 0.10k (100 VND)
 * - HNX / UPCOM Equities: 0.10k (100 VND)
 * - VN30F1M Derivative: 0.1 index point
 */
export function getVnTickSize(price: number, board: VnExchangeBoard): number {
  if (board === 'HNX_DERIVATIVE') return 0.1;
  if (board === 'INDEX') return 0.01;
  if (board === 'HNX' || board === 'UPCOM') return 0.1;
  // HOSE tiered tick rules
  if (price < 10) return 0.01;
  if (price < 50) return 0.05;
  return 0.1;
}

export function roundToVnTickSize(price: number, symbolOrBoard: string | VnExchangeBoard): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const board: VnExchangeBoard =
    symbolOrBoard === 'HOSE' ||
    symbolOrBoard === 'HNX' ||
    symbolOrBoard === 'UPCOM' ||
    symbolOrBoard === 'HNX_DERIVATIVE' ||
    symbolOrBoard === 'INDEX'
      ? symbolOrBoard
      : getVnExchangeBoard(symbolOrBoard);

  const tick = getVnTickSize(price, board);
  const rounded = Math.round(price / tick) * tick;
  return parseFloat(rounded.toFixed(board === 'HNX_DERIVATIVE' ? 1 : 2));
}

function floorToVnTick(rawPrice: number, board: VnExchangeBoard): number {
  const tick = getVnTickSize(rawPrice, board);
  const floored = Math.floor((rawPrice + 1e-9) / tick) * tick;
  return parseFloat(floored.toFixed(board === 'HNX_DERIVATIVE' ? 1 : 2));
}

function ceilToVnTick(rawPrice: number, board: VnExchangeBoard): number {
  const tick = getVnTickSize(rawPrice, board);
  const ceiled = Math.ceil((rawPrice - 1e-9) / tick) * tick;
  return parseFloat(ceiled.toFixed(board === 'HNX_DERIVATIVE' ? 1 : 2));
}

/**
 * Computes official Vietnam Ceiling (Trần - Tím), Reference (Tham chiếu - Vàng), and Floor (Sàn - Xanh lơ)
 * Matches HOSE/HNX matching engine tick rounding (e.g. FPT ref 52.70 -> ceiling 56.30, floor 49.05).
 */
export function computeVnPriceLimits(params: {
  symbol: string;
  currentPrice: number;
  change24hPct?: number;
  officialRefPrice?: number | null;
  officialCeilingPrice?: number | null;
  officialFloorPrice?: number | null;
}): VnPriceLimits {
  const board = getVnExchangeBoard(params.symbol);
  const currentPrice = params.currentPrice > 0 ? params.currentPrice : 0;
  const tickSize = getVnTickSize(currentPrice || 20, board);
  const lotSize = board === 'HNX_DERIVATIVE' ? 1 : board === 'INDEX' ? 1 : 100;

  const bandPct =
    board === 'INDEX'
      ? 0
      : board === 'UPCOM'
      ? 15
      : board === 'HNX'
      ? 10
      : 7; // HOSE & VN30F1M Derivative both enforce ±7% daily limit

  const inferredRef =
    params.officialRefPrice && params.officialRefPrice > 0
      ? params.officialRefPrice
      : params.change24hPct && Math.abs(params.change24hPct) < 30
      ? roundToVnTickSize(currentPrice / (1 + params.change24hPct / 100), board)
      : currentPrice;

  if (board === 'INDEX' || bandPct === 0) {
    const state: VnBoardColorState =
      currentPrice > inferredRef * 1.0002
        ? 'UP'
        : currentPrice < inferredRef * 0.9998
        ? 'DOWN'
        : 'REF';
    return {
      board,
      bandPct: 0,
      tickSize,
      lotSize,
      refPrice: parseFloat(inferredRef.toFixed(2)),
      ceilingPrice: null,
      floorPrice: null,
      currentPrice,
      colorState: state,
      distToCeilingPct: null,
      distToFloorPct: null,
      isNearCeiling: false,
      isNearFloor: false,
      liquidityWarning: null,
    };
  }

  const ceilingPrice =
    params.officialCeilingPrice && params.officialCeilingPrice > 0
      ? params.officialCeilingPrice
      : floorToVnTick(inferredRef * (1 + bandPct / 100), board);

  const floorPrice =
    params.officialFloorPrice && params.officialFloorPrice > 0
      ? params.officialFloorPrice
      : ceilToVnTick(inferredRef * (1 - bandPct / 100), board);

  const halfTick = tickSize * 0.45;
  let colorState: VnBoardColorState = 'REF';
  if (currentPrice >= ceilingPrice - halfTick) {
    colorState = 'CEILING';
  } else if (currentPrice <= floorPrice + halfTick) {
    colorState = 'FLOOR';
  } else if (currentPrice > inferredRef + halfTick) {
    colorState = 'UP';
  } else if (currentPrice < inferredRef - halfTick) {
    colorState = 'DOWN';
  }

  const distToCeilingPct =
    currentPrice > 0
      ? parseFloat((((ceilingPrice - currentPrice) / currentPrice) * 100).toFixed(2))
      : null;
  const distToFloorPct =
    currentPrice > 0
      ? parseFloat((((currentPrice - floorPrice) / currentPrice) * 100).toFixed(2))
      : null;

  const isNearCeiling = distToCeilingPct !== null && distToCeilingPct <= 1.0;
  const isNearFloor = distToFloorPct !== null && distToFloorPct <= 1.2;

  let liquidityWarning: string | null = null;
  if (colorState === 'FLOOR') {
    liquidityWarning =
      board === 'HNX_DERIVATIVE'
        ? 'VN30F1M chạm biên Sàn (-7%): Cảnh báo biến động cực đoan & Call Margin vị thế Long!'
        : `Cổ phiếu đang nằm Sàn (-${bandPct}%): Cảnh báo rủi ro "trắng bên mua", nhốt thanh khoản T+2 và áp lực giải chấp chéo (Call Margin)!`;
  } else if (isNearFloor) {
    liquidityWarning = `Giá đang áp sát biên Sàn (cách sàn ${distToFloorPct}%): Tuyệt đối thận trọng bắt đáy sớm trước khi hấp thụ hết cung bán tháo!`;
  } else if (colorState === 'CEILING') {
    liquidityWarning = `Đang khóa Trần tím (+${bandPct}%): Dư mua trần mạnh — tránh đặt lệnh đuổi bất chấp nếu thanh khoản đột ngột phân phối!`;
  }

  return {
    board,
    bandPct,
    tickSize,
    lotSize,
    refPrice: inferredRef,
    ceilingPrice,
    floorPrice,
    currentPrice,
    colorState,
    distToCeilingPct,
    distToFloorPct,
    isNearCeiling,
    isNearFloor,
    liquidityWarning,
  };
}

/**
 * Third Thursday of current or next month at 14:45 GMT+7 (HNX VN30F1M Expiry Rule)
 */
export function getNextVn30f1mExpiryDate(now: Date = new Date()): {
  expiryDateISO: string;
  daysToExpiry: number;
} {
  const findThirdThursday = (year: number, monthIndex0: number): Date => {
    const firstDay = new Date(Date.UTC(year, monthIndex0, 1, 7, 45, 0)); // 14:45 GMT+7 = 07:45 UTC
    const dow = firstDay.getUTCDay(); // 0=Sun..4=Thu
    const offsetToThu = (4 - dow + 7) % 7;
    const thirdThuDay = 1 + offsetToThu + 14;
    return new Date(Date.UTC(year, monthIndex0, thirdThuDay, 7, 45, 0));
  };

  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  let target = findThirdThursday(y, m);
  if (target.getTime() <= now.getTime()) {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    target = findThirdThursday(y, m);
  }

  const diffDays = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000));
  return {
    expiryDateISO: target.toISOString().slice(0, 10),
    daysToExpiry: diffDays,
  };
}

export function computeVn30BasisAnalytics(
  symbols: MarketSymbol[],
  now: Date = new Date()
): Vn30BasisAnalytics | null {
  const spotSym = symbols.find((s) => s.symbol.toUpperCase() === 'VN30');
  const futSym = symbols.find((s) => s.symbol.toUpperCase() === 'VN30F1M');
  if (!spotSym || !futSym || !(spotSym.price > 0) || !(futSym.price > 0)) {
    return null;
  }

  const spotPrice = spotSym.price;
  const futuresPrice = futSym.price;
  const basisPoints = parseFloat((futuresPrice - spotPrice).toFixed(2));
  const basisPct = parseFloat(((basisPoints / spotPrice) * 100).toFixed(2));
  const { expiryDateISO, daysToExpiry } = getNextVn30f1mExpiryDate(now);
  const isExpiryWeek = daysToExpiry <= 4;

  let regime: Vn30BasisAnalytics['regime'] = 'FAIR_VALUE';
  let regimeLabel = 'Cân bằng (Fair Basis)';
  let headline = `Basis cân bằng (${basisPoints >= 0 ? '+' : ''}${basisPoints} điểm) — Phái sinh & Cơ sở đồng thuận`;
  let guidance =
    'Độ lệch giữa VN30F1M và VN30 nằm trong biên độ cân bằng chuẩn. Ít xảy ra nhiễu trượt giá arbitrage giữa 2 thị trường.';

  if (basisPoints >= 5.0) {
    regime = 'STRONG_PREMIUM';
    regimeLabel = 'Premium dương cao (Kỳ vọng Long)';
    headline = `VN30F1M đang cao hơn VN30 cơ sở +${basisPoints} điểm (+${basisPct}%)`;
    guidance =
      'Dòng tiền phái sinh đang chấp nhận trả giá cao (Premium) kỳ vọng nhịp kéo trụ VN30. Cẩn trọng bẫy Fomo Long đuổi nếu Basis giãn quá +10 điểm.';
  } else if (basisPoints >= 1.2) {
    regime = 'MILD_PREMIUM';
    regimeLabel = 'Premium tích cực';
    headline = `Basis dương nhẹ +${basisPoints} điểm — Tâm lý phái sinh lạc quan`;
    guidance =
      'Nhà đầu tư phái sinh nghiêng về kịch bản tăng điểm ngắn hạn của nhóm cổ phiếu trụ Ngân hàng & VN30.';
  } else if (basisPoints <= -6.0) {
    regime = 'DEEP_DISCOUNT_SHORT';
    regimeLabel = 'Discount âm sâu (Phòng vệ / Short)';
    headline = `VN30F1M chiết khấu sâu ${basisPoints} điểm (${basisPct}%) so với VN30`;
    guidance =
      'Phe Short hoặc dòng tiền phòng vệ (Hedging) đang chiết khấu mạnh rủi ro điều chỉnh cơ sở. Nếu VN30 giữ vững hỗ trợ, dễ xuất hiện nhịp Short-squeeze kéo thốc!';
  } else if (basisPoints <= -1.5) {
    regime = 'DISCOUNT_HEDGING';
    regimeLabel = 'Discount thận trọng';
    headline = `Basis âm ${basisPoints} điểm — Phái sinh thận trọng hơn cơ sở`;
    guidance =
      'Tâm lý dè dặt trên hợp đồng tương lai VN30F1M. Ưu tiên quan sát phản ứng cung cầu tại vùng hỗ trợ của rổ VN30.';
  }

  if (isExpiryWeek) {
    guidance = `⚠️ Sát ngày đáo hạn VN30F1M (${expiryDateISO} — còn ${daysToExpiry} ngày): Basis bắt buộc hội tụ về 0 lúc 14:45 ATC Thứ Năm. Cảnh giác biến động kéo/đạp trụ VIC, VHM, VCB, FPT, HPG khung 14:15–14:45!`;
  }

  return {
    spotPrice,
    futuresPrice,
    basisPoints,
    basisPct,
    regime,
    regimeLabel,
    expiryDateISO,
    daysToExpiry,
    isExpiryWeek,
    headline,
    guidance,
  };
}

/**
 * Empirical HOSE U-shaped cumulative volume curve across 09:00-11:30 & 13:00-14:45 (GMT+7)
 */
function getExpectedHoseCumulativeVolumeWeight(vnMinutesFromMidnight: number): number {
  if (vnMinutesFromMidnight < 540) return 1.0; // Before 09:00 -> viewing previous closed session
  if (vnMinutesFromMidnight < 555) {
    // 09:00 - 09:15 ATO (~8% of daily volume)
    return Math.max(0.05, ((vnMinutesFromMidnight - 540) / 15) * 0.08);
  }
  if (vnMinutesFromMidnight < 615) {
    // 09:15 - 10:15 Early Morning (~24% -> cumulative 32%)
    return 0.08 + ((vnMinutesFromMidnight - 555) / 60) * 0.24;
  }
  if (vnMinutesFromMidnight < 690) {
    // 10:15 - 11:30 Late Morning (~23% -> cumulative 55%)
    return 0.32 + ((vnMinutesFromMidnight - 615) / 75) * 0.23;
  }
  if (vnMinutesFromMidnight < 780) {
    // 11:30 - 13:00 Lunch Break (cumulative 55%)
    return 0.55;
  }
  if (vnMinutesFromMidnight < 840) {
    // 13:00 - 14:00 T+2 Settlement Release & Early Afternoon (~22% -> cumulative 77%)
    return 0.55 + ((vnMinutesFromMidnight - 780) / 60) * 0.22;
  }
  if (vnMinutesFromMidnight < 870) {
    // 14:00 - 14:30 Late Afternoon (~14% -> cumulative 91%)
    return 0.77 + ((vnMinutesFromMidnight - 840) / 30) * 0.14;
  }
  if (vnMinutesFromMidnight < 885) {
    // 14:30 - 14:45 ATC (~9% -> cumulative 100%)
    return 0.91 + ((vnMinutesFromMidnight - 870) / 15) * 0.09;
  }
  return 1.0;
}

export function computeVnIntradaySessionPulse(
  dailyOrIntradayCandles: Candle[],
  now: Date = new Date()
): VnIntradaySessionPulse {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const wk = map.weekday || 'Mon';
  const isWeekend = wk === 'Sat' || wk === 'Sun';
  let hour = parseInt(map.hour || '0', 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(map.minute || '0', 10);
  const mins = hour * 60 + minute;

  let phase: VnIntradayPhase = 'CLOSED';
  let phaseLabel = 'Đã kết phiên (Sau 15:00)';
  let countdownLabel = 'Mở cửa ATO 09:00 phiên kế tiếp';

  if (isWeekend) {
    phase = 'CLOSED';
    phaseLabel = 'Nghỉ cuối tuần (Thứ 7 & CN)';
    countdownLabel = 'Mở lại phiên ATO 09:00 Thứ Hai';
  } else if (mins < 540) {
    phase = 'PRE_OPEN';
    phaseLabel = 'Trước giờ mở cửa';
    countdownLabel = `Còn ${540 - mins} phút tới phiên ATO (09:00)`;
  } else if (mins < 555) {
    phase = 'ATO';
    phaseLabel = 'Phiên ATO định kỳ mở cửa (09:00–09:15)';
    countdownLabel = `Còn ${555 - mins} phút khớp giá ATO`;
  } else if (mins < 690) {
    phase = 'MORNING_CONTINUOUS';
    phaseLabel = 'Khớp lệnh liên tục Sáng (09:15–11:30)';
    countdownLabel = `Còn ${690 - mins} phút tới giờ nghỉ trưa`;
  } else if (mins < 780) {
    phase = 'LUNCH_BREAK';
    phaseLabel = 'Nghỉ trưa giữa phiên (11:30–13:00)';
    countdownLabel = `Còn ${780 - mins} phút tới phiên Chiều & Hàng T+2 về`;
  } else if (mins < 870) {
    phase = 'AFTERNOON_CONTINUOUS';
    phaseLabel = 'Khớp lệnh liên tục Chiều (13:00–14:30)';
    countdownLabel = `Còn ${870 - mins} phút bước vào phiên ATC (14:30)`;
  } else if (mins < 885) {
    phase = 'ATC';
    phaseLabel = '🔥 Phiên ATC định kỳ đóng cửa (14:30–14:45)';
    countdownLabel = `Còn ${885 - mins} phút chốt giá đóng cửa ATC!`;
  } else if (mins < 900) {
    phase = 'AFTER_HOURS_PLO';
    phaseLabel = 'Phiên PLO / Thỏa thuận cuối ngày (14:45–15:00)';
    countdownLabel = `Còn ${900 - mins} phút đóng bảng hoàn toàn`;
  }

  const isT2SettlementReleased = !isWeekend && mins >= 780;
  const t2Note = isWeekend
    ? 'Cuối tuần — Dữ liệu thanh khoản chốt theo phiên Thứ Sáu gần nhất'
    : mins >= 780 && mins < 885
    ? '⚡ Cổ phiếu mua T+2 đã về tài khoản lúc 13:00 — Đang kiểm định thực tế lực hấp thụ cung chốt lời!'
    : mins >= 540 && mins < 780
    ? 'Lưu ý T+2: Lượng cổ phiếu mua cách đây 2 phiên sẽ về tài khoản lúc 13:00 chiều nay.'
    : 'Chu kỳ thanh toán T+2: Mua hôm nay (T+0) sẽ về tài khoản khả dụng lúc 13:00 ngày T+2.';

  const expectedWeight = isWeekend ? 1.0 : getExpectedHoseCumulativeVolumeWeight(mins);

  let rawTodayVolume: number | null = null;
  let avg20SessionVolume: number | null = null;
  let timeNormalizedRvol: number | null = null;
  let projectedFullDayVolume: number | null = null;

  const validVolCandles = dailyOrIntradayCandles.filter((c) => c.volume > 0);
  if (validVolCandles.length >= 6) {
    const lastCandle = validVolCandles[validVolCandles.length - 1];
    const priorSlice = validVolCandles.slice(-21, -1);
    const avgPrior =
      priorSlice.reduce((sum, c) => sum + c.volume, 0) / Math.max(1, priorSlice.length);

    if (avgPrior > 0) {
      rawTodayVolume = Math.round(lastCandle.volume);
      avg20SessionVolume = Math.round(avgPrior);
      const effectiveWeight =
        phase === 'CLOSED' || phase === 'PRE_OPEN' ? 1.0 : Math.max(0.08, expectedWeight);
      const expectedAtThisMinute = avgPrior * effectiveWeight;
      timeNormalizedRvol = parseFloat((lastCandle.volume / expectedAtThisMinute).toFixed(2));
      projectedFullDayVolume = Math.round(lastCandle.volume / effectiveWeight);
    }
  }

  let rvolState: VnIntradaySessionPulse['rvolState'] = 'UNKNOWN';
  let rvolLabel = 'Đang đồng bộ KLGD';
  if (timeNormalizedRvol !== null) {
    if (timeNormalizedRvol >= 1.75) {
      rvolState = 'EXPLOSIVE';
      rvolLabel = `Bùng nổ dòng tiền (${timeNormalizedRvol.toFixed(2)}x TB giờ)`;
    } else if (timeNormalizedRvol >= 1.2) {
      rvolState = 'ACTIVE';
      rvolLabel = `Tiền vào chủ động (${timeNormalizedRvol.toFixed(2)}x TB giờ)`;
    } else if (timeNormalizedRvol <= 0.65) {
      rvolState = 'DRY';
      rvolLabel = `Thanh khoản cạn cung (${timeNormalizedRvol.toFixed(2)}x TB giờ)`;
    } else {
      rvolState = 'NORMAL';
      rvolLabel = `Thanh khoản cân bằng (${timeNormalizedRvol.toFixed(2)}x TB giờ)`;
    }
  }

  return {
    phase,
    phaseLabel,
    countdownLabel,
    isT2SettlementReleased,
    t2Note,
    expectedVolumeWeight: parseFloat(expectedWeight.toFixed(2)),
    rawTodayVolume,
    avg20SessionVolume,
    timeNormalizedRvol,
    projectedFullDayVolume,
    rvolState,
    rvolLabel,
  };
}

export const VN_SECTOR_DEFINITIONS: Array<{
  id: string;
  name: string;
  shortName: string;
  tickers: string[];
}> = [
  {
    id: 'BANKS',
    name: 'Ngân hàng (Trụ dẫn dắt VN30)',
    shortName: 'Ngân hàng',
    tickers: ['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'STB', 'HDB', 'LPB', 'VIB', 'TPB', 'SHB', 'SSB'],
  },
  {
    id: 'SECURITIES',
    name: 'Chứng khoán (Độ nhạy Beta cao)',
    shortName: 'Chứng khoán',
    tickers: ['SSI', 'VCI', 'HCM', 'VND', 'SHS', 'MBS', 'FTS', 'BSI', 'VIX'],
  },
  {
    id: 'REAL_ESTATE',
    name: 'Bất động sản Dân cư & Thương mại',
    shortName: 'BĐS Dân cư',
    tickers: ['VHM', 'VIC', 'VRE', 'KDH', 'NLG', 'DIG', 'DXG', 'PDR', 'NVL', 'CEO'],
  },
  {
    id: 'INDUSTRIAL_PARK',
    name: 'BĐS Khu Công Nghiệp & Cao su FDI',
    shortName: 'BĐS KCN',
    tickers: ['BCM', 'GVR', 'KBC', 'IDC', 'SZC', 'VGC', 'PHR'],
  },
  {
    id: 'STEEL',
    name: 'Thép & Vật liệu xây dựng',
    shortName: 'Thép',
    tickers: ['HPG', 'HSG', 'NKG'],
  },
  {
    id: 'PUBLIC_INVESTMENT',
    name: 'Đầu tư công & Xây dựng Hạ tầng',
    shortName: 'Đầu tư công',
    tickers: ['HHV', 'VCG', 'CTD', 'LCG', 'FCN'],
  },
  {
    id: 'OIL_ENERGY',
    name: 'Dầu khí & Điện Năng lượng',
    shortName: 'Dầu khí & Điện',
    tickers: ['GAS', 'PLX', 'PVS', 'PVD', 'BSR', 'PVT', 'POW', 'REE', 'PC1'],
  },
  {
    id: 'TECH_RETAIL',
    name: 'Công nghệ, Bán lẻ & Tiêu dùng',
    shortName: 'CNTT & Bán lẻ',
    tickers: ['FPT', 'MWG', 'FRT', 'DGW', 'PNJ', 'MSN', 'VNM', 'SAB'],
  },
  {
    id: 'CHEMICAL_FERT',
    name: 'Hóa chất & Phân bón',
    shortName: 'Hóa chất & Đạm',
    tickers: ['DGC', 'DCM', 'DPM'],
  },
  {
    id: 'LOGISTICS_EXPORT',
    name: 'Cảng biển, Hàng không & Xuất khẩu',
    shortName: 'Cảng & Xuất khẩu',
    tickers: ['GMD', 'HAH', 'VJC', 'VHC', 'ANV', 'TNG', 'DBC'],
  },
];

const VN_SECTOR_LOOKUP = new Map<string, { id: string; name: string; shortName: string }>();
for (const sec of VN_SECTOR_DEFINITIONS) {
  for (const tk of sec.tickers) {
    VN_SECTOR_LOOKUP.set(tk, { id: sec.id, name: sec.name, shortName: sec.shortName });
  }
}

export function getVnStockSectorInfo(
  symbol: string
): { id: string; name: string; shortName: string } | null {
  return VN_SECTOR_LOOKUP.get(symbol.trim().toUpperCase()) ?? null;
}

export function computeVnSectorRotation(symbols: MarketSymbol[]): {
  vnIndexChangePct: number;
  sectors: VnSectorRotationItem[];
} {
  const bySymbol = new Map<string, MarketSymbol>();
  for (const s of symbols) {
    bySymbol.set(s.symbol.toUpperCase(), s);
  }

  const vnIndexSym = bySymbol.get('VNINDEX');
  const vnIndexChangePct = vnIndexSym ? vnIndexSym.change24h : 0;

  const sectors: VnSectorRotationItem[] = [];

  for (const def of VN_SECTOR_DEFINITIONS) {
    const matched = def.tickers
      .map((tk) => bySymbol.get(tk))
      .filter((x): x is MarketSymbol => Boolean(x));

    if (matched.length === 0) continue;

    const advancers = matched.filter((m) => m.change24h > 0).length;
    const decliners = matched.filter((m) => m.change24h < 0).length;
    const avgChangePct = parseFloat(
      (matched.reduce((acc, m) => acc + m.change24h, 0) / matched.length).toFixed(2)
    );
    const rsSpread = parseFloat((avgChangePct - vnIndexChangePct).toFixed(2));
    const breadthAdvPct = Math.round((advancers / matched.length) * 100);

    const sorted = matched.slice().sort((a, b) => b.change24h - a.change24h);
    const leader = sorted[0];
    const laggard = sorted[sorted.length - 1];

    let quadrant: VnSectorQuad = 'LAGGING';
    let quadrantLabel = 'Tụt hậu (Lagging)';

    if (rsSpread >= 0.25 && breadthAdvPct >= 50) {
      quadrant = 'LEADING';
      quadrantLabel = '🚀 Dẫn sóng (Leading)';
    } else if (rsSpread >= 0 && breadthAdvPct < 50) {
      quadrant = 'IMPROVING';
      quadrantLabel = '🌱 Hồi phục chọn lọc (Improving)';
    } else if (rsSpread < 0 && avgChangePct > 0) {
      quadrant = 'WEAKENING';
      quadrantLabel = '⚠️ Chững đà (Weakening)';
    } else {
      quadrant = 'LAGGING';
      quadrantLabel = '🔻 Suy yếu (Lagging)';
    }

    sectors.push({
      sectorId: def.id,
      sectorName: def.name,
      shortName: def.shortName,
      tickers: matched.map((m) => m.symbol),
      trackedCount: matched.length,
      advancers,
      decliners,
      avgChangePct,
      rsSpreadVsVnIndex: rsSpread,
      breadthAdvPct,
      quadrant,
      quadrantLabel,
      leaderSymbol: leader?.symbol ?? null,
      leaderChangePct: leader ? leader.change24h : null,
      laggardSymbol: laggard?.symbol ?? null,
      laggardChangePct: laggard ? laggard.change24h : null,
    });
  }

  sectors.sort((a, b) => b.rsSpreadVsVnIndex - a.rsSpreadVsVnIndex);

  return {
    vnIndexChangePct,
    sectors,
  };
}

/**
 * Computes institutional Vietnam Position Sizing:
 * - Equities (HOSE/HNX/UPCOM): Enforces 100-share board lot (Lô chẵn 100 CP), brokerage fee 0.15% + sell tax 0.10%, T+2 hold
 * - Derivatives (VN30F1M): Multiplier 100,000 VND/pt, VSD/CTCk Initial Margin ~17%
 *
 * `capitalThousandVnd`: user's capital in 1,000 VND units (consistent with app's VND unit where 100,000 = 100 triệu VNĐ;
 * if user enters >= 5,000,000 thinking raw VND, auto-converts cleanly to thousand VND).
 */
export function computeVnPositionSizing(params: {
  symbol: string;
  capitalInput: number;
  riskPercent: number;
  entryPrice: number;
  stopLossPrice: number;
}): VnPositionSizingResult {
  const board = getVnExchangeBoard(params.symbol);
  const isDerivative = board === 'HNX_DERIVATIVE';

  // Normalize capital into Million VND
  // If user typed e.g. 100,000 (100,000k = 100 triệu) or 200 (200 triệu) or 100,000,000 (raw VND):
  let capitalMillionVnd = 100;
  if (params.capitalInput >= 10_000_000) {
    capitalMillionVnd = params.capitalInput / 1_000_000;
  } else if (params.capitalInput >= 5_000) {
    // App's default VND unit is 1,000 VND (e.g. 100,000k = 100 triệu)
    capitalMillionVnd = params.capitalInput / 1_000;
  } else if (params.capitalInput > 0) {
    // User typed directly in triệu VNĐ (e.g. 100 = 100 triệu)
    capitalMillionVnd = params.capitalInput;
  }

  const roundedEntry = roundToVnTickSize(params.entryPrice, board);
  const roundedStopLoss = roundToVnTickSize(params.stopLossPrice, board);
  const maxRiskBudgetMillion = capitalMillionVnd * (Math.max(0.1, params.riskPercent) / 100);

  if (isDerivative) {
    // VN30F1M: 1 index point = 100,000 VND = 0.1 Million VND
    const pointStopDist = Math.max(2.0, Math.abs(roundedEntry - roundedStopLoss));
    const lossPerContractMillion = pointStopDist * 0.1 + 0.015; // includes ~15k roundtrip derivative fee/tax
    const marginPerContractMillion = roundedEntry * 0.1 * 0.17; // 17% initial margin (~32 tr/HĐ)

    const maxByRisk = Math.floor(maxRiskBudgetMillion / lossPerContractMillion);
    const maxByMargin = Math.floor((capitalMillionVnd * 0.85) / Math.max(1, marginPerContractMillion));
    const contracts = Math.max(1, Math.min(maxByRisk || 1, Math.max(1, maxByMargin)));

    return {
      isDerivative: true,
      board,
      lotSize: 1,
      recommendedSharesOrContracts: contracts,
      recommendedLots: contracts,
      notionalMillionVnd: parseFloat((contracts * roundedEntry * 0.1).toFixed(2)),
      marginRequiredMillionVnd: parseFloat((contracts * marginPerContractMillion).toFixed(2)),
      estimatedFeeAndTaxThousandVnd: Math.round(contracts * 15),
      maxRiskMillionVnd: parseFloat((contracts * lossPerContractMillion).toFixed(2)),
      roundedEntry,
      roundedStopLoss,
      settlementRuleNote:
        'Phái sinh VN30F1M (T+0): Đóng/mở vị thế ngay trong phiên • 1 điểm = 100,000 VNĐ • Ký quỹ an toàn ~17%/HĐ',
    };
  }

  // Equities: price is in 1,000 VND/share -> 100 shares (1 lot) costs (roundedEntry * 0.1) Million VND
  const stopDiffPerShareThousand = Math.max(roundedEntry * 0.015, Math.abs(roundedEntry - roundedStopLoss));
  const roundtripFrictionRate = 0.004; // 0.15% buy fee + 0.15% sell fee + 0.10% PIT sell tax
  const riskPerLotMillion =
    (stopDiffPerShareThousand * 100) / 1000 +
    ((roundedEntry * 100) / 1000) * roundtripFrictionRate;
  const costPerLotMillion = (roundedEntry * 100) / 1000;

  const maxLotsByRisk = Math.floor(maxRiskBudgetMillion / Math.max(0.01, riskPerLotMillion));
  const maxLotsByCash = Math.floor(capitalMillionVnd / Math.max(0.05, costPerLotMillion));
  const lots = Math.max(1, Math.min(maxLotsByRisk || 1, Math.max(1, maxLotsByCash)));
  const shares = lots * 100;
  const notionalMillion = lots * costPerLotMillion;
  const feeAndTaxThousand = Math.round(notionalMillion * 1000 * roundtripFrictionRate);

  return {
    isDerivative: false,
    board,
    lotSize: 100,
    recommendedSharesOrContracts: shares,
    recommendedLots: lots,
    notionalMillionVnd: parseFloat(notionalMillion.toFixed(2)),
    marginRequiredMillionVnd: parseFloat(notionalMillion.toFixed(2)),
    estimatedFeeAndTaxThousandVnd: feeAndTaxThousand,
    maxRiskMillionVnd: parseFloat((lots * riskPerLotMillion).toFixed(2)),
    roundedEntry,
    roundedStopLoss,
    settlementRuleNote: `Cổ phiếu ${board} (Lô chẵn 100 CP • Biên ±${
      board === 'UPCOM' ? 15 : board === 'HNX' ? 10 : 7
    }%): Chu kỳ T+2 (về tài khoản 13:00 ngày T+2) • Đã tính phí GD + thuế bán 0.10%`,
  };
}
