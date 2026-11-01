import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Coins,
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
import { formatPrice } from '../../utils/formatters';

interface GlobalCryptoAndWallStreetViewProps {
  symbols: MarketSymbol[];
  currentSymbol: MarketSymbol;
  activeCandles: Candle[];
  onSelectSymbol: (sym: MarketSymbol) => void;
  onClose: () => void;
}

export const GlobalCryptoAndWallStreetView: React.FC<GlobalCryptoAndWallStreetViewProps> = ({
  symbols,
  currentSymbol,
  activeCandles,
  onSelectSymbol,
  onClose,
}) => {
  const initialFocus: 'crypto' | 'wallstreet' = isUsOrGlobalEquitySymbol(currentSymbol)
    ? 'wallstreet'
    : 'crypto';

  const [focusDesk, setFocusDesk] = useState<'crypto' | 'wallstreet'>(initialFocus);
  const [cryptoData, setCryptoData] = useState<GlobalMarketInsightsResponse | null>(null);
  const [usData, setUsData] = useState<GlobalMarketInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const activeCryptoSymbol = useMemo(() => {
    if (isCryptoSymbol(currentSymbol)) return currentSymbol;
    return (
      symbols.find((s) => s.symbol === 'BTCUSDT') ||
      symbols.find((s) => s.type === 'crypto') ||
      currentSymbol
    );
  }, [currentSymbol, symbols]);

  const activeUsSymbol = useMemo(() => {
    if (isUsOrGlobalEquitySymbol(currentSymbol)) return currentSymbol;
    return (
      symbols.find((s) => s.symbol === 'NVDA') ||
      symbols.find((s) => s.symbol === 'SPY') ||
      currentSymbol
    );
  }, [currentSymbol, symbols]);

  const refreshBothDesks = async (force: boolean = false) => {
    setIsLoading(true);
    try {
      const [cRes, uRes] = await Promise.all([
        fetchGlobalMarketInsights(activeCryptoSymbol.symbol, force),
        fetchGlobalMarketInsights(activeUsSymbol.symbol, force),
      ]);
      if (cRes) setCryptoData(cRes);
      if (uRes) setUsData(uRes);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshBothDesks(false);
  }, [activeCryptoSymbol.symbol, activeUsSymbol.symbol]);

  const handleJump = (ticker: string) => {
    const found = symbols.find((s) => s.symbol.toUpperCase() === ticker.toUpperCase());
    if (found) {
      onSelectSymbol(found);
      onClose();
    }
  };

  const cryptoMacro = cryptoData?.cryptoMacro || usData?.cryptoMacro || null;
  const cryptoCycle = useMemo(
    () => computeCryptoCapitalCycle(symbols, cryptoMacro),
    [symbols, cryptoMacro]
  );
  const cryptoNarratives = useMemo(
    () => computeCryptoNarrativeRotation(symbols),
    [symbols]
  );
  const cryptoLiq = useMemo(
    () =>
      computeCryptoLiquidationAndCarry(
        activeCryptoSymbol.symbol,
        activeCryptoSymbol.price,
        isCryptoSymbol(currentSymbol) ? activeCandles : [],
        cryptoData?.perpCarry
      ),
    [activeCryptoSymbol, currentSymbol, activeCandles, cryptoData?.perpCarry]
  );

  const usSectorReport = useMemo(() => computeUsSectorRotation(symbols), [symbols]);
  const usPulse = useMemo(
    () =>
      computeUsExtendedHoursPulse(
        activeUsSymbol.symbol,
        activeUsSymbol.price,
        usData?.usQuote,
        usData?.optionsSummary?.impliedMovePct
      ),
    [activeUsSymbol, usData?.usQuote, usData?.optionsSummary?.impliedMovePct]
  );

  const globalIndices = useMemo(() => {
    const codes = ['SPY', 'QQQ', 'DIA', 'IWM', 'SOXX', 'N225', 'HSI', 'DAX'];
    return codes
      .map((code) => symbols.find((s) => s.symbol === code))
      .filter((s): s is MarketSymbol => Boolean(s));
  }, [symbols]);

  const cryptoOpt = cryptoData?.optionsSummary as CryptoOptionsSummary | null;
  const cboeOpt = usData?.optionsSummary as UsOptionsSummary | null;
  const upcomingEarnings = usData?.upcomingUsEarnings || [];

  return (
    <div className="space-y-4 min-w-0 select-none">
      {/* Sub-Navigation Bar */}
      <div className="p-2.5 rounded-xl bg-[#0c1424] border border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFocusDesk('crypto')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap border transition ${
              focusDesk === 'crypto'
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50 shadow-sm'
                : 'bg-[#090f1c] text-slate-400 hover:text-white border-slate-800'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Crypto 24/7 (Perps • Deribit Options • 6 Hệ Sinh Thái)</span>
          </button>

          <button
            type="button"
            onClick={() => setFocusDesk('wallstreet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap border transition ${
              focusDesk === 'wallstreet'
                ? 'bg-indigo-500/25 text-indigo-200 border-indigo-400/55 shadow-sm'
                : 'bg-[#090f1c] text-slate-400 hover:text-white border-slate-800'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Phố Wall & Quốc Tế (CBOE Gamma • 11 Ngành Mỹ • Lịch BCTC)</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => void refreshBothDesks(true)}
          disabled={isLoading}
          className="px-2.5 py-1.5 rounded-lg bg-[#111b30] hover:bg-[#172440] border border-slate-700 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Đồng bộ Options & Dòng tiền</span>
        </button>
      </div>

      {/* ================= DESK 1: CRYPTO 24/7 INSTITUTIONAL ================= */}
      {focusDesk === 'crypto' && (
        <div className="space-y-4">
          {/* 1. Capital Cycle Banner & 4 Core Macro KPIs */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0c1729] via-[#0e182c] to-[#11182b] border border-cyan-500/30 space-y-3">
            <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
              <div className="space-y-0.5 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                  Chu Kỳ Vốn Crypto & Thanh Khoản Stablecoin Thực Tế
                </div>
                <h3 className="text-sm font-extrabold text-white break-words">
                  {cryptoCycle.regimeLabelVi}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-200 border border-cyan-500/40 shrink-0 whitespace-nowrap">
                Alt Outperform BTC: {cryptoCycle.altBreadthAdvancersPct}%
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="p-2.5 rounded-xl bg-[#080d18] border border-slate-800 min-w-0">
                <div className="text-[10px] text-slate-400 truncate">BTC / ETH Dominance</div>
                <div className="text-sm font-extrabold text-amber-300 mt-0.5 truncate">
                  {cryptoCycle.btcDominancePct !== null
                    ? `${cryptoCycle.btcDominancePct}%`
                    : '--'}{' '}
                  <span className="text-xs text-slate-400 font-normal">
                    / {cryptoCycle.ethDominancePct !== null ? `${cryptoCycle.ethDominancePct}%` : '--'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">CoinGecko Global Live</div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#080d18] border border-slate-800 min-w-0">
                <div className="text-[10px] text-slate-400 truncate">Tỷ giá ETH/BTC</div>
                <div className="text-sm font-extrabold text-cyan-300 mt-0.5 truncate">
                  {cryptoCycle.ethBtcRatio ?? '--'}
                </div>
                <div
                  className={`text-[10px] truncate ${
                    cryptoCycle.ethVsBtc24hSpreadPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  24h vs BTC: {cryptoCycle.ethVsBtc24hSpreadPct >= 0 ? '+' : ''}
                  {cryptoCycle.ethVsBtc24hSpreadPct}%
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#080d18] border border-slate-800 min-w-0">
                <div className="text-[10px] text-slate-400 truncate">Tổng Cung Stablecoin</div>
                <div className="text-sm font-extrabold text-white mt-0.5 truncate">
                  {cryptoCycle.stablecoinTotalBillionUsd !== null
                    ? `$${cryptoCycle.stablecoinTotalBillionUsd}B`
                    : '--'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  USDT {cryptoMacro?.usdtBillionUsd ? `$${cryptoMacro.usdtBillionUsd}B` : '--'} • USDC{' '}
                  {cryptoMacro?.usdcBillionUsd ? `$${cryptoMacro.usdcBillionUsd}B` : '--'}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#080d18] border border-slate-800 min-w-0">
                <div className="text-[10px] text-slate-400 truncate">Đúc/Đốt Ròng 7 Ngày</div>
                <div
                  className={`text-sm font-extrabold mt-0.5 truncate ${
                    (cryptoCycle.stablecoin7dNetMintBillionUsd ?? 0) >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {cryptoCycle.stablecoin7dNetMintBillionUsd !== null
                    ? `${cryptoCycle.stablecoin7dNetMintBillionUsd >= 0 ? '+' : ''}$${cryptoCycle.stablecoin7dNetMintBillionUsd}B`
                    : '--'}
                </div>
                <div className="text-[10px] text-slate-500 truncate">DefiLlama Stablecoins</div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#070c16] border border-slate-800/80 text-xs text-slate-200 space-y-1 leading-relaxed">
              <div>{cryptoCycle.summaryVi}</div>
              <div className="text-cyan-300 font-semibold">💡 Khuyến nghị phân bổ: {cryptoCycle.allocationHintVi}</div>
            </div>
          </div>

          {/* 2. Side-by-Side: Perpetuals Carry & Liquidation Magnets + Deribit Options */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Perps Carry & Liquidation */}
            <div className="p-3.5 rounded-xl bg-[#0b1220] border border-slate-800 space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                  <Magnet className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Thanh Lý Đòn Bẩy & Funding ({activeCryptoSymbol.symbol})</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-cyan-300 shrink-0 whitespace-nowrap">
                  Kỳ Funding tới: {cryptoLiq.nextFundingCountdownVi}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="p-2 rounded-lg bg-[#070c15] border border-slate-800/90 min-w-0">
                  <div className="text-[10px] text-slate-400 truncate">Funding 8h</div>
                  <div
                    className={`font-bold mt-0.5 truncate ${
                      cryptoLiq.fundingRate8hPct >= 0.03
                        ? 'text-rose-400'
                        : cryptoLiq.fundingRate8hPct < 0
                        ? 'text-emerald-400'
                        : 'text-cyan-300'
                    }`}
                  >
                    {cryptoLiq.fundingRate8hPct >= 0 ? '+' : ''}
                    {cryptoLiq.fundingRate8hPct.toFixed(4)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#070c15] border border-slate-800/90 min-w-0">
                  <div className="text-[10px] text-slate-400 truncate">Lãi Carry Năm</div>
                  <div className="font-bold text-white mt-0.5 truncate">
                    {cryptoLiq.annualizedFundingPct >= 0 ? '+' : ''}
                    {cryptoLiq.annualizedFundingPct.toFixed(1)}%/năm
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#070c15] border border-slate-800/90 min-w-0">
                  <div className="text-[10px] text-slate-400 truncate">Perp-Spot Basis</div>
                  <div
                    className={`font-bold mt-0.5 truncate ${
                      cryptoLiq.perpSpotBasisPct >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {cryptoLiq.perpSpotBasisPct >= 0 ? '+' : ''}
                    {cryptoLiq.perpSpotBasisPct.toFixed(3)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/35 space-y-0.5 min-w-0">
                  <div className="text-[10px] text-rose-300 font-bold flex items-center gap-1">
                    <Flame className="w-3 h-3 shrink-0" />
                    <span>Vùng Quét Short (50x → 25x)</span>
                  </div>
                  <div className="text-white font-bold truncate">
                    ${formatPrice(cryptoLiq.shortLiq50x)} → ${formatPrice(cryptoLiq.shortLiq25x)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/35 space-y-0.5 min-w-0">
                  <div className="text-[10px] text-emerald-300 font-bold flex items-center gap-1">
                    <Flame className="w-3 h-3 shrink-0" />
                    <span>Vùng Quét Long (50x → 25x)</span>
                  </div>
                  <div className="text-white font-bold truncate">
                    ${formatPrice(cryptoLiq.longLiq50x)} → ${formatPrice(cryptoLiq.longLiq25x)}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 leading-relaxed break-words">
                {cryptoLiq.squeezeWarningVi}
              </div>
            </div>

            {/* Deribit Institutional Options */}
            <div className="p-3.5 rounded-xl bg-[#0b1220] border border-fuchsia-500/30 space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-fuchsia-400 shrink-0" />
                  <span>
                    Quyền Chọn Tổ Chức Deribit ({cryptoOpt?.underlyingCurrency || 'BTC'})
                  </span>
                </div>
                {cryptoOpt?.dvol30dPct && (
                  <span className="px-2 py-0.5 rounded bg-fuchsia-500/20 border border-fuchsia-500/40 text-[10px] font-mono font-bold text-fuchsia-200 shrink-0 whitespace-nowrap">
                    DVOL 30d: {cryptoOpt.dvol30dPct}%
                  </span>
                )}
              </div>

              {cryptoOpt ? (
                <>
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="p-2 rounded-lg bg-[#070c15] border border-sky-500/30 min-w-0">
                      <div className="text-[10px] text-sky-400 truncate">Put Wall (Đệm đỡ)</div>
                      <div className="text-sm font-extrabold text-white mt-0.5 truncate">
                        {cryptoOpt.putWallPrice ? `$${formatPrice(cryptoOpt.putWallPrice)}` : '--'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        OI: {cryptoOpt.putWallOi?.toLocaleString() ?? '--'} {cryptoOpt.underlyingCurrency}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#070c15] border border-amber-500/35 min-w-0">
                      <div className="text-[10px] text-amber-400 truncate">Max Pain ({cryptoOpt.primaryExpiryIso})</div>
                      <div className="text-sm font-extrabold text-amber-300 mt-0.5 truncate">
                        {cryptoOpt.maxPainPrice ? `$${formatPrice(cryptoOpt.maxPainPrice)}` : '--'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        P/C OI: {cryptoOpt.putCallOiRatio ?? '--'}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#070c15] border border-pink-500/30 min-w-0">
                      <div className="text-[10px] text-pink-400 truncate">Call Wall (Cản trên)</div>
                      <div className="text-sm font-extrabold text-white mt-0.5 truncate">
                        {cryptoOpt.callWallPrice ? `$${formatPrice(cryptoOpt.callWallPrice)}` : '--'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        OI: {cryptoOpt.callWallOi?.toLocaleString() ?? '--'} {cryptoOpt.underlyingCurrency}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#070c15] border border-slate-800 text-[11px] space-y-1 leading-relaxed">
                    <div className="font-bold text-fuchsia-200 flex items-center justify-between gap-2 flex-wrap">
                      <span>{cryptoOpt.gammaHeadlineVi}</span>
                      {cryptoOpt.totalNotionalBillionUsd && (
                        <span className="font-mono text-cyan-300 shrink-0">
                          Tổng Notional OI: ${cryptoOpt.totalNotionalBillionUsd}B
                        </span>
                      )}
                    </div>
                    <div className="text-slate-300">{cryptoOpt.actionableNoteVi}</div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  Đang tải sổ lệnh Quyền chọn Deribit trực tiếp...
                </div>
              )}
            </div>
          </div>

          {/* 3. 6-Ecosystem Crypto Narrative Rotation Matrix */}
          <div className="p-3.5 rounded-xl bg-[#0b1220] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ma Trận Luân Chuyển 6 Hệ Sinh Thái Crypto (Relative Strength vs BTC)</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Bấm vào mã bất kỳ để mở biểu đồ phân tích ngay
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {cryptoNarratives.map((bucket) => (
                <div
                  key={bucket.id}
                  className="p-3 rounded-xl bg-[#080d18] border border-slate-800/90 space-y-2 min-w-0 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 whitespace-nowrap ${
                          bucket.status === 'LEADING'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : bucket.status === 'IMPROVING'
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {bucket.status === 'LEADING'
                          ? '🔥 DẪN SÓNG'
                          : bucket.status === 'IMPROVING'
                          ? '↗ CẢI THIỆN'
                          : '⏳ YẾU HƠN BTC'}
                      </span>
                      <span
                        className={`text-xs font-mono font-extrabold shrink-0 whitespace-nowrap ${
                          bucket.rsVsBtcPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        RS vs BTC: {bucket.rsVsBtcPct >= 0 ? '+' : ''}
                        {bucket.rsVsBtcPct}%
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white leading-snug break-words">
                      {bucket.nameVi}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {bucket.tickers.map((t) => (
                      <button
                        key={t.symbol}
                        type="button"
                        onClick={() => handleJump(t.symbol)}
                        className="px-2 py-1 rounded-lg bg-[#10192c] hover:bg-cyan-500/20 border border-slate-700/80 hover:border-cyan-400/50 text-[10px] font-mono flex items-center gap-1 transition shrink-0"
                      >
                        <span className="font-bold text-white">
                          {t.symbol.replace(/USDT$/i, '')}
                        </span>
                        <span
                          className={
                            t.change24h >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'
                          }
                        >
                          {t.change24h >= 0 ? '+' : ''}
                          {t.change24h}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= DESK 2: WALL STREET & GLOBAL EQUITIES ================= */}
      {focusDesk === 'wallstreet' && (
        <div className="space-y-4">
          {/* 1. Global Equity Benchmarks Strip (US + Tokyo + Hong Kong + Frankfurt) */}
          <div className="p-3 rounded-xl bg-[#0b1220] border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                <Globe2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Chỉ Số Chứng Khoán Mỹ, Châu Á & Châu Âu Thời Gian Thực</span>
              </div>
              <span className="text-[10px] font-mono text-indigo-300">
                {usSectorReport.regimeLabelVi}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 font-mono text-xs">
              {globalIndices.map((idx) => (
                <button
                  key={idx.symbol}
                  type="button"
                  onClick={() => handleJump(idx.symbol)}
                  className="p-2 rounded-xl bg-[#070c16] hover:bg-indigo-500/15 border border-slate-800 hover:border-indigo-400/50 text-left transition min-w-0"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-white truncate">{idx.symbol}</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-500 shrink-0" />
                  </div>
                  <div className="text-[11px] text-slate-200 font-bold truncate mt-0.5">
                    {idx.symbol === 'N225' || idx.symbol === 'HSI' || idx.symbol === 'DAX'
                      ? formatPrice(idx.price)
                      : `$${formatPrice(idx.price)}`}
                  </div>
                  <div
                    className={`text-[10px] font-bold truncate ${
                      idx.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {idx.change24h >= 0 ? '+' : ''}
                    {idx.change24h}%
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Side-by-Side: Active US Stock CBOE Gamma & Extended-Hours + Upcoming Mega-Cap Earnings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Active US Symbol CBOE Options & Extended-Hours */}
            <div className="p-3.5 rounded-xl bg-[#0b1220] border border-indigo-500/35 space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    CBOE Options Gamma & Ngoài Giờ ({activeUsSymbol.symbol})
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/40 text-[10px] font-mono text-indigo-200 shrink-0 whitespace-nowrap">
                  {usPulse.activeSessionLabelVi}
                </span>
              </div>

              {usPulse.isImminentEarningsTrap && usPulse.earningsWarningVi && (
                <div className="p-2.5 rounded-lg bg-rose-950/45 border border-rose-500/50 text-[11px] text-rose-100 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed break-words">{usPulse.earningsWarningVi}</span>
                </div>
              )}

              {cboeOpt ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                  <div className="p-2 rounded-lg bg-[#070c16] border border-sky-500/30 min-w-0">
                    <div className="text-[10px] text-sky-400 truncate">Put Wall</div>
                    <div className="font-extrabold text-white mt-0.5 truncate">
                      {cboeOpt.putWallPrice ? `$${formatPrice(cboeOpt.putWallPrice)}` : '--'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#070c16] border border-amber-500/35 min-w-0">
                    <div className="text-[10px] text-amber-400 truncate">Max Pain</div>
                    <div className="font-extrabold text-amber-300 mt-0.5 truncate">
                      {cboeOpt.maxPainPrice ? `$${formatPrice(cboeOpt.maxPainPrice)}` : '--'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#070c16] border border-pink-500/30 min-w-0">
                    <div className="text-[10px] text-pink-400 truncate">Call Wall</div>
                    <div className="font-extrabold text-white mt-0.5 truncate">
                      {cboeOpt.callWallPrice ? `$${formatPrice(cboeOpt.callWallPrice)}` : '--'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#070c16] border border-cyan-500/30 min-w-0">
                    <div className="text-[10px] text-cyan-300 truncate">IV30 / Straddle</div>
                    <div className="font-extrabold text-cyan-200 mt-0.5 truncate">
                      {cboeOpt.iv30Pct ? `${cboeOpt.iv30Pct}%` : '--'}{' '}
                      {cboeOpt.impliedMovePct ? `(±${cboeOpt.impliedMovePct}%)` : ''}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[#070c16] border border-slate-800 text-xs text-slate-400">
                  Đang đồng bộ chuỗi Quyền chọn CBOE cho {activeUsSymbol.symbol}...
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded-lg bg-[#070c16] border border-slate-800 min-w-0">
                  <div className="text-[9px] text-slate-400 truncate">Pre / After-Hours</div>
                  <div className="font-bold text-violet-300 truncate mt-0.5">
                    {usPulse.extendedPrice !== null
                      ? `$${formatPrice(usPulse.extendedPrice)} (${(usPulse.extendedGapPct ?? 0) >= 0 ? '+' : ''}${usPulse.extendedGapPct ?? 0}%)`
                      : 'Khớp Phiên Chính'}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#070c16] border border-slate-800 min-w-0">
                  <div className="text-[9px] text-slate-400 truncate">Forward P/E</div>
                  <div className="font-bold text-white truncate mt-0.5">
                    {usData?.usQuote?.forwardPe ? `${usData.usQuote.forwardPe}x` : '--'}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#070c16] border border-slate-800 min-w-0">
                  <div className="text-[9px] text-slate-400 truncate">Short Float %</div>
                  <div className="font-bold text-amber-300 truncate mt-0.5">
                    {usData?.usQuote?.shortFloatPct ? `${usData.usQuote.shortFloatPct}%` : '--'}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#070c16] border border-slate-800 min-w-0">
                  <div className="text-[9px] text-slate-400 truncate">Target 1Y Phố Wall</div>
                  <div className="font-bold text-emerald-300 truncate mt-0.5">
                    {usData?.usQuote?.analystTargetPrice
                      ? `$${formatPrice(usData.usQuote.analystTargetPrice)}`
                      : '--'}
                  </div>
                </div>
              </div>

              {cboeOpt && (
                <div className="p-2.5 rounded-lg bg-[#070c16] border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  <div className="font-bold text-cyan-200">{cboeOpt.gammaHeadlineVi}</div>
                  <div>{cboeOpt.actionableNoteVi}</div>
                </div>
              )}
            </div>

            {/* Upcoming Wall Street Earnings Gap-Trap Calendar */}
            <div className="p-3.5 rounded-xl bg-[#0b1220] border border-amber-500/30 space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Radar Lịch Báo Cáo Tài Chính Phố Wall (5 Phiên Tới)</span>
                </div>
                <span className="text-[10px] font-mono text-amber-300 shrink-0 whitespace-nowrap">
                  BMO = Trước 09:30 ET • AMC = Sau 16:00 ET
                </span>
              </div>

              {upcomingEarnings.length > 0 ? (
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {upcomingEarnings.map((row) => (
                    <div
                      key={`${row.symbol}_${row.earningsDateIso}`}
                      onClick={() => handleJump(row.symbol)}
                      className="p-2 rounded-lg bg-[#070c16] hover:bg-amber-500/10 border border-slate-800/90 hover:border-amber-500/40 flex items-center justify-between gap-2 cursor-pointer transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/40 font-mono font-bold text-[11px] text-indigo-200 shrink-0">
                            {row.symbol}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                              row.session === 'BMO'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/35'
                                : row.session === 'AMC'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/35'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {row.session}
                          </span>
                          <span className="text-xs text-slate-200 font-semibold truncate">
                            {row.companyName}
                          </span>
                        </div>
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <div className="text-[11px] font-bold text-amber-300 whitespace-nowrap">
                          {row.earningsDateIso}
                        </div>
                        <div className="text-[10px] text-slate-400 whitespace-nowrap">
                          EPS Est: {row.epsForecast}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 rounded-lg bg-[#070c16] border border-slate-800 text-center text-xs text-slate-400">
                  Không có mã vốn hóa lớn nào trong rổ theo dõi công bố BCTC sát ngày hôm nay hoặc đang tải từ Nasdaq...
                </div>
              )}

              <div className="p-2 rounded-lg bg-[#070c16] border border-slate-800 text-[10px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Quy tắc Phố Wall: Thanh toán bù trừ <b>SEC T+1</b> • Tài khoản Margin dưới{' '}
                  <b>$25,000</b> giới hạn tối đa 3 lệnh Day-Trade (T+0) trong 5 phiên làm việc (FINRA PDT).
                </span>
              </div>
            </div>
          </div>

          {/* 3. 11 S&P 500 Sector SPDR ETFs + SOXX Relative Strength Matrix */}
          <div className="p-3.5 rounded-xl bg-[#0b1220] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ma Trận Luân Chuyển 11 Ngành S&amp;P 500 SPDR + Bán Dẫn SOXX (RS vs SPY)</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-mono font-bold text-emerald-300 shrink-0 whitespace-nowrap">
                Offense vs Defense Spread: {usSectorReport.offenseVsDefenseSpreadPct >= 0 ? '+' : ''}
                {usSectorReport.offenseVsDefenseSpreadPct}%
              </span>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed">{usSectorReport.summaryVi}</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {usSectorReport.sectors.map((sec, idx) => (
                <button
                  key={sec.etfSymbol}
                  type="button"
                  onClick={() => handleJump(sec.etfSymbol)}
                  className="p-2.5 rounded-xl bg-[#070c16] hover:bg-indigo-500/15 border border-slate-800 hover:border-indigo-400/50 text-left transition min-w-0 space-y-1"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-mono text-slate-500">#{idx + 1}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono font-bold text-xs text-white shrink-0">
                        {sec.etfSymbol}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                          sec.sectorStyle === 'OFFENSIVE'
                            ? 'bg-cyan-500/15 text-cyan-300'
                            : sec.sectorStyle === 'CYCLICAL'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-purple-500/15 text-purple-300'
                        }`}
                      >
                        {sec.sectorStyle === 'OFFENSIVE'
                          ? 'Tấn công'
                          : sec.sectorStyle === 'CYCLICAL'
                          ? 'Chu kỳ'
                          : 'Phòng thủ'}
                      </span>
                    </div>

                    <span
                      className={`font-mono text-xs font-extrabold shrink-0 whitespace-nowrap ${
                        sec.rsVsSpyPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {sec.rsVsSpyPct >= 0 ? '+' : ''}
                      {sec.rsVsSpyPct}%
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-200 font-semibold truncate">
                    {sec.sectorNameVi}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>${formatPrice(sec.price)}</span>
                    <span className={sec.change24hPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                      24h: {sec.change24hPct >= 0 ? '+' : ''}
                      {sec.change24hPct}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
