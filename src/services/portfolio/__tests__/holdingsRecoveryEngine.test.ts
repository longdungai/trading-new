import { describe, expect, it } from 'vitest';
import {
  evaluatePositionRecovery,
  normalizeHoldingInputPrice,
  UserHoldingItem,
} from '../holdingsRecoveryEngine';
import { evaluateChartRecommendation } from '../../ai/chartVerdictEngine';
import { AIPrediction, Candle, MarketSymbol } from '../../../types';
import { GlobalMarketInsightsResponse } from '../../globalMarket/globalMarketInsightsClient';

function buildCandles(
  count: number,
  startPrice: number,
  stepPerBar: number,
  bullishWicks: boolean = true
): Candle[] {
  const baseTime = 1_760_000_000;
  const out: Candle[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const open = price;
    const close = Math.max(1, price + stepPerBar + (i % 4 === 0 ? stepPerBar * 0.15 : 0));
    const span = Math.max(Math.abs(stepPerBar) * 2.2, price * 0.008);
    const high = bullishWicks ? close + span * 0.2 : Math.max(open, close) + span * 0.7;
    const low = bullishWicks ? Math.min(open, close) - span * 0.7 : close - span * 0.18;
    out.push({
      time: baseTime + i * 3600,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 180_000 + i * 2_000,
    });
    price = close;
  }
  return out;
}

function buildAiMock(symbol: string, currentPrice: number, expPct: number): AIPrediction {
  return {
    symbol,
    currentPrice,
    trend: expPct >= 2 ? 'STRONG_BULLISH' : expPct >= 0 ? 'BULLISH' : 'STRONG_BEARISH',
    confidenceScore: 80,
    expectedPriceChangePercent: expPct,
    forecastHorizonBars: 12,
    upperConfidenceBound: [],
    lowerConfidenceBound: [],
    medianForecast: [],
    predictedCandles: [],
    kronosMeta: {
      modelName: 'Kronos-small',
      params: '24.7M',
      contextLength: 512,
      engineMode: 'KRONOS_LOCAL_TRANSFORMER',
      s1Bits: 10,
      s2Bits: 10,
      tokenEntropy: 0.85,
      latencyMs: 2,
    },
    walkForward: {
      holdoutBars: 12,
      directionalAccuracy: 71,
      mapePercent: 1.3,
      rmse: 0.8,
      anchorTime: 1_760_000_000,
      anchorPrice: currentPrice,
      backtestPath: [],
      grade: 'GOOD',
    },
    scenarios: [],
    volatilityForecast: 1.9,
    aiReasoning: [],
    keyDrivers: [],
  };
}

describe('Position Recovery ("Chiến Lược Về Bờ") & True Net Break-Even Engine', () => {
  it('auto-normalizes VN corporate stock prices (145000 -> 145) and computes SMART_DCA_AT_SUPPORT with 100-share lots', () => {
    expect(normalizeHoldingInputPrice(145000, 'FPT', 130)).toBe(145);
    expect(normalizeHoldingInputPrice(145.5, 'FPT', 130)).toBe(145.5);

    const candles = buildCandles(80, 114, 0.2, true);
    const currentPrice = candles[candles.length - 1].close; // ~130.6
    const fptSym: MarketSymbol = {
      symbol: 'FPT',
      name: 'FPT Corp',
      type: 'vn30',
      baseAsset: 'FPT',
      quoteAsset: 'VND',
      price: currentPrice,
      change24h: 1.8,
      high24h: currentPrice * 1.02,
      low24h: currentPrice * 0.98,
      volume24h: 5_000_000,
    };

    const verdict = evaluateChartRecommendation({
      symbolObj: fptSym,
      candles,
      timeframe: '1h',
      mtfCandlesMap: { '15m': candles, '1h': candles, '4h': candles, '1D': candles },
      aiPrediction: buildAiMock('FPT', currentPrice, 3.6),
    });

    const holding: UserHoldingItem = {
      symbol: 'FPT',
      quantity: 2000,
      avgCostPrice: 148000, // Full VND entered by investor -> auto-normalized to 148.0k
      marginRatioPct: 30,
      holdingDays: 45,
      extraDcaBudget: null,
      updatedAtMs: Date.now(),
    };

    const plan = evaluatePositionRecovery({
      holding,
      symbolObj: fptSym,
      candles,
      chartVerdict: verdict,
    });

    expect(plan.holding.avgCostPrice).toBe(148);
    // True break-even must exceed raw 148.0k due to 0.15% buy fee + 0.25% sell fee/tax + 45d margin interest
    expect(plan.trueBreakEvenPrice).toBeGreaterThan(148.5);
    expect(plan.netUnrealizedPnlPct).toBeLessThan(-10);
    expect(plan.primaryMode).toBe('SMART_DCA_AT_SUPPORT');
    expect(plan.smartDcaPlan.allowed).toBe(true);
    // HOSE board lot must be multiple of 100 shares
    expect(plan.smartDcaPlan.addQuantity % 100).toBe(0);
    expect(plan.smartDcaPlan.newTrueBreakEvenPrice).toBeLessThan(plan.trueBreakEvenPrice);
    expect(plan.smartDcaPlan.newGainNeededPct).toBeLessThan(plan.smartDcaPlan.oldGainNeededPct);
  });

  it('triggers ANTI_FALLING_KNIFE_VETO and blocks DCA when 6-pillar bias is bearish or US Earnings <= 2d', () => {
    const downCandles = buildCandles(80, 96_000, -140, false);
    const currentPrice = downCandles[downCandles.length - 1].close;
    const btcSym: MarketSymbol = {
      symbol: 'BTCUSDT',
      name: 'Bitcoin',
      type: 'crypto',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      price: currentPrice,
      change24h: -5.4,
      high24h: currentPrice * 1.05,
      low24h: currentPrice * 0.98,
      volume24h: 1_200_000_000,
    };

    const bearishVerdict = evaluateChartRecommendation({
      symbolObj: btcSym,
      candles: downCandles,
      timeframe: '1h',
      mtfCandlesMap: {
        '15m': downCandles,
        '1h': downCandles,
        '4h': downCandles,
        '1D': downCandles,
      },
      aiPrediction: buildAiMock('BTCUSDT', currentPrice, -4.5),
    });

    const btcHolding: UserHoldingItem = {
      symbol: 'BTCUSDT',
      quantity: 0.5,
      avgCostPrice: currentPrice * 1.16,
      marginRatioPct: 0,
      holdingDays: 10,
      extraDcaBudget: 15_000,
      updatedAtMs: Date.now(),
    };

    const btcPlan = evaluatePositionRecovery({
      holding: btcHolding,
      symbolObj: btcSym,
      candles: downCandles,
      chartVerdict: bearishVerdict,
    });

    expect(btcPlan.primaryMode).toBe('ANTI_FALLING_KNIFE_VETO');
    expect(btcPlan.smartDcaPlan.allowed).toBe(false);
    expect(btcPlan.defensiveTrimPlan.extraUnitsReacquired).toBeGreaterThan(0);

    // US Earnings Hard Veto test on NVDA even in bullish trend
    const upCandles = buildCandles(80, 122, 0.25, true);
    const nvdaPrice = upCandles[upCandles.length - 1].close;
    const nvdaSym: MarketSymbol = {
      symbol: 'NVDA',
      name: 'NVIDIA',
      type: 'stock',
      baseAsset: 'NVDA',
      quoteAsset: 'USD',
      price: nvdaPrice,
      change24h: 1.5,
      high24h: nvdaPrice * 1.02,
      low24h: nvdaPrice * 0.98,
      volume24h: 40_000_000,
    };

    const imminentEarningsInsights: GlobalMarketInsightsResponse = {
      ok: true,
      marketKind: 'us_global',
      fetchedAtMs: Date.now(),
      symbol: 'NVDA',
      sourcesUsed: ['Yahoo'],
      perpCarry: null,
      optionsSummary: null,
      cryptoMacro: null,
      upcomingUsEarnings: [],
      usQuote: {
        symbol: 'NVDA',
        regularPrice: nvdaPrice,
        prevClose: nvdaPrice / 1.015,
        preMarketPrice: null,
        preMarketChangePct: null,
        postMarketPrice: null,
        postMarketChangePct: null,
        earningsDateIso: '2026-11-02',
        daysToEarnings: 1,
        earningsSession: 'AMC',
        exDividendDateIso: null,
        forwardPe: 28,
        shortFloatPct: 1.2,
        analystTargetPrice: nvdaPrice * 1.15,
        marketCapBillionUsd: 4800,
      },
    };

    const nvdaVerdict = evaluateChartRecommendation({
      symbolObj: nvdaSym,
      candles: upCandles,
      timeframe: '1h',
      mtfCandlesMap: { '1h': upCandles, '4h': upCandles },
      aiPrediction: buildAiMock('NVDA', nvdaPrice, 3.2),
      globalInsights: imminentEarningsInsights,
    });

    const nvdaPlan = evaluatePositionRecovery({
      holding: {
        symbol: 'NVDA',
        quantity: 50,
        avgCostPrice: nvdaPrice * 1.1,
        marginRatioPct: 0,
        holdingDays: 14,
        extraDcaBudget: 2500,
        updatedAtMs: Date.now(),
      },
      symbolObj: nvdaSym,
      candles: upCandles,
      chartVerdict: nvdaVerdict,
    });

    expect(nvdaPlan.primaryMode).toBe('ANTI_FALLING_KNIFE_VETO');
    expect(nvdaPlan.smartDcaPlan.allowed).toBe(false);
    expect(nvdaPlan.t0SurfPlan.eligible).toBe(false);
  });

  it('enforces Vietnam T+2.5 settlement check on T0_INVENTORY_SURFING and computes net cash earned per cycle', () => {
    const flatCandles = buildCandles(80, 26.0, 0.01, true);
    const currentPrice = flatCandles[flatCandles.length - 1].close;
    const hpgSym: MarketSymbol = {
      symbol: 'HPG',
      name: 'Hoa Phat Group',
      type: 'vn30',
      baseAsset: 'HPG',
      quoteAsset: 'VND',
      price: currentPrice,
      change24h: 0.2,
      high24h: currentPrice * 1.015,
      low24h: currentPrice * 0.985,
      volume24h: 18_000_000,
    };

    const neutralVerdict = evaluateChartRecommendation({
      symbolObj: hpgSym,
      candles: flatCandles,
      timeframe: '1h',
    });

    // Unsettled T+1 shares -> T+0 surf must be ineligible
    const unsettledPlan = evaluatePositionRecovery({
      holding: {
        symbol: 'HPG',
        quantity: 3000,
        avgCostPrice: currentPrice * 1.09,
        marginRatioPct: 0,
        holdingDays: 1,
        extraDcaBudget: 0,
        updatedAtMs: Date.now(),
      },
      symbolObj: hpgSym,
      candles: flatCandles,
      chartVerdict: neutralVerdict,
    });
    expect(unsettledPlan.t0SurfPlan.eligible).toBe(false);

    // Settled T+5 shares with 0 extra DCA budget -> T0_INVENTORY_SURFING becomes primary mode
    const settledPlan = evaluatePositionRecovery({
      holding: {
        symbol: 'HPG',
        quantity: 3000,
        avgCostPrice: currentPrice * 1.09,
        marginRatioPct: 0,
        holdingDays: 5,
        extraDcaBudget: 0,
        updatedAtMs: Date.now(),
      },
      symbolObj: hpgSym,
      candles: flatCandles,
      chartVerdict: neutralVerdict,
    });
    expect(settledPlan.t0SurfPlan.eligible).toBe(true);
    expect(settledPlan.t0SurfPlan.surfQuantity).toBe(900); // 30% of 3000, multiple of 100
    expect(settledPlan.t0SurfPlan.netCashEarnedPerCycle).toBeGreaterThan(0);
    expect(settledPlan.primaryMode).toBe('T0_INVENTORY_SURFING');
  });

  it('activates PROFIT_TRAILING_GUARD with trailing stop locked at or above trueBreakEvenPrice when in profit', () => {
    const upCandles = buildCandles(80, 115, 0.22, true);
    const currentPrice = upCandles[upCandles.length - 1].close;
    const fptSym: MarketSymbol = {
      symbol: 'FPT',
      name: 'FPT Corp',
      type: 'vn30',
      baseAsset: 'FPT',
      quoteAsset: 'VND',
      price: currentPrice,
      change24h: 2.1,
      high24h: currentPrice * 1.02,
      low24h: currentPrice * 0.98,
      volume24h: 4_200_000,
    };

    const verdict = evaluateChartRecommendation({
      symbolObj: fptSym,
      candles: upCandles,
      timeframe: '1h',
      aiPrediction: buildAiMock('FPT', currentPrice, 3.0),
    });

    const profitPlan = evaluatePositionRecovery({
      holding: {
        symbol: 'FPT',
        quantity: 1500,
        avgCostPrice: currentPrice * 0.91,
        marginRatioPct: 0,
        holdingDays: 20,
        extraDcaBudget: null,
        updatedAtMs: Date.now(),
      },
      symbolObj: fptSym,
      candles: upCandles,
      chartVerdict: verdict,
    });

    expect(profitPlan.difficultyGrade).toBe('IN_PROFIT');
    expect(profitPlan.primaryMode).toBe('PROFIT_TRAILING_GUARD');
    expect(profitPlan.trailingStopForProfit).not.toBeNull();
    expect(profitPlan.trailingStopForProfit!).toBeGreaterThanOrEqual(profitPlan.trueBreakEvenPrice);
  });
});
