import { Candle, MarketSymbol } from '../../types';
import { calculateRSI } from '../indicators';
import { calculateSupportResistance } from '../analysis/supportResistance';

export interface AccumulationAnalysis {
  symbol: string;
  name: string;
  type: string;
  currentPrice: number;
  score: number; // 0 - 100
  status: 'HOT_BUY' | 'GOOD_DCA' | 'NEUTRAL' | 'WAIT';
  statusLabel: string;
  discountPercent: number;
  entryZone: [number, number];
  targetTakeProfit: number;
  riskReward: number;
  reasons: string[];
  isHot: boolean;
}

/**
 * Analyze if a symbol is in prime accumulation / value buying zone
 */
export function analyzeAccumulationZone(
  symbolObj: MarketSymbol,
  candles?: Candle[]
): AccumulationAnalysis {
  const currentPrice = symbolObj.price;
  const high24h = symbolObj.high24h || currentPrice * 1.02;
  const low24h = symbolObj.low24h || currentPrice * 0.98;
  const change24h = symbolObj.change24h || 0;

  let score = 50;
  const reasons: string[] = [];
  let rsiValue = 50;
  let supportPrice = low24h;

  // 1. If we have full candles data, compute deep technical metrics
  if (candles && candles.length >= 20) {
    const rsiList = calculateRSI(candles, 14);
    if (rsiList.length > 0) {
      rsiValue = rsiList[rsiList.length - 1].value;
    }

    const srList = calculateSupportResistance(candles);
    const nearestSupport = srList
      .filter(s => s.type === 'support')
      .sort((a, b) => b.price - a.price)[0];

    if (nearestSupport) {
      supportPrice = nearestSupport.price;
    }

    // Candle high over last 30 bars
    const recentHigh = Math.max(...candles.slice(-30).map(c => c.high));
    const discountFromRecentHigh = ((recentHigh - currentPrice) / recentHigh) * 100;

    // Scoring based on RSI
    if (rsiValue < 30) {
      score += 25;
      reasons.push(`RSI Quá Bán sâu (${rsiValue.toFixed(1)} < 30) - Lực bán cạn kiệt`);
    } else if (rsiValue < 40) {
      score += 18;
      reasons.push(`RSI ở vùng chiết khấu tích lũy (${rsiValue.toFixed(1)})`);
    } else if (rsiValue < 50) {
      score += 8;
      reasons.push(`RSI dưới 50 - Vùng giá cân bằng hấp dẫn`);
    } else if (rsiValue > 70) {
      score -= 20;
      reasons.push(`RSI Quá Mua (${rsiValue.toFixed(1)}) - Cần chờ nhịp điều chỉnh`);
    }

    // Scoring based on Support Distance
    if (supportPrice > 0) {
      const distToSupport = Math.abs(currentPrice - supportPrice) / currentPrice;
      if (distToSupport < 0.02) {
        score += 20;
        reasons.push(`Giá đang chạm sát Hỗ Trợ cứng (${supportPrice.toFixed(2)})`);
      } else if (currentPrice < supportPrice) {
        score += 15;
        reasons.push(`Giá rũ bỏ dưới hỗ trợ - Vùng quét thanh khoản gom đáy`);
      }
    }

    // Scoring based on Discount
    if (discountFromRecentHigh > 10) {
      score += 15;
      reasons.push(`Chiết khấu -${discountFromRecentHigh.toFixed(1)}% từ đỉnh gần nhất`);
    }
  } else {
    // 2. Fallback heuristic using 24h market stats
    const range = high24h - low24h;
    const positionInRange = range > 0 ? (currentPrice - low24h) / range : 0.5;

    // Price near 24h low
    if (positionInRange < 0.25) {
      score += 22;
      reasons.push(`Giá giao dịch sát mức đáy 24h (Vùng đệm an toàn)`);
    }

    // Negative 24h change on solid assets
    if (change24h <= -2.0) {
      score += 18;
      reasons.push(`Nhịp điều chỉnh trong phiên (${change24h.toFixed(2)}%) tạo điểm mua rẻ`);
    } else if (change24h < 0) {
      score += 10;
      reasons.push(`Giá đang giảm nhẹ (${change24h.toFixed(2)}%), tích lũy chân sóng`);
    }
  }

  // 3. Category quality bonus (VN30, Bluechips, Gold, Top Crypto)
  if (symbolObj.type === 'vn30' || symbolObj.symbol === 'VNINDEX') {
    score += 10;
    reasons.push(`Thuộc rổ VN30 Bluechip - Nền tảng cơ bản vững mạnh`);
  } else if (symbolObj.symbol.includes('XAU') || symbolObj.symbol.includes('GOLD') || symbolObj.symbol.includes('BTC') || symbolObj.symbol.includes('ETH')) {
    score += 10;
    reasons.push(`Tài sản phòng hộ / Top đầu thị trường - Thích hợp tích sản dài hạn`);
  }

  // Cap score between 10 and 98
  score = Math.min(98, Math.max(10, score));

  // Determine Status & Badges
  let status: AccumulationAnalysis['status'] = 'WAIT';
  let statusLabel = 'Chờ Tích Lũy';

  if (score >= 78) {
    status = 'HOT_BUY';
    statusLabel = '🔥 VÙNG GOM SIÊU ĐẸP';
  } else if (score >= 64) {
    status = 'GOOD_DCA';
    statusLabel = '💎 VÙNG TÍCH LŨY TỐT';
  } else if (score >= 48) {
    status = 'NEUTRAL';
    statusLabel = 'Theo Dõi';
  } else {
    status = 'WAIT';
    statusLabel = 'Giá Cao / Chờ';
  }

  // Calculate Entry & TP targets
  const entryLow = supportPrice > 0 && supportPrice < currentPrice ? supportPrice : currentPrice * 0.97;
  const entryHigh = currentPrice * 1.008;
  const tpTarget = currentPrice * (score >= 78 ? 1.25 : 1.15);
  const discountPct = high24h > 0 ? ((high24h - currentPrice) / high24h) * 100 : Math.abs(change24h);

  return {
    symbol: symbolObj.symbol,
    name: symbolObj.name,
    type: symbolObj.type,
    currentPrice,
    score,
    status,
    statusLabel,
    discountPercent: parseFloat(discountPct.toFixed(1)),
    entryZone: [parseFloat(entryLow.toFixed(2)), parseFloat(entryHigh.toFixed(2))],
    targetTakeProfit: parseFloat(tpTarget.toFixed(2)),
    riskReward: parseFloat((score >= 78 ? 3.5 : 2.5).toFixed(1)),
    reasons: reasons.slice(0, 3),
    isHot: score >= 78,
  };
}

/**
 * Scan all symbols in user's watchlist/catalog and rank them by Accumulation Score
 */
export function scanMarketAccumulation(symbols: MarketSymbol[]): AccumulationAnalysis[] {
  return symbols
    .map(s => analyzeAccumulationZone(s))
    .sort((a, b) => b.score - a.score);
}
