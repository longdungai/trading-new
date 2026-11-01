import { describe, expect, it } from 'vitest';
import { Candle, MarketSymbol } from '../../../types';
import {
  VN_SECTOR_DEFINITIONS,
  computeVn30BasisAnalytics,
  computeVnIntradaySessionPulse,
  computeVnPositionSizing,
  computeVnPriceLimits,
  computeVnSectorRotation,
  getNextVn30f1mExpiryDate,
  getVnExchangeBoard,
  getVnStockSectorInfo,
  getVnTickSize,
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
  roundToVnTickSize,
} from '../vnStockMicrostructure';
import { DEFAULT_SYMBOLS } from '../../api/marketData';
import { GLOBAL_SYMBOL_CATALOG } from '../../api/symbolCatalog';
import { getMarketSessionInfo, isVietnamMarketSymbol } from '../../../utils/marketHours';
import { analyzeAccumulationZone } from '../../ai/accumulationScanner';
import {
  computeVnActiveOrderFlow,
  computeVnNetPaperPnl,
  computeVnSbvFxPressure,
  computeVnT2SettlementState,
  scanVnMomentumBreakouts,
} from '../vnExecutionEngines';
import { evaluateAlertRulesPure, SmartAlertRule } from '../../alerts/smartAlertCenter';

describe('Vietnam Stock & Derivatives Institutional Upgrades (6 Pillars)', () => {
  it('1. classifies HOSE, HNX, UPCOM, INDEX, and VN30F1M Derivative boards accurately', () => {
    expect(isVnDerivativeSymbol('VN30F1M')).toBe(true);
    expect(isVnDerivativeSymbol('VN30')).toBe(false);
    expect(isVnStockOrIndexSymbol('VN30F1M')).toBe(true);
    expect(isVnStockOrIndexSymbol('FPT')).toBe(true);
    expect(isVnStockOrIndexSymbol('PVS')).toBe(true);
    expect(isVnStockOrIndexSymbol('ACV')).toBe(true);
    expect(isVnStockOrIndexSymbol('NVDA')).toBe(false);

    expect(getVnExchangeBoard('FPT')).toBe('HOSE');
    expect(getVnExchangeBoard('PVS')).toBe('HNX');
    expect(getVnExchangeBoard('SHS')).toBe('HNX');
    expect(getVnExchangeBoard('ACV')).toBe('UPCOM');
    expect(getVnExchangeBoard('VN30F1M')).toBe('HNX_DERIVATIVE');
    expect(getVnExchangeBoard('VNINDEX')).toBe('INDEX');
  });

  it('2. enforces official HOSE tiered ticks (10đ / 50đ / 100đ), HNX/UPCOM 100đ, and VN30F1M 0.1pt', () => {
    expect(getVnTickSize(8.42, 'HOSE')).toBe(0.01);
    expect(getVnTickSize(26.83, 'HOSE')).toBe(0.05);
    expect(getVnTickSize(72.24, 'HOSE')).toBe(0.1);
    expect(getVnTickSize(22.43, 'HNX')).toBe(0.1);
    expect(getVnTickSize(112.56, 'UPCOM')).toBe(0.1);
    expect(getVnTickSize(1892.34, 'HNX_DERIVATIVE')).toBe(0.1);

    expect(roundToVnTickSize(8.426, 'HOSE')).toBe(8.43);
    expect(roundToVnTickSize(26.83, 'HPG')).toBe(26.85);
    expect(roundToVnTickSize(72.24, 'FPT')).toBe(72.2);
    expect(roundToVnTickSize(38.44, 'PVS')).toBe(38.4);
    expect(roundToVnTickSize(1892.36, 'VN30F1M')).toBe(1892.4);
  });

  it('3. computes exact Ceiling / Reference / Floor across HOSE cross-tier boundary & T+2 floor-lock warnings', () => {
    // Classic HOSE cross-boundary test: Ref 52.70 -> Ceiling raw 56.389 (tick 0.10 => 56.30), Floor raw 49.011 (tick 0.05 => 49.05)
    const fptLimits = computeVnPriceLimits({
      symbol: 'FPT',
      currentPrice: 49.05,
      officialRefPrice: 52.7,
    });
    expect(fptLimits.board).toBe('HOSE');
    expect(fptLimits.bandPct).toBe(7);
    expect(fptLimits.ceilingPrice).toBe(56.3);
    expect(fptLimits.floorPrice).toBe(49.05);
    expect(fptLimits.colorState).toBe('FLOOR');
    expect(fptLimits.liquidityWarning).toContain('T+2');

    // HNX ±10%
    const pvsLimits = computeVnPriceLimits({
      symbol: 'PVS',
      currentPrice: 44.0,
      officialRefPrice: 40.0,
    });
    expect(pvsLimits.bandPct).toBe(10);
    expect(pvsLimits.ceilingPrice).toBe(44.0);
    expect(pvsLimits.floorPrice).toBe(36.0);
    expect(pvsLimits.colorState).toBe('CEILING');

    // UPCOM ±15%
    const acvLimits = computeVnPriceLimits({
      symbol: 'ACV',
      currentPrice: 105.0,
      officialRefPrice: 100.0,
    });
    expect(acvLimits.bandPct).toBe(15);
    expect(acvLimits.ceilingPrice).toBe(115.0);
    expect(acvLimits.floorPrice).toBe(85.0);
    expect(acvLimits.colorState).toBe('UP');
  });

  it('4. computes VN30F1M vs VN30 Basis regimes, 3rd-Thursday expiry, and 08:45 HNX-PS market hours', () => {
    const mockSymbols: MarketSymbol[] = [
      {
        symbol: 'VN30',
        name: 'VN30 Index',
        type: 'index',
        baseAsset: 'VN30',
        quoteAsset: 'VND',
        price: 1882.0,
        change24h: 0.8,
        high24h: 1890,
        low24h: 1875,
        volume24h: 250000000,
      },
      {
        symbol: 'VN30F1M',
        name: 'VN30F1M Futures',
        type: 'index',
        baseAsset: 'VN30F1M',
        quoteAsset: 'VND',
        price: 1890.5,
        change24h: 1.15,
        high24h: 1895,
        low24h: 1880,
        volume24h: 195000,
      },
    ];

    // Nov 2, 2026 -> 3rd Thursday of Nov 2026 is 2026-11-19
    const refNow = new Date('2026-11-02T02:00:00Z'); // 09:00 GMT+7 Monday
    const expiry = getNextVn30f1mExpiryDate(refNow);
    expect(expiry.expiryDateISO).toBe('2026-11-19');
    expect(expiry.daysToExpiry).toBeGreaterThan(10);

    const basis = computeVn30BasisAnalytics(mockSymbols, refNow);
    expect(basis).not.toBeNull();
    expect(basis!.basisPoints).toBe(8.5);
    expect(basis!.regime).toBe('STRONG_PREMIUM');

    // Verify VN30F1M opens ATO at 08:50 GMT+7 (01:50 UTC) while equities are still PRE_OPEN
    const derivOpenTime = new Date('2026-11-02T01:50:00Z'); // 08:50 GMT+7 Monday
    expect(isVietnamMarketSymbol(mockSymbols[1])).toBe(true);
    const derivSession = getMarketSessionInfo(mockSymbols[1], derivOpenTime);
    expect(derivSession.isOpen).toBe(true);
    expect(derivSession.exchangeName).toContain('HNX');
  });

  it('5. tracks Granular Intraday Session Phases (ATO / T+2 13:00 release / ATC) & Time-Normalized RVOL', () => {
    const sampleDailyCandles: Candle[] = Array.from({ length: 22 }, (_, i) => ({
      time: 1760000000 + i * 86400,
      open: 70,
      high: 72,
      low: 69,
      close: 71,
      volume: i === 21 ? 6_000_000 : 10_000_000, // 6M shares already traded
    }));

    // 09:10 GMT+7 Monday = 02:10 UTC (ATO)
    const atoPulse = computeVnIntradaySessionPulse(
      sampleDailyCandles,
      new Date('2026-11-02T02:10:00Z')
    );
    expect(atoPulse.phase).toBe('ATO');
    expect(atoPulse.isT2SettlementReleased).toBe(false);

    // 13:15 GMT+7 Monday = 06:15 UTC (Early Afternoon right after T+2 settlement hits accounts)
    // At 13:15, expected cumulative volume weight is ~60.5%, so 6M / (10M * 0.605) ≈ 0.99x NORMAL,
    // whereas if today's volume at 10:00 GMT+7 (03:00 UTC, weight ~26%) is 6M -> 6M / 2.6M = 2.31x EXPLOSIVE!
    const morningExplosive = computeVnIntradaySessionPulse(
      sampleDailyCandles,
      new Date('2026-11-02T03:00:00Z')
    );
    expect(morningExplosive.phase).toBe('MORNING_CONTINUOUS');
    expect(morningExplosive.timeNormalizedRvol).toBeGreaterThan(1.75);
    expect(morningExplosive.rvolState).toBe('EXPLOSIVE');

    const afternoonT2 = computeVnIntradaySessionPulse(
      sampleDailyCandles,
      new Date('2026-11-02T06:15:00Z')
    );
    expect(afternoonT2.phase).toBe('AFTERNOON_CONTINUOUS');
    expect(afternoonT2.isT2SettlementReleased).toBe(true);
    expect(afternoonT2.t2Note).toContain('13:00');

    // 14:35 GMT+7 Monday = 07:35 UTC (ATC)
    const atcPulse = computeVnIntradaySessionPulse(
      sampleDailyCandles,
      new Date('2026-11-02T07:35:00Z')
    );
    expect(atcPulse.phase).toBe('ATC');
  });

  it('6. expands Vietnam Stock Universe to 75+ tickers across 10 sectors & computes RS Sector Rotation', () => {
    expect(VN_SECTOR_DEFINITIONS.length).toBe(10);
    const vnDefaultCount = DEFAULT_SYMBOLS.filter(
      (s) => s.quoteAsset === 'VND' || s.type === 'vn30' || s.symbol === 'VNINDEX'
    ).length;
    expect(vnDefaultCount).toBeGreaterThanOrEqual(75);
    expect(GLOBAL_SYMBOL_CATALOG.some((c) => c.symbol === 'VN30F1M')).toBe(true);
    expect(getVnStockSectorInfo('SSI')?.id).toBe('SECURITIES');
    expect(getVnStockSectorInfo('SZC')?.id).toBe('INDUSTRIAL_PARK');

    const rotation = computeVnSectorRotation(DEFAULT_SYMBOLS);
    expect(rotation.sectors.length).toBe(10);
    for (const sec of rotation.sectors) {
      expect(['LEADING', 'IMPROVING', 'WEAKENING', 'LAGGING']).toContain(sec.quadrant);
      expect(sec.trackedCount).toBeGreaterThan(0);
    }
  });

  it('7. enforces 100-share board lots on Equities, VSD ~17% margin on VN30F1M, and tick-rounded Accumulation zones', () => {
    // Equity sizing: 200 Million VND capital (200,000k), 1.5% risk, FPT @ 72.24k, SL @ 68.12k
    const eqSizing = computeVnPositionSizing({
      symbol: 'FPT',
      capitalInput: 200_000,
      riskPercent: 1.5,
      entryPrice: 72.24,
      stopLossPrice: 68.12,
    });
    expect(eqSizing.isDerivative).toBe(false);
    expect(eqSizing.lotSize).toBe(100);
    expect(eqSizing.recommendedSharesOrContracts % 100).toBe(0);
    expect(eqSizing.roundedEntry).toBe(72.2);
    expect(eqSizing.roundedStopLoss).toBe(68.1);

    // Derivative sizing: 150 Million VND capital, 2% risk, VN30F1M @ 1888.54, SL @ 1876.02
    const derivSizing = computeVnPositionSizing({
      symbol: 'VN30F1M',
      capitalInput: 150_000,
      riskPercent: 2.0,
      entryPrice: 1888.54,
      stopLossPrice: 1876.02,
    });
    expect(derivSizing.isDerivative).toBe(true);
    expect(derivSizing.lotSize).toBe(1);
    expect(derivSizing.recommendedSharesOrContracts).toBeGreaterThanOrEqual(1);
    expect(derivSizing.roundedEntry).toBe(1888.5);
    expect(derivSizing.marginRequiredMillionVnd).toBeGreaterThan(25);

    // Accumulation zone tick alignment check on HPG (10..49.95k tier -> 0.05k tick)
    const hpgSym = DEFAULT_SYMBOLS.find((s) => s.symbol === 'HPG')!;
    const acc = analyzeAccumulationZone(hpgSym);
    expect(Number(((acc.entryZone[0] * 100) % 5).toFixed(4))).toBe(0);
    expect(Number(((acc.entryZone[1] * 100) % 5).toFixed(4))).toBe(0);
  });

  it('8. computes Intraday Active Buy/Sell Imbalance, VWAP, Whale Spike Bars & Put-Through integration', () => {
    const fptSym: MarketSymbol = {
      symbol: 'FPT',
      name: 'FPT Corp',
      type: 'vn30',
      baseAsset: 'FPT',
      quoteAsset: 'VND',
      price: 132.5,
      change24h: 3.1,
      high24h: 133.0,
      low24h: 129.0,
      volume24h: 8_500_000,
    };

    const candles: Candle[] = Array.from({ length: 16 }, (_, idx) => {
      const isWhaleBuy = idx === 14;
      return {
        time: 1762050000 + idx * 900,
        open: 129 + idx * 0.2,
        high: 129.3 + idx * 0.22,
        low: 128.95 + idx * 0.2,
        close: 129.28 + idx * 0.22, // closes near top of bar -> strong active buy
        volume: isWhaleBuy ? 1_200_000 : 250_000,
      };
    });

    const flow = computeVnActiveOrderFlow(candles, fptSym, {
      symbol: 'FPT',
      latestDate: '2026-11-02',
      floor: 'HOSE',
      nmVolume: 8_500_000,
      nmValueBillionVnd: 1115.2,
      ptVolume: 900_000,
      ptValueBillionVnd: 118.8,
      ptSharePct: 9.6,
      total5dPtBillionVnd: 320.5,
      vwapPrice: 131.2,
      officialRefPrice: 128.5,
      officialCeilingPrice: 137.4,
      officialFloorPrice: 119.6,
    });

    expect(flow.activeBuyPct).toBeGreaterThan(60);
    expect(flow.regime).toBe('STRONG_BUY_ABSORPTION');
    expect(flow.vwapPrice).toBe(131.2);
    expect(flow.priceVsVwapPct).toBeGreaterThan(0);
    expect(flow.ptValueBillionVnd).toBe(118.8);
    expect(flow.whaleBars.length).toBeGreaterThanOrEqual(1);
    expect(flow.whaleBars[0].side).toBe('ACTIVE_BUY');
  });

  it('9. enforces Vietnam VSD T+2.5 Settlement Lock (13:00 Day T+2 skipping weekends) & 0.40% Fee+Tax + 12% Margin Interest', () => {
    // Case A: Bought Monday 2026-11-02 10:00 GMT+7 (03:00 UTC)
    const monFillMs = Date.parse('2026-11-02T03:00:00Z');
    // Tuesday 14:00 GMT+7 (07:00 UTC) -> T+1 still locked!
    const tueCheck = computeVnT2SettlementState(
      monFillMs,
      Date.parse('2026-11-03T07:00:00Z'),
      'FPT',
      'VND'
    );
    expect(tueCheck.isVnEquityT2).toBe(true);
    expect(tueCheck.isLocked).toBe(true);
    expect(tueCheck.businessDaysElapsed).toBe(1);

    // Wednesday 11:00 GMT+7 (04:00 UTC) -> Morning of T+2 BEFORE 13:00 still locked!
    const wedMorningCheck = computeVnT2SettlementState(
      monFillMs,
      Date.parse('2026-11-04T04:00:00Z'),
      'FPT',
      'VND'
    );
    expect(wedMorningCheck.isLocked).toBe(true);

    // Wednesday 13:05 GMT+7 (06:05 UTC) -> UNLOCKED!
    const wedAfternoonCheck = computeVnT2SettlementState(
      monFillMs,
      Date.parse('2026-11-04T06:05:00Z'),
      'FPT',
      'VND'
    );
    expect(wedAfternoonCheck.isLocked).toBe(false);

    // Case B: Bought Thursday 2026-11-05 14:00 GMT+7 -> Friday is T+1, skips Sat/Sun -> unlocks Monday 2026-11-09 13:00 GMT+7 (06:00 UTC)
    const thuFillMs = Date.parse('2026-11-05T07:00:00Z');
    const sunCheck = computeVnT2SettlementState(
      thuFillMs,
      Date.parse('2026-11-08T10:00:00Z'),
      'HPG',
      'VND'
    );
    expect(sunCheck.isLocked).toBe(true);
    const monAfternoonCheck = computeVnT2SettlementState(
      thuFillMs,
      Date.parse('2026-11-09T06:01:00Z'),
      'HPG',
      'VND'
    );
    expect(monAfternoonCheck.isLocked).toBe(false);

    // Case C: VN30F1M Derivative is T+0 (never locked)
    const derivCheck = computeVnT2SettlementState(
      monFillMs,
      Date.parse('2026-11-02T03:05:00Z'),
      'VN30F1M',
      'VND'
    );
    expect(derivCheck.isLocked).toBe(false);

    // Net PnL with 2x Margin held for 10 days on +5% stock gain:
    // Gross on capital = +10.00%, Fee+Tax = 0.40% * 2 = 0.80%, Margin interest = 1 * (12%/365)*10 ≈ 0.33% -> Net ≈ +8.87%
    const pnl = computeVnNetPaperPnl({
      symbol: 'SSI',
      quoteAsset: 'VND',
      action: 'BUY',
      entryPrice: 30.0,
      exitPrice: 31.5,
      capital: 100_000_000,
      leverage: 2,
      filledTimeMs: monFillMs,
      evalTimeMs: monFillMs + 10 * 86_400_000,
    });
    expect(pnl.frictionPctOnCapital).toBeGreaterThan(1.1);
    expect(pnl.netPnlPercent).toBeCloseTo(8.87, 1);
  });

  it('10. triggers Vietnam-specific Smart Alerts (VN_VOLUME_BREAKOUT, VN_NEAR_FLOOR_WARNING, VN30F_BASIS_EXTREME)', () => {
    const nowMs = Date.parse('2026-11-02T03:00:00Z'); // 10:00 GMT+7 Monday
    const mockSyms: MarketSymbol[] = [
      {
        symbol: 'SSI',
        name: 'SSI Securities',
        type: 'vn30',
        baseAsset: 'SSI',
        quoteAsset: 'VND',
        price: 27.95, // Floor on ref 30.00 is 27.90 -> dist to floor ~0.18%!
        change24h: -6.83,
        high24h: 29.8,
        low24h: 27.9,
        volume24h: 22_000_000,
      },
      {
        symbol: 'FPT',
        name: 'FPT Corp',
        type: 'vn30',
        baseAsset: 'FPT',
        quoteAsset: 'VND',
        price: 135.0,
        change24h: 3.4,
        high24h: 135.5,
        low24h: 131.0,
        volume24h: 8_000_000,
      },
      {
        symbol: 'VN30',
        name: 'VN30',
        type: 'index',
        baseAsset: 'VN30',
        quoteAsset: 'VND',
        price: 1850.0,
        change24h: 0.5,
        high24h: 1855,
        low24h: 1840,
        volume24h: 180_000_000,
      },
      {
        symbol: 'VN30F1M',
        name: 'VN30F1M',
        type: 'index',
        baseAsset: 'VN30F1M',
        quoteAsset: 'VND',
        price: 1859.2, // +9.2 pts basis
        change24h: 0.9,
        high24h: 1862,
        low24h: 1848,
        volume24h: 210_000,
      },
    ];

    const fptCandles: Candle[] = Array.from({ length: 22 }, (_, i) => ({
      time: 1760000000 + i * 86400,
      open: 130,
      high: 135,
      low: 129,
      close: 135,
      volume: i === 21 ? 6_500_000 : 10_000_000, // At 10:00 GMT+7 (~26% weight), 6.5M vs 2.6M expected => ~2.5x RVOL!
    }));

    const rules: SmartAlertRule[] = [
      {
        id: 'r_vol',
        symbol: 'FPT',
        condition: 'VN_VOLUME_BREAKOUT',
        threshold: 1.8,
        enabled: true,
        oneShot: true,
        cooldownMinutes: 30,
        createdAtMs: nowMs - 60_000,
      },
      {
        id: 'r_floor',
        symbol: 'SSI',
        condition: 'VN_NEAR_FLOOR_WARNING',
        threshold: 1.2,
        enabled: true,
        oneShot: true,
        cooldownMinutes: 30,
        createdAtMs: nowMs - 60_000,
      },
      {
        id: 'r_basis',
        symbol: 'VN30F1M',
        condition: 'VN30F_BASIS_EXTREME',
        threshold: 6.0,
        enabled: true,
        oneShot: true,
        cooldownMinutes: 30,
        createdAtMs: nowMs - 60_000,
      },
    ];

    const res = evaluateAlertRulesPure({
      rules,
      symbols: mockSyms,
      activeSymbol: 'FPT',
      activeCandles: fptCandles,
      nowMs,
    });

    expect(res.newlyTriggered.length).toBe(3);
    expect(res.newlyTriggered.map((e) => e.ruleId).sort()).toEqual(['r_basis', 'r_floor', 'r_vol']);
  });

  it('11. scans Vietnam CANSLIM / VCP / Breakout Leaders & evaluates SBV USD/VND Liquidity Pressure Gauge', () => {
    const sampleUniverse: MarketSymbol[] = [
      {
        symbol: 'VNINDEX',
        name: 'VN-Index',
        type: 'index',
        baseAsset: 'VNINDEX',
        quoteAsset: 'VND',
        price: 1288.5,
        change24h: 1.35,
        high24h: 1290,
        low24h: 1272,
        volume24h: 850_000_000,
      },
      {
        symbol: 'FPT',
        name: 'FPT Corp',
        type: 'vn30',
        baseAsset: 'FPT',
        quoteAsset: 'VND',
        price: 136.4,
        change24h: 4.2,
        high24h: 136.8,
        low24h: 131.5,
        volume24h: 9_200_000,
      },
      {
        symbol: 'ACB',
        name: 'Asia Commercial Bank',
        type: 'vn30',
        baseAsset: 'ACB',
        quoteAsset: 'VND',
        price: 25.85,
        change24h: 0.4,
        high24h: 25.95,
        low24h: 25.6, // tight 1.37% intraday range -> VCP_TIGHT_BASE
        volume24h: 7_500_000,
      },
      {
        symbol: 'VIC',
        name: 'Vingroup',
        type: 'vn30',
        baseAsset: 'VIC',
        quoteAsset: 'VND',
        price: 41.2,
        change24h: -0.5,
        high24h: 41.8,
        low24h: 41.0,
        volume24h: 3_100_000,
      },
    ];

    const momentum = scanVnMomentumBreakouts(sampleUniverse);
    expect(momentum.marketRegime).toBe('FTD_CONFIRMED');
    expect(momentum.breakoutCount).toBeGreaterThanOrEqual(1);
    const fptCand = momentum.candidates.find((c) => c.symbol === 'FPT')!;
    expect(fptCand.setupType).toBe('BREAKOUT_LEADER');
    expect(fptCand.stopLossPrice).toBeLessThan(fptCand.pivotBuyPrice);

    // SBV FX Stress Gauge
    const severeFx = computeVnSbvFxPressure({
      updatedAt: Date.now(),
      overallRegime: 'RISK_OFF',
      overallScore: -45,
      regimeHeadline: 'Stress',
      indicators: [
        {
          id: 'USDVND',
          name: 'USD/VND',
          shortLabel: 'USD/VND',
          category: 'FX',
          value: 25_780,
          change24h: 110,
          changePercent: 0.42,
          unit: 'VND',
          status: 'BEARISH_RISK',
          impactSummary: 'FX high',
          source: 'Yahoo',
        },
        {
          id: 'DXY',
          name: 'DXY',
          shortLabel: 'DXY',
          category: 'FX',
          value: 106.4,
          change24h: 0.5,
          changePercent: 0.48,
          unit: 'pts',
          status: 'BEARISH_RISK',
          impactSummary: 'DXY high',
          source: 'Yahoo',
        },
      ],
      globalAlerts: [],
      economicCalendar: [],
    } as any);

    expect(severeFx).not.toBeNull();
    expect(severeFx!.regime).toBe('SEVERE_FX_STRESS');
    expect(severeFx!.recommendedMaxEquityPct).toBe(40);
  });
});
