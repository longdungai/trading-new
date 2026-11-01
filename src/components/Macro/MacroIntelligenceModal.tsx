import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Gauge,
  Globe2,
  Landmark,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  MacroIntelligenceSnapshot,
  MarketSymbol,
  SymbolMacroImpact,
} from '../../types';
import { evaluateSymbolMacroImpact } from '../../services/macro/macroIntelligence';

export type MacroModalTab = 'indicators' | 'fed_pivot' | 'alerts' | 'calendar';

interface MacroIntelligenceModalProps {
  snapshot: MacroIntelligenceSnapshot | null;
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
  initialTab?: MacroModalTab;
  isRefreshing?: boolean;
  onRefresh: () => void;
  onSelectSymbol: (sym: MarketSymbol) => void;
  onClose: () => void;
}

export const MacroIntelligenceModal: React.FC<MacroIntelligenceModalProps> = ({
  snapshot,
  currentSymbol,
  symbols,
  initialTab = 'indicators',
  isRefreshing = false,
  onRefresh,
  onSelectSymbol,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<MacroModalTab>(initialTab);

  const symbolImpact: SymbolMacroImpact | undefined = useMemo(() => {
    return evaluateSymbolMacroImpact(currentSymbol, snapshot);
  }, [currentSymbol, snapshot]);

  const regimeBadgeClass =
    snapshot?.regime === 'RISK_OFF'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      : snapshot?.regime === 'CAUTIOUS'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : snapshot?.regime === 'RISK_ON'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';

  const handleJumpToAsset = (ticker: string) => {
    const found = symbols.find(s => s.symbol.toUpperCase() === ticker.toUpperCase());
    if (found) {
      onSelectSymbol(found);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 select-none animate-in fade-in">
      <div className="bg-[#080d18] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 bg-[#0c1322] border-b border-slate-800/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/35 text-cyan-400 shrink-0">
              <Globe2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  Radar Vĩ Mô Liên Thị Trường & Cảnh Báo Rủi Ro
                </h2>
                {snapshot && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${regimeBadgeClass}`}
                  >
                    {snapshot.regimeLabel} ({snapshot.regimeScore >= 0 ? '+' : ''}
                    {snapshot.regimeScore}đ)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                Dữ liệu thời gian thực từ Yahoo Finance & Binance Futures • Tự động điều tiết tín hiệu AI Kronos & tỷ trọng vốn Kelly
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-2.5 py-1.5 rounded-lg bg-[#131d31] hover:bg-[#1a2742] border border-slate-700/80 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition"
              title="Làm mới dữ liệu vĩ mô thời gian thực"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#131d31] hover:bg-rose-500/20 border border-slate-700/80 text-slate-400 hover:text-rose-300 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 py-2 bg-[#090f1c] border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('indicators')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
                activeTab === 'indicators'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white bg-[#101829]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Chỉ Số Vĩ Mô ({snapshot?.indicators.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('fed_pivot')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
                activeTab === 'fed_pivot'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/45'
                  : 'text-slate-300 hover:text-white bg-[#101829] border border-slate-800'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fed Pivot Watch</span>
              {snapshot?.fedPivot && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                    snapshot.fedPivot.stance === 'DOVISH_PIVOT'
                      ? 'bg-emerald-500 text-black'
                      : snapshot.fedPivot.stance === 'HAWKISH_TIGHTENING'
                      ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                      : 'bg-cyan-500/20 text-cyan-300'
                  }`}
                >
                  {snapshot.fedPivot.stance === 'DOVISH_PIVOT'
                    ? 'PIVOT!'
                    : `${snapshot.fedPivot.passedConditionsCount}/${snapshot.fedPivot.totalConditionsCount}`}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTab === 'alerts'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white bg-[#101829]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Cảnh Báo Nóng ({snapshot?.globalAlerts.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTab === 'calendar'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-white bg-[#101829]'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Lịch Sự Kiện & Đáo Hạn VN30F1M</span>
            </button>
          </div>

          {snapshot && (
            <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-slate-400 shrink-0">
              <span>Hệ số Kelly:</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
                ×{snapshot.kellyDamper.toFixed(2)}
              </span>
              <span>•</span>
              <span>
                Cập nhật:{' '}
                {new Date(snapshot.updatedAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4">
          {!snapshot ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
              <div>Đang đồng bộ các chỉ số vĩ mô toàn cầu (DXY, USD/VND, US10Y, VIX, Brent, Nasdaq, BTC Funding)...</div>
            </div>
          ) : (
            <>
              {/* Active Symbol Contextual Macro Impact Box */}
              {symbolImpact && (
                <div
                  className={`p-3 rounded-xl border space-y-1.5 ${
                    symbolImpact.bias === 'SEVERE_HEADWIND'
                      ? 'bg-rose-950/30 border-rose-500/40'
                      : symbolImpact.bias === 'HEADWIND'
                      ? 'bg-amber-950/25 border-amber-500/35'
                      : symbolImpact.bias === 'TAILWIND'
                      ? 'bg-emerald-950/25 border-emerald-500/35'
                      : 'bg-[#0e1626] border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 font-mono text-cyan-300">
                        {currentSymbol.symbol}
                      </span>
                      <span>Tác động Vĩ mô trực tiếp lên mã đang mở:</span>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                        symbolImpact.bias === 'SEVERE_HEADWIND'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : symbolImpact.bias === 'HEADWIND'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : symbolImpact.bias === 'TAILWIND'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {symbolImpact.headline}
                    </span>
                  </div>

                  {symbolImpact.bullets.length > 0 && (
                    <ul className="space-y-1 pt-1">
                      {symbolImpact.bullets.map((b, idx) => (
                        <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                          <span className="text-cyan-400 font-bold">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* TAB 1: LIVE MACRO INDICATORS GRID */}
              {activeTab === 'indicators' && (
                <div className="space-y-3">
                  {/* US10Y - US3M Yield Curve Spread Banner */}
                  {snapshot.yieldCurveSpread !== null && (
                    <div
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        snapshot.yieldCurveSpread < 0
                          ? 'bg-rose-950/30 border-rose-500/40'
                          : 'bg-[#0e1626] border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>Độ Dốc Đường Cong Lợi Suất Mỹ (US10Y − US3M Spread)</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              snapshot.yieldCurveSpread < 0
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {snapshot.yieldCurveSpread >= 0 ? '+' : ''}
                            {snapshot.yieldCurveSpread.toFixed(2)}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {snapshot.yieldCurveSpread < 0
                            ? 'Đường cong lợi suất đảo ngược (< 0%): Tín hiệu thắt chặt tiền tệ và cảnh báo chu kỳ suy thoái vĩ mô.'
                            : 'Đường cong lợi suất dương (> 0%): Cấu trúc kỳ hạn lãi suất bình thường, chưa xuất hiện đảo ngược lợi suất ngắn-dài hạn.'}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        Nguồn: Yahoo (^TNX − ^IRX)
                      </span>
                    </div>
                  )}

                  {/* Indicators Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {snapshot.indicators.map(ind => {
                      const isCritical = ind.status === 'STRESS';
                      const isWarn = ind.status === 'ELEVATED';
                      const isFav = ind.status === 'FAVORABLE';
                      const isUp = ind.changePercent >= 0;

                      const isFedCard = ind.id === 'FED_FUNDS';

                      return (
                        <div
                          key={ind.id}
                          onClick={isFedCard ? () => setActiveTab('fed_pivot') : undefined}
                          className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition ${
                            isFedCard ? 'cursor-pointer hover:border-cyan-400/60' : ''
                          } ${
                            isCritical
                              ? 'bg-rose-950/25 border-rose-500/45'
                              : isWarn
                              ? 'bg-amber-950/20 border-amber-500/40'
                              : isFav
                              ? 'bg-emerald-950/20 border-emerald-500/35'
                              : 'bg-[#0e1626] border-slate-800/90'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[11px] font-bold text-slate-200 truncate">
                                {ind.label}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase shrink-0 ${
                                  isCritical
                                    ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                                    : isWarn
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                {isCritical
                                  ? 'CĂNG THẲNG'
                                  : isWarn
                                  ? 'CHÚ Ý'
                                  : isFav
                                  ? 'THUẬN LỢI'
                                  : 'ỔN ĐỊNH'}
                              </span>
                            </div>

                            <div className="flex items-baseline justify-between mt-2 font-mono">
                              <span className="text-lg font-black text-white">
                                {ind.displayValue}
                              </span>
                              {ind.id === 'FED_FUNDS' && snapshot.fedPivot ? (
                                <span
                                  className={`text-xs font-bold ${
                                    snapshot.fedPivot.delta6mBps < 0
                                      ? 'text-emerald-400'
                                      : snapshot.fedPivot.delta6mBps > 0
                                      ? 'text-rose-400'
                                      : 'text-cyan-300'
                                  }`}
                                >
                                  {snapshot.fedPivot.delta6mBps >= 0 ? '+' : ''}
                                  {snapshot.fedPivot.delta6mBps} bps
                                </span>
                              ) : (
                                ind.id !== 'BTC_FUNDING' && (
                                  <span
                                    className={`text-xs font-bold flex items-center gap-0.5 ${
                                      isUp ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {isUp ? (
                                      <TrendingUp className="w-3 h-3" />
                                    ) : (
                                      <TrendingDown className="w-3 h-3" />
                                    )}
                                    {isUp ? '+' : ''}
                                    {ind.changePercent.toFixed(2)}%
                                  </span>
                                )
                              )}
                            </div>

                            <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                              {ind.impactSummary}
                            </p>
                          </div>

                          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-slate-500">
                            <span>Mã: {ind.shortLabel}</span>
                            <span>{ind.source}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 1.5: DEDICATED FED PIVOT WATCH GAUGE & 5-FACTOR CHECKLIST */}
              {activeTab === 'fed_pivot' && (
                <div className="space-y-3.5">
                  {!snapshot.fedPivot ? (
                    <div className="p-6 rounded-xl bg-[#0e1626] border border-slate-800 text-center text-xs text-slate-400">
                      Đang đồng bộ dữ liệu lãi suất điều hành NY Fed (EFFR) và hợp đồng tương lai CBOT 30-Day Fed Funds (ZQ)...
                    </div>
                  ) : (
                    <>
                      {/* Top Status & FOMC Countdown Card */}
                      <div
                        className={`p-3.5 rounded-xl border space-y-2.5 ${
                          snapshot.fedPivot.stance === 'DOVISH_PIVOT'
                            ? 'bg-emerald-950/30 border-emerald-500/45'
                            : snapshot.fedPivot.stance === 'HAWKISH_TIGHTENING'
                            ? 'bg-rose-950/25 border-rose-500/45'
                            : snapshot.fedPivot.stance === 'EMERGENCY_EASING'
                            ? 'bg-amber-950/30 border-amber-500/45'
                            : 'bg-[#0e1626] border-cyan-500/35'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Gauge className="w-4 h-4 text-cyan-400 shrink-0" />
                            <h3 className="text-xs sm:text-sm font-black uppercase text-white">
                              {snapshot.fedPivot.stanceLabel}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-900/90 text-cyan-300 border border-slate-700">
                              Đạt {snapshot.fedPivot.passedConditionsCount}/{snapshot.fedPivot.totalConditionsCount} tiêu chí Pivot
                            </span>
                          </div>

                          {snapshot.fedPivot.nextFomc && (
                            <div className="px-2.5 py-1 rounded-lg bg-[#111b2e] border border-slate-700/80 flex items-center gap-1.5 text-[10px] font-mono text-amber-300 shrink-0">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>
                                {snapshot.fedPivot.nextFomc.title}: còn{' '}
                                <strong>
                                  {snapshot.fedPivot.nextFomc.daysRemaining > 0
                                    ? `${snapshot.fedPivot.nextFomc.daysRemaining} ngày`
                                    : `${snapshot.fedPivot.nextFomc.hoursRemaining}h`}
                                </strong>
                              </span>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-slate-200 leading-relaxed">
                          {snapshot.fedPivot.summary}
                        </p>

                        {/* Key Official Rate Pills */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                          <div className="p-2 rounded-lg bg-[#0b1220] border border-slate-800">
                            <div className="text-[9px] text-slate-400 font-sans">Biên mục tiêu FOMC</div>
                            <div className="text-sm font-black text-white mt-0.5">
                              {snapshot.fedPivot.targetRangeLow.toFixed(2)}% –{' '}
                              {snapshot.fedPivot.targetRangeHigh.toFixed(2)}%
                            </div>
                            <div className="text-[9px] text-slate-500">Federal Reserve</div>
                          </div>

                          <div className="p-2 rounded-lg bg-[#0b1220] border border-slate-800">
                            <div className="text-[9px] text-slate-400 font-sans">Lãi suất thực EFFR</div>
                            <div className="text-sm font-black text-cyan-300 mt-0.5">
                              {snapshot.fedPivot.effectiveRate.toFixed(2)}%
                            </div>
                            <div className="text-[9px] text-slate-500">
                              Ngày {snapshot.fedPivot.effectiveDate}
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-[#0b1220] border border-slate-800">
                            <div className="text-[9px] text-slate-400 font-sans">Định giá ZQ +3 Tháng</div>
                            <div className="text-sm font-black text-white mt-0.5">
                              {snapshot.fedPivot.implied3mRate.toFixed(2)}%
                            </div>
                            <div
                              className={`text-[9px] font-bold ${
                                snapshot.fedPivot.delta3mBps < 0
                                  ? 'text-emerald-400'
                                  : snapshot.fedPivot.delta3mBps > 0
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {snapshot.fedPivot.delta3mBps >= 0 ? '+' : ''}
                              {snapshot.fedPivot.delta3mBps} bps vs EFFR
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-[#0b1220] border border-slate-800">
                            <div className="text-[9px] text-slate-400 font-sans">Định giá ZQ +6 Tháng</div>
                            <div className="text-sm font-black text-white mt-0.5">
                              {snapshot.fedPivot.implied6mRate.toFixed(2)}%
                            </div>
                            <div
                              className={`text-[9px] font-bold ${
                                snapshot.fedPivot.delta6mBps < 0
                                  ? 'text-emerald-400'
                                  : snapshot.fedPivot.delta6mBps > 0
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {snapshot.fedPivot.pricedMoves6m >= 0 ? '+' : ''}
                              {snapshot.fedPivot.pricedMoves6m} đợt (25bps)
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CME FedWatch 3M Probability Bar & Forward ZQ Rate Curve */}
                      <div className="p-3.5 rounded-xl bg-[#0e1626] border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">
                            Xác Suất Hành Động Lãi Suất Ngầm Định 3 Tháng Tới (CME Fed Funds Futures)
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {snapshot.fedPivot.sourceLabel}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden flex border border-slate-800">
                            {snapshot.fedPivot.cutProb3mPct > 0 && (
                              <div
                                className="h-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${snapshot.fedPivot.cutProb3mPct}%` }}
                              />
                            )}
                            {snapshot.fedPivot.holdProb3mPct > 0 && (
                              <div
                                className="h-full bg-cyan-500/80 transition-all duration-500"
                                style={{ width: `${snapshot.fedPivot.holdProb3mPct}%` }}
                              />
                            )}
                            {snapshot.fedPivot.hikeProb3mPct > 0 && (
                              <div
                                className="h-full bg-rose-500 transition-all duration-500"
                                style={{ width: `${snapshot.fedPivot.hikeProb3mPct}%` }}
                              />
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-emerald-400 font-bold">
                              ▼ Cắt giảm (-25bps): {snapshot.fedPivot.cutProb3mPct}%
                            </span>
                            <span className="text-cyan-300 font-bold">
                              • Giữ nguyên: {snapshot.fedPivot.holdProb3mPct}%
                            </span>
                            <span className="text-rose-400 font-bold">
                              ▲ Tăng thêm (+25bps): {snapshot.fedPivot.hikeProb3mPct}%
                            </span>
                          </div>
                        </div>

                        {/* Forward ZQ Curve Strip */}
                        <div className="grid grid-cols-4 gap-2 pt-1 font-mono">
                          {snapshot.fedPivot.rateCurve.map((pt, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-lg bg-[#0a101d] border border-slate-800/90 text-center"
                            >
                              <div className="text-[9px] text-slate-400 font-sans truncate">
                                {pt.horizonLabel}
                              </div>
                              <div className="text-xs sm:text-sm font-black text-white mt-0.5">
                                {pt.impliedRate.toFixed(2)}%
                              </div>
                              <div
                                className={`text-[9px] font-bold ${
                                  pt.deltaBps < 0
                                    ? 'text-emerald-400'
                                    : pt.deltaBps > 0
                                    ? 'text-rose-400'
                                    : 'text-slate-500'
                                }`}
                              >
                                {pt.contractSymbol} ({pt.deltaBps >= 0 ? '+' : ''}
                                {pt.deltaBps}bps)
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 5-Factor Fed Pivot Activation Checklist */}
                      <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          5 Chỉ Số Kiểm Định Thời Điểm Xuất Hiện Fed Pivot:
                        </div>

                        {snapshot.fedPivot.checklist.map(chk => {
                          const isPass = chk.state === 'PASSED';
                          const isBlock = chk.state === 'BLOCKED';
                          return (
                            <div
                              key={chk.id}
                              className={`p-3 rounded-xl border space-y-1 ${
                                isPass
                                  ? 'bg-emerald-950/20 border-emerald-500/40'
                                  : isBlock
                                  ? 'bg-rose-950/20 border-rose-500/35'
                                  : 'bg-[#0e1626] border-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white">{chk.label}</span>
                                <div className="flex items-center gap-2 font-mono">
                                  <span className="text-[11px] font-bold text-cyan-300">
                                    {chk.metricValue}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                      isPass
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        : isBlock
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                        : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                                    }`}
                                  >
                                    {isPass
                                      ? '✓ ĐẠT PIVOT'
                                      : isBlock
                                      ? '✕ CHƯA ĐẠT (DIỀU HÂU)'
                                      : '⏳ ĐANG THEO DÕI'}
                                  </span>
                                </div>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                Điều kiện kích hoạt: {chk.thresholdRule}
                              </div>
                              <p className="text-[11px] text-slate-300">{chk.detail}</p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: CROSS-MARKET ALERTS */}
              {activeTab === 'alerts' && (
                <div className="space-y-2.5">
                  {snapshot.globalAlerts.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#0e1626] border border-emerald-500/30 text-center space-y-1.5">
                      <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                      <div className="text-xs font-bold text-emerald-300">
                        Không Có Cú Sốc Vĩ Mô Nghiêm Trọng Hiện Tại
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Tất cả các chỉ báo DXY, tỷ giá USD/VND, VIX, lợi suất US10Y và Funding Rate đang vận động trong biên độ an toàn.
                      </p>
                    </div>
                  ) : (
                    snapshot.globalAlerts.map(alert => {
                      const isCrit = alert.severity === 'CRITICAL';
                      const isWarn = alert.severity === 'WARNING';
                      return (
                        <div
                          key={alert.id}
                          className={`p-3.5 rounded-xl border space-y-2 ${
                            isCrit
                              ? 'bg-rose-950/30 border-rose-500/45'
                              : isWarn
                              ? 'bg-amber-950/25 border-amber-500/40'
                              : 'bg-cyan-950/20 border-cyan-500/35'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle
                                className={`w-4 h-4 shrink-0 ${
                                  isCrit
                                    ? 'text-rose-400'
                                    : isWarn
                                    ? 'text-amber-400'
                                    : 'text-cyan-400'
                                }`}
                              />
                              <h3 className="text-xs sm:text-sm font-bold text-white">
                                {alert.title}
                              </h3>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                                isCrit
                                  ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                                  : isWarn
                                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                                  : 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                              }`}
                            >
                              {alert.metricBadge}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>

                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <span className="text-[10px] text-slate-400 font-semibold">
                              Nhóm chịu ảnh hưởng:
                            </span>
                            {alert.affectedAssets.map(ticker => {
                              const exists = symbols.some(
                                s => s.symbol.toUpperCase() === ticker.toUpperCase()
                              );
                              return (
                                <button
                                  key={ticker}
                                  type="button"
                                  disabled={!exists}
                                  onClick={() => handleJumpToAsset(ticker)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 border transition ${
                                    exists
                                      ? 'bg-[#141f35] hover:bg-cyan-500/20 text-cyan-300 border-slate-700 hover:border-cyan-400 cursor-pointer'
                                      : 'bg-slate-900 text-slate-400 border-slate-800 cursor-default'
                                  }`}
                                >
                                  <span>{ticker}</span>
                                  {exists && <ArrowUpRight className="w-2.5 h-2.5" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 3: MACRO & VN30F1M DERIVATIVES CALENDAR */}
              {activeTab === 'calendar' && (
                <div className="space-y-2.5">
                  {snapshot.upcomingEvents.map(ev => {
                    const isImminent = ev.hoursRemaining <= 48;
                    const countdownText =
                      ev.hoursRemaining < 24
                        ? `Còn ${ev.hoursRemaining} giờ`
                        : `Còn ${Math.ceil(ev.hoursRemaining / 24)} ngày`;

                    return (
                      <div
                        key={ev.id}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isImminent
                            ? 'bg-amber-950/25 border-amber-500/45'
                            : 'bg-[#0e1626] border-slate-800'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                ev.market === 'VN'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/35'
                                  : ev.market === 'CRYPTO'
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/35'
                              }`}
                            >
                              {ev.market === 'VN'
                                ? 'VN • HOSE/HNX'
                                : ev.market === 'CRYPTO'
                                ? 'CRYPTO • PHÁI SINH'
                                : 'TOÀN CẦU • MỸ/FED'}
                            </span>
                            <h3 className="text-xs sm:text-sm font-bold text-white">{ev.title}</h3>
                          </div>

                          <div className="text-[11px] font-mono text-cyan-300">{ev.dateLabel}</div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">{ev.guidance}</p>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0">
                          <span
                            className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold border ${
                              isImminent
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 animate-pulse'
                                : 'bg-[#141f35] text-slate-200 border-slate-700'
                            }`}
                          >
                            {countdownText}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Tác động: {ev.impactLevel === 'HIGH' ? 'Rất Mạnh' : 'Trung Bình'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
