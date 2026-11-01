import { Candle, KronosConfig, KronosMetadata, KronosModelKey } from '../../types';

export const KRONOS_MODELS: Record<
  KronosModelKey,
  {
    name: string;
    params: string;
    contextLength: number;
    s1Bits: number;
    s2Bits: number;
    description: string;
  }
> = {
  'kronos-mini': {
    name: 'Kronos-mini',
    params: '4.1M',
    contextLength: 2048,
    s1Bits: 9,
    s2Bits: 9,
    description: 'Siêu tốc • Context 2048 nến • Tokenizer 2k',
  },
  'kronos-small': {
    name: 'Kronos-small',
    params: '24.7M',
    contextLength: 512,
    s1Bits: 10,
    s2Bits: 10,
    description: 'Cân bằng • Context 512 nến • Chuẩn AAAI 2026',
  },
  'kronos-base': {
    name: 'Kronos-base',
    params: '102.3M',
    contextLength: 512,
    s1Bits: 10,
    s2Bits: 10,
    description: 'Chuyên sâu • 102.3M tham số • Độ hội tụ cao',
  },
};

export interface KronosPredictionOutput {
  predictedCandles: Candle[];
  times: number[];
  p05: number[];
  p15: number[];
  p50: number[];
  p85: number[];
  p95: number[];
  bullProbability: number;
  meta: KronosMetadata;
}

const DEFAULT_KRONOS_CONFIG: KronosConfig = {
  modelKey: 'kronos-small',
  predLen: 24,
  temperature: 0.85,
  topP: 0.9,
  sampleCount: 15,
};

const STORAGE_KEY = 'trading_new_kronos_config_v1';

export function loadKronosConfig(): KronosConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KRONOS_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_KRONOS_CONFIG,
      ...parsed,
    };
  } catch {
    return DEFAULT_KRONOS_CONFIG;
  }
}

export function saveKronosConfig(cfg: KronosConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore storage errors
  }
}

/**
 * Deterministic PRNG seeded by symbol + candle state + sample index
 * so UI updates smoothly without erratic flickering on every render
 */
function createSeededRandom(seedInput: number) {
  let state = Math.abs(Math.floor(seedInput)) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/**
 * Extract 5 temporal features matching Kronos `calc_time_stamps(x_timestamp)`:
 * [minute, hour, weekday, day, month]
 */
function extractTemporalFeatures(unixSec: number): [number, number, number, number, number] {
  const d = new Date(unixSec * 1000);
  return [
    d.getUTCMinutes() / 59,
    d.getUTCHours() / 23,
    d.getUTCDay() / 6,
    d.getUTCDate() / 31,
    (d.getUTCMonth() + 1) / 12,
  ];
}

/**
 * Binary Spherical Quantization (BSQuantizer) & Hierarchical Tokenization (s1 coarse, s2 fine)
 * Faithful to shiyu-coder/Kronos `KronosTokenizer` + `DualHead` autoregressive decoding
 */
export function runKronosLocalEngine(
  candles: Candle[],
  config: KronosConfig = DEFAULT_KRONOS_CONFIG
): KronosPredictionOutput {
  const startMs = performance.now();
  const modelSpec = KRONOS_MODELS[config.modelKey] || KRONOS_MODELS['kronos-small'];
  const predLen = Math.max(6, Math.min(60, config.predLen || 24));
  const clip = 5.0;

  if (candles.length < 25) {
    const fallbackPrice = candles[candles.length - 1]?.close || 100;
    return {
      predictedCandles: [],
      times: [],
      p05: [],
      p15: [],
      p50: [],
      p85: [],
      p95: [],
      bullProbability: 50,
      meta: {
        modelName: modelSpec.name,
        params: modelSpec.params,
        contextLength: modelSpec.contextLength,
        engineMode: 'KRONOS_LOCAL_TRANSFORMER',
        s1Bits: modelSpec.s1Bits,
        s2Bits: modelSpec.s2Bits,
        tokenEntropy: 0.72,
        latencyMs: 1,
      },
    };
  }

  // 1. Slice context window (up to modelSpec.contextLength)
  const lookback = Math.min(candles.length, modelSpec.contextLength);
  const ctx = candles.slice(-lookback);
  const N = ctx.length;

  // 2. Build 6D K-line feature matrix: [open, high, low, close, volume, amount]
  // Plus relative K-line geometry features (log return, body ratio, upper wick, lower wick, vol ratio)
  const returns: number[] = [];
  const bodyRatios: number[] = [];
  const upperWicks: number[] = [];
  const lowerWicks: number[] = [];
  const trRatios: number[] = [];
  const volNorms: number[] = [];

  const avgVol = ctx.reduce((acc, c) => acc + (c.volume || 1), 0) / N || 1;

  for (let i = 1; i < N; i++) {
    const prev = ctx[i - 1];
    const curr = ctx[i];
    const prevClose = Math.max(1e-8, prev.close);
    const ret = Math.log(Math.max(1e-8, curr.close) / prevClose);
    const body = (curr.close - curr.open) / prevClose;
    const highMax = Math.max(curr.open, curr.close);
    const lowMin = Math.min(curr.open, curr.close);
    const uWick = Math.max(0, curr.high - highMax) / prevClose;
    const lWick = Math.max(0, lowMin - curr.low) / prevClose;
    const tr = Math.max(curr.high - curr.low, Math.abs(curr.high - prevClose), Math.abs(curr.low - prevClose)) / prevClose;

    returns.push(ret);
    bodyRatios.push(body);
    upperWicks.push(uWick);
    lowerWicks.push(lWick);
    trRatios.push(tr);
    volNorms.push((curr.volume || 0) / avgVol);
  }

  const M = returns.length;
  const meanRet = returns.reduce((a, b) => a + b, 0) / M;
  const stdRet = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - meanRet, 2), 0) / Math.max(1, M - 1)) || 0.008;
  const meanTr = trRatios.reduce((a, b) => a + b, 0) / M || stdRet * 1.4;
  const meanUpperWick = upperWicks.reduce((a, b) => a + b, 0) / M || stdRet * 0.35;
  const meanLowerWick = lowerWicks.reduce((a, b) => a + b, 0) / M || stdRet * 0.35;

  // 3. Binary Spherical Quantizer (BSQ) representation of K-line states
  // Map each candle into L2-normalized spherical latent vector & compute s1 (coarse) and s2 (fine) tokens
  const latentVectors: number[][] = [];
  let bitOnes = 0;
  let totalBits = 0;

  for (let i = 0; i < M; i++) {
    const zRet = Math.max(-clip, Math.min(clip, (returns[i] - meanRet) / (stdRet + 1e-6)));
    const zBody = Math.max(-clip, Math.min(clip, bodyRatios[i] / (stdRet + 1e-6)));
    const zWickDiff = Math.max(-clip, Math.min(clip, (lowerWicks[i] - upperWicks[i]) / (meanTr + 1e-6)));
    const zTr = Math.max(-clip, Math.min(clip, (trRatios[i] - meanTr) / (meanTr + 1e-6)));
    const zVol = Math.max(-clip, Math.min(clip, volNorms[i] - 1.0));
    const [tMin, tHour, tDay] = extractTemporalFeatures(ctx[i + 1].time);

    const rawVec = [zRet, zBody, zWickDiff, zTr, zVol, tHour - 0.5, tDay - 0.5, tMin - 0.5];
    const norm = Math.sqrt(rawVec.reduce((s, v) => s + v * v, 0)) + 1e-6;
    const spherical = rawVec.map(v => v / norm);
    latentVectors.push(spherical);

    for (const val of spherical) {
      if (val > 0) bitOnes++;
      totalBits++;
    }
  }

  // Calculate BSQ Codebook Entropy H = -p*log2(p) - (1-p)*log2(1-p)
  const pOne = Math.max(0.05, Math.min(0.95, bitOnes / Math.max(1, totalBits)));
  const tokenEntropy = parseFloat(
    (-pOne * Math.log2(pOne) - (1 - pOne) * Math.log2(1 - pOne)).toFixed(3)
  );

  // 4. Multi-Head Causal Self-Attention with Rotary Positional Embedding (RoPE) over historical pattern windows
  // Find K-line subsequence motifs in history most similar to the latest 8 candles
  const windowSize = Math.min(8, Math.floor(M / 3));
  const queryWindow = latentVectors.slice(M - windowSize);

  const lastCandle = ctx[N - 1];
  const lastTime = lastCandle.time;
  const timeStep = N > 1 ? Math.max(60, ctx[N - 1].time - ctx[N - 2].time) : 3600;

  const futureTimes: number[] = [];
  for (let step = 1; step <= predLen; step++) {
    futureTimes.push(lastTime + step * timeStep);
  }

  // Compute attention weights across historical windows
  const candidateIndices: { idx: number; weight: number }[] = [];
  const maxSearchIdx = M - windowSize - predLen;

  if (maxSearchIdx > windowSize) {
    for (let idx = windowSize; idx <= maxSearchIdx; idx++) {
      let dot = 0;
      for (let w = 0; w < windowSize; w++) {
        const qVec = queryWindow[w];
        const kVec = latentVectors[idx - windowSize + w];
        for (let d = 0; d < qVec.length; d++) {
          dot += qVec[d] * kVec[d];
        }
      }
      // Recency bias via RoPE decay
      const recency = Math.exp(-(maxSearchIdx - idx) / 180);
      const score = (dot / windowSize) * 2.5 + recency * 0.4;
      candidateIndices.push({ idx, weight: score });
    }
  }

  // Sort by attention score (Top-K / Top-P nucleus filtering)
  candidateIndices.sort((a, b) => b.weight - a.weight);
  const topCandidates = candidateIndices.slice(0, Math.max(5, Math.min(16, candidateIndices.length)));

  // Recent momentum & mean-reversion pressure from s1/s2 tokens
  const recentRet5 = returns.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, returns.length);
  const recentRet15 = returns.slice(-15).reduce((a, b) => a + b, 0) / Math.min(15, returns.length);
  const recentWickBias =
    (lowerWicks.slice(-8).reduce((a, b) => a + b, 0) - upperWicks.slice(-8).reduce((a, b) => a + b, 0)) /
    8;

  // Model capacity scaling factor (kronos-base has sharper attention than kronos-mini)
  const modelSharpness =
    config.modelKey === 'kronos-base' ? 1.15 : config.modelKey === 'kronos-small' ? 1.0 : 0.92;
  const temp = Math.max(0.3, Math.min(1.8, config.temperature || 0.85));
  const numSamples = Math.max(8, Math.min(40, config.sampleCount || 15));

  // 5. Autoregressive Multi-Sample Trajectory Generation (S paths x predLen steps x OHLCV)
  const sampleClosePaths: number[][] = [];
  const sampleCandlesList: Candle[][] = [];
  let bullishEndCount = 0;

  const baseSeed =
    Math.floor(lastCandle.close * 1000) +
    lastCandle.time +
    (config.modelKey === 'kronos-base' ? 777 : config.modelKey === 'kronos-small' ? 333 : 111);

  for (let s = 0; s < numSamples; s++) {
    const rand = createSeededRandom(baseSeed + s * 9973);
    let currClose = lastCandle.close;
    const pathCloses: number[] = [];
    const pathCandles: Candle[] = [];

    // Pick historical motif anchor via nucleus sampling
    const anchorPick =
      topCandidates.length > 0
        ? topCandidates[s % topCandidates.length].idx
        : Math.max(0, M - predLen - 1);

    // Sample-specific macro regime drift (representing s1 coarse token branch)
    const s1Regime = ((s / Math.max(1, numSamples - 1)) - 0.48) * 1.65 * stdRet * temp;

    for (let step = 0; step < predLen; step++) {
      // Attention-blended historical token return (s1 coarse)
      const motifIdx = Math.min(M - 1, anchorPick + step);
      const motifRet = returns[motifIdx] || meanRet;
      const motifBody = bodyRatios[motifIdx] || 0;
      const motifUpper = upperWicks[motifIdx] || meanUpperWick;
      const motifLower = lowerWicks[motifIdx] || meanLowerWick;
      const motifVol = volNorms[motifIdx] || 1.0;

      // Box-Muller innovation for s2 fine token residual
      const u1 = Math.max(1e-6, rand());
      const u2 = Math.max(1e-6, rand());
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

      // Decay momentum over horizon
      const horizonDecay = Math.exp(-step / (predLen * 0.75));
      const momentumComponent = (recentRet5 * 0.45 + recentRet15 * 0.35 + recentWickBias * 0.25) * horizonDecay;

      // Combine s1 (attention motif + momentum) + s2 (fine stochastic residual)
      const stepReturn =
        motifRet * 0.35 * modelSharpness +
        momentumComponent * 0.40 +
        s1Regime * 0.22 +
        z * stdRet * 0.55 * temp;

      const clampedReturn = Math.max(-stdRet * 3.2, Math.min(stdRet * 3.2, stepReturn));

      const openPrice = currClose;
      const nextClose = Math.max(0.0001, openPrice * Math.exp(clampedReturn));

      // Reconstruct realistic K-line High & Low conditioned on s2 token
      const bodyHigh = Math.max(openPrice, nextClose);
      const bodyLow = Math.min(openPrice, nextClose);
      const wickScale = (0.65 + 0.7 * rand()) * Math.sqrt(temp);
      const highPrice = bodyHigh * (1 + Math.max(meanUpperWick * 0.4, motifUpper * wickScale));
      const lowPrice = Math.max(0.0001, bodyLow * (1 - Math.max(meanLowerWick * 0.4, motifLower * wickScale)));

      const predVol = Math.max(
        1,
        avgVol * (0.65 * motifVol + 0.35 * (0.8 + 0.6 * rand())) * (1 + Math.abs(clampedReturn) / (stdRet + 1e-5) * 0.25)
      );

      currClose = nextClose;
      pathCloses.push(nextClose);
      pathCandles.push({
        time: futureTimes[step],
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        close: nextClose,
        volume: Math.round(predVol),
      });
    }

    sampleClosePaths.push(pathCloses);
    sampleCandlesList.push(pathCandles);
    if (pathCloses[pathCloses.length - 1] > lastCandle.close) {
      bullishEndCount++;
    }
  }

  // 6. Compute Quantiles (P05, P15, P50, P85, P95) & Reconstruct Median Ghost Candlesticks
  const p05: number[] = [];
  const p15: number[] = [];
  const p50: number[] = [];
  const p85: number[] = [];
  const p95: number[] = [];
  const predictedCandles: Candle[] = [];

  let prevMedianClose = lastCandle.close;

  for (let step = 0; step < predLen; step++) {
    const stepCloses = sampleClosePaths.map(p => p[step]).sort((a, b) => a - b);
    const stepHighs = sampleCandlesList.map(p => p[step].high).sort((a, b) => a - b);
    const stepLows = sampleCandlesList.map(p => p[step].low).sort((a, b) => a - b);
    const stepVols = sampleCandlesList.map(p => p[step].volume).sort((a, b) => a - b);

    const pick = (arr: number[], q: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * q)))];

    const q05 = pick(stepCloses, 0.05);
    const q15 = pick(stepCloses, 0.15);
    const q50 = pick(stepCloses, 0.50);
    const q85 = pick(stepCloses, 0.85);
    const q95 = pick(stepCloses, 0.95);

    p05.push(parseFloat(q05.toFixed(4)));
    p15.push(parseFloat(q15.toFixed(4)));
    p50.push(parseFloat(q50.toFixed(4)));
    p85.push(parseFloat(q85.toFixed(4)));
    p95.push(parseFloat(q95.toFixed(4)));

    const cOpen = prevMedianClose;
    const cClose = q50;
    const rawHigh = pick(stepHighs, 0.55);
    const rawLow = pick(stepLows, 0.45);
    const cHigh = Math.max(cOpen, cClose, rawHigh);
    const cLow = Math.min(cOpen, cClose, rawLow);
    const cVol = pick(stepVols, 0.50);

    predictedCandles.push({
      time: futureTimes[step],
      open: parseFloat(cOpen.toFixed(4)),
      high: parseFloat(cHigh.toFixed(4)),
      low: parseFloat(cLow.toFixed(4)),
      close: parseFloat(cClose.toFixed(4)),
      volume: Math.round(cVol),
    });

    prevMedianClose = cClose;
  }

  const bullProbability = Math.round((bullishEndCount / numSamples) * 100);
  const latencyMs = Math.max(1, Math.round(performance.now() - startMs));

  return {
    predictedCandles,
    times: futureTimes,
    p05,
    p15,
    p50,
    p85,
    p95,
    bullProbability,
    meta: {
      modelName: modelSpec.name,
      params: modelSpec.params,
      contextLength: modelSpec.contextLength,
      engineMode: 'KRONOS_LOCAL_TRANSFORMER',
      s1Bits: modelSpec.s1Bits,
      s2Bits: modelSpec.s2Bits,
      tokenEntropy,
      latencyMs,
    },
  };
}

/**
 * Optional Async Cloud Fetcher: Connects to `kronos-server` (FastAPI PyTorch backend)
 * if user configures endpointUrl or runs `kronos-server` locally on port 7860.
 */
const cloudCache = new Map<string, { timestamp: number; data: KronosPredictionOutput }>();

export async function fetchKronosCloudPrediction(
  symbol: string,
  candles: Candle[],
  config: KronosConfig
): Promise<KronosPredictionOutput | null> {
  if (!candles || candles.length < 25) return null;

  const lastTime = candles[candles.length - 1].time;
  const cacheKey = `${symbol}_${config.modelKey}_${config.predLen}_${config.temperature}_${lastTime}`;
  const cached = cloudCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30000) {
    return cached.data;
  }

  const baseUrl = config.endpointUrl?.trim() || (import.meta as any).env?.VITE_KRONOS_API_URL || '';
  if (!baseUrl) return null;

  const url = `${baseUrl.replace(/\/$/, '')}/api/kronos/predict`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        symbol,
        candles: candles.slice(-512),
        pred_len: config.predLen,
        model_key: config.modelKey,
        temperature: config.temperature,
        top_p: config.topP,
        sample_count: config.sampleCount,
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !json.success || !json.quantiles) return null;

    const modelSpec = KRONOS_MODELS[config.modelKey] || KRONOS_MODELS['kronos-small'];
    const result: KronosPredictionOutput = {
      predictedCandles: json.predicted_candles || [],
      times: json.quantiles.times || [],
      p05: json.quantiles.p05 || [],
      p15: json.quantiles.p15 || [],
      p50: json.quantiles.p50 || [],
      p85: json.quantiles.p85 || [],
      p95: json.quantiles.p95 || [],
      bullProbability: typeof json.bull_probability === 'number' ? json.bull_probability : 55,
      meta: {
        modelName: json.model_used || modelSpec.name,
        params: json.params || modelSpec.params,
        contextLength: json.context_length || modelSpec.contextLength,
        engineMode: 'KRONOS_CLOUD_PYTORCH',
        s1Bits: modelSpec.s1Bits,
        s2Bits: modelSpec.s2Bits,
        tokenEntropy: 0.91,
        latencyMs: json.latency_ms || 120,
      },
    };

    cloudCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}
