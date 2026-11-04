import { describe, expect, it } from 'vitest';
import { Candle, MarketSymbol } from '../../../types';
import {
  buildSpotProUpgradeSuite,
  calculateSmartDynamicDca,
  calculateSpotCashAndLotAllocation,
  evaluateSpotRelativeStrength,
} from '../spotProUpgradeEngine';

function makeCandles(basePrice: number, count = 60, stepPct = 0.002): Candle[] {
  const out: Candle[] = [];
  let p = basePrice;
  const now = 1_730_000_000;
  for (let i = 0; i < count; i++) {
    p = Number((p * (1 + stepPct)).toFixed(4));
    out.push({
      time: now + i * 3600,
      open: p * 0.996,
      high: p * 1.008,
      low: p * 0.992,
      close: p,
      volume: 1500 + i * 25,
    });
  }
  return out;
}

describe('spotProUpgradeEngine (5-Engine Pro Spot Suite for Coin & VN Stock)', () => {
  const vnStockFpt: MarketSymbol = {
    symbol: 'FPT',
    name: 'FPT Corp (HOSE)',
    baseAsset: 'FPT',
    quoteAsset: 'VND',
    type: 'stock',
    price: 135.4,
    change24h: 2.8,
    high24h: 136.5,
    low24h: 132.0,
    volume24h: 4_500_000,
  };

  const vnIndex: MarketSymbol = {
    symbol: 'VNINDEX',
    name: 'VN-Index',
    baseAsset: 'VNINDEX',
    quoteAsset: 'VND',
    type: 'index',
    price: 1265.0,
    change24h: 0.5,
    high24h: 1270.0,
    low24h: 1258.0,
    volume24h: 650_000_000,
  };

  const btcSpot: MarketSymbol = {
    symbol: 'BTCUSDT',
    name: 'Bitcoin / Tether',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    type: 'crypto',
    price: 92500,
    change24h: 1.4,
    high24h: 93200,
    low24h: 90800,
    volume24h: 1_200_000_000,
  };

  const solSpot: MarketSymbol = {
    symbol: 'SOLUSDT',
    name: 'Solana / Tether',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    type: 'crypto',
    price: 195.5,
    change24h: 4.6,
    high24h: 198.0,
    low24h: 185.0,
    volume24h: 650_000_000,
  };

  it('rounds VN Stock tranches to exact HOSE 100-share board lots and computes 0.40% fee+tax breakeven', () => {
    const candles = makeCandles(128, 60, 0.001);
    const report = calculateSpotCashAndLotAllocation({
      symbolObj: vnStockFpt,
      candles,
      capitalAmount: 150_000_000, // 150 triệu VNĐ
    });

    expect(report.marketType).toBe('VN_STOCK');
    expect(report.currencyUnit).toBe('VNĐ');
    expect(report.roundTripFeeAndTaxPct).toBe(0.4);
    expect(report.tranches).toHaveLength(3);
    for (const tr of report.tranches) {
      expect(tr.quantity % 100).toBe(0);
    }
    expect(report.totalQuantity % 100).toBe(0);
    expect(report.allInBreakevenPrice).toBeGreaterThan(report.weightedAvgEntryPrice);
  });

  it('identifies RS Leader when symbol outperforms benchmark (SOLUSDT vs BTCUSDT & FPT vs VNINDEX)', () => {
    const solCandles = makeCandles(180, 60, 0.0025);
    const rsCoin = evaluateSpotRelativeStrength({
      symbolObj: solSpot,
      candles: solCandles,
      allSymbols: [btcSpot, solSpot],
    });
    expect(rsCoin.benchmarkSymbol).toBe('BTCUSDT');
    expect(rsCoin.rsSpread24hPct).toBeGreaterThan(2);
    expect(rsCoin.rsTier).toBe('LEADER');

    const fptCandles = makeCandles(130, 60, 0.002);
    const rsVn = evaluateSpotRelativeStrength({
      symbolObj: vnStockFpt,
      candles: fptCandles,
      allSymbols: [vnIndex, vnStockFpt],
    });
    expect(rsVn.benchmarkSymbol).toBe('VNINDEX');
    expect(rsVn.rsTier).toBe('LEADER');
  });

  it('builds complete 5-engine Spot Pro Upgrade Suite including 40/40/20 Free-Ride scale-out, Circuit Breaker, and Smart DCA', () => {
    const candles = makeCandles(90000, 60, 0.001);
    const suite = buildSpotProUpgradeSuite({
      symbolObj: btcSpot,
      candles,
      allSymbols: [btcSpot, solSpot],
      capitalAmount: 5_000,
    });

    expect(suite.marketType).toBe('CRYPTO_COIN');
    expect(suite.cashAndLotAllocation.inputCapital).toBe(5_000);
    expect(suite.scaleOutAndFreeRide.steps).toHaveLength(3);
    expect(suite.scaleOutAndFreeRide.freeRideStopPrice).toBeGreaterThan(
      suite.cashAndLotAllocation.weightedAvgEntryPrice
    );
    expect(suite.cashCircuitBreaker.capitulationCatchLowPrice).toBeLessThan(
      suite.cashCircuitBreaker.capitulationCatchHighPrice
    );
    expect([0, 0.5, 1, 1.5, 2]).toContain(suite.smartDynamicDca.multiplier);

    // Oversold / pullback candles should trigger >= 1.5x Smart DCA multiplier
    const pullbackCandles = makeCandles(95000, 60, -0.0045);
    const dcaDeep = calculateSmartDynamicDca({
      symbolObj: btcSpot,
      candles: pullbackCandles,
      allocation: suite.cashAndLotAllocation,
    });
    expect(dcaDeep.multiplier).toBeGreaterThanOrEqual(1.5);
  });
});
