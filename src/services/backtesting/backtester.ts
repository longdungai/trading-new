import { BacktestResult, BacktestTrade, Candle } from '../../types';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSuperTrend,
} from '../indicators';

export type StrategyType =
  | 'SUPERTREND_EMA'
  | 'SMC_ORDER_BLOCK'
  | 'FIBONACCI_RETRACE'
  | 'RSI_REVERSION'
  | 'BOLLINGER_BREAKOUT'
  | 'MACD_MOMENTUM'
  | 'SR_BREAKOUT';

export function runBacktest(
  candles: Candle[],
  strategy: StrategyType = 'SUPERTREND_EMA',
  initialBalance: number = 10000,
  riskPercentPerTrade: number = 2
): BacktestResult {
  if (candles.length < 50) {
    return {
      strategyName: strategy,
      totalTrades: 0,
      winRate: 0,
      profitFactor: 0,
      totalReturnPercent: 0,
      maxDrawdownPercent: 0,
      trades: [],
      equityCurve: [{ time: candles[0]?.time || 0, balance: initialBalance }],
      sharpeRatio: 0,
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

  const trades: BacktestTrade[] = [];
  const equityCurve: { time: number; balance: number }[] = [
    { time: candles[0].time, balance: initialBalance },
  ];

  let currentPosition: {
    type: 'BUY' | 'SELL';
    entryPrice: number;
    entryTime: number;
    sl: number;
    tp: number;
    positionAmount: number;
  } | null = null;

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

    // 1. Check if open position hit SL or TP
    if (currentPosition) {
      const pos = currentPosition;
      let exitPrice: number | null = null;
      let reason: BacktestTrade['reason'] = 'SIGNAL_CLOSE';

      if (pos.type === 'BUY') {
        if (c.low <= pos.sl) {
          exitPrice = pos.sl;
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

      if (exitPrice !== null) {
        const pnlRatio = pos.type === 'BUY'
          ? (exitPrice - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - exitPrice) / pos.entryPrice;
        const pnlAmount = pos.positionAmount * pnlRatio;
        currentBalance += pnlAmount;

        trades.push({
          id: `trade-${trades.length + 1}`,
          type: pos.type,
          entryTime: pos.entryTime,
          entryPrice: pos.entryPrice,
          exitTime: c.time,
          exitPrice,
          profitPercent: parseFloat((pnlRatio * 100).toFixed(2)),
          pnlAmount: parseFloat(pnlAmount.toFixed(2)),
          reason,
          status: pnlAmount > 0 ? 'WIN' : 'LOSS',
        });

        currentPosition = null;
      }
    }

    // 2. Check for Entry Signals across all 7 strategies
    if (!currentPosition) {
      let signal: 'BUY' | 'SELL' | null = null;
      let slDistancePercent = 0.025;
      let rrMultiplier = 2.2;

      switch (strategy) {
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
      }

      if (signal) {
        const riskDollar = currentBalance * (riskPercentPerTrade / 100);
        const slPrice = signal === 'BUY' ? c.close * (1 - slDistancePercent) : c.close * (1 + slDistancePercent);
        const tpPrice = signal === 'BUY' ? c.close * (1 + slDistancePercent * rrMultiplier) : c.close * (1 - slDistancePercent * rrMultiplier);
        const positionSizeUSD = riskDollar / slDistancePercent;

        currentPosition = {
          type: signal,
          entryPrice: c.close,
          entryTime: c.time,
          sl: slPrice,
          tp: tpPrice,
          positionAmount: positionSizeUSD,
        };
      }
    }

    // Track equity
    peakBalance = Math.max(peakBalance, currentBalance);
    const dd = ((peakBalance - currentBalance) / peakBalance) * 100;
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
  const stdReturn = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 1;
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(100) : 0;

  const strategyNames: Record<StrategyType, string> = {
    SUPERTREND_EMA: 'SuperTrend + EMA Golden Ribbon',
    SMC_ORDER_BLOCK: 'Smart Money (SMC) Order Block Bounce',
    FIBONACCI_RETRACE: 'Fibonacci Golden Pocket 0.618',
    RSI_REVERSION: 'RSI Đảo Chiều Quá Bán/Quá Mua',
    BOLLINGER_BREAKOUT: 'Bollinger Band Squeeze & Breakout',
    MACD_MOMENTUM: 'MACD Momentum & Zero-Lag Cross',
    SR_BREAKOUT: 'Phá Vỡ & Retest Hỗ Trợ/Kháng Cự',
  };

  return {
    strategyName: strategyNames[strategy] || strategy,
    totalTrades: trades.length,
    winRate: parseFloat(winRate.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2)),
    maxDrawdownPercent: parseFloat(maxDrawdown.toFixed(2)),
    trades,
    equityCurve,
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
  };
}
