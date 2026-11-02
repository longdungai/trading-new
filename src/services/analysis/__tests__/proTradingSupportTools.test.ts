import { beforeEach, describe, expect, it } from 'vitest';
import { Candle, MarketSymbol } from '../../../types';
import {
  clearClosedTradeJournal,
  computeTradeJournalAnalytics,
  deleteClosedTradeEntry,
  loadClosedTradeJournal,
  recordClosedTradeEntry,
} from '../../portfolio/tradeJournalEngine';
import { saveUserHolding, loadUserHoldings } from '../../portfolio/holdingsRecoveryEngine';
import { scanDivergenceAndCandlestickPatterns } from '../divergenceAndPatternScanner';
import {
  computeQuickIntrinsicValuation,
  computeSectorRotationRrgMatrix,
  evaluatePreTradeChecklistAndGameplan,
} from '../preTradeChecklistAndSectorRrg';
import {
  createNewUserProfile,
  exportFullWorkspaceBackupJson,
  importFullWorkspaceBackupJson,
  loadActiveUserProfile,
  loadAllUserProfiles,
} from '../../storage/userProfileManager';

function createSyntheticCandles(count = 45, basePrice = 95, trendStep = 0.4): Candle[] {
  const candles: Candle[] = [];
  let price = basePrice;
  for (let i = 0; i < count; i++) {
    const wave = Math.sin(i * 0.45) * 1.2;
    const open = Number((price + wave * 0.3).toFixed(2));
    const close = Number((price + trendStep + wave).toFixed(2));
    const high = Number((Math.max(open, close) + 1.1).toFixed(2));
    const low = Number((Math.min(open, close) - 0.9).toFixed(2));
    candles.push({
      time: 1700000000 + i * 86400,
      open,
      high,
      low,
      close,
      volume: 1_500_000 + (i % 5) * 250_000,
    });
    price += trendStep * 0.5;
  }
  return candles;
}

const fptSymbol: MarketSymbol = {
  symbol: 'FPT',
  name: 'FPT Corp',
  price: 132.5,
  change24h: 2.4,
  high24h: 134.0,
  low24h: 129.8,
  volume24h: 4_800_000,
  type: 'stock',
  baseAsset: 'FPT',
  quoteAsset: 'VND',
};

const btcSymbol: MarketSymbol = {
  symbol: 'BTCUSDT',
  name: 'Bitcoin',
  price: 88500,
  change24h: 1.8,
  high24h: 89400,
  low24h: 86800,
  volume24h: 32000,
  type: 'crypto',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
};

describe('6 Pro Trading Support Tools Suite', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const mockStorage: Storage = {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.has(key) ? (store.get(key) as string) : null;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(key, String(value));
      },
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: mockStorage,
        dispatchEvent: () => true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
      configurable: true,
      writable: true,
    });
  });

  it('Tool 1: records closed trades, deducts active holdings, and computes Win Rate, Profit Factor & Equity Curve', () => {
    clearClosedTradeJournal();
    saveUserHolding(
      {
        symbol: 'FPT',
        quantity: 2000,
        avgCostPrice: 120,
        marginRatioPct: 0,
        holdingDays: 4,
        extraDcaBudget: null,
      },
      132.5
    );

    // Close 1,000 shares of FPT at 132.0 (partial close)
    const entry1 = recordClosedTradeEntry({
      symbol: 'FPT',
      symbolObj: fptSymbol,
      quantityClosed: 1000,
      entryPrice: 120,
      exitPrice: 132,
      holdingDays: 4,
      exitReason: 'TAKE_PROFIT_T2',
      deductFromOpenHolding: true,
    });

    expect(entry1.symbol).toBe('FPT');
    expect(entry1.feeAndTaxPct).toBeCloseTo(0.45, 2);
    expect(entry1.netRealizedPnlPct).toBeGreaterThan(9.0);
    expect(entry1.netRealizedCashValue).toBeGreaterThan(10); // > 10 Million VND net profit

    // Remaining active holding should be 1,000 shares
    const remainingHolding = loadUserHoldings()['FPT'];
    expect(remainingHolding).toBeDefined();
    expect(remainingHolding.quantity).toBe(1000);

    // Record a second losing trade to test Profit Factor & Win Rate
    recordClosedTradeEntry({
      symbol: 'FPT',
      symbolObj: fptSymbol,
      quantityClosed: 1000,
      entryPrice: 130,
      exitPrice: 126,
      holdingDays: 3,
      exitReason: 'STOP_LOSS_DISCIPLINE',
      deductFromOpenHolding: true,
    });

    // Now active holding should be completely removed (0 left)
    expect(loadUserHoldings()['FPT']).toBeUndefined();

    const analytics = computeTradeJournalAnalytics();
    expect(analytics.totalClosedTrades).toBe(2);
    expect(analytics.winCount).toBe(1);
    expect(analytics.lossCount).toBe(1);
    expect(analytics.winRatePct).toBe(50);
    expect(analytics.profitFactor).toBeGreaterThan(1.5);
    expect(analytics.equityCurveVndPoints.length).toBe(3);

    // Delete first entry
    const afterDelete = deleteClosedTradeEntry(entry1.id);
    expect(afterDelete.length).toBe(1);
  });

  it('Tool 2: scans RSI/MACD divergences and volume-confirmed candlestick patterns', () => {
    const candles = createSyntheticCandles(45, 90, 0.35);
    // Craft a high-volume Bullish Pinbar (Hammer) on the last bar
    const prev = candles[candles.length - 2];
    candles[candles.length - 1] = {
      time: prev.time + 86400,
      open: prev.close,
      high: prev.close + 0.4,
      low: prev.close - 4.5, // Long lower tail
      close: prev.close + 0.3,
      volume: 3_600_000, // High RVOL
    };

    const scanResult = scanDivergenceAndCandlestickPatterns(candles);
    expect(scanResult).toBeDefined();
    expect(scanResult.candlestickPatterns.length).toBeGreaterThan(0);
    expect(
      scanResult.candlestickPatterns.some((p) => p.code === 'BULLISH_PINBAR_REJECTION')
    ).toBe(true);
    expect(scanResult.summaryVi.length).toBeGreaterThan(10);
  });

  it('Tool 3: evaluates 5-Criteria Pre-Trade Discipline Checklist & Morning Gameplan', () => {
    const candles = createSyntheticCandles(55, 110, 0.45);
    const report = evaluatePreTradeChecklistAndGameplan({
      currentSymbol: fptSymbol,
      candles,
      symbols: [fptSymbol, btcSymbol],
      plannedEntry: 130,
      plannedStopLoss: 124,
      plannedTakeProfit: 145,
    });

    expect(report.symbol).toBe('FPT');
    expect(report.criteria.length).toBe(5);
    expect(report.roundTripFeeTaxPct).toBe(0.45);
    expect(report.netRewardRiskRatio).toBeGreaterThan(1.8);
    expect(report.readinessScore).toBeGreaterThanOrEqual(0);
    expect(report.readinessScore).toBeLessThanOrEqual(100);
    expect(report.morningGameplan.primarySessionDirectiveVi.length).toBeGreaterThan(10);
  });

  it('Tool 4: computes 4-Quadrant Sector Rotation RRG Matrix', () => {
    const symbolsList: MarketSymbol[] = [
      fptSymbol,
      { ...fptSymbol, symbol: 'MWG', price: 68, change24h: 3.1 },
      { ...fptSymbol, symbol: 'SSI', price: 36, change24h: 1.9 },
      { ...fptSymbol, symbol: 'VCB', price: 92, change24h: -0.4 },
      { ...fptSymbol, symbol: 'HPG', price: 29.5, change24h: 1.2 },
      { ...fptSymbol, symbol: 'VNINDEX', price: 1285, change24h: 0.65 },
      btcSymbol,
    ];
    const candles = createSyntheticCandles(30, 120, 0.4);
    const rrg = computeSectorRotationRrgMatrix({
      currentSymbol: fptSymbol,
      symbols: symbolsList,
      candles,
    });

    expect(rrg.benchmarkSymbol).toBe('VNINDEX');
    expect(rrg.sectors.length).toBeGreaterThanOrEqual(6);
    expect(rrg.currentSymbolSector).not.toBeNull();
    expect(rrg.currentSymbolSector?.containsCurrentSymbol).toBe(true);
    expect(['LEADING', 'IMPROVING', 'WEAKENING', 'LAGGING']).toContain(
      rrg.currentSymbolSector?.quadrant
    );
  });

  it('Tool 5: computes Quick Intrinsic Fair Value & Margin of Safety for both Equities and Crypto', () => {
    const candles = createSyntheticCandles(65, 115, 0.25);
    const vnVal = computeQuickIntrinsicValuation({
      currentSymbol: fptSymbol,
      candles,
      fundamentals: {
        symbol: 'FPT',
        companyNameVi: 'FPT',
        industryName: 'Công nghệ',
        exchange: 'HOSE',
        peRatio: 11.2,
        pbRatio: 1.6,
        roePct: 22.5,
        roaPct: 10.2,
        epsVnd: 6500,
        marketCapTrillionVnd: 165,
        dividendYieldPct: 2.5,
        revenueGrowthQoqPct: 19.5,
        netIncomeGrowthQoqPct: 21.0,
        officialRefPrice: 130,
        officialCeilingPrice: 139.1,
        officialFloorPrice: 120.9,
        avgVolume10d: 4500000,
        source: 'test',
      },
    });

    expect(vnVal.isEquityFundamentalMode).toBe(true);
    expect(vnVal.fairValuePrice).toBeGreaterThan(0);
    expect(vnVal.safeBuyZonePrice).toBeLessThan(vnVal.fairValuePrice);
    expect(['A+', 'A', 'B', 'C', 'D']).toContain(vnVal.fundamentalGrade);

    const cryptoVal = computeQuickIntrinsicValuation({
      currentSymbol: btcSymbol,
      candles: createSyntheticCandles(65, 84000, 50),
    });
    expect(cryptoVal.isEquityFundamentalMode).toBe(false);
    expect(cryptoVal.fairValuePrice).toBeGreaterThan(0);
  });

  it('Tool 6: exports and restores full workspace JSON backup (profiles + starred symbols + trade journal)', () => {
    createNewUserProfile({
      name: 'Pro VN Trader',
      avatarColor: 'emerald',
      presetType: 'vn_spot_pro',
    });

    recordClosedTradeEntry({
      symbol: 'FPT',
      symbolObj: fptSymbol,
      quantityClosed: 500,
      entryPrice: 120,
      exitPrice: 131,
      holdingDays: 3,
      exitReason: 'TAKE_PROFIT_T2',
      deductFromOpenHolding: false,
    });

    const jsonBackup = exportFullWorkspaceBackupJson();
    expect(jsonBackup).toContain('Pro VN Trader');
    expect(jsonBackup).toContain('closedTradeJournal');

    // Clear storage and restore from JSON backup
    globalThis.localStorage.clear();
    const importRes = importFullWorkspaceBackupJson(jsonBackup);

    expect(importRes.ok).toBe(true);
    expect(importRes.restoredProfilesCount).toBeGreaterThanOrEqual(2);
    expect(importRes.restoredJournalCount).toBe(1);
    expect(loadActiveUserProfile().name).toBe('Pro VN Trader');
    expect(loadAllUserProfiles().length).toBeGreaterThanOrEqual(2);
    expect(loadClosedTradeJournal().length).toBe(1);
  });
});
