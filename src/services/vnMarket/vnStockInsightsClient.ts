export interface VnForeignSessionBar {
  tradingDate: string;
  buyValBillionVnd: number;
  sellValBillionVnd: number;
  netValBillionVnd: number;
  buyVol: number;
  sellVol: number;
  netVol: number;
}

export interface VnSymbolForeignFlow {
  symbol: string;
  floor: string;
  latestDate: string;
  latestNetBillionVnd: number;
  latestNetVol: number;
  total10dNetBillionVnd: number;
  consecutiveNetBuyDays: number;
  consecutiveNetSellDays: number;
  remainingRoomPct: number | null;
  currentRoomShares: number | null;
  totalRoomShares: number | null;
  sessions: VnForeignSessionBar[];
}

export interface VnMarketForeignLeaderItem {
  symbol: string;
  tradingDate: string;
  netValBillionVnd: number;
  buyValBillionVnd: number;
  sellValBillionVnd: number;
  netVol: number;
}

export interface VnSymbolFundamentals {
  symbol: string;
  companyNameVi: string;
  industryName: string | null;
  exchange: string | null;
  peRatio: number | null;
  pbRatio: number | null;
  roePct: number | null;
  roaPct: number | null;
  epsVnd: number | null;
  marketCapTrillionVnd: number | null;
  dividendYieldPct: number | null;
  revenueGrowthQoqPct: number | null;
  netIncomeGrowthQoqPct: number | null;
  officialRefPrice: number | null;
  officialCeilingPrice: number | null;
  officialFloorPrice: number | null;
  avgVolume10d: number | null;
  source: string;
}

export interface VnStockInsightsPayload {
  ok: boolean;
  fetchedAtMs: number;
  symbol: string;
  sourcesUsed: string[];
  foreignFlow: VnSymbolForeignFlow | null;
  marketLeaders: {
    tradingDate: string | null;
    topBuy: VnMarketForeignLeaderItem[];
    topSell: VnMarketForeignLeaderItem[];
  };
  fundamentals: VnSymbolFundamentals | null;
}

const NON_CORPORATE = new Set(['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX', 'VN30F1M', 'VN30F2M']);

const insightsCache = new Map<string, { ts: number; data: VnStockInsightsPayload }>();
const fundamentalsQuickMap = new Map<string, VnSymbolFundamentals>();
const foreignQuickMap = new Map<string, VnSymbolForeignFlow>();
let cachedMarketLeaders: VnStockInsightsPayload['marketLeaders'] | null = null;
let cachedMarketLeadersTs = 0;

const CACHE_TTL_MS = 45_000;

export function getCachedVnFundamentals(symbol: string): VnSymbolFundamentals | undefined {
  return fundamentalsQuickMap.get(symbol.trim().toUpperCase());
}

export function getCachedVnForeignFlow(symbol: string): VnSymbolForeignFlow | undefined {
  return foreignQuickMap.get(symbol.trim().toUpperCase());
}

async function fetchJsonSafe(url: string, timeoutMs = 5500): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchViaClientProxyFallback(cleanSym: string): Promise<VnStockInsightsPayload> {
  const isCorp = !NON_CORPORATE.has(cleanSym);

  const needLeaders = !cachedMarketLeaders || Date.now() - cachedMarketLeadersTs > 90_000;

  const [foreignJson, buyLeadJson, sellLeadJson, simpJson] = await Promise.all([
    isCorp
      ? fetchJsonSafe(
          `/api/vndirect/v4/foreigns?q=code:${encodeURIComponent(cleanSym)}&sort=tradingDate:desc&size=10`
        )
      : Promise.resolve(null),
    needLeaders
      ? fetchJsonSafe(
          '/api/vndirect/v4/foreigns?q=type:STOCK~floor:HOSE&sort=tradingDate:desc~netVal:desc&size=8'
        )
      : Promise.resolve(null),
    needLeaders
      ? fetchJsonSafe(
          '/api/vndirect/v4/foreigns?q=type:STOCK~floor:HOSE&sort=tradingDate:desc~netVal:asc&size=8'
        )
      : Promise.resolve(null),
    isCorp
      ? fetchJsonSafe(`/api/simplize/api/company/summary/${encodeURIComponent(cleanSym.toLowerCase())}`)
      : Promise.resolve(null),
  ]);

  let foreignFlow: VnSymbolForeignFlow | null = null;
  const rows = Array.isArray(foreignJson?.data) ? foreignJson.data : [];
  if (rows.length > 0) {
    const sessions: VnForeignSessionBar[] = rows.map((r: any) => ({
      tradingDate: String(r.tradingDate || ''),
      buyValBillionVnd: parseFloat(((Number(r.buyVal) || 0) / 1e9).toFixed(2)),
      sellValBillionVnd: parseFloat(((Number(r.sellVal) || 0) / 1e9).toFixed(2)),
      netValBillionVnd: parseFloat(((Number(r.netVal) || 0) / 1e9).toFixed(2)),
      buyVol: Math.round(Number(r.buyVol) || 0),
      sellVol: Math.round(Number(r.sellVol) || 0),
      netVol: Math.round(Number(r.netVol) || 0),
    }));

    const latest = rows[0];
    const totalRoom = Number(latest.totalRoom) || 0;
    const currentRoom = Number(latest.currentRoom) || 0;

    let consecutiveNetBuyDays = 0;
    for (const s of sessions) {
      if (s.netValBillionVnd > 0) consecutiveNetBuyDays++;
      else break;
    }

    let consecutiveNetSellDays = 0;
    for (const s of sessions) {
      if (s.netValBillionVnd < 0) consecutiveNetSellDays++;
      else break;
    }

    foreignFlow = {
      symbol: cleanSym,
      floor: String(latest.floor || 'HOSE'),
      latestDate: sessions[0].tradingDate,
      latestNetBillionVnd: sessions[0].netValBillionVnd,
      latestNetVol: sessions[0].netVol,
      total10dNetBillionVnd: parseFloat(
        sessions.reduce((acc, s) => acc + s.netValBillionVnd, 0).toFixed(2)
      ),
      consecutiveNetBuyDays,
      consecutiveNetSellDays,
      remainingRoomPct:
        totalRoom > 0 ? parseFloat(((currentRoom / totalRoom) * 100).toFixed(2)) : null,
      currentRoomShares: currentRoom > 0 ? Math.round(currentRoom) : null,
      totalRoomShares: totalRoom > 0 ? Math.round(totalRoom) : null,
      sessions: sessions.slice().reverse(),
    };
  }

  if (needLeaders && (buyLeadJson || sellLeadJson)) {
    const mapL = (r: any): VnMarketForeignLeaderItem => ({
      symbol: String(r.code || ''),
      tradingDate: String(r.tradingDate || ''),
      netValBillionVnd: parseFloat(((Number(r.netVal) || 0) / 1e9).toFixed(2)),
      buyValBillionVnd: parseFloat(((Number(r.buyVal) || 0) / 1e9).toFixed(2)),
      sellValBillionVnd: parseFloat(((Number(r.sellVal) || 0) / 1e9).toFixed(2)),
      netVol: Math.round(Number(r.netVol) || 0),
    });

    const topBuy = (Array.isArray(buyLeadJson?.data) ? buyLeadJson.data : [])
      .filter((r: any) => Number(r.netVal) > 0 && String(r.code || '').length === 3)
      .slice(0, 8)
      .map(mapL);

    const topSell = (Array.isArray(sellLeadJson?.data) ? sellLeadJson.data : [])
      .filter((r: any) => Number(r.netVal) < 0 && String(r.code || '').length === 3)
      .slice(0, 8)
      .map(mapL);

    cachedMarketLeaders = {
      tradingDate: topBuy[0]?.tradingDate || topSell[0]?.tradingDate || null,
      topBuy,
      topSell,
    };
    cachedMarketLeadersTs = Date.now();
  }

  let fundamentals: VnSymbolFundamentals | null = null;
  const d = simpJson?.data;
  if (d && (d.peRatio != null || d.pbRatio != null || d.marketCap != null)) {
    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const div1000 = (v: any) => {
      const n = toNum(v);
      return n !== null && n > 0 ? parseFloat((n / 1000).toFixed(2)) : null;
    };

    fundamentals = {
      symbol: cleanSym,
      companyNameVi: d.nameVi || d.name || cleanSym,
      industryName: d.industryActivity || d.bcEconomicSectorName || null,
      exchange: d.stockExchange ? String(d.stockExchange).toUpperCase() : null,
      peRatio: toNum(d.peRatio) !== null ? parseFloat(Number(d.peRatio).toFixed(2)) : null,
      pbRatio: toNum(d.pbRatio) !== null ? parseFloat(Number(d.pbRatio).toFixed(2)) : null,
      roePct: toNum(d.roe) !== null ? parseFloat(Number(d.roe).toFixed(2)) : null,
      roaPct: toNum(d.roa) !== null ? parseFloat(Number(d.roa).toFixed(2)) : null,
      epsVnd: toNum(d.epsRatio) !== null ? Math.round(Number(d.epsRatio)) : null,
      marketCapTrillionVnd:
        toNum(d.marketCap) !== null ? parseFloat((Number(d.marketCap) / 1e12).toFixed(2)) : null,
      dividendYieldPct:
        toNum(d.dividendYieldCurrent) !== null
          ? parseFloat(Number(d.dividendYieldCurrent).toFixed(2))
          : null,
      revenueGrowthQoqPct:
        toNum(d.revenueGrowthQoq) !== null
          ? parseFloat(Number(d.revenueGrowthQoq).toFixed(2))
          : null,
      netIncomeGrowthQoqPct:
        toNum(d.netIncomeGrowthQoq) !== null
          ? parseFloat(Number(d.netIncomeGrowthQoq).toFixed(2))
          : null,
      officialRefPrice: div1000(d.priceReferrance),
      officialCeilingPrice: div1000(d.priceCeiling),
      officialFloorPrice: div1000(d.priceFloor),
      avgVolume10d: toNum(d.volume10dAvg) !== null ? Math.round(Number(d.volume10dAvg)) : null,
      source: 'Simplize / BCTC Doanh nghiệp',
    };
  }

  const sourcesUsed: string[] = [];
  if (foreignFlow || (cachedMarketLeaders?.topBuy.length ?? 0) > 0) {
    sourcesUsed.push('VNDirect/VSD Foreign Flow');
  }
  if (fundamentals) {
    sourcesUsed.push(fundamentals.source);
  }

  return {
    ok: true,
    fetchedAtMs: Date.now(),
    symbol: cleanSym,
    sourcesUsed,
    foreignFlow,
    marketLeaders: cachedMarketLeaders ?? { tradingDate: null, topBuy: [], topSell: [] },
    fundamentals,
  };
}

export async function fetchVnStockInsights(
  symbol: string,
  forceRefresh: boolean = false
): Promise<VnStockInsightsPayload> {
  const cleanSym = (symbol || 'FPT').trim().toUpperCase().replace(/\.VN$/i, '');
  const cached = insightsCache.get(cleanSym);

  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Primary: Vercel Serverless Endpoint (/api/vn-stock-insights)
  const serverJson = await fetchJsonSafe(
    `/api/vn-stock-insights?symbol=${encodeURIComponent(cleanSym)}`,
    6500
  );

  let payload: VnStockInsightsPayload;
  if (
    serverJson &&
    serverJson.ok === true &&
    (serverJson.foreignFlow ||
      serverJson.fundamentals ||
      (serverJson.marketLeaders?.topBuy?.length ?? 0) > 0)
  ) {
    payload = serverJson as VnStockInsightsPayload;
    if (payload.marketLeaders?.topBuy?.length) {
      cachedMarketLeaders = payload.marketLeaders;
      cachedMarketLeadersTs = Date.now();
    }
  } else {
    // 2. Fallback: Direct proxied feeds (/api/vndirect & /api/simplize) for Vite local dev
    payload = await fetchViaClientProxyFallback(cleanSym);
  }

  if (payload.fundamentals) {
    fundamentalsQuickMap.set(cleanSym, payload.fundamentals);
  }
  if (payload.foreignFlow) {
    foreignQuickMap.set(cleanSym, payload.foreignFlow);
  }

  insightsCache.set(cleanSym, { ts: Date.now(), data: payload });
  return payload;
}
