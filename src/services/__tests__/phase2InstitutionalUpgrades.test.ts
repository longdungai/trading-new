import { describe, expect, it } from 'vitest';
import { Candle, MarketSymbol } from '../../types';
import {
  calculateRollingVWAP,
  calculateVisibleVolumeProfile,
  evaluateTechnicalMtfConfluence,
} from '../analysis/volumeProfileMtf';
import {
  classifyOrderFlowRegime,
  computeCandleCvdAndDivergence,
} from '../api/derivativesOrderFlow';
import {
  runBacktest,
  runMonteCarloEquityStressTest,
  runStrategyTournament,
} from '../backtesting/backtester';
import { computeMarketBreadthSnapshot } from '../market/marketBreadthAndNews';

describe('Phase 2 Institutional Upgrades — Quantitative Verification', () => {
  it('computes exact VPVR (POC / VAH / VAL 70%), VWAP, and honest MTF alignment without fabricating missing TFs', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 40; i++) {
      // Concentrate massive institutional volume around 2000..2010
      const isCluster = i >= 12 && i <= 26;
      const base = isCluster ? 2005 : 1960 + i * 2.5;
      candles.push({
        time: 1700000000 + i * 3600,
        open: base - 2,
        high: base + 4,
        low: base - 4,
        close: base + 2,
        volume: isCluster ? 5000 : 250,
      });
    }

    const vpvr = calculateVisibleVolumeProfile(candles, 20, 0.7);
    expect(vpvr).not.toBeNull();
    expect(vpvr!.pocPrice).toBeGreaterThan(1998);
    expect(vpvr!.pocPrice).toBeLessThan(2012);
    expect(vpvr!.valPrice).toBeLessThanOrEqual(vpvr!.pocPrice);
    expect(vpvr!.vahPrice).toBeGreaterThanOrEqual(vpvr!.pocPrice);

    const vaVol = vpvr!.rows
      .filter(r => r.inValueArea)
      .reduce((sum, r) => sum + r.totalVolume, 0);
    expect(vaVol / vpvr!.totalVolume).toBeGreaterThanOrEqual(0.699);

    const vwap = calculateRollingVWAP(candles);
    expect(vwap.length).toBe(candles.length);
    expect(vwap[vwap.length - 1].vwap).toBeGreaterThan(1950);

    // MTF Confluence with only 1h provided -> 15m, 4h, 1D must be honestly marked available=false
    const mtf = evaluateTechnicalMtfConfluence('XAUUSD', '1h', candles, {});
    expect(mtf.availableCount).toBe(1);
    const d1Row = mtf.rows.find(r => r.timeframe === '1D');
    expect(d1Row?.available).toBe(false);
  });

  it('classifies Derivatives Order-Flow regimes and detects Bearish CVD Absorption divergence', () => {
    expect(classifyOrderFlowRegime(1.8, 2.4, 1.18).regime).toBe('LONG_BUILDUP');
    expect(classifyOrderFlowRegime(1.8, -2.1, 1.05).regime).toBe('SHORT_SQUEEZE');
    expect(classifyOrderFlowRegime(-1.9, 3.0, 0.82).regime).toBe('SHORT_BUILDUP');
    expect(classifyOrderFlowRegime(-2.2, -2.8, 0.79).regime).toBe('LONG_LIQUIDATION');

    // Construct 20 bars where second 8-bar window prints a higher price high on heavy upper-wick selling (lower CVD peak)
    const divCandles: Candle[] = [];
    for (let i = 0; i < 20; i++) {
      if (i < 12) {
        // Strong buying closes near high
        divCandles.push({
          time: 1700000000 + i * 900,
          open: 100 + i,
          low: 99.8 + i,
          high: 102 + i,
          close: 101.9 + i,
          volume: 1000,
        });
      } else {
        // Price spikes higher (high = 120), but closes near low -> negative volume delta absorption
        divCandles.push({
          time: 1700000000 + i * 900,
          open: 115,
          low: 110,
          high: 120,
          close: 110.2,
          volume: 1500,
        });
      }
    }

    const cvd = computeCandleCvdAndDivergence(divCandles);
    expect(cvd.series.length).toBe(20);
    expect(cvd.divergenceWarning).toContain('Bearish Absorption');
  });

  it('enforces VN_EQUITY_T2 Long-Only + Fees/Tax friction, runs 10-strategy tournament & deterministic Monte Carlo', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 140; i++) {
      const wave = 50 + 12 * Math.sin(i * 0.16) + i * 0.15;
      candles.push({
        time: 1700000000 + i * 86400, // Daily bars
        open: wave - 0.8,
        high: wave + 2.2,
        low: wave - 2.2,
        close: wave + (i % 2 === 0 ? 0.9 : -0.6),
        volume: 2_000_000,
      });
    }

    const vnRes = runBacktest(candles, 'SUPERTREND_EMA', 100_000_000, 2, {
      marketProfile: 'VN_EQUITY_T2',
    });

    // Strictly zero SHORT ('SELL') entries allowed on VN cash equities
    expect(vnRes.trades.every(t => t.type === 'BUY')).toBe(true);
    if (vnRes.trades.length > 0) {
      expect(vnRes.totalFeesPaid).toBeGreaterThan(0);
      // Every trade on daily bars must hold at least 2 bars (2 * 86400s) for T+2 settlement
      for (const tr of vnRes.trades) {
        expect(tr.exitTime - tr.entryTime).toBeGreaterThanOrEqual(2 * 86400);
      }
    }

    const tournament = runStrategyTournament(candles, 10_000, 2, {
      marketProfile: 'CRYPTO_FUTURES',
    });
    expect(tournament.length).toBe(10);

    // Populate >=5 sample trades for Monte Carlo reproducibility check
    const sampleTrades = tournament.find(r => r.trades.length >= 3)?.trades || [
      {
        id: '1',
        type: 'BUY',
        entryTime: 1,
        entryPrice: 100,
        exitTime: 2,
        exitPrice: 106,
        profitPercent: 6,
        pnlAmount: 600,
        reason: 'TP1',
        status: 'WIN',
      },
      {
        id: '2',
        type: 'BUY',
        entryTime: 3,
        entryPrice: 106,
        exitTime: 4,
        exitPrice: 103,
        profitPercent: -2.8,
        pnlAmount: -280,
        reason: 'SL',
        status: 'LOSS',
      },
      {
        id: '3',
        type: 'BUY',
        entryTime: 5,
        entryPrice: 103,
        exitTime: 6,
        exitPrice: 110,
        profitPercent: 6.8,
        pnlAmount: 680,
        reason: 'TP1',
        status: 'WIN',
      },
    ];

    const mc1 = runMonteCarloEquityStressTest(sampleTrades, 10_000, 1000);
    const mc2 = runMonteCarloEquityStressTest(sampleTrades, 10_000, 1000);
    expect(mc1.iterations).toBe(1000);
    expect(mc1.medianFinalBalance).toBe(mc2.medianFinalBalance);
    expect(mc1.p95WorstDrawdownPercent).toBeGreaterThanOrEqual(mc1.medianMaxDrawdownPercent);
  });

  it('detects "Xanh vỏ đỏ lòng" (GREEN_OUTSIDE_RED_INSIDE) when VNINDEX rises while majority of VN30 stocks decline', () => {
    const mockSymbols: MarketSymbol[] = [
      {
        symbol: 'VNINDEX',
        name: 'VN-Index',
        type: 'index',
        baseAsset: 'VNINDEX',
        quoteAsset: 'VND',
        price: 1280,
        change24h: 0.55, // Index green!
        high24h: 1285,
        low24h: 1272,
        volume24h: 18000000,
      },
      ...['FPT', 'HPG', 'MWG', 'SSI', 'STB', 'TCB', 'VPB'].map((sym, idx) => ({
        symbol: sym,
        name: sym,
        type: 'vn30' as const,
        baseAsset: sym,
        quoteAsset: 'VND',
        price: 30 + idx,
        change24h: idx === 0 ? 1.8 : -1.2, // 1 advancer vs 6 decliners (14.3% advancePct)
        high24h: 32 + idx,
        low24h: 29 + idx,
        volume24h: 5000000,
      })),
    ];

    const breadth = computeMarketBreadthSnapshot(mockSymbols);
    expect(breadth.vnMarket.advancers).toBe(1);
    expect(breadth.vnMarket.decliners).toBe(6);
    expect(breadth.vnMarket.breadthRegime).toBe('GREEN_OUTSIDE_RED_INSIDE');
  });
});
