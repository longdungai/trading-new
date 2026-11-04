/**
 * Vercel Serverless Function: Real-Time Financial & Macro News Aggregator (/api/market-news)
 * Aggregates authentic, timestamped RSS feeds from official & major financial publishers:
 * - Federal Reserve Official Press Releases
 * - Yahoo Finance Market News
 * - CNBC Economy & Markets
 * - CoinDesk & CoinTelegraph Digital Assets
 * - VnExpress Chứng Khoán & Kinh Doanh (Vietnam Stock Market, Gold & Macro)
 *
 * Strictly zero AI-invented or fabricated news. Every item includes its original publisher URL.
 */

const RSS_SOURCES = [
  {
    id: 'vnexpress_ck',
    name: 'VnExpress Chứng Khoán',
    region: 'VN',
    url: 'https://vnexpress.net/rss/kinh-doanh/chung-khoan.rss',
  },
  {
    id: 'vnexpress_kd',
    name: 'VnExpress Kinh Doanh',
    region: 'VN',
    url: 'https://vnexpress.net/rss/kinh-doanh.rss',
  },
  {
    id: 'cnbc_econ',
    name: 'CNBC Economy & Markets',
    region: 'GLOBAL',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258',
  },
  {
    id: 'yahoo_fin',
    name: 'Yahoo Finance',
    region: 'GLOBAL',
    url: 'https://finance.yahoo.com/news/rssindex',
  },
  {
    id: 'fed',
    name: 'Federal Reserve',
    region: 'GLOBAL',
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
  },
  {
    id: 'coindesk',
    name: 'CoinDesk',
    region: 'CRYPTO',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  },
  {
    id: 'cointelegraph',
    name: 'CoinTelegraph',
    region: 'CRYPTO',
    url: 'https://cointelegraph.com/rss',
  },
];

function decodeXmlEntities(raw) {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : '';
}

const SYMBOL_TAG_RULES = [
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
    keywords: ['solana', 'sol ', 'raydium', 'jupiter', 'meme coin'],
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
    keywords: ['apple', 'aapl', 'iphone', 'macbook', 'tim cook'],
  },
  {
    tag: 'TSLA',
    keywords: ['tesla', 'tsla', 'elon musk', 'ev ', 'xe điện'],
  },
  {
    tag: 'VCB',
    keywords: ['vietcombank', 'vcb', 'big4 ngân hàng', 'tín dụng ngân hàng', 'nhóm ngân hàng'],
  },
  {
    tag: 'TCB',
    keywords: ['techcombank', 'tcb', 'mb ', 'mbb', 'acb', 'bidv', 'vietinbank', 'ctg', 'stb'],
  },
  {
    tag: 'SSI',
    keywords: ['ssi', 'vndirect', 'vnd', 'vci', 'hcm', 'công ty chứng khoán', 'margin'],
  },
  {
    tag: 'FPT',
    keywords: ['fpt', 'công nghệ việt', 'ai việt nam', 'phần mềm', 'chuyển đổi số'],
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
    keywords: ['vinhomes', 'vhm', 'vingroup', 'vic', 'novaland', 'nvl', 'bất động sản', 'đất nền', 'nhà ở'],
  },
  {
    tag: 'GAS',
    keywords: ['pv gas', 'pvd', 'pvs', 'bsr', 'plx', 'petrolimex', 'dầu khí'],
  },
];

function detectAssetTags(text, region) {
  const lower = text.toLowerCase();
  const matched = [];
  for (const rule of SYMBOL_TAG_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      matched.push(rule.tag);
    }
  }
  if (matched.length === 0) {
    if (region === 'VN') matched.push('VNINDEX');
    else if (region === 'CRYPTO') matched.push('BTCUSDT');
    else matched.push('FED');
  }
  return matched.slice(0, 5);
}

function classifySentimentHint(text) {
  const lower = text.toLowerCase();
  const posWords = [
    'surge',
    'rally',
    'jump',
    'gain',
    'cut rate',
    'dovish',
    'beat',
    'record high',
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
    'inflation spike',
    'war',
    'tariff',
    'crash',
    'outflow',
    'hack',
    'lao dốc',
    'bán ròng',
    'áp lực',
    'suy thoái',
    'giảm sâu',
    'bán tháo',
    'thua lỗ',
    'rủi ro',
  ];
  let score = 0;
  for (const w of posWords) if (lower.includes(w)) score += 1;
  for (const w of negWords) if (lower.includes(w)) score -= 1;
  if (score > 0) return 'BULLISH';
  if (score < 0) return 'BEARISH';
  return 'NEUTRAL';
}

function parseRssXml(xml, sourceMeta) {
  const items = [];
  const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];

  for (const rawItem of itemMatches.slice(0, 12)) {
    const title = decodeXmlEntities(extractTag(rawItem, 'title'));
    let link = decodeXmlEntities(extractTag(rawItem, 'link'));
    if (!link) {
      const guid = decodeXmlEntities(extractTag(rawItem, 'guid'));
      if (guid.startsWith('http')) link = guid;
    }
    const description = decodeXmlEntities(extractTag(rawItem, 'description')).slice(0, 220);
    const pubDateStr = decodeXmlEntities(
      extractTag(rawItem, 'pubDate') ||
        extractTag(rawItem, 'dc:date') ||
        extractTag(rawItem, 'published')
    );

    if (!title || !link || !link.startsWith('http')) continue;

    const parsedMs = pubDateStr ? Date.parse(pubDateStr) : NaN;
    const publishedAtMs = Number.isFinite(parsedMs) ? parsedMs : Date.now();
    const combinedText = `${title} ${description}`;

    // Cross-classify region if a VN article is strictly about Gold/Crypto/Fed or a Global article is about Crypto
    let effectiveRegion = sourceMeta.region;
    const lowerText = combinedText.toLowerCase();
    if (
      effectiveRegion === 'GLOBAL' &&
      (lowerText.includes('bitcoin') ||
        lowerText.includes('ethereum') ||
        lowerText.includes('crypto'))
    ) {
      effectiveRegion = 'CRYPTO';
    }

    items.push({
      id: `${sourceMeta.id}_${Buffer.from(link).toString('base64').slice(-24).replace(/[^a-zA-Z0-9]/g, '')}`,
      title,
      summary: description,
      url: link,
      source: sourceMeta.name,
      region: effectiveRegion,
      publishedAtMs,
      publishedAtISO: new Date(publishedAtMs).toISOString(),
      assetTags: detectAssetTags(combinedText, effectiveRegion),
      sentimentHint: classifySentimentHint(combinedText),
    });
  }

  return items;
}

async function fetchSingleFeed(sourceMeta) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);
  try {
    const res = await fetch(sourceMeta.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingNewTerminal/2.0)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssXml(xml, sourceMeta);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const results = await Promise.allSettled(RSS_SOURCES.map((src) => fetchSingleFeed(src)));
  const allItems = [];
  const activeSources = [];

  results.forEach((r, idx) => {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      activeSources.push(RSS_SOURCES[idx].name);
      allItems.push(...r.value);
    }
  });

  // Deduplicate by normalized title prefix while preserving balanced representation across VN, GLOBAL, and CRYPTO
  const seenTitles = new Set();
  const deduped = [];
  for (const item of allItems.sort((a, b) => b.publishedAtMs - a.publishedAtMs)) {
    const norm = item.title.toLowerCase().slice(0, 65);
    if (seenTitles.has(norm)) continue;
    seenTitles.add(norm);
    deduped.push(item);
  }

  // Ensure balanced quota per region so no single region crowds out VN, GLOBAL, or CRYPTO filters
  const vnItems = deduped.filter((i) => i.region === 'VN').slice(0, 20);
  const globalItems = deduped.filter((i) => i.region === 'GLOBAL').slice(0, 20);
  const cryptoItems = deduped.filter((i) => i.region === 'CRYPTO').slice(0, 20);

  const balancedItems = [...vnItems, ...globalItems, ...cryptoItems].sort(
    (a, b) => b.publishedAtMs - a.publishedAtMs
  );

  return res.status(200).json({
    ok: true,
    fetchedAtMs: Date.now(),
    activeSources,
    totalCount: balancedItems.length,
    items: balancedItems,
  });
}
