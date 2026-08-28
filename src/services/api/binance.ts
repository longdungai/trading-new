import { Candle, OrderBook, Timeframe } from '../../types';

// Map timeframes to Binance API intervals
const timeframeMap: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1D': '1d',
  '1W': '1w',
};

const BASE_URLS = [
  '/api/binance', // Vite local proxy (bypass CORS & ISP blocks)
  'https://data-api.binance.vision/api/v3', // Official Binance mirror (always accessible in VN)
  'https://api.binance.com/api/v3',
  'https://api1.binance.com/api/v3',
  'https://api2.binance.com/api/v3',
  'https://api3.binance.com/api/v3',
];

async function fetchWithFallbacks(path: string): Promise<any> {
  let lastError: any = null;
  for (const base of BASE_URLS) {
    try {
      const url = `${base}${path}`;
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Failed to fetch ${path} from all endpoints`);
}

export async function fetchBinanceKlines(
  symbol: string,
  timeframe: Timeframe = '1h',
  limit: number = 250
): Promise<Candle[]> {
  const binanceSymbol = symbol.replace(/[/_-]/g, '').toUpperCase();
  const interval = timeframeMap[timeframe] || '1h';
  const path = `/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;

  try {
    const data = await fetchWithFallbacks(path);
    return data.map((item: (number | string)[]) => ({
      time: Math.floor(Number(item[0]) / 1000),
      open: parseFloat(item[1] as string),
      high: parseFloat(item[2] as string),
      low: parseFloat(item[3] as string),
      close: parseFloat(item[4] as string),
      volume: parseFloat(item[5] as string),
    }));
  } catch (error) {
    console.warn(`Failed to fetch Binance klines for ${symbol}:`, error);
    throw error;
  }
}

export async function fetchBinance24hTicker(symbol: string) {
  const binanceSymbol = symbol.replace(/[/_-]/g, '').toUpperCase();
  const path = `/ticker/24hr?symbol=${binanceSymbol}`;

  try {
    const data = await fetchWithFallbacks(path);
    return {
      price: parseFloat(data.lastPrice),
      change24h: parseFloat(data.priceChangePercent),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice),
      volume24h: parseFloat(data.quoteVolume),
    };
  } catch (error) {
    console.warn(`Failed to fetch 24h ticker for ${symbol}:`, error);
    throw error;
  }
}

export async function fetchBinanceOrderBook(symbol: string, limit = 15): Promise<OrderBook> {
  const binanceSymbol = symbol.replace(/[/_-]/g, '').toUpperCase();
  const path = `/depth?symbol=${binanceSymbol}&limit=${limit}`;

  try {
    const data = await fetchWithFallbacks(path);

    let bidTotal = 0;
    const bids = data.bids.map((b: [string, string]) => {
      const price = parseFloat(b[0]);
      const amount = parseFloat(b[1]);
      bidTotal += amount;
      return { price, amount, total: bidTotal };
    });

    let askTotal = 0;
    const asks = data.asks.map((a: [string, string]) => {
      const price = parseFloat(a[0]);
      const amount = parseFloat(a[1]);
      askTotal += amount;
      return { price, amount, total: askTotal };
    });

    const highestBid = bids[0]?.price || 0;
    const lowestAsk = asks[0]?.price || 0;
    const spread = Math.max(0, lowestAsk - highestBid);
    const spreadPercent = highestBid > 0 ? (spread / highestBid) * 100 : 0;

    return { bids, asks, spread, spreadPercent };
  } catch (error) {
    console.warn(`Failed to fetch OrderBook for ${symbol}:`, error);
    throw error;
  }
}

// Bulk fetch all 24h tickers
export async function fetchAllBinance24hTickers(): Promise<any[]> {
  const path = '/ticker/24hr';
  try {
    return await fetchWithFallbacks(path);
  } catch (e) {
    console.warn('Failed to fetch bulk tickers', e);
    return [];
  }
}

// WebSocket live feed manager with automatic mirror fallback
export class BinanceWebSocket {
  private ws: WebSocket | null = null;
  private onMessageCallback: ((candle: Candle) => void) | null = null;

  connect(symbol: string, timeframe: Timeframe, onMessage: (candle: Candle) => void) {
    this.disconnect();
    this.onMessageCallback = onMessage;

    const binanceSymbol = symbol.replace(/[/_-]/g, '').toLowerCase();
    const interval = timeframeMap[timeframe] || '1h';
    const wsUrls = [
      `wss://data-stream.binance.vision/ws/${binanceSymbol}@kline_${interval}`,
      `wss://stream.binance.com:9443/ws/${binanceSymbol}@kline_${interval}`,
    ];

    let currentUrlIndex = 0;

    const tryConnect = () => {
      if (currentUrlIndex >= wsUrls.length) return;
      const url = wsUrls[currentUrlIndex];

      try {
        this.ws = new WebSocket(url);

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.e === 'kline' && data.k) {
              const k = data.k;
              const candle: Candle = {
                time: Math.floor(k.t / 1000),
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
              };
              if (this.onMessageCallback) {
                this.onMessageCallback(candle);
              }
            }
          } catch (e) {
            console.error('Error parsing WS message', e);
          }
        };

        this.ws.onerror = () => {
          currentUrlIndex++;
          if (currentUrlIndex < wsUrls.length) {
            tryConnect();
          }
        };
      } catch (e) {
        currentUrlIndex++;
        if (currentUrlIndex < wsUrls.length) {
          tryConnect();
        }
      }
    };

    tryConnect();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onMessageCallback = null;
  }
}
