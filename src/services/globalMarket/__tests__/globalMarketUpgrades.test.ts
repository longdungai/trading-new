import { describe, expect, it } from 'vitest';
import {
  checkUsPdtRuleWarning,
  computeCryptoCapitalCycle,
  computeCryptoLiquidationAndCarry,
  computeCryptoNarrativeRotation,
  computeGlobalPaperTradeNetPnl,
  computeOptionsWallsAndMaxPain,
  computeUsExtendedHoursPulse,
  computeUsSectorRotation,
  isCryptoSymbol,
  isUsOrGlobalEquitySymbol,
  NormalizedOptionContract,
  parseCboeOccContract,
  parseDeribitContract,
} from '../globalExecutionEngines';
import { DEFAULT_SYMBOLS, mapToYahooSymbol } from '../../api/marketData';
import { getMarketSessionInfo } from '../../../utils/marketHours';
import { getConditionLabelVi } from '../../alerts/smartAlertCenter';

describe('Institutional Crypto 24/7 & Wall Street Global Market Upgrades', () => {
  it('parses CBOE OCC (standard + weekly prefixed) & Deribit option codes and computes Max Pain / Gamma Walls', () => {
    const stdOcc = parseCboeOccContract('NVDA261106P00135000');
    expect(stdOcc).toEqual({
      expiryIso: '2026-11-06',
      right: 'P',
      strike: 135,
    });

    const weeklyPrefixedOcc = parseCboeOccContract('B1SPY261106C00585500');
    expect(weeklyPrefixedOcc).toEqual({
      expiryIso: '2026-11-06',
      right: 'C',
      strike: 585.5,
    });

    const deribit = parseDeribitContract('BTC-13NOV26-82000-C');
    expect(deribit).toEqual({
      underlying: 'BTC',
      expiryIso: '2026-11-13',
      right: 'C',
      strike: 82000,
    });

    const chain: NormalizedOptionContract[] = [
      { strike: 130, right: 'P', openInterest: 18000, midPriceUsd: 1.2, gamma: 0.03, expiryIso: '2026-11-06' },
      { strike: 135, right: 'P', openInterest: 9000, midPriceUsd: 2.5, gamma: 0.05, expiryIso: '2026-11-06' },
      { strike: 140, right: 'P', openInterest: 6000, midPriceUsd: 4.8, gamma: 0.06, expiryIso: '2026-11-06' },
      { strike: 140, right: 'C', openInterest: 7500, midPriceUsd: 5.0, gamma: 0.06, expiryIso: '2026-11-06' },
      { strike: 145, right: 'C', openInterest: 11000, midPriceUsd: 2.6, gamma: 0.05, expiryIso: '2026-11-06' },
      { strike: 150, right: 'C', openInterest: 26000, midPriceUsd: 1.1, gamma: 0.04, expiryIso: '2026-11-06' },
    ];

    const res = computeOptionsWallsAndMaxPain(chain, 140, 100);
    expect(res).not.toBeNull();
    expect(res!.putWallPrice).toBe(130);
    expect(res!.callWallPrice).toBe(150);
    expect(res!.maxPainPrice).toBe(140);
    // ATM straddle at 140 = (4.8 + 5.0) / 140 = 7.0%
    expect(res!.impliedMovePct).toBeCloseTo(7.0, 1);
    expect(res!.gammaRegime).toBe('POSITIVE_GAMMA_PIN');
  });

  it('computes Crypto 25x/50x Liquidation Magnets and classifies Overleveraged Longs vs Short Squeeze', () => {
    const overLong = computeCryptoLiquidationAndCarry(
      'BTCUSDT',
      80000,
      [],
      {
        perpSymbol: 'BTCUSDT',
        markPrice: 80180,
        indexPrice: 80000,
        fundingRate8hPct: 0.045,
        annualizedFundingPct: 49.28,
        perpSpotBasisPct: 0.225,
        nextFundingTimeMs: Date.now() + 3600_000,
      }
    );

    expect(overLong.longLiq25x).toBeLessThan(overLong.longLiq50x);
    expect(overLong.longLiq50x).toBeLessThan(80000);
    expect(overLong.shortLiq50x).toBeGreaterThan(80000);
    expect(overLong.shortLiq25x).toBeGreaterThan(overLong.shortLiq50x);
    expect(overLong.fundingRegime).toBe('OVERLEVERAGED_LONGS');

    const squeeze = computeCryptoLiquidationAndCarry(
      'SOLUSDT',
      150,
      [],
      {
        perpSymbol: 'SOLUSDT',
        markPrice: 149.7,
        indexPrice: 150,
        fundingRate8hPct: -0.025,
        annualizedFundingPct: -27.38,
        perpSpotBasisPct: -0.2,
        nextFundingTimeMs: Date.now() + 1800_000,
      }
    );
    expect(squeeze.fundingRegime).toBe('SHORT_SQUEEZE_SETUP');
  });

  it('evaluates Crypto Capital Cycle & ranks all 6 Crypto Narrative Ecosystems by RS vs BTC', () => {
    const cycle = computeCryptoCapitalCycle(DEFAULT_SYMBOLS, {
      btcDominancePct: 53.2,
      ethDominancePct: 14.5,
      othersDominancePct: 32.3,
      totalCryptoMcapTrillionUsd: 2.85,
      mcapChange24hPct: 2.4,
      stablecoinTotalBillionUsd: 178.5,
      stablecoin7dNetMintBillionUsd: 1.45,
      usdtBillionUsd: 122.0,
      usdcBillionUsd: 38.5,
    });

    expect(['ALTSEASON_EXPANSION', 'LIQUIDITY_INFLOW_BULL', 'BTC_SEASON_ABSORPTION']).toContain(
      cycle.regime
    );

    const narratives = computeCryptoNarrativeRotation(DEFAULT_SYMBOLS);
    expect(narratives).toHaveLength(6);
    // Sorted descending by RS vs BTC
    expect(narratives[0].rsVsBtcPct).toBeGreaterThanOrEqual(narratives[5].rsVsBtcPct);
  });

  it('includes 11 S&P 500 Sector SPDR ETFs + Global Indices (N225, HSI, DAX) with accurate Yahoo mappings & exchange hours', () => {
    const symCodes = new Set(DEFAULT_SYMBOLS.map((s) => s.symbol));
    for (const etf of ['XLK', 'XLF', 'XLV', 'XLE', 'XLI', 'XLY', 'XLP', 'XLC', 'XLU', 'XLB', 'XLRE', 'SOXX']) {
      expect(symCodes.has(etf)).toBe(true);
      expect(isUsOrGlobalEquitySymbol(etf)).toBe(true);
      expect(isCryptoSymbol(etf)).toBe(false);
    }

    expect(mapToYahooSymbol('N225', 'index', 'USD')).toBe('^N225');
    expect(mapToYahooSymbol('HSI', 'index', 'USD')).toBe('^HSI');
    expect(mapToYahooSymbol('DAX', 'index', 'USD')).toBe('^GDAXI');

    // Tokyo Wednesday 10:00 JST (01:00 UTC) -> TSE OPEN
    const tokyoOpenSession = getMarketSessionInfo(
      { symbol: 'N225', type: 'index', quoteAsset: 'USD' },
      new Date('2026-11-04T01:00:00Z')
    );
    expect(tokyoOpenSession.shortExchange).toBe('TSE');
    expect(tokyoOpenSession.isOpen).toBe(true);

    // US Pre-Market Wednesday 08:00 ET (13:00 UTC in EST) -> PRE_OPEN
    const usPreSession = getMarketSessionInfo(
      { symbol: 'NVDA', type: 'stock', quoteAsset: 'USD' },
      new Date('2026-11-04T13:00:00Z')
    );
    expect(usPreSession.state).toBe('PRE_OPEN');
    expect(usPreSession.isOpen).toBe(true);

    const rotation = computeUsSectorRotation(DEFAULT_SYMBOLS);
    expect(rotation.sectors).toHaveLength(12);
    expect(rotation.sectors[0].rsVsSpyPct).toBeGreaterThanOrEqual(
      rotation.sectors[rotation.sectors.length - 1].rsVsSpyPct
    );
  });

  it('flags US Earnings Gap-Trap, deducts Crypto Perp / US Margin friction, and enforces FINRA PDT < $25,000', () => {
    const pulse = computeUsExtendedHoursPulse(
      'NVDA',
      140,
      {
        symbol: 'NVDA',
        regularPrice: 140,
        prevClose: 138,
        preMarketPrice: 144.2,
        preMarketChangePct: 3.0,
        postMarketPrice: null,
        postMarketChangePct: null,
        earningsDateIso: '2026-11-05',
        daysToEarnings: 2,
        earningsSession: 'AMC',
        exDividendDateIso: '2026-12-04',
        forwardPe: 34.5,
        shortFloatPct: 1.2,
        analystTargetPrice: 165,
        marketCapBillionUsd: 3400,
      },
      8.5,
      3.0,
      new Date('2026-11-04T13:00:00Z') // 08:00 ET Pre-Market
    );

    expect(pulse.activeSession).toBe('PRE_MARKET');
    expect(pulse.extendedPrice).toBe(144.2);
    expect(pulse.isImminentEarningsTrap).toBe(true);
    expect(pulse.earningsWarningVi).toContain('±8.5%');

    // Crypto 5x Perp held for 24h (3 funding intervals of 8h):
    // +4% raw move * 5x = +20.0% gross; fee = 0.08% * 5 = 0.40%; funding = 3 * 0.01% * 5 = 0.15% -> net = +19.45%
    const t0 = Date.parse('2026-11-01T00:00:00Z');
    const cryptoNet = computeGlobalPaperTradeNetPnl({
      marketKind: 'crypto',
      direction: 'LONG',
      entryPrice: 100,
      currentPrice: 104,
      leverage: 5,
      openedAtMs: t0,
      closedOrNowMs: t0 + 24 * 3600_000,
    });
    expect(cryptoNet.grossPnlPct).toBe(20);
    expect(cryptoNet.netPnlPct).toBeCloseTo(19.45, 2);

    // FINRA PDT check: 4 same-day roundtrips on US stocks with $5,000 capital -> PDT_RESTRICTED
    const dayTs = Date.parse('2026-11-02T15:00:00Z');
    const mockTrades = ['NVDA', 'TSLA', 'AMD', 'AAPL'].map((sym, i) => ({
      symbol: sym,
      openedAt: dayTs + i * 600_000,
      closedAt: dayTs + (i + 1) * 900_000,
      status: 'TP_HIT',
    }));

    const pdtRestricted = checkUsPdtRuleWarning(mockTrades, 5_000, dayTs + 3600_000);
    expect(pdtRestricted.status).toBe('PDT_RESTRICTED');
    expect(pdtRestricted.rolling5dDayTrades).toBe(4);

    const pdtExemptOver25k = checkUsPdtRuleWarning(mockTrades, 30_000, dayTs + 3600_000);
    expect(pdtExemptOver25k.status).toBe('SAFE');

    expect(getConditionLabelVi('CRYPTO_FUNDING_EXTREME')).toContain('Funding 8h');
    expect(getConditionLabelVi('US_EARNINGS_WARNING')).toContain('BCTC');
  });
});
