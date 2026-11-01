import { BacktestResult, BacktestTrade, Candle } from '../../types';
export type { BacktestResult, BacktestTrade };
import {
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSuperTrend,
} from '../indicators';

export type StrategyType =
  | 'KRONOS_AI_FOUNDATION'
  | 'SUPERTREND_EMA'
  | 'SMC_ORDER_BLOCK'
  | 'FIBONACCI_RETRACE'
  | 'RSI_REVERSION'
  | 'BOLLINGER_BREAKOUT'
  | 'MACD_MOMENTUM'
  | 'SR_BREAKOUT'
  | 'SPOT_ACCUMULATION'
  | 'DAILY_DAYTRADING';

export type BacktestMarketProfile =
  | 'ZERO_FRICTION'
  | 'VN_EQUITY_T2'
  | 'CRYPTO_FUTURES'
  | 'GLOBAL_CFD';

export interface BacktestFrictionOptions {
  marketProfile?: BacktestMarketProfile;
  longOnly?: boolean;
  feeRatePerSide?: number; // e.g., 0.0015 = 0.15%
  sellTaxRate?: number; // e.g., 0.0010 = 0.10% VN personal income tax on stock sale
  slippageRate?: number; // e.g., 0.0005 = 0.05%
  minHoldBars?: number; // e.g., 2 bars on Daily VN30 for T+2.5 settlement
}

export interface ProBacktestResult extends BacktestResult {
  strategyKey: StrategyType;
  buyAndHoldReturnPercent: number;
  alphaVsBuyHoldPercent: number;
  totalFeesPaid: number;
  calmarRatio: number;
  expectancyPercent: number;
  marketProfileLabel: string;
}

export interface MonteCarloStressResult {
  iterations: number;
  tradeCount: number;
  medianFinalBalance: number;
  p05WorstBalance: number;
  p95BestBalance: number;
  medianReturnPercent: number;
  p05WorstReturnPercent: number;
  medianMaxDrawdownPercent: number;
  p95WorstDrawdownPercent: number;
  riskOfRuin30Percent: number; // % of paths experiencing >= 30% drawdown
}

export const ALL_STRATEGIES: StrategyType[] = [
  'KRONOS_AI_FOUNDATION',
  'SUPERTREND_EMA',
  'SMC_ORDER_BLOCK',
  'FIBONACCI_RETRACE',
  'RSI_REVERSION',
  'BOLLINGER_BREAKOUT',
  'MACD_MOMENTUM',
  'SR_BREAKOUT',
  'SPOT_ACCUMULATION',
  'DAILY_DAYTRADING',
];

export const STRATEGY_DISPLAY_NAMES: Record<StrategyType, string> = {
  KRONOS_AI_FOUNDATION: '🤖 Kronos Foundation Model (K-Line Transformer AI)',
  SUPERTREND_EMA: 'SuperTrend + EMA Golden Ribbon',
  SMC_ORDER_BLOCK: 'Smart Money (SMC) Order Block Bounce',
  FIBONACCI_RETRACE: 'Fibonacci Golden Pocket 0.618',
  RSI_REVERSION: 'RSI Đảo Chiều Quá Bán/Quá Mua',
  BOLLINGER_BREAKOUT: 'Bollinger Band Squeeze & Breakout',
  MACD_MOMENTUM: 'MACD Momentum & Zero-Lag Cross',
  SR_BREAKOUT: 'Phá Vỡ & Retest Hỗ Trợ/Kháng Cự',
  SPOT_ACCUMULATION: 'Kịch Bản Giao Dịch Spot & Tích Sản',
  DAILY_DAYTRADING: 'Kịch Bản Trading Daily (Lướt Sóng Ngày)',
};

export function resolveFrictionProfile(
  candles: Candle[],
  options?: BacktestFrictionOptions
): Required<BacktestFrictionOptions> & { label: string } {
  const profile = options?.marketProfile ?? 'ZERO_FRICTION';
  const barStepSec = candles.length >= 2 ? Math.abs(candles[1].time - candles[0].time) : 3600;
  const isDailyOrHigher = barStepSec >= 80_000;

  if (profile === 'VN_EQUITY_T2') {
    return {
      marketProfile: 'VN_EQUITY_T2',
      longOnly: options?.longOnly ?? true,
      feeRatePerSide: options?.feeRatePerSide ?? 0.0015, // 0.15% brokerage
      sellTaxRate: options?.sellTaxRate ?? 0.001, // 0.10% VN sell tax
      slippageRate: options?.slippageRate ?? 0.0005, // 0.05% spread/slippage
      minHoldBars: options?.minHoldBars ?? (isDailyOrHigher ? 2 : 0),
      label: 'Chuẩn Cơ Sở VN (Long-Only • T+2 • Phí 0.15% + Thuế 0.1%)',
    };
  }

  if (profile === 'CRYPTO_FUTURES') {
    return {
      marketProfile: 'CRYPTO_FUTURES',
      longOnly: options?.longOnly ?? false,
      feeRatePerSide: options?.feeRatePerSide ?? 0.0005, // 0.05% taker
      sellTaxRate: options?.sellTaxRate ?? 0,
      slippageRate: options?.slippageRate ?? 0.0004,
      minHoldBars: options?.minHoldBars ?? 0,
      label: 'Chuẩn Crypto Futures (Long/Short • Taker 0.05% + Trượt giá 0.04%)',
    };
  }

  if (profile === 'GLOBAL_CFD') {
    return {
      marketProfile: 'GLOBAL_CFD',
      longOnly: options?.longOnly ?? false,
      feeRatePerSide: options?.feeRatePerSide ?? 0.0003,
      sellTaxRate: options?.sellTaxRate ?? 0,
      slippageRate: options?.slippageRate ?? 0.0003,
      minHoldBars: options?.minHoldBars ?? 0,
      label: 'Chuẩn Vàng / Cổ Phiếu Mỹ (Spread & Phí 0.06% khứ hồi)',
    };
  }

  return {
    marketProfile: 'ZERO_FRICTION',
    longOnly: options?.longOnly ?? false,
    feeRatePerSide: options?.feeRatePerSide ?? 0,
    sellTaxRate: options?.sellTaxRate ?? 0,
    slippageRate: options?.slippageRate ?? 0,
    minHoldBars: options?.minHoldBars ?? 0,
    label: 'Lý thuyết (0% Phí & Không trượt giá)',
  };
}

export function runBacktest(
  candles: Candle[],
  strategy: StrategyType = 'SUPERTREND_EMA',
  initialBalance: number = 10000,
  riskPercentPerTrade: number = 2,
  options?: BacktestFrictionOptions
): ProBacktestResult {
  const friction = resolveFrictionProfile(candles, options);

  if (candles.length < 50) {
    return {
      strategyKey: strategy,
      strategyName: STRATEGY_DISPLAY_NAMES[strategy] || strategy,
      totalTrades: 0,
      winRate: 0,
      profitFactor: 0,
      totalReturnPercent: 0,
      maxDrawdownPercent: 0,
      trades: [],
      equityCurve: [{ time: candles[0]?.time || 0, balance: initialBalance }],
      sharpeRatio: 0,
      buyAndHoldReturnPercent: 0,
      alphaVsBuyHoldPercent: 0,
      totalFeesPaid: 0,
      calmarRatio: 0,
      expectancyPercent: 0,
      marketProfileLabel: friction.label,
    };
  }

  const closes = candles.map(c => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsi = calculateRSI(candles, 14);
  const macd = calculateMACD(candles);
  const supertrend = calculateSuperTrend(candles, 10, 3);
  const bb = calculateBollingerBands(candles, 20, 2);

  const rsiMap = new Map(rsi.map(r => [r.time, r.value]));
  const macdMap = new Map(macd.map(m => [m.time, m]));
  const stMap = new Map(supertrend.map(s => [s.time, s]));
  const bbMap = new Map(bb.map(b => [b.time, b]));

  let currentBalance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdown = 0;
  let totalFeesPaid = 0;

  const trades: BacktestTrade[] = [];
  const equityCurve: { time: number; balance: number }[] = [
    { time: candles[0].time, balance: initialBalance },
  ];

  let currentPosition: {
    type: 'BUY' | 'SELL';
    entryPrice: number;
    entryTime: number;
    entryIndex: number;
    sl: number;
    tp: number;
    positionAmount: number;
  } | null = null;

  const roundTripCostRate =
    friction.feeRatePerSide * 2 + friction.sellTaxRate + friction.slippageRate * 2;

  for (let i = 50; i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];
    const currRSI = rsiMap.get(c.time) ?? 50;
    const prevRSI = rsiMap.get(prevC.time) ?? 50;
    const currST = stMap.get(c.time);
    const currBB = bbMap.get(c.time);
    const currMACD = macdMap.get(c.time);
    const prevMACD = macdMap.get(prevC.time);
    const e20 = ema20[i];
    const e50 = ema50[i];
    const e200 = ema200[i];

    // 1. Check if open position hit SL or TP (respecting VN T+2 minHoldBars settlement lock)
    if (currentPosition) {
      const pos = currentPosition;
      const barsHeld = i - pos.entryIndex;
      const settlementUnlocked = barsHeld >= friction.minHoldBars;

      let exitPrice: number | null = null;
      let reason: BacktestTrade['reason'] = 'SIGNAL_CLOSE';

      if (settlementUnlocked) {
        if (pos.type === 'BUY') {
          if (c.low <= pos.sl) {
            // If gapped below SL on settlement unlock day, exit at min(open, sl)
            exitPrice = barsHeld === friction.minHoldBars && friction.minHoldBars > 0 ? Math.min(c.open, pos.sl) : pos.sl;
            reason = 'SL';
          } else if (c.high >= pos.tp) {
            exitPrice = pos.tp;
            reason = 'TP1';
          }
        } else {
          if (c.high >= pos.sl) {
            exitPrice = pos.sl;
            reason = 'SL';
          } else if (c.low <= pos.tp) {
            exitPrice = pos.tp;
            reason = 'TP1';
          }
        }
      }

      if (exitPrice !== null) {
        const grossPnlRatio =
          pos.type === 'BUY'
            ? (exitPrice - pos.entryPrice) / pos.entryPrice
            : (pos.entryPrice - exitPrice) / pos.entryPrice;
        const feeAmount = pos.positionAmount * roundTripCostRate;
        totalFeesPaid += feeAmount;
        const netPnlRatio = grossPnlRatio - roundTripCostRate;
        const pnlAmount = pos.positionAmount * netPnlRatio;
        currentBalance = Math.max(0, currentBalance + pnlAmount);

        trades.push({
          id: `trade-${trades.length + 1}`,
          type: pos.type,
          entryTime: pos.entryTime,
          entryPrice: pos.entryPrice,
          exitTime: c.time,
          exitPrice,
          profitPercent: parseFloat((netPnlRatio * 100).toFixed(2)),
          pnlAmount: parseFloat(pnlAmount.toFixed(2)),
          reason,
          status: pnlAmount > 0 ? 'WIN' : 'LOSS',
        });

        currentPosition = null;
      }
    }

    // 2. Check for Entry Signals across all 10 strategies
    if (!currentPosition && currentBalance > 0) {
      let signal: 'BUY' | 'SELL' | null = null;
      let slDistancePercent = 0.025;
      let rrMultiplier = 2.2;

      switch (strategy) {
        case 'KRONOS_AI_FOUNDATION': {
          const prev2C = candles[Math.max(0, i - 2)];
          const lowerWick = Math.min(c.open, c.close) - c.low;
          const upperWick = c.high - Math.max(c.open, c.close);
          const candleRange = Math.max(1e-8, c.high - c.low);
          const isBullToken =
            c.close > prevC.close &&
            ((e20 !== null && c.close > e20) || lowerWick / candleRange > 0.35) &&
            currRSI > 46 &&
            currRSI < 72 &&
            (!currMACD || currMACD.histogram >= (prevMACD?.histogram ?? 0));
          const isBearToken =
            c.close < prevC.close &&
            ((e20 !== null && c.close < e20) || upperWick / candleRange > 0.35) &&
            currRSI < 54 &&
            currRSI > 28 &&
            (!currMACD || currMACD.histogram <= (prevMACD?.histogram ?? 0));

          if (isBullToken && c.close > prev2C.low) {
            signal = 'BUY';
            slDistancePercent = 0.02;
            rrMultiplier = 2.9;
          } else if (isBearToken && c.close < prev2C.high) {
            signal = 'SELL';
            slDistancePercent = 0.02;
            rrMultiplier = 2.9;
          }
          break;
        }

        case 'SUPERTREND_EMA':
          if (currST && currST.direction === 1 && e20 && e50 && e20 > e50 && c.close > e20) {
            signal = 'BUY';
            slDistancePercent = 0.025;
            rrMultiplier = 2.5;
          } else if (currST && currST.direction === -1 && e20 && e50 && e20 < e50 && c.close < e20) {
            signal = 'SELL';
            slDistancePercent = 0.025;
            rrMultiplier = 2.5;
          }
          break;

        case 'SMC_ORDER_BLOCK':
          if (c.low < prevC.low && c.close > prevC.open && e50 && c.close > e50) {
            signal = 'BUY';
            slDistancePercent = 0.02;
            rrMultiplier = 3.2;
          } else if (c.high > prevC.high && c.close < prevC.open && e50 && c.close < e50) {
            signal = 'SELL';
            slDistancePercent = 0.02;
            rrMultiplier = 3.2;
          }
          break;

        case 'FIBONACCI_RETRACE':
          if (e200 && c.close > e200 && currRSI >= 40 && currRSI <= 52 && c.close > prevC.close) {
            signal = 'BUY';
            slDistancePercent = 0.022;
            rrMultiplier = 2.8;
          } else if (e200 && c.close < e200 && currRSI <= 60 && currRSI >= 48 && c.close < prevC.close) {
            signal = 'SELL';
            slDistancePercent = 0.022;
            rrMultiplier = 2.8;
          }
          break;

        case 'RSI_REVERSION':
          if (prevRSI < 30 && currRSI >= 30) {
            signal = 'BUY';
            slDistancePercent = 0.022;
            rrMultiplier = 2.0;
          } else if (prevRSI > 70 && currRSI <= 70) {
            signal = 'SELL';
            slDistancePercent = 0.022;
            rrMultiplier = 2.0;
          }
          break;

        case 'BOLLINGER_BREAKOUT':
          if (currBB && c.close > currBB.upper && prevC.close <= currBB.upper) {
            signal = 'BUY';
            slDistancePercent = 0.03;
            rrMultiplier = 2.6;
          } else if (currBB && c.close < currBB.lower && prevC.close >= currBB.lower) {
            signal = 'SELL';
            slDistancePercent = 0.03;
            rrMultiplier = 2.6;
          }
          break;

        case 'MACD_MOMENTUM':
          if (currMACD && prevMACD && prevMACD.macd <= prevMACD.signal && currMACD.macd > currMACD.signal) {
            signal = 'BUY';
            slDistancePercent = 0.025;
            rrMultiplier = 2.4;
          } else if (currMACD && prevMACD && prevMACD.macd >= prevMACD.signal && currMACD.macd < currMACD.signal) {
            signal = 'SELL';
            slDistancePercent = 0.025;
            rrMultiplier = 2.4;
          }
          break;

        case 'SR_BREAKOUT':
          if (c.close > prevC.high && currRSI > 55 && e20 && c.close > e20) {
            signal = 'BUY';
            slDistancePercent = 0.024;
            rrMultiplier = 2.7;
          } else if (c.close < prevC.low && currRSI < 45 && e20 && c.close < e20) {
            signal = 'SELL';
            slDistancePercent = 0.024;
            rrMultiplier = 2.7;
          }
          break;

        case 'SPOT_ACCUMULATION':
          if (currRSI < 42 || (e200 && c.close > e200 && currRSI > 45 && currRSI < 60)) {
            signal = 'BUY';
            slDistancePercent = 0.08;
            rrMultiplier = 3.5;
          }
          break;

        case 'DAILY_DAYTRADING':
          if (currMACD && currMACD.macd > currMACD.signal && currRSI > 50 && e20 && c.close > e20) {
            signal = 'BUY';
            slDistancePercent = 0.015;
            rrMultiplier = 2.2;
          } else if (currMACD && currMACD.macd < currMACD.signal && currRSI < 50 && e20 && c.close < e20) {
            signal = 'SELL';
            slDistancePercent = 0.015;
            rrMultiplier = 2.2;
          }
          break;
      }

      if (signal === 'SELL' && friction.longOnly) {
        signal = null;
      }

      if (signal) {
        const riskDollar = currentBalance * (riskPercentPerTrade / 100);
        const slPrice =
          signal === 'BUY' ? c.close * (1 - slDistancePercent) : c.close * (1 + slDistancePercent);
        const tpPrice =
          signal === 'BUY'
            ? c.close * (1 + slDistancePercent * rrMultiplier)
            : c.close * (1 - slDistancePercent * rrMultiplier);
        // Cap spot position notional on VN_EQUITY_T2 to 100% cash (no margin leverage unless explicitly configured)
        const rawPosNotional = riskDollar / slDistancePercent;
        const positionSizeUSD =
          friction.marketProfile === 'VN_EQUITY_T2'
            ? Math.min(currentBalance, rawPosNotional)
            : rawPosNotional;

        currentPosition = {
          type: signal,
          entryPrice: c.close,
          entryTime: c.time,
          entryIndex: i,
          sl: slPrice,
          tp: tpPrice,
          positionAmount: positionSizeUSD,
        };
      }
    }

    // Track equity
    peakBalance = Math.max(peakBalance, currentBalance);
    const dd = peakBalance > 0 ? ((peakBalance - currentBalance) / peakBalance) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, dd);

    if (i % 4 === 0 || i === candles.length - 1) {
      equityCurve.push({
        time: c.time,
        balance: parseFloat(currentBalance.toFixed(2)),
      });
    }
  }

  const winningTrades = trades.filter(t => t.status === 'WIN');
  const losingTrades = trades.filter(t => t.status === 'LOSS');
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

  const totalGains = winningTrades.reduce((sum, t) => sum + t.pnlAmount, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnlAmount, 0));
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? 99 : 0;
  const totalReturnPercent = ((currentBalance - initialBalance) / initialBalance) * 100;

  const returns = trades.map(t => t.profitPercent);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn =
    returns.length > 1
      ? Math.sqrt(
          returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)
        )
      : 1;
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(100) : 0;

  const startBenchPrice = candles[50]?.close || candles[0].close;
  const endBenchPrice = candles[candles.length - 1].close;
  const buyAndHoldReturnPercent =
    startBenchPrice > 0 ? ((endBenchPrice - startBenchPrice) / startBenchPrice) * 100 : 0;
  const alphaVsBuyHoldPercent = totalReturnPercent - buyAndHoldReturnPercent;
  const calmarRatio = maxDrawdown > 0.1 ? totalReturnPercent / maxDrawdown : totalReturnPercent > 0 ? 10 : 0;

  return {
    strategyKey: strategy,
    strategyName: STRATEGY_DISPLAY_NAMES[strategy] || strategy,
    totalTrades: trades.length,
    winRate: parseFloat(winRate.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2)),
    maxDrawdownPercent: parseFloat(maxDrawdown.toFixed(2)),
    trades,
    equityCurve,
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    buyAndHoldReturnPercent: parseFloat(buyAndHoldReturnPercent.toFixed(2)),
    alphaVsBuyHoldPercent: parseFloat(alphaVsBuyHoldPercent.toFixed(2)),
    totalFeesPaid: parseFloat(totalFeesPaid.toFixed(2)),
    calmarRatio: parseFloat(calmarRatio.toFixed(2)),
    expectancyPercent: parseFloat(avgReturn.toFixed(2)),
    marketProfileLabel: friction.label,
  };
}

/**
 * Runs all 10 strategies side-by-side on the exact same candle series and market friction profile,
 * ranked by risk-adjusted performance (Sharpe + Total Return).
 */
export function runStrategyTournament(
  candles: Candle[],
  initialBalance: number = 10000,
  riskPercentPerTrade: number = 2,
  options?: BacktestFrictionOptions
): ProBacktestResult[] {
  const results = ALL_STRATEGIES.map(strat =>
    runBacktest(candles, strat, initialBalance, riskPercentPerTrade, options)
  );

  return results.sort((a, b) => {
    const scoreA = a.totalReturnPercent + a.sharpeRatio * 4 - a.maxDrawdownPercent * 0.5;
    const scoreB = b.totalReturnPercent + b.sharpeRatio * 4 - b.maxDrawdownPercent * 0.5;
    return scoreB - scoreA;
  });
}

/**
 * Deterministic 1,000-Iteration Monte Carlo Trade Sequence Resampling Stress Test
 * Evaluates path-dependent Drawdown & Risk of Ruin under worst-case losing streaks.
 */
export function runMonteCarloEquityStressTest(
  trades: BacktestTrade[],
  initialBalance: number = 10000,
  iterations: number = 1000
): MonteCarloStressResult {
  if (!trades || trades.length < 3) {
    return {
      iterations: 0,
      tradeCount: trades?.length || 0,
      medianFinalBalance: initialBalance,
      p05WorstBalance: initialBalance,
      p95BestBalance: initialBalance,
      medianReturnPercent: 0,
      p05WorstReturnPercent: 0,
      medianMaxDrawdownPercent: 0,
      p95WorstDrawdownPercent: 0,
      riskOfRuin30Percent: 0,
    };
  }

  // Convert each historical trade's account equity impact into multiplicative ratio
  // Using pnlAmount relative to initialBalance bounded safely
  const accountMultipliers = trades.map(t => {
    const rel = t.pnlAmount / Math.max(1, initialBalance);
    return Math.max(0.2, 1 + rel);
  });

  // Deterministic Mulberry32 PRNG so identical inputs always yield reproducible stress metrics
  let seed = 0x6d2b79f5 ^ trades.length;
  const nextRand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const finalBalances: number[] = [];
  const maxDrawdowns: number[] = [];
  let ruinCount = 0;
  const n = accountMultipliers.length;

  for (let iter = 0; iter < iterations; iter++) {
    let bal = initialBalance;
    let peak = initialBalance;
    let maxDd = 0;

    // Bootstrap resampling with replacement across n trades
    for (let k = 0; k < n; k++) {
      const idx = Math.floor(nextRand() * n);
      bal *= accountMultipliers[idx];
      if (bal > peak) peak = bal;
      const dd = peak > 0 ? ((peak - bal) / peak) * 100 : 0;
      if (dd > maxDd) maxDd = dd;
    }

    if (maxDd >= 30) ruinCount++;
    finalBalances.push(bal);
    maxDrawdowns.push(maxDd);
  }

  finalBalances.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);

  const p05Idx = Math.floor(iterations * 0.05);
  const p50Idx = Math.floor(iterations * 0.5);
  const p95Idx = Math.min(iterations - 1, Math.floor(iterations * 0.95));

  const medianFinal = finalBalances[p50Idx];
  const p05Bal = finalBalances[p05Idx];
  const p95Bal = finalBalances[p95Idx];

  return {
    iterations,
    tradeCount: n,
    medianFinalBalance: parseFloat(medianFinal.toFixed(2)),
    p05WorstBalance: parseFloat(p05Bal.toFixed(2)),
    p95BestBalance: parseFloat(p95Bal.toFixed(2)),
    medianReturnPercent: parseFloat((((medianFinal - initialBalance) / initialBalance) * 100).toFixed(2)),
    p05WorstReturnPercent: parseFloat((((p05Bal - initialBalance) / initialBalance) * 100).toFixed(2)),
    medianMaxDrawdownPercent: parseFloat(maxDrawdowns[p50Idx].toFixed(2)),
    p95WorstDrawdownPercent: parseFloat(maxDrawdowns[p95Idx].toFixed(2)),
    riskOfRuin30Percent: parseFloat(((ruinCount / iterations) * 100).toFixed(1)),
  };
}
