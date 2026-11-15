import { Candle } from '../../types';
import { calculateATR } from '../indicators';

export const REBOUND_BAR = 15 * 60;
const HOUR = 4 * REBOUND_BAR;
const STRATEGY_HOURS = [4, 12] as const;
export const REBOUND_METHODS = ['confirmed', 'conditional', 'limits'] as const;
export type ReboundMethod = typeof REBOUND_METHODS[number];
export type ReboundHours = typeof STRATEGY_HOURS[number];
export type ReboundOutcome = 'open' | 'target' | 'stop' | 'expired' | 'no_entry';
export type ReboundStage = 'probe' | 'confirm' | 'retest';
export const REBOUND_STAGES: ReboundStage[] = ['probe', 'confirm', 'retest'];
export const REBOUND_RISK = [0.2, 0.5, 0.3] as const;
export const REBOUND_FEE = 0.001;
export const REBOUND_SLIPPAGE = 0.0005;

export interface ReboundSetup {
  id: string;
  symbol: string;
  start: number;
  lower: number;
  upper: number;
  stop: number;
  target: number;
  dropAtr: number;
  volumeRatio: number;
}

export interface ReboundFill {
  step: number;
  time: number;
  price: number;
  quantity: number; // per 1 USDT of total risk budget
}

export interface ReboundRun {
  outcome: ReboundOutcome;
  fills: ReboundFill[];
  netR: number | null;
  exitTime?: number;
}

export interface ReboundEvent {
  setup: ReboundSetup;
  runs: Record<ReboundHours, Record<ReboundMethod, ReboundRun>>;
  stages: Partial<Record<ReboundStage, number>>;
  skipped: Partial<Record<ReboundStage, 'btc' | 'reward'>>;
}

export function closedReboundCandles(source: Candle[], now: number): Candle[] {
  return source.filter(candle => candle.time + REBOUND_BAR <= now);
}

function aggregate(candles: Candle[], interval: number): Candle[] {
  const bars: Candle[] = [];
  const count = interval / REBOUND_BAR;
  for (let i = 0; i + count <= candles.length; i++) {
    const first = candles[i];
    if (first.time % interval !== 0) continue;
    const group = candles.slice(i, i + count);
    if (group.some((candle, offset) => candle.time !== first.time + offset * REBOUND_BAR)) continue;
    bars.push({
      time: first.time,
      open: first.open,
      high: Math.max(...group.map(candle => candle.high)),
      low: Math.min(...group.map(candle => candle.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((total, candle) => total + candle.volume, 0),
    });
    i += count - 1;
  }
  return bars;
}

export function reboundBtcBreakdowns(candles: Candle[]): Map<number, boolean> {
  const hours = aggregate(candles, HOUR);
  return new Map(hours.slice(24).map((candle, index) => [
    candle.time + HOUR,
    candle.close < Math.min(...hours.slice(index, index + 24).map(prior => prior.low)),
  ]));
}

function findSetup(
  symbol: string, hours: Candle[], fourHours: Candle[], atr: number, index: number
): ReboundSetup | undefined {
  const selloff = hours[index];
  const prior = hours.slice(index - 24, index);
  const peak = Math.max(...prior.slice(-11).map(candle => candle.high), selloff.open);
  const volumes = prior.slice(-20).map(candle => candle.volume).sort((a, b) => a - b);
  const medianVolume = (volumes[9] + volumes[10]) / 2;
  const dropAtr = (peak - selloff.close) / atr;
  const volumeRatio = selloff.volume / medianVolume;
  if (!(atr > 0 && medianVolume > 0 && dropAtr >= 2 && volumeRatio >= 1.5 &&
        selloff.close < selloff.open)) return;

  // A pivot uses only candles that had closed before the selloff started.
  const context = [prior, fourHours.filter(bar => bar.time + 4 * HOUR <= selloff.time).slice(-18)];
  const lows = context.flatMap(bars => bars.flatMap((bar, i) =>
    i > 0 && i < bars.length - 1 && bar.low < bars[i - 1].low && bar.low <= bars[i + 1].low
      ? [bar.low] : []
  ));
  const highs = context.flatMap(bars => bars.flatMap((bar, i) =>
    i > 0 && i < bars.length - 1 && bar.high > bars[i - 1].high && bar.high >= bars[i + 1].high
      ? [bar.high] : []
  ));
  const support = lows.filter(price =>
    price <= selloff.close + 0.20 * atr && price >= selloff.close - 1.25 * atr
  ).sort((a, b) => Math.abs(a - selloff.close) - Math.abs(b - selloff.close))[0];
  if (support === undefined) return;
  const lower = support - 0.15 * atr;
  const upper = support + 0.15 * atr;
  const stop = support - 0.65 * atr;
  const target = Math.min(...highs.filter(price => price > upper));
  if (!Number.isFinite(target) || stop <= 0 || selloff.close <= stop || selloff.close >= target) return;
  const start = selloff.time + HOUR;
  return { id: symbol + ':' + start, symbol, start, lower, upper, stop, target, dropAtr, volumeRatio };
}

function fillFor(
  setup: ReboundSetup, step: number, time: number, price: number, risk: number
): ReboundFill | undefined {
  const stopNet = setup.stop * (1 - REBOUND_SLIPPAGE) * (1 - REBOUND_FEE);
  const paid = price * (1 + REBOUND_FEE);
  const loss = paid - stopNet;
  const reward = setup.target * (1 - REBOUND_SLIPPAGE) * (1 - REBOUND_FEE) - paid;
  if (price <= setup.stop || loss <= 0 || reward / loss < 1.5) return;
  return { step, time, price, quantity: risk / loss };
}

export function simulateRebound(
  setup: ReboundSetup, candles: Candle[], btcBreakdowns: ReadonlyMap<number, boolean>, hours: ReboundHours
) {
  const deadline = setup.start + hours * HOUR;
  const entryDeadline = setup.start + 4 * HOUR;
  const stages: ReboundEvent['stages'] = {};
  const skipped: ReboundEvent['skipped'] = {};
  const runs: Record<ReboundMethod, ReboundRun> = {
    confirmed: { outcome: 'open', fills: [], netR: null },
    conditional: { outcome: 'open', fills: [], netR: null },
    limits: { outcome: 'open', fills: [], netR: null },
  };
  const limitPrices = [setup.upper, (setup.upper + setup.lower) / 2, setup.lower];
  let probeHigh: number | undefined;
  let nextStage: ReboundStage | undefined;

  function closeRun(run: ReboundRun, reason: 'target' | 'stop' | 'expired', time: number, price: number) {
    run.outcome = run.fills.length ? reason : 'no_entry';
    run.exitTime = time;
    const proceeds = price * (1 - REBOUND_SLIPPAGE) * (1 - REBOUND_FEE);
    run.netR = run.fills.reduce((sum, fill) =>
      sum + (proceeds - fill.price * (1 + REBOUND_FEE)) * fill.quantity, 0);
  }

  for (const candle of candles) {
    if (candle.time < setup.start) continue;
    if (candle.time >= deadline) break;
    const closeTime = candle.time + REBOUND_BAR;
    // A gap beyond a barrier resolves the setup before new entries at that open.
    const gap = candle.open <= setup.stop ? 'stop' : candle.open >= setup.target ? 'target' : undefined;
    if (gap) {
      REBOUND_METHODS.forEach(method => closeRun(runs[method], gap, candle.time,
        gap === 'stop' ? candle.open : setup.target));
      break;
    }

    if (nextStage && candle.time < entryDeadline) {
      const step = REBOUND_STAGES.indexOf(nextStage);
      const price = candle.open * (1 + REBOUND_SLIPPAGE);
      const isAlt = setup.symbol !== 'BTCUSDT' && setup.symbol !== 'ETHUSDT';
      const btcSafe = btcBreakdowns.get(Math.floor(candle.time / HOUR) * HOUR) === false;
      if (nextStage === 'probe' && isAlt && !btcSafe) {
        skipped.probe = 'btc';
      } else {
        const fill = fillFor(setup, step, candle.time, price, REBOUND_RISK[step]);
        if (fill) runs.conditional.fills.push(fill);
        else skipped[nextStage] = 'reward';
      }
      if (nextStage === 'confirm') {
        const fill = fillFor(setup, step, candle.time, price, 1);
        if (fill) runs.confirmed.fills.push(fill);
      }
    }

    if (candle.time < entryDeadline) {
      limitPrices.forEach((price, step) => {
        if (candle.low >= price || runs.limits.fills.some(fill => fill.step === step)) return;
        const fill = fillFor(setup, step, candle.time, price, REBOUND_RISK[step]);
        if (fill) runs.limits.fills.push(fill);
      });
    }

    // With 15-minute OHLC, a candle touching both barriers resolves at the stop.
    // If a limit entry and target share a bar, test the conservative case that
    // the target was visited before that limit entered.
    if (candle.low <= setup.stop || candle.high >= setup.target) {
      const outcome = candle.low <= setup.stop ? 'stop' : 'target';
      if (outcome === 'target') {
        const newlyFilled = runs.limits.fills.filter(fill => fill.time === candle.time);
        if (newlyFilled.length) {
          // Resolve the target only for positions verifiably entered before this bar.
          runs.limits.fills = runs.limits.fills.filter(fill => fill.time < candle.time);
        }
      }
      REBOUND_METHODS.forEach(method => closeRun(runs[method], outcome, closeTime,
        outcome === 'stop' ? setup.stop : setup.target));
      break;
    }
    if (closeTime === deadline) {
      REBOUND_METHODS.forEach(method => closeRun(runs[method], 'expired', closeTime, candle.close));
      break;
    }

    nextStage = undefined;
    if (closeTime >= entryDeadline) continue;
    if (probeHigh === undefined && candle.low < setup.lower && candle.close >= setup.lower) {
      probeHigh = candle.high;
      nextStage = 'probe';
    } else if (probeHigh !== undefined && !stages.confirm && candle.close > Math.max(probeHigh, setup.upper)) {
      nextStage = 'confirm';
    } else if (stages.confirm && !stages.retest && candle.low <= setup.upper &&
      candle.close > setup.upper && candle.close > candle.open) {
      nextStage = 'retest';
    }
    if (nextStage) stages[nextStage] = closeTime;
  }

  return { runs, stages, skipped };
}

export function scanCryptoRebounds(
  symbol: string, candles: Candle[], btcBreakdowns: ReadonlyMap<number, boolean>
): ReboundEvent[] {
  const hours = aggregate(candles, HOUR);
  const fourHours = aggregate(candles, 4 * HOUR);
  const events: ReboundEvent[] = [];
  let nextSetup = 0;
  // A fixed warm-up window keeps historical price levels stable across scans.
  for (let index = 76; index < hours.length; index++) {
    if (hours[index].time + HOUR < nextSetup) continue;
    const atr = calculateATR(hours.slice(index - 28, index));
    const setup = findSetup(symbol, hours, fourHours, atr[atr.length - 1], index);
    if (!setup) continue;
    const subsequent = candles.filter(candle => candle.time >= setup.start &&
      candle.time < setup.start + 12 * HOUR);
    const twelve = simulateRebound(setup, subsequent, btcBreakdowns, 12);
    const four = simulateRebound(setup, subsequent, btcBreakdowns, 4);
    events.push({
      setup,
      runs: { 4: four.runs, 12: twelve.runs },
      stages: twelve.stages,
      skipped: twelve.skipped,
    });
    nextSetup = twelve.runs.conditional.exitTime ?? setup.start + 12 * HOUR;
  }
  return events;
}

export function summarizeRebounds(events: ReboundEvent[], hours: ReboundHours, method: ReboundMethod) {
  const finished = events.map(event => event.runs[hours][method]).filter(run => run.netR !== null);
  const entered = finished.filter(run => run.fills.length > 0);
  return {
    count: finished.length,
    entered: entered.length,
    targets: entered.filter(run => run.outcome === 'target').length,
    stops: entered.filter(run => run.outcome === 'stop').length,
    allFillsStopped: entered.filter(run => run.outcome === 'stop' && run.fills.length === 3).length,
    meanR: finished.length ? finished.reduce((sum, run) => sum + (run.netR ?? 0), 0) / finished.length : null,
  };
}
