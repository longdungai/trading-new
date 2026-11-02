import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Clock,
  Coins,
  Crosshair,
  Flame,
  Globe2,
  Layers,
  Magnet,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Candle, MarketSymbol } from '../../types';
import {
  computeCryptoCapitalCycle,
  computeCryptoLiquidationAndCarry,
  computeCryptoNarrativeRotation,
  computeUsExtendedHoursPulse,
  computeUsSectorRotation,
  isCryptoSymbol,
  isUsOrGlobalEquitySymbol,
} from '../../services/globalMarket/globalExecutionEngines';
import {
  CryptoOptionsSummary,
  fetchGlobalMarketInsights,
  GlobalMarketInsightsResponse,
  UsOptionsSummary,
} from '../../services/globalMarket/globalMarketInsightsClient';
import { evaluateCryptoSpotDailyCashEngine } from '../../services/globalMarket/cryptoSpotDailyCashEngine';
import {
  loadUserHoldings,
  USER_HOLDINGS_UPDATED_EVENT,
  UserHoldingItem,
} from '../../services/portfolio/holdingsRecoveryEngine';
import { formatPrice } from '../../utils/formatters';

interface GlobalMarketQuickCardProps {
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
  candles: Candle[];
  stopLossPrice?: number | null;
  onSelectSymbol: (sym: MarketSymbol) => void;
  onOpenGlobalMacroTab: () => void;
}

export const GlobalMarketQuickCard: React.FC<GlobalMarketQuickCardProps> = ({
  currentSymbol,
  symbols,
  candles,
  stopLossPrice = null,
  onOpenGlobalMacroTab,
}) => {
  const symUpper = currentSymbol.symbol.toUpperCase();
  const isCrypto = isCryptoSymbol(currentSymbol);
  const isUsGlobal = !isCrypto && isUsOrGlobalEquitySymbol(currentSymbol);

  const [insights, setInsights] = useState<GlobalMarketInsightsResponse | null>(null);
  const [nowClock, setNowClock] = useState<Date>(() => new Date());
  const [activeCryptoSpotTab, setActiveCryptoSpotTab] = useState<
    'wick_sniper' | 't0_compound' | 'purity_session' | 'treasury_rs'
  >('wick_sniper');
  const [usdtCapitalInput, setUsdtCapitalInput] = useState<string>('5000');
  const [holdingsMap, setHoldingsMap] = useState<Record<string, UserHoldingItem>>(() =>
    loadUserHoldings()
  );

  useEffect(() => {
    const syncHoldings = () => setHoldingsMap(loadUserHoldings());
    window.addEventListener(USER_HOLDINGS_UPDATED_EVENT, syncHoldings);
    return () => window.removeEventListener(USER_HOLDINGS_UPDATED_EVENT, syncHoldings);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowClock(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    if (!isCrypto && !isUsGlobal) {
      setInsights(null);
      return;
    }

    const load = () => {
      void fetchGlobalMarketInsights(symUpper, false).then((res) => {
        if (active && res) setInsights(res);
      });
    };

    load();
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 45_000);

    return () => {
      active = false;
      clearInterval(poll);
    };
  }, [symUpper, isCrypto, isUsGlobal]);

  const cryptoLiqReport = useMemo(() => {
    if (!isCrypto) return null;
    return computeCryptoLiquidationAndCarry(
      symUpper,
      currentSymbol.price,
      candles,
      insights?.perpCarry,
      nowClock.getTime()
    );
  }, [isCrypto, symUpper, currentSymbol.price, candles, insights?.perpCarry, nowClock]);

  const cryptoCycle = useMemo(() => {
    if (!isCrypto) return null;
    return computeCryptoCapitalCycle(symbols, insights?.cryptoMacro);
  }, [isCrypto, symbols, insights?.cryptoMacro]);

  const activeNarrative = useMemo(() => {
    if (!isCrypto) return null;
    const buckets = computeCryptoNarrativeRotation(symbols);
    return buckets.find((b) => b.tickers.some((t) => t.symbol === symUpper)) || buckets[0] || null;
  }, [isCrypto, symbols, symUpper]);

  const cryptoSpotDaily = useMemo(() => {
    if (!isCrypto) return null;
    const parsedCapital = Math.max(100, Number(usdtCapitalInput.replace(/,/g, '')) || 5000);
    return evaluateCryptoSpotDailyCashEngine({
      currentSymbol,
      candles,
      symbols,
      perpCarry: insights?.perpCarry,
      cryptoMacro: insights?.cryptoMacro,
      liqReport: cryptoLiqReport,
      existingHolding: holdingsMap[symUpper] ?? null,
      totalCapitalUsdt: parsedCapital,
      nowMs: nowClock.getTime(),
    });
  }, [
    isCrypto,
    currentSymbol,
    candles,
    symbols,
    insights?.perpCarry,
    insights?.cryptoMacro,
    cryptoLiqReport,
    holdingsMap,
    symUpper,
    usdtCapitalInput,
    nowClock,
  ]);

  const usPulse = useMemo(() => {
    if (!isUsGlobal) return null;
    const slDistPct =
      stopLossPrice && currentSymbol.price > 0
        ? Math.abs(((currentSymbol.price - stopLossPrice) / currentSymbol.price) * 100)
        : null;
    return computeUsExtendedHoursPulse(
      symUpper,
      currentSymbol.price,
      insights?.usQuote,
      insights?.optionsSummary?.impliedMovePct,
      slDistPct,
      nowClock
    );
  }, [
    isUsGlobal,
    symUpper,
    currentSymbol.price,
    insights?.usQuote,
    insights?.optionsSummary?.impliedMovePct,
    stopLossPrice,
    nowClock,
  ]);

  const usSector = useMemo(() => {
    if (!isUsGlobal) return null;
    return computeUsSectorRotation(symbols);
  }, [isUsGlobal, symbols]);

  if (!isCrypto && !isUsGlobal) return null;

  // ===================== CRYPTO 24/7 QUICK CARD =====================
  if (isCrypto && cryptoLiqReport) {
    const opt = insights?.optionsSummary as CryptoOptionsSummary | null;
    const fundingPositive = cryptoLiqReport.fundingRate8hPct >= 0;

    return (
      <div className="p-3 rounded-xl bg-gradient-to-b from-[#0d1628] to-[#0a101d] border border-cyan-500/30 space-y-2.5 shadow-lg select-none">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="p-1 rounded-lg bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 shrink-0">
              <Magnet className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-white truncate">
              Vi Cấu Trúc Perps & Options
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenGlobalMacroTab}
            className="px-2 py-0.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap transition"
          >
            <span>Sóng Crypto & Mỹ</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Funding 8h + Perp-Spot Basis + Countdown */}
        <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
          <div className="p-2 rounded-lg bg-[#080d17] border border-slate-800/90 min-w-0">
            <div className="text-slate-400 text-[9px] truncate">Funding 8h</div>
            <div
              className={`font-bold text-xs truncate ${
                cryptoLiqReport.fundingRegime === 'OVERLEVERAGED_LONGS'
                  ? 'text-rose-400'
                  : cryptoLiqReport.fundingRegime === 'SHORT_SQUEEZE_SETUP'
                  ? 'text-emerald-400'
                  : fundingPositive
                  ? 'text-cyan-300'
                  : 'text-amber-300'
              }`}
            >
              {fundingPositive ? '+' : ''}
              {cryptoLiqReport.fundingRate8hPct.toFixed(4)}%
            </div>
            <div className="text-[9px] text-slate-500 truncate">
              {cryptoLiqReport.annualizedFundingPct >= 0 ? '+' : ''}
              {cryptoLiqReport.annualizedFundingPct.toFixed(1)}%/năm
            </div>
          </div>

          <div className="p-2 rounded-lg bg-[#080d17] border border-slate-800/90 min-w-0">
            <div className="text-slate-400 text-[9px] truncate">Perp-Spot Basis</div>
            <div
              className={`font-bold text-xs truncate ${
                cryptoLiqReport.perpSpotBasisPct >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {cryptoLiqReport.perpSpotBasisPct >= 0 ? '+' : ''}
              {cryptoLiqReport.perpSpotBasisPct.toFixed(3)}%
            </div>
            <div className="text-[9px] text-slate-500 truncate">
              Kỳ tới: {cryptoLiqReport.nextFundingCountdownVi}
            </div>
          </div>

          <div className="p-2 rounded-lg bg-[#080d17] border border-slate-800/90 min-w-0">
            <div className="text-slate-400 text-[9px] truncate">BTC.D / Mint 7d</div>
            <div className="font-bold text-xs text-amber-300 truncate">
              {cryptoCycle?.btcDominancePct ? `${cryptoCycle.btcDominancePct.toFixed(1)}%` : '--'}
            </div>
            <div className="text-[9px] text-slate-400 truncate">
              {cryptoCycle?.stablecoin7dNetMintBillionUsd != null
                ? `${cryptoCycle.stablecoin7dNetMintBillionUsd >= 0 ? '+' : ''}$${cryptoCycle.stablecoin7dNetMintBillionUsd.toFixed(2)}B`
                : activeNarrative
                ? `RS ${activeNarrative.rsVsBtcPct >= 0 ? '+' : ''}${activeNarrative.rsVsBtcPct}%`
                : 'Live 24/7'}
            </div>
          </div>
        </div>

        {/* 25x / 50x Leveraged Liquidation Magnet Clusters */}
        <div className="p-2 rounded-lg bg-[#080e1a] border border-slate-800/90 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap text-[10px]">
            <span className="font-bold text-slate-200 flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-400 shrink-0" />
              <span>Nam châm Thanh lý Đòn bẩy (25x–50x)</span>
            </span>
            <span className="text-[9px] font-mono text-cyan-300 shrink-0 whitespace-nowrap">
              Gần nhất: {cryptoLiqReport.distanceToNearestMagnetPct}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            <div className="px-2 py-1 rounded bg-rose-950/35 border border-rose-500/30 min-w-0">
              <div className="text-[9px] text-rose-300 truncate">Short Liq (50x → 25x)</div>
              <div className="text-white font-bold truncate">
                ${formatPrice(cryptoLiqReport.shortLiq50x)} → ${formatPrice(cryptoLiqReport.shortLiq25x)}
              </div>
            </div>
            <div className="px-2 py-1 rounded bg-emerald-950/35 border border-emerald-500/30 min-w-0">
              <div className="text-[9px] text-emerald-300 truncate">Long Liq (50x → 25x)</div>
              <div className="text-white font-bold truncate">
                ${formatPrice(cryptoLiqReport.longLiq50x)} → ${formatPrice(cryptoLiqReport.longLiq25x)}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-slate-300 leading-snug break-words">
            {cryptoLiqReport.squeezeWarningVi}
          </div>
        </div>

        {/* Deribit Institutional Options (BTC / ETH) */}
        {opt && (
          <div className="p-2 rounded-lg bg-[#0b1324] border border-fuchsia-500/25 space-y-1.5">
            <div className="flex items-center justify-between gap-1.5 flex-wrap text-[10px]">
              <span className="font-bold text-fuchsia-200">
                🎯 Deribit {opt.underlyingCurrency} Options ({opt.primaryExpiryIso})
              </span>
              {opt.dvol30dPct && (
                <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 border border-fuchsia-500/35 text-[9px] font-mono text-fuchsia-300 shrink-0 whitespace-nowrap">
                  DVOL {opt.dvol30dPct}%
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
              <div className="min-w-0">
                <div className="text-[9px] text-slate-400 truncate">Put Wall</div>
                <div className="font-bold text-sky-300 truncate">
                  {opt.putWallPrice ? `$${formatPrice(opt.putWallPrice)}` : '--'}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[9px] text-slate-400 truncate">Max Pain</div>
                <div className="font-bold text-amber-300 truncate">
                  {opt.maxPainPrice ? `$${formatPrice(opt.maxPainPrice)}` : '--'}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[9px] text-slate-400 truncate">Call Wall</div>
                <div className="font-bold text-pink-300 truncate">
                  {opt.callWallPrice ? `$${formatPrice(opt.callWallPrice)}` : '--'}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap text-[9px] text-slate-400 font-mono">
              <span>P/C OI: {opt.putCallOiRatio ?? '--'}</span>
              {opt.impliedMovePct && <span>Biên Straddle: ±{opt.impliedMovePct}%</span>}
              {opt.totalNotionalBillionUsd && <span>OI: ${opt.totalNotionalBillionUsd}B</span>}
            </div>
          </div>
        )}

        {/* ==========================================================================
            NEW: 6-ENGINE ZERO-LEVERAGE CRYPTO SPOT 24/7 DAILY CASH COMMAND CENTER
            (1. Hứng Râu Thanh Lý | 2. Lướt T+0 & Free Coin | 3. Tinh Khiết Spot & Phiên | 4. Két 3 Ngăn USDT & ALT/BTC)
           ========================================================================== */}
        {cryptoSpotDaily && (
          <div className="p-2.5 rounded-xl bg-[#070d18] border border-emerald-500/35 space-y-2.5 text-xs">
            {/* Banner Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-300 truncate">
                  Chiến Lược Spot Coin Hàng Ngày (1x Cash • Không Đòn Bẩy)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-mono text-[9.5px] font-bold shrink-0">
                Điểm Cơ Hội: {cryptoSpotDaily.dailyOpportunityScore}/100
              </span>
            </div>

            {/* Playbook Status Pill */}
            <div className="p-2 rounded-lg bg-[#0c1629] border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-[10px] font-black text-cyan-300">
                  {cryptoSpotDaily.playbookBadgeVi}
                </span>
                <span className="text-[9.5px] font-mono text-amber-300">
                  Phí Spot 2 chiều: 0.20% • T+0 24/7
                </span>
              </div>
              <div className="text-[10px] text-slate-300 leading-snug">
                {cryptoSpotDaily.playbookHeadlineVi}
              </div>
            </div>

            {/* 4-Tab Switcher */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-lg bg-[#050911] border border-slate-800 text-[9.5px] font-bold">
              <button
                type="button"
                onClick={() => setActiveCryptoSpotTab('wick_sniper')}
                className={`py-1.5 px-1 rounded-md transition flex items-center justify-center gap-1 truncate ${
                  activeCryptoSpotTab === 'wick_sniper'
                    ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crosshair className="w-3 h-3 shrink-0" />
                <span className="truncate">1. Hứng Râu Liq</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCryptoSpotTab('t0_compound')}
                className={`py-1.5 px-1 rounded-md transition flex items-center justify-center gap-1 truncate ${
                  activeCryptoSpotTab === 't0_compound'
                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <RefreshCw className="w-3 h-3 shrink-0" />
                <span className="truncate">2. Lướt T+0 &amp; Lãi Kép</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCryptoSpotTab('purity_session')}
                className={`py-1.5 px-1 rounded-md transition flex items-center justify-center gap-1 truncate ${
                  activeCryptoSpotTab === 'purity_session'
                    ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">3. Phiên &amp; Spot Thực</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCryptoSpotTab('treasury_rs')}
                className={`py-1.5 px-1 rounded-md transition flex items-center justify-center gap-1 truncate ${
                  activeCryptoSpotTab === 'treasury_rs'
                    ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3 shrink-0" />
                <span className="truncate">4. Két 3 Ngăn &amp; RS</span>
              </button>
            </div>

            {/* TAB 1: LEVERAGE LIQUIDATION WICK SNIPER */}
            {activeCryptoSpotTab === 'wick_sniper' && (
              <div className="space-y-2 text-[10px]">
                <div className="text-slate-300 leading-snug">
                  {cryptoSpotDaily.wickSniper.sniperHeadlineVi}
                </div>
                <div className="space-y-1 font-mono">
                  {cryptoSpotDaily.wickSniper.tranches.map((tr) => (
                    <div
                      key={tr.trancheIndex}
                      className="p-1.5 rounded-lg bg-[#0b1424] border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-sans font-bold text-emerald-300 truncate">
                          {tr.labelVi} ({tr.usdtAllocationPct}% • ${tr.usdtAmount.toLocaleString()})
                        </div>
                        <div className="text-[9px] font-sans text-slate-400 truncate">
                          {tr.triggerSourceVi}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-white">
                          ${formatPrice(tr.limitPrice)}{' '}
                          <span className="text-cyan-300">(-{tr.discountFromSpotPct}%)</span>
                        </div>
                        <div className="text-[9px] text-slate-400">
                          Khớp: {tr.coinQuantity} {symUpper.replace('USDT', '')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[9.5px]">
                  <div className="p-1.5 rounded bg-emerald-950/35 border border-emerald-500/35 text-emerald-200">
                    Chốt lời rút chân: <strong>${formatPrice(cryptoSpotDaily.wickSniper.snapbackTargetPrice)}</strong> (+{cryptoSpotDaily.wickSniper.netBounceProfitPct}% ròng ≈ +${cryptoSpotDaily.wickSniper.estimatedNetProfitUsdt})
                  </div>
                  <div className="p-1.5 rounded bg-rose-950/35 border border-rose-500/35 text-rose-200">
                    Hủy cấu trúc: <strong>${formatPrice(cryptoSpotDaily.wickSniper.hardInvalidationPrice)}</strong> (Không cháy TK vì giữ Spot 1x)
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: T+0 PING-PONG & FREE COIN BAG */}
            {activeCryptoSpotTab === 't0_compound' && (
              <div className="space-y-2 text-[10px]">
                <div className="p-2 rounded-lg bg-[#0b1424] border border-cyan-500/35 space-y-1">
                  <div className="font-bold text-cyan-300">
                    🔄 Chiến Thuật 1: Quay Vòng T+0 Hạ Giá Vốn Trong Ngày
                  </div>
                  <div className="text-slate-300 leading-snug">
                    {cryptoSpotDaily.t0Compounding.compoundingSummaryVi}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[#0b1424] border border-amber-500/35 space-y-1">
                  <div className="font-bold text-amber-300">
                    🪙 Chiến Thuật 2: Tích Sản "Free Coin Bag" (Thu Hồi Gốc • Giữ Lãi Bằng Tiền Nhà Cái)
                  </div>
                  <div className="text-slate-300 leading-snug">
                    {cryptoSpotDaily.t0Compounding.freeCoinBagPlan.summaryVi}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SPOT PURITY SHIELD & 24/7 ASIA/LONDON/NY KILLZONE */}
            {activeCryptoSpotTab === 'purity_session' && (
              <div className="space-y-2 text-[10px]">
                <div
                  className={`p-2 rounded-lg border space-y-1 ${
                    cryptoSpotDaily.spotPurityShield.isLeverageFrothVeto
                      ? 'bg-rose-950/40 border-rose-500/45 text-rose-200'
                      : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{cryptoSpotDaily.spotPurityShield.regimeBadgeVi}</span>
                    <span className="font-mono">
                      Purity: {cryptoSpotDaily.spotPurityShield.spotPurityScore}/100
                    </span>
                  </div>
                  <div className="text-slate-200 leading-snug">
                    {cryptoSpotDaily.spotPurityShield.shieldAdviceVi}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[#0b1424] border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between font-bold text-indigo-300">
                    <span>🕒 {cryptoSpotDaily.sessionKillzone.sessionLabelVi}</span>
                    <span className="font-mono text-[9.5px] text-slate-400">
                      {cryptoSpotDaily.sessionKillzone.vnTimeWindowLabel}
                    </span>
                  </div>
                  <div className="text-slate-300">
                    • Đặc tính: {cryptoSpotDaily.sessionKillzone.volatilityExpectationVi}
                  </div>
                  <div className="text-cyan-300 font-medium">
                    👉 Hành động: {cryptoSpotDaily.sessionKillzone.bestTacticVi}
                  </div>
                  <div className="text-[9.5px] text-amber-200 pt-0.5">
                    • {cryptoSpotDaily.sessionKillzone.cmeMagnetNoteVi}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: 3-BUCKET USDT TREASURY & ALT/BTC RELATIVE STRENGTH */}
            {activeCryptoSpotTab === 'treasury_rs' && (
              <div className="space-y-2 text-[10px]">
                <div className="flex items-center justify-between gap-2 bg-[#0b1424] p-2 rounded-lg border border-slate-800">
                  <span className="font-bold text-amber-300">Tổng vốn Két Sắt Spot (USDT):</span>
                  <input
                    type="number"
                    min="100"
                    step="500"
                    value={usdtCapitalInput}
                    onChange={(e) => setUsdtCapitalInput(e.target.value)}
                    className="w-28 px-2 py-1 rounded bg-[#060b14] border border-amber-500/40 text-white font-mono text-xs text-right"
                  />
                </div>

                <div className="space-y-1">
                  {cryptoSpotDaily.usdtTreasury.buckets.map((b) => (
                    <div
                      key={b.bucketId}
                      className="p-1.5 rounded-lg bg-[#0b1424] border border-slate-800 flex flex-col gap-0.5"
                    >
                      <div className="flex items-center justify-between font-bold text-white">
                        <span>{b.nameVi}</span>
                        <span className="font-mono text-emerald-300">
                          ${b.allocatedUsdt.toLocaleString()} ({b.coinUnits} ĐV @ ${formatPrice(b.deployPrice)})
                        </span>
                      </div>
                      <div className="text-[9.5px] text-slate-400">{b.roleDescriptionVi}</div>
                    </div>
                  ))}
                </div>

                <div className="p-2 rounded-lg bg-[#0c172b] border border-cyan-500/35 space-y-0.5">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-cyan-300">{cryptoSpotDaily.altBtcStrength.rsBadgeVi}</span>
                    <span className="font-mono text-amber-300">
                      Top Alpha: {cryptoSpotDaily.altBtcStrength.topAlphaLeaderSymbol} (
                      {cryptoSpotDaily.altBtcStrength.topAlphaLeaderChangePct >= 0 ? '+' : ''}
                      {cryptoSpotDaily.altBtcStrength.topAlphaLeaderChangePct}%)
                    </span>
                  </div>
                  <div className="text-slate-300 leading-snug">
                    {cryptoSpotDaily.altBtcStrength.rotationAdviceVi}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ===================== US & GLOBAL EQUITIES QUICK CARD =====================
  const usOpt = insights?.optionsSummary as UsOptionsSummary | null;
  const uq = insights?.usQuote;

  return (
    <div className="p-3 rounded-xl bg-gradient-to-b from-[#0f1629] to-[#0a0f1d] border border-indigo-500/35 space-y-2.5 shadow-lg select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="p-1 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 shrink-0">
            <Globe2 className="w-3.5 h-3.5" />
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-white truncate">
            Phố Wall • Pre/Post & CBOE Gamma
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenGlobalMacroTab}
          className="px-2 py-0.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/45 text-indigo-200 text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap transition"
        >
          <span>11 Ngành Mỹ & BCTC</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      {/* Session & Extended-Hours Gap */}
      {usPulse && (
        <div className="p-2 rounded-lg bg-[#080d18] border border-slate-800/90 flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="text-[9px] text-slate-400 uppercase font-semibold">
              Phiên Giao Dịch Mỹ (ET)
            </div>
            <div className="text-[11px] font-bold text-slate-100 break-words">
              {usPulse.activeSessionLabelVi}
            </div>
          </div>

          {usPulse.extendedPrice !== null && (
            <div className="px-2 py-1 rounded-lg bg-violet-500/15 border border-violet-500/35 text-right font-mono shrink-0">
              <div className="text-[9px] text-violet-300">
                {usPulse.activeSession === 'PRE_MARKET' ? 'Pre-Market' : 'After-Hours'}
              </div>
              <div className="text-xs font-bold text-white">
                ${formatPrice(usPulse.extendedPrice)}{' '}
                {usPulse.extendedGapPct !== null && (
                  <span
                    className={
                      usPulse.extendedGapPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    ({usPulse.extendedGapPct >= 0 ? '+' : ''}
                    {usPulse.extendedGapPct}%)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Imminent Earnings Gap-Trap Alert Banner */}
      {usPulse?.isImminentEarningsTrap && usPulse.earningsWarningVi && (
        <div className="p-2.5 rounded-lg bg-rose-950/45 border border-rose-500/50 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-rose-300 uppercase">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />
            <span>Cảnh Báo Bẫy Nhảy Gap BCTC Mỹ</span>
          </div>
          <p className="text-[10px] text-rose-100/95 leading-relaxed break-words">
            {usPulse.earningsWarningVi}
          </p>
        </div>
      )}

      {/* CBOE Official Options Gamma Walls */}
      {usOpt && (
        <div className="p-2 rounded-lg bg-[#0b1324] border border-cyan-500/25 space-y-1.5">
          <div className="flex items-center justify-between gap-1.5 flex-wrap text-[10px]">
            <span className="font-bold text-cyan-200 flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>CBOE Gamma Walls ({usOpt.primaryExpiryIso})</span>
            </span>
            {usOpt.iv30Pct && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/35 text-[9px] font-mono text-cyan-300 shrink-0 whitespace-nowrap">
                IV30: {usOpt.iv30Pct}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
            <div className="p-1.5 rounded bg-[#070c16] border border-slate-800/80 min-w-0">
              <div className="text-[9px] text-sky-400 truncate">Put Wall</div>
              <div className="font-bold text-white truncate">
                {usOpt.putWallPrice ? `$${formatPrice(usOpt.putWallPrice)}` : '--'}
              </div>
            </div>
            <div className="p-1.5 rounded bg-[#070c16] border border-slate-800/80 min-w-0">
              <div className="text-[9px] text-amber-400 truncate">Max Pain</div>
              <div className="font-bold text-amber-300 truncate">
                {usOpt.maxPainPrice ? `$${formatPrice(usOpt.maxPainPrice)}` : '--'}
              </div>
            </div>
            <div className="p-1.5 rounded bg-[#070c16] border border-slate-800/80 min-w-0">
              <div className="text-[9px] text-pink-400 truncate">Call Wall</div>
              <div className="font-bold text-white truncate">
                {usOpt.callWallPrice ? `$${formatPrice(usOpt.callWallPrice)}` : '--'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap text-[9px] font-mono text-slate-300">
            <span>P/C OI: {usOpt.putCallOiRatio ?? '--'}</span>
            {usOpt.impliedMovePct && (
              <span className="text-amber-300 font-bold">
                Implied Move: ±{usOpt.impliedMovePct}%
              </span>
            )}
            {usOpt.netGexMillionUsd !== null && (
              <span
                className={
                  usOpt.netGexMillionUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }
              >
                Net GEX: {usOpt.netGexMillionUsd >= 0 ? '+' : ''}
                {usOpt.netGexMillionUsd}M
              </span>
            )}
          </div>
        </div>
      )}

      {/* Fundamental & Earnings Strip + S&P 500 Sector Regime */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
        <div className="p-2 rounded-lg bg-[#080d18] border border-slate-800/90 min-w-0">
          <div className="text-[9px] text-slate-400 flex items-center gap-1 truncate">
            <CalendarClock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Lịch BCTC / Định giá</span>
          </div>
          <div className="font-bold text-slate-100 truncate mt-0.5">
            {uq?.earningsDateIso
              ? `${uq.earningsDateIso}${uq.earningsSession ? ` (${uq.earningsSession})` : ''}`
              : uq?.forwardPe
              ? `Fwd P/E: ${uq.forwardPe}x`
              : 'SEC T+1 Chuẩn'}
          </div>
          <div className="text-[9px] text-slate-400 truncate">
            {uq?.analystTargetPrice
              ? `Target Phố Wall: $${formatPrice(uq.analystTargetPrice)}`
              : uq?.shortFloatPct
              ? `Short Float: ${uq.shortFloatPct}%`
              : 'Không biên trần/sàn'}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-[#080d18] border border-slate-800/90 min-w-0">
          <div className="text-[9px] text-slate-400 flex items-center gap-1 truncate">
            <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Sóng Ngành S&amp;P 500</span>
          </div>
          <div className="font-bold text-emerald-300 truncate mt-0.5">
            {usSector?.sectors[0]
              ? `#1 ${usSector.sectors[0].etfSymbol} (${usSector.sectors[0].rsVsSpyPct >= 0 ? '+' : ''}${usSector.sectors[0].rsVsSpyPct}% SPY)`
              : 'SPY Benchmark'}
          </div>
          <div className="text-[9px] text-slate-400 truncate flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
            <span>Off/Def: {usSector ? `${usSector.offenseVsDefenseSpreadPct >= 0 ? '+' : ''}${usSector.offenseVsDefenseSpreadPct}%` : '--'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
