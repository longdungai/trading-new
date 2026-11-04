import { describe, expect, it } from 'vitest';
import { Candle, MarketSymbol } from '../../../types';
import {
  evaluateBullTrapAndFakeoutShield,
  evaluateHighWinrateSniperReport,
  findHistoricalFractalAnalogs,
  scanTopSniperOpportunities,
} from '../highWinrateSniperEngine';

function buildSyntheticCandles(count: number, startPrice: number): Candle[] {
  const list: Candle[] = [];
  let p = startPrice;
  const baseTime = 1700000000;
  for (let i = 0; i < count; i++) {
    const wave = Math.sin(i / 4) * 0.012 + 0.002;
    const open = p;
    const close = Number((p * (1 + wave)).toFixed(2));
    const high = Number((Math.max(open, close) * 1.008).toFixed(2));
    const low = Number((Math.min(open, close) * 0.992).toFixed(2));
    list.push({
      time: baseTime + i * 3600,
      open,
      high,
      low,
      close,
      volume: 1000 + (i % 5) * 250,
    });
    p = close;
  }
  return list;
}

describe('High-Winrate Sniper Engine (VN Stock & Crypto Coin Suite)', () => {
  it('computes full sniper report with empirical backtest, k-NN analogs, and 3-stage scale-out for VN Stock (FPT)', () => {
    const candles = buildSyntheticCandles(120, 130);
    const fptSymbol: MarketSymbol = {
      symbol: 'FPT',
      name: 'CTCP FPT',
      price: candles[candles.length - 1].close,
      change24h: 1.8,
      high24h: candles[candles.length - 1].high,
      low24h: candles[candles.length - 1].low,
      volume24h: 4500000,
      type: 'vn30',
      baseAsset: 'FPT',
      quoteAsset: 'VND',
    };

    const report = evaluateHighWinrateSniperReport({
      symbol: 'FPT',
      symbolObj: fptSymbol,
      candles,
    });

    expect(report.marketFocus).toBe('VN_STOCK');
    expect(report.empiricalBacktest.nonLossWinratePct).toBeGreaterThanOrEqual(50);
    expect(report.fractalAnalog.matches.length).toBeGreaterThan(0);
    expect(report.scaleOutPlan.tranches).toHaveLength(3);
    expect(report.scaleOutPlan.breakevenLockPrice).toBeGreaterThan(0);
    expect(report.checklistPassed).toHaveLength(5);
  });

  it('detects bull-trap danger when price spikes far above EMA20 on weak volume', () => {
    const candles = buildSyntheticCandles(50, 100);
    const last = candles[candles.length - 1];
    candles.push({
      time: last.time + 3600,
      open: last.close,
      high: last.close * 1.12,
      low: last.close * 0.998,
      close: last.close * 1.075,
      volume: 300, // Low volume spike + long upper wick
    });

    const shield = evaluateBullTrapAndFakeoutShield('FPT', candles, 'VN_STOCK');
    expect(shield.isSafeToEnterMarket).toBe(false);
    expect(shield.trapRiskLevel).toBe('HIGH_BULL_TRAP_DANGER');
    expect(shield.safeLimitPullbackPrice).toBeLessThan(candles[candles.length - 1].close);
  });

  it('ranks both VN Stocks and Crypto Coins in the Top Sniper Leaderboard', () => {
    const candles = buildSyntheticCandles(90, 95000);
    const mockSymbols: MarketSymbol[] = [
      {
        symbol: 'FPT',
        name: 'FPT Corp',
        price: 135.5,
        change24h: 1.6,
        high24h: 136.2,
        low24h: 133.0,
        volume24h: 5000000,
        type: 'vn30',
        baseAsset: 'FPT',
        quoteAsset: 'VND',
      },
      {
        symbol: 'HPG',
        name: 'Hoa Phat Group',
        price: 27.4,
        change24h: 0.9,
        high24h: 27.6,
        low24h: 26.9,
        volume24h: 18000000,
        type: 'vn30',
        baseAsset: 'HPG',
        quoteAsset: 'VND',
      },
      {
        symbol: 'BTCUSDT',
        name: 'Bitcoin',
        price: candles[candles.length - 1].close,
        change24h: 2.1,
        high24h: candles[candles.length - 1].high,
        low24h: candles[candles.length - 1].low,
        volume24h: 35000,
        type: 'crypto',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
      },
      {
        symbol: 'SOLUSDT',
        name: 'Solana',
        price: 192.4,
        change24h: 3.1,
        high24h: 195.0,
        low24h: 186.0,
        volume24h: 420000,
        type: 'crypto',
        baseAsset: 'SOL',
        quoteAsset: 'USDT',
      },
    ];

    const analog = findHistoricalFractalAnalogs(candles);
    expect(analog.matches.length).toBeGreaterThan(0);

    const board = scanTopSniperOpportunities(mockSymbols, 'BTCUSDT', candles);
    expect(board.vnStockPicks.length).toBe(2);
    expect(board.cryptoCoinPicks.length).toBe(2);
    expect(board.vnStockPicks[0].estimatedNonLossWinratePct).toBeGreaterThan(60);
    expect(board.cryptoCoinPicks[0].estimatedNonLossWinratePct).toBeGreaterThan(60);
  });
});
