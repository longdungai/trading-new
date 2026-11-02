import { describe, expect, it } from 'vitest';
import {
  computeVnBottomFishingLadder,
  evaluateVnAtcDistortionShield,
  evaluateVnCapitulationCycleMeter,
  evaluateVnComprehensiveTacticalReport,
  evaluateVnPanicAndForceSellRadar,
  evaluateVnPostCrashFtdAndBetaHedge,
  evaluateVnT2CohortSupplyShock,
} from '../vnSelloffAndBottomEngine';
import { Candle, MarketSymbol } from '../../../types';
import { UserHoldingItem } from '../../portfolio/holdingsRecoveryEngine';

function buildDailyCandles(
  count: number,
  startPrice: number,
  stepPerDay: number,
  volMultiplierOnDrops: number = 1.0
): Candle[] {
  const baseTime = 1_760_000_000;
  const out: Candle[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const open = price;
    const isDrop = i % 2 === 1;
    const delta = isDrop ? -Math.abs(stepPerDay) * 1.25 : Math.abs(stepPerDay) * 0.45;
    const close = Math.max(5, Number((open + delta).toFixed(2)));
    const high = Number((Math.max(open, close) + 0.3).toFixed(2));
    const low = Number((Math.min(open, close) - 0.3).toFixed(2));
    const baseVol = 2_000_000 + i * 20_000;
    const volume = isDrop ? Math.round(baseVol * volMultiplierOnDrops) : baseVol;
    out.push({
      time: baseTime + i * 86_400,
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }
  return out;
}

describe('Vietnam 6-Engine Institutional Selloff, Bottom-Fishing & T+2.5 Tactical Suite', () => {
  it('Engine 1: detects O’Neil Distribution Days, Cross-Liquidation & Afternoon Force-Sell risk', () => {
    const distCandles = buildDailyCandles(26, 32.0, -0.35, 1.45);
    const lastPrice = distCandles[distCandles.length - 1].close;

    const hpgSym: MarketSymbol = {
      symbol: 'HPG',
      name: 'Hoa Phat Group',
      type: 'vn30',
      baseAsset: 'HPG',
      quoteAsset: 'VND',
      price: lastPrice,
      change24h: -5.2,
      high24h: lastPrice * 1.04,
      low24h: lastPrice * 0.995,
      volume24h: 38_000_000,
    };

    const mockMarket: MarketSymbol[] = [
      hpgSym,
      {
        symbol: 'SSI',
        name: 'SSI Securities',
        type: 'vn30',
        baseAsset: 'SSI',
        quoteAsset: 'VND',
        price: 31.0,
        change24h: -6.7, // Near floor
        high24h: 33.2,
        low24h: 31.0,
        volume24h: 25_000_000,
      },
      {
        symbol: 'DIG',
        name: 'DIC Corp',
        type: 'vn30',
        baseAsset: 'DIG',
        quoteAsset: 'VND',
        price: 20.5,
        change24h: -6.9, // Floor locked
        high24h: 22.0,
        low24h: 20.5,
        volume24h: 15_000_000,
      },
      {
        symbol: 'VN30',
        name: 'VN30 Index',
        type: 'index',
        baseAsset: 'VN30',
        quoteAsset: 'VND',
        price: 1310,
        change24h: -2.8,
        high24h: 1345,
        low24h: 1308,
        volume24h: 250_000_000,
      },
      {
        symbol: 'VN30F1M',
        name: 'VN30 Futures',
        type: 'vn30',
        baseAsset: 'VN30F1M',
        quoteAsset: 'VND',
        price: 1298, // -12 pts deep discount basis
        change24h: -3.5,
        high24h: 1340,
        low24h: 1295,
        volume24h: 320_000,
      },
    ];

    // 14:00 GMT+7 on a Wednesday (07:00 UTC)
    const forceSellClock = new Date('2026-11-04T07:00:00Z');
    const radar = evaluateVnPanicAndForceSellRadar({
      symbolObj: hpgSym,
      candles: distCandles,
      allSymbols: mockMarket,
      now: forceSellClock,
    });

    expect(radar.distributionDays25d).toBeGreaterThanOrEqual(4);
    expect(radar.isInAfternoonForceSellWindow).toBe(true);
    expect(radar.crossLiquidationWarning).toBe(true);
    expect(radar.forceSellProbabilityPct).toBeGreaterThanOrEqual(70);
    expect(['ACTIVE_FORCE_SELL_WAVE', 'HIGH_SELLOFF_RISK']).toContain(radar.selloffRiskLevel);
  });

  it('Engine 2: computes 3-Rung Bottom-Fishing Limit Ladder (20/30/50) with 100-share lots & Floor-Lock vs Floor-Rescue', () => {
    const candles = buildDailyCandles(25, 136, -0.4, 1.1);
    // Make last bar a strong Floor-Rescue hammer (touched floor, closed high with 2.4x volume)
    const prevClose = candles[candles.length - 2].close;
    const floorPx = Number((prevClose * 0.93).toFixed(1));
    candles[candles.length - 1] = {
      time: candles[candles.length - 1].time,
      open: Number((prevClose * 0.95).toFixed(1)),
      high: Number((prevClose * 0.985).toFixed(1)),
      low: floorPx,
      close: Number((prevClose * 0.978).toFixed(1)),
      volume: 6_500_000,
    };

    const fptSym: MarketSymbol = {
      symbol: 'FPT',
      name: 'FPT Corp',
      type: 'vn30',
      baseAsset: 'FPT',
      quoteAsset: 'VND',
      price: candles[candles.length - 1].close,
      change24h: -2.2,
      high24h: candles[candles.length - 1].high,
      low24h: floorPx,
      volume24h: 6_500_000,
    };

    const ladder = computeVnBottomFishingLadder({
      symbolObj: fptSym,
      candles,
      budgetMillionVnd: 200,
    });

    expect(ladder.floorAbsorptionState).toBe('FLOOR_RESCUE_ABSORPTION');
    expect(ladder.rungs).toHaveLength(3);
    expect(ladder.rungs[0].weightPct).toBe(20);
    expect(ladder.rungs[1].weightPct).toBe(30);
    expect(ladder.rungs[2].weightPct).toBe(50);
    // All share quantities must be multiples of 100 (HOSE board lot)
    expect(ladder.rungs[0].recommendedShares % 100).toBe(0);
    expect(ladder.rungs[1].recommendedShares % 100).toBe(0);
    expect(ladder.rungs[2].recommendedShares % 100).toBe(0);
    expect(ladder.rungs[1].limitPrice).toBeLessThanOrEqual(ladder.rungs[0].limitPrice);
    // Rung 3 must be unlocked because Floor Rescue Absorption occurred
    expect(ladder.rungs[2].status).toBe('UNLOCKED_RESCUE_CONFIRMED');
    expect(ladder.t2StressTest.expectedReboundGainPct).toBeGreaterThan(0);
  });

  it('Engine 3 & 4: detects T+2.5 Afternoon Profit-Taking Supply Shock (13:00) & Artificial ATC Markup (14:30)', () => {
    const candles = buildDailyCandles(20, 50.0, 0.2, 1.0);
    // Make T-2 bar (length - 3) a massive bottom-fishing volume spike at lower price 47.0k
    const t2Idx = candles.length - 3;
    candles[t2Idx] = {
      ...candles[t2Idx],
      open: 46.5,
      high: 48.0,
      low: 46.0,
      close: 47.5,
      volume: 5_200_000, // ~2.4x average
    };
    // Current price is 52.5k (+11.7% profit for T-2 buyers!)
    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      open: 51.0,
      high: 52.5,
      low: 50.0,
      close: 52.5,
      volume: 1_200_000,
    };

    const ssiSym: MarketSymbol = {
      symbol: 'SSI',
      name: 'SSI Securities',
      type: 'vn30',
      baseAsset: 'SSI',
      quoteAsset: 'VND',
      price: 52.5,
      change24h: 2.8,
      high24h: 52.5,
      low24h: 50.0,
      volume24h: 1_200_000,
    };

    const t2Shock = evaluateVnT2CohortSupplyShock({
      symbolObj: ssiSym,
      candles,
      now: new Date('2026-11-04T06:15:00Z'), // 13:15 GMT+7
    });

    expect(t2Shock.isUnlockedInCurrentSession).toBe(true);
    expect(t2Shock.volumeVsAvgRatio).toBeGreaterThan(1.5);
    expect(t2Shock.cohortFloatingPnlPct).toBeGreaterThan(5);
    expect(t2Shock.supplyShockRegime).toBe('HIGH_PROFIT_TAKING_13H');

    // Test ATC Artificial Markup when close (52.5) is pulled well above session VWAP (50.2) on low late volume
    const atcShield = evaluateVnAtcDistortionShield({
      symbolObj: ssiSym,
      candles,
      vnInsights: {
        ok: true,
        symbol: 'SSI',
        fetchedAtMs: Date.now(),
        sourcesUsed: ['VNDirect'],
        foreignFlow: null,
        marketLeaders: { tradingDate: '2026-11-04', topBuy: [], topSell: [] },
        fundamentals: null,
        corporateEvents: [],
        marketPutThroughLeaders: [],
        liquidityAndPt: {
          symbol: 'SSI',
          latestDate: '2026-11-04',
          floor: 'HOSE',
          nmVolume: 12_000_000,
          nmValueBillionVnd: 602,
          ptVolume: 0,
          ptValueBillionVnd: 0,
          ptSharePct: 0,
          total5dPtBillionVnd: 0,
          vwapPrice: 50.2,
          officialRefPrice: 51.0,
          officialCeilingPrice: 54.5,
          officialFloorPrice: 47.45,
        },
      },
      now: new Date('2026-11-04T07:40:00Z'), // 14:40 GMT+7 (ATC)
    });

    expect(atcShield.gapVsVwapPct).toBeGreaterThan(3.0);
    expect(atcShield.distortionType).toBe('ARTIFICIAL_ATC_MARKUP');
  });

  it('Engine 5 & 6: tracks Post-Crash Follow-Through Day (FTD) and computes VN30F1M Beta Hedge for locked T+2.5 holdings', () => {
    const candles = buildDailyCandles(15, 65.0, -0.5, 1.0);
    // Swing low at index 8 (7 days ago -> Day 7 of rally attempt)
    candles[8] = {
      ...candles[8],
      open: 58.0,
      high: 58.5,
      low: 55.0,
      close: 56.2,
      volume: 3_000_000,
    };
    for (let i = 9; i < candles.length - 1; i++) {
      candles[i] = {
        ...candles[i],
        open: 56.5 + (i - 8) * 0.3,
        high: 57.2 + (i - 8) * 0.3,
        low: 56.0 + (i - 8) * 0.3,
        close: 56.8 + (i - 8) * 0.3,
        volume: 2_100_000,
      };
    }
    // Today (Day 7 of rally attempt): explosive +3.2% gain on 4.2M volume (> prev & > avg20) -> FTD!
    const prevClose = candles[candles.length - 2].close;
    const ftdClose = Number((prevClose * 1.032).toFixed(2));
    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      open: prevClose,
      high: Number((ftdClose * 1.005).toFixed(2)),
      low: Number((prevClose * 0.995).toFixed(2)),
      close: ftdClose,
      volume: 4_200_000,
    };

    const mbbSym: MarketSymbol = {
      symbol: 'MBB',
      name: 'MB Bank',
      type: 'vn30',
      baseAsset: 'MBB',
      quoteAsset: 'VND',
      price: ftdClose,
      change24h: 3.2,
      high24h: ftdClose * 1.005,
      low24h: prevClose * 0.995,
      volume24h: 4_200_000,
    };

    const vn30fSym: MarketSymbol = {
      symbol: 'VN30F1M',
      name: 'VN30 Futures',
      type: 'vn30',
      baseAsset: 'VN30F1M',
      quoteAsset: 'VND',
      price: 1320,
      change24h: 1.5,
      high24h: 1325,
      low24h: 1300,
      volume24h: 210_000,
    };

    const holdingsMap: Record<string, UserHoldingItem> = {
      MBB: {
        symbol: 'MBB',
        quantity: 10_000, // ~580 Tr VND
        avgCostPrice: 60.0,
        marginRatioPct: 20,
        holdingDays: 1, // Locked in T+1!
        extraDcaBudget: null,
        updatedAtMs: Date.now(),
      },
    };

    const report = evaluateVnComprehensiveTacticalReport({
      symbolObj: mbbSym,
      candles,
      allSymbols: [mbbSym, vn30fSym],
      userHoldingsMap: holdingsMap,
    });

    expect(report.postCrashAndHedge.ftdState).toBe('FTD_CONFIRMED_BUY_SIGNAL');
    expect(report.postCrashAndHedge.betaHedgePlan.hasVnEquityExposure).toBe(true);
    expect(report.postCrashAndHedge.betaHedgePlan.lockedT2EquityValueMillionVnd).toBeGreaterThan(
      500
    );
    expect(
      report.postCrashAndHedge.betaHedgePlan.recommendedShortContractsFullHedge
    ).toBeGreaterThanOrEqual(4);
    expect(report.capitulationMeter.washoutCompletionScore).toBeGreaterThan(0);
  });
});
