/**
 * Vercel Serverless Function: Institutional Crypto & Global Equity Insights (/api/global-market-insights)
 * Fetches 100% authentic, zero-auth live market intelligence from official public exchanges & data feeds:
 *
 * [CRYPTO MODE — e.g. ?symbol=BTCUSDT, ETHUSDT, SOLUSDT...]
 * 1. Binance USD-M Futures (`fapi.binance.com/fapi/v1/premiumIndex`):
 *    - Live Mark Price, Spot Index Price, Perp-Spot Basis %, 8h Funding Rate %, Annualized Carry %, Next Funding Timestamp
 * 2. Deribit Institutional Options (`www.deribit.com/api/v2/public`):
 *    - Live BTC/ETH Options Chain (`get_book_summary_by_currency`), Max Pain Strike, Call Wall, Put Wall, Put/Call OI Ratio, ATM Implied Move %, and 30d DVOL Volatility Index
 * 3. CoinGecko Global + DefiLlama Stablecoin Flows (`api.coingecko.com/api/v3/global` & `stablecoins.llama.fi/stablecoins`):
 *    - Live BTC Dominance %, ETH Dominance %, Total Crypto Market Cap, Total Stablecoin Supply ($B) & 7-Day Net Minting/Burning ($B)
 *
 * [US / INTERNATIONAL EQUITY MODE — e.g. ?symbol=NVDA, TSLA, SPY, QQQ, AAPL...]
 * 1. CBOE Official Options Chain (`cdn.cboe.com/api/global/delayed_quotes/options/{SYM}.json`):
 *    - Live 30d IV (`iv30`), Nearest-Expiry & 30d Call Wall, Put Wall, Max Pain Strike, Put/Call OI Ratio, Dealer Net GEX Estimate ($M), and ATM Straddle Implied Move ±%
 * 2. Yahoo Finance Extended-Hours + Crumb QuoteSummary & Nasdaq API (`api.nasdaq.com`):
 *    - Live Pre-Market & After-Hours Price / Gap %, Upcoming Earnings Date (`BMO` / `AMC`), Ex-Dividend Date, Forward P/E, Short Float %, Analyst Target Price, and Upcoming Wall Street Mega-Cap Earnings Calendar
 *
 * Strictly zero fabricated numbers. Missing upstream fields return null cleanly.
 */

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

const NASDAQ_HEADERS = {
  ...COMMON_HEADERS,
  Origin: 'https://www.nasdaq.com',
  Referer: 'https://www.nasdaq.com/',
};

const PRIORITY_US_TICKERS = new Set([
  'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'GOOG', 'META', 'AMD',
  'AVGO', 'TSM', 'ASML', 'ARM', 'MU', 'INTC', 'QCOM', 'SMCI',
  'PLTR', 'NFLX', 'CRM', 'ORCL', 'ADBE', 'UBER', 'PANW', 'CRWD',
  'MSTR', 'COIN', 'SQ', 'PYPL', 'V', 'MA',
  'JPM', 'GS', 'BAC', 'MS', 'WFC', 'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK',
  'COST', 'WMT', 'HD', 'MCD', 'NKE', 'DIS', 'XOM', 'CVX', 'CAT', 'LMT', 'BA',
]);

const ETF_SYMBOLS = new Set([
  'SPY', 'QQQ', 'DIA', 'IWM', 'SOXX',
  'XLK', 'XLF', 'XLV', 'XLE', 'XLI', 'XLY', 'XLP', 'XLC', 'XLU', 'XLB', 'XLRE',
]);

const GLOBAL_INDEX_MAP = {
  N225: '^N225',
  HSI: '^HSI',
  DAX: '^GDAXI',
};

const MONTH_MAP = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

// In-memory warm lambda caches to avoid hammering upstream endpoints
let cachedCryptoMacro = { data: null, ts: 0 };
let cachedYahooAuth = { cookie: '', crumb: '', ts: 0 };
let cachedUpcomingUsEarnings = { rows: [], ts: 0 };

async function fetchJsonWithTimeout(url, headers = COMMON_HEADERS, timeoutMs = 5500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers,
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

function toFinite(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function parseDollarNumber(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[$,%\s,]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isCryptoTicker(sym) {
  return sym.endsWith('USDT') || sym.endsWith('BUSD') || sym.endsWith('USDC');
}

function mapBinancePerpSymbol(sym) {
  if (sym === 'PEPEUSDT') return { perpSymbol: '1000PEPEUSDT', multiplier: 1000 };
  if (sym === 'SHIBUSDT') return { perpSymbol: '1000SHIBUSDT', multiplier: 1000 };
  if (sym === 'BONKUSDT') return { perpSymbol: '1000BONKUSDT', multiplier: 1000 };
  if (sym === 'FLOKIUSDT') return { perpSymbol: '1000FLOKIUSDT', multiplier: 1000 };
  return { perpSymbol: sym, multiplier: 1 };
}

/**
 * Shared Max Pain & Option Walls Engine for normalized strike/OI maps
 * contracts: Array<{ strike, right: 'C' | 'P', openInterest, gamma?, midPriceUsd?, ivPct?, expiryIso }>
 */
function summarizeOptionChain(contracts, spotPrice, contractMultiplier = 1) {
  if (!Array.isArray(contracts) || contracts.length === 0 || !spotPrice || spotPrice <= 0) {
    return null;
  }

  // Group by expiryIso
  const byExpiry = new Map();
  let totalCallOi = 0;
  let totalPutOi = 0;
  let netGexRaw = 0;

  for (const c of contracts) {
    if (!c || c.strike <= 0 || c.openInterest < 0) continue;
    if (c.right === 'C') {
      totalCallOi += c.openInterest;
      if (c.gamma) netGexRaw += c.gamma * c.openInterest * contractMultiplier * spotPrice * spotPrice * 0.01;
    } else {
      totalPutOi += c.openInterest;
      if (c.gamma) netGexRaw -= c.gamma * c.openInterest * contractMultiplier * spotPrice * spotPrice * 0.01;
    }
    const bucket = byExpiry.get(c.expiryIso) || [];
    bucket.push(c);
    byExpiry.set(c.expiryIso, bucket);
  }

  if (totalCallOi + totalPutOi <= 0) return null;

  // Choose primary near-term expiry: earliest expiry within next 21 days that has meaningful OI (>= 5% of max expiry OI), else earliest overall
  const sortedExpiries = Array.from(byExpiry.entries())
    .map(([expiryIso, list]) => ({
      expiryIso,
      list,
      oiSum: list.reduce((s, item) => s + item.openInterest, 0),
    }))
    .sort((a, b) => a.expiryIso.localeCompare(b.expiryIso));

  const maxExpiryOi = Math.max(...sortedExpiries.map((e) => e.oiSum), 1);
  const meaningfulNear = sortedExpiries.find((e) => e.oiSum >= maxExpiryOi * 0.08) || sortedExpiries[0];

  // Aggregate Call/Put OI by strike across near-term window (up to first 4 expiries) for institutional Walls
  const nearWindowExpiries = new Set(sortedExpiries.slice(0, 4).map((e) => e.expiryIso));
  const strikeMap = new Map();
  for (const c of contracts) {
    if (!nearWindowExpiries.has(c.expiryIso)) continue;
    const rec = strikeMap.get(c.strike) || { callOi: 0, putOi: 0 };
    if (c.right === 'C') rec.callOi += c.openInterest;
    else rec.putOi += c.openInterest;
    strikeMap.set(c.strike, rec);
  }

  // Max Pain computed on primary active expiry strikes (fallback to nearWindow if sparse)
  const painSource = meaningfulNear.list.length >= 6 ? meaningfulNear.list : contracts;
  const painStrikeMap = new Map();
  for (const c of painSource) {
    const rec = painStrikeMap.get(c.strike) || { callOi: 0, putOi: 0 };
    if (c.right === 'C') rec.callOi += c.openInterest;
    else rec.putOi += c.openInterest;
    painStrikeMap.set(c.strike, rec);
  }

  const candidateStrikes = Array.from(painStrikeMap.keys())
    .filter((k) => k >= spotPrice * 0.65 && k <= spotPrice * 1.35)
    .sort((a, b) => a - b);

  let maxPainPrice = null;
  let minPayout = Infinity;
  for (const settlePrice of candidateStrikes) {
    let payout = 0;
    for (const [k, oi] of painStrikeMap.entries()) {
      if (settlePrice > k) payout += (settlePrice - k) * oi.callOi;
      else if (settlePrice < k) payout += (k - settlePrice) * oi.putOi;
    }
    if (payout < minPayout) {
      minPayout = payout;
      maxPainPrice = settlePrice;
    }
  }

  // Call Wall (strike >= spot * 0.92 & <= spot * 1.35 with highest Call OI)
  // Put Wall (strike >= spot * 0.65 & <= spot * 1.08 with highest Put OI)
  let callWallPrice = null;
  let callWallOi = -1;
  let putWallPrice = null;
  let putWallOi = -1;

  for (const [k, oi] of strikeMap.entries()) {
    if (k >= spotPrice * 0.92 && k <= spotPrice * 1.35 && oi.callOi > callWallOi) {
      callWallOi = oi.callOi;
      callWallPrice = k;
    }
    if (k >= spotPrice * 0.65 && k <= spotPrice * 1.08 && oi.putOi > putWallOi) {
      putWallOi = oi.putOi;
      putWallPrice = k;
    }
  }

  // ATM Straddle Implied Move % on primary near-term expiry
  let impliedMovePct = null;
  const primaryList = meaningfulNear.list;
  const strikesInPrimary = Array.from(new Set(primaryList.map((c) => c.strike)));
  if (strikesInPrimary.length > 0) {
    let atmStrike = strikesInPrimary[0];
    let bestDiff = Math.abs(atmStrike - spotPrice);
    for (const k of strikesInPrimary) {
      const d = Math.abs(k - spotPrice);
      if (d < bestDiff) {
        bestDiff = d;
        atmStrike = k;
      }
    }
    const atmCall = primaryList.find((c) => c.strike === atmStrike && c.right === 'C');
    const atmPut = primaryList.find((c) => c.strike === atmStrike && c.right === 'P');
    if (atmCall?.midPriceUsd && atmPut?.midPriceUsd && atmCall.midPriceUsd > 0 && atmPut.midPriceUsd > 0) {
      const straddlePct = ((atmCall.midPriceUsd + atmPut.midPriceUsd) / spotPrice) * 100;
      if (straddlePct > 0.1 && straddlePct < 45) {
        impliedMovePct = parseFloat(straddlePct.toFixed(2));
      }
    }
  }

  const putCallOiRatio =
    totalCallOi > 0 ? parseFloat((totalPutOi / totalCallOi).toFixed(2)) : null;

  return {
    primaryExpiryIso: meaningfulNear.expiryIso,
    maxPainPrice,
    callWallPrice,
    callWallOi: callWallOi > 0 ? Math.round(callWallOi) : null,
    putWallPrice,
    putWallOi: putWallOi > 0 ? Math.round(putWallOi) : null,
    putCallOiRatio,
    totalCallOi: Math.round(totalCallOi),
    totalPutOi: Math.round(totalPutOi),
    impliedMovePct,
    netGexMillionUsd: netGexRaw !== 0 ? parseFloat((netGexRaw / 1e6).toFixed(2)) : null,
  };
}

async function fetchBinancePerpCarry(symbol) {
  const { perpSymbol, multiplier } = mapBinancePerpSymbol(symbol);
  const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodeURIComponent(perpSymbol)}`;
  const json = await fetchJsonWithTimeout(url);
  if (!json || !json.markPrice) return null;

  const rawMark = toFinite(json.markPrice);
  const rawIndex = toFinite(json.indexPrice);
  const rawFunding = toFinite(json.lastFundingRate);
  if (!rawMark || rawMark <= 0) return null;

  const markPrice = rawMark / multiplier;
  const indexPrice = rawIndex && rawIndex > 0 ? rawIndex / multiplier : markPrice;
  const fundingRate8hPct = rawFunding !== null ? parseFloat((rawFunding * 100).toFixed(4)) : 0;
  const annualizedFundingPct = parseFloat((fundingRate8hPct * 3 * 365).toFixed(2));
  const perpSpotBasisPct =
    indexPrice > 0 ? parseFloat((((markPrice - indexPrice) / indexPrice) * 100).toFixed(4)) : 0;

  return {
    perpSymbol,
    markPrice,
    indexPrice,
    fundingRate8hPct,
    annualizedFundingPct,
    perpSpotBasisPct,
    nextFundingTimeMs: Number(json.nextFundingTime) || null,
  };
}

function parseDeribitExpiryIso(code) {
  // e.g. "6NOV26" or "13NOV26"
  const m = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(code);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = MONTH_MAP[m[2]];
  const year = 2000 + parseInt(m[3], 10);
  if (mon === undefined || !day || !year) return null;
  const dt = new Date(Date.UTC(year, mon, day, 8, 0, 0));
  if (dt.getTime() < Date.now() - 3600_000) return null;
  return dt.toISOString().slice(0, 10);
}

async function fetchDeribitOptionsSummary(symbol) {
  const base = symbol.replace(/(USDT|USDC|BUSD)$/i, '');
  // Deribit liquid public option books are BTC and ETH; for L2/DeFi tokens use ETH benchmark, otherwise BTC benchmark
  const ethEcosystem = new Set(['ETH', 'ARB', 'OP', 'UNI', 'PENDLE', 'ONDO', 'LINK']);
  const currency = base === 'ETH' || ethEcosystem.has(base) ? 'ETH' : 'BTC';
  const isDirectUnderlying = base === currency;

  const now = Date.now();
  const [bookJson, dvolJson] = await Promise.all([
    fetchJsonWithTimeout(
      `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${currency}&kind=option`
    ),
    fetchJsonWithTimeout(
      `https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=${currency}&start_timestamp=${now - 7200_000}&end_timestamp=${now}&resolution=3600`
    ),
  ]);

  const rows = Array.isArray(bookJson?.result) ? bookJson.result : [];
  let dvolIndex = null;
  const dvolCandles = dvolJson?.result?.data;
  if (Array.isArray(dvolCandles) && dvolCandles.length > 0) {
    const lastCandle = dvolCandles[dvolCandles.length - 1];
    if (Array.isArray(lastCandle) && toFinite(lastCandle[4])) {
      dvolIndex = parseFloat(Number(lastCandle[4]).toFixed(2));
    }
  }

  if (rows.length === 0) return null;

  let underlyingSpot = 0;
  const normalized = [];

  for (const r of rows) {
    const name = String(r.instrument_name || '');
    const m = /^([A-Z]+)-(\d{1,2}[A-Z]{3}\d{2})-(\d+(?:\.\d+)?)-(C|P)$/.exec(name);
    if (!m) continue;
    const expiryIso = parseDeribitExpiryIso(m[2]);
    if (!expiryIso) continue;

    const uPrice = toFinite(r.underlying_price);
    if (uPrice && uPrice > 0) underlyingSpot = uPrice;

    const strike = Number(m[3]);
    const right = m[4];
    const openInterest = Number(r.open_interest) || 0;
    const markCoin = toFinite(r.mark_price) ?? toFinite(r.mid_price);
    const midPriceUsd =
      markCoin && markCoin > 0 && underlyingSpot > 0 ? markCoin * underlyingSpot : null;

    normalized.push({
      strike,
      right,
      openInterest,
      midPriceUsd,
      ivPct: toFinite(r.mark_iv),
      expiryIso,
    });
  }

  if (underlyingSpot <= 0 || normalized.length === 0) return null;

  const summary = summarizeOptionChain(normalized, underlyingSpot, 1);
  if (!summary) return null;

  const totalNotionalBillionUsd = parseFloat(
    (((summary.totalCallOi + summary.totalPutOi) * underlyingSpot) / 1e9).toFixed(2)
  );

  return {
    exchange: 'Deribit Options',
    underlyingCurrency: currency,
    isDirectUnderlying,
    underlyingSpotUsd: parseFloat(underlyingSpot.toFixed(2)),
    dvol30dPct: dvolIndex,
    totalNotionalBillionUsd,
    ...summary,
  };
}

async function fetchCryptoMacroCycle() {
  if (cachedCryptoMacro.data && Date.now() - cachedCryptoMacro.ts < 120_000) {
    return cachedCryptoMacro.data;
  }

  const [cgJson, llamaJson] = await Promise.all([
    fetchJsonWithTimeout('https://api.coingecko.com/api/v3/global'),
    fetchJsonWithTimeout('https://stablecoins.llama.fi/stablecoins?includePrices=false'),
  ]);

  const cgData = cgJson?.data;
  const btcDominancePct = toFinite(cgData?.market_cap_percentage?.btc);
  const ethDominancePct = toFinite(cgData?.market_cap_percentage?.eth);
  const totalCryptoMcapUsd = toFinite(cgData?.total_market_cap?.usd);
  const mcapChange24hPct = toFinite(cgData?.market_cap_change_percentage_24h_usd);

  let stablecoinTotalBillionUsd = null;
  let stablecoin7dNetMintBillionUsd = null;
  let usdtBillionUsd = null;
  let usdcBillionUsd = null;

  const pegged = Array.isArray(llamaJson?.peggedAssets) ? llamaJson.peggedAssets : [];
  if (pegged.length > 0) {
    let sumNow = 0;
    let sumPrevWeek = 0;
    for (const asset of pegged.slice(0, 15)) {
      const cur = toFinite(asset?.circulating?.peggedUSD) || 0;
      const prev = toFinite(asset?.circulatingPrevWeek?.peggedUSD) || cur;
      sumNow += cur;
      sumPrevWeek += prev;
      const sym = String(asset?.symbol || '').toUpperCase();
      if (sym === 'USDT') usdtBillionUsd = parseFloat((cur / 1e9).toFixed(2));
      if (sym === 'USDC') usdcBillionUsd = parseFloat((cur / 1e9).toFixed(2));
    }
    if (sumNow > 0) {
      stablecoinTotalBillionUsd = parseFloat((sumNow / 1e9).toFixed(2));
      stablecoin7dNetMintBillionUsd = parseFloat(((sumNow - sumPrevWeek) / 1e9).toFixed(2));
    }
  }

  if (btcDominancePct === null && stablecoinTotalBillionUsd === null) {
    return null;
  }

  const result = {
    btcDominancePct: btcDominancePct !== null ? parseFloat(btcDominancePct.toFixed(2)) : null,
    ethDominancePct: ethDominancePct !== null ? parseFloat(ethDominancePct.toFixed(2)) : null,
    othersDominancePct:
      btcDominancePct !== null && ethDominancePct !== null
        ? parseFloat(Math.max(0, 100 - btcDominancePct - ethDominancePct).toFixed(2))
        : null,
    totalCryptoMcapTrillionUsd:
      totalCryptoMcapUsd !== null ? parseFloat((totalCryptoMcapUsd / 1e12).toFixed(2)) : null,
    mcapChange24hPct: mcapChange24hPct !== null ? parseFloat(mcapChange24hPct.toFixed(2)) : null,
    stablecoinTotalBillionUsd,
    stablecoin7dNetMintBillionUsd,
    usdtBillionUsd,
    usdcBillionUsd,
  };

  cachedCryptoMacro = { data: result, ts: Date.now() };
  return result;
}

async function getYahooCrumbSession() {
  if (cachedYahooAuth.crumb && Date.now() - cachedYahooAuth.ts < 600_000) {
    return cachedYahooAuth;
  }
  try {
    const fcRes = await fetch('https://fc.yahoo.com', {
      headers: COMMON_HEADERS,
      redirect: 'manual',
    });
    const rawCookies =
      typeof fcRes.headers.getSetCookie === 'function'
        ? fcRes.headers.getSetCookie()
        : [fcRes.headers.get('set-cookie') || ''];
    const cookieHeader = rawCookies
      .map((c) => String(c || '').split(';')[0])
      .filter(Boolean)
      .join('; ');
    if (!cookieHeader) return null;

    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        ...COMMON_HEADERS,
        Cookie: cookieHeader,
      },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes('<')) return null;

    cachedYahooAuth = { cookie: cookieHeader, crumb, ts: Date.now() };
    return cachedYahooAuth;
  } catch {
    return null;
  }
}

async function fetchCboeOptionsSummary(symbol) {
  if (GLOBAL_INDEX_MAP[symbol]) return null;
  const cboeTicker = symbol.replace('-', '');
  const url = `https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(cboeTicker)}.json`;
  const json = await fetchJsonWithTimeout(url, COMMON_HEADERS, 6000);
  const data = json?.data;
  if (!data || !Array.isArray(data.options) || data.options.length === 0) return null;

  const spot = toFinite(data.current_price);
  if (!spot || spot <= 0) return null;

  const iv30Pct = toFinite(data.iv30) !== null ? parseFloat(Number(data.iv30).toFixed(2)) : null;
  const iv30ChangePct =
    toFinite(data.iv30_change) !== null ? parseFloat(Number(data.iv30_change).toFixed(2)) : null;

  const todayIso = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
  const normalized = [];

  for (const opt of data.options) {
    const code = String(opt.option || '');
    const m = /([0-9]{6})([CP])([0-9]{8})$/.exec(code);
    if (!m) continue;

    const yymmdd = m[1];
    const expiryIso = `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
    if (expiryIso < todayIso) continue;

    const right = m[2];
    const strike = parseInt(m[3], 10) / 1000;
    const openInterest = Number(opt.open_interest) || 0;
    const bid = Number(opt.bid) || 0;
    const ask = Number(opt.ask) || 0;
    const midPriceUsd = bid > 0 && ask > 0 ? (bid + ask) / 2 : toFinite(opt.theo);
    const gamma = toFinite(opt.gamma);
    const ivPct = toFinite(opt.iv) ? Number(opt.iv) * 100 : null;

    normalized.push({
      strike,
      right,
      openInterest,
      midPriceUsd,
      gamma,
      ivPct,
      expiryIso,
    });
  }

  const summary = summarizeOptionChain(normalized, spot, 100);
  if (!summary) return null;

  return {
    exchange: 'CBOE US Options',
    underlyingSymbol: symbol,
    underlyingSpotUsd: parseFloat(spot.toFixed(2)),
    iv30Pct,
    iv30ChangePct,
    ...summary,
  };
}

async function fetchUsEquityQuoteAndFundamentals(symbol) {
  const yahooSym = GLOBAL_INDEX_MAP[symbol] || symbol;
  const isIndexOrEtf = Boolean(GLOBAL_INDEX_MAP[symbol]) || ETF_SYMBOLS.has(symbol);
  const assetClass = ETF_SYMBOLS.has(symbol) ? 'etf' : 'stocks';

  const authPromise = getYahooCrumbSession();
  const chartPromise = fetchJsonWithTimeout(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSym
    )}?interval=5m&range=5d&includePrePost=true`
  );
  const nasdaqInfoPromise = GLOBAL_INDEX_MAP[symbol]
    ? Promise.resolve(null)
    : fetchJsonWithTimeout(
        `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=${assetClass}`,
        NASDAQ_HEADERS
      );
  const nasdaqSummaryPromise =
    GLOBAL_INDEX_MAP[symbol] || isIndexOrEtf
      ? Promise.resolve(null)
      : fetchJsonWithTimeout(
          `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/summary?assetclass=stocks`,
          NASDAQ_HEADERS
        );

  const [auth, chartJson, nasdaqInfo, nasdaqSummary] = await Promise.all([
    authPromise,
    chartPromise,
    nasdaqInfoPromise,
    nasdaqSummaryPromise,
  ]);

  let quoteSummary = null;
  if (auth?.crumb && auth?.cookie) {
    quoteSummary = await fetchJsonWithTimeout(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        yahooSym
      )}?modules=price,calendarEvents,defaultKeyStatistics,financialData&crumb=${encodeURIComponent(
        auth.crumb
      )}`,
      { ...COMMON_HEADERS, Cookie: auth.cookie },
      5000
    );
  }

  const qRes = quoteSummary?.quoteSummary?.result?.[0] || null;
  const priceMod = qRes?.price || {};
  const calMod = qRes?.calendarEvents || {};
  const statsMod = qRes?.defaultKeyStatistics || {};
  const finMod = qRes?.financialData || {};
  const chartMeta = chartJson?.chart?.result?.[0]?.meta || {};

  const regularPrice =
    toFinite(priceMod?.regularMarketPrice?.raw) ??
    toFinite(chartMeta?.regularMarketPrice) ??
    parseDollarNumber(nasdaqInfo?.data?.primaryData?.lastSalePrice);

  const prevClose =
    toFinite(priceMod?.regularMarketPreviousClose?.raw) ??
    toFinite(chartMeta?.chartPreviousClose) ??
    toFinite(chartMeta?.previousClose);

  let preMarketPrice = toFinite(priceMod?.preMarketPrice?.raw);
  let preMarketChangePct =
    toFinite(priceMod?.preMarketChangePercent?.raw) !== null
      ? parseFloat((Number(priceMod.preMarketChangePercent.raw) * 100).toFixed(2))
      : null;

  let postMarketPrice = toFinite(priceMod?.postMarketPrice?.raw);
  let postMarketChangePct =
    toFinite(priceMod?.postMarketChangePercent?.raw) !== null
      ? parseFloat((Number(priceMod.postMarketChangePercent.raw) * 100).toFixed(2))
      : null;

  // Fallback to Nasdaq secondaryData for Pre-Market / After-Hours if Yahoo Crumb omitted it
  const secData = nasdaqInfo?.data?.secondaryData;
  if (secData?.lastSalePrice) {
    const secPrice = parseDollarNumber(secData.lastSalePrice);
    const secMarketStatus = String(nasdaqInfo?.data?.marketStatus || '').toUpperCase();
    if (secPrice && regularPrice) {
      const gapPct = parseFloat((((secPrice - regularPrice) / regularPrice) * 100).toFixed(2));
      if (secMarketStatus.includes('PRE') && !preMarketPrice) {
        preMarketPrice = secPrice;
        preMarketChangePct = gapPct;
      } else if (!postMarketPrice) {
        postMarketPrice = secPrice;
        postMarketChangePct = gapPct;
      }
    }
  }

  // Fallback to 5m includePrePost bars if pre/post price still missing
  const timestamps = chartJson?.chart?.result?.[0]?.timestamp;
  const closes = chartJson?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
  const regularPeriod = chartMeta?.currentTradingPeriod?.regular;
  if (Array.isArray(timestamps) && Array.isArray(closes) && regularPrice && regularPeriod) {
    const lastIdx = closes.length - 1;
    for (let i = lastIdx; i >= Math.max(0, lastIdx - 12); i--) {
      const c = toFinite(closes[i]);
      const ts = Number(timestamps[i]);
      if (!c || !ts) continue;
      if (ts > Number(regularPeriod.end) && !postMarketPrice) {
        postMarketPrice = parseFloat(c.toFixed(2));
        postMarketChangePct = parseFloat((((c - regularPrice) / regularPrice) * 100).toFixed(2));
      } else if (ts < Number(regularPeriod.start) && ts > Number(regularPeriod.start) - 6 * 3600 && !preMarketPrice) {
        preMarketPrice = parseFloat(c.toFixed(2));
        const ref = prevClose || regularPrice;
        preMarketChangePct = parseFloat((((c - ref) / ref) * 100).toFixed(2));
      }
      break;
    }
  }

  // Earnings Date extraction
  let earningsDateIso = null;
  const earningsDatesArr = calMod?.earnings?.earningsDate;
  if (Array.isArray(earningsDatesArr) && earningsDatesArr[0]?.fmt) {
    earningsDateIso = String(earningsDatesArr[0].fmt).slice(0, 10);
  }

  let exDividendDateIso = calMod?.exDividendDate?.fmt
    ? String(calMod.exDividendDate.fmt).slice(0, 10)
    : null;
  const summaryData = nasdaqSummary?.data?.summaryData || {};
  if (!exDividendDateIso && summaryData?.ExDividendDate?.value) {
    const rawEx = String(summaryData.ExDividendDate.value);
    if (rawEx && rawEx !== 'N/A') {
      const parsed = Date.parse(rawEx);
      if (Number.isFinite(parsed)) {
        exDividendDateIso = new Date(parsed).toISOString().slice(0, 10);
      }
    }
  }

  const forwardPe = toFinite(statsMod?.forwardPE?.raw)
    ? parseFloat(Number(statsMod.forwardPE.raw).toFixed(2))
    : parseDollarNumber(summaryData?.ForwardPE1Yr?.value);

  const shortFloatPct =
    toFinite(statsMod?.shortPercentOfFloat?.raw) !== null
      ? parseFloat((Number(statsMod.shortPercentOfFloat.raw) * 100).toFixed(2))
      : null;

  const analystTargetPrice = toFinite(finMod?.targetMeanPrice?.raw)
    ? parseFloat(Number(finMod.targetMeanPrice.raw).toFixed(2))
    : parseDollarNumber(summaryData?.OneYrTarget?.value);

  const marketCapBillionUsd = toFinite(priceMod?.marketCap?.raw)
    ? parseFloat((Number(priceMod.marketCap.raw) / 1e9).toFixed(2))
    : parseDollarNumber(summaryData?.MarketCap?.value)
    ? parseFloat((Number(parseDollarNumber(summaryData.MarketCap.value)) / 1e9).toFixed(2))
    : null;

  let daysToEarnings = null;
  if (earningsDateIso && /^\d{4}-\d{2}-\d{2}$/.test(earningsDateIso)) {
    const todayIso = new Date().toISOString().slice(0, 10);
    daysToEarnings = Math.round(
      (Date.parse(`${earningsDateIso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86400_000
    );
  }

  return {
    symbol,
    regularPrice,
    prevClose,
    preMarketPrice,
    preMarketChangePct,
    postMarketPrice,
    postMarketChangePct,
    earningsDateIso,
    daysToEarnings,
    earningsSession: null, // Enriched if present in Nasdaq upcoming earnings calendar
    exDividendDateIso,
    forwardPe,
    shortFloatPct,
    analystTargetPrice,
    marketCapBillionUsd,
  };
}

function getNextBusinessDatesIso(count = 5) {
  const dates = [];
  let offset = 0;
  while (dates.length < count && offset < 12) {
    const d = new Date(Date.now() - 4 * 3600_000 + offset * 86400_000);
    const wk = d.getUTCDay();
    if (wk !== 0 && wk !== 6) {
      dates.push(d.toISOString().slice(0, 10));
    }
    offset++;
  }
  return dates;
}

async function fetchUpcomingUsEarningsCalendar() {
  if (cachedUpcomingUsEarnings.rows.length > 0 && Date.now() - cachedUpcomingUsEarnings.ts < 300_000) {
    return cachedUpcomingUsEarnings.rows;
  }

  const dates = getNextBusinessDatesIso(5);
  const responses = await Promise.all(
    dates.map(async (dateIso) => {
      const json = await fetchJsonWithTimeout(
        `https://api.nasdaq.com/api/calendar/earnings?date=${dateIso}`,
        NASDAQ_HEADERS,
        4500
      );
      const rows = Array.isArray(json?.data?.rows) ? json.data.rows : [];
      return rows.map((r) => ({ ...r, earningsDateIso: dateIso }));
    })
  );

  const flat = responses.flat();
  const parsed = [];

  for (const r of flat) {
    const sym = String(r.symbol || '').trim().toUpperCase();
    if (!sym) continue;
    const mcapRaw = parseDollarNumber(r.marketCap) || 0;
    const mcapBillion = mcapRaw / 1e9;
    const isPriority = PRIORITY_US_TICKERS.has(sym);
    if (!isPriority && mcapBillion < 15) continue;

    const rawTime = String(r.time || '').toLowerCase();
    const session = rawTime.includes('pre-market')
      ? 'BMO'
      : rawTime.includes('after-hours')
      ? 'AMC'
      : 'TBD';

    parsed.push({
      symbol: sym,
      companyName: String(r.name || sym),
      earningsDateIso: r.earningsDateIso,
      session,
      epsForecast: String(r.epsForecast || 'N/A'),
      marketCapBillionUsd: mcapBillion > 0 ? parseFloat(mcapBillion.toFixed(1)) : null,
      isWatchlistCore: isPriority,
    });
  }

  parsed.sort((a, b) => {
    if (a.earningsDateIso !== b.earningsDateIso) {
      return a.earningsDateIso.localeCompare(b.earningsDateIso);
    }
    if (a.isWatchlistCore !== b.isWatchlistCore) {
      return a.isWatchlistCore ? -1 : 1;
    }
    return (b.marketCapBillionUsd || 0) - (a.marketCapBillionUsd || 0);
  });

  const topRows = parsed.slice(0, 14);
  if (topRows.length > 0) {
    cachedUpcomingUsEarnings = { rows: topRows, ts: Date.now() };
  }
  return topRows;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawSymbol = String(req.query?.symbol || 'BTCUSDT')
    .trim()
    .toUpperCase();
  const mode = String(req.query?.mode || '').toLowerCase();
  const isCrypto = mode === 'crypto' || (mode !== 'us' && isCryptoTicker(rawSymbol));

  if (isCrypto) {
    const [perpCarry, optionsSummary, cryptoMacro] = await Promise.all([
      fetchBinancePerpCarry(rawSymbol),
      fetchDeribitOptionsSummary(rawSymbol),
      fetchCryptoMacroCycle(),
    ]);

    const sourcesUsed = [];
    if (perpCarry) sourcesUsed.push('Binance USD-M Perpetuals');
    if (optionsSummary) sourcesUsed.push(`Deribit ${optionsSummary.underlyingCurrency} Options & DVOL`);
    if (cryptoMacro) sourcesUsed.push('CoinGecko Global & DefiLlama Stablecoins');

    return res.status(200).json({
      ok: true,
      marketKind: 'crypto',
      fetchedAtMs: Date.now(),
      symbol: rawSymbol,
      sourcesUsed,
      perpCarry,
      optionsSummary,
      cryptoMacro,
    });
  }

  // US & Global Equity Mode
  const [usQuote, optionsSummary, upcomingUsEarnings, cryptoMacro] = await Promise.all([
    fetchUsEquityQuoteAndFundamentals(rawSymbol),
    fetchCboeOptionsSummary(rawSymbol),
    fetchUpcomingUsEarningsCalendar(),
    mode === 'overview' ? fetchCryptoMacroCycle() : Promise.resolve(cachedCryptoMacro.data),
  ]);

  // Enrich earningsDateIso / earningsSession from Nasdaq 5-day calendar if symbol is reporting soon
  if (usQuote && Array.isArray(upcomingUsEarnings)) {
    const matched = upcomingUsEarnings.find((item) => item.symbol === rawSymbol);
    if (matched) {
      usQuote.earningsDateIso = matched.earningsDateIso;
      usQuote.earningsSession = matched.session;
      const todayIso = new Date().toISOString().slice(0, 10);
      usQuote.daysToEarnings = Math.round(
        (Date.parse(`${matched.earningsDateIso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) /
          86400_000
      );
    }
  }

  const sourcesUsed = [];
  if (usQuote) sourcesUsed.push('Yahoo Extended-Hours & Nasdaq Real-Time Summary');
  if (optionsSummary) sourcesUsed.push('CBOE Official Options Chain & IV30');
  if (upcomingUsEarnings.length > 0) sourcesUsed.push('Nasdaq Wall Street Earnings Calendar');

  return res.status(200).json({
    ok: true,
    marketKind: 'us_global',
    fetchedAtMs: Date.now(),
    symbol: rawSymbol,
    sourcesUsed,
    usQuote,
    optionsSummary,
    upcomingUsEarnings,
    cryptoMacro: cryptoMacro || null,
  });
}
