import { Candle, MarketSymbol } from '../../types';
import { US_EQUITY_SYMBOLS, isVietnamSymbol } from '../api/marketData';

export interface NormalizedOptionContract {
  strike: number;
  right: 'C' | 'P';
  openInterest: number;
  midPriceUsd?: number | null;
  gamma?: number | null;
  ivPct?: number | null;
  expiryIso: string;
}

export interface ComputedOptionsPositioning {
  primaryExpiryIso: string;
  maxPainPrice: number | null;
  callWallPrice: number | null;
  callWallOi: number | null;
  putWallPrice: number | null;
  putWallOi: number | null;
  putCallOiRatio: number | null;
  totalCallOi: number;
  totalPutOi: number;
  impliedMovePct: number | null;
  netGexMillionUsd: number | null;
  gammaRegime: 'POSITIVE_GAMMA_PIN' | 'NEGATIVE_GAMMA_ACCELERATION' | 'BALANCED';
  gammaHeadlineVi: string;
  actionableNoteVi: string;
}

export interface LiveCryptoPerpCarry {
  perpSymbol: string;
  markPrice: number;
  indexPrice: number;
  fundingRate8hPct: number;
  annualizedFundingPct: number;
  perpSpotBasisPct: number;
  nextFundingTimeMs: number | null;
}

export interface CryptoLiquidationAndCarryReport {
  symbol: string;
  spotPrice: number;
  markPrice: number;
  fundingRate8hPct: number;
  annualizedFundingPct: number;
  perpSpotBasisPct: number;
  nextFundingCountdownVi: string;
  longLiq50x: number;
  longLiq25x: number;
  shortLiq50x: number;
  shortLiq25x: number;
  nearestMagnetLabelVi: string;
  nearestMagnetPrice: number;
  distanceToNearestMagnetPct: number;
  fundingRegime:
    | 'OVERLEVERAGED_LONGS'
    | 'SHORT_SQUEEZE_SETUP'
    | 'CONTANGO_HEALTHY'
    | 'NEUTRAL';
  squeezeWarningVi: string;
  isLiveCarry: boolean;
}

export interface LiveCryptoMacroData {
  btcDominancePct: number | null;
  ethDominancePct: number | null;
  othersDominancePct: number | null;
  totalCryptoMcapTrillionUsd: number | null;
  mcapChange24hPct: number | null;
  stablecoinTotalBillionUsd: number | null;
  stablecoin7dNetMintBillionUsd: number | null;
  usdtBillionUsd: number | null;
  usdcBillionUsd: number | null;
}

export interface CryptoCapitalCycleReport {
  regime:
    | 'ALTSEASON_EXPANSION'
    | 'BTC_SEASON_ABSORPTION'
    | 'LIQUIDITY_INFLOW_BULL'
    | 'RISK_OFF_DRAIN';
  regimeLabelVi: string;
  btcDominancePct: number | null;
  ethDominancePct: number | null;
  ethBtcRatio: number | null;
  ethVsBtc24hSpreadPct: number;
  altBreadthAdvancersPct: number;
  stablecoinTotalBillionUsd: number | null;
  stablecoin7dNetMintBillionUsd: number | null;
  summaryVi: string;
  allocationHintVi: string;
}

export interface CryptoNarrativeBucket {
  id: string;
  nameVi: string;
  shortTag: string;
  avgChange24hPct: number;
  rsVsBtcPct: number;
  leaderSymbol: string;
  leaderChange24hPct: number;
  memberCount: number;
  status: 'LEADING' | 'IMPROVING' | 'LAGGING';
  tickers: Array<{ symbol: string; price: number; change24h: number }>;
}

export interface UsSectorRotationRow {
  etfSymbol: string;
  sectorNameVi: string;
  sectorStyle: 'OFFENSIVE' | 'CYCLICAL' | 'DEFENSIVE';
  price: number;
  change24hPct: number;
  rsVsSpyPct: number;
  status: 'LEADING' | 'IN_LINE' | 'LAGGING';
}

export interface UsSectorRotationReport {
  spyPrice: number;
  spyChange24hPct: number;
  qqqChange24hPct: number;
  offenseVsDefenseSpreadPct: number;
  regime:
    | 'TECH_AI_RISK_ON'
    | 'CYCLICAL_BROADENING'
    | 'DEFENSIVE_ROTATION'
    | 'BROAD_RISK_OFF';
  regimeLabelVi: string;
  summaryVi: string;
  sectors: UsSectorRotationRow[];
}

export interface LiveUsQuoteData {
  symbol: string;
  regularPrice: number | null;
  prevClose: number | null;
  preMarketPrice: number | null;
  preMarketChangePct: number | null;
  postMarketPrice: number | null;
  postMarketChangePct: number | null;
  earningsDateIso: string | null;
  daysToEarnings: number | null;
  earningsSession: 'BMO' | 'AMC' | 'TBD' | null;
  exDividendDateIso: string | null;
  forwardPe: number | null;
  shortFloatPct: number | null;
  analystTargetPrice: number | null;
  marketCapBillionUsd: number | null;
}

export interface UsExtendedHoursAndEarningsPulse {
  symbol: string;
  activeSession: 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';
  activeSessionLabelVi: string;
  extendedPrice: number | null;
  extendedGapPct: number | null;
  earningsDateIso: string | null;
  daysToEarnings: number | null;
  earningsSessionLabelVi: string | null;
  impliedMovePct: number | null;
  isImminentEarningsTrap: boolean;
  earningsWarningVi: string | null;
  settlementRuleVi: string;
  exDividendDateIso: string | null;
}

export interface UsPdtCheckResult {
  rolling5dDayTrades: number;
  accountEquityUsd: number;
  isUnder25k: boolean;
  status: 'SAFE' | 'APPROACHING_LIMIT' | 'PDT_RESTRICTED';
  badgeVi: string;
  warningVi: string | null;
}

export interface GlobalPaperTradeFrictionResult {
  grossPnlPct: number;
  netPnlPct: number;
  feeCostPct: number;
  carryOrMarginCostPct: number;
  settlementLabelVi: string;
}

const DERIBIT_MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

export function isCryptoSymbol(
  itemOrSymbol: string | Pick<MarketSymbol, 'symbol' | 'type' | 'quoteAsset'>
): boolean {
  if (typeof itemOrSymbol === 'string') {
    const s = itemOrSymbol.trim().toUpperCase();
    return s.endsWith('USDT') || s.endsWith('USDC') || s.endsWith('BUSD');
  }
  const sym = itemOrSymbol.symbol.trim().toUpperCase();
  return itemOrSymbol.type === 'crypto' || sym === 'PAXGUSDT' || sym.endsWith('USDT');
}

export function isUsOrGlobalEquitySymbol(
  itemOrSymbol: string | Pick<MarketSymbol, 'symbol' | 'type' | 'quoteAsset'>
): boolean {
  if (typeof itemOrSymbol === 'string') {
    const sym = itemOrSymbol.trim().toUpperCase();
    if (isCryptoSymbol(sym)) return false;
    return US_EQUITY_SYMBOLS.has(sym);
  }
  const sym = itemOrSymbol.symbol.trim().toUpperCase();
  if (isCryptoSymbol(itemOrSymbol) || isVietnamSymbol(itemOrSymbol)) return false;
  if (itemOrSymbol.type === 'commodity') return false;
  return US_EQUITY_SYMBOLS.has(sym) || (itemOrSymbol.type === 'stock' && itemOrSymbol.quoteAsset === 'USD');
}

/**
 * Parses CBOE / OCC option code (supports both standard `NVDA261102P00170000` and weekly prefixed `B1SPY261106C00755000`)
 */
export function parseCboeOccContract(
  optionCode: string
): { expiryIso: string; right: 'C' | 'P'; strike: number } | null {
  const m = /([0-9]{6})([CP])([0-9]{8})$/.exec(optionCode.trim().toUpperCase());
  if (!m) return null;
  const yymmdd = m[1];
  const expiryIso = `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
  const right = m[2] as 'C' | 'P';
  const strike = parseInt(m[3], 10) / 1000;
  if (!Number.isFinite(strike) || strike <= 0) return null;
  return { expiryIso, right, strike };
}

/**
 * Parses Deribit option instrument name (e.g. `BTC-13NOV26-83000-P`)
 */
export function parseDeribitContract(
  instrumentName: string
): { underlying: string; expiryIso: string; right: 'C' | 'P'; strike: number } | null {
  const m = /^([A-Z]+)-(\d{1,2})([A-Z]{3})(\d{2})-(\d+(?:\.\d+)?)-(C|P)$/.exec(
    instrumentName.trim().toUpperCase()
  );
  if (!m) return null;
  const mon = DERIBIT_MONTHS[m[3]];
  const day = parseInt(m[2], 10);
  const year = 2000 + parseInt(m[4], 10);
  if (mon === undefined || !day || !year) return null;
  const dt = new Date(Date.UTC(year, mon, day, 8, 0, 0));
  return {
    underlying: m[1],
    expiryIso: dt.toISOString().slice(0, 10),
    strike: Number(m[5]),
    right: m[6] as 'C' | 'P',
  };
}

/**
 * Pure Institutional Options Calculator: Max Pain + Call/Put Gamma Walls + Put/Call OI + ATM Implied Move
 */
export function computeOptionsWallsAndMaxPain(
  contracts: NormalizedOptionContract[],
  spotPrice: number,
  contractMultiplier: number = 100
): ComputedOptionsPositioning | null {
  if (!Array.isArray(contracts) || contracts.length === 0 || spotPrice <= 0) {
    return null;
  }

  const byExpiry = new Map<string, NormalizedOptionContract[]>();
  let totalCallOi = 0;
  let totalPutOi = 0;
  let netGexRaw = 0;

  for (const c of contracts) {
    if (!c || c.strike <= 0 || c.openInterest < 0) continue;
    if (c.right === 'C') {
      totalCallOi += c.openInterest;
      if (c.gamma) {
        netGexRaw += c.gamma * c.openInterest * contractMultiplier * spotPrice * spotPrice * 0.01;
      }
    } else {
      totalPutOi += c.openInterest;
      if (c.gamma) {
        netGexRaw -= c.gamma * c.openInterest * contractMultiplier * spotPrice * spotPrice * 0.01;
      }
    }
    const list = byExpiry.get(c.expiryIso) || [];
    list.push(c);
    byExpiry.set(c.expiryIso, list);
  }

  if (totalCallOi + totalPutOi <= 0) return null;

  const sortedExpiries = Array.from(byExpiry.entries())
    .map(([expiryIso, list]) => ({
      expiryIso,
      list,
      oiSum: list.reduce((acc, item) => acc + item.openInterest, 0),
    }))
    .sort((a, b) => a.expiryIso.localeCompare(b.expiryIso));

  const maxOiInExpiry = Math.max(...sortedExpiries.map((e) => e.oiSum), 1);
  const primaryExpiry =
    sortedExpiries.find((e) => e.oiSum >= maxOiInExpiry * 0.08) || sortedExpiries[0];

  const nearExpiries = new Set(sortedExpiries.slice(0, 4).map((e) => e.expiryIso));
  const strikeWallsMap = new Map<number, { callOi: number; putOi: number }>();
  for (const c of contracts) {
    if (!nearExpiries.has(c.expiryIso)) continue;
    const cur = strikeWallsMap.get(c.strike) || { callOi: 0, putOi: 0 };
    if (c.right === 'C') cur.callOi += c.openInterest;
    else cur.putOi += c.openInterest;
    strikeWallsMap.set(c.strike, cur);
  }

  const painContracts = primaryExpiry.list.length >= 4 ? primaryExpiry.list : contracts;
  const painMap = new Map<number, { callOi: number; putOi: number }>();
  for (const c of painContracts) {
    const cur = painMap.get(c.strike) || { callOi: 0, putOi: 0 };
    if (c.right === 'C') cur.callOi += c.openInterest;
    else cur.putOi += c.openInterest;
    painMap.set(c.strike, cur);
  }

  const candidateStrikes = Array.from(painMap.keys())
    .filter((k) => k >= spotPrice * 0.65 && k <= spotPrice * 1.35)
    .sort((a, b) => a - b);

  let maxPainPrice: number | null = null;
  let minPayout = Infinity;
  for (const s of candidateStrikes) {
    let payout = 0;
    for (const [k, oi] of painMap.entries()) {
      if (s > k) payout += (s - k) * oi.callOi;
      else if (s < k) payout += (k - s) * oi.putOi;
    }
    if (payout < minPayout) {
      minPayout = payout;
      maxPainPrice = s;
    }
  }

  let callWallPrice: number | null = null;
  let callWallOi = -1;
  let putWallPrice: number | null = null;
  let putWallOi = -1;

  for (const [k, oi] of strikeWallsMap.entries()) {
    if (k >= spotPrice * 0.92 && k <= spotPrice * 1.35 && oi.callOi > callWallOi) {
      callWallOi = oi.callOi;
      callWallPrice = k;
    }
    if (k >= spotPrice * 0.65 && k <= spotPrice * 1.08 && oi.putOi > putWallOi) {
      putWallOi = oi.putOi;
      putWallPrice = k;
    }
  }

  let impliedMovePct: number | null = null;
  const pList = primaryExpiry.list;
  const pStrikes = Array.from(new Set(pList.map((c) => c.strike)));
  if (pStrikes.length > 0) {
    let atmK = pStrikes[0];
    let minDiff = Math.abs(atmK - spotPrice);
    for (const k of pStrikes) {
      const d = Math.abs(k - spotPrice);
      if (d < minDiff) {
        minDiff = d;
        atmK = k;
      }
    }
    const atmC = pList.find((c) => c.strike === atmK && c.right === 'C');
    const atmP = pList.find((c) => c.strike === atmK && c.right === 'P');
    if (
      atmC?.midPriceUsd &&
      atmP?.midPriceUsd &&
      atmC.midPriceUsd > 0 &&
      atmP.midPriceUsd > 0
    ) {
      const pct = ((atmC.midPriceUsd + atmP.midPriceUsd) / spotPrice) * 100;
      if (pct > 0.1 && pct < 45) {
        impliedMovePct = parseFloat(pct.toFixed(2));
      }
    }
  }

  const putCallOiRatio =
    totalCallOi > 0 ? parseFloat((totalPutOi / totalCallOi).toFixed(2)) : null;
  const netGexMillionUsd =
    netGexRaw !== 0 ? parseFloat((netGexRaw / 1e6).toFixed(2)) : null;

  let gammaRegime: ComputedOptionsPositioning['gammaRegime'] = 'BALANCED';
  let gammaHeadlineVi = 'Cấu trúc Gamma cân bằng quanh vùng giá giao ngay';
  let actionableNoteVi =
    'Theo dõi phản ứng giá tại Call Wall (kháng cự quyền chọn) và Put Wall (đệm đỡ quyền chọn).';

  if (
    (netGexMillionUsd !== null && netGexMillionUsd > 15) ||
    (putCallOiRatio !== null && putCallOiRatio <= 0.78)
  ) {
    gammaRegime = 'POSITIVE_GAMMA_PIN';
    gammaHeadlineVi = 'Gamma Dương (Positive GEX) — Market Maker hãm biên độ & hút về Max Pain';
    actionableNoteVi =
      'Dealer phòng vệ ngược chiều biến động (bán khi tăng chạm Call Wall, mua đỡ ở Put Wall). Ưu tiên chốt lời từng phần tại Call Wall.';
  } else if (
    (netGexMillionUsd !== null && netGexMillionUsd < -10) ||
    (putCallOiRatio !== null && putCallOiRatio >= 1.25)
  ) {
    gammaRegime = 'NEGATIVE_GAMMA_ACCELERATION';
    gammaHeadlineVi = 'Gamma Âm / Put OI cao — Biến động dễ khuếch đại mạnh khi thủng Put Wall';
    actionableNoteVi =
      'Dealer phải bán đuổi phòng vệ nếu giá xuyên thủng Put Wall ( hoặc mua đuổi Short-Gamma nếu vượt Call Wall). Quản trị rủi ro chặt!';
  }

  return {
    primaryExpiryIso: primaryExpiry.expiryIso,
    maxPainPrice,
    callWallPrice,
    callWallOi: callWallOi > 0 ? Math.round(callWallOi) : null,
    putWallPrice,
    putWallOi: putWallOi > 0 ? Math.round(putWallOi) : null,
    putCallOiRatio,
    totalCallOi: Math.round(totalCallOi),
    totalPutOi: Math.round(totalPutOi),
    impliedMovePct,
    netGexMillionUsd,
    gammaRegime,
    gammaHeadlineVi,
    actionableNoteVi,
  };
}

function roundCryptoPrice(price: number, spot: number): number {
  if (spot >= 1000) return parseFloat(price.toFixed(1));
  if (spot >= 10) return parseFloat(price.toFixed(2));
  if (spot >= 0.5) return parseFloat(price.toFixed(4));
  return parseFloat(price.toFixed(7));
}

/**
 * Pillar 1: Crypto Leveraged Liquidation Magnet Clusters (25x / 50x), 8h Funding & Perp-Spot Basis
 */
export function computeCryptoLiquidationAndCarry(
  symbol: string,
  spotPrice: number,
  candles: Candle[] = [],
  liveCarry?: LiveCryptoPerpCarry | null,
  nowMs: number = Date.now()
): CryptoLiquidationAndCarryReport {
  const safeSpot = spotPrice > 0 ? spotPrice : liveCarry?.indexPrice || 1;
  const markPrice = liveCarry?.markPrice && liveCarry.markPrice > 0 ? liveCarry.markPrice : safeSpot;
  const fundingRate8hPct = liveCarry?.fundingRate8hPct ?? 0;
  const annualizedFundingPct =
    liveCarry?.annualizedFundingPct ?? parseFloat((fundingRate8hPct * 3 * 365).toFixed(2));
  const perpSpotBasisPct = liveCarry?.perpSpotBasisPct ?? 0;

  // Compute recent 20-bar VWAP to anchor crowded institutional intraday Long/Short entry clusters
  const recent = candles.slice(-24);
  let vwap = safeSpot;
  if (recent.length >= 5) {
    let pv = 0;
    let volSum = 0;
    for (const c of recent) {
      const typ = (c.high + c.low + c.close) / 3;
      const v = c.volume > 0 ? c.volume : 1;
      pv += typ * v;
      volSum += v;
    }
    if (volSum > 0) vwap = pv / volSum;
  }

  // Maintenance margin ~0.4% on Binance USD-M
  const mmr = 0.004;
  const longAnchor = Math.min(safeSpot, vwap * 1.002);
  const shortAnchor = Math.max(safeSpot, vwap * 0.998);

  const rawLong50 = longAnchor * (1 - (1 / 50 - mmr)); // ~ -1.6% below long anchor
  const rawLong25 = longAnchor * (1 - (1 / 25 - mmr)); // ~ -3.6% below long anchor
  const rawShort50 = shortAnchor * (1 + (1 / 50 - mmr)); // ~ +1.6% above short anchor
  const rawShort25 = shortAnchor * (1 + (1 / 25 - mmr)); // ~ +3.6% above short anchor

  const longLiq50x = roundCryptoPrice(Math.min(rawLong50, safeSpot * 0.985), safeSpot);
  const longLiq25x = roundCryptoPrice(Math.min(rawLong25, longLiq50x * 0.982), safeSpot);
  const shortLiq50x = roundCryptoPrice(Math.max(rawShort50, safeSpot * 1.015), safeSpot);
  const shortLiq25x = roundCryptoPrice(Math.max(rawShort25, shortLiq50x * 1.018), safeSpot);

  const distLong50 = Math.abs(((safeSpot - longLiq50x) / safeSpot) * 100);
  const distShort50 = Math.abs(((shortLiq50x - safeSpot) / safeSpot) * 100);
  const isCloserToShort = distShort50 <= distLong50;

  // Next 8h Funding countdown (Binance settles at 00:00, 08:00, 16:00 UTC)
  let nextFundingMs = liveCarry?.nextFundingTimeMs || null;
  if (!nextFundingMs || nextFundingMs <= nowMs) {
    const eightHoursMs = 8 * 3600_000;
    nextFundingMs = Math.ceil(nowMs / eightHoursMs) * eightHoursMs;
  }
  const diffMins = Math.max(1, Math.round((nextFundingMs - nowMs) / 60_000));
  const nextFundingCountdownVi = `${Math.floor(diffMins / 60)}h ${diffMins % 60}p`;

  let fundingRegime: CryptoLiquidationAndCarryReport['fundingRegime'] = 'NEUTRAL';
  let squeezeWarningVi =
    'Funding Rate cân bằng — Đà tăng/giảm chủ đạo đến từ dòng tiền Spot tự nhiên.';

  if (fundingRate8hPct >= 0.035 || perpSpotBasisPct >= 0.18) {
    fundingRegime = 'OVERLEVERAGED_LONGS';
    squeezeWarningVi = `CẢNH BÁO FOMO LONG: Funding +${fundingRate8hPct.toFixed(4)}%/8h (${annualizedFundingPct.toFixed(1)}%/năm) — Rủi ro râu nến quét thanh lý Long 50x/25x (${longLiq50x} → ${longLiq25x}).`;
  } else if (fundingRate8hPct <= -0.012 || perpSpotBasisPct <= -0.08) {
    fundingRegime = 'SHORT_SQUEEZE_SETUP';
    squeezeWarningVi = `TÍN HIỆU SHORT SQUEEZE: Funding âm ${fundingRate8hPct.toFixed(4)}%/8h (Đám đông đang Short đuổi) — Giá dễ bị đẩy ngược lên vùng thanh lý Short 50x/25x (${shortLiq50x} → ${shortLiq25x}).`;
  } else if (fundingRate8hPct > 0.008 && fundingRate8hPct < 0.035) {
    fundingRegime = 'CONTANGO_HEALTHY';
    squeezeWarningVi = `Contango lành mạnh (+${fundingRate8hPct.toFixed(4)}%/8h, ~${annualizedFundingPct.toFixed(1)}%/năm) — Đòn bẩy Long chưa quá nóng.`;
  }

  return {
    symbol,
    spotPrice: safeSpot,
    markPrice,
    fundingRate8hPct,
    annualizedFundingPct,
    perpSpotBasisPct,
    nextFundingCountdownVi,
    longLiq50x,
    longLiq25x,
    shortLiq50x,
    shortLiq25x,
    nearestMagnetLabelVi: isCloserToShort ? 'Cụm Short Liq 50x' : 'Cụm Long Liq 50x',
    nearestMagnetPrice: isCloserToShort ? shortLiq50x : longLiq50x,
    distanceToNearestMagnetPct: parseFloat(
      Math.min(distShort50, distLong50).toFixed(2)
    ),
    fundingRegime,
    squeezeWarningVi,
    isLiveCarry: Boolean(liveCarry),
  };
}

const CRYPTO_NARRATIVE_DEFS: Array<{
  id: string;
  nameVi: string;
  shortTag: string;
  symbols: string[];
}> = [
  {
    id: 'l1_smart_contracts',
    nameVi: 'Layer-1 Nền tảng (ETH • SOL • SUI • AVAX • ADA)',
    shortTag: 'Layer-1',
    symbols: ['ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'SUIUSDT', 'AVAXUSDT', 'ADAUSDT'],
  },
  {
    id: 'ai_depin',
    nameVi: 'AI & GPU DePIN (RENDER • FET • NEAR)',
    shortTag: 'AI & DePIN',
    symbols: ['RENDERUSDT', 'FETUSDT', 'NEARUSDT'],
  },
  {
    id: 'defi_yield',
    nameVi: 'DeFi & Thanh khoản (UNI • INJ • PENDLE)',
    shortTag: 'DeFi',
    symbols: ['UNIUSDT', 'INJUSDT', 'PENDLEUSDT'],
  },
  {
    id: 'rwa_oracle',
    nameVi: 'Tài sản thực RWA & Oracle (ONDO • LINK • XRP)',
    shortTag: 'RWA & Pay',
    symbols: ['ONDOUSDT', 'LINKUSDT', 'XRPUSDT'],
  },
  {
    id: 'eth_layer2',
    nameVi: 'Ethereum Layer-2 Rollups (ARB • OP)',
    shortTag: 'Layer-2',
    symbols: ['ARBUSDT', 'OPUSDT'],
  },
  {
    id: 'meme_beta',
    nameVi: 'Meme High-Beta Khẩu vị Rủi ro (DOGE • PEPE • WIF)',
    shortTag: 'Meme Beta',
    symbols: ['DOGEUSDT', 'PEPEUSDT', 'WIFUSDT'],
  },
];

/**
 * Pillar 3A: Crypto Capital Cycle (BTC.D • ETH/BTC • 7d Stablecoin Minting)
 */
export function computeCryptoCapitalCycle(
  symbols: MarketSymbol[],
  macro?: LiveCryptoMacroData | null
): CryptoCapitalCycleReport {
  const symMap = new Map<string, MarketSymbol>();
  for (const s of symbols) symMap.set(s.symbol.toUpperCase(), s);

  const btc = symMap.get('BTCUSDT');
  const eth = symMap.get('ETHUSDT');
  const btcChange = btc?.change24h ?? 0;
  const ethChange = eth?.change24h ?? 0;
  const ethBtcRatio =
    btc && eth && btc.price > 0 ? parseFloat((eth.price / btc.price).toFixed(5)) : null;
  const ethVsBtc24hSpreadPct = parseFloat((ethChange - btcChange).toFixed(2));

  const alts = symbols.filter(
    (s) => s.type === 'crypto' && s.symbol !== 'BTCUSDT' && s.symbol !== 'PAXGUSDT'
  );
  const altAdvancers = alts.filter((s) => s.change24h > btcChange).length;
  const altBreadthAdvancersPct =
    alts.length > 0 ? Math.round((altAdvancers / alts.length) * 100) : 50;

  const btcDom = macro?.btcDominancePct ?? null;
  const mint7d = macro?.stablecoin7dNetMintBillionUsd ?? null;

  let regime: CryptoCapitalCycleReport['regime'] = 'BTC_SEASON_ABSORPTION';
  let regimeLabelVi = 'Pha Hút Vốn Bitcoin (BTC Dominance Áp Đảo)';
  let summaryVi =
    'Dòng tiền ưu tiên trú ẩn và tích lũy tại Bitcoin hơn là dàn trải sang Altcoin vốn hóa nhỏ.';
  let allocationHintVi =
    'Ưu tiên tỷ trọng lớn vào BTC & Top L1 mạnh nhất (SOL/ETH); hạn chế dùng đòn bẩy cao ở Altcoin yếu.';

  if (mint7d !== null && mint7d < -0.4 && btcChange < -1) {
    regime = 'RISK_OFF_DRAIN';
    regimeLabelVi = 'Pha Rút Thanh Khoản Phòng Thủ (Stablecoin Net Burn)';
    summaryVi = `Cung Stablecoin 7 ngày giảm ${mint7d.toFixed(2)} tỷ USD kèm áp lực điều chỉnh — Dòng tiền đang tạm phòng thủ.`;
    allocationHintVi =
      'Giữ tỷ trọng USDT/USDC cao, chỉ canh bắt nhịp rũ thanh lý về Put Wall / Hỗ trợ lớn.';
  } else if (
    altBreadthAdvancersPct >= 60 &&
    (ethVsBtc24hSpreadPct >= 0.4 || (btcDom !== null && btcDom < 55))
  ) {
    regime = 'ALTSEASON_EXPANSION';
    regimeLabelVi = 'Pha Lan Tỏa Sang ETH & Hệ Sinh Thái Altcoin';
    summaryVi = `${altBreadthAdvancersPct}% mã Altcoin đang vượt hiệu suất BTC (ETH/BTC spread ${ethVsBtc24hSpreadPct >= 0 ? '+' : ''}${ethVsBtc24hSpreadPct}%).`;
    allocationHintVi =
      'Xoay vòng sang các Narrative dẫn dắt có RS vs BTC dương mạnh nhất (AI, DeFi, L1, RWA).';
  } else if (mint7d !== null && mint7d >= 0.6 && btcChange >= 0) {
    regime = 'LIQUIDITY_INFLOW_BULL';
    regimeLabelVi = 'Pha Bơm Thanh Khoản Mới (Stablecoin Net Mint Mạnh)';
    summaryVi = `+${mint7d.toFixed(2)} tỷ USD Stablecoin mới được đúc ròng trong 7 ngày qua — Đạn dược mua Spot dồi dào.`;
    allocationHintVi =
      'Ưu tiên gom BTC & Leader hệ sinh thái khi chỉnh nhẹ về VWAP; tránh Short ngược xu hướng.';
  }

  return {
    regime,
    regimeLabelVi,
    btcDominancePct: btcDom,
    ethDominancePct: macro?.ethDominancePct ?? null,
    ethBtcRatio,
    ethVsBtc24hSpreadPct,
    altBreadthAdvancersPct,
    stablecoinTotalBillionUsd: macro?.stablecoinTotalBillionUsd ?? null,
    stablecoin7dNetMintBillionUsd: mint7d,
    summaryVi,
    allocationHintVi,
  };
}

/**
 * Pillar 3B: 6-Ecosystem Crypto Narrative Rotation Matrix (RS vs BTC)
 */
export function computeCryptoNarrativeRotation(
  symbols: MarketSymbol[]
): CryptoNarrativeBucket[] {
  const symMap = new Map<string, MarketSymbol>();
  for (const s of symbols) symMap.set(s.symbol.toUpperCase(), s);

  const btcChange = symMap.get('BTCUSDT')?.change24h ?? 0;

  const buckets: CryptoNarrativeBucket[] = CRYPTO_NARRATIVE_DEFS.map((def) => {
    const members = def.symbols
      .map((code) => symMap.get(code))
      .filter((m): m is MarketSymbol => Boolean(m));

    if (members.length === 0) {
      return {
        id: def.id,
        nameVi: def.nameVi,
        shortTag: def.shortTag,
        avgChange24hPct: 0,
        rsVsBtcPct: parseFloat((-btcChange).toFixed(2)),
        leaderSymbol: def.symbols[0].replace('USDT', ''),
        leaderChange24hPct: 0,
        memberCount: 0,
        status: 'LAGGING',
        tickers: [],
      };
    }

    const avgChange =
      members.reduce((sum, item) => sum + item.change24h, 0) / members.length;
    const rsVsBtc = parseFloat((avgChange - btcChange).toFixed(2));
    const sorted = [...members].sort((a, b) => b.change24h - a.change24h);
    const leader = sorted[0];

    const status: CryptoNarrativeBucket['status'] =
      rsVsBtc >= 0.6 ? 'LEADING' : rsVsBtc >= -0.4 ? 'IMPROVING' : 'LAGGING';

    return {
      id: def.id,
      nameVi: def.nameVi,
      shortTag: def.shortTag,
      avgChange24hPct: parseFloat(avgChange.toFixed(2)),
      rsVsBtcPct: rsVsBtc,
      leaderSymbol: leader.symbol.replace(/USDT$/i, ''),
      leaderChange24hPct: leader.change24h,
      memberCount: members.length,
      status,
      tickers: sorted.map((m) => ({
        symbol: m.symbol,
        price: m.price,
        change24h: m.change24h,
      })),
    };
  });

  return buckets.sort((a, b) => b.rsVsBtcPct - a.rsVsBtcPct);
}

const US_SECTOR_ETFS: Array<{
  symbol: string;
  nameVi: string;
  style: UsSectorRotationRow['sectorStyle'];
}> = [
  { symbol: 'SOXX', nameVi: 'Bán dẫn & Chip AI (Semiconductors)', style: 'OFFENSIVE' },
  { symbol: 'XLK', nameVi: 'Công nghệ Phần mềm & Cloud (Tech)', style: 'OFFENSIVE' },
  { symbol: 'XLC', nameVi: 'Truyền thông & Nền tảng Số (Comm)', style: 'OFFENSIVE' },
  { symbol: 'XLY', nameVi: 'Tiêu dùng Không thiết yếu (Discretionary)', style: 'OFFENSIVE' },
  { symbol: 'XLF', nameVi: 'Tài chính & Ngân hàng Phố Wall (Financials)', style: 'CYCLICAL' },
  { symbol: 'XLI', nameVi: 'Công nghiệp & Quốc phòng (Industrials)', style: 'CYCLICAL' },
  { symbol: 'XLE', nameVi: 'Năng lượng & Dầu khí Mỹ (Energy)', style: 'CYCLICAL' },
  { symbol: 'XLB', nameVi: 'Nguyên vật liệu & Hóa chất (Materials)', style: 'CYCLICAL' },
  { symbol: 'XLRE', nameVi: 'Bất động sản Mỹ & REITs (Real Estate)', style: 'CYCLICAL' },
  { symbol: 'XLV', nameVi: 'Y tế & Dược phẩm Sinh học (Healthcare)', style: 'DEFENSIVE' },
  { symbol: 'XLU', nameVi: 'Điện & Tiện ích Hạ tầng AI (Utilities)', style: 'DEFENSIVE' },
  { symbol: 'XLP', nameVi: 'Hàng Tiêu dùng Thiết yếu (Staples)', style: 'DEFENSIVE' },
];

/**
 * Pillar 4: US Wall Street 11-Sector SPDR + SOXX Relative Strength Rotation vs S&P 500 (SPY)
 */
export function computeUsSectorRotation(symbols: MarketSymbol[]): UsSectorRotationReport {
  const symMap = new Map<string, MarketSymbol>();
  for (const s of symbols) symMap.set(s.symbol.toUpperCase(), s);

  const spy = symMap.get('SPY');
  const qqq = symMap.get('QQQ');
  const spyPrice = spy?.price ?? 580;
  const spyChange = spy?.change24h ?? 0;
  const qqqChange = qqq?.change24h ?? spyChange;

  const sectors: UsSectorRotationRow[] = US_SECTOR_ETFS.map((def) => {
    const item = symMap.get(def.symbol);
    const chg = item?.change24h ?? 0;
    const rs = parseFloat((chg - spyChange).toFixed(2));
    const status: UsSectorRotationRow['status'] =
      rs >= 0.25 ? 'LEADING' : rs <= -0.25 ? 'LAGGING' : 'IN_LINE';

    return {
      etfSymbol: def.symbol,
      sectorNameVi: def.nameVi,
      sectorStyle: def.style,
      price: item?.price ?? 0,
      change24hPct: chg,
      rsVsSpyPct: rs,
      status,
    };
  }).sort((a, b) => b.rsVsSpyPct - a.rsVsSpyPct);

  const offRows = sectors.filter((s) => s.sectorStyle === 'OFFENSIVE');
  const defRows = sectors.filter((s) => s.sectorStyle === 'DEFENSIVE');
  const cycRows = sectors.filter((s) => s.sectorStyle === 'CYCLICAL');

  const avgOff =
    offRows.reduce((sum, r) => sum + r.change24hPct, 0) / Math.max(1, offRows.length);
  const avgDef =
    defRows.reduce((sum, r) => sum + r.change24hPct, 0) / Math.max(1, defRows.length);
  const avgCyc =
    cycRows.reduce((sum, r) => sum + r.change24hPct, 0) / Math.max(1, cycRows.length);

  const offenseVsDefenseSpreadPct = parseFloat((avgOff - avgDef).toFixed(2));

  let regime: UsSectorRotationReport['regime'] = 'CYCLICAL_BROADENING';
  let regimeLabelVi = 'Dòng Tiền Lan Tỏa Chu Kỳ (Broad Market Participation)';
  let summaryVi =
    'Dòng tiền Phố Wall phân bổ đồng đều sang Tài chính, Công nghiệp và Chu kỳ kinh tế thực.';

  if (spyChange < -0.6 && offenseVsDefenseSpreadPct < -0.25) {
    regime = 'BROAD_RISK_OFF';
    regimeLabelVi = 'Phố Wall Phòng Thủ / Xả Rủi Ro (Risk-Off)';
    summaryVi =
      'Nhóm Công nghệ & Tăng trưởng bị chốt lời mạnh hơn S&P 500; dòng tiền rút về Trái phiếu & Nhóm Thiết yếu.';
  } else if (offenseVsDefenseSpreadPct >= 0.45 && qqqChange >= spyChange) {
    regime = 'TECH_AI_RISK_ON';
    regimeLabelVi = 'Khẩu Vị Rủi Ro Cao — AI, Bán Dẫn & Big Tech Dẫn Sóng';
    summaryVi = `Nhóm Tấn công (SOXX/XLK/XLY) vượt trội Nhóm Phòng thủ ${offenseVsDefenseSpreadPct >= 0 ? '+' : ''}${offenseVsDefenseSpreadPct}% — Phố Wall đang Risk-On mạnh.`;
  } else if (offenseVsDefenseSpreadPct <= -0.35) {
    regime = 'DEFENSIVE_ROTATION';
    regimeLabelVi = 'Xoay Trục Sang Nhóm Phòng Thủ (XLP • XLU • XLV)';
    summaryVi = `Dòng tiền tổ chức chốt lời nhóm Beta cao sang Y tế, Điện & Hàng thiết yếu (Spread ${offenseVsDefenseSpreadPct}%).`;
  } else if (avgCyc > avgOff && spyChange >= 0) {
    regime = 'CYCLICAL_BROADENING';
    regimeLabelVi = 'Xoay Vòng Sang Bluechip Chu Kỳ (XLF • XLI • XLE)';
    summaryVi =
      'Độ rộng S&P 500 cải thiện tích cực nhờ nhóm Ngân hàng, Công nghiệp & Năng lượng nâng đỡ chỉ số.';
  }

  return {
    spyPrice,
    spyChange24hPct: spyChange,
    qqqChange24hPct: qqqChange,
    offenseVsDefenseSpreadPct,
    regime,
    regimeLabelVi,
    summaryVi,
    sectors,
  };
}

/**
 * Pillar 5: US Pre-Market / After-Hours Pulse, Earnings Gap-Trap Warning & SEC T+1 Settlement
 */
export function computeUsExtendedHoursPulse(
  symbol: string,
  regularPrice: number,
  quote?: LiveUsQuoteData | null,
  impliedMovePct?: number | null,
  stopLossDistancePct?: number | null,
  now: Date = new Date()
): UsExtendedHoursAndEarningsPulse {
  // Determine New York ET session
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const isWeekend = map.weekday === 'Sat' || map.weekday === 'Sun';
  const h = parseInt(map.hour || '0', 10) % 24;
  const m = parseInt(map.minute || '0', 10);
  const mins = h * 60 + m;

  let activeSession: UsExtendedHoursAndEarningsPulse['activeSession'] = 'CLOSED';
  let activeSessionLabelVi = 'Đóng cửa (Chờ Pre-Market 04:00 ET)';
  if (!isWeekend) {
    if (mins >= 240 && mins < 570) {
      activeSession = 'PRE_MARKET';
      activeSessionLabelVi = 'Pre-Market Mỹ (04:00–09:30 ET)';
    } else if (mins >= 570 && mins < 960) {
      activeSession = 'REGULAR';
      activeSessionLabelVi = 'Phiên Chính NYSE/NASDAQ (09:30–16:00 ET)';
    } else if (mins >= 960 && mins < 1200) {
      activeSession = 'AFTER_HOURS';
      activeSessionLabelVi = 'After-Hours Mỹ (16:00–20:00 ET)';
    }
  }

  let extendedPrice: number | null = null;
  let extendedGapPct: number | null = null;

  if (activeSession === 'PRE_MARKET' && quote?.preMarketPrice) {
    extendedPrice = quote.preMarketPrice;
    extendedGapPct =
      quote.preMarketChangePct ??
      (regularPrice > 0
        ? parseFloat((((quote.preMarketPrice - regularPrice) / regularPrice) * 100).toFixed(2))
        : null);
  } else if (quote?.postMarketPrice && activeSession !== 'REGULAR') {
    extendedPrice = quote.postMarketPrice;
    extendedGapPct =
      quote.postMarketChangePct ??
      (regularPrice > 0
        ? parseFloat((((quote.postMarketPrice - regularPrice) / regularPrice) * 100).toFixed(2))
        : null);
  } else if (quote?.preMarketPrice && activeSession === 'CLOSED') {
    extendedPrice = quote.preMarketPrice;
    extendedGapPct = quote.preMarketChangePct;
  }

  const daysToEarnings = quote?.daysToEarnings ?? null;
  const isImminentEarningsTrap =
    daysToEarnings !== null && daysToEarnings >= 0 && daysToEarnings <= 5;

  const sessionCode = quote?.earningsSession;
  const earningsSessionLabelVi =
    sessionCode === 'BMO'
      ? 'BMO (Trước giờ mở cửa 09:30 ET)'
      : sessionCode === 'AMC'
      ? 'AMC (Sau giờ đóng cửa 16:00 ET)'
      : sessionCode === 'TBD'
      ? 'Chưa chốt giờ BMO/AMC'
      : null;

  let earningsWarningVi: string | null = null;
  if (isImminentEarningsTrap && quote?.earningsDateIso) {
    const moveText = impliedMovePct ? `±${impliedMovePct.toFixed(1)}%` : 'biên độ lớn';
    const slNote =
      impliedMovePct && stopLossDistancePct && impliedMovePct > stopLossDistancePct
        ? ` (Vượt xa mức cắt lỗ ${stopLossDistancePct.toFixed(1)}% — Stop-Loss thường bị nhảy Gap qua đêm!)`
        : '';
    earningsWarningVi = `CẢNH BÁO BẪY GAP BCTC MỸ: ${symbol} công bố KQKD vào ${quote.earningsDateIso} (${daysToEarnings === 0 ? 'HÔM NAY' : `còn ${daysToEarnings} ngày`}${earningsSessionLabelVi ? ` • ${earningsSessionLabelVi}` : ''}). Thị trường Quyền chọn định giá Implied Move ${moveText}${slNote}.`;
  }

  return {
    symbol,
    activeSession,
    activeSessionLabelVi,
    extendedPrice,
    extendedGapPct,
    earningsDateIso: quote?.earningsDateIso ?? null,
    daysToEarnings,
    earningsSessionLabelVi,
    impliedMovePct: impliedMovePct ?? null,
    isImminentEarningsTrap,
    earningsWarningVi,
    settlementRuleVi: 'Chuẩn SEC T+1 (Tiền & cổ phiếu về ngày làm việc kế tiếp • Không có biên độ trần/sàn)',
    exDividendDateIso: quote?.exDividendDateIso ?? null,
  };
}

/**
 * FINRA Pattern Day Trader (PDT < $25,000) 5-Business-Day Rolling Checker
 */
export function checkUsPdtRuleWarning(
  trades: Array<{
    symbol: string;
    openedAt: number;
    closedAt?: number;
    status: string;
  }>,
  accountEquityUsd: number = 10_000,
  nowMs: number = Date.now()
): UsPdtCheckResult {
  const sevenCalendarDaysAgo = nowMs - 7 * 86400_000;
  const toEtDate = (ms: number): string =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms));

  let rolling5dDayTrades = 0;
  for (const t of trades) {
    if (!t.closedAt || t.status === 'OPEN') continue;
    if (t.closedAt < sevenCalendarDaysAgo) continue;
    if (!isUsOrGlobalEquitySymbol(t.symbol)) continue;
    if (toEtDate(t.openedAt) === toEtDate(t.closedAt)) {
      rolling5dDayTrades++;
    }
  }

  const isUnder25k = accountEquityUsd < 25_000;
  if (!isUnder25k) {
    return {
      rolling5dDayTrades,
      accountEquityUsd,
      isUnder25k: false,
      status: 'SAFE',
      badgeVi: `Tài khoản ≥ $25k • Miễn giới hạn PDT (${rolling5dDayTrades} lệnh T+0/5 phiên)`,
      warningVi: null,
    };
  }

  if (rolling5dDayTrades >= 4) {
    return {
      rolling5dDayTrades,
      accountEquityUsd,
      isUnder25k: true,
      status: 'PDT_RESTRICTED',
      badgeVi: `VI PHẠM QUY TẮC PDT (${rolling5dDayTrades}/3 lệnh Day-Trade < $25k)`,
      warningVi:
        'Tài khoản Margin Mỹ dưới $25,000 thực hiện từ 4 giao dịch mua-bán trong ngày (T+0) trong 5 phiên làm việc sẽ bị khóa quyền Day-Trade 90 ngày theo quy định FINRA!',
    };
  }

  if (rolling5dDayTrades === 3) {
    return {
      rolling5dDayTrades,
      accountEquityUsd,
      isUnder25k: true,
      status: 'APPROACHING_LIMIT',
      badgeVi: `Sát ngưỡng PDT (3/3 lệnh T+0 trong 5 phiên • Vốn < $25k)`,
      warningVi:
        'Đã dùng hết 3/3 lượt Day-Trade an toàn trong 5 phiên cho tài khoản < $25,000. Lệnh đóng ngay trong phiên tiếp theo sẽ kích hoạt cờ FINRA PDT.',
    };
  }

  return {
    rolling5dDayTrades,
    accountEquityUsd,
    isUnder25k: true,
    status: 'SAFE',
    badgeVi: `FINRA PDT An toàn (${rolling5dDayTrades}/3 lượt T+0 • Chuẩn SEC T+1)`,
    warningVi: null,
  };
}

/**
 * Realistic Paper Trading Friction for Crypto Perpetuals/Spot & US Margin Equities
 */
export function computeGlobalPaperTradeNetPnl(params: {
  marketKind: 'crypto' | 'us_equity' | 'commodity';
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  openedAtMs: number;
  closedOrNowMs: number;
}): GlobalPaperTradeFrictionResult {
  const {
    marketKind,
    direction,
    entryPrice,
    currentPrice,
    leverage,
    openedAtMs,
    closedOrNowMs,
  } = params;

  const lev = Math.max(1, leverage || 1);
  const rawMovePct =
    entryPrice > 0
      ? direction === 'LONG'
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100
      : 0;
  const grossPnlPct = rawMovePct * lev;
  const heldMs = Math.max(0, closedOrNowMs - openedAtMs);

  if (marketKind === 'crypto') {
    // Binance USD-M Perp Taker fee: 0.04% per leg = 0.08% round-trip on notional (Spot 1x: 0.05%/leg = 0.10%)
    const roundTripFeeRatePct = lev > 1 ? 0.08 : 0.1;
    const feeCostPct = roundTripFeeRatePct * lev;

    // 8h Perpetual Funding intervals (~0.01% per 8h standard baseline on leveraged notional)
    const fundingIntervals = lev > 1 ? Math.floor(heldMs / (8 * 3600_000)) : 0;
    const carryOrMarginCostPct =
      fundingIntervals > 0 ? fundingIntervals * 0.01 * lev : 0;

    const netPnlPct = parseFloat(
      (grossPnlPct - feeCostPct - carryOrMarginCostPct).toFixed(2)
    );
    return {
      grossPnlPct: parseFloat(grossPnlPct.toFixed(2)),
      netPnlPct,
      feeCostPct: parseFloat(feeCostPct.toFixed(2)),
      carryOrMarginCostPct: parseFloat(carryOrMarginCostPct.toFixed(2)),
      settlementLabelVi:
        lev > 1
          ? `Perp T+0 • Phí Taker 0.08%×${lev}x${fundingIntervals > 0 ? ` + ${fundingIntervals} kỳ Funding 8h` : ''}`
          : 'Spot 24/7 • Phí khớp lệnh 0.10%',
    };
  }

  if (marketKind === 'us_equity') {
    // Zero commission + SEC/FINRA TAF fee (~0.015% round-trip) + 8.0%/yr USD Margin interest on borrowed capital
    const feeCostPct = 0.015 * lev;
    const heldDays = Math.floor(heldMs / 86400_000);
    const borrowedRatio = lev > 1 ? (lev - 1) / lev : 0;
    const carryOrMarginCostPct =
      borrowedRatio > 0 && heldDays > 0
        ? (8.0 / 365) * heldDays * borrowedRatio * lev
        : 0;

    const netPnlPct = parseFloat(
      (grossPnlPct - feeCostPct - carryOrMarginCostPct).toFixed(2)
    );
    return {
      grossPnlPct: parseFloat(grossPnlPct.toFixed(2)),
      netPnlPct,
      feeCostPct: parseFloat(feeCostPct.toFixed(3)),
      carryOrMarginCostPct: parseFloat(carryOrMarginCostPct.toFixed(2)),
      settlementLabelVi:
        lev > 1
          ? `NYSE/NASDAQ • SEC T+1 • Lãi Margin USD ~8%/năm`
          : 'NYSE/NASDAQ • Thanh toán bù trừ SEC T+1',
    };
  }

  // International Commodities (CFD/Futures ~0.04% spread/fee)
  const feeCostPct = 0.04 * lev;
  const netPnlPct = parseFloat((grossPnlPct - feeCostPct).toFixed(2));
  return {
    grossPnlPct: parseFloat(grossPnlPct.toFixed(2)),
    netPnlPct,
    feeCostPct: parseFloat(feeCostPct.toFixed(2)),
    carryOrMarginCostPct: 0,
    settlementLabelVi: 'CME/Spot Quốc tế • T+0',
  };
}
