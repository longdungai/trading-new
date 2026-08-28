import { Candle, OrderBlock } from '../../types';

export function detectOrderBlocks(candles: Candle[], lookback = 60): OrderBlock[] {
  if (candles.length < 15) return [];

  const recent = candles.slice(-lookback);
  const orderBlocks: OrderBlock[] = [];
  const currentPrice = candles[candles.length - 1].close;

  for (let i = 2; i < recent.length - 2; i++) {
    const c0 = recent[i - 1];
    const c1 = recent[i]; // potential OB candle
    const c2 = recent[i + 1]; // strong impulse candle
    const c3 = recent[i + 2];

    const body1 = Math.abs(c1.close - c1.open);
    const body2 = Math.abs(c2.close - c2.open);

    // Bullish Order Block: Last bearish candle before a strong bullish expansion
    if (c1.close < c1.open && c2.close > c2.open && body2 > body1 * 1.8 && c2.close > c1.high) {
      const top = Math.max(c1.open, c1.close);
      const bottom = c1.low;
      const mitigated = recent.slice(i + 2).some(future => future.low <= top && future.low >= bottom);

      orderBlocks.push({
        type: 'bullish_ob',
        top: parseFloat(top.toFixed(4)),
        bottom: parseFloat(bottom.toFixed(4)),
        time: c1.time,
        mitigated,
        strength: mitigated ? 2 : 5,
      });
    }

    // Bearish Order Block: Last bullish candle before a strong bearish expansion
    if (c1.close > c1.open && c2.close < c2.open && body2 > body1 * 1.8 && c2.close < c1.low) {
      const top = c1.high;
      const bottom = Math.min(c1.open, c1.close);
      const mitigated = recent.slice(i + 2).some(future => future.high >= bottom && future.high <= top);

      orderBlocks.push({
        type: 'bearish_ob',
        top: parseFloat(top.toFixed(4)),
        bottom: parseFloat(bottom.toFixed(4)),
        time: c1.time,
        mitigated,
        strength: mitigated ? 2 : 5,
      });
    }

    // Fair Value Gap (FVG) - 3 candle imbalance
    // Bullish FVG: Low of candle 3 is higher than High of candle 1
    if (c3.low > c0.high) {
      orderBlocks.push({
        type: 'fvg_bull',
        top: parseFloat(c3.low.toFixed(4)),
        bottom: parseFloat(c0.high.toFixed(4)),
        time: c1.time,
        mitigated: currentPrice < c0.high,
        strength: 4,
      });
    }

    // Bearish FVG: High of candle 3 is lower than Low of candle 1
    if (c3.high < c0.low) {
      orderBlocks.push({
        type: 'fvg_bear',
        top: parseFloat(c0.low.toFixed(4)),
        bottom: parseFloat(c3.high.toFixed(4)),
        time: c1.time,
        mitigated: currentPrice > c0.low,
        strength: 4,
      });
    }
  }

  // Filter and return the most relevant unmitigated / high-strength order blocks
  return orderBlocks.slice(-8);
}
