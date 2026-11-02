import { describe, expect, it } from 'vitest';
import { Candle, MarketSymbol } from '../../../types';
import { evaluateCryptoSpotDailyCashEngine } from '../cryptoSpotDailyCashEngine';

function createCryptoCandles(count = 40, startPrice = 85000, step = 120): Candle[] {
  const out: Candle[] = [];
  let p = startPrice;
  for (let i = 0; i < count; i++) {
    const wave = Math.sin(i * 0.5) * 350;
    const open = Number((p + wave * 0.2).toFixed(2));
    const close = Number((p + step + wave * 0.6).toFixed(2));
    const high = Number((Math.max(open, close) + 280).toFixed(2));
    const low = Number((Math.min(open, close) - 320).toFixed(2));
    out.push({
      time: 1700000000 + i * 3600,
      open,
      high,
      low,
      close,
      volume: 1200 + (i % 5) * 300,
    });
    p += step * 0.4;
  }
  return out;
}

const btcSym: MarketSymbol = {
  symbol: 'BTCUSDT',
  name: 'Bitcoin',
  price: 88500,
  change24h: 1.5,
  high24h: 89400,
  low24h: 86800,
  volume24h: 35000,
  type: 'crypto',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
};

const solSym: MarketSymbol = {
  symbol: 'SOLUSDT',
  name: 'Solana',
  price: 192.5,
  change24h: 5.4,
  high24h: 196.0,
  low24h: 181.2,
  volume24h: 4200000,
  type: 'crypto',
  baseAsset: 'SOL',
  quoteAsset: 'USDT',
};

const ethWeakSym: MarketSymbol = {
  symbol: 'ETHUSDT',
  name: 'Ethereum',
  price: 2950,
  change24h: -1.8,
  high24h: 3040,
  low24h: 2910,
  volume24h: 450000,
  type: 'crypto',
  baseAsset: 'ETH',
  quoteAsset: 'USDT',
};

describe('Zero-Leverage Crypto Spot Daily Cash 6-Engine Suite', () => {
  it('computes 3-tranche Liquidation Wick Sniper, T+0 Compounding & Free Coin Bag, and 3-Bucket USDT Treasury', () => {
    const candles = createCryptoCandles(45, 175, 0.35);
    const report = evaluateCryptoSpotDailyCashEngine({
      currentSymbol: solSym,
      candles,
      symbols: [btcSym, solSym, ethWeakSym],
      totalCapitalUsdt: 10000,
      nowMs: Date.UTC(2026, 10, 2, 14, 0, 0), // 21:00 VN time -> NY_ETF_SPOT_POWER
    });

    expect(report.symbol).toBe('SOLUSDT');
    // Engine 1: Wick Sniper
    expect(report.wickSniper.tranches.length).toBe(3);
    expect(report.wickSniper.tranches[0].limitPrice).toBeLessThan(report.spotPrice);
    expect(report.wickSniper.tranches[1].limitPrice).toBeLessThan(
      report.wickSniper.tranches[0].limitPrice
    );
    expect(report.wickSniper.tranches[2].limitPrice).toBeLessThan(
      report.wickSniper.tranches[1].limitPrice
    );
    expect(report.wickSniper.roundTripSpotFeePct).toBe(0.2);
    expect(report.wickSniper.netBounceProfitPct).toBeGreaterThan(0);

    // Engine 2: T+0 Compounding & Free Coin Bag
    expect(report.t0Compounding.intradayRallySellPrice).toBeGreaterThan(
      report.t0Compounding.intradayDipBuyPrice
    );
    expect(report.t0Compounding.freeCoinBagPlan.sellPctToRecoverPrincipal).toBeLessThan(100);
    expect(report.t0Compounding.freeCoinBagPlan.freeCoinsRetainedPct).toBeGreaterThan(3);

    // Engine 3: Session Killzone (21:00 VN = NY_ETF_SPOT_POWER)
    expect(report.sessionKillzone.activeSession).toBe('NY_ETF_SPOT_POWER');

    // Engine 5: Altcoin vs BTC RS (SOL +5.4% vs BTC +1.5% -> OUTPERFORMING_BTC_LEADER)
    expect(report.altBtcStrength.rsSpreadVsBtcPct).toBeCloseTo(3.9, 1);
    expect(report.altBtcStrength.rsRegime).toBe('OUTPERFORMING_BTC_LEADER');
    expect(report.altBtcStrength.topAlphaLeaderSymbol).toBe('SOLUSDT');

    // Engine 6: 3-Bucket USDT Treasury ($10,000 -> $4,000 / $3,500 / $2,500)
    expect(report.usdtTreasury.totalCapitalUsdt).toBe(10000);
    expect(report.usdtTreasury.buckets[0].allocatedUsdt).toBe(4000);
    expect(report.usdtTreasury.buckets[1].allocatedUsdt).toBe(3500);
    expect(report.usdtTreasury.buckets[2].allocatedUsdt).toBe(2500);
  });

  it('detects SHORT_SQUEEZE_FUEL when funding is negative and buyer absorption is strong, and LEVERAGE_FROTH_TRAP when funding is overheated', () => {
    const candles = createCryptoCandles(40, 86000, 80);
    // Force strong green closes near highs on last 5 bars
    for (let i = candles.length - 5; i < candles.length; i++) {
      candles[i].low = candles[i].open - 400;
      candles[i].close = candles[i].high - 10;
    }

    const squeezeReport = evaluateCryptoSpotDailyCashEngine({
      currentSymbol: btcSym,
      candles,
      symbols: [btcSym, solSym],
      perpCarry: {
        perpSymbol: 'BTCUSDT',
        markPrice: 88420,
        indexPrice: 88500,
        fundingRate8hPct: -0.012,
        annualizedFundingPct: -13.1,
        perpSpotBasisPct: -0.09,
        nextFundingTimeMs: Date.now() + 3600_000,
      },
    });

    expect(squeezeReport.spotPurityShield.regime).toBe('SHORT_SQUEEZE_FUEL');
    expect(squeezeReport.spotPurityShield.isLeverageFrothVeto).toBe(false);
    expect(squeezeReport.dailyPlaybookState).toBe('RIDE_SPOT_BREAKOUT_SQUEEZE');

    const frothReport = evaluateCryptoSpotDailyCashEngine({
      currentSymbol: ethWeakSym,
      candles,
      symbols: [btcSym, solSym, ethWeakSym],
      perpCarry: {
        perpSymbol: 'ETHUSDT',
        markPrice: 2965,
        indexPrice: 2950,
        fundingRate8hPct: 0.045,
        annualizedFundingPct: 49.2,
        perpSpotBasisPct: 0.51,
        nextFundingTimeMs: Date.now() + 3600_000,
      },
    });

    expect(frothReport.spotPurityShield.regime).toBe('LEVERAGE_FROTH_TRAP');
    expect(frothReport.spotPurityShield.isLeverageFrothVeto).toBe(true);
    expect(frothReport.dailyPlaybookState).toBe('DEFENSIVE_HOLD_USDT_PAXG');
    expect(frothReport.altBtcStrength.rsRegime).toBe('BLEEDING_VS_BTC_AVOID');
  });
});
