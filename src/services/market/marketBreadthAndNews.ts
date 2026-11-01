import { MarketSymbol } from '../../types';

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

let cachedNews: { ts: number; data: MarketNewsFeedResponse } | null = null;

export async function fetchLiveMarketNews(force: boolean = false): Promise<MarketNewsFeedResponse> {
  const now = Date.now();
  if (!force && cachedNews && now - cachedNews.ts < 90_000) {
    return cachedNews.data;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch('/api/market-news', { signal: ctrl.signal });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.items)) {
        const result: MarketNewsFeedResponse = {
          ok: true,
          fetchedAtMs: json.fetchedAtMs || now,
          activeSources: json.activeSources || [],
          items: json.items,
        };
        cachedNews = { ts: now, data: result };
        return result;
      }
    }
  } catch {
    // Fallback below if running purely in static Vite dev without Vercel Serverless Functions
  }

  // Fallback public CryptoCompare / CoinTelegraph JSON endpoint (CORS-enabled, 100% real articles with real URLs)
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    if (res.ok) {
      const json = await res.json();
      const rawArr = Array.isArray(json?.Data) ? json.Data.slice(0, 20) : [];
      const items: MarketNewsArticle[] = rawArr
        .filter((item: any) => item?.title && item?.url)
        .map((item: any) => {
          const pubMs = (Number(item.published_on) || Math.floor(now / 1000)) * 1000;
          const tags = String(item.categories || '')
            .split('|')
            .filter(Boolean)
            .slice(0, 3)
            .map((c: string) => (c === 'BTC' ? 'BTCUSDT' : c === 'ETH' ? 'ETHUSDT' : c));
          return {
            id: `cc_${item.id}`,
            title: String(item.title),
            summary: String(item.body || '').slice(0, 200),
            url: String(item.url),
            source: String(item.source_info?.name || item.source || 'MarketWire'),
            region: 'CRYPTO',
            publishedAtMs: pubMs,
            publishedAtISO: new Date(pubMs).toISOString(),
            assetTags: tags.length > 0 ? tags : ['BTCUSDT'],
            sentimentHint: 'NEUTRAL',
          };
        });

      const fallbackRes: MarketNewsFeedResponse = {
        ok: items.length > 0,
        fetchedAtMs: now,
        activeSources: items.length > 0 ? ['Global CryptoWire Live'] : [],
        items,
      };
      cachedNews = { ts: now, data: fallbackRes };
      return fallbackRes;
    }
  } catch {
    // ignore
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
  const valid = list.filter(s => Number.isFinite(s.price) && s.price > 0);
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
  const topGainers = sorted.slice(0, 4).map(s => ({
    symbol: s.symbol,
    name: s.name,
    change24h: s.change24h,
    price: s.price,
  }));
  const topLagging = [...sorted]
    .reverse()
    .slice(0, 4)
    .map(s => ({
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
  const vnIndexSym = symbols.find(s => s.symbol === 'VNINDEX' || s.symbol === 'VN30');
  const vnStocks = symbols.filter(
    s =>
      (s.type === 'vn30' || s.quoteAsset === 'VND') &&
      s.symbol !== 'VNINDEX' &&
      s.symbol !== 'VN30' &&
      s.symbol !== 'HNXINDEX'
  );
  const cryptoList = symbols.filter(s => s.type === 'crypto' && s.symbol !== 'PAXGUSDT');
  const globalList = symbols.filter(
    s => s.type === 'stock' || s.type === 'commodity' || s.symbol === 'XAUUSD'
  );

  return {
    computedAtMs: Date.now(),
    vnMarket: evaluateSegmentBreadth('VN_MARKET', 'Cổ Phiếu Việt Nam (VN30 / HOSE)', vnStocks, vnIndexSym),
    cryptoMarket: evaluateSegmentBreadth(
      'CRYPTO',
      'Tài Sản Số (Crypto Spot)',
      cryptoList,
      symbols.find(s => s.symbol === 'BTCUSDT')
    ),
    globalMarket: evaluateSegmentBreadth(
      'GLOBAL_MACRO',
      'Cổ Phiếu Mỹ & Hàng Hóa Quốc Tế',
      globalList,
      symbols.find(s => s.symbol === 'XAUUSD')
    ),
  };
}
