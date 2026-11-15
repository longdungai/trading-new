import { describe, expect, it } from 'vitest';
import { Candle } from '../../../types';
import {
  closedReboundCandles, REBOUND_BAR, ReboundSetup, scanCryptoRebounds, simulateRebound, summarizeRebounds,
} from '../cryptoReboundEngine';

const setup: ReboundSetup = {
  id: 'SOLUSDT:0', symbol: 'SOLUSDT', start: 0, lower: 99, upper: 101, stop: 97, target: 116,
  dropAtr: 3, volumeRatio: 2,
};

function bar(index: number, open: number, high: number, low: number, close: number, volume = 100): Candle {
  return { time: index * REBOUND_BAR, open, high, low, close, volume };
}

const recovery = [
  bar(0, 101, 102, 98, 100),
  bar(1, 100, 104, 99.5, 103),
  bar(2, 103, 104, 100.5, 103.5),
  bar(3, 103.5, 106, 103, 105),
];

describe('Crypto rebound replay', () => {
  it('waits until the next open and uses one risk budget for all three entries', () => {
    const initial = simulateRebound(setup, recovery.slice(0, 1), new Map([[0, false]]), 12);
    expect(initial.stages.probe).toBe(REBOUND_BAR);
    expect(initial.runs.conditional.fills).toHaveLength(0);

    const result = simulateRebound(setup, [...recovery, bar(4, 105, 117, 96, 110)], new Map([[0, false]]), 12);
    expect(result.runs.conditional.fills.map(fill => fill.time)).toEqual([900, 1800, 2700]);
    expect(result.runs.confirmed.fills.map(fill => fill.time)).toEqual([1800]);
    expect(result.runs.conditional.outcome).toBe('stop');
    expect(result.runs.conditional.netR).toBeCloseTo(-1);
  });

  it('blocks only the altcoin probe on BTC breakdown or missing BTC data', () => {
    for (const context of [new Map([[0, true]]), new Map()]) {
      const result = simulateRebound(setup, recovery, context, 12);
      expect(result.skipped.probe).toBe('btc');
      expect(result.runs.conditional.fills.map(fill => fill.step)).toEqual([1, 2]);
      expect(result.runs.confirmed.fills).toHaveLength(1);
    }
  });

  it('handles a gap through the stop before adding to a position', () => {
    const result = simulateRebound(setup, [...recovery.slice(0, 2), bar(2, 95, 100, 93, 98)], new Map([[0, false]]), 12);
    expect(result.runs.confirmed.outcome).toBe('no_entry');
    expect(result.runs.conditional.fills).toHaveLength(1);
    expect(result.runs.conditional.netR).toBeLessThan(-0.2);
  });

  it('does not assume a limit fill on a price touch or a target before a fill is provable', () => {
    const touch = simulateRebound(setup, [bar(0, 103, 106, 101, 104)], new Map(), 12);
    expect(touch.runs.limits.fills).toHaveLength(0);
    const ambiguous = simulateRebound(setup, [bar(0, 105, 117, 98, 104)], new Map(), 12);
    expect(ambiguous.runs.limits.outcome).toBe('no_entry');
    expect(ambiguous.runs.limits.netR).toBe(0);
  });

  it('measures fixed horizons from the same opportunity start and counts skipped opportunities', () => {
    const candles = [...recovery, ...Array.from({ length: 12 }, (_, index) => bar(index + 4, 105, 106, 104, 105)),
      bar(16, 105, 117, 103, 116)];
    const four = simulateRebound(setup, candles, new Map([[0, false]]), 4);
    const twelve = simulateRebound(setup, candles, new Map([[0, false]]), 12);
    expect(four.runs.conditional.outcome).toBe('expired');
    expect(twelve.runs.conditional.outcome).toBe('target');
    const skipped = simulateRebound(setup, [bar(0, 118, 119, 113, 114)], new Map(), 12);
    const stats = summarizeRebounds([
      { setup, runs: { 4: four.runs, 12: twelve.runs }, stages: {}, skipped: {} },
      { setup, runs: { 4: skipped.runs, 12: skipped.runs }, stages: {}, skipped: {} },
    ], 12, 'conditional');
    expect(stats).toMatchObject({ count: 2, entered: 1, targets: 1 });
    expect(stats.meanR).toBeCloseTo(twelve.runs.conditional.netR! / 2);
  });

  it('detects a selloff with prior support only after its hourly candle closes', () => {
    const candles = Array.from({ length: 85 * 4 }, (_, index) => {
      const hour = Math.floor(index / 4);
      if (hour === 84) return bar(index, 107, 107.5, 100, 100.8, 400);
      if (hour % 7 === 0) return bar(index, 103, 104, 100, 103);
      if (hour % 7 === 3) return bar(index, 106, 110, 105, 107);
      return bar(index, 104, 107, 103, 105);
    });
    const cutoff = 85 * 4 * REBOUND_BAR;
    expect(scanCryptoRebounds('BTCUSDT', closedReboundCandles(candles, cutoff - 1), new Map())).toEqual([]);
    const events = scanCryptoRebounds('BTCUSDT', closedReboundCandles(candles, cutoff), new Map());
    expect(events).toHaveLength(1);
    expect(events[0].setup).toMatchObject({ start: cutoff, symbol: 'BTCUSDT' });
    expect(events[0].setup.stop).toBeLessThan(events[0].setup.lower);
    expect(events[0].runs[12].conditional.outcome).toBe('open');
  });
});
