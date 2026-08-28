import { Candle, SupportResistanceLevel } from '../../types';

export function calculateSupportResistance(
  candles: Candle[],
  lookback: number = 80,
  clusterThresholdPercent: number = 0.015
): SupportResistanceLevel[] {
  if (candles.length < 20) return [];

  const recentCandles = candles.slice(-lookback);
  const currentPrice = candles[candles.length - 1].close;

  // Find swing highs and swing lows (local extrema with window of 3 bars)
  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let i = 2; i < recentCandles.length - 2; i++) {
    const c = recentCandles[i];
    const prev1 = recentCandles[i - 1];
    const prev2 = recentCandles[i - 2];
    const next1 = recentCandles[i + 1];
    const next2 = recentCandles[i + 2];

    // Local Peak
    if (c.high > prev1.high && c.high > prev2.high && c.high > next1.high && c.high > next2.high) {
      swingHighs.push(c.high);
    }
    // Local Trough
    if (c.low < prev1.low && c.low < prev2.low && c.low < next1.low && c.low < next2.low) {
      swingLows.push(c.low);
    }
  }

  // Clustering helper
  function clusterLevels(prices: number[], isHigh: boolean): { price: number; touches: number }[] {
    const clusters: { price: number; touches: number; items: number[] }[] = [];

    for (const p of prices) {
      let foundCluster = false;
      for (const cluster of clusters) {
        const diff = Math.abs(cluster.price - p) / cluster.price;
        if (diff <= clusterThresholdPercent) {
          cluster.items.push(p);
          cluster.price = cluster.items.reduce((a, b) => a + b, 0) / cluster.items.length;
          cluster.touches += 1;
          foundCluster = true;
          break;
        }
      }
      if (!foundCluster) {
        clusters.push({ price: p, touches: 1, items: [p] });
      }
    }

    return clusters.sort((a, b) => b.touches - a.touches);
  }

  const resClusters = clusterLevels(swingHighs, true);
  const supClusters = clusterLevels(swingLows, false);

  const levels: SupportResistanceLevel[] = [];

  // Map to Resistance levels (above or near current price)
  for (const c of resClusters) {
    const type = c.price >= currentPrice ? 'resistance' : 'support';
    const strength = Math.min(5, Math.max(1, c.touches + 1));
    levels.push({
      price: parseFloat(c.price.toFixed(4)),
      type,
      strength,
      touches: c.touches,
      isBreakout: Math.abs(currentPrice - c.price) / c.price < 0.005,
    });
  }

  // Map to Support levels (below or near current price)
  for (const c of supClusters) {
    const type = c.price <= currentPrice ? 'support' : 'resistance';
    const strength = Math.min(5, Math.max(1, c.touches + 1));
    // Check if already in levels
    if (!levels.some(l => Math.abs(l.price - c.price) / c.price < clusterThresholdPercent)) {
      levels.push({
        price: parseFloat(c.price.toFixed(4)),
        type,
        strength,
        touches: c.touches,
        isBreakout: Math.abs(currentPrice - c.price) / c.price < 0.005,
      });
    }
  }

  // Sort by price ascending
  return levels.sort((a, b) => a.price - b.price);
}
