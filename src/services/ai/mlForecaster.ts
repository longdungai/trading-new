import { AIPrediction, AIPredictionScenario, Candle } from '../../types';
import { calculateEMA, calculateMACD, calculateRSI } from '../indicators';
import { runMonteCarloSimulation } from './monteCarlo';

export function generateAIPrediction(
  symbol: string,
  candles: Candle[],
  forecastBars: number = 20
): AIPrediction {
  if (candles.length < 35) {
    const currentPrice = candles[candles.length - 1]?.close || 100;
    return {
      symbol,
      currentPrice,
      trend: 'NEUTRAL',
      confidenceScore: 50,
      expectedPriceChangePercent: 0,
      forecastHorizonBars: forecastBars,
      upperConfidenceBound: [],
      lowerConfidenceBound: [],
      medianForecast: [],
      scenarios: [],
      volatilityForecast: 1.5,
      aiReasoning: ['Chưa đủ dữ liệu lịch sử để chạy mô hình dự báo AI.'],
      keyDrivers: ['Cần ít nhất 35 nến giá'],
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
  const ema200 = calculateEMA(closes, 200);

  const currEma20 = ema20[ema20.length - 1] || currentPrice;
  const currEma50 = ema50[ema50.length - 1] || currentPrice;
  const currEma200 = ema200[ema200.length - 1] || currentPrice;

  // 2. Score Trend & Drivers
  let bullishScore = 0;
  let bearishScore = 0;
  const keyDrivers: string[] = [];
  const aiReasoning: string[] = [];

  // RSI Analysis
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

  // MACD Analysis
  if (currentMACD.histogram > 0 && currentMACD.macd > currentMACD.signal) {
    bullishScore += 25;
    keyDrivers.push('MACD Histogram phân kỳ dương, xu hướng dòng tiền tăng');
  } else if (currentMACD.histogram < 0 && currentMACD.macd < currentMACD.signal) {
    bearishScore += 25;
    keyDrivers.push('MACD Histogram phân kỳ âm, áp lực chốt lời gia tăng');
  }

  // EMA Alignment
  if (currentPrice > currEma20 && currEma20 > currEma50) {
    bullishScore += 30;
    keyDrivers.push('Cấu trúc EMA Bullish (Giá > EMA20 > EMA50) ủng hộ sóng tăng');
  } else if (currentPrice < currEma20 && currEma20 < currEma50) {
    bearishScore += 30;
    keyDrivers.push('Cấu trúc EMA Bearish (Giá < EMA20 < EMA50) cản trở đà phục hồi');
  }

  // Volume Breakout Check
  const lastVolume = candles[candles.length - 1].volume;
  const avgVol = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
  if (lastVolume > avgVol * 1.5) {
    if (candles[candles.length - 1].close > candles[candles.length - 1].open) {
      bullishScore += 20;
      keyDrivers.push('Khối lượng mua đột biến (Volume Surge +50% so với TB 20 phiên)');
    } else {
      bearishScore += 20;
      keyDrivers.push('Khối lượng xả hàng gia tăng đột biến');
    }
  }

  // 3. Monte Carlo Simulation Engine
  const mc = runMonteCarloSimulation(candles, forecastBars, 200);

  // Blend MC probability with Technical score
  const totalScore = bullishScore + bearishScore || 1;
  const techBullishProb = (bullishScore / totalScore) * 100;
  const combinedBullProb = Math.round(techBullishProb * 0.6 + mc.bullProbability * 0.4);

  let trend: AIPrediction['trend'] = 'NEUTRAL';
  let expectedChange = 0;

  if (combinedBullProb >= 72) {
    trend = 'STRONG_BULLISH';
    expectedChange = Math.abs((mc.upper68[mc.upper68.length - 1] - currentPrice) / currentPrice) * 100;
    aiReasoning.push('Mô hình AI xác nhận động lượng tăng trưởng mạnh với xác suất phá đỉnh cao.');
    aiReasoning.push('Các đường trung bình động dốc lên đồng thuận với dòng tiền cá mập tích lũy.');
  } else if (combinedBullProb >= 55) {
    trend = 'BULLISH';
    expectedChange = Math.abs((mc.medianPath[mc.medianPath.length - 1] - currentPrice) / currentPrice) * 100;
    aiReasoning.push('Xu hướng chung nghiêng về phía tăng giá, ưu tiên canh mua khi giá điều chỉnh về hỗ trợ.');
  } else if (combinedBullProb <= 28) {
    trend = 'STRONG_BEARISH';
    expectedChange = -Math.abs((currentPrice - mc.lower68[mc.lower68.length - 1]) / currentPrice) * 100;
    aiReasoning.push('Tín hiệu phân phối rõ rệt. Rủi ro gãy các ngưỡng hỗ trợ quan trọng rất cao.');
  } else if (combinedBullProb <= 45) {
    trend = 'BEARISH';
    expectedChange = -Math.abs((currentPrice - mc.medianPath[mc.medianPath.length - 1]) / currentPrice) * 100;
    aiReasoning.push('Áp lực bán chiếm ưu thế. Nên hạn chế vị thế Mua hoặc đặt Stop Loss chặt chẽ.');
  } else {
    trend = 'NEUTRAL';
    expectedChange = ((mc.medianPath[mc.medianPath.length - 1] - currentPrice) / currentPrice) * 100;
    aiReasoning.push('Thị trường đang đi ngang tích lũy (Sideway). Chờ đợi tín hiệu bứt phá khỏi vùng biên độ.');
  }

  const confidenceScore = Math.min(96, Math.max(52, Math.abs(combinedBullProb - 50) * 1.5 + 50));

  // Build 3 Scenarios
  const bullProb = Math.min(85, Math.max(10, Math.round(combinedBullProb * 0.75 + 10)));
  const bearProb = Math.min(85, Math.max(10, Math.round((100 - combinedBullProb) * 0.75 + 10)));
  const baseProb = Math.max(10, 100 - bullProb - bearProb);

  const bullTarget = mc.upper68[mc.upper68.length - 1];
  const baseTarget = mc.medianPath[mc.medianPath.length - 1];
  const bearTarget = mc.lower68[mc.lower68.length - 1];

  const bullChangePct = currentPrice > 0 ? ((bullTarget - currentPrice) / currentPrice) * 100 : 0;
  const baseChangePct = currentPrice > 0 ? ((baseTarget - currentPrice) / currentPrice) * 100 : 0;
  const bearChangePct = currentPrice > 0 ? ((bearTarget - currentPrice) / currentPrice) * 100 : 0;

  const scenarios: AIPredictionScenario[] = [
    {
      name: 'Kịch bản Tăng Giá (Bullish Expansion)',
      type: 'BULLISH',
      color: '#10b981',
      path: mc.times.map((t, i) => ({ time: t, price: mc.upper68[i] })),
      probability: bullProb,
      targetPrice: bullTarget,
      priceChangePercent: parseFloat(bullChangePct.toFixed(2)),
      invalidationPrice: currentPrice * 0.97,
      timeHorizon: `${forecastBars} nến tới (1 - 2 ngày)`,
      description: 'Phá vỡ kháng cự gần nhất và kích hoạt sóng tăng mở rộng (Target TP).',
      triggers: [
        'Nến đóng cửa giữ vững trên EMA 20 & bứt phá đỉnh ngắn hạn',
        'Khối lượng mua chủ động tăng vượt 130% so với TB 20 phiên',
        'Chỉ báo RSI bứt phá vượt ngưỡng 55 hướng lên vùng tích cực',
      ],
      actionPlan: 'Ưu tiên mở vị thế Mua (Long) khi giá điều chỉnh về vùng hỗ trợ. Chốt lời từng phần tại mục tiêu.',
      riskReward: '1 : 2.8',
    },
    {
      name: 'Kịch bản Cơ Sở (Base Case / Sideway)',
      type: 'BASE',
      color: '#3b82f6',
      path: mc.times.map((t, i) => ({ time: t, price: mc.medianPath[i] })),
      probability: baseProb,
      targetPrice: baseTarget,
      priceChangePercent: parseFloat(baseChangePct.toFixed(2)),
      invalidationPrice: currentPrice * 0.95,
      timeHorizon: `${forecastBars} nến tới (1 - 2 ngày)`,
      description: 'Tiếp tục dao động theo xu hướng trung bình động với biên độ ổn định.',
      triggers: [
        'Giá dao động tích lũy trong vùng hộp cản hỗ trợ - kháng cự',
        'Khối lượng giao dịch ở mức trung bình ổn định, không có xả hàng',
        'Chỉ báo RSI đi ngang trong vùng cân bằng 45 - 55',
      ],
      actionPlan: 'Chiến lược giao dịch lướt sóng biên độ: Mua ở biên dưới hỗ trợ, bán hạ tỉ trọng ở biên trên.',
      riskReward: '1 : 1.8',
    },
    {
      name: 'Kịch bản Điều Chỉnh (Bearish Retest)',
      type: 'BEARISH',
      color: '#f43f5e',
      path: mc.times.map((t, i) => ({ time: t, price: mc.lower68[i] })),
      probability: bearProb,
      targetPrice: bearTarget,
      priceChangePercent: parseFloat(bearChangePct.toFixed(2)),
      invalidationPrice: currentPrice * 1.03,
      timeHorizon: `${forecastBars} nến tới (1 - 2 ngày)`,
      description: 'Điều chỉnh kiểm định lại vùng đáy hỗ trợ và thanh lý các vị thế đòn bẩy cao.',
      triggers: [
        'Gãy qua đường hỗ trợ động EMA 50 hoặc thủng đáy ngắn hạn gần nhất',
        'Xuất hiện phân kỳ âm trên chỉ báo MACD Histogram và RSI',
        'Áp lực bán chốt lời gia tăng khi thị trường chạm vùng cản mạnh',
      ],
      actionPlan: 'Kiên nhẫn chờ giá về vùng hỗ trợ cứng để gom hàng chiết khấu. Đặt Stop Loss chặt chẽ.',
      riskReward: '1 : 2.5',
    },
  ];

  return {
    symbol,
    currentPrice,
    trend,
    confidenceScore: Math.round(confidenceScore),
    expectedPriceChangePercent: parseFloat(expectedChange.toFixed(2)),
    forecastHorizonBars: forecastBars,
    upperConfidenceBound: mc.times.map((t, i) => ({ time: t, price: mc.upper95[i] })),
    lowerConfidenceBound: mc.times.map((t, i) => ({ time: t, price: mc.lower95[i] })),
    medianForecast: mc.times.map((t, i) => ({ time: t, price: mc.medianPath[i] })),
    scenarios,
    volatilityForecast: parseFloat((Math.abs(mc.upper95[0] - mc.lower95[0]) / currentPrice * 100).toFixed(2)),
    aiReasoning,
    keyDrivers,
  };
}
