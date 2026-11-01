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
  '1M': '1M',
};

const BASE_URLS = [
  '/api/binance', // Vite / Vercel / Nginx same-origin proxy (bypass CORS & ISP blocks)
  'https://data-api.binance.vision/api/v3', // Official Binance mirror (accessible globally)
  'https://api.binance.com/api/v3',
  'https://api1.binance.com/api/v3',
  'https://api2.binance.com/api/v3',
  'https://api3.binance.com/api/v3',
];

// Cache symbols known not to exist on Binance Spot so filtered batch queries stay fast (~5 KB)
const invalidBinanceSymbols = new Set<string>();

async function fetchWithFallbacks(path: string): Promise<any> {
  let lastError: any = null;
  for (const base of BASE_URLS) {
    try {
      const url = `${base}${path}`;
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
      // 400 Bad Request (e.g. invalid symbol in batch) is deterministic across mirrors; stop retrying mirrors
      if (res.status === 400) {
        throw new Error(`HTTP 400 on ${path}`);
      }
    } catch (err: any) {
      lastError = err;
      if (err?.message?.startsWith('HTTP 400')) {
        break;
      }
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

// Bulk fetch all 24h tickers (full exchange fallback)
export async function fetchAllBinance24hTickers(): Promise<any[]> {
  const path = '/ticker/24hr';
  try {
    return await fetchWithFallbacks(path);
  } catch (e) {
    console.warn('Failed to fetch bulk tickers', e);
    return [];
  }
}

// Fast targeted batch fetch (~5 KB instead of 1.92 MB) for Watchlist symbols
export async function fetchBinance24hTickersForSymbols(rawSymbols: string[]): Promise<any[]> {
  const candidates = Array.from(
    new Set(
      rawSymbols
        .map(s => s.replace(/[/_-]/g, '').toUpperCase())
        .filter(s => /^[A-Z0-9]{4,20}$/.test(s) && !invalidBinanceSymbols.has(s))
    )
  );

  if (candidates.length === 0) return [];

  const encoded = encodeURIComponent(JSON.stringify(candidates));
  try {
    const res = await fetchWithFallbacks(`/ticker/24hr?symbols=${encoded}`);
    if (Array.isArray(res)) return res;
  } catch {
    // One or more custom symbols may not exist on Binance Spot; fallback once and prune invalid symbols
    const all = await fetchAllBinance24hTickers();
    if (Array.isArray(all) && all.length > 0) {
      const validSet = new Set(all.map((t: any) => t.symbol));
      for (const c of candidates) {
        if (!validSet.has(c)) {
          invalidBinanceSymbols.add(c);
        }
      }
      return all.filter((t: any) => candidates.includes(t.symbol));
    }
  }
  return [];
}

export interface BinanceMiniTickerItem {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

// Multiplex WebSocket stream for instant Watchlist Crypto + Gold (PAXGUSDT) live ticks
export class BinanceWatchlistSocket {
  private ws: WebSocket | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Map<string, BinanceMiniTickerItem>();
  private activeKey = '';
  private isManuallyClosed = false;

  connect(
    rawSymbols: string[],
    onBatchUpdate: (updates: Map<string, BinanceMiniTickerItem>) => void
  ) {
    const streams = Array.from(
      new Set(
        rawSymbols
          .map(s => s.replace(/[/_-]/g, '').toUpperCase())
          .filter(s => /^[A-Z0-9]{4,20}$/.test(s) && !invalidBinanceSymbols.has(s))
          .map(s => `${s.toLowerCase()}@miniTicker`)
      )
    ).sort();

    if (streams.length === 0) {
      this.disconnect();
      return;
    }

    const nextKey = streams.join('/');
    if (this.ws && this.activeKey === nextKey && this.ws.readyState <= WebSocket.OPEN) {
      return;
    }

    this.disconnect();
    this.isManuallyClosed = false;
    this.activeKey = nextKey;

    const wsUrls = [
      `wss://data-stream.binance.vision/stream?streams=${nextKey}`,
      `wss://stream.binance.com:9443/stream?streams=${nextKey}`,
    ];
    let urlIdx = 0;

    const openSocket = () => {
      if (this.isManuallyClosed || urlIdx >= wsUrls.length) return;
      try {
        this.ws = new WebSocket(wsUrls[urlIdx]);

        this.ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            const d = payload?.data || payload;
            if (d && d.s && d.c) {
              const close = parseFloat(d.c);
              const open = parseFloat(d.o);
              const high = parseFloat(d.h);
              const low = parseFloat(d.l);
              const quoteVol = parseFloat(d.q);
              if (close > 0) {
                const change24h = open > 0 ? parseFloat((((close - open) / open) * 100).toFixed(2)) : 0;
                this.pending.set(d.s, {
                  symbol: d.s,
                  price: close,
                  change24h,
                  high24h: high > 0 ? high : close,
                  low24h: low > 0 ? low : close,
                  volume24h: quoteVol > 0 ? quoteVol : 0,
                });
              }
            }
          } catch {
            // ignore malformed frame
          }
        };

        this.ws.onerror = () => {
          urlIdx++;
          if (!this.isManuallyClosed && urlIdx < wsUrls.length) {
            openSocket();
          }
        };

        this.ws.onclose = () => {
          if (!this.isManuallyClosed) {
            this.reconnectTimer = setTimeout(() => {
              urlIdx = 0;
              openSocket();
            }, 4000);
          }
        };
      } catch {
        urlIdx++;
        if (!this.isManuallyClosed && urlIdx < wsUrls.length) {
          openSocket();
        }
      }
    };

    openSocket();

    this.flushTimer = setInterval(() => {
      if (this.pending.size > 0) {
        const snapshot = new Map(this.pending);
        this.pending.clear();
        onBatchUpdate(snapshot);
      }
    }, 600);
  }

  disconnect() {
    this.isManuallyClosed = true;
    this.activeKey = '';
    this.pending.clear();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Single-symbol Klines WebSocket live feed manager with automatic mirror fallback
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
