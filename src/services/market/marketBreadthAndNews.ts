import { MarketSymbol } from '../../types';

export type NewsRegionFilter = 'ALL' | 'VN' | 'GLOBAL' | 'CRYPTO' | 'CURRENT';
export type NewsSentimentFilter = 'ALL' | 'BULLISH' | 'BEARISH';

export interface MarketNewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  region: 'GLOBAL' | 'VN' | 'CRYPTO';
  publishedAtMs: number;
  publishedAtISO: string;
  assetTags: string[];
  sentimentHint: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface MarketNewsFeedResponse {
  ok: boolean;
  fetchedAtMs: number;
  activeSources: string[];
  items: MarketNewsArticle[];
}

export interface SegmentBreadthMetrics {
  segmentId: 'VN_MARKET' | 'CRYPTO' | 'GLOBAL_MACRO';
  segmentName: string;
  totalTracked: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  advancePct: number;
  avgChange24hPct: number;
  strongAboveMidRangeCount: number; // price in upper 50% of 24h High-Low range
  strongAboveMidRangePct: number;
  breadthRegime:
    | 'BROAD_THRUST'
    | 'HEALTHY_BULL'
    | 'GREEN_OUTSIDE_RED_INSIDE'
    | 'MIXED_ROTATION'
    | 'BROAD_SELL_OFF';
  breadthRegimeLabel: string;
  breadthDiagnostic: string;
  topGainers: { symbol: string; name: string; change24h: number; price: number }[];
  topLagging: { symbol: string; name: string; change24h: number; price: number }[];
}

export interface MarketBreadthSnapshot {
  computedAtMs: number;
  vnMarket: SegmentBreadthMetrics;
  cryptoMarket: SegmentBreadthMetrics;
  globalMarket: SegmentBreadthMetrics;
}

const CLIENT_TAG_RULES: Array<{ tag: string; keywords: string[] }> = [
  {
    tag: 'FED',
    keywords: [
      'fed',
      'fomc',
      'powell',
      'interest rate',
      'lãi suất',
      'cục dự trữ',
      'pce',
      'cpi',
      'inflation',
      'lạm phát',
      'nonfarm',
      'treasury',
      'yield',
    ],
  },
  {
    tag: 'XAUUSD',
    keywords: [
      'gold',
      'bullion',
      'xau',
      'paxg',
      'giá vàng',
      'vàng sjc',
      'vàng nhẫn',
      'vàng miếng',
      'kim loại quý',
    ],
  },
  {
    tag: 'USDVND',
    keywords: [
      'tỷ giá',
      'usd/vnd',
      'ngân hàng nhà nước',
      'sbv',
      'đôla',
      'ngoại hối',
      'dxy',
      'tín phiếu',
    ],
  },
  {
    tag: 'BTCUSDT',
    keywords: ['bitcoin', 'btc', 'etf crypto', 'spot etf', 'ibit', 'halving', 'satoshi'],
  },
  {
    tag: 'ETHUSDT',
    keywords: ['ethereum', 'eth', 'ether', 'vitalik', 'defi', 'layer 2', 'staking'],
  },
  {
    tag: 'SOLUSDT',
    keywords: ['solana', 'sol ', 'raydium', 'jupiter'],
  },
  {
    tag: 'BNBUSDT',
    keywords: ['binance', 'bnb', 'bnb chain'],
  },
  {
    tag: 'VNINDEX',
    keywords: [
      'vn-index',
      'vnindex',
      'hose',
      'hnx',
      'chứng khoán',
      'cổ phiếu',
      'khối ngoại',
      'vn30',
      'thanh khoản',
      'krx',
      'nâng hạng',
    ],
  },
  {
    tag: 'OIL_WTI',
    keywords: ['oil', 'crude', 'brent', 'wti', 'opec', 'giá dầu', 'xăng dầu', 'năng lượng'],
  },
  {
    tag: 'NVDA',
    keywords: ['nvidia', 'nvda', 'semiconductor', 'ai chip', 'bán dẫn', 'blackwell'],
  },
  {
    tag: 'AAPL',
    keywords: ['apple', 'aapl', 'iphone', 'macbook'],
  },
  {
    tag: 'TSLA',
    keywords: ['tesla', 'tsla', 'elon musk', 'xe điện'],
  },
  {
    tag: 'VCB',
    keywords: ['vietcombank', 'vcb', 'tín dụng ngân hàng', 'nhóm ngân hàng', 'lãi suất huy động'],
  },
  {
    tag: 'TCB',
    keywords: ['techcombank', 'tcb', 'mbb', 'acb', 'bidv', 'vietinbank', 'ctg', 'stb', 'vpbank'],
  },
  {
    tag: 'SSI',
    keywords: ['ssi', 'vndirect', 'vnd', 'vci', 'hcm', 'công ty chứng khoán', 'margin'],
  },
  {
    tag: 'FPT',
    keywords: ['fpt', 'công nghệ việt', 'phần mềm', 'chuyển đổi số'],
  },
  {
    tag: 'HPG',
    keywords: ['hòa phát', 'hpg', 'hoa sen', 'hsg', 'nam kim', 'nkg', 'giá thép', 'ngành thép', 'đầu tư công'],
  },
  {
    tag: 'MWG',
    keywords: ['thế giới di động', 'mwg', 'bách hóa xanh', 'bán lẻ', 'masan', 'msn', 'vinamilk', 'vnm'],
  },
  {
    tag: 'VHM',
    keywords: ['vinhomes', 'vhm', 'vingroup', 'vic', 'novaland', 'nvl', 'bất động sản', 'nhà ở'],
  },
];

export function enrichArticleTagsAndSentiment(article: MarketNewsArticle): MarketNewsArticle {
  const combined = `${article.title || ''} ${article.summary || ''}`.toLowerCase();
  const tagSet = new Set<string>(
    (article.assetTags || []).map((t) => (t === 'USOIL' ? 'OIL_WTI' : t.toUpperCase()))
  );

  for (const rule of CLIENT_TAG_RULES) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      tagSet.add(rule.tag);
    }
  }

  if (tagSet.size === 0) {
    if (article.region === 'VN') tagSet.add('VNINDEX');
    else if (article.region === 'CRYPTO') tagSet.add('BTCUSDT');
    else tagSet.add('FED');
  }

  let sentimentHint = article.sentimentHint || 'NEUTRAL';
  if (sentimentHint === 'NEUTRAL') {
    const posWords = [
      'surge',
      'rally',
      'jump',
      'gain',
      'cut rate',
      'dovish',
      'beat',
      'bull',
      'inflow',
      'tăng',
      'khởi sắc',
      'bứt phá',
      'mua ròng',
      'hạ nhiệt',
      'lãi lớn',
      'kỷ lục',
      'hồi phục',
      'tích cực',
    ];
    const negWords = [
      'plunge',
      'drop',
      'slump',
      'fear',
      'recession',
      'hawkish',
      'war',
      'tariff',
      'crash',
      'outflow',
      'lao dốc',
      'bán ròng',
      'áp lực',
      'suy thoái',
      'giảm sâu',
      'bán tháo',
      'rủi ro',
    ];
    let score = 0;
    for (const w of posWords) if (combined.includes(w)) score += 1;
    for (const w of negWords) if (combined.includes(w)) score -= 1;
    if (score > 0) sentimentHint = 'BULLISH';
    else if (score < 0) sentimentHint = 'BEARISH';
  }

  return {
    ...article,
    assetTags: Array.from(tagSet).slice(0, 5),
    sentimentHint,
  };
}

/**
 * Symbol-to-keywords & related tags resolver for the "Theo <Symbol>" (CURRENT) filter
 */
export function getSymbolFilterProfile(currentSymbol: MarketSymbol): {
  primaryTags: string[];
  directKeywords: string[];
  sectorFallbackTags: string[];
  fallbackRegion: 'VN' | 'GLOBAL' | 'CRYPTO';
} {
  const sym = currentSymbol.symbol.toUpperCase();
  const nameLower = (currentSymbol.name || '').toLowerCase();

  if (sym === 'XAUUSD' || sym === 'PAXGUSDT' || sym === 'XAGUSD') {
    return {
      primaryTags: ['XAUUSD', 'PAXGUSDT'],
      directKeywords: ['gold', 'xau', 'paxg', 'bullion', 'vàng', 'kim loại quý'],
      sectorFallbackTags: ['FED', 'USDVND'],
      fallbackRegion: 'GLOBAL',
    };
  }

  if (sym === 'OIL_WTI' || sym === 'USOIL') {
    return {
      primaryTags: ['OIL_WTI', 'USOIL'],
      directKeywords: ['oil', 'crude', 'brent', 'wti', 'dầu', 'opec', 'năng lượng'],
      sectorFallbackTags: ['FED', 'GAS'],
      fallbackRegion: 'GLOBAL',
    };
  }

  if (currentSymbol.type === 'crypto' || sym.endsWith('USDT')) {
    const base = (currentSymbol.baseAsset || sym.replace('USDT', '')).toLowerCase();
    return {
      primaryTags: [sym],
      directKeywords: [base, sym.toLowerCase(), nameLower].filter((k) => k.length >= 2),
      sectorFallbackTags: ['BTCUSDT', 'ETHUSDT', 'FED'],
      fallbackRegion: 'CRYPTO',
    };
  }

  if (currentSymbol.type === 'vn30' || currentSymbol.quoteAsset === 'VND' || sym === 'VNINDEX') {
    const bankSet = new Set(['VCB', 'TCB', 'MBB', 'ACB', 'BID', 'CTG', 'STB', 'VPB', 'HDB', 'LPB', 'TPB']);
    const secSet = new Set(['SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS']);
    const steelSet = new Set(['HPG', 'HSG', 'NKG', 'VCG', 'HHV', 'CTD', 'KBC']);
    const realEstateSet = new Set(['VHM', 'VIC', 'VRE', 'NVL', 'PDR', 'DIG', 'DXG', 'NLG', 'KDH']);
    const retailSet = new Set(['MWG', 'MSN', 'VNM', 'SAB', 'PNJ', 'FRT', 'DGW']);

    const primaryTags = [sym];
    if (bankSet.has(sym)) primaryTags.push('VCB', 'TCB', 'USDVND');
    else if (secSet.has(sym)) primaryTags.push('SSI', 'VNINDEX');
    else if (steelSet.has(sym)) primaryTags.push('HPG');
    else if (realEstateSet.has(sym)) primaryTags.push('VHM');
    else if (retailSet.has(sym)) primaryTags.push('MWG');

    return {
      primaryTags,
      directKeywords: [
        sym.toLowerCase(),
        nameLower,
        ...(bankSet.has(sym) ? ['ngân hàng', 'tín dụng', 'lãi suất'] : []),
        ...(secSet.has(sym) ? ['chứng khoán', 'thanh khoản', 'krx', 'khối ngoại'] : []),
        ...(steelSet.has(sym) ? ['thép', 'hòa phát', 'đầu tư công'] : []),
        ...(realEstateSet.has(sym) ? ['bất động sản', 'vinhomes', 'vingroup', 'nhà ở'] : []),
        ...(sym === 'FPT' ? ['fpt', 'công nghệ', 'bán dẫn', 'ai'] : []),
      ].filter((k) => k.length >= 2),
      sectorFallbackTags: ['VNINDEX', 'USDVND'],
      fallbackRegion: 'VN',
    };
  }

  // US / Global Equities & Forex
  return {
    primaryTags: [sym],
    directKeywords: [sym.toLowerCase(), nameLower].filter((k) => k.length >= 2),
    sectorFallbackTags: ['FED', 'NVDA', 'AAPL', 'TSLA'],
    fallbackRegion: 'GLOBAL',
  };
}

/**
 * Pure deterministic multi-criteria news filter used by MarketNewsAndBreadthView
 */
export function filterMarketNewsArticles(params: {
  articles: MarketNewsArticle[];
  regionFilter: NewsRegionFilter;
  currentSymbol: MarketSymbol;
  sentimentFilter?: NewsSentimentFilter;
  tagFilter?: string | null;
  searchQuery?: string;
}): MarketNewsArticle[] {
  const {
    articles,
    regionFilter,
    currentSymbol,
    sentimentFilter = 'ALL',
    tagFilter = null,
    searchQuery = '',
  } = params;

  if (!Array.isArray(articles) || articles.length === 0) return [];

  // Step 1: Apply Region / Symbol tab filter
  let list: MarketNewsArticle[] = [];

  if (regionFilter === 'ALL') {
    list = [...articles];
  } else if (regionFilter === 'VN' || regionFilter === 'GLOBAL' || regionFilter === 'CRYPTO') {
    list = articles.filter((a) => a.region === regionFilter);
  } else if (regionFilter === 'CURRENT') {
    const profile = getSymbolFilterProfile(currentSymbol);
    const scored = articles
      .map((a) => {
        const textLower = `${a.title} ${a.summary}`.toLowerCase();
        const tagsUpper = a.assetTags.map((t) => t.toUpperCase());
        let score = 0;

        // Tier 1: Direct primary tag match
        if (profile.primaryTags.some((pt) => tagsUpper.includes(pt))) {
          score += 100;
        }
        // Tier 2: Direct keyword match in title/summary
        if (profile.directKeywords.some((kw) => kw && textLower.includes(kw))) {
          score += 80;
        }
        // Tier 3: Sector / Macro driver tag match within the same market region
        if (
          score === 0 &&
          a.region === profile.fallbackRegion &&
          profile.sectorFallbackTags.some((st) => tagsUpper.includes(st))
        ) {
          score += 25;
        }

        return { article: a, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.article.publishedAtMs - a.article.publishedAtMs;
      });

    // Prefer direct matches (score >= 80) if we have at least 2; otherwise include Tier 3 macro drivers (up to 8 items)
    const directMatches = scored.filter((s) => s.score >= 80).map((s) => s.article);
    list = directMatches.length >= 2 ? directMatches : scored.slice(0, 8).map((s) => s.article);
  }

  // Step 2: Apply Sentiment filter
  if (sentimentFilter !== 'ALL') {
    list = list.filter((a) => a.sentimentHint === sentimentFilter);
  }

  // Step 3: Apply Tag filter (if clicked on a #TAG pill)
  if (tagFilter && tagFilter.trim()) {
    const cleanTag = tagFilter.trim().toUpperCase();
    list = list.filter((a) =>
      a.assetTags.some((t) => t.toUpperCase() === cleanTag || t.toUpperCase().includes(cleanTag))
    );
  }

  // Step 4: Apply Keyword search query
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter((a) => {
      const hay = `${a.title} ${a.summary} ${a.source} ${a.assetTags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }

  return list;
}

export function computeNewsFilterCounts(
  articles: MarketNewsArticle[],
  currentSymbol: MarketSymbol
): Record<NewsRegionFilter, number> {
  return {
    ALL: filterMarketNewsArticles({ articles, regionFilter: 'ALL', currentSymbol }).length,
    VN: filterMarketNewsArticles({ articles, regionFilter: 'VN', currentSymbol }).length,
    GLOBAL: filterMarketNewsArticles({ articles, regionFilter: 'GLOBAL', currentSymbol }).length,
    CRYPTO: filterMarketNewsArticles({ articles, regionFilter: 'CRYPTO', currentSymbol }).length,
    CURRENT: filterMarketNewsArticles({ articles, regionFilter: 'CURRENT', currentSymbol }).length,
  };
}

let cachedNews: { ts: number; data: MarketNewsFeedResponse } | null = null;

async function fetchRssViaRss2JsonFallback(
  rssUrl: string,
  sourceName: string,
  region: 'VN' | 'GLOBAL' | 'CRYPTO'
): Promise<MarketNewsArticle[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    const res = await fetch(apiUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = await res.json();
    if (!json || !Array.isArray(json.items)) return [];

    return json.items.slice(0, 10).map((item: any, idx: number) => {
      const pubMs = item.pubDate ? Date.parse(item.pubDate) : Date.now() - idx * 300_000;
      const cleanDesc = String(item.description || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 220);

      return enrichArticleTagsAndSentiment({
        id: `r2j_${region}_${idx}_${pubMs}`,
        title: String(item.title || '').trim(),
        summary: cleanDesc,
        url: String(item.link || ''),
        source: sourceName,
        region,
        publishedAtMs: Number.isFinite(pubMs) ? pubMs : Date.now(),
        publishedAtISO: new Date(Number.isFinite(pubMs) ? pubMs : Date.now()).toISOString(),
        assetTags: [],
        sentimentHint: 'NEUTRAL',
      });
    });
  } catch {
    return [];
  }
}

export async function fetchLiveMarketNews(force: boolean = false): Promise<MarketNewsFeedResponse> {
  const now = Date.now();
  if (!force && cachedNews && now - cachedNews.ts < 90_000) {
    return cachedNews.data;
  }

  let collectedItems: MarketNewsArticle[] = [];
  const activeSourcesSet = new Set<string>();

  // 1. Primary: Try serverless / Vite middleware endpoint (/api/market-news)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch('/api/market-news', {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const json = await res.json();
      if (json && Array.isArray(json.items) && json.items.length > 0) {
        collectedItems = json.items.map((item: MarketNewsArticle) =>
          enrichArticleTagsAndSentiment(item)
        );
        if (Array.isArray(json.activeSources)) {
          json.activeSources.forEach((s: string) => activeSourcesSet.add(s));
        }
      }
    }
  } catch {
    // Fallback below if running without serverless backend
  }

  // 2. Check regional coverage; if any region (VN, GLOBAL, CRYPTO) is missing, top up via CORS endpoints
  const hasVN = collectedItems.some((i) => i.region === 'VN');
  const hasGlobal = collectedItems.some((i) => i.region === 'GLOBAL');
  const hasCrypto = collectedItems.some((i) => i.region === 'CRYPTO');

  const fallbackPromises: Promise<MarketNewsArticle[]>[] = [];

  if (!hasVN) {
    fallbackPromises.push(
      fetchRssViaRss2JsonFallback(
        'https://vnexpress.net/rss/kinh-doanh.rss',
        'VnExpress Kinh Doanh',
        'VN'
      )
    );
  }

  if (!hasGlobal) {
    fallbackPromises.push(
      fetchRssViaRss2JsonFallback(
        'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258',
        'CNBC Economy',
        'GLOBAL'
      )
    );
  }

  if (!hasCrypto) {
    fallbackPromises.push(
      (async (): Promise<MarketNewsArticle[]> => {
        try {
          const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
          if (!res.ok) return [];
          const json = await res.json();
          const rawArr = Array.isArray(json?.Data) ? json.Data.slice(0, 14) : [];
          return rawArr
            .filter((item: any) => item?.title && item?.url)
            .map((item: any) => {
              const pubMs = (Number(item.published_on) || Math.floor(now / 1000)) * 1000;
              const tags = String(item.categories || '')
                .split('|')
                .filter(Boolean)
                .slice(0, 3)
                .map((c: string) => (c === 'BTC' ? 'BTCUSDT' : c === 'ETH' ? 'ETHUSDT' : c));
              return enrichArticleTagsAndSentiment({
                id: `cc_${item.id}`,
                title: String(item.title),
                summary: String(item.body || '').slice(0, 200),
                url: String(item.url),
                source: String(item.source_info?.name || item.source || 'CryptoWire'),
                region: 'CRYPTO',
                publishedAtMs: pubMs,
                publishedAtISO: new Date(pubMs).toISOString(),
                assetTags: tags.length > 0 ? tags : ['BTCUSDT'],
                sentimentHint: 'NEUTRAL',
              });
            });
        } catch {
          return [];
        }
      })()
    );
  }

  if (fallbackPromises.length > 0) {
    const fallbackLists = await Promise.all(fallbackPromises);
    for (const list of fallbackLists) {
      if (list.length > 0) {
        collectedItems.push(...list);
        activeSourcesSet.add(list[0].source);
      }
    }
  }

  if (collectedItems.length > 0) {
    const seen = new Set<string>();
    const deduped: MarketNewsArticle[] = [];
    for (const item of collectedItems.sort((a, b) => b.publishedAtMs - a.publishedAtMs)) {
      const key = item.title.toLowerCase().slice(0, 65);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    const result: MarketNewsFeedResponse = {
      ok: true,
      fetchedAtMs: now,
      activeSources: Array.from(activeSourcesSet),
      items: deduped,
    };
    cachedNews = { ts: now, data: result };
    return result;
  }

  return (
    cachedNews?.data || {
      ok: false,
      fetchedAtMs: now,
      activeSources: [],
      items: [],
    }
  );
}

function evaluateSegmentBreadth(
  segmentId: SegmentBreadthMetrics['segmentId'],
  segmentName: string,
  list: MarketSymbol[],
  benchmarkSymbol?: MarketSymbol
): SegmentBreadthMetrics {
  const valid = list.filter((s) => Number.isFinite(s.price) && s.price > 0);
  const totalTracked = valid.length;

  if (totalTracked === 0) {
    return {
      segmentId,
      segmentName,
      totalTracked: 0,
      advancers: 0,
      decliners: 0,
      unchanged: 0,
      advancePct: 0,
      avgChange24hPct: 0,
      strongAboveMidRangeCount: 0,
      strongAboveMidRangePct: 0,
      breadthRegime: 'MIXED_ROTATION',
      breadthRegimeLabel: 'Chưa đủ dữ liệu',
      breadthDiagnostic: 'Đang đồng bộ bảng giá thị trường.',
      topGainers: [],
      topLagging: [],
    };
  }

  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;
  let strongAboveMid = 0;
  let sumChg = 0;

  for (const s of valid) {
    const chg = Number.isFinite(s.change24h) ? s.change24h : 0;
    sumChg += chg;
    if (chg > 0.05) advancers++;
    else if (chg < -0.05) decliners++;
    else unchanged++;

    const span = s.high24h - s.low24h;
    if (span > 0) {
      const pos = (s.price - s.low24h) / span;
      if (pos >= 0.52) strongAboveMid++;
    } else if (chg >= 0) {
      strongAboveMid++;
    }
  }

  const advancePct = (advancers / totalTracked) * 100;
  const avgChange24hPct = sumChg / totalTracked;
  const strongAboveMidRangePct = (strongAboveMid / totalTracked) * 100;

  // Detect "Xanh vỏ đỏ lòng" (Index green via mega-caps while >58% of individual stocks decline)
  const benchmarkChg = benchmarkSymbol?.change24h ?? avgChange24hPct;
  let breadthRegime: SegmentBreadthMetrics['breadthRegime'] = 'MIXED_ROTATION';
  let breadthRegimeLabel = 'Phân Hóa Chọn Lọc';
  let breadthDiagnostic =
    'Dòng tiền xoay vòng chọn lọc vào từng cổ phiếu/nhóm ngành riêng lẻ thay vì kéo đồng loạt.';

  if (advancePct >= 72 && strongAboveMidRangePct >= 65) {
    breadthRegime = 'BROAD_THRUST';
    breadthRegimeLabel = 'Bùng Nổ Đồng Thuận';
    breadthDiagnostic = `${advancers}/${totalTracked} mã xanh điểm và giữ giá nửa trên biên độ phiên — dòng tiền lan tỏa thực chất.`;
  } else if (benchmarkChg > 0.15 && advancePct < 42) {
    breadthRegime = 'GREEN_OUTSIDE_RED_INSIDE';
    breadthRegimeLabel = 'Xanh Vỏ Đỏ Lòng ⚠️';
    breadthDiagnostic = `Chỉ số giữ sắc xanh (+${benchmarkChg.toFixed(2)}%) nhờ trụ lớn nhưng có tới ${decliners}/${totalTracked} mã giảm giá — cẩn trọng bẫy FOMO.`;
  } else if (advancePct >= 56) {
    breadthRegime = 'HEALTHY_BULL';
    breadthRegimeLabel = 'Độ Rộng Tích Cực';
    breadthDiagnostic = `Số mã tăng (${advancers}) áp đảo số mã giảm (${decliners}), cấu trúc thị trường ủng hộ chiều nắm giữ.`;
  } else if (advancePct <= 28) {
    breadthRegime = 'BROAD_SELL_OFF';
    breadthRegimeLabel = 'Áp Lực Bán Diện Rộng';
    breadthDiagnostic = `${decliners}/${totalTracked} mã suy yếu đồng loạt — ưu tiên phòng thủ và chờ xác nhận cạn cung.`;
  }

  const sorted = [...valid].sort((a, b) => b.change24h - a.change24h);
  const topGainers = sorted.slice(0, 4).map((s) => ({
    symbol: s.symbol,
    name: s.name,
    change24h: s.change24h,
    price: s.price,
  }));
  const topLagging = [...sorted]
    .reverse()
    .slice(0, 4)
    .map((s) => ({
      symbol: s.symbol,
      name: s.name,
      change24h: s.change24h,
      price: s.price,
    }));

  return {
    segmentId,
    segmentName,
    totalTracked,
    advancers,
    decliners,
    unchanged,
    advancePct: Number(advancePct.toFixed(1)),
    avgChange24hPct: Number(avgChange24hPct.toFixed(2)),
    strongAboveMidRangeCount: strongAboveMid,
    strongAboveMidRangePct: Number(strongAboveMidRangePct.toFixed(1)),
    breadthRegime,
    breadthRegimeLabel,
    breadthDiagnostic,
    topGainers,
    topLagging,
  };
}

export function computeMarketBreadthSnapshot(symbols: MarketSymbol[]): MarketBreadthSnapshot {
  const vnIndexSym = symbols.find((s) => s.symbol === 'VNINDEX' || s.symbol === 'VN30');
  const vnStocks = symbols.filter(
    (s) =>
      (s.type === 'vn30' || s.quoteAsset === 'VND') &&
      s.symbol !== 'VNINDEX' &&
      s.symbol !== 'VN30' &&
      s.symbol !== 'HNXINDEX'
  );
  const cryptoList = symbols.filter((s) => s.type === 'crypto' && s.symbol !== 'PAXGUSDT');
  const globalList = symbols.filter(
    (s) => s.type === 'stock' || s.type === 'commodity' || s.symbol === 'XAUUSD'
  );

  return {
    computedAtMs: Date.now(),
    vnMarket: evaluateSegmentBreadth(
      'VN_MARKET',
      'Cổ Phiếu Việt Nam (VN30 / HOSE)',
      vnStocks,
      vnIndexSym
    ),
    cryptoMarket: evaluateSegmentBreadth(
      'CRYPTO',
      'Tài Sản Số (Crypto Spot)',
      cryptoList,
      symbols.find((s) => s.symbol === 'BTCUSDT')
    ),
    globalMarket: evaluateSegmentBreadth(
      'GLOBAL_MACRO',
      'Cổ Phiếu Mỹ & Hàng Hóa Quốc Tế',
      globalList,
      symbols.find((s) => s.symbol === 'XAUUSD')
    ),
  };
}
