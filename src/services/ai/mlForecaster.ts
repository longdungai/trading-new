import {
  AIPrediction,
  AIPredictionScenario,
  Candle,
  KronosConfig,
  KronosVolumeProfile,
  Timeframe,
} from '../../types';
import { calculateEMA, calculateMACD, calculateRSI } from '../indicators';
import {
  KRONOS_MODELS,
  KronosPredictionOutput,
  evaluateKronosMTFConfluence,
  evaluateKronosWalkForward,
  loadKronosConfig,
  runKronosLocalEngine,
} from './kronosClient';

export function generateAIPrediction(
  symbol: string,
  candles: Candle[],
  forecastBars: number = 24,
  customKronosConfig?: KronosConfig,
  cloudOverride?: KronosPredictionOutput | null,
  activeTimeframe: Timeframe = '1h',
  realMtfMap?: Partial<Record<Timeframe, Candle[]>>
): AIPrediction {
  const cfg = customKronosConfig || loadKronosConfig();
  const effectiveBars = cfg.predLen || forecastBars || 24;
  const modelSpec = KRONOS_MODELS[cfg.modelKey] || KRONOS_MODELS['kronos-small'];

  if (candles.length < 30) {
    const currentPrice = candles[candles.length - 1]?.close || 100;
    return {
      symbol,
      currentPrice,
      trend: 'NEUTRAL',
      confidenceScore: 50,
      expectedPriceChangePercent: 0,
      forecastHorizonBars: effectiveBars,
      upperConfidenceBound: [],
      lowerConfidenceBound: [],
      medianForecast: [],
      predictedCandles: [],
      kronosMeta: {
        modelName: modelSpec.name,
        params: modelSpec.params,
        contextLength: modelSpec.contextLength,
        engineMode: 'KRONOS_LOCAL_TRANSFORMER',
        s1Bits: modelSpec.s1Bits,
        s2Bits: modelSpec.s2Bits,
        tokenEntropy: 0.7,
        latencyMs: 1,
      },
      scenarios: [],
      volatilityForecast: 1.5,
      aiReasoning: ['Đang nạp chuỗi nến lịch sử để lượng tử hóa BSQuantizer cho mô hình Kronos...'],
      keyDrivers: ['Cần tối thiểu 30 nến OHLCV'],
    };
  }

  const currentPrice = candles[candles.length - 1].close;
  const closes = candles.map(c => c.close);

  // 1. Calculate Technical Factors
  const rsiData = calculateRSI(candles, 14);
  const currentRSI = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : 50;

  const macdData = calculateMACD(candles);
  const currentMACD = macdData.length > 0 ? macdData[macdData.length - 1] : { macd: 0, signal: 0, histogram: 0 };

  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  const currEma20 = ema20[ema20.length - 1] || currentPrice;
  const currEma50 = ema50[ema50.length - 1] || currentPrice;

  // 2. Score Technical Confluence
  let bullishScore = 0;
  let bearishScore = 0;
  const keyDrivers: string[] = [];
  const aiReasoning: string[] = [];

  if (currentRSI < 30) {
    bullishScore += 25;
    keyDrivers.push(`RSI Quá bán (${currentRSI.toFixed(1)}) - Tín hiệu đảo chiều tăng mạnh`);
  } else if (currentRSI > 70) {
    bearishScore += 25;
    keyDrivers.push(`RSI Quá mua (${currentRSI.toFixed(1)}) - Nguy cơ điều chỉnh ngắn hạn`);
  } else if (currentRSI >= 50) {
    bullishScore += 15;
    keyDrivers.push(`RSI duy trì vùng tích cực (>50: ${currentRSI.toFixed(1)})`);
  } else {
    bearishScore += 15;
    keyDrivers.push(`RSI nằm dưới đường cân bằng (<50: ${currentRSI.toFixed(1)})`);
  }

  if (currentMACD.histogram > 0 && currentMACD.macd > currentMACD.signal) {
    bullishScore += 25;
    keyDrivers.push('MACD Histogram phân kỳ dương, xu hướng dòng tiền tăng');
  } else if (currentMACD.histogram < 0 && currentMACD.macd < currentMACD.signal) {
    bearishScore += 25;
    keyDrivers.push('MACD Histogram phân kỳ âm, áp lực chốt lời gia tăng');
  }

  if (currentPrice > currEma20 && currEma20 > currEma50) {
    bullishScore += 30;
    keyDrivers.push('Cấu trúc EMA Bullish (Giá > EMA20 > EMA50) ủng hộ sóng tăng');
  } else if (currentPrice < currEma20 && currEma20 < currEma50) {
    bearishScore += 30;
    keyDrivers.push('Cấu trúc EMA Bearish (Giá < EMA20 < EMA50) cản trở đà phục hồi');
  }

  const lastVolume = candles[candles.length - 1].volume;
  const avgVol = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
  if (lastVolume > avgVol * 1.4) {
    if (candles[candles.length - 1].close > candles[candles.length - 1].open) {
      bullishScore += 20;
      keyDrivers.push('Khối lượng mua đột biến (Volume Surge vượt 140% TB 20 phiên)');
    } else {
      bearishScore += 20;
      keyDrivers.push('Khối lượng xả hàng gia tăng đột biến');
    }
  }

  // 3. Run Kronos K-line Foundation Model (Cloud PyTorch override or Local Transformer Engine)
  const kronosOut: KronosPredictionOutput =
    cloudOverride && cloudOverride.times.length > 0
      ? cloudOverride
      : runKronosLocalEngine(candles, { ...cfg, predLen: effectiveBars });

  // Blend Kronos autoregressive probability with technical confluence
  const totalScore = bullishScore + bearishScore || 1;
  const techBullishProb = (bullishScore / totalScore) * 100;
  const combinedBullProb = Math.round(kronosOut.bullProbability * 0.62 + techBullishProb * 0.38);

  const bullTarget = kronosOut.p85[kronosOut.p85.length - 1] || currentPrice * 1.03;
  const baseTarget = kronosOut.p50[kronosOut.p50.length - 1] || currentPrice;
  const bearTarget = kronosOut.p15[kronosOut.p15.length - 1] || currentPrice * 0.97;

  let trend: AIPrediction['trend'] = 'NEUTRAL';
  let expectedChange = ((baseTarget - currentPrice) / currentPrice) * 100;

  aiReasoning.push(
    `Kronos Foundation Model (${kronosOut.meta.modelName} • ${kronosOut.meta.params}) lượng tử hóa BSQuantizer (${kronosOut.meta.s1Bits}+${kronosOut.meta.s2Bits} bits, Entropy H=${kronosOut.meta.tokenEntropy}) dự báo ${effectiveBars} nến OHLCV tiếp theo.`
  );

  if (combinedBullProb >= 70) {
    trend = 'STRONG_BULLISH';
    expectedChange = Math.max(expectedChange, ((bullTarget - currentPrice) / currentPrice) * 0.75 * 100);
    aiReasoning.push(
      `Xác suất Autoregressive nghiêng mạnh về chiều Tăng (${combinedBullProb}% kịch bản đóng cửa trên mốc hiện tại).`
    );
  } else if (combinedBullProb >= 55) {
    trend = 'BULLISH';
    expectedChange = Math.max(0.15, expectedChange);
    aiReasoning.push(
      `Chuỗi token K-line phân cấp (s1/s2) ghi nhận lực cầu hấp thụ tốt tại các nhịp râu nến rút chân.`
    );
  } else if (combinedBullProb <= 30) {
    trend = 'STRONG_BEARISH';
    expectedChange = Math.min(expectedChange, ((bearTarget - currentPrice) / currentPrice) * 0.75 * 100);
    aiReasoning.push(
      `Mô hình Kronos phát hiện cấu trúc phân phối mạnh (${100 - combinedBullProb}% mẫu thử phá vỡ xuống dưới).`
    );
  } else if (combinedBullProb <= 45) {
    trend = 'BEARISH';
    expectedChange = Math.min(-0.15, expectedChange);
    aiReasoning.push('Áp lực cung ngắn hạn chiếm ưu thế trên các token nến gần nhất. Ưu tiên quản trị rủi ro.');
  } else {
    trend = 'NEUTRAL';
    aiReasoning.push('Phân phối xác suất Kronos cân bằng (Sideway tích lũy). Giao dịch tại hai biên hỗ trợ/kháng cự.');
  }

  const confidenceScore = Math.min(97, Math.max(55, Math.round(Math.abs(combinedBullProb - 50) * 1.45 + 54)));

  // Build 3 Quantile Scenarios from Kronos P85, P50, P15
  const bullProb = Math.min(82, Math.max(12, Math.round(combinedBullProb * 0.72 + 12)));
  const bearProb = Math.min(82, Math.max(12, Math.round((100 - combinedBullProb) * 0.72 + 12)));
  const baseProb = Math.max(12, 100 - bullProb - bearProb);

  const bullChangePct = currentPrice > 0 ? ((bullTarget - currentPrice) / currentPrice) * 100 : 0;
  const baseChangePct = currentPrice > 0 ? ((baseTarget - currentPrice) / currentPrice) * 100 : 0;
  const bearChangePct = currentPrice > 0 ? ((bearTarget - currentPrice) / currentPrice) * 100 : 0;

  const scenarios: AIPredictionScenario[] = [
    {
      name: 'Kịch bản Tăng Giá (Kronos P85 Bullish)',
      type: 'BULLISH',
      color: '#10b981',
      path: kronosOut.times.map((t, i) => ({ time: t, price: kronosOut.p85[i] })),
      probability: bullProb,
      targetPrice: bullTarget,
      priceChangePercent: parseFloat(bullChangePct.toFixed(2)),
      invalidationPrice: parseFloat((currentPrice * 0.972).toFixed(4)),
      timeHorizon: `${effectiveBars} nến tới (Kronos P85)`,
      description: 'Quỹ đạo phân vị P85 của Kronos: Phá vỡ kháng cự gần nhất và mở rộng biên độ tăng.',
      triggers: [
        'Nến dự báo Kronos (Ghost Candles) đóng cửa liên tiếp phía trên EMA 20',
        'Token định lượng s1/s2 xác nhận xung lực cầu vượt ngưỡng 130% TB 20 phiên',
        'Chỉ báo RSI bứt phá vượt ngưỡng 55 hướng lên vùng tích cực',
      ],
      actionPlan: 'Mở vị thế Mua (Long/Spot) khi giá retest vùng hỗ trợ hoặc khớp nến Kronos đầu tiên. Chốt lời theo P85.',
      riskReward: '1 : 3.0',
    },
    {
      name: 'Kịch bản Cơ Sở (Kronos P50 Median)',
      type: 'BASE',
      color: '#3b82f6',
      path: kronosOut.times.map((t, i) => ({ time: t, price: kronosOut.p50[i] })),
      probability: baseProb,
      targetPrice: baseTarget,
      priceChangePercent: parseFloat(baseChangePct.toFixed(2)),
      invalidationPrice: parseFloat((currentPrice * 0.955).toFixed(4)),
      timeHorizon: `${effectiveBars} nến tới (Kronos P50)`,
      description: 'Quỹ đạo trung vị (Median OHLCV) có xác suất hội tụ cao nhất từ các đường lấy mẫu Nucleus.',
      triggers: [
        'Giá bám sát chuỗi Nến Tương Lai (Ghost Candlesticks) màu xanh lam trên biểu đồ',
        'Khối lượng giao dịch duy trì ổn định quanh mức trung bình',
        'Độ lệch chuẩn nằm gọn trong hành lang tin cậy P15 - P85',
      ],
      actionPlan: 'Giao dịch bám theo trục trung vị P50: Mua tại râu nến dưới dự phóng và chốt lời tại râu nến trên.',
      riskReward: '1 : 2.1',
    },
    {
      name: 'Kịch bản Điều Chỉnh (Kronos P15 Bearish)',
      type: 'BEARISH',
      color: '#f43f5e',
      path: kronosOut.times.map((t, i) => ({ time: t, price: kronosOut.p15[i] })),
      probability: bearProb,
      targetPrice: bearTarget,
      priceChangePercent: parseFloat(bearChangePct.toFixed(2)),
      invalidationPrice: parseFloat((currentPrice * 1.028).toFixed(4)),
      timeHorizon: `${effectiveBars} nến tới (Kronos P15)`,
      description: 'Quỹ đạo phân vị P15 của Kronos: Nhịp rũ bỏ thanh khoản kiểm định lại vùng đáy hỗ trợ.',
      triggers: [
        'Giá đóng cửa thủng biên dưới của nến dự báo Kronos và EMA 50',
        'Xuất hiện phân kỳ âm trên MACD Histogram kèm râu nến trên dài',
        'Áp lực chốt lời gia tăng tại vùng cản tâm lý',
      ],
      actionPlan: 'Đặt lệnh chờ gom hàng chiết khấu tại mục tiêu P15 hoặc mở vị thế Short ngắn hạn có Stop Loss chặt.',
      riskReward: '1 : 2.6',
    },
  ];

  const spreadEnd =
    kronosOut.p95.length > 0
      ? Math.abs(kronosOut.p95[kronosOut.p95.length - 1] - kronosOut.p05[kronosOut.p05.length - 1])
      : currentPrice * 0.03;
  const volForecast = parseFloat(((spreadEnd / Math.max(1e-8, currentPrice)) * 50).toFixed(2));

  // 4. Phase 2.1: Historical Walk-Forward Verification (Back-Projection on closed bars)
  const walkForward = evaluateKronosWalkForward(candles, cfg);

  // 5. Phase 2.2: 6D Predicted Volume Histogram & Liquidity Surge Profile
  let volumeProfile: KronosVolumeProfile | undefined = undefined;
  if (kronosOut.predictedCandles && kronosOut.predictedCandles.length > 0) {
    const safeAvgHistVol = Math.max(1, avgVol);
    const predVols = kronosOut.predictedCandles.map(c => c.volume || 0);
    const avgPredictedVolume = predVols.reduce((s, v) => s + v, 0) / predVols.length;
    let peakPredictedVolume = 0;
    let peakBarOffset = 1;
    predVols.forEach((v, idx) => {
      if (v > peakPredictedVolume) {
        peakPredictedVolume = v;
        peakBarOffset = idx + 1;
      }
    });

    const volumeChangePercent = parseFloat(
      (((avgPredictedVolume - safeAvgHistVol) / safeAvgHistVol) * 100).toFixed(1)
    );
    const peakRatio = peakPredictedVolume / safeAvgHistVol;
    const surgeDetected = peakRatio >= 1.38 || volumeChangePercent >= 22;

    const liquidityRegime: KronosVolumeProfile['liquidityRegime'] = surgeDetected
      ? 'SURGE'
      : volumeChangePercent >= 6
      ? 'ACCUMULATION'
      : volumeChangePercent <= -18
      ? 'DRY_UP'
      : 'NORMAL';

    volumeProfile = {
      avgHistoricalVolume: Math.round(safeAvgHistVol),
      avgPredictedVolume: Math.round(avgPredictedVolume),
      peakPredictedVolume: Math.round(peakPredictedVolume),
      peakBarOffset,
      volumeChangePercent,
      surgeDetected,
      liquidityRegime,
    };

    if (surgeDetected) {
      aiReasoning.push(
        `Cảnh báo Thanh Khoản 6D: Kronos dự báo bùng nổ khối lượng (${peakRatio.toFixed(2)}x TB) quanh nến tương lai thứ +${peakBarOffset}.`
      );
    }
  }

  // 6. Phase 2.3: Multi-Timeframe Kronos Confluence Matrix (15m • 1h • 4h • 1D)
  const mtfConfluence = evaluateKronosMTFConfluence(candles, activeTimeframe, cfg, realMtfMap);

  return {
    symbol,
    currentPrice,
    trend,
    confidenceScore,
    expectedPriceChangePercent: parseFloat(expectedChange.toFixed(2)),
    forecastHorizonBars: effectiveBars,
    upperConfidenceBound: kronosOut.times.map((t, i) => ({ time: t, price: kronosOut.p95[i] })),
    lowerConfidenceBound: kronosOut.times.map((t, i) => ({ time: t, price: kronosOut.p05[i] })),
    medianForecast: kronosOut.times.map((t, i) => ({ time: t, price: kronosOut.p50[i] })),
    predictedCandles: kronosOut.predictedCandles,
    kronosMeta: kronosOut.meta,
    walkForward,
    volumeProfile,
    mtfConfluence,
    scenarios,
    volatilityForecast: volForecast,
    aiReasoning,
    keyDrivers,
  };
}
