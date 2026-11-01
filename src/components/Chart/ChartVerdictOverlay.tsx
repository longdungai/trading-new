import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  EyeOff,
  Play,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { ChartRecommendationVerdict } from '../../services/ai/chartVerdictEngine';
import {
  PositionRecoveryPlan,
  removeUserHolding,
  saveUserHolding,
} from '../../services/portfolio/holdingsRecoveryEngine';
import { addUserPaperTrade } from '../../services/paperTrading/userPaperTrading';
import { isVnDerivativeSymbol, isVnStockOrIndexSymbol } from '../../services/vnMarket/vnStockMicrostructure';
import { formatPrice } from '../../utils/formatters';

interface ChartVerdictOverlayProps {
  verdict: ChartRecommendationVerdict | null;
  recoveryPlan?: PositionRecoveryPlan | null;
  quoteAsset?: string;
  showPlanLines?: boolean;
  onTogglePlanLines?: () => void;
  onOpenFullRecoveryTab?: () => void;
  onQuickCreatePriceAlert?: (price: number) => void;
}

const HUD_EXPANDED_KEY = 'trading_new_verdict_hud_expanded_v1';

export const ChartVerdictOverlay: React.FC<ChartVerdictOverlayProps> = ({
  verdict,
  recoveryPlan = null,
  quoteAsset = 'USD',
  showPlanLines = true,
  onTogglePlanLines,
  onOpenFullRecoveryTab,
  onQuickCreatePriceAlert,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(HUD_EXPANDED_KEY) === '1';
  });
  const [isHoldingPopoverOpen, setIsHoldingPopoverOpen] = useState<boolean>(false);
  const [quickQty, setQuickQty] = useState<string>('');
  const [quickAvg, setQuickAvg] = useState<string>('');
  const [paperSuccessToast, setPaperSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (recoveryPlan) {
      setQuickQty(String(recoveryPlan.holding.quantity));
      setQuickAvg(String(recoveryPlan.holding.avgCostPrice));
    } else if (verdict) {
      const vnSym = isVnStockOrIndexSymbol(verdict.symbol);
      setQuickQty(vnSym ? '1000' : '10');
      setQuickAvg('');
    }
    setIsHoldingPopoverOpen(false);
  }, [verdict?.symbol, recoveryPlan?.holding.quantity, recoveryPlan?.holding.avgCostPrice]);

  if (!verdict || verdict.pillars.length === 0) return null;

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(HUD_EXPANDED_KEY, next ? '1' : '0');
      } catch {
        // ignore storage quota
      }
      return next;
    });
  };

  const isVN = isVnStockOrIndexSymbol(verdict.symbol) || quoteAsset === 'VND';
  const isVnIdxOrDeriv =
    ['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX'].includes(verdict.symbol) ||
    isVnDerivativeSymbol(verdict.symbol);
  const prefix = isVN ? '' : '$';
  const suffix = isVN ? (isVnIdxOrDeriv ? ' đ' : 'k') : '';

  const fmtP = (val: number) => `${prefix}${formatPrice(val)}${suffix}`;

  const isBullVerdict =
    verdict.verdictCode === 'STRONG_BUY' || verdict.verdictCode === 'ACCUMULATE_LIMIT';
  const isBearVerdict =
    verdict.verdictCode === 'SELL_SHORT' || verdict.verdictCode === 'REDUCE_TAKE_PROFIT';
  const isVetoed = verdict.verdictCode === 'STAND_ASIDE_VETO';

  const badgeTheme =
    verdict.verdictCode === 'STRONG_BUY'
      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60 shadow-emerald-500/20'
      : verdict.verdictCode === 'ACCUMULATE_LIMIT'
      ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 shadow-cyan-500/20'
      : verdict.verdictCode === 'SELL_SHORT'
      ? 'bg-rose-500/25 text-rose-200 border-rose-400/60 shadow-rose-500/20'
      : verdict.verdictCode === 'REDUCE_TAKE_PROFIT'
      ? 'bg-amber-500/25 text-amber-200 border-amber-400/60 shadow-amber-500/20'
      : isVetoed
      ? 'bg-rose-950/90 text-amber-200 border-rose-400/60'
      : 'bg-slate-800/90 text-slate-200 border-slate-600/60';

  const canExecutePaperOrder =
    verdict.verdictCode === 'STRONG_BUY' ||
    verdict.verdictCode === 'ACCUMULATE_LIMIT' ||
    (verdict.verdictCode === 'SELL_SHORT' && verdict.canShortAsset);

  const handleQuickPaperTrade = () => {
    if (!canExecutePaperOrder) return;
    const isLimitPullback = verdict.verdictCode === 'ACCUMULATE_LIMIT';
    const entryPrice = isLimitPullback ? verdict.entryZone[1] : verdict.currentPrice;

    addUserPaperTrade({
      symbol: verdict.symbol,
      strategyName: `🏛️ Hợp Nhất 6 Tầng (${verdict.verdictLabelVi})`,
      strategyId: 'unified_institutional_verdict',
      action: verdict.isShortPlan ? 'SELL' : 'BUY',
      entryType: isLimitPullback ? 'limit' : 'market',
      entryPrice,
      currentMarketPrice: verdict.currentPrice,
      stopLoss: verdict.stopLoss,
      takeProfit: verdict.takeProfit2,
      tpTargetLabel: 'TP2',
      capital: isVN ? 10_000_000 : 1_000,
      leverage: 1,
      quoteAsset: isVN ? 'VND' : quoteAsset,
    });

    setPaperSuccessToast(
      isLimitPullback
        ? `Đã đặt Limit gom tại ${fmtP(entryPrice)}`
        : `Đã khớp lệnh Paper tại ${fmtP(entryPrice)}`
    );
    setTimeout(() => setPaperSuccessToast(null), 2800);
  };

  const slPct =
    verdict.entryMidPrice > 0
      ? ((verdict.stopLoss - verdict.entryMidPrice) / verdict.entryMidPrice) * 100
      : 0;
  const tp1Pct =
    verdict.entryMidPrice > 0
      ? ((verdict.takeProfit1 - verdict.entryMidPrice) / verdict.entryMidPrice) * 100
      : 0;
  const tp2Pct =
    verdict.entryMidPrice > 0
      ? ((verdict.takeProfit2 - verdict.entryMidPrice) / verdict.entryMidPrice) * 100
      : 0;

  return (
    <div className="w-full select-none flex flex-col items-start">
      {/* COMPACT HUD PILL ROW (Always visible, 0 overlap with drawing rail, OHLCV, or price axis) */}
      <div className="pointer-events-auto max-w-full flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#070d19]/92 backdrop-blur-md border border-slate-700/80 shadow-xl">
        {/* Verdict Badge */}
        <button
          type="button"
          onClick={toggleExpand}
          className={`px-2 py-0.5 rounded-lg border text-[10.5px] font-black uppercase tracking-wide flex items-center gap-1 shrink-0 whitespace-nowrap shadow-sm transition ${badgeTheme}`}
          title="Nhấp để xem chi tiết Hội đồng Khuyến nghị 6 tầng dữ liệu"
        >
          {isBullVerdict ? (
            <TrendingUp className="w-3 h-3 shrink-0" />
          ) : isBearVerdict ? (
            <TrendingDown className="w-3 h-3 shrink-0" />
          ) : isVetoed ? (
            <ShieldAlert className="w-3 h-3 shrink-0 text-rose-300" />
          ) : (
            <Sparkles className="w-3 h-3 shrink-0 text-cyan-300" />
          )}
          <span>{verdict.verdictLabelVi}</span>
        </button>

        {/* Conviction & Allocation Pill */}
        <span className="px-1.5 py-0.5 rounded-md bg-slate-900/90 border border-slate-700/80 text-[10px] font-mono font-bold text-slate-200 shrink-0 whitespace-nowrap">
          Tin cậy:{' '}
          <span
            className={
              verdict.convictionScore >= 72
                ? 'text-emerald-300'
                : verdict.convictionScore >= 58
                ? 'text-cyan-300'
                : 'text-amber-300'
            }
          >
            {verdict.convictionScore}/100
          </span>
          {verdict.suggestedAllocationPct > 0 && (
            <span className="text-slate-400"> • Vốn {verdict.suggestedAllocationPct}%</span>
          )}
        </span>

        {/* Compact Key Levels or Primary Reason */}
        {verdict.hasActionablePlan ? (
          <div className="hidden lg:flex items-center gap-1.5 text-[10.5px] font-mono text-slate-300 min-w-0">
            <span>
              {verdict.verdictCode === 'REDUCE_TAKE_PROFIT' ? 'Hạ vùng:' : 'Entry:'}{' '}
              <strong className="text-sky-300">
                {fmtP(verdict.entryZone[0])}–{fmtP(verdict.entryZone[1])}
              </strong>
            </span>
            <span className="text-slate-600">•</span>
            <span>
              SL: <strong className="text-rose-300">{fmtP(verdict.stopLoss)}</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span>
              {verdict.verdictCode === 'REDUCE_TAKE_PROFIT' ? 'Gom lại:' : 'TP2:'}{' '}
              <strong className="text-emerald-300">{fmtP(verdict.takeProfit2)}</strong>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[9.5px] font-bold shrink-0">
              R:R 1:{verdict.riskRewardRatio}
            </span>
          </div>
        ) : (
          <span className="hidden lg:inline text-[10.5px] text-amber-200/90 truncate max-w-[330px]">
            {verdict.vetoes[0]?.titleVi || verdict.verdictTaglineVi}
          </span>
        )}

        {verdict.isReplayMode && (
          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/50 text-purple-200 text-[9.5px] font-mono font-bold shrink-0 whitespace-nowrap">
            REPLAY ZERO LOOK-AHEAD
          </span>
        )}

        {/* Toggle On-Chart Plan Lines */}
        {onTogglePlanLines && (
          <button
            type="button"
            onClick={onTogglePlanLines}
            className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap transition ${
              showPlanLines
                ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Bật/Tắt vẽ đường vùng Entry, Cắt lỗ (SL) và Chốt lời (TP1/TP2) trực tiếp trên biểu đồ nến"
          >
            {showPlanLines ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span className="hidden sm:inline">Đường Lệnh</span>
          </button>
        )}

        {/* Personal Holding & Break-Even Recovery Pill */}
        <button
          type="button"
          onClick={() => setIsHoldingPopoverOpen((v) => !v)}
          className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap transition ${
            recoveryPlan
              ? recoveryPlan.netUnrealizedPnlPct >= 0
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50'
                : 'bg-amber-500/20 text-amber-200 border-amber-400/55'
              : 'bg-[#131d2f] hover:bg-[#1a2842] text-amber-200 border-amber-500/35'
          }`}
          title="Nhập khối lượng & giá vốn đang nắm giữ để xem lộ trình Về Bờ thông minh"
        >
          <Briefcase className="w-3 h-3 shrink-0" />
          {recoveryPlan ? (
            <span className="font-mono">
              Giữ {recoveryPlan.holding.quantity.toLocaleString('en-US')}{' '}
              {recoveryPlan.quantityLabel} •{' '}
              <strong
                className={
                  recoveryPlan.netUnrealizedPnlPct >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }
              >
                {recoveryPlan.netUnrealizedPnlPct >= 0 ? '+' : ''}
                {recoveryPlan.netUnrealizedPnlPct}%
              </strong>
            </span>
          ) : (
            <span>Nhập Giá Vốn / Về Bờ</span>
          )}
        </button>

        {/* Expand / Collapse Details Button */}
        <button
          type="button"
          onClick={toggleExpand}
          className="px-2 py-0.5 rounded-lg bg-[#111b2e] hover:bg-[#182640] border border-cyan-500/40 text-cyan-200 text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap transition"
        >
          <span>{isExpanded ? 'Thu gọn' : 'Luận cứ 6 tầng'}</span>
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* INLINE QUICK HOLDING INPUT & RECOVERY POPOVER ON CHART */}
      {isHoldingPopoverOpen && (
        <div className="pointer-events-auto mt-1.5 w-full max-w-[490px] rounded-2xl bg-[#070d19]/96 backdrop-blur-xl border border-amber-500/50 shadow-2xl p-3 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-amber-200 flex items-center gap-1.5 text-[11px]">
              <Briefcase className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Vị thế đang nắm giữ & Chiến lược Về Bờ ({verdict.symbol})</span>
            </span>
            {onOpenFullRecoveryTab && (
              <button
                type="button"
                onClick={() => {
                  setIsHoldingPopoverOpen(false);
                  onOpenFullRecoveryTab();
                }}
                className="text-[10px] font-bold text-cyan-300 hover:underline shrink-0"
              >
                Mở bảng chi tiết 3 phương án ↗
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = Number(quickQty.replace(/,/g, '').trim());
              const a = Number(quickAvg.replace(/,/g, '').trim());
              if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(a) || a <= 0) return;
              saveUserHolding(
                {
                  symbol: verdict.symbol,
                  quantity: q,
                  avgCostPrice: a,
                  marginRatioPct: recoveryPlan?.holding.marginRatioPct ?? 0,
                  holdingDays: recoveryPlan?.holding.holdingDays ?? 5,
                  extraDcaBudget: recoveryPlan?.holding.extraDcaBudget ?? null,
                },
                verdict.currentPrice
              );
            }}
            className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-end"
          >
            <div className="sm:col-span-4 min-w-0">
              <label className="text-[9.5px] text-slate-400 block mb-0.5">Khối lượng giữ</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={quickQty}
                onChange={(e) => setQuickQty(e.target.value)}
                className="w-full px-2 py-1 rounded-lg bg-[#121c30] border border-slate-700 text-white font-mono text-[11px] focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-5 min-w-0">
              <label className="text-[9.5px] text-slate-400 block mb-0.5">
                Giá vốn TB ({isVN && !isVnIdxOrDeriv ? 'nghìn đ/CP' : isVN ? 'điểm' : 'USD'})
              </label>
              <input
                type="number"
                step="any"
                min="0.0000001"
                required
                value={quickAvg}
                onChange={(e) => setQuickAvg(e.target.value)}
                placeholder={`VD: ${(verdict.currentPrice * 1.07).toFixed(isVN ? 1 : 2)}`}
                className="w-full px-2 py-1 rounded-lg bg-[#121c30] border border-slate-700 text-white font-mono text-[11px] focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-3 flex items-center gap-1">
              <button
                type="submit"
                className="flex-1 py-1 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] transition whitespace-nowrap"
              >
                Tính Về Bờ
              </button>
              {recoveryPlan && (
                <button
                  type="button"
                  onClick={() => removeUserHolding(verdict.symbol)}
                  className="p-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 text-rose-300"
                  title="Xóa vị thế"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          {recoveryPlan && (
            <div className="p-2 rounded-xl bg-[#0d1628] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap font-mono text-[10.5px]">
                <span>
                  Hòa vốn thực: <strong className="text-amber-300">{fmtP(recoveryPlan.trueBreakEvenPrice)}</strong>
                  {recoveryPlan.gainRequiredToBreakEvenPct > 0 && (
                    <span className="text-slate-400"> (cần +{recoveryPlan.gainRequiredToBreakEvenPct}%)</span>
                  )}
                </span>
                <span
                  className={`font-bold ${
                    recoveryPlan.netUnrealizedPnlValue >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {recoveryPlan.netUnrealizedPnlValue >= 0 ? '+' : ''}
                  {recoveryPlan.netUnrealizedPnlValue.toLocaleString('en-US')}{' '}
                  {recoveryPlan.currencyUnitLabel}
                </span>
              </div>

              <div className="text-[10.5px] font-bold text-cyan-200">
                ➜ {recoveryPlan.primaryBadgeVi}
              </div>
              <div className="text-[10.5px] text-slate-300 leading-relaxed">
                {recoveryPlan.actionStepsVi[0]}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXPANDED 6-PILLAR INSTITUTIONAL VERDICT PANEL */}
      {isExpanded && (
        <div className="pointer-events-auto mt-1.5 w-full max-w-[560px] max-h-[calc(100vh-230px)] overflow-y-auto rounded-2xl bg-[#070d19]/95 backdrop-blur-xl border border-slate-700/90 shadow-2xl p-3 space-y-2.5 text-xs">
          {/* Strategy Guidance & Capital Allocation */}
          <div className="p-2.5 rounded-xl bg-[#0c1526] border border-slate-800 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Chiến lược Thực thi & Phân bổ Vốn</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/35 text-cyan-200 text-[10px] font-mono font-bold shrink-0 whitespace-nowrap">
                {verdict.leverageGuidanceVi}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{verdict.executionStyleVi}</p>
          </div>

          {/* Active Risk Vetoes / Guardrails */}
          {verdict.vetoes.length > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-950/45 border border-amber-500/45 space-y-1">
              {verdict.vetoes.map((v) => (
                <div key={v.code} className="flex items-start gap-1.5 text-[11px]">
                  <AlertTriangle
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                      v.severity === 'HARD_VETO' ? 'text-rose-400 animate-pulse' : 'text-amber-400'
                    }`}
                  />
                  <div className="min-w-0 leading-snug">
                    <span className="font-bold text-amber-200">{v.titleVi}: </span>
                    <span className="text-slate-200">{v.detailVi}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 6-Pillar Confluence Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {verdict.pillars.map((p) => {
              const scoreColor =
                p.status === 'WARNING'
                  ? 'text-amber-300 bg-amber-500/15 border-amber-500/35'
                  : p.status === 'BULLISH'
                  ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/35'
                  : p.status === 'BEARISH'
                  ? 'text-rose-300 bg-rose-500/15 border-rose-500/35'
                  : 'text-slate-300 bg-slate-800 border-slate-700';

              return (
                <div
                  key={p.id}
                  className="p-2 rounded-xl bg-[#0b1322] border border-slate-800/90 min-w-0 flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-[10.5px] font-bold text-slate-200 truncate">
                      {p.shortNameVi}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded border text-[9.5px] font-mono font-bold shrink-0 whitespace-nowrap ${scoreColor}`}
                    >
                      {p.id === 'risk_guard'
                        ? p.status === 'WARNING'
                          ? 'Cảnh giác'
                          : 'An toàn'
                        : `${p.score >= 0 ? '+' : ''}${p.score}`}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-snug break-words">
                    {p.summaryVi}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Structure-Snapped Levels Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono">
            <div className="p-2 rounded-xl bg-[#0b1424] border border-sky-500/30 min-w-0">
              <div className="text-[9.5px] text-sky-300 font-sans font-bold uppercase">
                {verdict.verdictCode === 'REDUCE_TAKE_PROFIT' ? 'Vùng Hạ Tỷ Trọng' : 'Vùng Entry'}
              </div>
              <div className="text-[11px] font-bold text-white mt-0.5 break-words">
                {fmtP(verdict.entryZone[0])}–{fmtP(verdict.entryZone[1])}
              </div>
              <div className="text-[9.5px] font-sans text-slate-400 mt-0.5 leading-tight">
                {verdict.entryAnchorVi}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[#180d14] border border-rose-500/35 min-w-0">
              <div className="text-[9.5px] text-rose-300 font-sans font-bold uppercase">
                {verdict.verdictCode === 'REDUCE_TAKE_PROFIT' ? 'Cản Vô Hiệu' : 'Cắt Lỗ (SL)'}
              </div>
              <div className="text-[11px] font-bold text-rose-300 mt-0.5">
                {fmtP(verdict.stopLoss)}{' '}
                <span className="text-[9.5px]">
                  ({slPct >= 0 ? '+' : ''}
                  {slPct.toFixed(1)}%)
                </span>
              </div>
              <div className="text-[9.5px] font-sans text-slate-400 mt-0.5 leading-tight">
                {verdict.slAnchorVi}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[#091815] border border-emerald-500/30 min-w-0">
              <div className="text-[9.5px] text-emerald-300 font-sans font-bold uppercase">
                {verdict.verdictCode === 'REDUCE_TAKE_PROFIT' ? 'Nền Gom Lại 1' : 'Chốt Lời TP1'}
              </div>
              <div className="text-[11px] font-bold text-emerald-300 mt-0.5">
                {fmtP(verdict.takeProfit1)}{' '}
                <span className="text-[9.5px]">
                  ({tp1Pct >= 0 ? '+' : ''}
                  {tp1Pct.toFixed(1)}%)
                </span>
              </div>
              <div className="text-[9.5px] font-sans text-slate-400 mt-0.5 leading-tight">
                {verdict.tpAnchorVi}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[#091815] border border-teal-500/40 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9.5px] text-teal-300 font-sans font-bold uppercase">
                  {verdict.verdictCode === 'REDUCE_TAKE_PROFIT' ? 'Nền Gom Sâu' : 'Mục Tiêu TP2'}
                </span>
                <span className="text-[9px] text-amber-300 font-bold shrink-0">
                  1:{verdict.riskRewardRatio}
                </span>
              </div>
              <div className="text-[11px] font-bold text-teal-200 mt-0.5">
                {fmtP(verdict.takeProfit2)}{' '}
                <span className="text-[9.5px]">
                  ({tp2Pct >= 0 ? '+' : ''}
                  {tp2Pct.toFixed(1)}%)
                </span>
              </div>
              <div className="text-[9.5px] font-sans text-slate-400 mt-0.5 leading-tight">
                Xác suất {verdict.winProbability}%
              </div>
            </div>
          </div>

          {/* Concrete Live Drivers vs Risks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/25 space-y-1">
              <div className="text-[10px] font-bold uppercase text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>Động lực Ủng hộ Chính</span>
              </div>
              {verdict.bullishDriversVi.map((item, idx) => (
                <div key={idx} className="text-[10.5px] text-slate-200 leading-snug">
                  • {item}
                </div>
              ))}
            </div>

            <div className="p-2 rounded-xl bg-rose-950/20 border border-rose-500/25 space-y-1">
              <div className="text-[10px] font-bold uppercase text-rose-300 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 shrink-0" />
                <span>Rủi ro & Lưu ý Thực chiến</span>
              </div>
              {verdict.riskFactorsVi.map((item, idx) => (
                <div key={idx} className="text-[10.5px] text-slate-200 leading-snug">
                  • {item}
                </div>
              ))}
            </div>
          </div>

          {/* 1-Click Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5">
              {canExecutePaperOrder && (
                <button
                  type="button"
                  onClick={handleQuickPaperTrade}
                  className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow transition shrink-0 whitespace-nowrap"
                >
                  {paperSuccessToast ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{paperSuccessToast}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>
                        {verdict.verdictCode === 'ACCUMULATE_LIMIT'
                          ? 'Đặt Limit Paper Trade'
                          : verdict.isShortPlan
                          ? 'Vào Short Paper Trade'
                          : 'Vào Mua Paper Trade'}
                      </span>
                    </>
                  )}
                </button>
              )}

              {onQuickCreatePriceAlert && (
                <button
                  type="button"
                  onClick={() => onQuickCreatePriceAlert(verdict.entryZone[0])}
                  className="px-2.5 py-1.5 rounded-lg bg-[#131e33] hover:bg-[#1a2945] border border-amber-500/40 text-amber-200 text-[11px] font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap transition"
                >
                  <Bell className="w-3 h-3 text-amber-400" />
                  <span>Báo Giá Vùng Entry ({fmtP(verdict.entryZone[0])})</span>
                </button>
              )}
            </div>

            {onTogglePlanLines && (
              <button
                type="button"
                onClick={onTogglePlanLines}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10.5px] font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap transition"
              >
                {showPlanLines ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showPlanLines ? 'Ẩn đường SL/TP' : 'Hiện đường SL/TP'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
