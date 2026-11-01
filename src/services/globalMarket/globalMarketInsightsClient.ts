import {
  ComputedOptionsPositioning,
  LiveCryptoMacroData,
  LiveCryptoPerpCarry,
  LiveUsQuoteData,
  NormalizedOptionContract,
  computeOptionsWallsAndMaxPain,
  isCryptoSymbol,
  parseCboeOccContract,
  parseDeribitContract,
} from './globalExecutionEngines';

export interface CryptoOptionsSummary extends ComputedOptionsPositioning {
  exchange: string;
  underlyingCurrency: 'BTC' | 'ETH';
  isDirectUnderlying: boolean;
  underlyingSpotUsd: number;
  dvol30dPct: number | null;
  totalNotionalBillionUsd: number | null;
}

export interface UsOptionsSummary extends ComputedOptionsPositioning {
  exchange: string;
  underlyingSymbol: string;
  underlyingSpotUsd: number;
  iv30Pct: number | null;
  iv30ChangePct: number | null;
}

export interface UpcomingUsEarningsItem {
  symbol: string;
  companyName: string;
  earningsDateIso: string;
  session: 'BMO' | 'AMC' | 'TBD';
  epsForecast: string;
  marketCapBillionUsd: number | null;
  isWatchlistCore: boolean;
}

export interface GlobalMarketInsightsResponse {
  ok: boolean;
  marketKind: 'crypto' | 'us_global';
  fetchedAtMs: number;
  symbol: string;
  sourcesUsed: string[];
  perpCarry: LiveCryptoPerpCarry | null;
  usQuote: LiveUsQuoteData | null;
  optionsSummary: CryptoOptionsSummary | UsOptionsSummary | null;
  cryptoMacro: LiveCryptoMacroData | null;
  upcomingUsEarnings: UpcomingUsEarningsItem[];
}

const CACHE_TTL_MS = 45_000;
export const GLOBAL_INSIGHTS_UPDATED_EVENT = 'trading_new_global_insights_updated';
const symbolInsightsCache = new Map<string, { data: GlobalMarketInsightsResponse; ts: number }>();
const inFlightRequests = new Map<string, Promise<GlobalMarketInsightsResponse | null>>();

let latestCryptoMacroCache: LiveCryptoMacroData | null = null;
let latestUpcomingUsEarningsCache: UpcomingUsEarningsItem[] = [];

export function getCachedGlobalInsights(symbol: string): GlobalMarketInsightsResponse | null {
  const key = symbol.trim().toUpperCase();
  return symbolInsightsCache.get(key)?.data ?? null;
}

export function getCachedCryptoMacro(): LiveCryptoMacroData | null {
  return latestCryptoMacroCache;
}

export function getCachedUpcomingUsEarnings(): UpcomingUsEarningsItem[] {
  return latestUpcomingUsEarningsCache;
}

async function fetchJsonSafe(url: string, timeoutMs: number = 5500): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function enrichGammaFields<T extends Record<string, any>>(
  raw: T | null,
  spotFallback: number
): (T & ComputedOptionsPositioning) | null {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.gammaRegime && raw.gammaHeadlineVi) {
    return raw as T & ComputedOptionsPositioning;
  }

  const netGex = typeof raw.netGexMillionUsd === 'number' ? raw.netGexMillionUsd : null;
  const pc = typeof raw.putCallOiRatio === 'number' ? raw.putCallOiRatio : null;

  let gammaRegime: ComputedOptionsPositioning['gammaRegime'] = 'BALANCED';
  let gammaHeadlineVi = 'Cấu trúc Gamma cân bằng quanh vùng giá giao ngay';
  let actionableNoteVi =
    'Theo dõi phản ứng giá tại Call Wall (kháng cự quyền chọn) và Put Wall (đệm đỡ quyền chọn).';

  if ((netGex !== null && netGex > 15) || (pc !== null && pc <= 0.78)) {
    gammaRegime = 'POSITIVE_GAMMA_PIN';
    gammaHeadlineVi = 'Gamma Dương (Positive GEX) — Market Maker hãm biên độ & hút về Max Pain';
    actionableNoteVi =
      'Dealer phòng vệ ngược chiều biến động (bán khi tăng chạm Call Wall, mua đỡ ở Put Wall).';
  } else if ((netGex !== null && netGex < -10) || (pc !== null && pc >= 1.25)) {
    gammaRegime = 'NEGATIVE_GAMMA_ACCELERATION';
    gammaHeadlineVi = 'Gamma Âm / Put OI cao — Biến động dễ khuếch đại mạnh khi thủng Put Wall';
    actionableNoteVi =
      'Dealer phải phòng vệ thuận xu hướng nếu giá xuyên thủng Put Wall hoặc bứt phá Call Wall.';
  }

  return {
    ...raw,
    primaryExpiryIso: String(raw.primaryExpiryIso || ''),
    maxPainPrice: typeof raw.maxPainPrice === 'number' ? raw.maxPainPrice : spotFallback || null,
    callWallPrice: typeof raw.callWallPrice === 'number' ? raw.callWallPrice : null,
    callWallOi: typeof raw.callWallOi === 'number' ? raw.callWallOi : null,
    putWallPrice: typeof raw.putWallPrice === 'number' ? raw.putWallPrice : null,
    putWallOi: typeof raw.putWallOi === 'number' ? raw.putWallOi : null,
    putCallOiRatio: pc,
    totalCallOi: Number(raw.totalCallOi) || 0,
    totalPutOi: Number(raw.totalPutOi) || 0,
    impliedMovePct: typeof raw.impliedMovePct === 'number' ? raw.impliedMovePct : null,
    netGexMillionUsd: netGex,
    gammaRegime,
    gammaHeadlineVi,
    actionableNoteVi,
  } as T & ComputedOptionsPositioning;
}

async function fetchDirectViteFallback(symbol: string): Promise<GlobalMarketInsightsResponse | null> {
  const upper = symbol.trim().toUpperCase();
  const cryptoMode = isCryptoSymbol(upper);

  if (cryptoMode) {
    const perpSym =
      upper === 'PEPEUSDT'
        ? '1000PEPEUSDT'
        : upper === 'SHIBUSDT'
        ? '1000SHIBUSDT'
        : upper;
    const mult = perpSym.startsWith('1000') ? 1000 : 1;
    const baseCoin = upper.replace(/(USDT|USDC|BUSD)$/i, '');
    const ethEco = new Set(['ETH', 'ARB', 'OP', 'UNI', 'PENDLE', 'ONDO', 'LINK']);
    const optCurrency: 'BTC' | 'ETH' = baseCoin === 'ETH' || ethEco.has(baseCoin) ? 'ETH' : 'BTC';
    const now = Date.now();

    const [fapiJson, deribitBook, deribitDvol, cgJson, llamaJson] = await Promise.all([
      fetchJsonSafe(`/api/fapi/fapi/v1/premiumIndex?symbol=${encodeURIComponent(perpSym)}`),
      fetchJsonSafe(
        `/api/deribit/api/v2/public/get_book_summary_by_currency?currency=${optCurrency}&kind=option`
      ),
      fetchJsonSafe(
        `/api/deribit/api/v2/public/get_volatility_index_data?currency=${optCurrency}&start_timestamp=${now - 7200_000}&end_timestamp=${now}&resolution=3600`
      ),
      latestCryptoMacroCache
        ? Promise.resolve(null)
        : fetchJsonSafe('/api/coingecko/api/v3/global'),
      latestCryptoMacroCache
        ? Promise.resolve(null)
        : fetchJsonSafe('/api/llama/stablecoins?includePrices=false'),
    ]);

    let perpCarry: LiveCryptoPerpCarry | null = null;
    if (fapiJson?.markPrice) {
      const markPrice = Number(fapiJson.markPrice) / mult;
      const indexPrice = (Number(fapiJson.indexPrice) || Number(fapiJson.markPrice)) / mult;
      const fundingRate8hPct = parseFloat(((Number(fapiJson.lastFundingRate) || 0) * 100).toFixed(4));
      perpCarry = {
        perpSymbol: perpSym,
        markPrice,
        indexPrice,
        fundingRate8hPct,
        annualizedFundingPct: parseFloat((fundingRate8hPct * 3 * 365).toFixed(2)),
        perpSpotBasisPct:
          indexPrice > 0
            ? parseFloat((((markPrice - indexPrice) / indexPrice) * 100).toFixed(4))
            : 0,
        nextFundingTimeMs: Number(fapiJson.nextFundingTime) || null,
      };
    }

    let optionsSummary: CryptoOptionsSummary | null = null;
    const bookRows = Array.isArray(deribitBook?.result) ? deribitBook.result : [];
    if (bookRows.length > 0) {
      let underlyingSpot = 0;
      const todayIso = new Date().toISOString().slice(0, 10);
      const contracts: NormalizedOptionContract[] = [];

      for (const r of bookRows) {
        const parsed = parseDeribitContract(String(r.instrument_name || ''));
        if (!parsed || parsed.expiryIso < todayIso) continue;
        const uSpot = Number(r.underlying_price) || 0;
        if (uSpot > 0) underlyingSpot = uSpot;
        const markCoin = Number(r.mark_price) || Number(r.mid_price) || 0;
        contracts.push({
          strike: parsed.strike,
          right: parsed.right,
          openInterest: Number(r.open_interest) || 0,
          midPriceUsd: markCoin > 0 && underlyingSpot > 0 ? markCoin * underlyingSpot : null,
          ivPct: Number(r.mark_iv) || null,
          expiryIso: parsed.expiryIso,
        });
      }

      const dvolData = deribitDvol?.result?.data;
      const dvol30dPct =
        Array.isArray(dvolData) && dvolData.length > 0
          ? parseFloat((Number(dvolData[dvolData.length - 1]?.[4]) || 0).toFixed(2)) || null
          : null;

      const computed = computeOptionsWallsAndMaxPain(contracts, underlyingSpot, 1);
      if (computed && underlyingSpot > 0) {
        optionsSummary = {
          exchange: 'Deribit Options',
          underlyingCurrency: optCurrency,
          isDirectUnderlying: baseCoin === optCurrency,
          underlyingSpotUsd: parseFloat(underlyingSpot.toFixed(2)),
          dvol30dPct,
          totalNotionalBillionUsd: parseFloat(
            (((computed.totalCallOi + computed.totalPutOi) * underlyingSpot) / 1e9).toFixed(2)
          ),
          ...computed,
        };
      }
    }

    let cryptoMacro = latestCryptoMacroCache;
    if (!cryptoMacro && (cgJson?.data || Array.isArray(llamaJson?.peggedAssets))) {
      const btcDom = Number(cgJson?.data?.market_cap_percentage?.btc) || null;
      const ethDom = Number(cgJson?.data?.market_cap_percentage?.eth) || null;
      const totalMcap = Number(cgJson?.data?.total_market_cap?.usd) || null;
      const mcapChg = Number(cgJson?.data?.market_cap_change_percentage_24h_usd) || null;

      let sumNow = 0;
      let sumPrev = 0;
      let usdtB = null;
      let usdcB = null;
      const assets = Array.isArray(llamaJson?.peggedAssets) ? llamaJson.peggedAssets : [];
      for (const a of assets.slice(0, 15)) {
        const cur = Number(a?.circulating?.peggedUSD) || 0;
        const prv = Number(a?.circulatingPrevWeek?.peggedUSD) || cur;
        sumNow += cur;
        sumPrev += prv;
        if (a?.symbol === 'USDT') usdtB = parseFloat((cur / 1e9).toFixed(2));
        if (a?.symbol === 'USDC') usdcB = parseFloat((cur / 1e9).toFixed(2));
      }

      cryptoMacro = {
        btcDominancePct: btcDom ? parseFloat(btcDom.toFixed(2)) : null,
        ethDominancePct: ethDom ? parseFloat(ethDom.toFixed(2)) : null,
        othersDominancePct:
          btcDom && ethDom ? parseFloat(Math.max(0, 100 - btcDom - ethDom).toFixed(2)) : null,
        totalCryptoMcapTrillionUsd: totalMcap ? parseFloat((totalMcap / 1e12).toFixed(2)) : null,
        mcapChange24hPct: mcapChg !== null ? parseFloat(mcapChg.toFixed(2)) : null,
        stablecoinTotalBillionUsd: sumNow > 0 ? parseFloat((sumNow / 1e9).toFixed(2)) : null,
        stablecoin7dNetMintBillionUsd:
          sumNow > 0 ? parseFloat(((sumNow - sumPrev) / 1e9).toFixed(2)) : null,
        usdtBillionUsd: usdtB,
        usdcBillionUsd: usdcB,
      };
      latestCryptoMacroCache = cryptoMacro;
    }

    const sourcesUsed: string[] = [];
    if (perpCarry) sourcesUsed.push('Binance USD-M Perpetuals');
    if (optionsSummary) sourcesUsed.push(`Deribit ${optCurrency} Options & DVOL`);
    if (cryptoMacro) sourcesUsed.push('CoinGecko & DefiLlama');

    return {
      ok: true,
      marketKind: 'crypto',
      fetchedAtMs: Date.now(),
      symbol: upper,
      sourcesUsed,
      perpCarry,
      usQuote: null,
      optionsSummary,
      cryptoMacro,
      upcomingUsEarnings: latestUpcomingUsEarningsCache,
    };
  }

  // US & Global Equity fallback via Vite proxies
  const yahooSym =
    upper === 'N225' ? '^N225' : upper === 'HSI' ? '^HSI' : upper === 'DAX' ? '^GDAXI' : upper;
  const isGlobalIdx = yahooSym.startsWith('^');
  const todayIso = new Date().toISOString().slice(0, 10);

  const [cboeJson, chartJson, nasdaqInfo, nasdaqEarnings] = await Promise.all([
    isGlobalIdx
      ? Promise.resolve(null)
      : fetchJsonSafe(
          `/api/cboe/api/global/delayed_quotes/options/${encodeURIComponent(
            upper.replace('-', '')
          )}.json`
        ),
    fetchJsonSafe(
      `/api/yahoo/v8/finance/chart/${encodeURIComponent(
        yahooSym
      )}?interval=5m&range=5d&includePrePost=true`
    ),
    isGlobalIdx
      ? Promise.resolve(null)
      : fetchJsonSafe(`/api/nasdaq/api/quote/${encodeURIComponent(upper)}/info?assetclass=stocks`),
    latestUpcomingUsEarningsCache.length > 0
      ? Promise.resolve(null)
      : fetchJsonSafe(`/api/nasdaq/api/calendar/earnings?date=${todayIso}`),
  ]);

  let optionsSummary: UsOptionsSummary | null = null;
  const cboeData = cboeJson?.data;
  if (cboeData && Array.isArray(cboeData.options) && Number(cboeData.current_price) > 0) {
    const spot = Number(cboeData.current_price);
    const contracts: NormalizedOptionContract[] = [];
    for (const opt of cboeData.options) {
      const parsed = parseCboeOccContract(String(opt.option || ''));
      if (!parsed || parsed.expiryIso < todayIso) continue;
      const bid = Number(opt.bid) || 0;
      const ask = Number(opt.ask) || 0;
      contracts.push({
        strike: parsed.strike,
        right: parsed.right,
        openInterest: Number(opt.open_interest) || 0,
        midPriceUsd: bid > 0 && ask > 0 ? (bid + ask) / 2 : Number(opt.theo) || null,
        gamma: Number(opt.gamma) || null,
        ivPct: Number(opt.iv) ? Number(opt.iv) * 100 : null,
        expiryIso: parsed.expiryIso,
      });
    }
    const computed = computeOptionsWallsAndMaxPain(contracts, spot, 100);
    if (computed) {
      optionsSummary = {
        exchange: 'CBOE US Options',
        underlyingSymbol: upper,
        underlyingSpotUsd: parseFloat(spot.toFixed(2)),
        iv30Pct: Number(cboeData.iv30) ? parseFloat(Number(cboeData.iv30).toFixed(2)) : null,
        iv30ChangePct: Number(cboeData.iv30_change)
          ? parseFloat(Number(cboeData.iv30_change).toFixed(2))
          : null,
        ...computed,
      };
    }
  }

  const meta = chartJson?.chart?.result?.[0]?.meta || {};
  const regularPrice = Number(meta.regularMarketPrice) || null;
  const prevClose = Number(meta.chartPreviousClose) || null;

  let preMarketPrice: number | null = null;
  let preMarketChangePct: number | null = null;
  let postMarketPrice: number | null = null;
  let postMarketChangePct: number | null = null;

  const secPriceRaw = String(nasdaqInfo?.data?.secondaryData?.lastSalePrice || '').replace(
    /[$,\s]/g,
    ''
  );
  const secPrice = Number(secPriceRaw) || null;
  if (secPrice && regularPrice) {
    const mStatus = String(nasdaqInfo?.data?.marketStatus || '').toUpperCase();
    const gap = parseFloat((((secPrice - regularPrice) / regularPrice) * 100).toFixed(2));
    if (mStatus.includes('PRE')) {
      preMarketPrice = secPrice;
      preMarketChangePct = gap;
    } else {
      postMarketPrice = secPrice;
      postMarketChangePct = gap;
    }
  }

  let upcomingRows = latestUpcomingUsEarningsCache;
  if (Array.isArray(nasdaqEarnings?.data?.rows)) {
    upcomingRows = nasdaqEarnings.data.rows
      .slice(0, 12)
      .map((r: any): UpcomingUsEarningsItem => ({
        symbol: String(r.symbol || '').toUpperCase(),
        companyName: String(r.name || r.symbol || ''),
        earningsDateIso: todayIso,
        session: String(r.time || '').includes('pre-market')
          ? 'BMO'
          : String(r.time || '').includes('after-hours')
          ? 'AMC'
          : 'TBD',
        epsForecast: String(r.epsForecast || 'N/A'),
        marketCapBillionUsd: null,
        isWatchlistCore: true,
      }))
      .filter((r: UpcomingUsEarningsItem) => Boolean(r.symbol));
    latestUpcomingUsEarningsCache = upcomingRows;
  }

  const matchedEarn = upcomingRows.find((r) => r.symbol === upper);

  const usQuote: LiveUsQuoteData = {
    symbol: upper,
    regularPrice,
    prevClose,
    preMarketPrice,
    preMarketChangePct,
    postMarketPrice,
    postMarketChangePct,
    earningsDateIso: matchedEarn?.earningsDateIso ?? null,
    daysToEarnings: matchedEarn ? 0 : null,
    earningsSession: matchedEarn?.session ?? null,
    exDividendDateIso: null,
    forwardPe: null,
    shortFloatPct: null,
    analystTargetPrice: null,
    marketCapBillionUsd: null,
  };

  const sourcesUsed: string[] = [];
  if (regularPrice) sourcesUsed.push('Yahoo Extended-Hours & Nasdaq');
  if (optionsSummary) sourcesUsed.push('CBOE Official Options Chain');

  return {
    ok: true,
    marketKind: 'us_global',
    fetchedAtMs: Date.now(),
    symbol: upper,
    sourcesUsed,
    perpCarry: null,
    usQuote,
    optionsSummary,
    cryptoMacro: latestCryptoMacroCache,
    upcomingUsEarnings: upcomingRows,
  };
}

export async function fetchGlobalMarketInsights(
  symbol: string,
  forceRefresh: boolean = false
): Promise<GlobalMarketInsightsResponse | null> {
  const key = symbol.trim().toUpperCase();
  if (!key) return null;

  const cached = symbolInsightsCache.get(key);
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const existing = inFlightRequests.get(key);
  if (existing) return existing;

  const task = (async (): Promise<GlobalMarketInsightsResponse | null> => {
    try {
      const apiJson = await fetchJsonSafe(
        `/api/global-market-insights?symbol=${encodeURIComponent(key)}`,
        6500
      );

      let normalized: GlobalMarketInsightsResponse | null = null;

      if (apiJson && apiJson.ok) {
        const spotHint =
          apiJson.perpCarry?.markPrice ||
          apiJson.usQuote?.regularPrice ||
          apiJson.optionsSummary?.underlyingSpotUsd ||
          0;
        const enrichedOptions = enrichGammaFields(apiJson.optionsSummary, spotHint);

        normalized = {
          ok: true,
          marketKind: apiJson.marketKind === 'crypto' ? 'crypto' : 'us_global',
          fetchedAtMs: Number(apiJson.fetchedAtMs) || Date.now(),
          symbol: key,
          sourcesUsed: Array.isArray(apiJson.sourcesUsed) ? apiJson.sourcesUsed : [],
          perpCarry: apiJson.perpCarry || null,
          usQuote: apiJson.usQuote || null,
          optionsSummary: enrichedOptions as CryptoOptionsSummary | UsOptionsSummary | null,
          cryptoMacro: apiJson.cryptoMacro || latestCryptoMacroCache,
          upcomingUsEarnings: Array.isArray(apiJson.upcomingUsEarnings)
            ? apiJson.upcomingUsEarnings
            : latestUpcomingUsEarningsCache,
        };
      } else {
        normalized = await fetchDirectViteFallback(key);
      }

      if (normalized) {
        if (normalized.cryptoMacro) {
          latestCryptoMacroCache = normalized.cryptoMacro;
        }
        if (normalized.upcomingUsEarnings && normalized.upcomingUsEarnings.length > 0) {
          latestUpcomingUsEarningsCache = normalized.upcomingUsEarnings;
        }
        symbolInsightsCache.set(key, { data: normalized, ts: Date.now() });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(GLOBAL_INSIGHTS_UPDATED_EVENT, { detail: { symbol: key } })
          );
        }
      }
      return normalized;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, task);
  return task;
}
