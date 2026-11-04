import { describe, expect, it } from 'vitest';
import { MarketSymbol } from '../../../types';
import {
  computeNewsFilterCounts,
  enrichArticleTagsAndSentiment,
  filterMarketNewsArticles,
  MarketNewsArticle,
} from '../marketBreadthAndNews';

const sampleArticles: MarketNewsArticle[] = [
  enrichArticleTagsAndSentiment({
    id: 'vn_1',
    title: 'FPT ký hợp đồng AI bán dẫn lớn tại Nhật Bản, cổ phiếu công nghệ bứt phá',
    summary: 'Doanh thu mảng chuyển đổi số và AI của FPT tăng mạnh trong quý mới.',
    url: 'https://vnexpress.net/fpt-ai',
    source: 'VnExpress Chứng Khoán',
    region: 'VN',
    publishedAtMs: 1700000500000,
    publishedAtISO: new Date(1700000500000).toISOString(),
    assetTags: [],
    sentimentHint: 'NEUTRAL',
  }),
  enrichArticleTagsAndSentiment({
    id: 'vn_2',
    title: 'Giá thép xây dựng phục hồi, Hòa Phát (HPG) hưởng lợi từ giải ngân đầu tư công',
    summary: 'Sản lượng tiêu thụ thép Hòa Phát tăng trưởng tích cực.',
    url: 'https://vnexpress.net/hpg-thep',
    source: 'VnExpress Kinh Doanh',
    region: 'VN',
    publishedAtMs: 1700000400000,
    publishedAtISO: new Date(1700000400000).toISOString(),
    assetTags: [],
    sentimentHint: 'NEUTRAL',
  }),
  enrichArticleTagsAndSentiment({
    id: 'vn_3',
    title: 'Khối ngoại mua ròng mạnh trên sàn HOSE, VN-Index khởi sắc vượt ngưỡng cản',
    summary: 'Thanh khoản thị trường chứng khoán tăng vọt.',
    url: 'https://vnexpress.net/vnindex',
    source: 'VnExpress Chứng Khoán',
    region: 'VN',
    publishedAtMs: 1700000300000,
    publishedAtISO: new Date(1700000300000).toISOString(),
    assetTags: [],
    sentimentHint: 'NEUTRAL',
  }),
  enrichArticleTagsAndSentiment({
    id: 'gl_1',
    title: 'Federal Reserve signals dovish cut rate path as inflation cools, gold bullion jumps',
    summary: 'FOMC minutes show policymakers ready to ease policy, pushing XAU higher.',
    url: 'https://cnbc.com/fed-gold',
    source: 'CNBC Economy',
    region: 'GLOBAL',
    publishedAtMs: 1700000200000,
    publishedAtISO: new Date(1700000200000).toISOString(),
    assetTags: [],
    sentimentHint: 'NEUTRAL',
  }),
  enrichArticleTagsAndSentiment({
    id: 'cr_1',
    title: 'Solana DEX volume surges to record high as SOL outperforms Bitcoin',
    summary: 'Raydium and Jupiter activity drives strong inflow into Solana ecosystem.',
    url: 'https://coindesk.com/solana-surge',
    source: 'CoinDesk',
    region: 'CRYPTO',
    publishedAtMs: 1700000100000,
    publishedAtISO: new Date(1700000100000).toISOString(),
    assetTags: [],
    sentimentHint: 'NEUTRAL',
  }),
  enrichArticleTagsAndSentiment({
    id: 'cr_2',
    title: 'Bitcoin Spot ETF sees institutional fear after macro tariff drop',
    summary: 'BTC faces short-term selling pressure before halving support.',
    url: 'https://coindesk.com/btc-etf',
    source: 'CoinDesk',
    region: 'CRYPTO',
    publishedAtMs: 1700000050000,
    publishedAtISO: new Date(1700000050000).toISOString(),
    assetTags: [],
    sentimentHint: 'NEUTRAL',
  }),
];

const fptSym: MarketSymbol = {
  symbol: 'FPT',
  name: 'FPT Corp',
  price: 132.5,
  change24h: 2.1,
  high24h: 134,
  low24h: 130,
  volume24h: 4500000,
  type: 'vn30',
  baseAsset: 'FPT',
  quoteAsset: 'VND',
};

const solSym: MarketSymbol = {
  symbol: 'SOLUSDT',
  name: 'Solana',
  price: 192,
  change24h: 4.8,
  high24h: 195,
  low24h: 182,
  volume24h: 3200000,
  type: 'crypto',
  baseAsset: 'SOL',
  quoteAsset: 'USDT',
};

describe('Real-Time Financial & Macro News Station Filter Engine', () => {
  it('accurately filters by region (ALL, VN, GLOBAL, CRYPTO) and computes tab counts', () => {
    const counts = computeNewsFilterCounts(sampleArticles, fptSym);
    expect(counts.ALL).toBe(6);
    expect(counts.VN).toBe(3);
    expect(counts.GLOBAL).toBe(1);
    expect(counts.CRYPTO).toBe(2);
    // CURRENT for FPT should NOT indiscriminately include HPG steel news when direct FPT + VNINDEX macro match
    expect(counts.CURRENT).toBeLessThan(counts.VN);
    expect(counts.CURRENT).toBeGreaterThanOrEqual(1);
  });

  it('filters specifically for CURRENT symbol (FPT vs SOLUSDT) and supports sentiment, tag & keyword filters', () => {
    const fptFiltered = filterMarketNewsArticles({
      articles: sampleArticles,
      regionFilter: 'CURRENT',
      currentSymbol: fptSym,
    });
    expect(fptFiltered[0].id).toBe('vn_1');
    expect(fptFiltered.some((a) => a.id === 'vn_2')).toBe(false); // HPG steel news is excluded from FPT filter

    const solFiltered = filterMarketNewsArticles({
      articles: sampleArticles,
      regionFilter: 'CURRENT',
      currentSymbol: solSym,
    });
    expect(solFiltered[0].id).toBe('cr_1');
    expect(solFiltered[0].assetTags).toContain('SOLUSDT');

    // Sentiment filter
    const bearishOnly = filterMarketNewsArticles({
      articles: sampleArticles,
      regionFilter: 'ALL',
      currentSymbol: fptSym,
      sentimentFilter: 'BEARISH',
    });
    expect(bearishOnly.length).toBe(1);
    expect(bearishOnly[0].id).toBe('cr_2');

    // Tag filter
    const goldTagFiltered = filterMarketNewsArticles({
      articles: sampleArticles,
      regionFilter: 'ALL',
      currentSymbol: fptSym,
      tagFilter: 'XAUUSD',
    });
    expect(goldTagFiltered.length).toBe(1);
    expect(goldTagFiltered[0].id).toBe('gl_1');

    // Keyword search filter
    const searchFiltered = filterMarketNewsArticles({
      articles: sampleArticles,
      regionFilter: 'ALL',
      currentSymbol: fptSym,
      searchQuery: 'Hòa Phát',
    });
    expect(searchFiltered.length).toBe(1);
    expect(searchFiltered[0].id).toBe('vn_2');
  });
});
