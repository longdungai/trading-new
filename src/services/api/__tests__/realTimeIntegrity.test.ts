import { describe, expect, it } from 'vitest';
import { getMarketSessionInfo } from '../../../utils/marketHours';
import { DEFAULT_SYMBOLS, getMarketSentiment } from '../marketData';
import { Candle, MarketSymbol } from '../../../types';

describe('Real-Time Data & Session Integrity', () => {
  it('keeps 24/7 Binance Crypto & PAXGUSDT open with real OrderBook on Sunday while closing VN/US exchanges', () => {
    // Sunday 10:30 GMT+7 (2026-11-01T03:30:00Z)
    const sundayMorningVN = new Date('2026-11-01T03:30:00Z');

    const btc: MarketSymbol = {
      symbol: 'BTCUSDT',
      name: 'Bitcoin',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      type: 'crypto',
      price: 95000,
      change24h: 1.5,
      high24h: 96000,
      low24h: 93000,
      volume24h: 25000000000,
    };

    const paxg: MarketSymbol = {
      symbol: 'PAXGUSDT',
      name: 'PAX Gold',
      baseAsset: 'PAXG',
      quoteAsset: 'USDT',
      type: 'commodity',
      price: 2750,
      change24h: 0.4,
      high24h: 2765,
      low24h: 2735,
      volume24h: 45000000,
    };

    const fpt: MarketSymbol = {
      symbol: 'FPT',
      name: 'FPT Corp',
      baseAsset: 'FPT',
      quoteAsset: 'VND',
      type: 'vn30',
      price: 135,
      change24h: 0.8,
      high24h: 136,
      low24h: 133,
      volume24h: 4500000,
    };

    const nvda: MarketSymbol = {
      symbol: 'NVDA',
      name: 'NVIDIA',
      baseAsset: 'NVDA',
      quoteAsset: 'USD',
      type: 'stock',
      price: 140,
      change24h: 2.1,
      high24h: 142,
      low24h: 138,
      volume24h: 180000000,
    };

    const btcSession = getMarketSessionInfo(btc, sundayMorningVN);
    expect(btcSession.isOpen).toBe(true);
    expect(btcSession.hasRealOrderBook).toBe(true);

    const paxgSession = getMarketSessionInfo(paxg, sundayMorningVN);
    expect(paxgSession.isOpen).toBe(true);
    expect(paxgSession.hasRealOrderBook).toBe(true);

    const fptSession = getMarketSessionInfo(fpt, sundayMorningVN);
    expect(fptSession.isOpen).toBe(false);
    expect(fptSession.hasRealOrderBook).toBe(false);

    const nvdaSession = getMarketSessionInfo(nvda, sundayMorningVN);
    expect(nvdaSession.isOpen).toBe(false);
    expect(nvdaSession.hasRealOrderBook).toBe(false);
  });

  it('opens HOSE during official weekday trading hours (Monday 10:00 GMT+7) and pauses during lunch break (12:00 GMT+7)', () => {
    const fpt: MarketSymbol = {
      symbol: 'FPT',
      name: 'FPT Corp',
      baseAsset: 'FPT',
      quoteAsset: 'VND',
      type: 'vn30',
      price: 135,
      change24h: 0.8,
      high24h: 136,
      low24h: 133,
      volume24h: 4500000,
    };

    // Monday 2026-11-02 10:00 GMT+7 = 03:00 UTC
    const monMorning = getMarketSessionInfo(fpt, new Date('2026-11-02T03:00:00Z'));
    expect(monMorning.isOpen).toBe(true);
    expect(monMorning.state).toBe('OPEN');

    // Monday 2026-11-02 12:00 GMT+7 = 05:00 UTC (Lunch Break 11:30 - 13:00)
    const monLunch = getMarketSessionInfo(fpt, new Date('2026-11-02T05:00:00Z'));
    expect(monLunch.isOpen).toBe(false);
    expect(monLunch.state).toBe('LUNCH_BREAK');
  });

  it('propagates live Crypto Fear & Greed and real 8h Binance Funding Rate into MarketSentiment', () => {
    const btc = DEFAULT_SYMBOLS.find(s => s.symbol === 'BTCUSDT')!;
    const candles: Candle[] = Array.from({ length: 30 }, (_, idx) => ({
      time: 1700000000 + idx * 3600,
      open: 90000 + idx * 100,
      high: 90200 + idx * 100,
      low: 89900 + idx * 100,
      close: 90100 + idx * 100,
      volume: 1500,
    }));

    const sentiment = getMarketSentiment(btc, candles, DEFAULT_SYMBOLS, 72, 0.0125);
    expect(sentiment.fearAndGreedIndex).toBe(72);
    expect(sentiment.isLiveCryptoFng).toBe(true);
    expect(sentiment.fundingRate).toBe(0.0125);
  });
});
