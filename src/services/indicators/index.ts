import { Candle } from '../../types';

// Simple Moving Average
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

// Exponential Moving Average
export function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prevEma: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (prevEma === null) {
      const slice = data.slice(i - period + 1, i + 1);
      prevEma = slice.reduce((a, b) => a + b, 0) / period;
      result.push(prevEma);
    } else {
      const currentEma: number = data[i] * k + prevEma * (1 - k);
      result.push(currentEma);
      prevEma = currentEma;
    }
  }
  return result;
}

// Relative Strength Index (RSI)
export function calculateRSI(candles: Candle[], period: number = 14): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  if (candles.length <= period) return result;

  const closes = candles.map(c => c.close);
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(0, diff));
    losses.push(Math.max(0, -diff));
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);
  result.push({ time: candles[period].time, value: rsi });

  for (let i = period + 1; i < closes.length; i++) {
    const gain = gains[i - 1];
    const loss = losses[i - 1];

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
    result.push({ time: candles[i].time, value: rsi });
  }

  return result;
}

// Moving Average Convergence Divergence (MACD)
export interface MACDResult {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export function calculateMACD(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult[] {
  const closes = candles.map(c => c.close);
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEMA[i]! - slowEMA[i]!);
    }
  }

  const validMacdValues: number[] = [];
  const validIndices: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      validMacdValues.push(macdLine[i]!);
      validIndices.push(i);
    }
  }

  const signalEMA = calculateEMA(validMacdValues, signalPeriod);
  const results: MACDResult[] = [];

  for (let j = 0; j < validIndices.length; j++) {
    const idx = validIndices[j];
    const macdVal = validMacdValues[j];
    const sigVal = signalEMA[j];

    if (sigVal !== null) {
      results.push({
        time: candles[idx].time,
        macd: macdVal,
        signal: sigVal,
        histogram: macdVal - sigVal,
      });
    }
  }

  return results;
}

// Bollinger Bands
export interface BollingerBandsResult {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export function calculateBollingerBands(
  candles: Candle[],
  period = 20,
  stdDevMultiplier = 2
): BollingerBandsResult[] {
  const closes = candles.map(c => c.close);
  const sma = calculateSMA(closes, period);
  const results: BollingerBandsResult[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const mean = sma[i]!;
    const slice = closes.slice(i - period + 1, i + 1);
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    results.push({
      time: candles[i].time,
      middle: mean,
      upper: mean + stdDevMultiplier * stdDev,
      lower: mean - stdDevMultiplier * stdDev,
    });
  }

  return results;
}

// Average True Range (ATR)
export function calculateATR(candles: Candle[], period = 14): number[] {
  if (candles.length < 2) return [];

  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const prevC = candles[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trs.push(tr);
  }

  const atrs: number[] = [];
  let currentATR = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  atrs.push(currentATR);

  for (let i = period; i < trs.length; i++) {
    currentATR = (currentATR * (period - 1) + trs[i]) / period;
    atrs.push(currentATR);
  }

  return atrs;
}

// SuperTrend Indicator
export interface SuperTrendResult {
  time: number;
  value: number;
  direction: 1 | -1;
  upper: number;
  lower: number;
}

export function calculateSuperTrend(
  candles: Candle[],
  period = 10,
  multiplier = 3
): SuperTrendResult[] {
  if (candles.length <= period) return [];

  const atrs = calculateATR(candles, period);
  const results: SuperTrendResult[] = [];

  let prevSuperTrend = 0;
  let prevUpper = 0;
  let prevLower = 0;

  const offset = candles.length - atrs.length;

  for (let i = 0; i < atrs.length; i++) {
    const candleIdx = i + offset;
    const candle = candles[candleIdx];
    const atr = atrs[i];
    const hl2 = (candle.high + candle.low) / 2;

    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;

    let finalUpper = basicUpper;
    let finalLower = basicLower;

    if (i > 0) {
      const prevClose = candles[candleIdx - 1].close;
      finalUpper = basicUpper < prevUpper || prevClose > prevUpper ? basicUpper : prevUpper;
      finalLower = basicLower > prevLower || prevClose < prevLower ? basicLower : prevLower;
    }

    let direction: 1 | -1 = 1;
    let superTrendVal = finalLower;

    if (i === 0) {
      direction = candle.close > finalUpper ? 1 : -1;
      superTrendVal = direction === 1 ? finalLower : finalUpper;
    } else {
      if (prevSuperTrend === prevUpper) {
        direction = candle.close > finalUpper ? 1 : -1;
      } else {
        direction = candle.close < finalLower ? -1 : 1;
      }
      superTrendVal = direction === 1 ? finalLower : finalUpper;
    }

    results.push({
      time: candle.time,
      value: superTrendVal,
      direction,
      upper: finalUpper,
      lower: finalLower,
    });

    prevSuperTrend = superTrendVal;
    prevUpper = finalUpper;
    prevLower = finalLower;
  }

  return results;
}
