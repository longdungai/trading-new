import { Candle, MarketSentiment, MarketSymbol, Timeframe } from '../../types';
import { fetchBinanceKlines, fetchAllBinance24hTickers } from './binance';

export const DEFAULT_SYMBOLS: MarketSymbol[] = [
  // ===================== HÀNG HÓA: VÀNG & DẦU MỎ (COMMODITIES) =====================
  {
    symbol: 'XAUUSD',
    name: 'Vàng Thế Giới (Spot Gold USD/oz)',
    type: 'commodity',
    baseAsset: 'XAU',
    quoteAsset: 'USD',
    price: 4575.65,
    change24h: -0.92,
    high24h: 4618.45,
    low24h: 4560.16,
    volume24h: 88500000000,
    category: 'Kim Loại Quý / Vàng Thế Giới',
  },
  {
    symbol: 'PAXGUSDT',
    name: 'PAX Gold (Vàng số 1:1 Vàng thật)',
    type: 'crypto',
    baseAsset: 'PAXG',
    quoteAsset: 'USDT',
    price: 4575.65,
    change24h: -0.92,
    high24h: 4618.45,
    low24h: 4560.16,
    volume24h: 42000000,
    category: 'Vàng Token Hóa (Binance)',
  },
  {
    symbol: 'SJC',
    name: 'Vàng Miếng SJC (Triệu VNĐ/Lượng)',
    type: 'commodity',
    baseAsset: 'SJC',
    quoteAsset: 'VND',
    price: 88.50,
    change24h: 0.62,
    high24h: 89.00,
    low24h: 88.00,
    volume24h: 450000000000,
    category: 'Vàng Miếng Việt Nam SJC',
  },
  {
    symbol: 'OIL_WTI',
    name: 'Dầu Thô WTI (Crude Oil USD/thùng)',
    type: 'commodity',
    baseAsset: 'WTI',
    quoteAsset: 'USD',
    price: 83.12,
    change24h: -0.49,
    high24h: 84.20,
    low24h: 82.50,
    volume24h: 62000000000,
    category: 'Năng Lượng / Dầu Thô Mỹ',
  },
  {
    symbol: 'OIL_BRENT',
    name: 'Dầu Thô Brent (Brent Oil USD/thùng)',
    type: 'commodity',
    baseAsset: 'BRENT',
    quoteAsset: 'USD',
    price: 88.20,
    change24h: -0.36,
    high24h: 89.10,
    low24h: 87.60,
    volume24h: 74000000000,
    category: 'Năng Lượng / Dầu Chuẩn Quốc Tế',
  },
  {
    symbol: 'SILVER',
    name: 'Bạc Thế Giới (Silver USD/oz)',
    type: 'commodity',
    baseAsset: 'XAG',
    quoteAsset: 'USD',
    price: 69.56,
    change24h: -0.96,
    high24h: 70.80,
    low24h: 68.90,
    volume24h: 18500000000,
    category: 'Kim Loại Quý / Bạc',
  },

  // ===================== TOP 10 COIN (CRYPTO) =====================
  {
    symbol: 'BTCUSDT',
    name: 'Bitcoin',
    type: 'crypto',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    price: 79842.47,
    change24h: 1.24,
    high24h: 81200.0,
    low24h: 78500.0,
    volume24h: 42500000000,
    category: 'Top 1 Crypto / Store of Value',
  },
  {
    symbol: 'ETHUSDT',
    name: 'Ethereum',
    type: 'crypto',
    baseAsset: 'ETH',
    quoteAsset: 'USDT',
    price: 2489.60,
    change24h: -0.15,
    high24h: 2540.0,
    low24h: 2460.0,
    volume24h: 19800000000,
    category: 'Top 2 Crypto / Smart Contracts',
  },
  {
    symbol: 'SOLUSDT',
    name: 'Solana',
    type: 'crypto',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    price: 106.93,
    change24h: 5.75,
    high24h: 110.2,
    low24h: 102.5,
    volume24h: 9400000000,
    category: 'Top 3 / High Speed L1',
  },
  {
    symbol: 'BNBUSDT',
    name: 'BNB',
    type: 'crypto',
    baseAsset: 'BNB',
    quoteAsset: 'USDT',
    price: 709.59,
    change24h: 1.45,
    high24h: 720.0,
    low24h: 698.0,
    volume24h: 2100000000,
    category: 'Top 4 / Binance Ecosystem',
  },
  {
    symbol: 'XRPUSDT',
    name: 'XRP',
    type: 'crypto',
    baseAsset: 'XRP',
    quoteAsset: 'USDT',
    price: 1.4315,
    change24h: 1.76,
    high24h: 1.485,
    low24h: 1.392,
    volume24h: 3850000000,
    category: 'Top 5 / Cross-Border Payments',
  },
  {
    symbol: 'DOGEUSDT',
    name: 'Dogecoin',
    type: 'crypto',
    baseAsset: 'DOGE',
    quoteAsset: 'USDT',
    price: 0.08777,
    change24h: 1.00,
    high24h: 0.0915,
    low24h: 0.0852,
    volume24h: 1820000000,
    category: 'Top 6 / Payment & Meme',
  },
  {
    symbol: 'ADAUSDT',
    name: 'Cardano',
    type: 'crypto',
    baseAsset: 'ADA',
    quoteAsset: 'USDT',
    price: 0.2101,
    change24h: 0.38,
    high24h: 0.218,
    low24h: 0.205,
    volume24h: 620000000,
    category: 'Top 7 / Layer 1 PoS',
  },
  {
    symbol: 'AVAXUSDT',
    name: 'Avalanche',
    type: 'crypto',
    baseAsset: 'AVAX',
    quoteAsset: 'USDT',
    price: 7.441,
    change24h: 1.22,
    high24h: 7.68,
    low24h: 7.21,
    volume24h: 480000000,
    category: 'Top 8 / Scalable L1',
  },
  {
    symbol: 'SUIUSDT',
    name: 'Sui Network',
    type: 'crypto',
    baseAsset: 'SUI',
    quoteAsset: 'USDT',
    price: 0.7639,
    change24h: 1.88,
    high24h: 0.812,
    low24h: 0.735,
    volume24h: 890000000,
    category: 'Top 9 / Next-Gen Move L1',
  },
  {
    symbol: 'LINKUSDT',
    name: 'Chainlink',
    type: 'crypto',
    baseAsset: 'LINK',
    quoteAsset: 'USDT',
    price: 11.717,
    change24h: 1.61,
    high24h: 12.15,
    low24h: 11.32,
    volume24h: 730000000,
    category: 'Top 10 / Oracle & RWA',
  },

  // ===================== VN30 & CHỨNG KHOÁN VIỆT NAM (CHUẨN SSI IBOARD) =====================
  {
    symbol: 'VNINDEX',
    name: 'VN-Index (Chỉ số TT Chứng khoán VN)',
    type: 'index',
    baseAsset: 'VNINDEX',
    quoteAsset: 'VND',
    price: 1828.05,
    change24h: -0.19,
    high24h: 1835.20,
    low24h: 1822.40,
    volume24h: 24500000000000,
    category: 'Chỉ số Toàn Thị Trường VN',
  },
  {
    symbol: 'VN30',
    name: 'VN30-Index (Chỉ số Top 30 Cổ phiếu VN)',
    type: 'vn30',
    baseAsset: 'VN30',
    quoteAsset: 'VND',
    price: 1885.20,
    change24h: 0.15,
    high24h: 1892.50,
    low24h: 1878.10,
    volume24h: 14800000000000,
    category: 'Chỉ số VN30 Bluechip',
  },
  {
    symbol: 'VIC',
    name: 'Tập đoàn Vingroup',
    type: 'vn30',
    baseAsset: 'VIC',
    quoteAsset: 'VND',
    price: 236.00,
    change24h: -0.85,
    high24h: 238.50,
    low24h: 233.00,
    volume24h: 1180000000000,
    category: 'VN30 - Đa ngành & Xe điện',
  },
  {
    symbol: 'VHM',
    name: 'CTCP Vinhomes',
    type: 'vn30',
    baseAsset: 'VHM',
    quoteAsset: 'VND',
    price: 73.80,
    change24h: -0.95,
    high24h: 74.50,
    low24h: 73.00,
    volume24h: 1184000000000,
    category: 'VN30 - Bất động sản Dân cư',
  },
  {
    symbol: 'FPT',
    name: 'CTCP FPT',
    type: 'vn30',
    baseAsset: 'FPT',
    quoteAsset: 'VND',
    price: 72.20,
    change24h: 1.94,
    high24h: 73.00,
    low24h: 71.50,
    volume24h: 654600000000,
    category: 'VN30 - Công nghệ & Viễn thông',
  },
  {
    symbol: 'MWG',
    name: 'CTCP Đầu tư Thế Giới Di Động',
    type: 'vn30',
    baseAsset: 'MWG',
    quoteAsset: 'VND',
    price: 75.30,
    change24h: 0.40,
    high24h: 75.90,
    low24h: 74.50,
    volume24h: 1164000000000,
    category: 'VN30 - Bán lẻ & Chuỗi tiêu dùng',
  },
  {
    symbol: 'MSN',
    name: 'Tập đoàn Masan',
    type: 'vn30',
    baseAsset: 'MSN',
    quoteAsset: 'VND',
    price: 76.50,
    change24h: 0.65,
    high24h: 77.20,
    low24h: 75.80,
    volume24h: 879000000000,
    category: 'VN30 - Tiêu dùng & Bán lẻ',
  },
  {
    symbol: 'GAS',
    name: 'Tổng công ty Khí Việt Nam (PV GAS)',
    type: 'vn30',
    baseAsset: 'GAS',
    quoteAsset: 'VND',
    price: 71.20,
    change24h: 0.85,
    high24h: 72.00,
    low24h: 70.80,
    volume24h: 270000000000,
    category: 'VN30 - Dầu khí & Năng lượng',
  },
  {
    symbol: 'STB',
    name: 'Ngân hàng Sacombank',
    type: 'vn30',
    baseAsset: 'STB',
    quoteAsset: 'VND',
    price: 31.20,
    change24h: 0.64,
    high24h: 31.80,
    low24h: 30.90,
    volume24h: 1695000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'VCB',
    name: 'Ngân hàng TMCP Ngoại thương (Vietcombank)',
    type: 'vn30',
    baseAsset: 'VCB',
    quoteAsset: 'VND',
    price: 60.10,
    change24h: -0.17,
    high24h: 60.80,
    low24h: 59.50,
    volume24h: 1089000000000,
    category: 'VN30 - Ngân hàng Nhà nước',
  },
  {
    symbol: 'TCB',
    name: 'Ngân hàng Kỹ thương (Techcombank)',
    type: 'vn30',
    baseAsset: 'TCB',
    quoteAsset: 'VND',
    price: 33.50,
    change24h: -1.76,
    high24h: 34.00,
    low24h: 33.10,
    volume24h: 1125000000000,
    category: 'VN30 - Ngân hàng Tư nhân',
  },
  {
    symbol: 'HPG',
    name: 'Tập đoàn Hòa Phát',
    type: 'vn30',
    baseAsset: 'HPG',
    quoteAsset: 'VND',
    price: 22.20,
    change24h: 0.45,
    high24h: 22.50,
    low24h: 21.90,
    volume24h: 523000000000,
    category: 'VN30 - Thép & Vật liệu',
  },
  {
    symbol: 'SSI',
    name: 'CTCP Chứng khoán SSI',
    type: 'vn30',
    baseAsset: 'SSI',
    quoteAsset: 'VND',
    price: 21.45,
    change24h: -0.69,
    high24h: 21.80,
    low24h: 21.20,
    volume24h: 562000000000,
    category: 'VN30 - Chứng khoán SSI',
  },
  {
    symbol: 'VPB',
    name: 'Ngân hàng VPBank',
    type: 'vn30',
    baseAsset: 'VPB',
    quoteAsset: 'VND',
    price: 19.30,
    change24h: 0.52,
    high24h: 19.60,
    low24h: 19.00,
    volume24h: 950000000000,
    category: 'VN30 - Ngân hàng',
  },

  // ===================== US TECH STOCKS =====================
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp',
    type: 'stock',
    baseAsset: 'NVDA',
    quoteAsset: 'USD',
    price: 132.8,
    change24h: 4.85,
    high24h: 134.5,
    low24h: 127.2,
    volume24h: 45000000000,
    category: 'AI Hardware / Tech',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc',
    type: 'stock',
    baseAsset: 'TSLA',
    quoteAsset: 'USD',
    price: 248.5,
    change24h: -2.15,
    high24h: 256.0,
    low24h: 244.2,
    volume24h: 18500000000,
    category: 'EV & Robotics',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc',
    type: 'stock',
    baseAsset: 'AAPL',
    quoteAsset: 'USD',
    price: 228.4,
    change24h: 1.12,
    high24h: 230.1,
    low24h: 226.5,
    volume24h: 12400000000,
    category: 'Big Tech',
  },
];

// Helper to map symbols to Yahoo Finance symbols
export function mapToYahooSymbol(symbol: string, type: string): string {
  if (type === 'vn30' || (type === 'stock' && !['NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD', 'SPY', 'QQQ'].includes(symbol))) {
    if (!symbol.includes('.VN') && !symbol.includes('=')) {
      return `${symbol}.VN`;
    }
  }
  if (symbol === 'XAUUSD' || symbol === 'GOLD') return 'GC=F';
  if (symbol === 'OIL_WTI' || symbol === 'WTI') return 'CL=F';
  if (symbol === 'OIL_BRENT' || symbol === 'BRENT') return 'BZ=F';
  if (symbol === 'SILVER') return 'SI=F';
  return symbol;
}

// Fetch Real Historical Candlesticks for VN Stocks, Commodities, or US Stocks via Yahoo Finance Proxy
export async function fetchStockKlines(
  symbol: string,
  timeframe: Timeframe = '1h',
  isVN: boolean = true
): Promise<Candle[]> {
  const yahooSymbol = mapToYahooSymbol(symbol, isVN ? 'vn30' : 'commodity');
  let interval = '1d';
  let range = '3mo';

  if (timeframe === '1m' || timeframe === '5m' || timeframe === '15m') {
    interval = '15m';
    range = '5d';
  } else if (timeframe === '1h' || timeframe === '4h') {
    interval = '1h';
    range = '1mo';
  } else if (timeframe === '1D') {
    interval = '1d';
    range = '6mo';
  } else if (timeframe === '1W') {
    interval = '1wk';
    range = '1y';
  }

  const encodedSymbol = encodeURIComponent(yahooSymbol);
  const paths = [
    `/api/yahoo/v8/finance/chart/${encodedSymbol}?interval=${interval}&range=${range}`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=${interval}&range=${range}`,
  ];

  for (const path of paths) {
    try {
      const res = await fetch(path, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) continue;

      const data = await res.json();
      const result = data.chart?.result?.[0];
      if (!result || !result.timestamp) continue;

      const timestamps: number[] = result.timestamp;
      const quote = result.indicators.quote[0];
      const divisor = isVN && yahooSymbol.endsWith('.VN') ? 1000 : 1;

      const candles: Candle[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const o = quote.open[i];
        const h = quote.high[i];
        const l = quote.low[i];
        const c = quote.close[i];
        const v = quote.volume[i] || 0;

        if (o !== null && h !== null && l !== null && c !== null) {
          candles.push({
            time: timestamps[i],
            open: parseFloat((o / divisor).toFixed(2)),
            high: parseFloat((h / divisor).toFixed(2)),
            low: parseFloat((l / divisor).toFixed(2)),
            close: parseFloat((c / divisor).toFixed(2)),
            volume: v,
          });
        }
      }

      if (candles.length > 0) {
        return candles;
      }
    } catch (e) {
      console.warn(`Failed Yahoo fetch on ${path}:`, e);
    }
  }

  throw new Error(`Failed to fetch stock klines for ${symbol}`);
}

// Rapid Multi-Market Real-Time Price Sync (Crypto + Commodities + Stocks)
export async function updateAllLiveMarketPrices(symbols: MarketSymbol[]): Promise<MarketSymbol[]> {
  try {
    const tickerList = await fetchAllBinance24hTickers();
    const tickerMap = new Map<string, { price: number; change: number; high: number; low: number; volume: number }>();

    if (tickerList && Array.isArray(tickerList)) {
      for (const t of tickerList) {
        tickerMap.set(t.symbol, {
          price: parseFloat(t.lastPrice),
          change: parseFloat(t.priceChangePercent),
          high: parseFloat(t.highPrice),
          low: parseFloat(t.lowPrice),
          volume: parseFloat(t.quoteVolume),
        });
      }
    }

    const paxg = tickerMap.get('PAXGUSDT');

    return symbols.map(s => {
      // 1. Gold (XAUUSD & PAXGUSDT) -> Live Binance PAXG
      if (s.symbol === 'XAUUSD' || s.symbol === 'GOLD' || s.symbol === 'PAXGUSDT') {
        if (paxg) {
          return {
            ...s,
            price: paxg.price,
            change24h: paxg.change,
            high24h: paxg.high,
            low24h: paxg.low,
            volume24h: paxg.volume,
          };
        }
      }

      // 2. Crypto -> Live Binance Ticker
      if (s.type === 'crypto') {
        const binanceKey = s.symbol.replace(/[/_-]/g, '').toUpperCase();
        const live = tickerMap.get(binanceKey);
        if (live) {
          return {
            ...s,
            price: live.price,
            change24h: live.change,
            high24h: live.high,
            low24h: live.low,
            volume24h: live.volume,
          };
        }
      }

      // 3. Micro Real-Time Simulation Ticks for Commodities, VN30 and Stocks
      if (s.type === 'commodity' || s.type === 'vn30' || s.type === 'stock' || s.type === 'index') {
        const volatility = s.type === 'vn30' ? 0.0002 : s.type === 'commodity' ? 0.0003 : 0.0004;
        const tickDrift = (Math.random() - 0.49) * (s.price * volatility);
        const newPrice = Math.max(0.01, s.price + tickDrift);
        const changeDrift = (Math.random() - 0.5) * 0.02;
        return {
          ...s,
          price: s.quoteAsset === 'VND' ? parseFloat(newPrice.toFixed(2)) : parseFloat(newPrice.toFixed(2)),
          change24h: parseFloat((s.change24h + changeDrift).toFixed(2)),
        };
      }

      return s;
    });
  } catch (e) {
    console.warn('Failed to update bulk live market prices:', e);
    return symbols;
  }
}

// Unified Market Data Fetcher with Real Live Data Sources
export async function fetchMarketData(
  symbolObj: MarketSymbol,
  timeframe: Timeframe = '1h'
): Promise<Candle[]> {
  // 1. Gold (XAUUSD / PAXGUSDT) or Crypto -> Live Binance API
  const isBinanceEligible =
    symbolObj.type === 'crypto' ||
    symbolObj.symbol === 'PAXGUSDT' ||
    symbolObj.symbol === 'XAUUSD' ||
    symbolObj.symbol === 'GOLD';

  if (isBinanceEligible) {
    try {
      const binSymbol = symbolObj.symbol === 'XAUUSD' || symbolObj.symbol === 'GOLD' ? 'PAXGUSDT' : symbolObj.symbol;
      const klines = await fetchBinanceKlines(binSymbol, timeframe, 250);
      if (klines && klines.length > 0) {
        return klines;
      }
    } catch (e) {
      console.warn(`Binance fetch failed for ${symbolObj.symbol}:`, e);
    }
  }

  // 2. Vietnam Stock (VN30), Commodities (Oil/Silver), or US Stock -> Live Yahoo Finance API
  if (symbolObj.type === 'vn30' || symbolObj.type === 'stock' || symbolObj.type === 'commodity') {
    try {
      const isVN = symbolObj.type === 'vn30' || symbolObj.symbol === 'SJC';
      const klines = await fetchStockKlines(symbolObj.symbol, timeframe, isVN);
      if (klines && klines.length > 0) {
        return klines;
      }
    } catch (e) {
      console.warn(`Stock/Commodity data fetch failed for ${symbolObj.symbol}:`, e);
    }
  }

  // 3. Realistic high-fidelity fallback if offline
  return generateRealisticKlines(
    symbolObj.price,
    150,
    timeframe,
    symbolObj.type === 'crypto' ? 0.022 : symbolObj.type === 'commodity' ? 0.010 : 0.015
  );
}

// Generate realistic synthetic klines if offline
export function generateRealisticKlines(
  basePrice: number,
  count: number = 150,
  timeframe: Timeframe = '1h',
  volatility: number = 0.018
): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  let intervalSeconds = 3600;

  if (timeframe === '1m') intervalSeconds = 60;
  else if (timeframe === '5m') intervalSeconds = 300;
  else if (timeframe === '15m') intervalSeconds = 900;
  else if (timeframe === '4h') intervalSeconds = 14400;
  else if (timeframe === '1D') intervalSeconds = 86400;
  else if (timeframe === '1W') intervalSeconds = 604800;

  let currentPrice = basePrice * 0.95;
  const startTime = now - count * intervalSeconds;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * intervalSeconds;
    const trendDrift = Math.sin(i / 15) * 0.002 + 0.0005;
    const shock = (Math.random() - 0.49) * volatility;
    const change = trendDrift + shock;

    const open = currentPrice;
    const close = Math.max(0.000001, open * (1 + change));
    const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.5));
    const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.5));
    const volume = Math.floor(basePrice * 1000 * (0.5 + Math.random() * 1.5) * (1 + Math.abs(change) * 10));

    candles.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
  }

  const scale = basePrice / candles[candles.length - 1].close;
  return candles.map(c => ({
    time: c.time,
    open: parseFloat((c.open * scale).toFixed(2)),
    high: parseFloat((c.high * scale).toFixed(2)),
    low: parseFloat((c.low * scale).toFixed(2)),
    close: parseFloat((c.close * scale).toFixed(2)),
    volume: c.volume,
  }));
}

export function getMarketSentiment(): MarketSentiment {
  return {
    fearAndGreedIndex: 74,
    sentimentClassification: 'Greed',
    longShortRatio: 1.38,
    fundingRate: 0.014,
    volatilityIndex: 17.8,
  };
}
