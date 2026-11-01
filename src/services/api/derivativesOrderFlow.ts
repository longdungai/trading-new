import { Candle, MarketSymbol } from '../../types';

export type OrderFlowRegime =
  | 'LONG_BUILDUP'
  | 'SHORT_SQUEEZE'
  | 'SHORT_BUILDUP'
  | 'LONG_LIQUIDATION'
  | 'BALANCED';

export interface WhaleTradePrint {
  id: number;
  timeMs: number;
  price: number;
  quantity: number;
  notionalUsd: number;
  side: 'BUY' | 'SELL';
}

export interface DerivativesOrderFlowSnapshot {
  symbol: string;
  futuresSymbol: string | null;
  hasLiveFuturesData: boolean;
  fetchedAtMs: number;
  openInterestContracts: number | null;
  openInterestUsd: number | null;
  oiChange1hPct: number | null;
  topTraderLongPct: number | null;
  topTraderShortPct: number | null;
  topTraderLongShortRatio: number | null;
  takerBuySellRatio: number | null;
  regime: OrderFlowRegime;
  regimeLabel: string;
  regimeDetail: string;
  whaleThresholdUsd: number;
  whaleTrades: WhaleTradePrint[];
  whaleNetDeltaUsd: number;
  // Deterministic Candle-Based CVD (always available for ALL assets: VN30, Stocks, Gold, Crypto)
  candleCvdSeries: { time: number; delta: number; cumulativeDelta: number }[];
  cvdDivergenceWarning: string | null;
}

const cache = new Map<string, { ts: number; data: DerivativesOrderFlowSnapshot }>();

function resolveBinanceFuturesSymbol(sym: MarketSymbol): {
  fapiSymbol: string | null;
  spotSymbol: string | null;
  isProxy: boolean;
} {
  const s = sym.symbol.toUpperCase();
  if (s === 'XAUUSD' || s === 'PAXGUSDT') {
    return { fapiSymbol: 'PAXGUSDT', spotSymbol: 'PAXGUSDT', isProxy: s === 'XAUUSD' };
  }
  if (sym.type === 'crypto' && s.endsWith('USDT')) {
    return { fapiSymbol: s, spotSymbol: s, isProxy: false };
  }
  return { fapiSymbol: null, spotSymbol: null, isProxy: false };
}

async function fetchJsonSafe(urls: string[], timeoutMs = 4500): Promise<any | null> {
  for (const url of urls) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // try next endpoint
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export function classifyOrderFlowRegime(
  priceChangePct: number,
  oiChangePct: number | null,
  takerRatio: number | null
): { regime: OrderFlowRegime; regimeLabel: string; regimeDetail: string } {
  if (oiChangePct === null || !Number.isFinite(oiChangePct)) {
    if (takerRatio !== null && takerRatio >= 1.12) {
      return {
        regime: 'LONG_BUILDUP',
        regimeLabel: 'Taker Mua Chủ Động',
        regimeDetail: 'Khối lượng khớp lệnh thị trường nghiêng mạnh về phe Mua chủ động.',
      };
    }
    if (takerRatio !== null && takerRatio <= 0.88) {
      return {
        regime: 'SHORT_BUILDUP',
        regimeLabel: 'Taker Bán Chủ Động',
        regimeDetail: 'Áp lực xả lệnh thị trường trực tiếp từ phe Bán đang chiếm ưu thế.',
      };
    }
    return {
      regime: 'BALANCED',
      regimeLabel: 'Cân Bằng Cung - Cầu',
      regimeDetail: 'Chưa xuất hiện đột biến vị thế mở hoặc lệch pha mua/bán cực đoan.',
    };
  }

  if (priceChangePct >= 0.25 && oiChangePct >= 0.35) {
    return {
      regime: 'LONG_BUILDUP',
      regimeLabel: 'Long Buildup (Tiền Mới Vào)',
      regimeDetail: 'Giá tăng đi kèm Open Interest tăng: dòng tiền mới đang mở vị thế Mua thật sự.',
    };
  }
  if (priceChangePct >= 0.25 && oiChangePct <= -0.35) {
    return {
      regime: 'SHORT_SQUEEZE',
      regimeLabel: 'Short Squeeze (Đóng Short)',
      regimeDetail: 'Giá tăng nhưng OI giảm: đà tăng chủ yếu do phe Short cắt lỗ/thanh lý, dễ chững lại khi hết lực ép.',
    };
  }
  if (priceChangePct <= -0.25 && oiChangePct >= 0.35) {
    return {
      regime: 'SHORT_BUILDUP',
      regimeLabel: 'Short Buildup (Tay To Đè Giá)',
      regimeDetail: 'Giá giảm đi kèm Open Interest tăng: dòng tiền phái sinh đang chủ động mở thêm vị thế Bán khống.',
    };
  }
  if (priceChangePct <= -0.25 && oiChangePct <= -0.35) {
    return {
      regime: 'LONG_LIQUIDATION',
      regimeLabel: 'Long Liquidation (Rũ Đòn Bẩy)',
      regimeDetail: 'Giá giảm kèm OI sụt giảm: vị thế Long đòn bẩy đang bị ép đóng/thanh lý hàng loạt.',
    };
  }

  return {
    regime: 'BALANCED',
    regimeLabel: 'Tích Lũy / Giằng Co Phái Sinh',
    regimeDetail: 'Giá và hợp đồng mở (OI) biến động biên độ hẹp, thị trường đang nén chờ bứt phá.',
  };
}

/**
 * Computes deterministic Cumulative Volume Delta (CVD) from real OHLCV candles
 * and detects Bearish Absorption / Bullish Exhaustion divergence.
 */
export function computeCandleCvdAndDivergence(candles: Candle[]): {
  series: { time: number; delta: number; cumulativeDelta: number }[];
  divergenceWarning: string | null;
} {
  if (!candles || candles.length < 10) {
    return { series: [], divergenceWarning: null };
  }

  const recent = candles.slice(-40);
  let cum = 0;
  const series = recent.map(c => {
    const range = Math.max(1e-9, c.high - c.low);
    const buyWeight = (c.close - c.low) / range; // 0..1
    const delta = (c.volume || 0) * (2 * buyWeight - 1); // -vol .. +vol
    cum += delta;
    return {
      time: c.time,
      delta,
      cumulativeDelta: cum,
    };
  });

  // Compare first half vs second half of last 16 bars for Price vs CVD divergence
  let divergenceWarning: string | null = null;
  if (series.length >= 16) {
    const tailCandles = recent.slice(-16);
    const tailCvd = series.slice(-16);
    const first8High = Math.max(...tailCandles.slice(0, 8).map(c => c.high));
    const last8High = Math.max(...tailCandles.slice(8).map(c => c.high));
    const first8CvdPeak = Math.max(...tailCvd.slice(0, 8).map(d => d.cumulativeDelta));
    const last8CvdPeak = Math.max(...tailCvd.slice(8).map(d => d.cumulativeDelta));

    const first8Low = Math.min(...tailCandles.slice(0, 8).map(c => c.low));
    const last8Low = Math.min(...tailCandles.slice(8).map(c => c.low));
    const first8CvdTrough = Math.min(...tailCvd.slice(0, 8).map(d => d.cumulativeDelta));
    const last8CvdTrough = Math.min(...tailCvd.slice(8).map(d => d.cumulativeDelta));

    if (last8High > first8High * 1.002 && last8CvdPeak < first8CvdPeak) {
      divergenceWarning =
        'Phân kỳ Âm CVD (Bearish Absorption): Giá tạo đỉnh cao hơn nhưng dòng tiền mua ròng (CVD) suy yếu — dấu hiệu tay to đặt tường bán hấp thụ.';
    } else if (last8Low < first8Low * 0.998 && last8CvdTrough > first8CvdTrough) {
      divergenceWarning =
        'Phân kỳ Dương CVD (Bullish Absorption): Giá tạo đáy thấp hơn nhưng áp lực bán ròng (CVD) giảm hẳn — dấu hiệu lực gom đỡ giá ngầm.';
    }
  }

  return { series, divergenceWarning };
}

export async function fetchDerivativesOrderFlow(
  marketSymbol: MarketSymbol,
  candles: Candle[],
  force: boolean = false
): Promise<DerivativesOrderFlowSnapshot> {
  const key = marketSymbol.symbol.toUpperCase();
  const now = Date.now();
  const cached = cache.get(key);
  const { series: candleCvdSeries, divergenceWarning: cvdDivergenceWarning } =
    computeCandleCvdAndDivergence(candles);

  if (!force && cached && now - cached.ts < 15_000) {
    return {
      ...cached.data,
      candleCvdSeries,
      cvdDivergenceWarning,
    };
  }

  const { fapiSymbol, spotSymbol } = resolveBinanceFuturesSymbol(marketSymbol);
  const whaleThresholdUsd =
    key === 'BTCUSDT' || key === 'ETHUSDT' ? 40_000 : 15_000;

  if (!fapiSymbol || !spotSymbol) {
    const nonFuturesSnap: DerivativesOrderFlowSnapshot = {
      symbol: key,
      futuresSymbol: null,
      hasLiveFuturesData: false,
      fetchedAtMs: now,
      openInterestContracts: null,
      openInterestUsd: null,
      oiChange1hPct: null,
      topTraderLongPct: null,
      topTraderShortPct: null,
      topTraderLongShortRatio: null,
      takerBuySellRatio: null,
      regime: 'BALANCED',
      regimeLabel: 'CVD Khối Lượng Cơ Sở',
      regimeDetail:
        'Tài sản cơ sở (Cổ phiếu / Chỉ số) không có sổ phái sinh Binance — hệ thống phân tích trực tiếp CVD & hấp thụ khối lượng trên từng thanh nến.',
      whaleThresholdUsd,
      whaleTrades: [],
      whaleNetDeltaUsd: 0,
      candleCvdSeries,
      cvdDivergenceWarning,
    };
    cache.set(key, { ts: now, data: nonFuturesSnap });
    return nonFuturesSnap;
  }

  const [oiHist, topLs, takerRatioArr, aggTrades] = await Promise.all([
    fetchJsonSafe([
      `/api/fapi/futures/data/openInterestHist?symbol=${fapiSymbol}&period=15m&limit=6`,
      `https://fapi.binance.com/futures/data/openInterestHist?symbol=${fapiSymbol}&period=15m&limit=6`,
    ]),
    fetchJsonSafe([
      `/api/fapi/futures/data/topLongShortPositionRatio?symbol=${fapiSymbol}&period=15m&limit=2`,
      `https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${fapiSymbol}&period=15m&limit=2`,
    ]),
    fetchJsonSafe([
      `/api/fapi/futures/data/takerlongshortRatio?symbol=${fapiSymbol}&period=15m&limit=4`,
      `https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=${fapiSymbol}&period=15m&limit=4`,
    ]),
    fetchJsonSafe([
      `/api/binance/aggTrades?symbol=${spotSymbol}&limit=120`,
      `https://data-api.binance.vision/api/v3/aggTrades?symbol=${spotSymbol}&limit=120`,
    ]),
  ]);

  let openInterestContracts: number | null = null;
  let openInterestUsd: number | null = null;
  let oiChange1hPct: number | null = null;

  if (Array.isArray(oiHist) && oiHist.length > 0) {
    const latest = oiHist[oiHist.length - 1];
    const earliest = oiHist[Math.max(0, oiHist.length - 5)];
    openInterestContracts = parseFloat(latest.sumOpenInterest);
    openInterestUsd = parseFloat(latest.sumOpenInterestValue);
    const earliestVal = parseFloat(earliest.sumOpenInterestValue);
    if (Number.isFinite(openInterestUsd) && Number.isFinite(earliestVal) && earliestVal > 0) {
      oiChange1hPct = ((openInterestUsd - earliestVal) / earliestVal) * 100;
    }
  }

  let topTraderLongPct: number | null = null;
  let topTraderShortPct: number | null = null;
  let topTraderLongShortRatio: number | null = null;

  if (Array.isArray(topLs) && topLs.length > 0) {
    const latestLs = topLs[topLs.length - 1];
    topTraderLongPct = parseFloat(latestLs.longAccount) * 100;
    topTraderShortPct = parseFloat(latestLs.shortAccount) * 100;
    topTraderLongShortRatio = parseFloat(latestLs.longShortRatio);
  }

  let takerBuySellRatio: number | null = null;
  if (Array.isArray(takerRatioArr) && takerRatioArr.length > 0) {
    const latestTk = takerRatioArr[takerRatioArr.length - 1];
    takerBuySellRatio = parseFloat(latestTk.buySellRatio);
  }

  const whaleTrades: WhaleTradePrint[] = [];
  let whaleNetDeltaUsd = 0;

  if (Array.isArray(aggTrades)) {
    for (const t of aggTrades) {
      const price = parseFloat(t.p);
      const qty = parseFloat(t.q);
      const notional = price * qty;
      if (!Number.isFinite(notional) || notional < whaleThresholdUsd) continue;
      // In Binance aggTrades, m === true means buyer was market maker => aggressor was SELLER
      const side: 'BUY' | 'SELL' = t.m ? 'SELL' : 'BUY';
      whaleNetDeltaUsd += side === 'BUY' ? notional : -notional;
      whaleTrades.push({
        id: Number(t.a) || t.T,
        timeMs: Number(t.T) || now,
        price,
        quantity: qty,
        notionalUsd: notional,
        side,
      });
    }
  }

  whaleTrades.sort((a, b) => b.timeMs - a.timeMs);

  // Compute recent 1h price change from candles if available, else change24h
  let recentPriceChgPct = marketSymbol.change24h || 0;
  if (candles.length >= 5) {
    const refClose = candles[Math.max(0, candles.length - 5)].close;
    const lastClose = candles[candles.length - 1].close;
    if (refClose > 0) {
      recentPriceChgPct = ((lastClose - refClose) / refClose) * 100;
    }
  }

  const regimeInfo = classifyOrderFlowRegime(recentPriceChgPct, oiChange1hPct, takerBuySellRatio);

  const snapshot: DerivativesOrderFlowSnapshot = {
    symbol: key,
    futuresSymbol: fapiSymbol,
    hasLiveFuturesData:
      openInterestUsd !== null || topTraderLongShortRatio !== null || takerBuySellRatio !== null,
    fetchedAtMs: now,
    openInterestContracts,
    openInterestUsd,
    oiChange1hPct,
    topTraderLongPct,
    topTraderShortPct,
    topTraderLongShortRatio,
    takerBuySellRatio,
    regime: regimeInfo.regime,
    regimeLabel: regimeInfo.regimeLabel,
    regimeDetail: regimeInfo.regimeDetail,
    whaleThresholdUsd,
    whaleTrades: whaleTrades.slice(0, 12),
    whaleNetDeltaUsd,
    candleCvdSeries,
    cvdDivergenceWarning,
  };

  cache.set(key, { ts: now, data: snapshot });
  return snapshot;
}
