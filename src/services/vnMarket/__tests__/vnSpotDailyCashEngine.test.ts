import { describe, expect, it } from 'vitest';
import { Candle, MarketSymbol } from '../../../types';
import {
  computeVnAfternoonT2WindowPlan,
  computeVnDailySpotScanner,
  computeVnSpotCashLockPlan,
  computeVnSpotRollingCashCarousel,
  computeVnZeroLeverageT0Plan,
  evaluateVnDailySpotTradingReport,
} from '../vnSpotDailyCashEngine';

function buildSyntheticCandles(
  count: number,
  basePrice: number = 100,
  stepPerBar: number = 0.25,
  volMultLast: number = 1.6
): Candle[] {
  const out: Candle[] = [];
  let p = basePrice;
  const startSec = 1_760_000_000;
  for (let i = 0; i < count; i++) {
    const open = p;
    const close = Number((open + stepPerBar).toFixed(2));
    const high = Number((Math.max(open, close) * 1.008).toFixed(2));
    const low = Number((Math.min(open, close) * 0.993).toFixed(2));
    const volume = i === count - 1 ? Math.round(1_200_000 * volMultLast) : 1_000_000;
    out.push({
      time: startSec + i * 3600,
      open,
      high,
      low,
      close,
      volume,
    });
    p = close;
  }
  return out;
}

const mockSymbols: MarketSymbol[] = [
  {
    symbol: 'VNINDEX',
    name: 'VN-Index',
    baseAsset: 'VNINDEX',
    price: 1255,
    change24h: -0.45,
    high24h: 1264,
    low24h: 1250,
    volume24h: 650_000_000,
    type: 'vn30',
    quoteAsset: 'VND',
  },
  {
    symbol: 'FPT',
    name: 'FPT Corp',
    baseAsset: 'FPT',
    price: 132.5,
    change24h: 1.85,
    high24h: 133.2,
    low24h: 130.1,
    volume24h: 4_500_000,
    type: 'vn30',
    quoteAsset: 'VND',
  },
  {
    symbol: 'HPG',
    name: 'Hoa Phat Group',
    baseAsset: 'HPG',
    price: 27.4,
    change24h: 0.95,
    high24h: 27.6,
    low24h: 27.0,
    volume24h: 18_000_000,
    type: 'vn30',
    quoteAsset: 'VND',
  },
  {
    symbol: 'SSI',
    name: 'SSI Securities',
    baseAsset: 'SSI',
    price: 34.8,
    change24h: 5.4,
    high24h: 35.0,
    low24h: 33.2,
    volume24h: 22_000_000,
    type: 'vn30',
    quoteAsset: 'VND',
  },
];

describe('Vietnam Spot-Only Daily Cash Trading Engine (6 Modules)', () => {
  it('1. splits capital into 3 rolling T+2.5 cash buckets (33/33/34) and checks zero-leverage compliance', () => {
    const fpt = mockSymbols[1];
    const carousel = computeVnSpotRollingCashCarousel({
      activeSymbolObj: fpt,
      allSymbols: mockSymbols,
      totalSpotCapitalMillionVnd: 150,
      userHoldingsMap: {
        HPG: {
          symbol: 'HPG',
          quantity: 1000,
          avgCostPrice: 26.8,
          marginRatioPct: 0,
          holdingDays: 4, // T+2.5 settled
          extraDcaBudget: null,
          updatedAtMs: Date.now(),
        },
      },
    });

    expect(carousel.buckets).toHaveLength(3);
    expect(carousel.hasZeroLeverageCompliance).toBe(true);
    expect(carousel.todaySellableInventoryMillionVnd).toBeGreaterThan(25);
    expect(carousel.recommendedTodaySymbolBudgetMillionVnd).toBeLessThanOrEqual(50);
    expect(carousel.recommendedTodaySymbolLots % 100).toBe(0);
  });

  it('2 & 5. detects Pocket Pivot sweet-spot breakouts (+0.6%..+3.6%), RS green-in-red leaders, and blocks ceiling chasing', () => {
    const fpt = mockSymbols[1];
    const ssiChasing = mockSymbols[3];
    const candles = buildSyntheticCandles(30, 127, 0.2, 1.55);

    const fptScanner = computeVnDailySpotScanner({
      activeSymbolObj: fpt,
      allSymbols: mockSymbols,
      activeCandles: candles,
    });

    expect(fptScanner.activeSymbolCandidate.isGreenInRedMarket).toBe(true);
    expect(fptScanner.activeSymbolCandidate.rsAlphaVsVnIndexPct).toBeCloseTo(2.3, 1);
    expect(fptScanner.activeSymbolCandidate.setupStatus).toBe('SWEET_SPOT_POCKET_PIVOT');
    expect(fptScanner.activeSymbolCandidate.dailySpotScore).toBeGreaterThanOrEqual(75);
    expect(fptScanner.topDailySpotCandidates.length).toBeGreaterThanOrEqual(2);

    const ssiScanner = computeVnDailySpotScanner({
      activeSymbolObj: ssiChasing,
      allSymbols: mockSymbols,
      activeCandles: candles,
    });
    expect(ssiScanner.activeSymbolCandidate.setupStatus).toBe('CHASING_CEILING_TRAP_AVOID');
  });

  it('3. computes zero-leverage T+0 inventory cash harvesting with net spread after 0.45% fee/tax', () => {
    const hpg = mockSymbols[2];
    const candles = buildSyntheticCandles(25, 26.5, 0.04, 1.2);

    const t0Plan = computeVnZeroLeverageT0Plan({
      symbolObj: hpg,
      candles,
      userHoldingsMap: {
        HPG: {
          symbol: 'HPG',
          quantity: 3000,
          avgCostPrice: 27.1,
          marginRatioPct: 0,
          holdingDays: 5,
          extraDcaBudget: null,
          updatedAtMs: Date.now(),
        },
      },
    });

    expect(t0Plan.hasSettledUserInventory).toBe(true);
    expect(t0Plan.settledSharesAvailable).toBe(3000);
    expect(t0Plan.surfLotShares).toBe(900); // 30% of 3000 rounded to 100 lot
    expect(t0Plan.intradaySellPrice).toBeGreaterThan(t0Plan.intradayBuyPrice);
    expect(t0Plan.netDailyProfitThousandVnd).toBeGreaterThan(0);
  });

  it('4 & 6. evaluates afternoon 13:45-14:25 settlement window and T+3 cash-lock compounding ladder', () => {
    const fpt = mockSymbols[1];
    const candles = buildSyntheticCandles(25, 130, 0.12, 1.4);
    // 14:00 GMT+7 on a Wednesday (07:00 UTC)
    const wed1400Vn = new Date('2026-11-04T07:00:00Z');

    const windowPlan = computeVnAfternoonT2WindowPlan({
      symbolObj: fpt,
      candles,
      now: wed1400Vn,
    });

    expect(windowPlan.windowState).toBe('GOLDEN_AFTERNOON_WINDOW_13H45_14H25');
    expect(windowPlan.effectiveHoldingRiskDays).toBe(1.6);

    const cashLock = computeVnSpotCashLockPlan({
      symbolObj: fpt,
      bucketCapitalMillionVnd: 150,
    });

    expect(cashLock.trueBreakEvenPrice).toBeGreaterThan(cashLock.referenceEntryPrice);
    expect(cashLock.cashLockHalfTargetPrice).toBeGreaterThan(cashLock.trueBreakEvenPrice);
    expect(cashLock.compounding12CyclesProfitMillionVnd).toBeGreaterThan(
      cashLock.compounding5CyclesProfitMillionVnd
    );

    const fullReport = evaluateVnDailySpotTradingReport({
      symbolObj: fpt,
      allSymbols: mockSymbols,
      candles,
      now: wed1400Vn,
    });
    expect(fullReport.symbol).toBe('FPT');
  });
});
