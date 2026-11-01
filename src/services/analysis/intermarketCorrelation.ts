import { Candle, MarketSymbol } from '../../types';

export interface IntermarketSeriesInput {
  symbol: string;
  label: string;
  candles: Candle[];
}

export interface IntermarketDivergenceAlert {
  id: string;
  pairLabel: string;
  symbolA: string;
  symbolB: string;
  correlation30Bar: number;
  recent5BarReturnA: number;
  recent5BarReturnB: number;
  summary: string;
  actionableHint: string;
}

export interface IntermarketCorrelationMatrix {
  symbols: string[];
  labels: Record<string, string>;
  matrix: Record<string, Record<string, number | null>>;
  sampleSize: number;
  divergences: IntermarketDivergenceAlert[];
}

export type SectorRotationPhase = 'LEADING' | 'IMPROVING' | 'WEAKENING' | 'LAGGING';

export interface SectorStrengthItem {
  sectorId: string;
  sectorName: string;
  marketGroup: 'VN' | 'GLOBAL';
  memberCount: number;
  advancers: number;
  decliners: number;
  breadthPct: number;
  avgChange24h: number;
  volumeWeightedChange24h: number;
  relativeStrengthScore: number; // -100 .. +100
  phase: SectorRotationPhase;
  phaseLabel: string;
  topLeader: MarketSymbol | null;
  laggard: MarketSymbol | null;
  members: MarketSymbol[];
}

/**
 * Computes exact Pearson correlation r in [-1, 1] on aligned log-returns of two close series.
 * Returns null if fewer than minOverlap valid return pairs exist.
 */
export function calculatePearsonCorrelation(
  closesA: number[],
  closesB: number[],
  lookbackBars: number = 30,
  minOverlap: number = 10
): number | null {
  const len = Math.min(closesA.length, closesB.length);
  if (len < minOverlap + 1) return null;

  const sliceLen = Math.min(len, lookbackBars + 1);
  const a = closesA.slice(closesA.length - sliceLen);
  const b = closesB.slice(closesB.length - sliceLen);

  const retA: number[] = [];
  const retB: number[] = [];

  for (let i = 1; i < sliceLen; i++) {
    if (a[i - 1] > 0 && a[i] > 0 && b[i - 1] > 0 && b[i] > 0) {
      retA.push(Math.log(a[i] / a[i - 1]));
      retB.push(Math.log(b[i] / b[i - 1]));
    }
  }

  const n = retA.length;
  if (n < minOverlap) return null;

  const meanA = retA.reduce((s, v) => s + v, 0) / n;
  const meanB = retB.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < n; i++) {
    const da = retA[i] - meanA;
    const db = retB[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom <= 1e-12) return 0;

  const r = Math.max(-1, Math.min(1, cov / denom));
  return parseFloat(r.toFixed(2));
}

function calcRecentPctChange(candles: Candle[], barsBack: number = 5): number | null {
  if (!candles || candles.length < barsBack + 1) return null;
  const last = candles[candles.length - 1]?.close;
  const prev = candles[candles.length - 1 - barsBack]?.close;
  if (!(last > 0) || !(prev > 0)) return null;
  return parseFloat((((last - prev) / prev) * 100).toFixed(2));
}

export function buildIntermarketCorrelationMatrix(
  seriesList: IntermarketSeriesInput[],
  lookbackBars: number = 30
): IntermarketCorrelationMatrix {
  const validSeries = seriesList.filter(s => Array.isArray(s.candles) && s.candles.length >= 12);
  const symbols = validSeries.map(s => s.symbol);
  const labels: Record<string, string> = {};
  const matrix: Record<string, Record<string, number | null>> = {};

  for (const s of validSeries) {
    labels[s.symbol] = s.label;
    matrix[s.symbol] = {};
  }

  const divergences: IntermarketDivergenceAlert[] = [];

  for (let i = 0; i < validSeries.length; i++) {
    const sa = validSeries[i];
    const closesA = sa.candles.map(c => c.close);

    for (let j = 0; j < validSeries.length; j++) {
      const sb = validSeries[j];
      if (i === j) {
        matrix[sa.symbol][sb.symbol] = 1;
        continue;
      }
      const closesB = sb.candles.map(c => c.close);
      const r = calculatePearsonCorrelation(closesA, closesB, lookbackBars);
      matrix[sa.symbol][sb.symbol] = r;

      // Detect meaningful intermarket divergence only once per pair (i < j)
      if (i < j && r !== null) {
        const ret5A = calcRecentPctChange(sa.candles, 5);
        const ret5B = calcRecentPctChange(sb.candles, 5);
        if (ret5A !== null && ret5B !== null) {
          // Case 1: Strong positive historical correlation (r >= 0.55) but 5-bar moves strongly opposite
          if (r >= 0.55 && ret5A * ret5B < 0 && Math.abs(ret5A - ret5B) >= 2.2) {
            const leader = ret5A > ret5B ? sa : sb;
            const laggard = ret5A > ret5B ? sb : sa;
            divergences.push({
              id: `div_pos_${sa.symbol}_${sb.symbol}`,
              pairLabel: `${sa.symbol} vs ${sb.symbol}`,
              symbolA: sa.symbol,
              symbolB: sb.symbol,
              correlation30Bar: r,
              recent5BarReturnA: ret5A,
              recent5BarReturnB: ret5B,
              summary: `${sa.symbol} (${ret5A >= 0 ? '+' : ''}${ret5A}%) và ${sb.symbol} (${ret5B >= 0 ? '+' : ''}${ret5B}%) đang phân kỳ ngắn hạn dù tương quan 30 phiên thuận chiều chặt (r = +${r}).`,
              actionableHint: `Theo dõi khả năng ${laggard.symbol} bắt nhịp bù theo ${leader.symbol} hoặc cảnh giác bẫy breakout giả trên ${leader.symbol}.`,
            });
          }
          // Case 2: Strong inverse correlation (r <= -0.50) but both moving sharply in the same direction
          else if (r <= -0.5 && ret5A * ret5B > 0 && Math.abs(ret5A) >= 1.2 && Math.abs(ret5B) >= 1.2) {
            divergences.push({
              id: `div_inv_${sa.symbol}_${sb.symbol}`,
              pairLabel: `${sa.symbol} vs ${sb.symbol}`,
              symbolA: sa.symbol,
              symbolB: sb.symbol,
              correlation30Bar: r,
              recent5BarReturnA: ret5A,
              recent5BarReturnB: ret5B,
              summary: `${sa.symbol} (${ret5A >= 0 ? '+' : ''}${ret5A}%) và ${sb.symbol} (${ret5B >= 0 ? '+' : ''}${ret5B}%) cùng biến động một chiều bất chấp tương quan nghịch (r = ${r}).`,
              actionableHint: `Dấu hiệu dòng tiền phòng thủ / định giá lại vĩ mô bất thường — kiểm tra thêm lợi suất thực và DXY trước khi tăng đòn bẩy.`,
            });
          }
        }
      }
    }
  }

  return {
    symbols,
    labels,
    matrix,
    sampleSize: lookbackBars,
    divergences,
  };
}

interface SectorDefinition {
  id: string;
  name: string;
  marketGroup: 'VN' | 'GLOBAL';
  matcher: (s: MarketSymbol) => boolean;
}

const VN_BANK_TICKERS = new Set([
  'VCB', 'BID', 'CTG', 'TCB', 'MBB', 'VPB', 'ACB', 'STB', 'HDB', 'SHB', 'TPB', 'VIB', 'SSB', 'LPB', 'OCB', 'MSB', 'EIB',
]);
const VN_SECURITIES_TICKERS = new Set(['SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'CTS', 'VIX']);
const VN_REALESTATE_TICKERS = new Set(['VIC', 'VHM', 'VRE', 'NVL', 'PDR', 'DIG', 'DXG', 'KDH', 'NLG', 'KBC', 'IDC', 'BCM']);
const VN_STEEL_INDUSTRIAL_TICKERS = new Set(['HPG', 'HSG', 'NKG', 'GVR', 'DGC', 'BMP', 'PC1', 'REE', 'GMD']);
const VN_TECH_RETAIL_TICKERS = new Set(['FPT', 'MWG', 'MSN', 'VNM', 'SAB', 'PNJ', 'FRT', 'DGW', 'CMG', 'VJC', 'HVN']);
const VN_ENERGY_OIL_TICKERS = new Set(['GAS', 'PLX', 'PVD', 'PVS', 'BSR', 'OIL', 'POW']);

const SECTOR_DEFINITIONS: SectorDefinition[] = [
  {
    id: 'VN_BANKS',
    name: '🇻🇳 Ngân Hàng (VN30 / HOSE)',
    marketGroup: 'VN',
    matcher: s => VN_BANK_TICKERS.has(s.symbol.toUpperCase()),
  },
  {
    id: 'VN_SECURITIES',
    name: '🇻🇳 Chứng Khoán & Tài Chính VN',
    marketGroup: 'VN',
    matcher: s => VN_SECURITIES_TICKERS.has(s.symbol.toUpperCase()),
  },
  {
    id: 'VN_REAL_ESTATE',
    name: '🇻🇳 Bất Động Sản & Khu Công Nghiệp',
    marketGroup: 'VN',
    matcher: s => VN_REALESTATE_TICKERS.has(s.symbol.toUpperCase()),
  },
  {
    id: 'VN_TECH_CONSUMER',
    name: '🇻🇳 Công Nghệ, Bán Lẻ & Tiêu Dùng',
    marketGroup: 'VN',
    matcher: s => VN_TECH_RETAIL_TICKERS.has(s.symbol.toUpperCase()),
  },
  {
    id: 'VN_STEEL_MATERIALS',
    name: '🇻🇳 Thép, Hóa Chất & Sản Xuất',
    marketGroup: 'VN',
    matcher: s => VN_STEEL_INDUSTRIAL_TICKERS.has(s.symbol.toUpperCase()),
  },
  {
    id: 'VN_OIL_ENERGY',
    name: '🇻🇳 Dầu Khí & Điện Năng Lượng VN',
    marketGroup: 'VN',
    matcher: s => VN_ENERGY_OIL_TICKERS.has(s.symbol.toUpperCase()),
  },
  {
    id: 'GLOBAL_PRECIOUS_METALS',
    name: '🥇 Vàng & Kim Loại Quý Thế Giới',
    marketGroup: 'GLOBAL',
    matcher: s => ['XAUUSD', 'PAXGUSDT', 'SILVER'].includes(s.symbol.toUpperCase()),
  },
  {
    id: 'GLOBAL_CRUDE_ENERGY',
    name: '🛢️ Dầu Thô Quốc Tế (WTI / Brent)',
    marketGroup: 'GLOBAL',
    matcher: s => ['OIL_WTI', 'OIL_BRENT'].includes(s.symbol.toUpperCase()),
  },
  {
    id: 'GLOBAL_CRYPTO_MAJORS',
    name: '🪙 Crypto Layer-1 & Vốn Hóa Lớn',
    marketGroup: 'GLOBAL',
    matcher: s => s.type === 'crypto' && s.symbol.toUpperCase() !== 'PAXGUSDT',
  },
  {
    id: 'US_TECH_EQUITIES',
    name: '🇺🇸 Cổ Phiếu Công Nghệ Mỹ (NYSE/Nasdaq)',
    marketGroup: 'GLOBAL',
    matcher: s => s.type === 'stock' && s.quoteAsset === 'USD',
  },
];

export function computeSectorRotation(symbols: MarketSymbol[]): SectorStrengthItem[] {
  const vnIndex = symbols.find(s => s.symbol.toUpperCase() === 'VNINDEX');
  const vnBenchmarkChg = vnIndex?.change24h ?? 0;

  const globalPeers = symbols.filter(s => s.quoteAsset !== 'VND');
  const globalBenchmarkChg =
    globalPeers.length > 0
      ? globalPeers.reduce((acc, s) => acc + s.change24h, 0) / globalPeers.length
      : 0;

  const items: SectorStrengthItem[] = [];

  for (const def of SECTOR_DEFINITIONS) {
    const members = symbols.filter(def.matcher);
    if (members.length === 0) continue;

    let advancers = 0;
    let decliners = 0;
    let sumChg = 0;
    let weightedChgSum = 0;
    let totalVol = 0;

    for (const m of members) {
      if (m.change24h > 0.02) advancers++;
      else if (m.change24h < -0.02) decliners++;
      sumChg += m.change24h;
      const volWeight = Math.max(1, m.volume24h || 1);
      weightedChgSum += m.change24h * volWeight;
      totalVol += volWeight;
    }

    const avgChange24h = parseFloat((sumChg / members.length).toFixed(2));
    const volumeWeightedChange24h = parseFloat((weightedChgSum / totalVol).toFixed(2));
    const breadthPct = Math.round((advancers / members.length) * 100);

    const bench = def.marketGroup === 'VN' ? vnBenchmarkChg : globalBenchmarkChg;
    const excessReturn = volumeWeightedChange24h - bench;
    const rawRs = excessReturn * 22 + (breadthPct - 50) * 0.65;
    const relativeStrengthScore = Math.max(-100, Math.min(100, Math.round(rawRs)));

    let phase: SectorRotationPhase = 'IMPROVING';
    let phaseLabel = 'Tích Lũy Cải Thiện';
    if (relativeStrengthScore >= 18 && breadthPct >= 55) {
      phase = 'LEADING';
      phaseLabel = 'Dẫn Dắt Dòng Tiền';
    } else if (relativeStrengthScore >= 0) {
      phase = 'IMPROVING';
      phaseLabel = 'Hút Tiền Ngắn Hạn';
    } else if (relativeStrengthScore >= -20) {
      phase = 'WEAKENING';
      phaseLabel = 'Chững Lại / Phân Hóa';
    } else {
      phase = 'LAGGING';
      phaseLabel = 'Suy Yếu / Rút Dòng';
    }

    const sorted = [...members].sort((a, b) => b.change24h - a.change24h);

    items.push({
      sectorId: def.id,
      sectorName: def.name,
      marketGroup: def.marketGroup,
      memberCount: members.length,
      advancers,
      decliners,
      breadthPct,
      avgChange24h,
      volumeWeightedChange24h,
      relativeStrengthScore,
      phase,
      phaseLabel,
      topLeader: sorted[0] || null,
      laggard: sorted[sorted.length - 1] || null,
      members: sorted,
    });
  }

  return items.sort((a, b) => b.relativeStrengthScore - a.relativeStrengthScore);
}
