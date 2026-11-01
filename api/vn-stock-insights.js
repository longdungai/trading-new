/**
 * Vercel Serverless Function: Vietnam Stock Institutional Insights (/api/vn-stock-insights)
 * Fetches 100% authentic, live Vietnam Stock Market data from official public feeds:
 * 1. VNDirect Finfo (`api-finfo.vndirect.com.vn/v4/foreigns`):
 *    - 10-session Foreign Investor Buy / Sell / Net Value (VND) & Volume + Remaining Foreign Room
 *    - Market-wide Top Foreign Net Buy & Top Foreign Net Sell leaders across HOSE
 * 2. VNDirect Finfo (`api-finfo.vndirect.com.vn/v4/stock_prices`):
 *    - Official Matched Liquidity (`nmVolume`, `nmValue`) + Institutional Put-Through Block Trades (`ptVolume`, `ptValue`) + Session VWAP (`average`)
 *    - Market-wide Top HOSE Put-Through Block Deals (> 15 Billion VND)
 * 3. VNDirect Finfo (`api-finfo.vndirect.com.vn/v4/events`):
 *    - Shareholder Rights & Corporate Action Calendar (`Ngày GDKHQ / Ex-Date`, Cash/Stock Dividends, Rights Issues, Additional Share Listings, AGM)
 * 4. Simplize Company Summary (`api2.simplize.vn/api/company/summary/<symbol>`) + VNDirect `ratios/latest`:
 *    - Live P/E, P/B, ROE %, ROA %, EPS, Market Cap (VND), Dividend Yield %, Official Ref / Ceiling / Floor
 *
 * Strictly zero fabricated numbers. Non-corporate tickers (VNINDEX, VN30, VN30F1M) return null corporate fields cleanly.
 */

const NON_CORPORATE_SYMBOLS = new Set([
  'VNINDEX',
  'VN30',
  'HNXINDEX',
  'UPCOMINDEX',
  'VN30F1M',
  'VN30F2M',
]);

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

function getVnIsoDateOffset(daysOffset = 0) {
  const vnNowMs = Date.now() + 7 * 3600 * 1000 + daysOffset * 86400 * 1000;
  return new Date(vnNowMs).toISOString().slice(0, 10);
}

function diffCalendarDaysFromVnToday(targetDateStr) {
  if (!targetDateStr || typeof targetDateStr !== 'string') return null;
  const clean = targetDateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const todayStr = getVnIsoDateOffset(0);
  const tTarget = Date.parse(`${clean}T00:00:00Z`);
  const tToday = Date.parse(`${todayStr}T00:00:00Z`);
  if (!Number.isFinite(tTarget) || !Number.isFinite(tToday)) return null;
  return Math.round((tTarget - tToday) / 86400000);
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
    sessions: sessions.slice().reverse(),
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

async function fetchSymbolLiquidityAndPutThrough(symbol) {
  if (!symbol || NON_CORPORATE_SYMBOLS.has(symbol)) return null;
  const url = `https://api-finfo.vndirect.com.vn/v4/stock_prices?q=code:${encodeURIComponent(
    symbol
  )}&sort=date:desc&size=5`;
  const json = await fetchJsonWithTimeout(url);
  const rows = Array.isArray(json?.data) ? json.data : [];
  if (rows.length === 0) return null;

  const r0 = rows[0];
  const nmVolume = Math.round(Number(r0.nmVolume) || 0);
  const nmValueBillionVnd = parseFloat(((Number(r0.nmValue) || 0) / 1e9).toFixed(2));
  const ptVolume = Math.round(Number(r0.ptVolume) || 0);
  const ptValueBillionVnd = parseFloat(((Number(r0.ptValue) || 0) / 1e9).toFixed(2));
  const totalVal = nmValueBillionVnd + ptValueBillionVnd;
  const ptSharePct =
    totalVal > 0 ? parseFloat(((ptValueBillionVnd / totalVal) * 100).toFixed(1)) : 0;

  const total5dPtBillionVnd = parseFloat(
    rows.reduce((sum, r) => sum + (Number(r.ptValue) || 0) / 1e9, 0).toFixed(2)
  );

  return {
    symbol,
    latestDate: String(r0.date || ''),
    floor: String(r0.floor || 'HOSE'),
    nmVolume,
    nmValueBillionVnd,
    ptVolume,
    ptValueBillionVnd,
    ptSharePct,
    total5dPtBillionVnd,
    vwapPrice: toFiniteNumber(r0.average) ? parseFloat(Number(r0.average).toFixed(2)) : null,
    officialRefPrice: toFiniteNumber(r0.basicPrice)
      ? parseFloat(Number(r0.basicPrice).toFixed(2))
      : null,
    officialCeilingPrice: toFiniteNumber(r0.ceilingPrice)
      ? parseFloat(Number(r0.ceilingPrice).toFixed(2))
      : null,
    officialFloorPrice: toFiniteNumber(r0.floorPrice)
      ? parseFloat(Number(r0.floorPrice).toFixed(2))
      : null,
  };
}

async function fetchMarketPutThroughLeaders() {
  const url =
    'https://api-finfo.vndirect.com.vn/v4/stock_prices?q=type:STOCK~floor:HOSE~ptValue:gt:15000000000&sort=date:desc~ptValue:desc&size=12';
  const json = await fetchJsonWithTimeout(url);
  const rows = Array.isArray(json?.data) ? json.data : [];
  if (rows.length === 0) return [];

  const latestDate = String(rows[0].date || '');
  return rows
    .filter((r) => String(r.date || '') === latestDate && String(r.code || '').length === 3)
    .slice(0, 6)
    .map((r) => {
      const ptVolume = Math.round(Number(r.ptVolume) || 0);
      const ptValueBillionVnd = parseFloat(((Number(r.ptValue) || 0) / 1e9).toFixed(2));
      const impliedPtPrice =
        ptVolume > 0 ? parseFloat(((Number(r.ptValue) || 0) / ptVolume / 1000).toFixed(2)) : null;
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

function normalizeCorporateEventRow(r) {
  const code = String(r.code || '').toUpperCase();
  const type = String(r.type || '').toUpperCase();
  const typeDesc = String(r.typeDesc || type || 'Sự kiện quyền');
  const effectiveDate = r.effectiveDate ? String(r.effectiveDate).slice(0, 10) : null;
  const disclosureDate = r.disclosureDate ? String(r.disclosureDate).slice(0, 10) : null;
  const actualDate = r.actualDate ? String(r.actualDate).slice(0, 10) : null;

  const daysToExDate = effectiveDate ? diffCalendarDaysFromVnToday(effectiveDate) : null;
  // Filter out 10-year ESOP lockup placeholders (> 200 days in future)
  if (daysToExDate !== null && daysToExDate > 200) return null;

  const isRightsAction =
    type.includes('DIV') || type.includes('ISSUE') || typeDesc.toLowerCase().includes('cổ tức') || typeDesc.toLowerCase().includes('phát hành');

  const isSupplyListing =
    type.includes('LISTED') || typeDesc.toLowerCase().includes('bổ sung');

  const isImminentExDateWarning =
    isRightsAction && daysToExDate !== null && daysToExDate >= 0 && daysToExDate <= 6;

  let riskHint = null;
  if (isImminentExDateWarning) {
    riskHint =
      type.includes('ISSUE') || type.includes('KIND') || type.includes('STOCK')
        ? `⚠️ Còn ${daysToExDate} ngày tới GDKHQ: Lưu ý rủi ro chôn vốn CP thưởng/phát hành thêm 3–6 tháng!`
        : `⚠️ Còn ${daysToExDate} ngày tới GDKHQ: Lưu ý điều chỉnh giá tham chiếu & thuế cổ tức tiền 5%!`;
  } else if (isSupplyListing) {
    riskHint = '📦 Cổ phiếu phát hành/thưởng niêm yết bổ sung — chú ý áp lực cung chốt lời ngắn hạn.';
  }

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
    cashDividendVnd: toFiniteNumber(r.dividend),
    ratioPct: toFiniteNumber(r.ratio),
    isImminentExDateWarning,
    riskHint,
  };
}

async function fetchCorporateEventsBundle(symbol) {
  const todayStr = getVnIsoDateOffset(0);
  const futureStr = getVnIsoDateOffset(50);

  const [symEventsJson, mktEventsJson] = await Promise.all([
    symbol && !NON_CORPORATE_SYMBOLS.has(symbol)
      ? fetchJsonWithTimeout(
          `https://api-finfo.vndirect.com.vn/v4/events?q=locale:VN~code:${encodeURIComponent(
            symbol
          )}&sort=disclosureDate:desc&size=8`
        )
      : Promise.resolve(null),
    fetchJsonWithTimeout(
      `https://api-finfo.vndirect.com.vn/v4/events?q=locale:VN~effectiveDate:gte:${todayStr}~effectiveDate:lte:${futureStr}&sort=effectiveDate:asc&size=24`
    ),
  ]);

  const symbolEvents = (Array.isArray(symEventsJson?.data) ? symEventsJson.data : [])
    .map(normalizeCorporateEventRow)
    .filter(Boolean)
    .slice(0, 5);

  const upcomingMarketEvents = (Array.isArray(mktEventsJson?.data) ? mktEventsJson.data : [])
    .filter((r) => String(r.code || '').length === 3)
    .map(normalizeCorporateEventRow)
    .filter(
      (ev) =>
        ev &&
        (ev.eventType.includes('DIV') ||
          ev.eventType.includes('ISSUE') ||
          ev.typeLabelVi.toLowerCase().includes('cổ tức') ||
          ev.typeLabelVi.toLowerCase().includes('phát hành'))
    )
    .slice(0, 8);

  return { symbolEvents, upcomingMarketEvents };
}

async function fetchSymbolFundamentals(symbol) {
  if (!symbol || NON_CORPORATE_SYMBOLS.has(symbol)) return null;

  const simpJson = await fetchJsonWithTimeout(
    `https://api2.simplize.vn/api/company/summary/${encodeURIComponent(symbol.toLowerCase())}`
  );
  const d = simpJson?.data;
  if (d && (d.peRatio != null || d.pbRatio != null || d.marketCap != null)) {
    const refK = toFiniteNumber(d.priceReferrance);
    const ceilK = toFiniteNumber(d.priceCeiling);
    const floorK = toFiniteNumber(d.priceFloor);

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
      officialRefPrice: refK && refK > 0 ? parseFloat((refK / 1000).toFixed(2)) : null,
      officialCeilingPrice: ceilK && ceilK > 0 ? parseFloat((ceilK / 1000).toFixed(2)) : null,
      officialFloorPrice: floorK && floorK > 0 ? parseFloat((floorK / 1000).toFixed(2)) : null,
      avgVolume10d: toFiniteNumber(d.volume10dAvg) !== null ? Math.round(Number(d.volume10dAvg)) : null,
      source: 'Simplize / BCTC Doanh nghiệp',
    };
  }

  // Fallback to VNDirect Finfo ratios/latest
  const vndJson = await fetchJsonWithTimeout(
    `https://api-finfo.vndirect.com.vn/v4/ratios/latest?filter=itemCode:51003,51006,51012,53005,53003&where=code:${encodeURIComponent(
      symbol
    )}&order=reportDate`
  );
  const arr = Array.isArray(vndJson?.data) ? vndJson.data : [];
  if (arr.length === 0) return null;

  const byCode = {};
  for (const item of arr) {
    if (item?.itemCode && Number.isFinite(Number(item.value))) {
      byCode[String(item.itemCode)] = Number(item.value);
    }
  }

  return {
    symbol,
    companyNameVi: symbol,
    industryName: null,
    exchange: null,
    peRatio: byCode['51006'] ? parseFloat(byCode['51006'].toFixed(2)) : null,
    pbRatio: byCode['51012'] ? parseFloat(byCode['51012'].toFixed(2)) : null,
    roePct: byCode['53005'] ? parseFloat((byCode['53005'] * 100).toFixed(2)) : null,
    roaPct: byCode['53003'] ? parseFloat((byCode['53003'] * 100).toFixed(2)) : null,
    epsVnd: null,
    marketCapTrillionVnd: byCode['51003'] ? parseFloat((byCode['51003'] / 1e12).toFixed(2)) : null,
    dividendYieldPct: null,
    revenueGrowthQoqPct: null,
    netIncomeGrowthQoqPct: null,
    officialRefPrice: null,
    officialCeilingPrice: null,
    officialFloorPrice: null,
    avgVolume10d: null,
    source: 'VNDirect Finfo / BCTC',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawSymbol = String(req.query?.symbol || 'FPT')
    .trim()
    .toUpperCase()
    .replace(/\.VN$/i, '');

  const [
    foreignFlow,
    marketLeaders,
    fundamentals,
    liquidityAndPt,
    marketPutThroughLeaders,
    eventsBundle,
  ] = await Promise.all([
    fetchSymbolForeignFlow(rawSymbol),
    fetchMarketForeignLeaders(),
    fetchSymbolFundamentals(rawSymbol),
    fetchSymbolLiquidityAndPutThrough(rawSymbol),
    fetchMarketPutThroughLeaders(),
    fetchCorporateEventsBundle(rawSymbol),
  ]);

  // Enrich officialRefPrice / Ceiling / Floor on fundamentals if Simplize didn't return them
  const mergedFundamentals = fundamentals
    ? {
        ...fundamentals,
        officialRefPrice:
          fundamentals.officialRefPrice ?? liquidityAndPt?.officialRefPrice ?? null,
        officialCeilingPrice:
          fundamentals.officialCeilingPrice ?? liquidityAndPt?.officialCeilingPrice ?? null,
        officialFloorPrice:
          fundamentals.officialFloorPrice ?? liquidityAndPt?.officialFloorPrice ?? null,
      }
    : null;

  const sourcesUsed = [];
  if (foreignFlow || marketLeaders.topBuy.length > 0) sourcesUsed.push('VNDirect/VSD Foreign Flow');
  if (liquidityAndPt || marketPutThroughLeaders.length > 0) {
    sourcesUsed.push('HOSE/VNDirect Put-Through & VWAP');
  }
  if (eventsBundle.symbolEvents.length > 0 || eventsBundle.upcomingMarketEvents.length > 0) {
    sourcesUsed.push('VSD/VNDirect Corporate Rights');
  }
  if (mergedFundamentals) sourcesUsed.push(mergedFundamentals.source);

  return res.status(200).json({
    ok: true,
    fetchedAtMs: Date.now(),
    symbol: rawSymbol,
    sourcesUsed,
    foreignFlow,
    marketLeaders,
    fundamentals: mergedFundamentals,
    liquidityAndPt,
    marketPutThroughLeaders,
    corporateEvents: eventsBundle.symbolEvents,
    upcomingMarketEvents: eventsBundle.upcomingMarketEvents,
  });
}
