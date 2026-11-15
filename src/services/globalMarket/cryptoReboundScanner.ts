import { Candle } from '../../types';
import { fetchBinanceKlines } from '../api/binance';
import {
  closedReboundCandles, REBOUND_BAR, ReboundEvent, reboundBtcBreakdowns, scanCryptoRebounds,
} from './cryptoReboundEngine';

// Fixed spot pairs keep the backtest universe independent of today's returns.
export const REBOUND_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT',
  'TRXUSDT', 'AVAXUSDT', 'LINKUSDT', 'LTCUSDT', 'BCHUSDT', 'DOTUSDT', 'UNIUSDT',
  'NEARUSDT', 'SUIUSDT', 'AAVEUSDT', 'ATOMUSDT',
];

export interface ReboundScan {
  cutoff: number;
  events: ReboundEvent[];
  charts: Record<string, Candle[]>;
  unavailable: string[];
}

const JOURNAL_KEY = 'trading-new:crypto-rebound:v1';
const JOURNAL_RETENTION = 90 * 86_400;

export async function loadReboundScan(signal: AbortSignal, now = Math.floor(Date.now() / 1000)): Promise<ReboundScan> {
  const cutoff = Math.floor(now / REBOUND_BAR) * REBOUND_BAR;
  const charts: Record<string, Candle[]> = {};
  const unavailable: string[] = [];

  for (let i = 0; i < REBOUND_PAIRS.length; i += 4) {
    signal.throwIfAborted();
    const pairs = REBOUND_PAIRS.slice(i, i + 4);
    await Promise.all(pairs.map(async symbol => {
      try {
        const source = await fetchBinanceKlines(symbol, '15m', 1000, signal);
        const candles = closedReboundCandles(source, cutoff);
        if (candles.length < 320 || candles[candles.length - 1].time !== cutoff - REBOUND_BAR ||
          candles.some((bar, index) => ![bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite) ||
            bar.low <= 0 || bar.volume < 0 || (index > 0 && bar.time !== candles[index - 1].time + REBOUND_BAR))) {
          throw new Error('Incomplete candle history');
        }
        charts[symbol] = candles;
      } catch {
        unavailable.push(symbol);
      }
    }));
  }
  signal.throwIfAborted();
  const btc = reboundBtcBreakdowns(charts.BTCUSDT ?? []);
  const events = Object.entries(charts).flatMap(([symbol, candles]) => scanCryptoRebounds(symbol, candles, btc));
  events.sort((a, b) => b.setup.start - a.setup.start || a.setup.symbol.localeCompare(b.setup.symbol));
  return { cutoff, events, charts, unavailable: unavailable.sort() };
}

export function readReboundJournal(): ReboundEvent[] {
  try {
    const value = JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter(event => event?.setup?.id && event?.runs?.[12]?.conditional) : [];
  } catch {
    return [];
  }
}

export function updateReboundJournal(scan: ReboundScan): ReboundEvent[] {
  const events = new Map(readReboundJournal()
    .filter(event => event.setup.start >= scan.cutoff - JOURNAL_RETENTION)
    .map(event => [event.setup.id, event]));
  for (const event of scan.events) {
    // With incomplete BTC context, preserve completed comparisons unless this
    // scan can evaluate the same BTC filter consistently.
    if (!scan.charts.BTCUSDT && event.setup.symbol !== 'BTCUSDT' && event.setup.symbol !== 'ETHUSDT') continue;
    const existing = events.get(event.setup.id);
    if (existing && existing.runs[12].conditional.outcome !== 'open') continue;
    events.set(event.setup.id, event);
  }
  const history = [...events.values()].sort((a, b) => b.setup.start - a.setup.start).slice(0, 1500);
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(history));
  } catch {
    // The live scan is still available when browser storage is unavailable.
  }
  return history;
}
