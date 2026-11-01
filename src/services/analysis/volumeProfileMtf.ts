import { Candle, Timeframe } from '../../types';
import { calculateEMA, calculateRSI, calculateSuperTrend } from '../indicators';

export interface VolumeProfileRow {
  binIndex: number;
  priceLow: number;
  priceHigh: number;
  priceMid: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  deltaVolume: number;
  volumePctOfMax: number; // 0..100 for horizontal bar width
  isPoc: boolean;
  inValueArea: boolean;
  nodeType: 'POC' | 'HVN' | 'LVN' | 'NORMAL';
}

export interface VisibleVolumeProfileResult {
  rows: VolumeProfileRow[];
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  totalVolume: number;
  netDeltaVolume: number;
  buyPressurePct: number; // 0..100
  pricePositionVsVa: 'ABOVE_VAH' | 'INSIDE_VA' | 'BELOW_VAL';
}

export interface VwapPoint {
  time: number;
  vwap: number;
  upperBand: number;
  lowerBand: number;
}

export interface TechnicalMtfRow {
  timeframe: '15m' | '1h' | '4h' | '1D';
  label: string;
  available: boolean;
  lastClose: number | null;
  emaStack: 'BULLISH_RIBBON' | 'BEARISH_RIBBON' | 'MIXED';
  rsi14: number | null;
  supertrendDir: 'BULL' | 'BEAR' | 'NONE';
  structure: 'HH_HL' | 'LH_LL' | 'RANGE';
  bias: 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR';
  score: number; // -100 .. +100
}

export interface TechnicalMtfConfluenceSummary {
  symbol: string;
  activeTimeframe: Timeframe;
  rows: TechnicalMtfRow[];
  availableCount: number;
  bullCount: number;
  bearCount: number;
  overallScore: number; // -100 .. +100 weighted toward higher timeframes (1D & 4h)
  overallRegime: 'STRONG_BULL_ALIGN' | 'BULL_BIAS' | 'CONFLICT_CHOP' | 'BEAR_BIAS' | 'STRONG_BEAR_ALIGN';
  regimeLabel: string;
  conflictWarning: string | null;
}

/**
 * Deterministic Visible Range Volume Profile (VPVR) with 70% Value Area (POC / VAH / VAL)
 * and intrabar wick-weighted Buy/Sell Volume Delta decomposition.
 */
export function calculateVisibleVolumeProfile(
  candles: Candle[],
  rowCount: number = 24,
  valueAreaRatio: number = 0.7
): VisibleVolumeProfileResult | null {
  if (!candles || candles.length < 5 || rowCount < 4) return null;

  let minLow = Infinity;
  let maxHigh = -Infinity;
  for (const c of candles) {
    if (Number.isFinite(c.low) && c.low < minLow) minLow = c.low;
    if (Number.isFinite(c.high) && c.high > maxHigh) maxHigh = c.high;
  }

  if (!Number.isFinite(minLow) || !Number.isFinite(maxHigh) || maxHigh <= minLow) {
    return null;
  }

  const range = maxHigh - minLow;
  const binStep = range / rowCount;

  const buyBins = new Array<number>(rowCount).fill(0);
  const sellBins = new Array<number>(rowCount).fill(0);

  for (const c of candles) {
    const vol = Math.max(0, Number.isFinite(c.volume) ? c.volume : 0);
    if (vol <= 0) continue;

    // Intrabar buying pressure ratio using close position inside high-low bar range
    const barSpan = Math.max(1e-9, c.high - c.low);
    const closeLoc = Math.min(1, Math.max(0, (c.close - c.low) / barSpan));
    const dirBoost = c.close >= c.open ? 0.58 : 0.42;
    const buyRatio = Math.min(0.92, Math.max(0.08, closeLoc * 0.65 + dirBoost * 0.35));

    const barBuyVol = vol * buyRatio;
    const barSellVol = vol - barBuyVol;

    const startBin = Math.max(0, Math.min(rowCount - 1, Math.floor((c.low - minLow) / binStep)));
    const endBin = Math.max(0, Math.min(rowCount - 1, Math.floor((c.high - minLow) / binStep)));
    const touchedBins = endBin - startBin + 1;

    const buyPerBin = barBuyVol / touchedBins;
    const sellPerBin = barSellVol / touchedBins;

    for (let b = startBin; b <= endBin; b++) {
      buyBins[b] += buyPerBin;
      sellBins[b] += sellPerBin;
    }
  }

  const totalBins = buyBins.map((bv, idx) => bv + sellBins[idx]);
  const grandTotalVolume = totalBins.reduce((acc, v) => acc + v, 0);
  if (grandTotalVolume <= 0) return null;

  let pocIndex = 0;
  let maxBinVol = -1;
  for (let i = 0; i < rowCount; i++) {
    if (totalBins[i] > maxBinVol) {
      maxBinVol = totalBins[i];
      pocIndex = i;
    }
  }

  // Expand Value Area outward from POC until >= 70% of total volume is captured
  const targetVaVol = grandTotalVolume * valueAreaRatio;
  let accumulatedVa = totalBins[pocIndex];
  let vaLowIdx = pocIndex;
  let vaHighIdx = pocIndex;

  while (accumulatedVa < targetVaVol && (vaLowIdx > 0 || vaHighIdx < rowCount - 1)) {
    const nextAboveVol = vaHighIdx < rowCount - 1 ? totalBins[vaHighIdx + 1] : -1;
    const nextBelowVol = vaLowIdx > 0 ? totalBins[vaLowIdx - 1] : -1;

    if (nextAboveVol >= nextBelowVol && vaHighIdx < rowCount - 1) {
      vaHighIdx++;
      accumulatedVa += totalBins[vaHighIdx];
    } else if (vaLowIdx > 0) {
      vaLowIdx--;
      accumulatedVa += totalBins[vaLowIdx];
    } else {
      break;
    }
  }

  const avgBinVol = grandTotalVolume / rowCount;
  const rows: VolumeProfileRow[] = [];

  for (let i = 0; i < rowCount; i++) {
    const priceLow = minLow + i * binStep;
    const priceHigh = priceLow + binStep;
    const priceMid = (priceLow + priceHigh) / 2;
    const totalVolume = totalBins[i];
    const buyVolume = buyBins[i];
    const sellVolume = sellBins[i];

    let nodeType: VolumeProfileRow['nodeType'] = 'NORMAL';
    if (i === pocIndex) nodeType = 'POC';
    else if (totalVolume >= avgBinVol * 1.45) nodeType = 'HVN';
    else if (totalVolume <= avgBinVol * 0.45) nodeType = 'LVN';

    rows.push({
      binIndex: i,
      priceLow,
      priceHigh,
      priceMid,
      totalVolume,
      buyVolume,
      sellVolume,
      deltaVolume: buyVolume - sellVolume,
      volumePctOfMax: maxBinVol > 0 ? (totalVolume / maxBinVol) * 100 : 0,
      isPoc: i === pocIndex,
      inValueArea: i >= vaLowIdx && i <= vaHighIdx,
      nodeType,
    });
  }

  const pocPrice = rows[pocIndex].priceMid;
  const vahPrice = rows[vaHighIdx].priceHigh;
  const valPrice = rows[vaLowIdx].priceLow;
  const totalBuy = buyBins.reduce((a, b) => a + b, 0);
  const totalSell = sellBins.reduce((a, b) => a + b, 0);
  const lastClose = candles[candles.length - 1].close;

  const pricePositionVsVa: VisibleVolumeProfileResult['pricePositionVsVa'] =
    lastClose > vahPrice ? 'ABOVE_VAH' : lastClose < valPrice ? 'BELOW_VAL' : 'INSIDE_VA';

  return {
    rows,
    pocPrice,
    vahPrice,
    valPrice,
    totalVolume: grandTotalVolume,
    netDeltaVolume: totalBuy - totalSell,
    buyPressurePct: grandTotalVolume > 0 ? (totalBuy / grandTotalVolume) * 100 : 50,
    pricePositionVsVa,
  };
}

/**
 * Rolling Institutional VWAP (Anchored on UTC day boundary for intraday, or 20-bar rolling on >=1D)
 */
export function calculateRollingVWAP(candles: Candle[]): VwapPoint[] {
  if (!candles || candles.length === 0) return [];

  const barStepSec = candles.length >= 2 ? Math.abs(candles[1].time - candles[0].time) : 3600;
  const isIntraday = barStepSec > 0 && barStepSec < 86400;

  const out: VwapPoint[] = [];
  let cumPV = 0;
  let cumVol = 0;
  let cumPV2 = 0;
  let currentDayBucket = -1;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const tp = (c.high + c.low + c.close) / 3;
    const vol = Math.max(1e-6, c.volume || 1);

    if (isIntraday) {
      const dayBucket = Math.floor(c.time / 86400);
      if (dayBucket !== currentDayBucket) {
        currentDayBucket = dayBucket;
        cumPV = 0;
        cumVol = 0;
        cumPV2 = 0;
      }
      cumPV += tp * vol;
      cumVol += vol;
      cumPV2 += tp * tp * vol;
    } else {
      // 20-bar rolling volume-weighted average for Daily/Weekly/Monthly charts
      const slice = candles.slice(Math.max(0, i - 19), i + 1);
      cumPV = 0;
      cumVol = 0;
      cumPV2 = 0;
      for (const sc of slice) {
        const stp = (sc.high + sc.low + sc.close) / 3;
        const svol = Math.max(1e-6, sc.volume || 1);
        cumPV += stp * svol;
        cumVol += svol;
        cumPV2 += stp * stp * svol;
      }
    }

    const vwap = cumVol > 0 ? cumPV / cumVol : tp;
    const variance = Math.max(0, cumVol > 0 ? cumPV2 / cumVol - vwap * vwap : 0);
    const stdDev = Math.sqrt(variance);

    out.push({
      time: c.time,
      vwap,
      upperBand: vwap + stdDev,
      lowerBand: Math.max(0, vwap - stdDev),
    });
  }

  return out;
}

function evaluateSingleTimeframe(
  tf: '15m' | '1h' | '4h' | '1D',
  label: string,
  candles: Candle[] | undefined
): TechnicalMtfRow {
  if (!candles || candles.length < 25) {
    return {
      timeframe: tf,
      label,
      available: false,
      lastClose: null,
      emaStack: 'MIXED',
      rsi14: null,
      supertrendDir: 'NONE',
      structure: 'RANGE',
      bias: 'NEUTRAL',
      score: 0,
    };
  }

  const closes = candles.map(c => c.close);
  const lastClose = closes[closes.length - 1];
  const ema20Arr = calculateEMA(closes, 20);
  const ema50Arr = calculateEMA(closes, Math.min(50, Math.floor(closes.length * 0.8)));
  const e20 = ema20Arr[ema20Arr.length - 1] ?? lastClose;
  const e50 = ema50Arr[ema50Arr.length - 1] ?? lastClose;

  let score = 0;
  let emaStack: TechnicalMtfRow['emaStack'] = 'MIXED';
  if (lastClose > e20 && e20 > e50) {
    emaStack = 'BULLISH_RIBBON';
    score += 38;
  } else if (lastClose < e20 && e20 < e50) {
    emaStack = 'BEARISH_RIBBON';
    score -= 38;
  } else if (lastClose > e20) {
    score += 14;
  } else if (lastClose < e20) {
    score -= 14;
  }

  const rsiArr = calculateRSI(candles, 14);
  const rsiVal = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1].value : null;
  if (rsiVal !== null) {
    if (rsiVal >= 55 && rsiVal <= 74) score += 20;
    else if (rsiVal > 74) score += 8; // strong momentum but overbought
    else if (rsiVal <= 45 && rsiVal >= 26) score -= 20;
    else if (rsiVal < 26) score -= 8;
  }

  const stArr = calculateSuperTrend(candles, 10, 3);
  const stLast = stArr.length > 0 ? stArr[stArr.length - 1] : null;
  const supertrendDir: TechnicalMtfRow['supertrendDir'] = stLast
    ? stLast.direction === 1
      ? 'BULL'
      : 'BEAR'
    : 'NONE';
  if (supertrendDir === 'BULL') score += 26;
  else if (supertrendDir === 'BEAR') score -= 26;

  // Market Structure over recent two 8-bar windows
  const recent8 = candles.slice(-8);
  const prev8 = candles.slice(-16, -8);
  let structure: TechnicalMtfRow['structure'] = 'RANGE';
  if (prev8.length >= 4 && recent8.length >= 4) {
    const rHigh = Math.max(...recent8.map(c => c.high));
    const rLow = Math.min(...recent8.map(c => c.low));
    const pHigh = Math.max(...prev8.map(c => c.high));
    const pLow = Math.min(...prev8.map(c => c.low));
    if (rHigh > pHigh && rLow >= pLow) {
      structure = 'HH_HL';
      score += 16;
    } else if (rHigh <= pHigh && rLow < pLow) {
      structure = 'LH_LL';
      score -= 16;
    }
  }

  const clampedScore = Math.max(-100, Math.min(100, score));
  const bias: TechnicalMtfRow['bias'] =
    clampedScore >= 55
      ? 'STRONG_BULL'
      : clampedScore >= 20
        ? 'BULL'
        : clampedScore <= -55
          ? 'STRONG_BEAR'
          : clampedScore <= -20
            ? 'BEAR'
            : 'NEUTRAL';

  return {
    timeframe: tf,
    label,
    available: true,
    lastClose,
    emaStack,
    rsi14: rsiVal !== null ? Number(rsiVal.toFixed(1)) : null,
    supertrendDir,
    structure,
    bias,
    score: clampedScore,
  };
}

/**
 * Evaluates Multi-Timeframe Technical Alignment strictly on real fetched candles (never fabricates missing TFs).
 */
export function evaluateTechnicalMtfConfluence(
  symbol: string,
  activeTimeframe: Timeframe,
  activeCandles: Candle[],
  mtfMap: Partial<Record<Timeframe, Candle[]>>
): TechnicalMtfConfluenceSummary {
  const tfDefs: { tf: '15m' | '1h' | '4h' | '1D'; label: string; weight: number }[] = [
    { tf: '15m', label: 'M15 (Xung lực)', weight: 0.15 },
    { tf: '1h', label: 'H1 (Trong phiên)', weight: 0.22 },
    { tf: '4h', label: 'H4 (Sóng trung)', weight: 0.30 },
    { tf: '1D', label: 'D1 (Xu hướng lớn)', weight: 0.33 },
  ];

  const rows = tfDefs.map(def => {
    const series = activeTimeframe === def.tf && activeCandles.length >= 25 ? activeCandles : mtfMap[def.tf];
    return evaluateSingleTimeframe(def.tf, def.label, series);
  });

  const availableRows = rows.filter(r => r.available);
  let weightedSum = 0;
  let weightTotal = 0;
  let bullCount = 0;
  let bearCount = 0;

  rows.forEach((row, idx) => {
    if (!row.available) return;
    const w = tfDefs[idx].weight;
    weightedSum += row.score * w;
    weightTotal += w;
    if (row.score >= 20) bullCount++;
    else if (row.score <= -20) bearCount++;
  });

  const overallScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;

  let overallRegime: TechnicalMtfConfluenceSummary['overallRegime'] = 'CONFLICT_CHOP';
  let regimeLabel = 'Phân hóa / Sideway giữa các khung';
  if (overallScore >= 55 && bullCount >= 3) {
    overallRegime = 'STRONG_BULL_ALIGN';
    regimeLabel = 'Đồng thuận TĂNG mạnh đa khung';
  } else if (overallScore >= 22) {
    overallRegime = 'BULL_BIAS';
    regimeLabel = 'Ưu thế TĂNG (Sóng lớn nâng đỡ)';
  } else if (overallScore <= -55 && bearCount >= 3) {
    overallRegime = 'STRONG_BEAR_ALIGN';
    regimeLabel = 'Đồng thuận GIẢM mạnh đa khung';
  } else if (overallScore <= -22) {
    overallRegime = 'BEAR_BIAS';
    regimeLabel = 'Ưu thế GIẢM (Áp lực khung lớn)';
  }

  // Detect dangerous counter-trend scalp (e.g. M15/H1 bullish while H4 & D1 strongly bearish)
  const htfScores = rows.filter(r => r.available && (r.timeframe === '4h' || r.timeframe === '1D'));
  const ltfScores = rows.filter(r => r.available && (r.timeframe === '15m' || r.timeframe === '1h'));
  let conflictWarning: string | null = null;

  if (htfScores.length > 0 && ltfScores.length > 0) {
    const htfAvg = htfScores.reduce((s, r) => s + r.score, 0) / htfScores.length;
    const ltfAvg = ltfScores.reduce((s, r) => s + r.score, 0) / ltfScores.length;
    if (ltfAvg >= 25 && htfAvg <= -30) {
      conflictWarning =
        'Cảnh báo ngược sóng lớn: Khung nhỏ (M15/H1) hồi phục kỹ thuật nhưng H4/D1 đang giảm mạnh (Bull Trap tiềm ẩn).';
    } else if (ltfAvg <= -25 && htfAvg >= 30) {
      conflictWarning =
        'Nhịp rũ trong xu hướng tăng: Khung nhỏ (M15/H1) điều chỉnh ngắn hạn nhưng H4/D1 vẫn giữ cấu trúc tăng.';
    }
  }

  return {
    symbol,
    activeTimeframe,
    rows,
    availableCount: availableRows.length,
    bullCount,
    bearCount,
    overallScore,
    overallRegime,
    regimeLabel,
    conflictWarning,
  };
}
