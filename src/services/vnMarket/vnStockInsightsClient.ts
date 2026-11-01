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

export interface VnSymbolLiquidityAndPt {
  symbol: string;
  latestDate: string;
  floor: string;
  nmVolume: number;
  nmValueBillionVnd: number;
  ptVolume: number;
  ptValueBillionVnd: number;
  ptSharePct: number;
  total5dPtBillionVnd: number;
  vwapPrice: number | null;
  officialRefPrice: number | null;
  officialCeilingPrice: number | null;
  officialFloorPrice: number | null;
}

export interface VnPutThroughLeaderItem {
  symbol: string;
  tradingDate: string;
  ptVolume: number;
  ptValueBillionVnd: number;
  impliedPtPrice: number | null;
  closePrice: number;
  pctChange: number;
  dealTag: string;
}

export interface VnCorporateEventItem {
  id: string;
  symbol: string;
  eventType: string;
  typeLabelVi: string;
  note: string;
  effectiveDate: string | null;
  actualDate: string | null;
  disclosureDate: string | null;
  daysToExDate: number | null;
  cashDividendVnd: number | null;
  ratioPct: number | null;
  isImminentExDateWarning: boolean;
  riskHint: string | null;
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
  liquidityAndPt?: VnSymbolLiquidityAndPt | null;
  marketPutThroughLeaders?: VnPutThroughLeaderItem[];
  corporateEvents?: VnCorporateEventItem[];
  upcomingMarketEvents?: VnCorporateEventItem[];
}

const NON_CORPORATE = new Set([
  'VNINDEX',
  'VN30',
  'HNXINDEX',
  'UPCOMINDEX',
  'VN30F1M',
  'VN30F2M',
]);

const insightsCache = new Map<string, { ts: number; data: VnStockInsightsPayload }>();
const fundamentalsQuickMap = new Map<string, VnSymbolFundamentals>();
const foreignQuickMap = new Map<string, VnSymbolForeignFlow>();
const liquidityQuickMap = new Map<string, VnSymbolLiquidityAndPt>();
const eventsQuickMap = new Map<string, VnCorporateEventItem[]>();

let cachedMarketLeaders: VnStockInsightsPayload['marketLeaders'] | null = null;
let cachedPutThroughLeaders: VnPutThroughLeaderItem[] | null = null;
let cachedUpcomingEvents: VnCorporateEventItem[] | null = null;
let cachedMarketLeadersTs = 0;

const CACHE_TTL_MS = 45_000;

export function getCachedVnFundamentals(symbol: string): VnSymbolFundamentals | undefined {
  return fundamentalsQuickMap.get(symbol.trim().toUpperCase());
}

export function getCachedVnForeignFlow(symbol: string): VnSymbolForeignFlow | undefined {
  return foreignQuickMap.get(symbol.trim().toUpperCase());
}

export function getCachedVnLiquidityAndPt(symbol: string): VnSymbolLiquidityAndPt | undefined {
  return liquidityQuickMap.get(symbol.trim().toUpperCase());
}

export function getCachedVnCorporateEvents(symbol: string): VnCorporateEventItem[] | undefined {
  return eventsQuickMap.get(symbol.trim().toUpperCase());
}

function getVnIsoDateOffset(daysOffset = 0): string {
  const vnNowMs = Date.now() + 7 * 3600 * 1000 + daysOffset * 86400 * 1000;
  return new Date(vnNowMs).toISOString().slice(0, 10);
}

function diffCalendarDaysFromVnToday(targetDateStr: string | null): number | null {
  if (!targetDateStr) return null;
  const clean = targetDateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const todayStr = getVnIsoDateOffset(0);
  const tTarget = Date.parse(`${clean}T00:00:00Z`);
  const tToday = Date.parse(`${todayStr}T00:00:00Z`);
  if (!Number.isFinite(tTarget) || !Number.isFinite(tToday)) return null;
  return Math.round((tTarget - tToday) / 86400000);
}

function parseCorporateEventRow(r: any): VnCorporateEventItem | null {
  const code = String(r.code || '').toUpperCase();
  const type = String(r.type || '').toUpperCase();
  const typeDesc = String(r.typeDesc || type || 'Sự kiện quyền');
  const effectiveDate = r.effectiveDate ? String(r.effectiveDate).slice(0, 10) : null;
  const disclosureDate = r.disclosureDate ? String(r.disclosureDate).slice(0, 10) : null;
  const actualDate = r.actualDate ? String(r.actualDate).slice(0, 10) : null;

  const daysToExDate = diffCalendarDaysFromVnToday(effectiveDate);
  if (daysToExDate !== null && daysToExDate > 200) return null;

  const lowerDesc = typeDesc.toLowerCase();
  const isRightsAction =
    type.includes('DIV') ||
    type.includes('ISSUE') ||
    lowerDesc.includes('cổ tức') ||
    lowerDesc.includes('phát hành');

  const isSupplyListing = type.includes('LISTED') || lowerDesc.includes('bổ sung');

  const isImminentExDateWarning =
    isRightsAction && daysToExDate !== null && daysToExDate >= 0 && daysToExDate <= 6;

  let riskHint: string | null = null;
  if (isImminentExDateWarning) {
    riskHint =
      type.includes('ISSUE') || type.includes('KIND') || type.includes('STOCK')
        ? `⚠️ Còn ${daysToExDate} ngày tới GDKHQ: Lưu ý rủi ro chôn vốn CP thưởng/phát hành thêm 3–6 tháng!`
        : `⚠️ Còn ${daysToExDate} ngày tới GDKHQ: Lưu ý điều chỉnh giá tham chiếu & thuế cổ tức tiền 5%!`;
  } else if (isSupplyListing) {
    riskHint = '📦 Cổ phiếu phát hành/thưởng niêm yết bổ sung — chú ý áp lực cung chốt lời ngắn hạn.';
  }

  const toNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    id: String(r.id || `${code}_${type}_${effectiveDate || disclosureDate}`),
    symbol: code,
    eventType: type,
    typeLabelVi: typeDesc,
    note: String(r.note || typeDesc),
    effectiveDate,
    actualDate,
    disclosureDate,
    daysToExDate,
    cashDividendVnd: toNum(r.dividend),
    ratioPct: toNum(r.ratio),
    isImminentExDateWarning,
    riskHint,
  };
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
  const todayStr = getVnIsoDateOffset(0);
  const futureStr = getVnIsoDateOffset(50);

  const [
    foreignJson,
    buyLeadJson,
    sellLeadJson,
    simpJson,
    pricePtJson,
    mktPtJson,
    symEventsJson,
    mktEventsJson,
  ] = await Promise.all([
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
    isCorp
      ? fetchJsonSafe(
          `/api/vndirect/v4/stock_prices?q=code:${encodeURIComponent(cleanSym)}&sort=date:desc&size=5`
        )
      : Promise.resolve(null),
    needLeaders
      ? fetchJsonSafe(
          '/api/vndirect/v4/stock_prices?q=type:STOCK~floor:HOSE~ptValue:gt:15000000000&sort=date:desc~ptValue:desc&size=12'
        )
      : Promise.resolve(null),
    isCorp
      ? fetchJsonSafe(
          `/api/vndirect/v4/events?q=locale:VN~code:${encodeURIComponent(cleanSym)}&sort=disclosureDate:desc&size=8`
        )
      : Promise.resolve(null),
    needLeaders
      ? fetchJsonSafe(
          `/api/vndirect/v4/events?q=locale:VN~effectiveDate:gte:${todayStr}~effectiveDate:lte:${futureStr}&sort=effectiveDate:asc&size=24`
        )
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

  let liquidityAndPt: VnSymbolLiquidityAndPt | null = null;
  const ptRows = Array.isArray(pricePtJson?.data) ? pricePtJson.data : [];
  if (ptRows.length > 0) {
    const r0 = ptRows[0];
    const nmVolume = Math.round(Number(r0.nmVolume) || 0);
    const nmValueBillionVnd = parseFloat(((Number(r0.nmValue) || 0) / 1e9).toFixed(2));
    const ptVolume = Math.round(Number(r0.ptVolume) || 0);
    const ptValueBillionVnd = parseFloat(((Number(r0.ptValue) || 0) / 1e9).toFixed(2));
    const totalVal = nmValueBillionVnd + ptValueBillionVnd;
    liquidityAndPt = {
      symbol: cleanSym,
      latestDate: String(r0.date || ''),
      floor: String(r0.floor || 'HOSE'),
      nmVolume,
      nmValueBillionVnd,
      ptVolume,
      ptValueBillionVnd,
      ptSharePct:
        totalVal > 0 ? parseFloat(((ptValueBillionVnd / totalVal) * 100).toFixed(1)) : 0,
      total5dPtBillionVnd: parseFloat(
        ptRows.reduce((s: number, r: any) => s + (Number(r.ptValue) || 0) / 1e9, 0).toFixed(2)
      ),
      vwapPrice: Number.isFinite(Number(r0.average))
        ? parseFloat(Number(r0.average).toFixed(2))
        : null,
      officialRefPrice: Number.isFinite(Number(r0.basicPrice))
        ? parseFloat(Number(r0.basicPrice).toFixed(2))
        : null,
      officialCeilingPrice: Number.isFinite(Number(r0.ceilingPrice))
        ? parseFloat(Number(r0.ceilingPrice).toFixed(2))
        : null,
      officialFloorPrice: Number.isFinite(Number(r0.floorPrice))
        ? parseFloat(Number(r0.floorPrice).toFixed(2))
        : null,
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

  if (needLeaders && mktPtJson) {
    const mRows = Array.isArray(mktPtJson?.data) ? mktPtJson.data : [];
    const latestDate = String(mRows[0]?.date || '');
    cachedPutThroughLeaders = mRows
      .filter((r: any) => String(r.date || '') === latestDate && String(r.code || '').length === 3)
      .slice(0, 6)
      .map((r: any) => {
        const ptVolume = Math.round(Number(r.ptVolume) || 0);
        const ptValueBillionVnd = parseFloat(((Number(r.ptValue) || 0) / 1e9).toFixed(2));
        const impliedPtPrice =
          ptVolume > 0
            ? parseFloat(((Number(r.ptValue) || 0) / ptVolume / 1000).toFixed(2))
            : null;
        const ceil = Number(r.ceilingPrice) || 0;
        const flr = Number(r.floorPrice) || 0;
        let dealTag = 'Trao tay tổ chức';
        if (impliedPtPrice && ceil > 0 && impliedPtPrice >= ceil - 0.08) {
          dealTag = 'Thỏa thuận giá Trần';
        } else if (impliedPtPrice && flr > 0 && impliedPtPrice <= flr + 0.08) {
          dealTag = 'Thỏa thuận giá Sàn';
        }
        return {
          symbol: String(r.code || ''),
          tradingDate: latestDate,
          ptVolume,
          ptValueBillionVnd,
          impliedPtPrice,
          closePrice: Number(r.close) || 0,
          pctChange: parseFloat((Number(r.pctChange) || 0).toFixed(2)),
          dealTag,
        };
      });
  }

  const corporateEvents = (Array.isArray(symEventsJson?.data) ? symEventsJson.data : [])
    .map(parseCorporateEventRow)
    .filter((x: VnCorporateEventItem | null): x is VnCorporateEventItem => Boolean(x))
    .slice(0, 5);

  if (needLeaders && mktEventsJson) {
    cachedUpcomingEvents = (Array.isArray(mktEventsJson?.data) ? mktEventsJson.data : [])
      .filter((r: any) => String(r.code || '').length === 3)
      .map(parseCorporateEventRow)
      .filter(
        (ev: VnCorporateEventItem | null): ev is VnCorporateEventItem =>
          Boolean(ev) &&
          (ev!.eventType.includes('DIV') ||
            ev!.eventType.includes('ISSUE') ||
            ev!.typeLabelVi.toLowerCase().includes('cổ tức') ||
            ev!.typeLabelVi.toLowerCase().includes('phát hành'))
      )
      .slice(0, 8);
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
      officialRefPrice: div1000(d.priceReferrance) ?? liquidityAndPt?.officialRefPrice ?? null,
      officialCeilingPrice: div1000(d.priceCeiling) ?? liquidityAndPt?.officialCeilingPrice ?? null,
      officialFloorPrice: div1000(d.priceFloor) ?? liquidityAndPt?.officialFloorPrice ?? null,
      avgVolume10d: toNum(d.volume10dAvg) !== null ? Math.round(Number(d.volume10dAvg)) : null,
      source: 'Simplize / BCTC Doanh nghiệp',
    };
  }

  const sourcesUsed: string[] = [];
  if (foreignFlow || (cachedMarketLeaders?.topBuy.length ?? 0) > 0) {
    sourcesUsed.push('VNDirect/VSD Foreign Flow');
  }
  if (liquidityAndPt || (cachedPutThroughLeaders?.length ?? 0) > 0) {
    sourcesUsed.push('HOSE/VNDirect Put-Through & VWAP');
  }
  if (corporateEvents.length > 0 || (cachedUpcomingEvents?.length ?? 0) > 0) {
    sourcesUsed.push('VSD/VNDirect Corporate Rights');
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
    liquidityAndPt,
    marketPutThroughLeaders: cachedPutThroughLeaders ?? [],
    corporateEvents,
    upcomingMarketEvents: cachedUpcomingEvents ?? [],
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
      serverJson.liquidityAndPt ||
      (serverJson.marketLeaders?.topBuy?.length ?? 0) > 0)
  ) {
    payload = serverJson as VnStockInsightsPayload;
    if (payload.marketLeaders?.topBuy?.length) {
      cachedMarketLeaders = payload.marketLeaders;
      cachedMarketLeadersTs = Date.now();
    }
    if (payload.marketPutThroughLeaders?.length) {
      cachedPutThroughLeaders = payload.marketPutThroughLeaders;
    }
    if (payload.upcomingMarketEvents?.length) {
      cachedUpcomingEvents = payload.upcomingMarketEvents;
    }
  } else {
    payload = await fetchViaClientProxyFallback(cleanSym);
  }

  if (payload.fundamentals) {
    fundamentalsQuickMap.set(cleanSym, payload.fundamentals);
  }
  if (payload.foreignFlow) {
    foreignQuickMap.set(cleanSym, payload.foreignFlow);
  }
  if (payload.liquidityAndPt) {
    liquidityQuickMap.set(cleanSym, payload.liquidityAndPt);
  }
  if (payload.corporateEvents && payload.corporateEvents.length > 0) {
    eventsQuickMap.set(cleanSym, payload.corporateEvents);
  }

  insightsCache.set(cleanSym, { ts: Date.now(), data: payload });
  return payload;
}
