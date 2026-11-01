import { describe, expect, it } from 'vitest';
import { evaluateChartRecommendation } from '../chartVerdictEngine';
import { generateStrategyHub } from '../signalGenerator';
import { AIPrediction, Candle, MarketSymbol } from '../../../types';
import { VnStockInsightsPayload } from '../../vnMarket/vnStockInsightsClient';
import { GlobalMarketInsightsResponse } from '../../globalMarket/globalMarketInsightsClient';

function buildTrendCandles(
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
    const close = Math.max(1, price + stepPerBar + (i % 3 === 0 ? stepPerBar * 0.2 : 0));
    const span = Math.max(Math.abs(stepPerBar) * 2.2, price * 0.008);
    const high = bullishWicks ? close + span * 0.18 : Math.max(open, close) + span * 0.75;
    const low = bullishWicks ? Math.min(open, close) - span * 0.72 : close - span * 0.15;
    out.push({
      time: baseTime + i * 3600,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 150_000 + i * 2_500,
    });
    price = close;
  }
  return out;
}

function buildMockAiPrediction(
  symbol: string,
  currentPrice: number,
  expPct: number,
  wfAcc: number = 72
): AIPrediction {
  const isBull = expPct >= 0;
  return {
    symbol,
    currentPrice,
    trend: expPct >= 2 ? 'STRONG_BULLISH' : isBull ? 'BULLISH' : 'STRONG_BEARISH',
    confidenceScore: 82,
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
      directionalAccuracy: wfAcc,
      mapePercent: 1.2,
      rmse: 0.8,
      anchorTime: 1_760_000_000,
      anchorPrice: currentPrice,
      backtestPath: [],
      grade: 'EXCELLENT',
    },
    scenarios: [],
    volatilityForecast: 1.8,
    aiReasoning: [],
    keyDrivers: [],
  };
}

describe('Unified 6-Pillar Chart Recommendation Engine', () => {
  it('produces STRONG_BUY with HOSE tick-normalized levels when MTF, VPVR, Kronos & Foreign Flow align on FPT', () => {
    const candles1h = buildTrendCandles(80, 118, 0.22, true);
    const lastPrice = candles1h[candles1h.length - 1].close;
    const fptSymbol: MarketSymbol = {
      symbol: 'FPT',
      name: 'FPT Corp',
      type: 'vn30',
      baseAsset: 'FPT',
      quoteAsset: 'VND',
      price: lastPrice,
      change24h: 2.4,
      high24h: lastPrice * 1.01,
      low24h: lastPrice * 0.98,
      volume24h: 4_500_000,
    };
    const vnIdxSymbol: MarketSymbol = {
      symbol: 'VNINDEX',
      name: 'VN-Index',
      type: 'index',
      baseAsset: 'VNINDEX',
      quoteAsset: 'VND',
      price: 1280,
      change24h: 0.5,
      high24h: 1285,
      low24h: 1272,
      volume24h: 650_000_000,
    };

    const vnInsights: VnStockInsightsPayload = {
      ok: true,
      fetchedAtMs: Date.now(),
      symbol: 'FPT',
      sourcesUsed: ['VNDirect'],
      foreignFlow: {
        symbol: 'FPT',
        floor: 'HOSE',
        latestDate: '2026-11-01',
        latestNetBillionVnd: 165.4,
        latestNetVol: 1_200_000,
        total10dNetBillionVnd: 620.0,
        consecutiveNetBuyDays: 5,
        consecutiveNetSellDays: 0,
        remainingRoomPct: 1.2,
        currentRoomShares: 12_000_000,
        totalRoomShares: 500_000_000,
        sessions: [],
      },
      marketLeaders: { tradingDate: '2026-11-01', topBuy: [], topSell: [] },
      fundamentals: {
        symbol: 'FPT',
        companyNameVi: 'CTCP FPT',
        industryName: 'Công nghệ',
        exchange: 'HOSE',
        peRatio: 13.8,
        pbRatio: 3.2,
        roePct: 26.5,
        roaPct: 11.2,
        epsVnd: 8500,
        marketCapTrillionVnd: 195,
        dividendYieldPct: 2.1,
        revenueGrowthQoqPct: 19.4,
        netIncomeGrowthQoqPct: 21.2,
        officialRefPrice: lastPrice / 1.024,
        officialCeilingPrice: (lastPrice / 1.024) * 1.07,
        officialFloorPrice: (lastPrice / 1.024) * 0.93,
        avgVolume10d: 4_000_000,
        source: 'SSI',
      },
    };

    const verdict = evaluateChartRecommendation({
      symbolObj: fptSymbol,
      candles: candles1h,
      timeframe: '1h',
      mtfCandlesMap: {
        '15m': candles1h,
        '1h': candles1h,
        '4h': candles1h,
        '1D': candles1h,
      },
      aiPrediction: buildMockAiPrediction('FPT', lastPrice, 3.4, 76),
      vnInsights,
      allSymbols: [fptSymbol, vnIdxSymbol],
    });

    expect(verdict.pillars).toHaveLength(6);
    expect(['STRONG_BUY', 'ACCUMULATE_LIMIT']).toContain(verdict.verdictCode);
    expect(verdict.convictionScore).toBeGreaterThanOrEqual(65);
    expect(verdict.stopLoss).toBeLessThan(verdict.entryZone[0]);
    expect(verdict.takeProfit2).toBeGreaterThan(verdict.takeProfit1);
    // HOSE >= 50k VND must round to 0.1k (100 VND) tick step
    expect(Number((verdict.stopLoss * 10).toFixed(4)) % 1).toBe(0);
    expect(verdict.bullishDriversVi.some((d) => d.includes('Khối ngoại mua ròng'))).toBe(true);
  });

  it('triggers STAND_ASIDE_VETO when a US stock has imminent Earnings (<= 2 days) despite bullish chart', () => {
    const candles = buildTrendCandles(80, 190, 0.35, true);
    const lastPrice = candles[candles.length - 1].close;
    const nvda: MarketSymbol = {
      symbol: 'NVDA',
      name: 'NVIDIA Corp',
      type: 'stock',
      baseAsset: 'NVDA',
      quoteAsset: 'USD',
      price: lastPrice,
      change24h: 3.1,
      high24h: lastPrice * 1.02,
      low24h: lastPrice * 0.97,
      volume24h: 45_000_000,
    };

    const globalInsights: GlobalMarketInsightsResponse = {
      ok: true,
      marketKind: 'us_global',
      fetchedAtMs: Date.now(),
      symbol: 'NVDA',
      sourcesUsed: ['Yahoo', 'CBOE'],
      perpCarry: null,
      usQuote: {
        symbol: 'NVDA',
        regularPrice: lastPrice,
        prevClose: lastPrice / 1.031,
        preMarketPrice: null,
        preMarketChangePct: null,
        postMarketPrice: lastPrice * 1.01,
        postMarketChangePct: 1.0,
        earningsDateIso: '2026-11-02',
        daysToEarnings: 1,
        earningsSession: 'AMC',
        exDividendDateIso: null,
        forwardPe: 28.5,
        shortFloatPct: 1.2,
        analystTargetPrice: lastPrice * 1.25,
        marketCapBillionUsd: 4800,
      },
      optionsSummary: {
        exchange: 'CBOE',
        underlyingSymbol: 'NVDA',
        underlyingSpotUsd: lastPrice,
        iv30Pct: 58.4,
        iv30ChangePct: 4.2,
        primaryExpiryIso: '2026-11-06',
        maxPainPrice: Math.round(lastPrice),
        callWallPrice: Math.round(lastPrice * 1.06),
        callWallOi: 45000,
        putWallPrice: Math.round(lastPrice * 0.94),
        putWallOi: 32000,
        putCallOiRatio: 0.71,
        totalCallOi: 210000,
        totalPutOi: 150000,
        impliedMovePct: 6.8,
        netGexMillionUsd: 24.5,
        gammaRegime: 'POSITIVE_GAMMA_PIN',
        gammaHeadlineVi: 'Gamma Dương',
        actionableNoteVi: 'Pinning',
      },
      cryptoMacro: null,
      upcomingUsEarnings: [],
    };

    const verdict = evaluateChartRecommendation({
      symbolObj: nvda,
      candles,
      timeframe: '1h',
      mtfCandlesMap: { '1h': candles, '4h': candles, '1D': candles },
      aiPrediction: buildMockAiPrediction('NVDA', lastPrice, 4.1, 74),
      globalInsights,
    });

    expect(verdict.verdictCode).toBe('STAND_ASIDE_VETO');
    expect(verdict.signalAction).toBe('WAIT');
    expect(verdict.suggestedAllocationPct).toBe(0);
    expect(verdict.vetoes.some((v) => v.code === 'US_IMMINENT_EARNINGS')).toBe(true);

    // In Replay mode, live earnings veto must NOT leak into historical bars
    const replayVerdict = evaluateChartRecommendation({
      symbolObj: nvda,
      candles,
      timeframe: '1h',
      mtfCandlesMap: { '1h': candles, '4h': candles, '1D': candles },
      aiPrediction: buildMockAiPrediction('NVDA', lastPrice, 4.1, 74),
      globalInsights,
      isReplayMode: true,
    });
    expect(replayVerdict.isReplayMode).toBe(true);
    expect(replayVerdict.vetoes.some((v) => v.code === 'US_IMMINENT_EARNINGS')).toBe(false);
    expect(['STRONG_BUY', 'ACCUMULATE_LIMIT']).toContain(replayVerdict.verdictCode);
  });

  it('enforces Vietnam ceiling FOMO veto and distinguishes Spot REDUCE_TAKE_PROFIT on HPG vs SELL_SHORT on VN30F1M', () => {
    // 1. Ceiling chase veto on SSI (+6.6% on HOSE, 0.38% away from +7% ceiling)
    const bullCandles = buildTrendCandles(70, 32, 0.06, true);
    const ssiPrice = bullCandles[bullCandles.length - 1].close;
    const ssiRef = ssiPrice / 1.066;
    const ssi: MarketSymbol = {
      symbol: 'SSI',
      name: 'SSI Securities',
      type: 'vn30',
      baseAsset: 'SSI',
      quoteAsset: 'VND',
      price: ssiPrice,
      change24h: 6.6,
      high24h: ssiPrice,
      low24h: ssiRef,
      volume24h: 22_000_000,
    };

    const ssiVerdict = evaluateChartRecommendation({
      symbolObj: ssi,
      candles: bullCandles,
      timeframe: '1h',
      mtfCandlesMap: { '1h': bullCandles, '4h': bullCandles, '1D': bullCandles },
      aiPrediction: buildMockAiPrediction('SSI', ssiPrice, 3.0, 75),
    });

    expect(ssiVerdict.vetoes.some((v) => v.code === 'VN_NEAR_CEILING_T25')).toBe(true);
    expect(ssiVerdict.verdictCode).toBe('ACCUMULATE_LIMIT');

    // 2. Bearish HPG (cannot short corporate HOSE stock) vs Bearish VN30F1M (can short derivative)
    const bearCandles = buildTrendCandles(80, 30, -0.09, false);
    const bearPrice = bearCandles[bearCandles.length - 1].close;

    const hpg: MarketSymbol = {
      symbol: 'HPG',
      name: 'Hoa Phat Group',
      type: 'vn30',
      baseAsset: 'HPG',
      quoteAsset: 'VND',
      price: bearPrice,
      change24h: -3.4,
      high24h: bearPrice * 1.04,
      low24h: bearPrice * 0.99,
      volume24h: 30_000_000,
    };

    const hpgVerdict = evaluateChartRecommendation({
      symbolObj: hpg,
      candles: bearCandles,
      timeframe: '1h',
      mtfCandlesMap: { '1h': bearCandles, '4h': bearCandles, '1D': bearCandles },
      aiPrediction: buildMockAiPrediction('HPG', bearPrice, -3.5, 74),
    });

    expect(hpgVerdict.canShortAsset).toBe(false);
    expect(hpgVerdict.verdictCode).toBe('REDUCE_TAKE_PROFIT');
    expect(hpgVerdict.isShortPlan).toBe(false);

    const f1mCandles = buildTrendCandles(80, 1360, -2.2, false);
    const f1mPrice = f1mCandles[f1mCandles.length - 1].close;
    const vn30f1m: MarketSymbol = {
      symbol: 'VN30F1M',
      name: 'VN30 Futures 1M',
      type: 'index',
      baseAsset: 'VN30F1M',
      quoteAsset: 'VND',
      price: f1mPrice,
      change24h: -1.8,
      high24h: f1mPrice + 20,
      low24h: f1mPrice - 3,
      volume24h: 240_000,
    };

    const f1mVerdict = evaluateChartRecommendation({
      symbolObj: vn30f1m,
      candles: f1mCandles,
      timeframe: '15m',
      mtfCandlesMap: { '15m': f1mCandles, '1h': f1mCandles, '4h': f1mCandles },
      aiPrediction: buildMockAiPrediction('VN30F1M', f1mPrice, -2.4, 72),
    });

    expect(f1mVerdict.canShortAsset).toBe(true);
    expect(f1mVerdict.verdictCode).toBe('SELL_SHORT');
    expect(f1mVerdict.isShortPlan).toBe(true);
  });

  it('prevents market FOMO on Crypto when 8h Funding is overheated and syncs into generateStrategyHub', () => {
    const btcCandles = buildTrendCandles(80, 74_000, 55, true);
    const btcPrice = btcCandles[btcCandles.length - 1].close;
    const btc: MarketSymbol = {
      symbol: 'BTCUSDT',
      name: 'Bitcoin',
      type: 'crypto',
      baseAsset: 'BTC',
      quoteAsset: 'USD',
      price: btcPrice,
      change24h: 4.2,
      high24h: btcPrice * 1.01,
      low24h: btcPrice * 0.96,
      volume24h: 28_000_000_000,
    };

    const hotCryptoInsights: GlobalMarketInsightsResponse = {
      ok: true,
      marketKind: 'crypto',
      fetchedAtMs: Date.now(),
      symbol: 'BTCUSDT',
      sourcesUsed: ['Binance', 'Deribit'],
      perpCarry: {
        perpSymbol: 'BTCUSDT',
        markPrice: btcPrice * 1.002,
        indexPrice: btcPrice,
        fundingRate8hPct: 0.068,
        annualizedFundingPct: 74.46,
        perpSpotBasisPct: 0.2,
        nextFundingTimeMs: Date.now() + 7200_000,
      },
      usQuote: null,
      optionsSummary: {
        exchange: 'Deribit',
        underlyingCurrency: 'BTC',
        isDirectUnderlying: true,
        underlyingSpotUsd: btcPrice,
        dvol30dPct: 48.2,
        totalNotionalBillionUsd: 14.5,
        primaryExpiryIso: '2026-11-27',
        maxPainPrice: Math.round(btcPrice * 0.97),
        callWallPrice: Math.round(btcPrice * 1.03),
        callWallOi: 8400,
        putWallPrice: Math.round(btcPrice * 0.94),
        putWallOi: 6100,
        putCallOiRatio: 0.68,
        totalCallOi: 45000,
        totalPutOi: 30600,
        impliedMovePct: 4.5,
        netGexMillionUsd: 35,
        gammaRegime: 'POSITIVE_GAMMA_PIN',
        gammaHeadlineVi: 'Gamma Dương',
        actionableNoteVi: 'Pin',
      },
      cryptoMacro: null,
      upcomingUsEarnings: [],
    };

    const verdict = evaluateChartRecommendation({
      symbolObj: btc,
      candles: btcCandles,
      timeframe: '1h',
      mtfCandlesMap: { '1h': btcCandles, '4h': btcCandles, '1D': btcCandles },
      aiPrediction: buildMockAiPrediction('BTCUSDT', btcPrice, 2.5, 70),
      globalInsights: hotCryptoInsights,
      allSymbols: [btc],
    });

    expect(verdict.vetoes.some((v) => v.code === 'CRYPTO_HOT_FUNDING')).toBe(true);
    expect(verdict.verdictCode).toBe('ACCUMULATE_LIMIT');

    const hub = generateStrategyHub('BTCUSDT', btcCandles, '1h', null, btc, verdict);
    expect(hub.bestStrategy.id).toBe('unified_institutional_verdict');
    expect(hub.strategies[0].id).toBe('unified_institutional_verdict');
    expect(hub.bestStrategy.action).toBe(verdict.signalAction);
  });
});
