import { Candle } from '../../types';
import { calculateMACD, calculateRSI } from '../indicators';

export type DivergenceSignalType =
  | 'REGULAR_BULLISH_DIV'
  | 'REGULAR_BEARISH_DIV'
  | 'HIDDEN_BULLISH_DIV'
  | 'HIDDEN_BEARISH_DIV'
  | 'NONE';

export interface IndicatorDivergenceSignal {
  type: DivergenceSignalType;
  indicator: 'RSI_14' | 'MACD_HIST' | 'DUAL_RSI_MACD';
  badgeVi: string;
  headlineVi: string;
  anchorPivotTime: number;
  currentPivotTime: number;
  priceChangePctBetweenPivots: number;
  strengthScore: number; // 0..100
  actionAdviceVi: string;
}

export type CandlestickPatternCode =
  | 'BULLISH_PINBAR_REJECTION'
  | 'BEARISH_UPTHRUST_REJECTION'
  | 'BULLISH_ENGULFING_SURGE'
  | 'BEARISH_ENGULFING_FLUSH'
  | 'MORNING_STAR_REVERSAL'
  | 'INSIDE_BAR_VCP_COIL';

export interface CandlestickPatternDetection {
  code: CandlestickPatternCode;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL_COIL';
  nameVi: string;
  badgeVi: string;
  barTime: number;
  triggerPrice: number;
  invalidationPrice: number;
  volumeVsAvgRatio: number;
  volumeConfirmed: boolean;
  detailVi: string;
}

export interface TechnicalPatternAndDivergenceReport {
  divergence: IndicatorDivergenceSignal;
  candlestickPatterns: CandlestickPatternDetection[];
  primaryPattern: CandlestickPatternDetection | null;
  compositeBias: 'BULLISH_REVERSAL' | 'BEARISH_WARNING' | 'TIGHT_COIL_READY' | 'NEUTRAL';
  compositeBadgeVi: string;
  summaryVi: string;
}

function findLocalLowIndices(candles: Candle[], lookback: number = 35): number[] {
  const start = Math.max(2, candles.length - lookback);
  const lows: number[] = [];
  for (let i = start; i < candles.length - 1; i++) {
    const prev = candles[i - 1].low;
    const cur = candles[i].low;
    const next = candles[i + 1].low;
    if (cur <= prev && cur <= next) {
      lows.push(i);
    }
  }
  return lows;
}

function findLocalHighIndices(candles: Candle[], lookback: number = 35): number[] {
  const start = Math.max(2, candles.length - lookback);
  const highs: number[] = [];
  for (let i = start; i < candles.length - 1; i++) {
    const prev = candles[i - 1].high;
    const cur = candles[i].high;
    const next = candles[i + 1].high;
    if (cur >= prev && cur >= next) {
      highs.push(i);
    }
  }
  return highs;
}

export function scanDivergenceAndCandlestickPatterns(
  candles: Candle[]
): TechnicalPatternAndDivergenceReport {
  if (!candles || candles.length < 22) {
    return {
      divergence: {
        type: 'NONE',
        indicator: 'RSI_14',
        badgeVi: '⚖️ Không có phân kỳ',
        headlineVi: 'Giá và động lượng RSI/MACD đang đồng pha',
        anchorPivotTime: 0,
        currentPivotTime: 0,
        priceChangePctBetweenPivots: 0,
        strengthScore: 0,
        actionAdviceVi: 'Giao dịch theo xu hướng chính trên biểu đồ.',
      },
      candlestickPatterns: [],
      primaryPattern: null,
      compositeBias: 'NEUTRAL',
      compositeBadgeVi: '⚖️ Nến & Động Lượng Trung Lập',
      summaryVi: 'Chưa xuất hiện phân kỳ hoặc mẫu nến đảo chiều đột biến.',
    };
  }

  const rsiList = calculateRSI(candles, 14);
  const macdList = calculateMACD(candles);

  const rsiByTime = new Map<number, number>();
  for (const r of rsiList) rsiByTime.set(r.time, r.value);

  const macdHistByTime = new Map<number, number>();
  for (const m of macdList) macdHistByTime.set(m.time, m.histogram);

  // 1. Scan Regular & Hidden Divergences over recent swing pivots
  let detectedDiv: IndicatorDivergenceSignal = {
    type: 'NONE',
    indicator: 'RSI_14',
    badgeVi: '⚖️ Đồng pha RSI/MACD',
    headlineVi: 'Giá và chỉ báo RSI/MACD đang di chuyển đồng thuận',
    anchorPivotTime: candles[Math.max(0, candles.length - 10)].time,
    currentPivotTime: candles[candles.length - 1].time,
    priceChangePctBetweenPivots: 0,
    strengthScore: 20,
    actionAdviceVi: 'Tuân thủ điểm mua tại hỗ trợ VWAP/EMA20.',
  };

  const lowIndices = findLocalLowIndices(candles, 32);
  // Also consider the very last bar if it's near a local low
  const candidateLowIdx =
    lowIndices.length >= 2 ? lowIndices : [...lowIndices, candles.length - 1];

  if (candidateLowIdx.length >= 2) {
    const idx2 = candidateLowIdx[candidateLowIdx.length - 1];
    const idx1 = candidateLowIdx[candidateLowIdx.length - 2];
    if (idx2 - idx1 >= 3) {
      const c1 = candles[idx1];
      const c2 = candles[idx2];
      const rsi1 = rsiByTime.get(c1.time);
      const rsi2 = rsiByTime.get(c2.time);
      const mh1 = macdHistByTime.get(c1.time);
      const mh2 = macdHistByTime.get(c2.time);

      const pricePct = Number((((c2.low - c1.low) / Math.max(0.0001, c1.low)) * 100).toFixed(2));
      const rsiBullDiv =
        rsi1 !== undefined && rsi2 !== undefined && c2.low < c1.low * 0.998 && rsi2 > rsi1 + 2.2;
      const macdBullDiv =
        mh1 !== undefined && mh2 !== undefined && c2.low < c1.low * 0.998 && mh2 > mh1 && mh1 < 0;

      if (rsiBullDiv || macdBullDiv) {
        const isDual = rsiBullDiv && macdBullDiv;
        detectedDiv = {
          type: 'REGULAR_BULLISH_DIV',
          indicator: isDual ? 'DUAL_RSI_MACD' : rsiBullDiv ? 'RSI_14' : 'MACD_HIST',
          badgeVi: isDual
            ? '🟢 Phân Kỳ Dương Kép (RSI + MACD)'
            : rsiBullDiv
            ? '🟢 Phân Kỳ Dương Đáy RSI(14)'
            : '🟢 Phân Kỳ Dương MACD Histogram',
          headlineVi: `Giá tạo đáy sau thấp hơn (${pricePct}%) nhưng động lượng ${
            isDual ? 'RSI & MACD' : rsiBullDiv ? 'RSI' : 'MACD'
          } nâng đáy cao hơn — Lực bán đã cạn kiệt`,
          anchorPivotTime: c1.time,
          currentPivotTime: c2.time,
          priceChangePctBetweenPivots: pricePct,
          strengthScore: isDual ? 92 : 80,
          actionAdviceVi:
            'Tín hiệu bắt đáy / mua gom Spot độ tin cậy cao. Giải ngân từng phần khi nến đóng cửa xác nhận rút chân.',
        };
      } else if (
        rsi1 !== undefined &&
        rsi2 !== undefined &&
        c2.low > c1.low * 1.005 &&
        rsi2 < rsi1 - 2.5 &&
        rsi2 < 52
      ) {
        detectedDiv = {
          type: 'HIDDEN_BULLISH_DIV',
          indicator: 'RSI_14',
          badgeVi: '💠 Phân Kỳ Kín Tăng Giá (Hidden Bullish)',
          headlineVi:
            'Giá giữ đáy sau cao hơn đáy trước trong khi RSI rũ bỏ quá mua — Tiếp diễn xu hướng tăng',
          anchorPivotTime: c1.time,
          currentPivotTime: c2.time,
          priceChangePctBetweenPivots: pricePct,
          strengthScore: 76,
          actionAdviceVi: 'Điểm mua nhúng (Pullback) thuận xu hướng tăng cho vị thế Spot.',
        };
      }
    }
  }

  // Check Bearish Divergence if no Bullish Divergence dominated at the very end
  const highIndices = findLocalHighIndices(candles, 32);
  const candidateHighIdx =
    highIndices.length >= 2 ? highIndices : [...highIndices, candles.length - 1];

  if (detectedDiv.type === 'NONE' && candidateHighIdx.length >= 2) {
    const idx2 = candidateHighIdx[candidateHighIdx.length - 1];
    const idx1 = candidateHighIdx[candidateHighIdx.length - 2];
    if (idx2 - idx1 >= 3) {
      const c1 = candles[idx1];
      const c2 = candles[idx2];
      const rsi1 = rsiByTime.get(c1.time);
      const rsi2 = rsiByTime.get(c2.time);
      const mh1 = macdHistByTime.get(c1.time);
      const mh2 = macdHistByTime.get(c2.time);

      const pricePct = Number((((c2.high - c1.high) / Math.max(0.0001, c1.high)) * 100).toFixed(2));
      const rsiBearDiv =
        rsi1 !== undefined && rsi2 !== undefined && c2.high > c1.high * 1.002 && rsi2 < rsi1 - 2.2;
      const macdBearDiv =
        mh1 !== undefined && mh2 !== undefined && c2.high > c1.high * 1.002 && mh2 < mh1 && mh1 > 0;

      if (rsiBearDiv || macdBearDiv) {
        const isDual = rsiBearDiv && macdBearDiv;
        detectedDiv = {
          type: 'REGULAR_BEARISH_DIV',
          indicator: isDual ? 'DUAL_RSI_MACD' : rsiBearDiv ? 'RSI_14' : 'MACD_HIST',
          badgeVi: isDual
            ? '🔴 Phân Kỳ Âm Kép Đỉnh (RSI + MACD)'
            : rsiBearDiv
            ? '🔴 Phân Kỳ Âm Đỉnh RSI(14)'
            : '🔴 Phân Kỳ Âm MACD Histogram',
          headlineVi: `Giá rướn đỉnh cao hơn (+${pricePct}%) nhưng động lượng ${
            isDual ? 'RSI & MACD' : rsiBearDiv ? 'RSI' : 'MACD'
          } suy yếu rõ rệt — Cảnh báo kéo xả`,
          anchorPivotTime: c1.time,
          currentPivotTime: c2.time,
          priceChangePctBetweenPivots: pricePct,
          strengthScore: isDual ? 90 : 78,
          actionAdviceVi:
            'Tuyệt đối không mua đuổi Spot tại vùng đỉnh phân kỳ âm; ưu tiên chốt lời thu tiền mặt ít nhất 50% vị thế.',
        };
      }
    }
  }

  // 2. Scan Recent 3 Bars for Volume-Confirmed Candlestick Patterns
  const avgVol20 =
    candles.slice(-21, -1).reduce((s, c) => s + Math.max(1, c.volume), 0) /
    Math.max(1, candles.slice(-21, -1).length);

  const patterns: CandlestickPatternDetection[] = [];
  const startScan = Math.max(2, candles.length - 3);

  for (let i = startScan; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const prev2 = candles[i - 2];

    const range = Math.max(0.00001, cur.high - cur.low);
    const body = Math.abs(cur.close - cur.open);
    const lowerWick = Math.min(cur.open, cur.close) - cur.low;
    const upperWick = cur.high - Math.max(cur.open, cur.close);
    const volRatio = Number((cur.volume / Math.max(1, avgVol20)).toFixed(2));
    const volConfirmed = volRatio >= 1.1;

    // Pattern 1: Bullish Pinbar / Hammer Rejection
    if (lowerWick >= range * 0.55 && body <= range * 0.35 && cur.close >= cur.low + range * 0.62) {
      patterns.push({
        code: 'BULLISH_PINBAR_REJECTION',
        direction: 'BULLISH',
        nameVi: 'Nến Pinbar Rút Chân Đỡ Giá',
        badgeVi: `🔨 Pinbar Rút Chân (${volRatio}x Vol)`,
        barTime: cur.time,
        triggerPrice: cur.high,
        invalidationPrice: cur.low,
        volumeVsAvgRatio: volRatio,
        volumeConfirmed: volConfirmed,
        detailVi: `Bóng dưới dài chiếm ${Math.round(
          (lowerWick / range) * 100
        )}% thân nến kèm KL ${volRatio}x TB20 — Cầu bắt đáy hấp thụ mạnh cung bán tháo.`,
      });
    }

    // Pattern 2: Bearish Upthrust / Shooting Star
    if (upperWick >= range * 0.55 && body <= range * 0.35 && cur.close <= cur.low + range * 0.38) {
      patterns.push({
        code: 'BEARISH_UPTHRUST_REJECTION',
        direction: 'BEARISH',
        nameVi: 'Nến Upthrust Bẫy Giá Đỉnh',
        badgeVi: `☄️ Upthrust Bị Dội Ngược (${volRatio}x Vol)`,
        barTime: cur.time,
        triggerPrice: cur.low,
        invalidationPrice: cur.high,
        volumeVsAvgRatio: volRatio,
        volumeConfirmed: volConfirmed,
        detailVi: `Bóng trên dài ${Math.round(
          (upperWick / range) * 100
        )}% bị bán dội ngược cuối phiên — Cảnh báo lực cung chốt lời đè giá.`,
      });
    }

    // Pattern 3: Bullish Engulfing with Volume Surge
    const prevBear = prev.close < prev.open;
    const curBull = cur.close > cur.open;
    if (
      prevBear &&
      curBull &&
      cur.close >= prev.open &&
      cur.open <= prev.close * 1.002 &&
      body > Math.abs(prev.close - prev.open) * 1.08
    ) {
      patterns.push({
        code: 'BULLISH_ENGULFING_SURGE',
        direction: 'BULLISH',
        nameVi: 'Nến Nhấn Chìm Tăng (Bullish Engulfing)',
        badgeVi: `🚀 Nhấn Chìm Tăng (${volRatio}x Vol)`,
        barTime: cur.time,
        triggerPrice: cur.close,
        invalidationPrice: Math.min(cur.low, prev.low),
        volumeVsAvgRatio: volRatio,
        volumeConfirmed: volConfirmed,
        detailVi: `Nến xanh thân lớn nuốt trọn nến đỏ trước đó với KL ${volRatio}x TB20 — Phe mua làm chủ hoàn toàn.`,
      });
    }

    // Pattern 4: Bearish Engulfing
    const prevBull = prev.close > prev.open;
    const curBear = cur.close < cur.open;
    if (
      prevBull &&
      curBear &&
      cur.close <= prev.open &&
      cur.open >= prev.close * 0.998 &&
      body > Math.abs(prev.close - prev.open) * 1.08
    ) {
      patterns.push({
        code: 'BEARISH_ENGULFING_FLUSH',
        direction: 'BEARISH',
        nameVi: 'Nến Nhấn Chìm Giảm (Bearish Engulfing)',
        badgeVi: `⚠️ Nhấn Chìm Giảm (${volRatio}x Vol)`,
        barTime: cur.time,
        triggerPrice: cur.low,
        invalidationPrice: Math.max(cur.high, prev.high),
        volumeVsAvgRatio: volRatio,
        volumeConfirmed: volConfirmed,
        detailVi: `Nến đỏ áp đảo hoàn toàn nến tăng trước đó (KL ${volRatio}x) — Rủi ro đảo chiều ngắn hạn.`,
      });
    }

    // Pattern 5: Morning Star 3-Bar Reversal
    const prev2Bear = prev2.close < prev2.open;
    const prevSmallBody =
      Math.abs(prev.close - prev.open) <= (prev2.high - prev2.low) * 0.35;
    if (
      prev2Bear &&
      prevSmallBody &&
      curBull &&
      cur.close >= (prev2.open + prev2.close) / 2
    ) {
      patterns.push({
        code: 'MORNING_STAR_REVERSAL',
        direction: 'BULLISH',
        nameVi: 'Mô Hình Sao Mai 3 Nến (Morning Star)',
        badgeVi: `🌟 Sao Mai Đảo Chiều Tăng`,
        barTime: cur.time,
        triggerPrice: cur.close,
        invalidationPrice: Math.min(prev.low, cur.low),
        volumeVsAvgRatio: volRatio,
        volumeConfirmed: volConfirmed,
        detailVi:
          'Cụm 3 nến tạo đáy kinh điển: Nến giảm mạnh → Nến chững đà → Nến xanh bứt phá vượt 50% thân nến đầu.',
      });
    }

    // Pattern 6: Inside Bar VCP Tight Coil
    if (cur.high <= prev.high && cur.low >= prev.low && volRatio <= 0.95) {
      patterns.push({
        code: 'INSIDE_BAR_VCP_COIL',
        direction: 'NEUTRAL_COIL',
        nameVi: 'Nến Inside Bar Nén Chặt Cạn Cung',
        badgeVi: `📦 Inside Bar Cạn Cung (${volRatio}x Vol)`,
        barTime: cur.time,
        triggerPrice: prev.high,
        invalidationPrice: prev.low,
        volumeVsAvgRatio: volRatio,
        volumeConfirmed: true,
        detailVi: `Biên độ giá thu hẹp nằm gọn trong nến trước kèm thanh khoản cạn (${volRatio}x) — Chuẩn bị nổ sóng khi vượt ${prev.high}.`,
      });
    }
  }

  const primaryPattern = patterns.length > 0 ? patterns[patterns.length - 1] : null;

  let compositeBias: TechnicalPatternAndDivergenceReport['compositeBias'] = 'NEUTRAL';
  let compositeBadgeVi = '⚖️ Động Lượng & Mẫu Nến Ổn Định';

  if (
    detectedDiv.type === 'REGULAR_BULLISH_DIV' ||
    detectedDiv.type === 'HIDDEN_BULLISH_DIV' ||
    primaryPattern?.direction === 'BULLISH'
  ) {
    compositeBias = 'BULLISH_REVERSAL';
    compositeBadgeVi =
      detectedDiv.type !== 'NONE' && primaryPattern?.direction === 'BULLISH'
        ? `🔥 Hội Tụ Đảo Chiều Tăng: ${detectedDiv.badgeVi} + ${primaryPattern.nameVi}`
        : detectedDiv.type !== 'NONE'
        ? detectedDiv.badgeVi
        : primaryPattern?.badgeVi || '🟢 Tín hiệu Nến Đảo Chiều Tăng';
  } else if (
    detectedDiv.type === 'REGULAR_BEARISH_DIV' ||
    primaryPattern?.direction === 'BEARISH'
  ) {
    compositeBias = 'BEARISH_WARNING';
    compositeBadgeVi =
      detectedDiv.type === 'REGULAR_BEARISH_DIV'
        ? detectedDiv.badgeVi
        : primaryPattern?.badgeVi || '🔴 Cảnh Báo Nến Đảo Chiều Giảm';
  } else if (primaryPattern?.direction === 'NEUTRAL_COIL') {
    compositeBias = 'TIGHT_COIL_READY';
    compositeBadgeVi = primaryPattern.badgeVi;
  }

  const summaryVi =
    primaryPattern && detectedDiv.type !== 'NONE'
      ? `${detectedDiv.headlineVi}. Đồng thời xuất hiện ${primaryPattern.nameVi} (${primaryPattern.detailVi})`
      : primaryPattern
      ? `${primaryPattern.nameVi}: ${primaryPattern.detailVi}`
      : detectedDiv.headlineVi;

  return {
    divergence: detectedDiv,
    candlestickPatterns: patterns,
    primaryPattern,
    compositeBias,
    compositeBadgeVi,
    summaryVi,
  };
}
