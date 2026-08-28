import { Candle, FibonacciLevel } from '../../types';

export function calculateFibonacciLevels(candles: Candle[], lookback = 100): FibonacciLevel[] {
  if (candles.length < 20) return [];

  const recent = candles.slice(-lookback);
  let highest = -Infinity;
  let lowest = Infinity;
  let highIndex = -1;
  let lowIndex = -1;

  for (let i = 0; i < recent.length; i++) {
    if (recent[i].high > highest) {
      highest = recent[i].high;
      highIndex = i;
    }
    if (recent[i].low < lowest) {
      lowest = recent[i].low;
      lowIndex = i;
    }
  }

  const isUptrend = lowIndex < highIndex; // Low happened before High
  const diff = highest - lowest;

  const ratios = [
    { ratio: 0.0, label: '0.0% (Swing)', color: '#94a3b8', isKeyZone: false },
    { ratio: 0.236, label: '23.6%', color: '#64748b', isKeyZone: false },
    { ratio: 0.382, label: '38.2%', color: '#38bdf8', isKeyZone: false },
    { ratio: 0.5, label: '50.0% (Equilibrium)', color: '#f59e0b', isKeyZone: true },
    { ratio: 0.618, label: '61.8% (Golden Pocket)', color: '#10b981', isKeyZone: true },
    { ratio: 0.786, label: '78.6%', color: '#a855f7', isKeyZone: false },
    { ratio: 1.0, label: '100.0% (Base)', color: '#94a3b8', isKeyZone: false },
    { ratio: 1.618, label: '161.8% (Extension)', color: '#ec4899', isKeyZone: true },
  ];

  return ratios.map(r => {
    let price: number;
    if (isUptrend) {
      // Retracement from high down to low
      price = highest - diff * r.ratio;
    } else {
      // Retracement from low up to high
      price = lowest + diff * r.ratio;
    }
    return {
      ratio: r.ratio,
      price: parseFloat(price.toFixed(4)),
      label: r.label,
      color: r.color,
      isKeyZone: r.isKeyZone,
    };
  });
}
