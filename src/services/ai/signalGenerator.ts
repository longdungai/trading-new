import { Candle, SignalAction, StrategyAnalysisHub, StrategyHubItem, Timeframe, TradeSetup } from '../../types';
import {
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSuperTrend,
} from '../indicators';
import { calculateSupportResistance } from '../analysis/supportResistance';
import { calculateFibonacciLevels } from '../analysis/fibonacci';
import { detectOrderBlocks } from '../analysis/smartMoney';

// Main Strategy Hub Analysis Engine
export function generateStrategyHub(
  symbol: string,
  candles: Candle[],
  timeframe: Timeframe = '1h'
): StrategyAnalysisHub {
  if (!candles || candles.length < 30) {
    const fallbackPrice = candles && candles.length > 0 ? candles[candles.length - 1].close : 100;
    const defaultStrategy: StrategyHubItem = {
      id: 'default',
      name: 'Chiến Lược Xu Hướng Cơ Bản',
      category: 'Xu Hướng',
      description: 'Chờ dữ liệu nến đầy đủ để tính toán tín hiệu chính xác.',
      action: 'WAIT',
      score: 50,
      entryZone: [fallbackPrice * 0.99, fallbackPrice * 1.01],
      stopLoss: fallbackPrice * 0.96,
      takeProfit1: fallbackPrice * 1.03,
      takeProfit2: fallbackPrice * 1.06,
      takeProfit3: fallbackPrice * 1.09,
      riskRewardRatio: 2.0,
      winProbability: 55,
      triggers: ['Đang nạp đủ số lượng nến lịch sử'],
      riskLevel: 'LOW',
      isOptimal: true,
    };
    return {
      symbol,
      timeframe,
      currentPrice: fallbackPrice,
      overallConsensus: 'NEUTRAL',
      confluenceCount: { buy: 0, sell: 0, neutral: 1 },
      bestStrategy: defaultStrategy,
      strategies: [defaultStrategy],
    };
  }

  const currentPrice = candles[candles.length - 1].close;
  const closes = candles.map(c => c.close);
  const atrs = calculateATR(candles, 14);
  const currentAtr = atrs[atrs.length - 1] || currentPrice * 0.02;

  // Calculate Indicator Streams
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsi = calculateRSI(candles, 14);
  const macd = calculateMACD(candles);
  const bb = calculateBollingerBands(candles, 20, 2);
  const supertrend = calculateSuperTrend(candles, 10, 3);
  const srLevels = calculateSupportResistance(candles);
  const fibLevels = calculateFibonacciLevels(candles);
  const orderBlocks = detectOrderBlocks(candles);

  const lastRsiObj = rsi[rsi.length - 1];
  const lastRsi = lastRsiObj ? lastRsiObj.value : 50;
  const lastEma20 = ema20[ema20.length - 1] || currentPrice;
  const lastEma50 = ema50[ema50.length - 1] || currentPrice;
  const lastEma200 = ema200[ema200.length - 1] || currentPrice;
  const lastMacd = macd[macd.length - 1];
  const lastBb = bb[bb.length - 1];
  const lastSt = supertrend[supertrend.length - 1];

  const strategies: StrategyHubItem[] = [];

  // ================= 1. SUPERTREND + EMA GOLDEN CROSS (TREND FOLLOWING) =================
  {
    const isEmaBull = lastEma20 > lastEma50;
    const isStBull = lastSt ? lastSt.direction === 1 : false;
    const isAboveEma200 = currentPrice > lastEma200;

    let action: SignalAction = 'WAIT';
    let score = 50;
    const triggers: string[] = [];

    if (isStBull && isEmaBull) {
      action = isAboveEma200 ? 'STRONG_BUY' : 'BUY';
      score = isAboveEma200 ? 88 : 78;
      triggers.push('SuperTrend xác nhận xu hướng Tăng (Xanh lá)');
      triggers.push('EMA 20 cắt lên trên EMA 50 (Golden Cross)');
      if (isAboveEma200) triggers.push('Giá nằm trên đường trung hạn EMA 200');
    } else if (!isStBull && !isEmaBull) {
      action = !isAboveEma200 ? 'STRONG_SELL' : 'SELL';
      score = !isAboveEma200 ? 86 : 76;
      triggers.push('SuperTrend báo xu hướng Giảm (Đỏ)');
      triggers.push('EMA 20 cắt xuống dưới EMA 50 (Death Cross)');
      if (!isAboveEma200) triggers.push('Giá thủng đường trung hạn EMA 200');
    } else {
      action = 'WAIT';
      score = 50;
      triggers.push('Chỉ báo xu hướng đang phân hóa, chờ tín hiệu rõ ràng');
    }

    const sl = action.includes('BUY') ? currentPrice - currentAtr * 1.8 : currentPrice + currentAtr * 1.8;
    const risk = Math.abs(currentPrice - sl);
    const tp1 = action.includes('BUY') ? currentPrice + risk * 1.5 : currentPrice - risk * 1.5;
    const tp2 = action.includes('BUY') ? currentPrice + risk * 2.5 : currentPrice - risk * 2.5;
    const tp3 = action.includes('BUY') ? currentPrice + risk * 4.0 : currentPrice - risk * 4.0;

    strategies.push({
      id: 'supertrend_ema',
      name: 'SuperTrend + EMA Golden Ribbon',
      category: 'Bám Xu Hướng & Động Lượng',
      description: 'Giao dịch theo xu hướng lớn, lọc nhiễu qua SuperTrend và cặp đường trung bình EMA 20/50/200.',
      action,
      score,
      entryZone: [currentPrice * 0.995, currentPrice * 1.005],
      stopLoss: parseFloat(sl.toFixed(2)),
      takeProfit1: parseFloat(tp1.toFixed(2)),
      takeProfit2: parseFloat(tp2.toFixed(2)),
      takeProfit3: parseFloat(tp3.toFixed(2)),
      riskRewardRatio: parseFloat((risk > 0 ? (Math.abs(tp2 - currentPrice) / risk) : 2.5).toFixed(2)),
      winProbability: action.includes('BUY') || action.includes('SELL') ? 68 : 50,
      triggers,
      riskLevel: 'LOW',
    });
  }

  // ================= 2. SMART MONEY CONCEPTS (SMC) - ORDER BLOCKS & LIQUIDITY SWEEP =================
  {
    const activeBullOb = orderBlocks.find(ob => ob.type === 'bullish_ob' && !ob.mitigated);
    const activeBearOb = orderBlocks.find(ob => ob.type === 'bearish_ob' && !ob.mitigated);

    let action: SignalAction = 'WAIT';
    let score = 50;
    const triggers: string[] = [];

    if (activeBullOb && currentPrice >= activeBullOb.bottom && currentPrice <= activeBullOb.top * 1.02) {
      action = 'STRONG_BUY';
      score = 91;
      triggers.push(`Giá kiểm tra lại Vùng Khối Lệnh Tăng (Bullish Order Block: ${activeBullOb.bottom.toFixed(2)} - ${activeBullOb.top.toFixed(2)})`);
      triggers.push('Dòng tiền cá mập tổ chức kích hoạt lực mua tại vùng đỡ');
    } else if (activeBearOb && currentPrice <= activeBearOb.top && currentPrice >= activeBearOb.bottom * 0.98) {
      action = 'STRONG_SELL';
      score = 89;
      triggers.push(`Giá chạm Khối Lệnh Bán tổ chức (Bearish Order Block: ${activeBearOb.bottom.toFixed(2)} - ${activeBearOb.top.toFixed(2)})`);
      triggers.push('Lực xả từ vùng kháng cự cá mập SMC');
    } else {
      action = currentPrice > lastEma50 ? 'BUY' : 'WAIT';
      score = 62;
      triggers.push('Chờ giá quét thanh khoản (Liquidity Sweep) về vùng Order Block gần nhất');
    }

    const sl = action.includes('BUY')
      ? (activeBullOb ? activeBullOb.bottom * 0.985 : currentPrice - currentAtr * 1.5)
      : (activeBearOb ? activeBearOb.top * 1.015 : currentPrice + currentAtr * 1.5);
    const risk = Math.abs(currentPrice - sl);
    const tp1 = action.includes('BUY') ? currentPrice + risk * 2.0 : currentPrice - risk * 2.0;
    const tp2 = action.includes('BUY') ? currentPrice + risk * 3.5 : currentPrice - risk * 3.5;
    const tp3 = action.includes('BUY') ? currentPrice + risk * 5.0 : currentPrice - risk * 5.0;

    strategies.push({
      id: 'smc_orderblock',
      name: 'SMC - Order Block & Quét Thanh Khoản',
      category: 'Smart Money (Dòng Tiền Cá Mập)',
      description: 'Xác định dấu vết tổ chức tài chính lớn bằng cấu trúc thị trường, Order Block và khoảng trống giá FVG.',
      action,
      score,
      entryZone: [
        parseFloat((action.includes('BUY') && activeBullOb ? activeBullOb.bottom : currentPrice * 0.99).toFixed(2)),
        parseFloat((action.includes('BUY') && activeBullOb ? activeBullOb.top : currentPrice * 1.01).toFixed(2)),
      ],
      stopLoss: parseFloat(sl.toFixed(2)),
      takeProfit1: parseFloat(tp1.toFixed(2)),
      takeProfit2: parseFloat(tp2.toFixed(2)),
      takeProfit3: parseFloat(tp3.toFixed(2)),
      riskRewardRatio: parseFloat((risk > 0 ? (Math.abs(tp2 - currentPrice) / risk) : 3.5).toFixed(2)),
      winProbability: 72,
      triggers,
      riskLevel: 'MEDIUM',
    });
  }

  // ================= 3. FIBONACCI 0.618 GOLDEN POCKET RETRACEMENT =================
  {
    const goldenZone = fibLevels.find(f => f.ratio === 0.618);
    const halfZone = fibLevels.find(f => f.ratio === 0.5);

    let action: SignalAction = 'WAIT';
    let score = 50;
    const triggers: string[] = [];

    if (goldenZone) {
      const distPct = Math.abs(currentPrice - goldenZone.price) / currentPrice;
      if (distPct < 0.015) {
        action = currentPrice >= goldenZone.price ? 'STRONG_BUY' : 'BUY';
        score = 85;
        triggers.push(`Giá chạm Vùng Tỉ Lệ Vàng Fib 61.8% ($${goldenZone.price.toFixed(2)})`);
        triggers.push('Vùng phản ứng kỹ thuật đảo chiều xác suất cao');
      } else if (halfZone && Math.abs(currentPrice - halfZone.price) / currentPrice < 0.015) {
        action = 'BUY';
        score = 75;
        triggers.push(`Giá test hỗ trợ Fibonacci 50.0% ($${halfZone.price.toFixed(2)})`);
      } else {
        action = 'WAIT';
        score = 55;
        triggers.push(`Đang theo dõi sóng hồi về Golden Pocket 61.8% ($${goldenZone.price.toFixed(2)})`);
      }
    }

    const sl = action.includes('BUY') ? (goldenZone ? goldenZone.price * 0.97 : currentPrice - currentAtr * 1.6) : currentPrice + currentAtr * 1.6;
    const risk = Math.abs(currentPrice - sl);
    const tp1 = action.includes('BUY') ? currentPrice + risk * 1.8 : currentPrice - risk * 1.8;
    const tp2 = action.includes('BUY') ? currentPrice + risk * 3.0 : currentPrice - risk * 3.0;
    const tp3 = action.includes('BUY') ? currentPrice + risk * 4.5 : currentPrice - risk * 4.5;

    strategies.push({
      id: 'fib_golden_pocket',
      name: 'Fibonacci Golden Pocket 0.618',
      category: 'Sóng Hồi Kỹ Thuật (Pullback)',
      description: 'Đón đầu các nhịp hồi quy chuẩn mực tại vùng tỉ lệ vàng 61.8% - 65% để tối ưu hóa Risk/Reward.',
      action,
      score,
      entryZone: [
        parseFloat((goldenZone ? goldenZone.price * 0.995 : currentPrice * 0.99).toFixed(2)),
        parseFloat((goldenZone ? goldenZone.price * 1.005 : currentPrice * 1.01).toFixed(2)),
      ],
      stopLoss: parseFloat(sl.toFixed(2)),
      takeProfit1: parseFloat(tp1.toFixed(2)),
      takeProfit2: parseFloat(tp2.toFixed(2)),
      takeProfit3: parseFloat(tp3.toFixed(2)),
      riskRewardRatio: parseFloat((risk > 0 ? (Math.abs(tp2 - currentPrice) / risk) : 3.0).toFixed(2)),
      winProbability: 66,
      triggers,
      riskLevel: 'LOW',
    });
  }

  // ================= 4. RSI DIVERGENCE & MEAN REVERSION =================
  {
    let action: SignalAction = 'WAIT';
    let score = 50;
    const triggers: string[] = [];

    if (lastRsi < 32) {
      action = 'STRONG_BUY';
      score = 84;
      triggers.push(`RSI rơi vào vùng Quá Bán sâu (${lastRsi.toFixed(1)} < 30)`);
      triggers.push('Khả năng cao xuất hiện sóng hồi phục bật tăng mạnh (Mean Reversion)');
    } else if (lastRsi > 68) {
      action = 'STRONG_SELL';
      score = 83;
      triggers.push(`RSI chạm ngưỡng Quá Mua rủi ro (${lastRsi.toFixed(1)} > 70)`);
      triggers.push('Áp lực chốt lời gia tăng, canh hạ tỉ trọng hoặc Short đảo chiều');
    } else if (lastRsi > 50 && lastRsi < 62) {
      action = 'BUY';
      score = 68;
      triggers.push(`RSI duy trì động lượng tích cực (${lastRsi.toFixed(1)} trên mức 50)`);
    } else {
      action = 'WAIT';
      score = 52;
      triggers.push(`RSI ở mức trung tính (${lastRsi.toFixed(1)})`);
    }

    const sl = action.includes('BUY') ? currentPrice - currentAtr * 1.5 : currentPrice + currentAtr * 1.5;
    const risk = Math.abs(currentPrice - sl);
    const tp1 = action.includes('BUY') ? currentPrice + risk * 1.5 : currentPrice - risk * 1.5;
    const tp2 = action.includes('BUY') ? currentPrice + risk * 2.5 : currentPrice - risk * 2.5;
    const tp3 = action.includes('BUY') ? currentPrice + risk * 3.5 : currentPrice - risk * 3.5;

    strategies.push({
      id: 'rsi_divergence',
      name: 'RSI Đảo Chiều & Vùng Quá Bán/Quá Mua',
      category: 'Đảo Chiều Đỉnh Đáy (Reversal)',
      description: 'Khai thác sự cạn kiệt lực bán tại vùng quá bán (RSI < 30) hoặc chốt lời đỉnh khi quá mua (RSI > 70).',
      action,
      score,
      entryZone: [currentPrice * 0.995, currentPrice * 1.005],
      stopLoss: parseFloat(sl.toFixed(2)),
      takeProfit1: parseFloat(tp1.toFixed(2)),
      takeProfit2: parseFloat(tp2.toFixed(2)),
      takeProfit3: parseFloat(tp3.toFixed(2)),
      riskRewardRatio: parseFloat((risk > 0 ? (Math.abs(tp2 - currentPrice) / risk) : 2.5).toFixed(2)),
      winProbability: 64,
      triggers,
      riskLevel: 'MEDIUM',
    });
  }

  // ================= 5. BOLLINGER BANDS SQUEEZE & VOLATILITY BREAKOUT =================
  {
    let action: SignalAction = 'WAIT';
    let score = 50;
    const triggers: string[] = [];

    const bandwidth = lastBb ? (lastBb.upper - lastBb.lower) / lastBb.middle : 0.05;
    const isSqueeze = bandwidth < 0.04;

    if (isSqueeze) {
      action = currentPrice > (lastBb ? lastBb.middle : currentPrice) ? 'BUY' : 'SELL';
      score = 79;
      triggers.push(`Dải Bollinger Bands nén chặt (Bandwidth: ${(bandwidth * 100).toFixed(2)}% - Tích lũy cao độ)`);
      triggers.push('Chuẩn bị bùng nổ biến động theo hướng phá vỡ dải ngoài');
    } else if (lastBb && currentPrice > lastBb.upper) {
      action = 'BUY';
      score = 76;
      triggers.push('Giá phá vỡ dải trên Bollinger Bands - Động lượng bứt phá mạnh');
    } else if (lastBb && currentPrice < lastBb.lower) {
      action = 'SELL';
      score = 74;
      triggers.push('Giá rơi thủng dải dưới Bollinger Bands - Áp lực bán tháo lan rộng');
    } else {
      action = 'WAIT';
      score = 54;
      triggers.push('Giá dao động ổn định bên trong dải Bollinger');
    }

    const sl = action.includes('BUY') ? (lastBb ? lastBb.lower : currentPrice - currentAtr * 1.5) : (lastBb ? lastBb.upper : currentPrice + currentAtr * 1.5);
    const risk = Math.abs(currentPrice - sl);
    const tp1 = action.includes('BUY') ? currentPrice + risk * 1.5 : currentPrice - risk * 1.5;
    const tp2 = action.includes('BUY') ? currentPrice + risk * 2.8 : currentPrice - risk * 2.8;
    const tp3 = action.includes('BUY') ? currentPrice + risk * 4.2 : currentPrice - risk * 4.2;

    strategies.push({
      id: 'bb_squeeze',
      name: 'Bollinger Band Squeeze & Bùng Nổ Biến Động',
      category: 'Bứt Phá Biến Động (Breakout)',
      description: 'Bắt trọn con sóng lớn khi dải Bollinger nén hẹp sau đó bung mở biên độ (Volatility Expansion).',
      action,
      score,
      entryZone: [currentPrice * 0.995, currentPrice * 1.005],
      stopLoss: parseFloat(sl.toFixed(2)),
      takeProfit1: parseFloat(tp1.toFixed(2)),
      takeProfit2: parseFloat(tp2.toFixed(2)),
      takeProfit3: parseFloat(tp3.toFixed(2)),
      riskRewardRatio: parseFloat((risk > 0 ? (Math.abs(tp2 - currentPrice) / risk) : 2.8).toFixed(2)),
      winProbability: 63,
      triggers,
      riskLevel: 'HIGH',
    });
  }

  // ================= 6. MACD ZERO-LAG MOMENTUM EXPANSION =================
  {
    let action: SignalAction = 'WAIT';
    let score = 50;
    const triggers: string[] = [];

    if (lastMacd) {
      const isMacdBull = lastMacd.macd > lastMacd.signal && lastMacd.histogram > 0;
      const isHistogramGrowing = lastMacd.histogram > 0;

      if (isMacdBull && isHistogramGrowing) {
        action = lastMacd.macd > 0 ? 'STRONG_BUY' : 'BUY';
        score = lastMacd.macd > 0 ? 87 : 78;
        triggers.push('Đường MACD cắt lên trên Signal Line (Tín hiệu Mua)');
        triggers.push('Histogram MACD dương và gia tăng chiều cao');
        if (lastMacd.macd > 0) triggers.push('MACD giao dịch phía trên mức Zero Line');
      } else if (!isMacdBull && !isHistogramGrowing) {
        action = lastMacd.macd < 0 ? 'STRONG_SELL' : 'SELL';
        score = lastMacd.macd < 0 ? 85 : 76;
        triggers.push('Đường MACD cắt xuống dưới Signal Line (Tín hiệu Bán)');
        triggers.push('Histogram MACD suy yếu âm');
      } else {
        action = 'WAIT';
        score = 52;
        triggers.push('Động lượng MACD đang giằng co, chờ phân kỳ rõ rệt');
      }
    }

    const sl = action.includes('BUY') ? currentPrice - currentAtr * 1.6 : currentPrice + currentAtr * 1.6;
    const risk = Math.abs(currentPrice - sl);
    const tp1 = action.includes('BUY') ? currentPrice + risk * 1.5 : currentPrice - risk * 1.5;
    const tp2 = action.includes('BUY') ? currentPrice + risk * 2.6 : currentPrice - risk * 2.6;
    const tp3 = action.includes('BUY') ? currentPrice + risk * 3.8 : currentPrice - risk * 3.8;

    strategies.push({
      id: 'macd_momentum',
      name: 'MACD Momentum & Động Lượng Mở Rộng',
      category: 'Động Lượng & Xung Lực',
      description: 'Đo lường gia tốc giá thông qua Histogram và sự hội tụ/phân kỳ của đường trung bình động MACD.',
      action,
      score,
      entryZone: [currentPrice * 0.995, currentPrice * 1.005],
      stopLoss: parseFloat(sl.toFixed(2)),
      takeProfit1: parseFloat(tp1.toFixed(2)),
      takeProfit2: parseFloat(tp2.toFixed(2)),
      takeProfit3: parseFloat(tp3.toFixed(2)),
      riskRewardRatio: parseFloat((risk > 0 ? (Math.abs(tp2 - currentPrice) / risk) : 2.6).toFixed(2)),
      winProbability: 65,
      triggers,
      riskLevel: 'LOW',
    });
  }

  // ================= 7. SUPPORT / RESISTANCE BREAKOUT & RETEST =================
  {
    const nearestSupport = srLevels.filter(s => s.type === 'support' && s.price < currentPrice).sort((a, b) => b.price - a.price)[0];
    const nearestResistance = srLevels.filter(s => s.type === 'resistance' && s.price > currentPrice).sort((a, b) => a.price - b.price)[0];

    let action: SignalAction = 'WAIT';
    let score = 50;
    const triggers: string[] = [];

    if (nearestSupport && (currentPrice - nearestSupport.price) / currentPrice < 0.015) {
      action = 'BUY';
      score = 80;
      triggers.push(`Giá test thành công vùng Hỗ Trợ cứng ($${nearestSupport.price.toFixed(2)} - ${nearestSupport.strength}★)`);
    } else if (nearestResistance && (nearestResistance.price - currentPrice) / currentPrice < 0.015) {
      action = 'SELL';
      score = 79;
      triggers.push(`Giá chạm vùng Kháng Cự mạnh ($${nearestResistance.price.toFixed(2)} - ${nearestResistance.strength}★)`);
    } else {
      action = currentPrice > lastEma50 ? 'BUY' : 'WAIT';
      score = 60;
      triggers.push(`Khung giá đang tích lũy giữa Hỗ trợ ($${nearestSupport?.price.toFixed(2) || '---'}) và Kháng cự ($${nearestResistance?.price.toFixed(2) || '---'})`);
    }

    const sl = action.includes('BUY')
      ? (nearestSupport ? nearestSupport.price * 0.985 : currentPrice - currentAtr * 1.5)
      : (nearestResistance ? nearestResistance.price * 1.015 : currentPrice + currentAtr * 1.5);
    const risk = Math.abs(currentPrice - sl);
    const tp1 = action.includes('BUY')
      ? (nearestResistance ? nearestResistance.price : currentPrice + risk * 1.8)
      : (nearestSupport ? nearestSupport.price : currentPrice - risk * 1.8);
    const tp2 = action.includes('BUY') ? currentPrice + risk * 2.8 : currentPrice - risk * 2.8;
    const tp3 = action.includes('BUY') ? currentPrice + risk * 4.0 : currentPrice - risk * 4.0;

    strategies.push({
      id: 'sr_breakout',
      name: 'Phá Vỡ & Kiểm Tra Lại Hỗ Trợ/Kháng Cự',
      category: 'Cấu Trúc Giá Cổ Điển',
      description: 'Giao dịch theo các ngưỡng cản then chốt được tạo bởi các đỉnh/đáy lịch sử có nhiều lần chạm bật.',
      action,
      score,
      entryZone: [currentPrice * 0.995, currentPrice * 1.005],
      stopLoss: parseFloat(sl.toFixed(2)),
      takeProfit1: parseFloat(tp1.toFixed(2)),
      takeProfit2: parseFloat(tp2.toFixed(2)),
      takeProfit3: parseFloat(tp3.toFixed(2)),
      riskRewardRatio: parseFloat((risk > 0 ? (Math.abs(tp2 - currentPrice) / risk) : 2.8).toFixed(2)),
      winProbability: 67,
      triggers,
      riskLevel: 'LOW',
    });
  }

  // Find Optimal Strategy (Highest Score with Clear Action)
  let bestStrategy = strategies.slice().sort((a, b) => b.score - a.score)[0];
  if (bestStrategy) {
    bestStrategy.isOptimal = true;
  }

  // Compute Overall Market Consensus
  const buyCount = strategies.filter(s => s.action.includes('BUY')).length;
  const sellCount = strategies.filter(s => s.action.includes('SELL')).length;
  const neutralCount = strategies.length - buyCount - sellCount;

  let overallConsensus: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH' = 'NEUTRAL';
  if (buyCount >= 5) overallConsensus = 'STRONG_BULLISH';
  else if (buyCount >= 3) overallConsensus = 'BULLISH';
  else if (sellCount >= 5) overallConsensus = 'STRONG_BEARISH';
  else if (sellCount >= 3) overallConsensus = 'BEARISH';

  return {
    symbol,
    timeframe,
    currentPrice,
    overallConsensus,
    confluenceCount: { buy: buyCount, sell: sellCount, neutral: neutralCount },
    bestStrategy: bestStrategy || strategies[0],
    strategies,
  };
}

// Backward Compatibility wrapper
export function generateTradeSetup(
  symbol: string,
  candles: Candle[],
  timeframe: Timeframe = '1h'
): TradeSetup {
  const hub = generateStrategyHub(symbol, candles, timeframe);
  const best = hub.bestStrategy;

  return {
    action: best.action,
    symbol,
    timeframe,
    entryZone: best.entryZone,
    currentPrice: hub.currentPrice,
    stopLoss: best.stopLoss,
    takeProfit1: best.takeProfit1,
    takeProfit2: best.takeProfit2,
    takeProfit3: best.takeProfit3,
    riskRewardRatio: best.riskRewardRatio,
    winProbability: best.winProbability,
    strategyName: best.name,
    strategyReason: best.triggers.join('. '),
    riskLevel: best.riskLevel,
    timestamp: Date.now(),
  };
}

// Position Sizer & Risk Management Calculator
export function calculatePositionSize(
  capital: number,
  riskPercent: number,
  entryPrice: number,
  stopLossPrice: number,
  leverage: number = 1
) {
  const riskDollar = capital * (riskPercent / 100);
  const distancePerCoin = Math.abs(entryPrice - stopLossPrice);

  if (distancePerCoin <= 0) {
    return {
      positionSizeCoins: 0,
      positionSizeUSD: 0,
      marginRequired: 0,
      maxLossUSD: riskDollar,
      riskRewardRatio: 2.0,
    };
  }

  const positionSizeCoins = riskDollar / distancePerCoin;
  const positionSizeUSD = positionSizeCoins * entryPrice;
  const marginRequired = positionSizeUSD / Math.max(1, leverage);

  return {
    positionSizeCoins: parseFloat(positionSizeCoins.toFixed(4)),
    positionSizeUSD: parseFloat(positionSizeUSD.toFixed(2)),
    marginRequired: parseFloat(marginRequired.toFixed(2)),
    maxLossUSD: parseFloat(riskDollar.toFixed(2)),
    riskRewardRatio: 2.5,
  };
}
