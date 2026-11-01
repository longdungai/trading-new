import { beforeEach, describe, expect, it } from 'vitest';
import { computeVnGoldFxArbitrage, TROY_OZ_PER_VN_TAEL } from '../macro/vnGoldFxArbitrage';
import {
  buildIntermarketCorrelationMatrix,
  calculatePearsonCorrelation,
  computeSectorRotation,
} from '../analysis/intermarketCorrelation';
import { evaluateAlertRulesPure, SmartAlertRule } from '../alerts/smartAlertCenter';
import {
  calculatePaperPortfolioAnalytics,
  exportPaperTradesToCsv,
  saveUserPaperTrades,
  syncAllPaperTradesWithMarket,
  UserPaperTrade,
} from '../paperTrading/userPaperTrading';
import { DEFAULT_SYMBOLS } from '../api/marketData';
import { Candle, MacroIntelligenceSnapshot } from '../../types';

// Minimal in-memory localStorage polyfill for Node Vitest environment
const memoryStore = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
      setItem: (k: string, v: string) => {
        memoryStore.set(k, String(v));
      },
      removeItem: (k: string) => {
        memoryStore.delete(k);
      },
      clear: () => memoryStore.clear(),
    },
    configurable: true,
  });
}

describe('Advanced Terminal Upgrades — Quantitative & Execution Integrity', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('computes exact Vietnam Gold parity (1 tael = 1.205653 oz) and flags extreme domestic premium', () => {
    const mockMacro: MacroIntelligenceSnapshot = {
      updatedAt: Date.now(),
      regime: 'NEUTRAL',
      regimeLabel: 'Trung lập',
      regimeScore: 0,
      kellyDamper: 1,
      yieldCurveSpread: 0.25,
      indicators: [
        {
          id: 'USDVND',
          label: 'USD/VND',
          shortLabel: 'USD/VND',
          value: 25400,
          displayValue: '25,400',
          changePercent: 0.1,
          status: 'NORMAL',
          impactSummary: '',
          source: 'Yahoo',
        },
        {
          id: 'DXY',
          label: 'DXY',
          shortLabel: 'DXY',
          value: 106.2,
          displayValue: '106.2',
          changePercent: 0.6,
          status: 'STRESS',
          impactSummary: '',
          source: 'Yahoo',
        },
        {
          id: 'US10Y',
          label: 'US10Y',
          shortLabel: 'US10Y',
          value: 4.55,
          displayValue: '4.55%',
          changePercent: 0.4,
          status: 'ELEVATED',
          impactSummary: '',
          source: 'Yahoo',
        },
      ],
      globalAlerts: [],
      upcomingEvents: [],
    };

    const customSymbols = DEFAULT_SYMBOLS.map(s =>
      s.symbol === 'XAUUSD' ? { ...s, price: 2700 } : s
    );

    const expectedRawMillion = parseFloat(
      ((2700 * TROY_OZ_PER_VN_TAEL * 25400) / 1_000_000).toFixed(2)
    );

    const res = computeVnGoldFxArbitrage({
      symbols: customSymbols,
      macroSnapshot: mockMacro,
      dealerInput: {
        sjcSellMillion: expectedRawMillion * 1.15, // +15% above parity
        ring9999SellMillion: expectedRawMillion * 1.02,
        customUsdVndFreeMarket: null,
        updatedAtMs: Date.now(),
      },
    });

    expect(res).not.toBeNull();
    expect(res!.worldRawMillionPerTael).toBeCloseTo(expectedRawMillion, 1);
    expect(res!.sjcComparison?.regime).toBe('EXTREME_PREMIUM');
    expect(res!.ring9999Comparison?.regime).toBe('FAIR_SPREAD');
    expect(res!.fxPressureScore).toBeGreaterThanOrEqual(72);
    expect(res!.fxPressureRegime).toBe('HIGH_OUTFLOW_RISK');
  });

  it('computes Pearson log-return correlation, detects intermarket divergence, and ranks VN30 sectors', () => {
    const baseCloses: number[] = [100];
    const sameCloses: number[] = [250];
    const invCloses: number[] = [100];
    for (let i = 1; i < 35; i++) {
      const logRet = 0.02 * Math.sin(i * 1.1) + 0.003;
      baseCloses.push(baseCloses[i - 1] * Math.exp(logRet));
      sameCloses.push(sameCloses[i - 1] * Math.exp(logRet));
      invCloses.push(invCloses[i - 1] * Math.exp(-logRet));
    }

    expect(calculatePearsonCorrelation(baseCloses, sameCloses, 30)).toBeCloseTo(1, 2);
    expect(calculatePearsonCorrelation(baseCloses, invCloses, 30)).toBeCloseTo(-1, 2);

    // Build two correlated 30-bar series where the last 5 bars diverge sharply
    const mkCandles = (closes: number[]): Candle[] =>
      closes.map((c, idx) => ({
        time: 1700000000 + idx * 86400,
        open: c,
        high: c * 1.005,
        low: c * 0.995,
        close: c,
        volume: 1000,
      }));

    const seriesA: number[] = [100];
    const seriesB: number[] = [200];
    for (let i = 1; i <= 32; i++) {
      const ret = i % 2 === 0 ? 1.018 : 0.988;
      seriesA.push(seriesA[i - 1] * ret);
      // Diverge only on the final 3 bars while preserving strong overall 30-bar positive r
      const retB = i >= 30 ? 0.985 : ret;
      seriesB.push(seriesB[i - 1] * retB);
    }
    // Boost last bar of A so 5-bar return of A is strongly positive while B is negative
    seriesA[32] = seriesA[27] * 1.045;
    seriesB[32] = seriesB[27] * 0.975;

    const matrixRes = buildIntermarketCorrelationMatrix([
      { symbol: 'XAUUSD', label: 'Gold', candles: mkCandles(seriesA) },
      { symbol: 'BTCUSDT', label: 'Bitcoin', candles: mkCandles(seriesB) },
    ]);

    expect(matrixRes.matrix.XAUUSD.BTCUSDT).toBeGreaterThan(0.55);
    expect(matrixRes.divergences.length).toBe(1);

    const sectors = computeSectorRotation(DEFAULT_SYMBOLS);
    expect(sectors.length).toBeGreaterThanOrEqual(6);
    expect(sectors.some(s => s.sectorId === 'VN_BANKS')).toBe(true);
  });

  it('evaluates Smart Alert rules deterministically with one-shot disable & cooldown anti-spam', () => {
    const nowMs = 1_760_000_000_000;
    const rules: SmartAlertRule[] = [
      {
        id: 'r1',
        symbol: 'BTCUSDT',
        condition: 'PRICE_ABOVE',
        threshold: 75000,
        enabled: true,
        oneShot: true,
        cooldownMinutes: 30,
        createdAtMs: nowMs - 10_000,
      },
      {
        id: 'r2',
        symbol: 'BTCUSDT',
        condition: 'CHANGE_24H_ABOVE',
        threshold: 0.5,
        enabled: true,
        oneShot: false,
        cooldownMinutes: 30,
        lastTriggeredAtMs: nowMs - 5 * 60_000, // Within 30m cooldown -> must NOT re-fire!
        createdAtMs: nowMs - 600_000,
      },
    ];

    const out = evaluateAlertRulesPure({
      rules,
      symbols: DEFAULT_SYMBOLS, // BTCUSDT default price is > 75000 and change24h > 0.5
      nowMs,
    });

    expect(out.newlyTriggered.length).toBe(1);
    expect(out.newlyTriggered[0].ruleId).toBe('r1');
    // One-shot rule r1 is automatically disabled after firing
    expect(out.updatedRules.find(r => r.id === 'r1')?.enabled).toBe(false);
  });

  it('prevents false Paper Trade fills on closed exchanges (Sunday VN30) while executing 24/7 Crypto & computing Equity Curve', () => {
    const sundayUtc = new Date('2026-11-01T04:00:00Z'); // Sunday 11:00 GMT+7 (HOSE closed, Binance open)

    const initialTrades: UserPaperTrade[] = [
      {
        id: 't_fpt_pending',
        symbol: 'FPT',
        strategyName: 'Pullback EMA20',
        action: 'BUY',
        entryType: 'limit',
        entryPrice: 999, // Even though FPT price (72.2) <= 999, HOSE is CLOSED on Sunday!
        stopLoss: 65,
        takeProfit: 85,
        tpTargetLabel: 'TP2',
        capital: 10000000,
        leverage: 1,
        openTime: sundayUtc.getTime() - 3600_000,
        status: 'PENDING',
        pnlAmount: 0,
        pnlPercent: 0,
        quoteAsset: 'VND',
      },
      {
        id: 't_btc_open',
        symbol: 'BTCUSDT',
        strategyName: 'Breakout Kronos',
        action: 'BUY',
        entryType: 'market',
        entryPrice: 70000,
        stopLoss: 68000,
        takeProfit: 75000, // BTCUSDT price (~79842) >= 75000 and Binance is OPEN 24/7 -> TP_HIT!
        tpTargetLabel: 'TP2',
        capital: 1000,
        leverage: 2,
        openTime: sundayUtc.getTime() - 7200_000,
        filledTime: sundayUtc.getTime() - 7200_000,
        status: 'OPEN',
        pnlAmount: 0,
        pnlPercent: 0,
        quoteAsset: 'USDT',
      },
    ];

    saveUserPaperTrades(initialTrades);
    const { trades, statusTransitionEvents } = syncAllPaperTradesWithMarket(
      DEFAULT_SYMBOLS,
      sundayUtc
    );

    const fptAfter = trades.find(t => t.id === 't_fpt_pending')!;
    const btcAfter = trades.find(t => t.id === 't_btc_open')!;

    expect(fptAfter.status).toBe('PENDING'); // Protected by exchange session guard!
    expect(btcAfter.status).toBe('TP_HIT');
    expect(statusTransitionEvents.length).toBe(1);

    const analytics = calculatePaperPortfolioAnalytics(trades);
    expect(analytics.closedCount).toBe(1);
    expect(analytics.winRatePct).toBe(100);
    expect(analytics.equityCurve.length).toBe(2);

    const csv = exportPaperTradesToCsv(trades);
    expect(csv).toContain('BTCUSDT');
    expect(csv).toContain('TP_HIT');
  });
});
