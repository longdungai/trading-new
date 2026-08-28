import { Candle } from '../../types';

export interface MonteCarloResult {
  times: number[];
  medianPath: number[];
  upper95: number[];
  lower95: number[];
  upper68: number[];
  lower68: number[];
  samplePaths: number[][]; // 5 representative paths
  bullProbability: number;
}

export function runMonteCarloSimulation(
  candles: Candle[],
  forecastBars: number = 24,
  numSimulations: number = 150
): MonteCarloResult {
  if (candles.length < 30) {
    return {
      times: [],
      medianPath: [],
      upper95: [],
      lower95: [],
      upper68: [],
      lower68: [],
      samplePaths: [],
      bullProbability: 50,
    };
  }

  // 1. Calculate log returns and drift / volatility
  const closes = candles.map(c => c.close);
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const n = logReturns.length;
  const meanReturn = logReturns.reduce((a, b) => a + b, 0) / n;
  const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (n - 1);
  const dailyVol = Math.sqrt(variance);

  // Slight dampening on drift for realistic medium-term prediction
  const drift = meanReturn - 0.5 * variance;

  const lastCandle = candles[candles.length - 1];
  const lastTime = lastCandle.time;
  const timeStep = candles.length > 1 ? candles[candles.length - 1].time - candles[candles.length - 2].time : 3600;
  const currentPrice = lastCandle.close;

  // 2. Generate future times
  const futureTimes: number[] = [];
  for (let step = 1; step <= forecastBars; step++) {
    futureTimes.push(lastTime + step * timeStep);
  }

  // 3. Simulate paths
  const allPaths: number[][] = []; // [simIndex][stepIndex]
  let bullishEndCount = 0;

  for (let s = 0; s < numSimulations; s++) {
    const path: number[] = [];
    let price = currentPrice;

    for (let step = 0; step < forecastBars; step++) {
      // Box-Muller transform for standard normal random variable
      const u1 = Math.max(1e-7, Math.random());
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

      // Geometric Brownian Motion formula
      price = price * Math.exp(drift + dailyVol * z);
      path.push(price);
    }

    allPaths.push(path);
    if (path[path.length - 1] > currentPrice) {
      bullishEndCount++;
    }
  }

  // 4. Calculate percentiles at each step
  const medianPath: number[] = [];
  const upper95: number[] = [];
  const lower95: number[] = [];
  const upper68: number[] = [];
  const lower68: number[] = [];

  for (let step = 0; step < forecastBars; step++) {
    const stepPrices = allPaths.map(p => p[step]).sort((a, b) => a - b);
    const p5 = stepPrices[Math.floor(numSimulations * 0.05)];
    const p16 = stepPrices[Math.floor(numSimulations * 0.16)];
    const p50 = stepPrices[Math.floor(numSimulations * 0.50)];
    const p84 = stepPrices[Math.floor(numSimulations * 0.84)];
    const p95 = stepPrices[Math.floor(numSimulations * 0.95)];

    lower95.push(parseFloat(p5.toFixed(4)));
    lower68.push(parseFloat(p16.toFixed(4)));
    medianPath.push(parseFloat(p50.toFixed(4)));
    upper68.push(parseFloat(p84.toFixed(4)));
    upper95.push(parseFloat(p95.toFixed(4)));
  }

  // Pick 5 representative sample paths (e.g. max, min, median, upper-quartile, lower-quartile)
  const samplePaths = [
    allPaths[0],
    allPaths[Math.floor(numSimulations * 0.25)],
    allPaths[Math.floor(numSimulations * 0.50)],
    allPaths[Math.floor(numSimulations * 0.75)],
    allPaths[numSimulations - 1],
  ].map(p => p.map(val => parseFloat(val.toFixed(4))));

  const bullProbability = Math.round((bullishEndCount / numSimulations) * 100);

  return {
    times: futureTimes,
    medianPath,
    upper95,
    lower95,
    upper68,
    lower68,
    samplePaths,
    bullProbability,
  };
}
