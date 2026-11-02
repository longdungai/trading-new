import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Compass,
  Eye,
  EyeOff,
  Flame,
  Layers,
  Scale,
  ShieldAlert,
  Target,
  Users,
} from 'lucide-react';
import { Candle, MarketSymbol, Timeframe } from '../../types';
import {
  computeVn30BasisAnalytics,
  computeVnIntradaySessionPulse,
  computeVnPriceLimits,
  getVnStockSectorInfo,
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
} from '../../services/vnMarket/vnStockMicrostructure';
import {
  fetchVnStockInsights,
  VnStockInsightsPayload,
} from '../../services/vnMarket/vnStockInsightsClient';
import { evaluateVnComprehensiveTacticalReport } from '../../services/vnMarket/vnSelloffAndBottomEngine';
import {
  loadUserHoldings,
  USER_HOLDINGS_UPDATED_EVENT,
  UserHoldingItem,
} from '../../services/portfolio/holdingsRecoveryEngine';
import { formatPrice } from '../../utils/formatters';

interface VnStockQuickCardProps {
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
  candles: Candle[];
  mtfCandlesMap?: Partial<Record<Timeframe, Candle[]>>;
  showBottomFishingLines?: boolean;
  onToggleBottomFishingLines?: () => void;
  onQuickCreatePriceAlert?: (price: number) => void;
  onSelectSymbol: (sym: MarketSymbol) => void;
  onOpenVnMacroTab: () => void;
}

export const VnStockQuickCard: React.FC<VnStockQuickCardProps> = ({
  currentSymbol,
  symbols,
  candles,
  mtfCandlesMap,
  showBottomFishingLines = true,
  onToggleBottomFishingLines,
  onQuickCreatePriceAlert,
  onSelectSymbol,
  onOpenVnMacroTab,
}) => {
  const isVN = isVnStockOrIndexSymbol(currentSymbol);
  const symUpper = currentSymbol.symbol.toUpperCase();
  const isIndex = symUpper === 'VNINDEX' || symUpper === 'VN30';
  const isDeriv = isVnDerivativeSymbol(symUpper);
  const isCorporate = isVN && !isIndex && !isDeriv;

  const [insights, setInsights] = useState<VnStockInsightsPayload | null>(null);
  const [nowClock, setNowClock] = useState<Date>(() => new Date());
  const [activeTacticalTab, setActiveTacticalTab] = useState<
    'spot_cash' | 'bottom' | 'selloff' | 't2_atc'
  >('spot_cash');
  const [bottomBudgetInput, setBottomBudgetInput] = useState<string>('100');
  const [holdingsMap, setHoldingsMap] = useState<Record<string, UserHoldingItem>>(() =>
    loadUserHoldings()
  );

  useEffect(() => {
    const t = setInterval(() => setNowClock(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const syncHoldings = () => setHoldingsMap(loadUserHoldings());
    window.addEventListener(USER_HOLDINGS_UPDATED_EVENT, syncHoldings);
    return () => window.removeEventListener(USER_HOLDINGS_UPDATED_EVENT, syncHoldings);
  }, []);

  useEffect(() => {
    let active = true;
    if (!isCorporate) {
      setInsights(null);
      return;
    }
    void fetchVnStockInsights(symUpper, false).then((res) => {
      if (active) setInsights(res);
    });
    return () => {
      active = false;
    };
  }, [symUpper, isCorporate]);

  const priceLimits = useMemo(() => {
    if (!isVN) return null;
    return computeVnPriceLimits({
      symbol: symUpper,
      currentPrice: currentSymbol.price,
      change24hPct: currentSymbol.change24h,
      officialRefPrice: insights?.fundamentals?.officialRefPrice,
      officialCeilingPrice: insights?.fundamentals?.officialCeilingPrice,
      officialFloorPrice: insights?.fundamentals?.officialFloorPrice,
    });
  }, [
    isVN,
    symUpper,
    currentSymbol.price,
    currentSymbol.change24h,
    insights?.fundamentals?.officialRefPrice,
    insights?.fundamentals?.officialCeilingPrice,
    insights?.fundamentals?.officialFloorPrice,
  ]);

  const sessionPulse = useMemo(
    () => computeVnIntradaySessionPulse(candles, nowClock),
    [candles, nowClock]
  );

  const basisData = useMemo(
    () =>
      symUpper === 'VN30F1M' || symUpper === 'VN30' || symUpper === 'VNINDEX'
        ? computeVn30BasisAnalytics(symbols, nowClock)
        : null,
    [symUpper, symbols, nowClock]
  );

  const sectorInfo = useMemo(() => getVnStockSectorInfo(symUpper), [symUpper]);

  const parsedBudgetMillion = useMemo(() => {
    const n = Number(bottomBudgetInput);
    return Number.isFinite(n) && n >= 10 ? n : 100;
  }, [bottomBudgetInput]);

  const tacticalReport = useMemo(() => {
    if (!isVN) return null;
    return evaluateVnComprehensiveTacticalReport({
      symbolObj: currentSymbol,
      candles,
      mtfCandlesMap,
      allSymbols: symbols,
      vnInsights: insights,
      userHoldingsMap: holdingsMap,
      bottomBudgetMillionVnd: parsedBudgetMillion,
      now: nowClock,
    });
  }, [
    isVN,
    currentSymbol,
    candles,
    mtfCandlesMap,
    symbols,
    insights,
    holdingsMap,
    parsedBudgetMillion,
    nowClock,
  ]);

  if (!isVN || !priceLimits || !tacticalReport) return null;

  const unitSuffix = isIndex || isDeriv ? ' đ' : 'k';
  const liveColorClass =
    priceLimits.colorState === 'CEILING'
      ? 'text-fuchsia-400'
      : priceLimits.colorState === 'FLOOR'
      ? 'text-cyan-300'
      : priceLimits.colorState === 'UP'
      ? 'text-emerald-400'
      : priceLimits.colorState === 'DOWN'
      ? 'text-rose-400'
      : 'text-amber-300';

  const foreign = insights?.foreignFlow ?? null;
  const fund = insights?.fundamentals ?? null;
  const liqPt = insights?.liquidityAndPt ?? null;
  const corpEvents = insights?.corporateEvents ?? [];
  const imminentEvent =
    corpEvents.find((ev) => ev.isImminentExDateWarning) || corpEvents[0] || null;

  const {
    panicAndForceSell,
    bottomFishingPlan,
    t2CohortShock,
    atcDistortion,
    capitulationMeter,
    postCrashAndHedge,
    spotDailyCash,
  } = tacticalReport;

  return (
    <div className="p-3 sm:p-3.5 rounded-xl bg-[#0e1523] border border-rose-500/30 space-y-2.5 shadow-xl select-none min-w-0">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[10px] font-mono font-extrabold text-rose-200 shrink-0 whitespace-nowrap">
              🇻🇳 {priceLimits.board === 'HNX_DERIVATIVE' ? 'HNX PHÁI SINH' : priceLimits.board}
              {priceLimits.bandPct > 0 ? ` ±${priceLimits.bandPct}%` : ''}
            </span>
            {sectorInfo && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/35 text-[10px] font-bold text-indigo-200 shrink-0 whitespace-nowrap">
                {sectorInfo.shortName}
              </span>
            )}
          </div>
          <div className="text-[10.5px] text-slate-400 font-mono">
            {isDeriv
              ? 'Bước giá 0.1 điểm (100k/đ) • Ký quỹ ~17% • T+0'
              : isIndex
              ? 'Chỉ số thị trường cơ sở Sở GDCK TP.HCM'
              : `Bước giá ${(priceLimits.tickSize * 1000).toFixed(0)}đ • Lô chẵn 100 CP • T+2.5`}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenVnMacroTab}
          className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap transition"
          title="Mở Bảng Sóng 10 Ngành Việt Nam, Top Khối Ngoại & Basis VN30F1M"
        >
          <Compass className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>Sóng Ngành & KN</span>
          <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
        </button>
      </div>

      {/* Ceiling / Reference / Match / Floor Strip (Standard SSI iBoard Color Coding) */}
      {priceLimits.ceilingPrice !== null && priceLimits.floorPrice !== null && (
        <div className="grid grid-cols-4 gap-1.5 font-mono text-center">
          <div className="p-1.5 rounded-lg bg-[#090f1b] border border-fuchsia-500/30 min-w-0">
            <div className="text-[9px] text-fuchsia-300 font-sans font-bold">Trần</div>
            <div className="text-[11px] font-black text-fuchsia-400 truncate">
              {formatPrice(priceLimits.ceilingPrice)}
              {unitSuffix}
            </div>
          </div>

          <div className="p-1.5 rounded-lg bg-[#090f1b] border border-amber-500/30 min-w-0">
            <div className="text-[9px] text-amber-200 font-sans font-bold">Tham chiếu</div>
            <div className="text-[11px] font-black text-amber-300 truncate">
              {formatPrice(priceLimits.refPrice)}
              {unitSuffix}
            </div>
          </div>

          <div className="p-1.5 rounded-lg bg-[#090f1b] border border-slate-700 min-w-0">
            <div className="text-[9px] text-slate-400 font-sans font-bold">Khớp lệnh</div>
            <div className={`text-[11px] font-black truncate ${liveColorClass}`}>
              {formatPrice(priceLimits.currentPrice)}
              {unitSuffix}
            </div>
          </div>

          <div className="p-1.5 rounded-lg bg-[#090f1b] border border-cyan-500/30 min-w-0">
            <div className="text-[9px] text-cyan-200 font-sans font-bold">Sàn</div>
            <div className="text-[11px] font-black text-cyan-300 truncate">
              {formatPrice(priceLimits.floorPrice)}
              {unitSuffix}
            </div>
          </div>
        </div>
      )}

      {/* Floor-lock / Ceiling Warning */}
      {priceLimits.liquidityWarning && (
        <div className="p-2 rounded-lg bg-rose-950/35 border border-rose-500/45 text-[10.5px] text-rose-200 flex items-start gap-1.5 leading-relaxed break-words">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          <span className="min-w-0 flex-1">{priceLimits.liquidityWarning}</span>
        </div>
      )}

      {/* ==========================================================================
          NEW: 4-TAB VIETNAM INSTITUTIONAL & DAILY SPOT CASH COMMAND CENTER
          (1. Spot Tiền Mặt Hàng Ngày | 2. Rải Đinh Đáy | 3. Dự Đoán Bán Tháo | 4. T+2.5 & ATC)
         ========================================================================== */}
      <div className="p-2.5 rounded-xl bg-[#09101d] border border-teal-500/35 space-y-2.5 min-w-0">
        {/* Segmented Tactical Switcher */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-lg bg-[#060a13] border border-slate-800 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setActiveTacticalTab('spot_cash')}
            className={`py-1.5 px-1.5 rounded-md transition flex items-center justify-center gap-1 truncate ${
              activeTacticalTab === 'spot_cash'
                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3 h-3 shrink-0 text-emerald-400" />
            <span className="truncate">Spot Tiền Mặt</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTacticalTab('bottom')}
            className={`py-1.5 px-1.5 rounded-md transition flex items-center justify-center gap-1 truncate ${
              activeTacticalTab === 'bottom'
                ? 'bg-teal-500/25 text-teal-200 border border-teal-400/50 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Target className="w-3 h-3 shrink-0 text-teal-400" />
            <span className="truncate">Rải Đinh Đáy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTacticalTab('selloff')}
            className={`py-1.5 px-1.5 rounded-md transition flex items-center justify-center gap-1 truncate ${
              activeTacticalTab === 'selloff'
                ? 'bg-rose-500/25 text-rose-200 border border-rose-400/50 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3 h-3 shrink-0 text-rose-400" />
            <span className="truncate">
              Bán Tháo ({panicAndForceSell.forceSellProbabilityPct}%)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTacticalTab('t2_atc')}
            className={`py-1.5 px-1.5 rounded-md transition flex items-center justify-center gap-1 truncate ${
              activeTacticalTab === 't2_atc'
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3 shrink-0 text-amber-400" />
            <span className="truncate">T+2.5 &amp; ATC</span>
          </button>
        </div>

        {/* TAB 0: DAILY SPOT CASH TRADING ENGINE (100% CASH, ZERO LEVERAGE) */}
        {activeTacticalTab === 'spot_cash' && (
          <div className="space-y-2 text-[10.5px]">
            {/* 1. Active Symbol Daily Spot Pocket-Pivot & RS Alpha Evaluation */}
            <div
              className={`p-2 rounded-lg border space-y-1.5 ${
                spotDailyCash.dailySpotScanner.activeSymbolCandidate.setupStatus ===
                  'SWEET_SPOT_POCKET_PIVOT' ||
                spotDailyCash.dailySpotScanner.activeSymbolCandidate.setupStatus ===
                  'RS_LEADER_PULLBACK_BUY'
                  ? 'bg-emerald-950/40 border-emerald-500/45 text-emerald-100'
                  : spotDailyCash.dailySpotScanner.activeSymbolCandidate.setupStatus ===
                    'CHASING_CEILING_TRAP_AVOID'
                  ? 'bg-rose-950/45 border-rose-500/50 text-rose-100'
                  : 'bg-[#0c1628] border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="font-extrabold text-[10px] tracking-wide">
                  {spotDailyCash.dailySpotScanner.activeSymbolCandidate.setupBadgeVi}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 font-mono text-[9.5px] font-bold text-cyan-300">
                  Điểm Spot: {spotDailyCash.dailySpotScanner.activeSymbolCandidate.dailySpotScore}/100 • RS{' '}
                  {spotDailyCash.dailySpotScanner.activeSymbolCandidate.rsRatingScore}/99
                </span>
              </div>

              <div className="text-[10px] text-slate-300 leading-snug">
                {spotDailyCash.dailySpotScanner.activeSymbolCandidate.rationaleVi}
              </div>

              {!isIndex && !isDeriv && (
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px] pt-1">
                  <div className="p-1.5 rounded bg-[#070d18] border border-cyan-500/30">
                    <div className="text-[8.5px] text-slate-400 font-sans">Vùng Mua Spot</div>
                    <div className="font-bold text-cyan-300">
                      {formatPrice(spotDailyCash.dailySpotScanner.activeSymbolCandidate.spotBuyZone[0])}–
                      {formatPrice(spotDailyCash.dailySpotScanner.activeSymbolCandidate.spotBuyZone[1])}
                      {unitSuffix}
                    </div>
                  </div>
                  <div className="p-1.5 rounded bg-[#070d18] border border-emerald-500/30">
                    <div className="text-[8.5px] text-slate-400 font-sans">Chốt Tiền Mặt T+2.5</div>
                    <div className="font-bold text-emerald-300">
                      {formatPrice(spotDailyCash.dailySpotScanner.activeSymbolCandidate.spotTargetT2Price)}
                      {unitSuffix} (+
                      {spotDailyCash.dailySpotScanner.activeSymbolCandidate.expectedNetProfitPct}%)
                    </div>
                  </div>
                  <div className="p-1.5 rounded bg-[#070d18] border border-rose-500/30">
                    <div className="text-[8.5px] text-slate-400 font-sans">Cắt Lỗ Bảo Toàn</div>
                    <div className="font-bold text-rose-300">
                      {formatPrice(spotDailyCash.dailySpotScanner.activeSymbolCandidate.spotHardStopPrice)}
                      {unitSuffix}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Afternoon T+2.5 Settlement Advantage Window (13h45 - 14h25) */}
            <div className="p-2 rounded-lg bg-[#0c1628] border border-amber-500/35 space-y-1">
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="font-bold text-amber-200 text-[10px]">
                  {spotDailyCash.afternoonT2Window.windowBadgeVi}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[9px] font-bold">
                  Giải ngân tối đa: {spotDailyCash.afternoonT2Window.maxCashDeploymentNowPct}% ngăn hôm nay
                </span>
              </div>
              <div className="text-[9.5px] text-slate-300 leading-snug">
                {spotDailyCash.afternoonT2Window.tacticalAdviceVi}
              </div>
            </div>

            {/* 3. 3-Bucket Rolling Cash Carousel (33% - 33% - 34% Zero-Leverage) */}
            <div className="p-2 rounded-lg bg-[#070d18] border border-indigo-500/35 space-y-1.5">
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="font-bold text-indigo-200 text-[10px]">
                  🔄 Vòng Quay Vốn 3 Ngăn T+2.5 (100% Tiền Mặt • 0% Margin)
                </span>
                <span className="font-mono text-[9.5px] text-emerald-300 font-bold">
                  Tổng vốn: {spotDailyCash.rollingCashCarousel.totalSpotCapitalMillionVnd} Tr VNĐ
                </span>
              </div>
              <div className="text-[9.5px] text-cyan-200 font-semibold leading-snug">
                {spotDailyCash.rollingCashCarousel.carouselHeadlineVi}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-0.5">
                {spotDailyCash.rollingCashCarousel.buckets.map((b) => (
                  <div
                    key={b.bucketId}
                    className="p-1.5 rounded bg-[#0c1526] border border-slate-800 space-y-0.5"
                  >
                    <div className="text-[9px] font-bold text-slate-200 flex items-center justify-between">
                      <span>{b.labelVi}</span>
                      <span className="font-mono text-amber-300">{b.allocatedMillionVnd} Tr</span>
                    </div>
                    <div className="text-[9px] font-mono text-cyan-300 truncate">
                      {b.statusBadgeVi}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Zero-Leverage Inventory T+0 Cash Harvester */}
            {!isIndex && !isDeriv && (
              <div className="p-2 rounded-lg bg-[#0b1526] border border-cyan-500/35 space-y-1.5">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="font-bold text-cyan-200 text-[10px]">
                    {spotDailyCash.zeroLeverageT0Plan.modeBadgeVi}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[9.5px] font-bold">
                    Lãi ngay trong ngày: +
                    {spotDailyCash.zeroLeverageT0Plan.netDailyProfitThousandVnd.toLocaleString('en-US')}k (+
                    {spotDailyCash.zeroLeverageT0Plan.netSpreadAfterFeeTaxPct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-slate-300 flex-wrap">
                  <span>
                    Kho khả dụng:{' '}
                    <strong className="text-white">
                      {spotDailyCash.zeroLeverageT0Plan.settledSharesAvailable.toLocaleString('en-US')} CP
                    </strong>
                    {spotDailyCash.zeroLeverageT0Plan.isTemplateSimulation && ' (Mô phỏng chuẩn)'}
                  </span>
                  <span>
                    Lô lướt T+0:{' '}
                    <strong className="text-amber-300">
                      {spotDailyCash.zeroLeverageT0Plan.surfLotShares.toLocaleString('en-US')} CP
                    </strong>
                  </span>
                  <span>
                    Mua <strong className="text-emerald-300">{spotDailyCash.zeroLeverageT0Plan.intradayBuyPrice}k</strong> → Bán{' '}
                    <strong className="text-amber-300">{spotDailyCash.zeroLeverageT0Plan.intradaySellPrice}k</strong>
                  </span>
                </div>
                <div className="space-y-0.5 text-[9.5px] text-slate-300 leading-snug">
                  {spotDailyCash.zeroLeverageT0Plan.executionStepsVi.map((step, i) => (
                    <div key={i}>• {step}</div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Top Daily Spot Candidates & RS Leaders Across Market */}
            {spotDailyCash.dailySpotScanner.topDailySpotCandidates.length > 0 && (
              <div className="p-2 rounded-lg bg-[#070d18] border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="font-bold text-white text-[10px]">
                    🏆 Top Cổ Phiếu Điểm Nổ Spot &amp; Kháng Đỏ Hôm Nay
                  </span>
                  <span className="font-mono text-[9px] text-slate-400">
                    VN-Index: {spotDailyCash.dailySpotScanner.vnIndexChangePct >= 0 ? '+' : ''}
                    {spotDailyCash.dailySpotScanner.vnIndexChangePct.toFixed(2)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {spotDailyCash.dailySpotScanner.topDailySpotCandidates.map((cand) => {
                    const matched = symbols.find(
                      (s) => s.symbol.toUpperCase() === cand.symbol.toUpperCase()
                    );
                    return (
                      <button
                        key={cand.symbol}
                        type="button"
                        onClick={() => matched && onSelectSymbol(matched)}
                        className="p-1.5 rounded bg-[#0d172a] hover:bg-[#13223d] border border-slate-800 hover:border-emerald-500/40 text-left transition space-y-0.5"
                      >
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="font-black text-white">{cand.symbol}</span>
                          <span className="text-emerald-300 font-bold">
                            {cand.dailySpotScore}đ • RS {cand.rsRatingScore}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-[9px] text-slate-300">
                          <span>
                            Mua: {formatPrice(cand.spotBuyZone[0])}–{formatPrice(cand.spotBuyZone[1])}k
                          </span>
                          <span
                            className={
                              cand.rsAlphaVsVnIndexPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            Alpha {cand.rsAlphaVsVnIndexPct >= 0 ? '+' : ''}
                            {cand.rsAlphaVsVnIndexPct}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. Spot Cash-Lock Exit Ladder & Compounding Projection */}
            {!isIndex && !isDeriv && (
              <div className="p-2 rounded-lg bg-[#0a1322] border border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between gap-1.5 flex-wrap font-bold text-[10px] text-emerald-200">
                  <span>🔒 Kỷ Luật Khóa Lãi Tiền Mặt T+3 &amp; Lãi Kép Spot</span>
                  <span className="font-mono text-[9.5px] text-amber-300">
                    Hòa vốn thực: {formatPrice(spotDailyCash.spotCashLockPlan.trueBreakEvenPrice)}k
                  </span>
                </div>
                <div className="text-[9.5px] text-slate-300 leading-snug">
                  {spotDailyCash.spotCashLockPlan.disciplineRuleVi}
                </div>
                <div className="flex items-center justify-between gap-2 font-mono text-[9.5px] text-cyan-200 pt-0.5 flex-wrap">
                  <span>
                    📈 5 vòng T+3 (~1 tháng):{' '}
                    <strong className="text-emerald-300">
                      +{spotDailyCash.spotCashLockPlan.compounding5CyclesPct}% (+
                      {spotDailyCash.spotCashLockPlan.compounding5CyclesProfitMillionVnd} Tr)
                    </strong>
                  </span>
                  <span>
                    12 vòng (~1 quý):{' '}
                    <strong className="text-amber-300">
                      +{spotDailyCash.spotCashLockPlan.compounding12CyclesPct}% (+
                      {spotDailyCash.spotCashLockPlan.compounding12CyclesProfitMillionVnd} Tr)
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: SMART 3-RUNG BOTTOM-FISHING LIMIT LADDER ("RẢI ĐINH BẮT ĐÁY") */}
        {activeTacticalTab === 'bottom' && (
          <div className="space-y-2 text-[10.5px]">
            {/* Floor Absorption Status Banner */}
            <div
              className={`p-2 rounded-lg border space-y-1 ${
                bottomFishingPlan.floorAbsorptionState === 'FLOOR_LOCKED_NO_RESCUE'
                  ? 'bg-rose-950/45 border-rose-500/50 text-rose-100'
                  : bottomFishingPlan.floorAbsorptionState === 'FLOOR_RESCUE_ABSORPTION'
                  ? 'bg-emerald-950/45 border-emerald-500/50 text-emerald-100'
                  : 'bg-[#0c1628] border-slate-800 text-slate-200'
              }`}
            >
              <div className="font-extrabold text-[10px] tracking-wide">
                {bottomFishingPlan.floorAbsorptionBadgeVi}
              </div>
              <div className="text-[10px] text-slate-300 leading-snug">
                {bottomFishingPlan.floorAbsorptionDetailVi}
              </div>
            </div>

            {/* Budget Input & Chart Line Toggle */}
            {!isIndex && (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap bg-[#070c16] p-1.5 rounded-lg border border-slate-800/90">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Ngân sách bắt đáy:
                    </span>
                    <input
                      type="number"
                      min={10}
                      step={10}
                      value={bottomBudgetInput}
                      onChange={(e) => setBottomBudgetInput(e.target.value)}
                      className="w-16 px-1.5 py-0.5 rounded bg-[#10192b] border border-teal-500/40 text-teal-200 font-mono text-[10.5px] font-bold focus:outline-none"
                    />
                    <span className="text-[10px] font-mono text-slate-400">Tr VNĐ</span>
                  </div>

                  {onToggleBottomFishingLines && (
                    <button
                      type="button"
                      onClick={onToggleBottomFishingLines}
                      className={`px-2 py-0.5 rounded border text-[9.5px] font-bold flex items-center gap-1 transition ${
                        showBottomFishingLines
                          ? 'bg-teal-500/20 text-teal-200 border-teal-400/50'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                      title="Ẩn/Hiện đường Rải Đinh Bắt Đáy B1 & B2 trên đồ thị"
                    >
                      {showBottomFishingLines ? (
                        <Eye className="w-2.5 h-2.5" />
                      ) : (
                        <EyeOff className="w-2.5 h-2.5" />
                      )}
                      <span>Đường Bắt Đáy</span>
                    </button>
                  )}
                </div>

                {/* 3 Staggered Limit Order Rungs */}
                <div className="space-y-1.5">
                  {bottomFishingPlan.rungs.map((rung) => {
                    const isLocked = rung.status === 'LOCKED_WAIT_ABSORPTION';
                    return (
                      <div
                        key={rung.rungIndex}
                        className={`p-2 rounded-lg border space-y-1 ${
                          isLocked
                            ? 'bg-[#090f1a]/80 border-slate-800/90 opacity-85'
                            : 'bg-[#0c1729] border-teal-500/35'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-[10.5px]">
                            {rung.labelVi}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                              rung.status === 'UNLOCKED_RESCUE_CONFIRMED'
                                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40'
                                : isLocked
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/35'
                                : 'bg-teal-500/20 text-teal-200 border border-teal-500/35'
                            }`}
                          >
                            {rung.statusBadgeVi}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 font-mono text-[10.5px] flex-wrap">
                          <span>
                            Giá LO:{' '}
                            <strong className="text-teal-300">
                              {formatPrice(rung.limitPrice)}
                              {unitSuffix}
                            </strong>{' '}
                            <span className="text-rose-300 text-[9.5px]">
                              ({rung.discountFromRefPct >= 0 ? '+' : ''}
                              {rung.discountFromRefPct}% TC)
                            </span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-300">
                              KL:{' '}
                              <strong className="text-amber-300">
                                {rung.recommendedShares.toLocaleString('en-US')}{' '}
                                {isDeriv ? 'HĐ' : 'CP'}
                              </strong>{' '}
                              ({rung.capitalMillionVnd} Tr)
                            </span>
                            {onQuickCreatePriceAlert && (
                              <button
                                type="button"
                                onClick={() => onQuickCreatePriceAlert(rung.limitPrice)}
                                className="p-1 rounded bg-slate-800 hover:bg-teal-600/30 text-amber-300 border border-slate-700"
                                title={`Đặt chuông báo khi giá chạm Bậc ${rung.rungIndex} (${rung.limitPrice}${unitSuffix})`}
                              >
                                <Bell className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="text-[9.5px] text-slate-400 leading-snug">
                          Neo: <span className="text-slate-300">{rung.anchorVi}</span> •{' '}
                          {rung.executionConditionVi}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* T+2.5 Stress Test Box */}
                <div className="p-2 rounded-lg bg-[#070d18] border border-indigo-500/30 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-indigo-200 flex-wrap">
                    <span>🧪 Kiểm định chịu tải kẹp T+2.5 (Bậc 1+2):</span>
                    <span className="font-mono text-cyan-300">
                      Giá vốn TB: {formatPrice(bottomFishingPlan.t2StressTest.weightedAvgBuyPrice)}
                      {unitSuffix}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] pt-0.5">
                    <div className="p-1.5 rounded bg-rose-950/30 border border-rose-500/25">
                      <div className="text-[8.5px] text-slate-400 font-sans">
                        Nếu T+1 sàn thêm 1 cây ({bottomFishingPlan.t2StressTest.ifOneMoreFloorPrice}
                        {unitSuffix})
                      </div>
                      <div className="font-bold text-rose-300">
                        {bottomFishingPlan.t2StressTest.lossIfOneMoreFloorPct}% (
                        {bottomFishingPlan.t2StressTest.lossIfOneMoreFloorMillionVnd} Tr)
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-emerald-950/30 border border-emerald-500/25">
                      <div className="text-[8.5px] text-slate-400 font-sans">
                        Mục tiêu sóng hồi T+ ({bottomFishingPlan.t2StressTest.reboundTargetPrice}
                        {unitSuffix})
                      </div>
                      <div className="font-bold text-emerald-300">
                        +{bottomFishingPlan.t2StressTest.expectedReboundGainPct}% (+
                        {bottomFishingPlan.t2StressTest.expectedReboundProfitMillionVnd} Tr)
                      </div>
                    </div>
                  </div>
                  <div className="text-[9.5px] text-slate-400 leading-snug pt-0.5">
                    {bottomFishingPlan.t2StressTest.safetyNoteVi}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: PANIC SELLOFF, O'NEIL DISTRIBUTION DAYS, CAPITULATION METER & FTD/HEDGE */}
        {activeTacticalTab === 'selloff' && (
          <div className="space-y-2 text-[10.5px]">
            {/* Distribution Day & Force-Sell Risk Box */}
            <div
              className={`p-2 rounded-lg border space-y-1.5 ${
                panicAndForceSell.selloffRiskLevel === 'ACTIVE_FORCE_SELL_WAVE' ||
                panicAndForceSell.selloffRiskLevel === 'HIGH_SELLOFF_RISK'
                  ? 'bg-rose-950/45 border-rose-500/50 text-rose-100'
                  : panicAndForceSell.selloffRiskLevel === 'FORCE_SELL_EXHAUSTING'
                  ? 'bg-emerald-950/45 border-emerald-500/50 text-emerald-100'
                  : 'bg-[#0c1628] border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-extrabold text-[10px]">{panicAndForceSell.riskBadgeVi}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 font-mono text-[9.5px] font-bold text-amber-300">
                  PP: {panicAndForceSell.distributionDays25d}N + {panicAndForceSell.stallingDays25d}N
                  Kéo xả
                </span>
              </div>
              <div className="text-[10px] leading-snug">{panicAndForceSell.headlineVi}</div>
              {panicAndForceSell.bulletsVi.map((b, idx) => (
                <div key={idx} className="text-[9.5px] text-slate-300 leading-snug">
                  • {b}
                </div>
              ))}
              <div className="text-[9.5px] text-amber-200 pt-1 border-t border-slate-700/60 leading-snug">
                👉 {panicAndForceSell.actionGuidanceVi}
              </div>
            </div>

            {/* 4-Phase Capitulation & Washout Cycle Meter */}
            <div className="p-2 rounded-lg bg-[#070d18] border border-cyan-500/30 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-[10px] text-cyan-200">
                  {capitulationMeter.phaseBadgeVi}
                </span>
                <span className="font-mono text-[10px] font-black text-emerald-300">
                  Độ rũ bỏ: {capitulationMeter.washoutCompletionScore}/100
                </span>
              </div>
              <div className="text-[10px] text-slate-300 leading-snug">
                {capitulationMeter.headlineVi}
              </div>
              <div className="space-y-1 pt-0.5">
                {capitulationMeter.checklistVi.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 text-[9.5px] text-slate-300"
                  >
                    <CheckCircle2
                      className={`w-3 h-3 shrink-0 ${
                        item.passed ? 'text-emerald-400' : 'text-slate-600'
                      }`}
                    />
                    <span className={item.passed ? 'text-slate-200' : 'text-slate-500'}>
                      {item.labelVi}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Post-Crash FTD Tracker & Top 4 First-Mover Leaders */}
            <div className="p-2 rounded-lg bg-[#070d18] border border-amber-500/30 space-y-1.5">
              <div className="font-bold text-[10px] text-amber-300 flex items-center gap-1">
                <Flame className="w-3 h-3 shrink-0" />
                <span>{postCrashAndHedge.ftdBadgeVi}</span>
              </div>
              <div className="text-[9.5px] text-slate-300 leading-snug">
                {postCrashAndHedge.ftdGuidanceVi}
              </div>

              {postCrashAndHedge.firstMoverLeaders.length > 0 && (
                <div className="pt-1 border-t border-slate-800 space-y-1">
                  <div className="text-[9.5px] font-bold text-emerald-300">
                    🚀 Top Cổ Phiếu Bật Sớm / Giữ Nền Khỏe Nhất Khi Rũ Bỏ:
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {postCrashAndHedge.firstMoverLeaders.map((ldr) => (
                      <button
                        key={ldr.symbol}
                        type="button"
                        onClick={() => {
                          const found = symbols.find((s) => s.symbol === ldr.symbol);
                          if (found) onSelectSymbol(found);
                        }}
                        className="p-1.5 rounded bg-[#0d1729] hover:bg-[#142440] border border-slate-800 text-left transition"
                      >
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <strong className="text-cyan-300">{ldr.symbol}</strong>
                          <span
                            className={
                              ldr.change24hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {ldr.change24hPct >= 0 ? '+' : ''}
                            {ldr.change24hPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-[8.5px] text-slate-400 truncate">
                          Rút chân +{ldr.bounceFromLowPct}%
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Portfolio VN30F1M Beta Hedge Calculator */}
            <div className="p-2 rounded-lg bg-indigo-950/30 border border-indigo-500/40 space-y-1">
              <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-indigo-200 flex-wrap">
                <span>🛡️ Hộ Vệ Phái Sinh Short VN30F1M (Khi Kẹp T+2.5):</span>
                <span className="font-mono text-amber-300">
                  Short {postCrashAndHedge.betaHedgePlan.recommendedShortContractsHalfHedge}–
                  {postCrashAndHedge.betaHedgePlan.recommendedShortContractsFullHedge} HĐ
                </span>
              </div>
              <div className="text-[9.5px] text-slate-300 leading-snug">
                {postCrashAndHedge.betaHedgePlan.hedgeSummaryVi}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: T+2.5 COHORT SUPPLY SHOCK (13:00) & ATC DISTORTION SHIELD (14:30) */}
        {activeTacticalTab === 't2_atc' && (
          <div className="space-y-2 text-[10.5px]">
            {/* T+2.5 Afternoon Unlock Cohort Box */}
            <div
              className={`p-2 rounded-lg border space-y-1.5 ${
                t2CohortShock.supplyShockRegime === 'HIGH_PROFIT_TAKING_13H'
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-100'
                  : t2CohortShock.supplyShockRegime === 'PANIC_CUTLOSS_FLUSH_13H'
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-100'
                  : 'bg-[#0c1628] border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-extrabold text-[10px]">{t2CohortShock.badgeVi}</span>
                <span className="font-mono text-[9.5px] text-cyan-300">
                  Phiên T-2 ({t2CohortShock.tMinus2DateLabel}): {t2CohortShock.volumeVsAvgRatio}x
                  Vol
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 font-mono text-center text-[10px]">
                <div className="p-1 rounded bg-[#070c16] border border-slate-800">
                  <div className="text-[8.5px] text-slate-400 font-sans">VWAP T-2</div>
                  <div className="font-bold text-amber-300">
                    {formatPrice(t2CohortShock.tMinus2VwapPrice)}
                    {unitSuffix}
                  </div>
                </div>
                <div className="p-1 rounded bg-[#070c16] border border-slate-800">
                  <div className="text-[8.5px] text-slate-400 font-sans">Lãi/Lỗ Lô T-2</div>
                  <div
                    className={`font-bold ${
                      t2CohortShock.cohortFloatingPnlPct >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {t2CohortShock.cohortFloatingPnlPct >= 0 ? '+' : ''}
                    {t2CohortShock.cohortFloatingPnlPct}%
                  </div>
                </div>
                <div className="p-1 rounded bg-[#070c16] border border-slate-800">
                  <div className="text-[8.5px] text-slate-400 font-sans">Trạng thái 13:00</div>
                  <div className="font-bold text-cyan-300">
                    {t2CohortShock.isUnlockedInCurrentSession ? 'Đã về TK' : 'Chờ 13:00'}
                  </div>
                </div>
              </div>
              <div className="text-[9.5px] text-slate-300 leading-snug">
                👉 {t2CohortShock.tacticalAdviceVi}
              </div>
            </div>

            {/* ATC Distortion & Marking-the-Close Shield */}
            <div
              className={`p-2 rounded-lg border space-y-1.5 ${
                atcDistortion.distortionType === 'ARTIFICIAL_ATC_MARKUP'
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-100'
                  : atcDistortion.distortionType === 'ATC_MARKDOWN_TRAP'
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100'
                  : 'bg-[#0c1628] border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-extrabold text-[10px]">{atcDistortion.badgeVi}</span>
                <span className="font-mono text-[9.5px] text-slate-300">
                  Lệch VWAP: {atcDistortion.gapVsVwapPct >= 0 ? '+' : ''}
                  {atcDistortion.gapVsVwapPct}%
                </span>
              </div>
              <div className="text-[10px] leading-snug">{atcDistortion.headlineVi}</div>
              <div className="text-[9.5px] text-amber-200/95 leading-snug pt-1 border-t border-slate-800">
                🛡️ {atcDistortion.nextMorningGuidanceVi}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Imminent Shareholder Ex-Dividend / Rights Issue Anti-Trap Radar */}
      {isCorporate && imminentEvent && (
        <div
          className={`p-2 rounded-lg border text-[10.5px] space-y-1 min-w-0 ${
            imminentEvent.isImminentExDateWarning
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-100'
              : 'bg-[#090f1b] border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <span className="font-bold flex items-center gap-1 text-amber-300 min-w-0">
              <CalendarClock className="w-3 h-3 shrink-0" />
              <span className="truncate">{imminentEvent.typeLabelVi}</span>
            </span>
            {imminentEvent.effectiveDate && (
              <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 font-mono text-[9.5px] text-cyan-300 shrink-0 whitespace-nowrap">
                GDKHQ: {imminentEvent.effectiveDate}
                {imminentEvent.daysToExDate !== null && imminentEvent.daysToExDate >= 0
                  ? ` (${imminentEvent.daysToExDate}N)`
                  : ''}
              </span>
            )}
          </div>
          <div className="text-[10px] leading-snug break-words">{imminentEvent.note}</div>
          {imminentEvent.riskHint && (
            <div className="text-[9.5px] text-amber-200/95 leading-snug break-words pt-0.5 border-t border-amber-500/20">
              ⚠️ {imminentEvent.riskHint}
            </div>
          )}
        </div>
      )}

      {/* VN30F1M / VN30 Basis Quick Box */}
      {basisData && (
        <div className="p-2.5 rounded-lg bg-[#090f1b] border border-cyan-500/30 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10.5px] font-bold text-cyan-300 flex items-center gap-1">
              <Scale className="w-3 h-3 shrink-0" />
              <span>Basis VN30F1M − VN30:</span>
            </span>
            <span
              className={`font-mono text-xs font-black shrink-0 whitespace-nowrap ${
                basisData.basisPoints >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {basisData.basisPoints >= 0 ? '+' : ''}
              {basisData.basisPoints} đ ({basisData.basisPct >= 0 ? '+' : ''}
              {basisData.basisPct}%)
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 flex-wrap">
            <span>
              Đáo hạn: {basisData.expiryDateISO} ({basisData.daysToExpiry} ngày)
            </span>
            {symUpper !== 'VN30F1M' ? (
              <button
                type="button"
                onClick={() => {
                  const f = symbols.find((s) => s.symbol === 'VN30F1M');
                  if (f) onSelectSymbol(f);
                }}
                className="text-cyan-300 hover:underline font-mono font-bold"
              >
                Mở VN30F1M →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const s = symbols.find((x) => x.symbol === 'VN30');
                  if (s) onSelectSymbol(s);
                }}
                className="text-cyan-300 hover:underline font-mono font-bold"
              >
                So với VN30 →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Time-Normalized Intraday RVOL & T+2 Clock */}
      <div className="p-2 rounded-lg bg-[#090f1b] border border-slate-800 space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap text-[10.5px]">
          <span className="text-slate-300 font-semibold flex items-center gap-1 min-w-0">
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">{sessionPulse.phaseLabel}</span>
          </span>
          {sessionPulse.timeNormalizedRvol !== null && (
            <span
              className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold shrink-0 whitespace-nowrap ${
                sessionPulse.rvolState === 'EXPLOSIVE'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : sessionPulse.rvolState === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                  : sessionPulse.rvolState === 'DRY'
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-cyan-500/15 text-cyan-300'
              }`}
            >
              <Activity className="w-2.5 h-2.5 inline mr-0.5" />
              RVOL {sessionPulse.timeNormalizedRvol}x
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-400 leading-snug break-words">
          {sessionPulse.t2Note}
        </div>
      </div>

      {/* Corporate Foreign Flow & Fundamentals */}
      {isCorporate && (foreign || fund) && (
        <div className="space-y-2 pt-0.5 min-w-0">
          {foreign && (
            <div className="p-2 rounded-lg bg-[#090f1b] border border-slate-800 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap text-[10.5px]">
                <span className="font-bold text-slate-200 flex items-center gap-1">
                  <Users className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Khối ngoại ({foreign.latestDate.slice(5)}):</span>
                </span>
                <span
                  className={`font-mono font-black shrink-0 whitespace-nowrap ${
                    foreign.latestNetBillionVnd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {foreign.latestNetBillionVnd >= 0 ? '+' : ''}
                  {foreign.latestNetBillionVnd} tỷ VNĐ
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400 flex-wrap">
                <span>
                  10 phiên:{' '}
                  <strong
                    className={
                      foreign.total10dNetBillionVnd >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }
                  >
                    {foreign.total10dNetBillionVnd >= 0 ? '+' : ''}
                    {foreign.total10dNetBillionVnd} tỷ
                  </strong>
                </span>
                {foreign.remainingRoomPct !== null && (
                  <span>
                    Room còn: <strong className="text-amber-300">{foreign.remainingRoomPct}%</strong>
                  </span>
                )}
              </div>

              {liqPt && (liqPt.ptValueBillionVnd > 0 || liqPt.vwapPrice !== null) && (
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80 flex-wrap">
                  {liqPt.vwapPrice !== null && (
                    <span>
                      VWAP sàn:{' '}
                      <strong className="text-cyan-300">{formatPrice(liqPt.vwapPrice)}k</strong>
                    </span>
                  )}
                  <span>
                    Thỏa thuận:{' '}
                    <strong className="text-fuchsia-300">
                      {liqPt.ptValueBillionVnd.toFixed(2)} tỷ ({liqPt.ptSharePct}%)
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {fund && (
            <div className="grid grid-cols-4 gap-1.5 font-mono text-center">
              <div className="p-1.5 rounded-lg bg-[#090f1b] border border-slate-800 min-w-0">
                <div className="text-[8.5px] text-slate-400 font-sans">P/E</div>
                <div className="text-[11px] font-bold text-cyan-300 truncate">
                  {fund.peRatio !== null ? `${fund.peRatio}x` : '—'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#090f1b] border border-slate-800 min-w-0">
                <div className="text-[8.5px] text-slate-400 font-sans">P/B</div>
                <div className="text-[11px] font-bold text-sky-300 truncate">
                  {fund.pbRatio !== null ? `${fund.pbRatio}x` : '—'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#090f1b] border border-slate-800 min-w-0">
                <div className="text-[8.5px] text-slate-400 font-sans">ROE</div>
                <div className="text-[11px] font-bold text-emerald-400 truncate">
                  {fund.roePct !== null ? `${fund.roePct}%` : '—'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#090f1b] border border-slate-800 min-w-0">
                <div className="text-[8.5px] text-slate-400 font-sans flex items-center justify-center gap-0.5">
                  <Building2 className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span>Vốn hóa</span>
                </div>
                <div className="text-[10.5px] font-bold text-amber-300 truncate">
                  {fund.marketCapTrillionVnd !== null ? `${fund.marketCapTrillionVnd}k tỷ` : '—'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
