/**
 * Vercel Serverless Function: Vietnam Stock Institutional Insights (/api/vn-stock-insights)
 * Fetches 100% authentic, live Vietnam Stock Market data from official public feeds:
 * 1. VNDirect Finfo (`api-finfo.vndirect.com.vn/v4/foreigns`):
 *    - 10-session Foreign Investor Buy / Sell / Net Value (VND) & Volume + Remaining Foreign Room
 *    - Market-wide Top Foreign Net Buy & Top Foreign Net Sell leaders across HOSE
 * 2. Simplize Company Summary (`api2.simplize.vn/api/company/summary/<symbol>`) + VNDirect `ratios/latest`:
 *    - Live P/E, P/B, ROE %, ROA %, EPS, Market Cap (VND), Dividend Yield %, Official Ref / Ceiling / Floor
 *
 * Strictly zero fabricated numbers. Non-corporate tickers (VNINDEX, VN30, VN30F1M) return null fundamentals cleanly.
 */

const NON_CORPORATE_SYMBOLS = new Set(['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX', 'VN30F1M', 'VN30F2M']);

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json',
};

async function fetchJsonWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: COMMON_HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function toFiniteNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

async function fetchSymbolForeignFlow(symbol) {
  if (!symbol || NON_CORPORATE_SYMBOLS.has(symbol)) return null;
  const url = `https://api-finfo.vndirect.com.vn/v4/foreigns?q=code:${encodeURIComponent(
    symbol
  )}&sort=tradingDate:desc&size=10`;
  const json = await fetchJsonWithTimeout(url);
  const rows = Array.isArray(json?.data) ? json.data : [];
  if (rows.length === 0) return null;

  const sessions = rows.map((r) => ({
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
  const remainingRoomPct =
    totalRoom > 0 ? parseFloat(((currentRoom / totalRoom) * 100).toFixed(2)) : null;

  const total10dNetBillion = parseFloat(
    sessions.reduce((acc, s) => acc + s.netValBillionVnd, 0).toFixed(2)
  );

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

  return {
    symbol,
    floor: String(latest.floor || 'HOSE'),
    latestDate: sessions[0].tradingDate,
    latestNetBillionVnd: sessions[0].netValBillionVnd,
    latestNetVol: sessions[0].netVol,
    total10dNetBillionVnd: total10dNetBillion,
    consecutiveNetBuyDays,
    consecutiveNetSellDays,
    remainingRoomPct,
    currentRoomShares: currentRoom > 0 ? Math.round(currentRoom) : null,
    totalRoomShares: totalRoom > 0 ? Math.round(totalRoom) : null,
    sessions: sessions.slice().reverse(), // chronological oldest -> newest for bar chart
  };
}

async function fetchMarketForeignLeaders() {
  const [buyJson, sellJson] = await Promise.all([
    fetchJsonWithTimeout(
      'https://api-finfo.vndirect.com.vn/v4/foreigns?q=type:STOCK~floor:HOSE&sort=tradingDate:desc~netVal:desc&size=8'
    ),
    fetchJsonWithTimeout(
      'https://api-finfo.vndirect.com.vn/v4/foreigns?q=type:STOCK~floor:HOSE&sort=tradingDate:desc~netVal:asc&size=8'
    ),
  ]);

  const mapLeader = (r) => ({
    symbol: String(r.code || ''),
    tradingDate: String(r.tradingDate || ''),
    netValBillionVnd: parseFloat(((Number(r.netVal) || 0) / 1e9).toFixed(2)),
    buyValBillionVnd: parseFloat(((Number(r.buyVal) || 0) / 1e9).toFixed(2)),
    sellValBillionVnd: parseFloat(((Number(r.sellVal) || 0) / 1e9).toFixed(2)),
    netVol: Math.round(Number(r.netVol) || 0),
  });

  const topBuy = (Array.isArray(buyJson?.data) ? buyJson.data : [])
    .filter((r) => Number(r.netVal) > 0 && String(r.code || '').length === 3)
    .slice(0, 8)
    .map(mapLeader);

  const topSell = (Array.isArray(sellJson?.data) ? sellJson.data : [])
    .filter((r) => Number(r.netVal) < 0 && String(r.code || '').length === 3)
    .slice(0, 8)
    .map(mapLeader);

  const tradingDate = topBuy[0]?.tradingDate || topSell[0]?.tradingDate || null;
  return { tradingDate, topBuy, topSell };
}

async function fetchSymbolFundamentals(symbol) {
  if (!symbol || NON_CORPORATE_SYMBOLS.has(symbol)) return null;

  const simpJson = await fetchJsonWithTimeout(
    `https://api2.simplize.vn/api/company/summary/${encodeURIComponent(symbol.toLowerCase())}`
  );
  const d = simpJson?.data;
  if (d && (d.peRatio != null || d.pbRatio != null || d.marketCap != null)) {
    const div1000 = (v) => {
      const n = toFiniteNumber(v);
      return n !== null && n > 0 ? parseFloat((n / 1000).toFixed(2)) : null;
    };
    return {
      symbol,
      companyNameVi: d.nameVi || d.name || symbol,
      industryName: d.industryActivity || d.bcEconomicSectorName || null,
      exchange: d.stockExchange ? String(d.stockExchange).toUpperCase() : null,
      peRatio: toFiniteNumber(d.peRatio) !== null ? parseFloat(Number(d.peRatio).toFixed(2)) : null,
      pbRatio: toFiniteNumber(d.pbRatio) !== null ? parseFloat(Number(d.pbRatio).toFixed(2)) : null,
      roePct: toFiniteNumber(d.roe) !== null ? parseFloat(Number(d.roe).toFixed(2)) : null,
      roaPct: toFiniteNumber(d.roa) !== null ? parseFloat(Number(d.roa).toFixed(2)) : null,
      epsVnd: toFiniteNumber(d.epsRatio) !== null ? Math.round(Number(d.epsRatio)) : null,
      marketCapTrillionVnd:
        toFiniteNumber(d.marketCap) !== null
          ? parseFloat((Number(d.marketCap) / 1e12).toFixed(2))
          : null,
      dividendYieldPct:
        toFiniteNumber(d.dividendYieldCurrent) !== null
          ? parseFloat(Number(d.dividendYieldCurrent).toFixed(2))
          : null,
      revenueGrowthQoqPct:
        toFiniteNumber(d.revenueGrowthQoq) !== null
          ? parseFloat(Number(d.revenueGrowthQoq).toFixed(2))
          : null,
      netIncomeGrowthQoqPct:
        toFiniteNumber(d.netIncomeGrowthQoq) !== null
          ? parseFloat(Number(d.netIncomeGrowthQoq).toFixed(2))
          : null,
      officialRefPrice: div1000(d.priceReferrance),
      officialCeilingPrice: div1000(d.priceCeiling),
      officialFloorPrice: div1000(d.priceFloor),
      avgVolume10d: toFiniteNumber(d.volume10dAvg) !== null ? Math.round(Number(d.volume10dAvg)) : null,
      source: 'Simplize / BCTC Doanh nghiệp',
    };
  }

  // Fallback to VNDirect official financial ratios if Simplize unavailable
  const vndJson = await fetchJsonWithTimeout(
    `https://api-finfo.vndirect.com.vn/v4/ratios/latest?filter=itemCode:51003,51006,51012,52001,52002,53030&where=code:${encodeURIComponent(
      symbol
    )}&order=reportDate`
  );
  const items = Array.isArray(vndJson?.data) ? vndJson.data : [];
  if (items.length === 0) return null;

  const byCode = {};
  for (const it of items) {
    byCode[String(it.ratioCode || it.itemCode)] = Number(it.value);
  }

  const mcRaw = byCode.MARKETCAP ?? byCode['51003'];
  const peRaw = byCode.PRICE_TO_EARNINGS ?? byCode['51006'];
  const pbRaw = byCode.PRICE_TO_BOOK ?? byCode['51012'];
  const roeRaw = byCode.ROAE_TR_AVG5Q ?? byCode['52001'];

  return {
    symbol,
    companyNameVi: symbol,
    industryName: null,
    exchange: null,
    peRatio: Number.isFinite(peRaw) ? parseFloat(peRaw.toFixed(2)) : null,
    pbRatio: Number.isFinite(pbRaw) ? parseFloat(pbRaw.toFixed(2)) : null,
    roePct: Number.isFinite(roeRaw) ? parseFloat((roeRaw * 100).toFixed(2)) : null,
    roaPct: null,
    epsVnd: null,
    marketCapTrillionVnd: Number.isFinite(mcRaw) ? parseFloat((mcRaw / 1e12).toFixed(2)) : null,
    dividendYieldPct: null,
    revenueGrowthQoqPct: null,
    netIncomeGrowthQoqPct: null,
    officialRefPrice: null,
    officialCeilingPrice: null,
    officialFloorPrice: null,
    avgVolume10d: null,
    source: 'VNDirect Finfo Official Ratios',
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const rawSym = typeof req.query?.symbol === 'string' ? req.query.symbol.trim().toUpperCase() : 'FPT';
  const cleanSym = rawSym.replace(/\.VN$/i, '');

  const [foreignFlow, marketLeaders, fundamentals] = await Promise.all([
    fetchSymbolForeignFlow(cleanSym),
    fetchMarketForeignLeaders(),
    fetchSymbolFundamentals(cleanSym),
  ]);

  const sourcesUsed = [];
  if (foreignFlow || marketLeaders.topBuy.length > 0) sourcesUsed.push('VNDirect/VSD Foreign Flow');
  if (fundamentals?.source) sourcesUsed.push(fundamentals.source);

  return res.status(200).json({
    ok: true,
    fetchedAtMs: Date.now(),
    symbol: cleanSym,
    sourcesUsed,
    foreignFlow,
    marketLeaders,
    fundamentals,
  });
}
