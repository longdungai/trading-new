import { MacroIntelligenceSnapshot, MarketSymbol } from '../../types';

// Exact international-to-Vietnam gold weight standard:
// 1 Vietnam tael (lượng / cây) = 37.5 grams
// 1 Troy Ounce = 31.1034768 grams
// => 1 lượng = 37.5 / 31.1034768 = 1.205653027 troy ounces
export const TROY_OZ_PER_VN_TAEL = 37.5 / 31.1034768;

// Standard physical bullion import CIF + insurance + minting reference (~1.05%)
export const STANDARD_CIF_MINTING_FACTOR = 1.0105;

const DEALER_QUOTE_STORAGE_KEY = 'trading_new_vn_dealer_gold_quote_v1';

export interface DealerGoldQuoteInput {
  sjcSellMillion: number | null; // e.g., 142.5 (million VND / tael) — null if user hasn't entered shop quote
  ring9999SellMillion: number | null; // e.g., 139.2 (million VND / tael)
  customUsdVndFreeMarket: number | null; // Optional free-market USD/VND override
  updatedAtMs: number;
}

export type GoldPremiumRegime = 'DISCOUNT_OR_PARITY' | 'FAIR_SPREAD' | 'MODERATE_PREMIUM' | 'EXTREME_PREMIUM' | 'UNSET';

export type VnFxPressureRegime = 'FAVORABLE_INFLOW' | 'NEUTRAL_BALANCED' | 'ELEVATED_FX_PRESSURE' | 'HIGH_OUTFLOW_RISK';

export interface GoldSpreadComparison {
  label: string;
  dealerSellMillion: number;
  parityRefMillion: number;
  spreadMillionPerTael: number;
  spreadPct: number;
  regime: GoldPremiumRegime;
  guidance: string;
}

export interface VnGoldFxArbitrageSnapshot {
  spotGoldUsdOz: number;
  spotGoldSource: string;
  spotGoldChange24h: number;
  officialUsdVnd: number;
  effectiveUsdVnd: number;
  isCustomUsdVnd: boolean;
  // Converted world gold prices in Million VND per Tael (triệu đồng / lượng) & per Mace (triệu đồng / chỉ)
  worldRawMillionPerTael: number;
  worldCifParityMillionPerTael: number;
  worldRawMillionPerMace: number;
  worldCifParityMillionPerMace: number;
  // Optional dealer comparisons when user enters live SJC / 9999 Ring dealer quote
  sjcComparison: GoldSpreadComparison | null;
  ring9999Comparison: GoldSpreadComparison | null;
  // Vietnam Interbank FX & Foreign Institutional Flow Pressure
  fxPressureScore: number; // 0 (most favorable) .. 100 (highest FX stress)
  fxPressureRegime: VnFxPressureRegime;
  fxPressureHeadline: string;
  fxPressureGuidance: string;
  dxyValue: number | null;
  us10yValue: number | null;
  usdVndChangePct: number;
  fedPivotScore: number | null;
}

export function loadDealerGoldQuoteInput(): DealerGoldQuoteInput {
  if (typeof window === 'undefined') {
    return {
      sjcSellMillion: null,
      ring9999SellMillion: null,
      customUsdVndFreeMarket: null,
      updatedAtMs: 0,
    };
  }
  try {
    const raw = window.localStorage.getItem(DEALER_QUOTE_STORAGE_KEY);
    if (!raw) {
      return {
        sjcSellMillion: null,
        ring9999SellMillion: null,
        customUsdVndFreeMarket: null,
        updatedAtMs: 0,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      sjcSellMillion:
        typeof parsed?.sjcSellMillion === 'number' && parsed.sjcSellMillion > 0
          ? parsed.sjcSellMillion
          : null,
      ring9999SellMillion:
        typeof parsed?.ring9999SellMillion === 'number' && parsed.ring9999SellMillion > 0
          ? parsed.ring9999SellMillion
          : null,
      customUsdVndFreeMarket:
        typeof parsed?.customUsdVndFreeMarket === 'number' && parsed.customUsdVndFreeMarket > 15000
          ? parsed.customUsdVndFreeMarket
          : null,
      updatedAtMs: typeof parsed?.updatedAtMs === 'number' ? parsed.updatedAtMs : 0,
    };
  } catch {
    return {
      sjcSellMillion: null,
      ring9999SellMillion: null,
      customUsdVndFreeMarket: null,
      updatedAtMs: 0,
    };
  }
}

export function saveDealerGoldQuoteInput(next: DealerGoldQuoteInput): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEALER_QUOTE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
}

function evaluateSpreadComparison(
  label: string,
  dealerSellMillion: number | null,
  parityRefMillion: number
): GoldSpreadComparison | null {
  if (!dealerSellMillion || dealerSellMillion <= 0 || parityRefMillion <= 0) {
    return null;
  }
  const spreadMillion = parseFloat((dealerSellMillion - parityRefMillion).toFixed(2));
  const spreadPct = parseFloat((((dealerSellMillion - parityRefMillion) / parityRefMillion) * 100).toFixed(2));

  let regime: GoldPremiumRegime = 'FAIR_SPREAD';
  let guidance = '';

  if (spreadPct <= 0.8) {
    regime = 'DISCOUNT_OR_PARITY';
    guidance = `${label} đang sát hoặc thấp hơn giá thế giới quy đổi CIF (${spreadMillion >= 0 ? '+' : ''}${spreadMillion} tr/lượng) — vùng tích sản vật chất tối ưu, không chịu rủi ro thu hẹp độ vênh.`;
  } else if (spreadPct <= 4.5) {
    regime = 'FAIR_SPREAD';
    guidance = `Độ vênh ${label} ở ngưỡng cân bằng hợp lý (+${spreadMillion} tr/lượng ~ +${spreadPct}%), phản ánh chi phí gia công & thanh khoản nội địa bình thường.`;
  } else if (spreadPct <= 9.5) {
    regime = 'MODERATE_PREMIUM';
    guidance = `${label} đang cao hơn thế giới +${spreadMillion} tr/lượng (+${spreadPct}%). Nên chia nhỏ lệnh mua tích sản thay vì mua đuổi toàn bộ vốn.`;
  } else {
    regime = 'EXTREME_PREMIUM';
    guidance = `CẢNH BÁO ĐỘ VÊNH CAO: ${label} đắt hơn thế giới tới +${spreadMillion} tr/lượng (+${spreadPct}%). Rủi ro thu hẹp biên độ khi NHNN tăng cung hoặc tỷ giá hạ nhiệt.`;
  }

  return {
    label,
    dealerSellMillion: parseFloat(dealerSellMillion.toFixed(2)),
    parityRefMillion,
    spreadMillionPerTael: spreadMillion,
    spreadPct,
    regime,
    guidance,
  };
}

export function computeVnGoldFxArbitrage(params: {
  symbols: MarketSymbol[];
  macroSnapshot: MacroIntelligenceSnapshot | null;
  dealerInput?: DealerGoldQuoteInput;
}): VnGoldFxArbitrageSnapshot | null {
  const { symbols, macroSnapshot, dealerInput } = params;

  const xau = symbols.find(s => s.symbol.toUpperCase() === 'XAUUSD');
  const paxg = symbols.find(s => s.symbol.toUpperCase() === 'PAXGUSDT');

  const spotGoldUsdOz = xau && xau.price > 0 ? xau.price : paxg && paxg.price > 0 ? paxg.price : 0;
  if (!(spotGoldUsdOz > 0)) return null;

  const spotGoldSource = xau && xau.price > 0 ? 'XAUUSD Spot' : 'PAXGUSDT (Binance 24/7)';
  const spotGoldChange24h = xau && xau.price > 0 ? xau.change24h : paxg?.change24h ?? 0;

  const usdVndItem = macroSnapshot?.indicators.find(i => i.id === 'USDVND');
  const dxyItem = macroSnapshot?.indicators.find(i => i.id === 'DXY');
  const us10yItem = macroSnapshot?.indicators.find(i => i.id === 'US10Y');

  // Use live USD/VND from macroSnapshot; if macroSnapshot hasn't loaded yet, return null rather than fabricating FX
  const officialUsdVnd = usdVndItem && usdVndItem.value > 15000 ? usdVndItem.value : 0;
  const customFx = dealerInput?.customUsdVndFreeMarket && dealerInput.customUsdVndFreeMarket > 15000
    ? dealerInput.customUsdVndFreeMarket
    : null;
  const effectiveUsdVnd = customFx ?? officialUsdVnd;

  if (!(effectiveUsdVnd > 0)) return null;

  const rawVndPerTael = spotGoldUsdOz * TROY_OZ_PER_VN_TAEL * effectiveUsdVnd;
  const cifVndPerTael = rawVndPerTael * STANDARD_CIF_MINTING_FACTOR;

  const worldRawMillionPerTael = parseFloat((rawVndPerTael / 1_000_000).toFixed(2));
  const worldCifParityMillionPerTael = parseFloat((cifVndPerTael / 1_000_000).toFixed(2));
  const worldRawMillionPerMace = parseFloat((worldRawMillionPerTael / 10).toFixed(3));
  const worldCifParityMillionPerMace = parseFloat((worldCifParityMillionPerTael / 10).toFixed(3));

  const sjcComparison = evaluateSpreadComparison(
    'Vàng miếng SJC',
    dealerInput?.sjcSellMillion ?? null,
    worldCifParityMillionPerTael
  );
  const ring9999Comparison = evaluateSpreadComparison(
    'Vàng Nhẫn 9999',
    dealerInput?.ring9999SellMillion ?? null,
    worldCifParityMillionPerTael
  );

  // Deterministic Vietnam FX & Foreign Institutional Flow Pressure Score (0..100)
  let fxScore = 45;
  const dxyVal = dxyItem?.value ?? null;
  const dxyChg = dxyItem?.changePercent ?? 0;
  const us10yVal = us10yItem?.value ?? null;
  const usdVndChg = usdVndItem?.changePercent ?? 0;
  const fedPivotScore = macroSnapshot?.fedPivotV2?.pivotScore ?? null;

  if (dxyVal !== null) {
    if (dxyVal >= 105.5) fxScore += 20;
    else if (dxyVal >= 103.5) fxScore += 10;
    else if (dxyVal <= 100.5) fxScore -= 14;
    else if (dxyVal <= 102.0) fxScore -= 7;
  }
  if (dxyChg >= 0.45) fxScore += 6;
  else if (dxyChg <= -0.45) fxScore -= 6;

  if (us10yVal !== null) {
    if (us10yVal >= 4.5) fxScore += 14;
    else if (us10yVal >= 4.2) fxScore += 7;
    else if (us10yVal <= 3.8) fxScore -= 10;
  }

  if (usdVndChg >= 0.35) fxScore += 14;
  else if (usdVndChg >= 0.15) fxScore += 7;
  else if (usdVndChg <= -0.2) fxScore -= 8;

  if (fedPivotScore !== null) {
    if (fedPivotScore >= 4.25) fxScore -= 12;
    else if (fedPivotScore >= 2.75) fxScore -= 5;
    else if (fedPivotScore <= 1.25) fxScore += 6;
  }

  fxScore = Math.max(0, Math.min(100, Math.round(fxScore)));

  let fxPressureRegime: VnFxPressureRegime = 'NEUTRAL_BALANCED';
  let fxPressureHeadline = 'Tỷ giá & Lãi suất Liên thị trường ở vùng Cân Bằng';
  let fxPressureGuidance =
    'Áp lực tỷ giá USD/VND trong tầm kiểm soát. Dòng vốn trên VN-Index phân hóa theo kết quả kinh doanh từng nhóm ngành.';

  if (fxScore >= 72) {
    fxPressureRegime = 'HIGH_OUTFLOW_RISK';
    fxPressureHeadline = 'Áp lực Tỷ giá Cao — Thận trọng Khối ngoại rút ròng';
    fxPressureGuidance =
      'DXY / Lợi suất US10Y neo cao gây sức ép lên tỷ giá USD/VND và thanh khoản VND liên ngân hàng. Ưu tiên cổ phiếu xuất khẩu thu USD (FPT, DGC) và hạn chế margin cao ở nhóm nhạy lãi suất.';
  } else if (fxScore >= 56) {
    fxPressureRegime = 'ELEVATED_FX_PRESSURE';
    fxPressureHeadline = 'Tỷ giá USD/VND nhích tăng — Quan sát động thái điều tiết SBV';
    fxPressureGuidance =
      'Chênh lệch lãi suất USD-VND tạo lực cản nhẹ lên nhóm Chứng khoán / Bất động sản; ưu tiên mua tại hỗ trợ cứng thay vì mua đuổi breakout.';
  } else if (fxScore <= 34) {
    fxPressureRegime = 'FAVORABLE_INFLOW';
    fxPressureHeadline = 'Áp lực Tỷ giá Hạ Nhiệt — Thuận lợi cho VN-Index & Dòng vốn ngoại';
    fxPressureGuidance =
      'DXY & US10Y suy yếu giúp NHNN rộng dư địa duy trì lãi suất điều hành thấp, hỗ trợ trực tiếp định giá nhóm Ngân hàng, Chứng khoán và VN30.';
  }

  return {
    spotGoldUsdOz,
    spotGoldSource,
    spotGoldChange24h,
    officialUsdVnd,
    effectiveUsdVnd,
    isCustomUsdVnd: Boolean(customFx),
    worldRawMillionPerTael,
    worldCifParityMillionPerTael,
    worldRawMillionPerMace,
    worldCifParityMillionPerMace,
    sjcComparison,
    ring9999Comparison,
    fxPressureScore: fxScore,
    fxPressureRegime,
    fxPressureHeadline,
    fxPressureGuidance,
    dxyValue: dxyVal,
    us10yValue: us10yVal,
    usdVndChangePct: usdVndChg,
    fedPivotScore,
  };
}
