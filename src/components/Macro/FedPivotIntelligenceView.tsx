import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Clock,
  Database,
  Gauge,
  History,
  Info,
  Layers,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { MarketSymbol } from '../../types';
import {
  FedPivotAlertTier,
  FedPivotEventType,
  FedPivotIntelligenceV2,
  FedPivotSignalItem,
  FedPivotSignalState,
  FedPivotV2Status,
} from '../../types/fedPivotV2';

interface FedPivotIntelligenceViewProps {
  data: FedPivotIntelligenceV2 | undefined;
  symbols: MarketSymbol[];
  onJumpToSymbol: (ticker: string) => void;
}

type HistoryHorizon = '30D' | '90D' | '1Y';

function getStatusStyles(status: FedPivotV2Status): {
  badge: string;
  bar: string;
  ring: string;
} {
  switch (status) {
    case 'STRONG_CONVERGENCE':
      return {
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
        bar: 'from-emerald-500 to-cyan-400',
        ring: 'border-emerald-500/45 bg-emerald-950/20',
      };
    case 'PIVOT_WINDOW':
      return {
        badge: 'bg-teal-500/20 text-teal-300 border-teal-400/50',
        bar: 'from-teal-400 to-emerald-400',
        ring: 'border-teal-500/40 bg-teal-950/20',
      };
    case 'EARLY_PIVOT':
      return {
        badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50',
        bar: 'from-cyan-500 to-blue-400',
        ring: 'border-cyan-500/40 bg-cyan-950/20',
      };
    case 'WATCH':
      return {
        badge: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
        bar: 'from-amber-400 to-cyan-400',
        ring: 'border-amber-500/35 bg-amber-950/15',
      };
    case 'NO_PIVOT':
    default:
      return {
        badge: 'bg-slate-800 text-slate-200 border-slate-600/80',
        bar: 'from-slate-500 to-cyan-500/70',
        ring: 'border-slate-800 bg-[#0c1322]',
      };
  }
}

function getSignalStateMeta(state: FedPivotSignalState): {
  label: string;
  badgeClass: string;
  cardBorder: string;
} {
  switch (state) {
    case 'CONFIRMED':
      return {
        label: '✓ XÁC NHẬN',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45',
        cardBorder: 'border-emerald-500/35 bg-emerald-950/15',
      };
    case 'PARTIAL':
      return {
        label: '◐ XÁC NHẬN 1 PHẦN',
        badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        cardBorder: 'border-cyan-500/30 bg-cyan-950/10',
      };
    case 'CONFLICTING':
      return {
        label: '✕ TRÁI CHIỀU',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/45',
        cardBorder: 'border-rose-500/35 bg-rose-950/15',
      };
    case 'UNKNOWN':
      return {
        label: 'UNKNOWN • 0 ĐIỂM',
        badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
        cardBorder: 'border-slate-800/80 bg-[#0a0f1b] opacity-85',
      };
    case 'UNCONFIRMED':
    default:
      return {
        label: '• CHƯA XÁC NHẬN',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
        cardBorder: 'border-slate-800 bg-[#0d1525]',
      };
  }
}

function getEventBadgeColor(type: FedPivotEventType): string {
  switch (type) {
    case 'FOMC':
      return 'bg-purple-500/25 text-purple-200 border-purple-400/50';
    case 'PCE':
      return 'bg-emerald-500/20 text-emerald-200 border-emerald-400/45';
    case 'CPI':
      return 'bg-amber-500/20 text-amber-200 border-amber-400/45';
    case 'NFP':
      return 'bg-cyan-500/20 text-cyan-200 border-cyan-400/45';
  }
}

function getAlertTierStyle(tier: FedPivotAlertTier): {
  card: string;
  badge: string;
} {
  switch (tier) {
    case 'RISK_WARNING':
      return {
        card: 'bg-rose-950/25 border-rose-500/45',
        badge: 'bg-rose-500/25 text-rose-200 border-rose-400/50',
      };
    case 'STRONG_CONVERGENCE':
    case 'PIVOT_WINDOW':
      return {
        card: 'bg-emerald-950/25 border-emerald-500/45',
        badge: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50',
      };
    case 'EARLY_PIVOT':
      return {
        card: 'bg-cyan-950/25 border-cyan-500/40',
        badge: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/45',
      };
    case 'WATCH':
    default:
      return {
        card: 'bg-amber-950/20 border-amber-500/40',
        badge: 'bg-amber-500/20 text-amber-200 border-amber-400/45',
      };
  }
}

function formatDateTimeVN(isoOrMs: string | number): string {
  const dt = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
  if (Number.isNaN(dt.getTime())) return 'N/A';
  return dt.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const FedPivotIntelligenceView: React.FC<FedPivotIntelligenceViewProps> = ({
  data,
  symbols,
  onJumpToSymbol,
}) => {
  const [horizon, setHorizon] = useState<HistoryHorizon>('90D');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selectedEventFilter, setSelectedEventFilter] = useState<FedPivotEventType | 'ALL'>('ALL');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');

  const availableTickerSet = useMemo(() => {
    return new Set(symbols.map(s => s.symbol.toUpperCase()));
  }, [symbols]);

  const filteredHistory = useMemo(() => {
    if (!data || data.historicalSeries.length === 0) return [];
    const days = horizon === '30D' ? 32 : horizon === '90D' ? 95 : 370;
    const minSec = Math.floor((data.updatedAtMs - days * 86_400_000) / 1000);
    return data.historicalSeries.filter(p => p.timestampSec >= minSec);
  }, [data, horizon]);

  const filteredEvents = useMemo(() => {
    if (!data || filteredHistory.length === 0) return [];
    const startSec = filteredHistory[0].timestampSec - 3 * 86_400;
    const endSec = data.updatedAtMs / 1000 + 35 * 86_400;
    return data.eventMarkers.filter(ev => {
      if (ev.timestampSec < startSec || ev.timestampSec > endSec) return false;
      if (selectedEventFilter !== 'ALL' && ev.type !== selectedEventFilter) return false;
      return true;
    });
  }, [data, filteredHistory, selectedEventFilter]);

  const comparedSnapshot = useMemo(() => {
    if (!data || data.savedSnapshots.length === 0) return null;
    if (selectedSnapshotId) {
      const found = data.savedSnapshots.find(s => s.id === selectedSnapshotId);
      if (found) return found;
    }
    return data.savedSnapshots.length >= 2
      ? data.savedSnapshots[data.savedSnapshots.length - 2]
      : data.savedSnapshots[0];
  }, [data, selectedSnapshotId]);

  if (!data) {
    return (
      <div className="p-6 rounded-xl bg-[#0c1322] border border-slate-800 text-center space-y-2">
        <Activity className="w-6 h-6 text-cyan-400 animate-pulse mx-auto" />
        <div className="text-xs font-bold text-white">
          Đang tải hệ thống Fed Pivot Intelligence V2...
        </div>
        <p className="text-[11px] text-slate-400">
          Đồng bộ chuỗi dữ liệu chính thức từ FRED, BEA, BLS, NY Fed và hợp đồng tương lai CBOT ZQ.
        </p>
      </div>
    );
  }

  const statusStyles = getStatusStyles(data.status);
  const scorePct = Math.min(100, Math.max(0, (data.pivotScore / 7) * 100));

  // SVG Historical Chart Geometry
  const svgW = 760;
  const svgH = 210;
  const padL = 34;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const activePointIndex =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx < filteredHistory.length
      ? hoverIdx
      : filteredHistory.length - 1;
  const activePoint = filteredHistory[activePointIndex] ?? null;

  const xForIndex = (idx: number) => {
    if (filteredHistory.length <= 1) return padL + plotW / 2;
    return padL + (idx / (filteredHistory.length - 1)) * plotW;
  };
  const yForScore = (score: number) => {
    const clamped = Math.max(0, Math.min(7, score));
    return padT + plotH - (clamped / 7) * plotH;
  };

  const linePath =
    filteredHistory.length > 0
      ? filteredHistory
          .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${xForIndex(idx).toFixed(1)},${yForScore(pt.score).toFixed(1)}`)
          .join(' ')
      : '';

  const areaPath =
    filteredHistory.length > 1
      ? `${linePath} L${xForIndex(filteredHistory.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${xForIndex(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : '';

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* ==================== AREA A: EXECUTIVE OVERVIEW ==================== */}
      <section className={`p-3.5 sm:p-4 rounded-xl border ${statusStyles.ring} space-y-3`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/35 text-[10px] font-mono font-bold text-cyan-300 uppercase">
                Khu vực A • Tổng Quan Hội Tụ
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black border ${statusStyles.badge}`}
              >
                {data.statusLabel}
              </span>
              {data.nextFomcSummary && (
                <span className="px-2 py-0.5 rounded bg-[#111b2e] border border-slate-700 text-[10px] font-mono text-amber-300 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>
                    {data.nextFomcSummary.title}: còn {data.nextFomcSummary.daysRemaining} ngày
                  </span>
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-black text-white leading-snug">
              Kịch bản hiện tại: <span className="text-cyan-300">{data.dominantScenarioLabel}</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">{data.macroNarrativeSummary}</p>
          </div>

          {/* Pivot Score Gauge Box */}
          <div className="p-3 rounded-xl bg-[#080d18] border border-slate-800 shrink-0 lg:w-72 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <span>Fed Pivot Score</span>
              </div>
              <div className="font-mono">
                <span className="text-2xl font-black text-white">{data.pivotScore.toFixed(2)}</span>
                <span className="text-xs font-bold text-slate-400"> / {data.maxScore}</span>
              </div>
            </div>

            <div className="h-2.5 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${statusStyles.bar} transition-all duration-500`}
                style={{ width: `${scorePct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
              <span>0 No Pivot</span>
              <span>1.25 Watch</span>
              <span>2.75 Early</span>
              <span>4.25 Window</span>
              <span>7</span>
            </div>

            <p className="text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1 leading-snug">
              Lưu ý: Pivot Score là điểm hội tụ tín hiệu vĩ mô, <strong>không phải</strong> xác suất % Fed cắt lãi suất.
            </p>
          </div>
        </div>

        {/* Data Confidence, Coverage & Snapshot Changes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
          <div className="p-2.5 rounded-lg bg-[#090f1d] border border-slate-800/90 space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Độ tin cậy & Bao phủ dữ liệu</span>
              </span>
              <span className="font-mono font-bold text-cyan-300">
                {data.dataQuality.validSignalsCount}/{data.dataQuality.totalSignalsCount} tín hiệu ({data.dataQuality.coverageRatioPct}%)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{data.dataQuality.confidenceLabel}</p>
            {data.dataQuality.collinearityApplied && data.dataQuality.collinearityExplanation && (
              <p className="text-[10px] text-cyan-300 font-mono">
                • {data.dataQuality.collinearityExplanation}
              </p>
            )}
            <div className="text-[10px] font-mono text-slate-500">
              Cập nhật gần nhất: {formatDateTimeVN(data.updatedAtMs)}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#090f1d] border border-slate-800/90 space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Thay đổi kể từ lần cập nhật trước</span>
              </span>
              {data.snapshotDiff.previousTimestampMs && (
                <span className="text-[10px] font-mono text-slate-500">
                  So với {formatDateTimeVN(data.snapshotDiff.previousTimestampMs)}
                </span>
              )}
            </div>
            <ul className="space-y-0.5">
              {data.snapshotDiff.highlights.slice(0, 3).map((hl, idx) => (
                <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>{hl}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ==================== AREA B: 7 CORE SIGNALS ==================== */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-mono font-bold text-emerald-300 uppercase">
              Khu vực B • 7 Tín Hiệu Định Lượng
            </span>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              Ma Trận Kiểm Định 7 Trụ Cột Xoay Trục Chính Sách
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Dữ liệu thiếu / lỗi / quá hạn tự động gán UNKNOWN (0 điểm)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {data.signals.map((sig: FedPivotSignalItem) => {
            const meta = getSignalStateMeta(sig.state);
            return (
              <div
                key={sig.id}
                className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${meta.cardBorder}`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white leading-snug">
                        {sig.order}. {sig.title}
                      </div>
                      <div className="text-[10px] text-slate-400">{sig.subtitle}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold border ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-bold text-cyan-300">
                        +{sig.effectiveScore.toFixed(2)}đ
                        {sig.collinearityAdjusted ? ` (gốc ${sig.rawScore.toFixed(1)}đ)` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Latest / Previous / Change Strip */}
                  <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-[#070c16] border border-slate-800/80 font-mono text-[10px]">
                    <div className="min-w-0">
                      <div className="text-[9px] font-sans text-slate-500">Mới nhất</div>
                      <div className="font-bold text-white truncate" title={sig.latestDisplay}>
                        {sig.latestDisplay}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-sans text-slate-500">Trước đó</div>
                      <div className="text-slate-300 truncate" title={sig.previousDisplay}>
                        {sig.previousDisplay}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-sans text-slate-500">Thay đổi</div>
                      <div className="font-semibold text-cyan-300 truncate" title={sig.deltaDisplay}>
                        {sig.deltaDisplay}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">{sig.rationale}</p>

                  {sig.collinearityNote && (
                    <div className="text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1">
                      {sig.collinearityNote}
                    </div>
                  )}
                </div>

                <div className="pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1 text-[9px] font-mono text-slate-500">
                  <span>Nguồn: {sig.source}</span>
                  <span>
                    Công bố: {sig.releaseDate} • Lấy lúc {formatDateTimeVN(sig.fetchedAtISO)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================== AREA C: HISTORICAL PIVOT CHART & SNAPSHOTS ==================== */}
      <section className="p-3.5 rounded-xl bg-[#0c1322] border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/35 text-[10px] font-mono font-bold text-purple-300 uppercase">
              Khu vực C • Lịch Sử & Sự Kiện
            </span>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              Diễn Biến Điểm Hội Tụ (Point-in-Time) & Mốc FOMC / CPI / PCE / NFP
            </h3>
          </div>

          <div className="flex items-center gap-1 font-mono">
            {(['30D', '90D', '1Y'] as HistoryHorizon[]).map(h => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setHorizon(h);
                  setHoverIdx(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                  horizon === h
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                    : 'bg-[#10192c] text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {h === '30D' ? '30 Ngày' : h === '90D' ? '90 Ngày' : '1 Năm'}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length < 2 ? (
          <div className="p-6 rounded-xl bg-[#080d18] border border-slate-800 text-center space-y-1.5">
            <History className="w-6 h-6 text-slate-500 mx-auto" />
            <div className="text-xs font-bold text-slate-300">
              Chưa có đủ dữ liệu lịch sử thực từ nguồn chính thức cho khung thời gian này
            </div>
            <p className="text-[11px] text-slate-400">
              Hệ thống tuân thủ nguyên tắc minh bạch: tuyệt đối không tự dựng chuỗi lịch sử giả lập khi API vĩ mô chưa phản hồi.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Interactive Point Readout Header */}
            {activePoint && (
              <div className="px-3 py-2 rounded-lg bg-[#080d18] border border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400">Ngày:</span>
                  <span className="font-bold text-white">{activePoint.dateISO}</span>
                  <span>•</span>
                  <span className="text-slate-400">Pivot Score:</span>
                  <span className="font-black text-cyan-300">{activePoint.score.toFixed(2)} / 7</span>
                  <span>•</span>
                  <span className="text-emerald-300">{activePoint.status}</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Bao phủ lịch sử thực: {activePoint.validSignalsCount}/7 nguồn FRED/BLS/BEA
                </span>
              </div>
            )}

            {/* Responsive SVG Timeline Chart */}
            <div className="w-full rounded-xl bg-[#070b14] border border-slate-800/90 p-2 overflow-hidden">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full h-44 sm:h-52 select-none touch-pan-y"
                onMouseLeave={() => setHoverIdx(null)}
                onMouseMove={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (rect.width <= 0) return;
                  const relX = ((e.clientX - rect.left) / rect.width) * svgW;
                  const ratio = Math.max(0, Math.min(1, (relX - padL) / plotW));
                  const idx = Math.round(ratio * (filteredHistory.length - 1));
                  setHoverIdx(idx);
                }}
              >
                <defs>
                  <linearGradient id="pivotAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid & Regime Thresholds */}
                {[
                  { val: 0, label: '0' },
                  { val: 1.25, label: '1.25' },
                  { val: 2.75, label: '2.75' },
                  { val: 4.25, label: '4.25' },
                  { val: 5.75, label: '5.75' },
                  { val: 7, label: '7.0' },
                ].map(g => {
                  const y = yForScore(g.val);
                  return (
                    <g key={g.val}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={svgW - padR}
                        y2={y}
                        stroke={g.val === 2.75 || g.val === 4.25 ? '#1e3a5f' : '#152036'}
                        strokeDasharray={g.val === 0 || g.val === 7 ? undefined : '4 4'}
                        strokeWidth={1}
                      />
                      <text
                        x={padL - 5}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="9"
                        fill="#64748b"
                        fontFamily="monospace"
                      >
                        {g.label}
                      </text>
                    </g>
                  );
                })}

                {/* Macro Event Vertical Markers within History Range */}
                {filteredEvents.map(ev => {
                  const firstSec = filteredHistory[0].timestampSec;
                  const lastSec = filteredHistory[filteredHistory.length - 1].timestampSec;
                  if (ev.timestampSec < firstSec || ev.timestampSec > lastSec || lastSec <= firstSec) {
                    return null;
                  }
                  const x =
                    padL + ((ev.timestampSec - firstSec) / (lastSec - firstSec)) * plotW;
                  const color =
                    ev.type === 'FOMC'
                      ? '#c084fc'
                      : ev.type === 'PCE'
                      ? '#34d399'
                      : ev.type === 'CPI'
                      ? '#fbbf24'
                      : '#38bdf8';
                  return (
                    <g key={ev.id}>
                      <line
                        x1={x}
                        y1={padT}
                        x2={x}
                        y2={padT + plotH}
                        stroke={color}
                        strokeOpacity={0.35}
                        strokeDasharray="2 3"
                        strokeWidth={1}
                      />
                      <circle cx={x} cy={padT + plotH - 4} r={2.5} fill={color} />
                    </g>
                  );
                })}

                {/* Area & Score Line */}
                {areaPath && <path d={areaPath} fill="url(#pivotAreaGrad)" />}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={2.2}
                    strokeLinejoin="round"
                  />
                )}

                {/* Active Point Highlight */}
                {activePoint && (
                  <g>
                    <line
                      x1={xForIndex(activePointIndex)}
                      y1={padT}
                      x2={xForIndex(activePointIndex)}
                      y2={padT + plotH}
                      stroke="#38bdf8"
                      strokeOpacity={0.6}
                      strokeWidth={1}
                    />
                    <circle
                      cx={xForIndex(activePointIndex)}
                      cy={yForScore(activePoint.score)}
                      r={4.5}
                      fill="#06b6d4"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  </g>
                )}

                {/* Start / Middle / End X-Axis Labels */}
                {[0, Math.floor((filteredHistory.length - 1) / 2), filteredHistory.length - 1].map(
                  idx => {
                    const pt = filteredHistory[idx];
                    if (!pt) return null;
                    return (
                      <text
                        key={`xl-${idx}`}
                        x={xForIndex(idx)}
                        y={svgH - 7}
                        textAnchor={
                          idx === 0
                            ? 'start'
                            : idx === filteredHistory.length - 1
                            ? 'end'
                            : 'middle'
                        }
                        fontSize="9"
                        fill="#64748b"
                        fontFamily="monospace"
                      >
                        {pt.dateISO}
                      </text>
                    );
                  }
                )}
              </svg>
            </div>

            {/* Event Markers Filter & Strip */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-300">
                  Mốc sự kiện vĩ mô trên trục thời gian ({filteredEvents.length}):
                </span>
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  {(['ALL', 'FOMC', 'PCE', 'CPI', 'NFP'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedEventFilter(t)}
                      className={`px-2 py-0.5 rounded border transition ${
                        selectedEventFilter === t
                          ? 'bg-slate-200 text-slate-950 border-white font-bold'
                          : 'bg-[#090f1d] text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {t === 'ALL' ? 'Tất cả' : t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {filteredEvents.slice(-10).map(ev => (
                  <div
                    key={ev.id}
                    className="px-2.5 py-1.5 rounded-lg bg-[#080d18] border border-slate-800 shrink-0 text-[10px] space-y-0.5"
                    title={ev.detail}
                  >
                    <div className="flex items-center gap-1.5 font-mono">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${getEventBadgeColor(
                          ev.type
                        )}`}
                      >
                        {ev.shortTag}
                      </span>
                      <span className="text-slate-400">{ev.dateISO}</span>
                    </div>
                    <div className="font-semibold text-slate-200">{ev.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Saved User Snapshots Comparison Box */}
        <div className="pt-2 border-t border-slate-800/90 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Đối chiếu Lịch sử Snapshot đã lưu ({data.savedSnapshots.length} bản ghi)</span>
            </span>

            {data.savedSnapshots.length > 0 && (
              <select
                value={comparedSnapshot?.id ?? ''}
                onChange={e => setSelectedSnapshotId(e.target.value)}
                className="bg-[#080d18] border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
              >
                {data.savedSnapshots
                  .slice()
                  .reverse()
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {formatDateTimeVN(s.timestampMs)} • Score {s.pivotScore.toFixed(2)}/7 ({s.status})
                    </option>
                  ))}
              </select>
            )}
          </div>

          {comparedSnapshot && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-[#080d18] border border-slate-800/80 font-mono text-[10px]">
              <div>
                <div className="text-slate-500 font-sans">Snapshot đối chiếu</div>
                <div className="text-slate-200 font-bold">
                  {comparedSnapshot.pivotScore.toFixed(2)}/7 ({comparedSnapshot.status})
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-sans">Core PCE 3T (Cũ → Mới)</div>
                <div className="text-cyan-300 font-bold">
                  {comparedSnapshot.metrics.corePce3mAnn?.toFixed(2) ?? 'N/A'}% →{' '}
                  {data.signals.find(s => s.id === 'CORE_PCE')?.latestNumeric?.toFixed(2) ?? 'N/A'}%
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-sans">US 2Y (Cũ → Mới)</div>
                <div className="text-cyan-300 font-bold">
                  {comparedSnapshot.metrics.us2yYield?.toFixed(2) ?? 'N/A'}% →{' '}
                  {data.signals.find(s => s.id === 'US_TREASURY_2Y')?.latestNumeric?.toFixed(2) ?? 'N/A'}%
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-sans">HY Spread (Cũ → Mới)</div>
                <div className="text-cyan-300 font-bold">
                  {comparedSnapshot.metrics.hySpreadPct?.toFixed(2) ?? 'N/A'}% →{' '}
                  {data.signals.find(s => s.id === 'CREDIT_FINANCIAL_STRESS')?.latestNumeric?.toFixed(2) ?? 'N/A'}%
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ==================== AREA D: THREE SCENARIOS ANALYSIS ==================== */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-[10px] font-mono font-bold text-amber-300 uppercase">
              Khu vực D • Phân Tích 3 Kịch Bản
            </span>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              Soft Landing • Recession • Financial Stress
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Info className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>Đánh giá mức độ tin cậy định tính — không tự tạo xác suất % giả định</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
          {data.scenarios.map(sc => {
            const isDom = sc.isDominant;
            const tierBadge =
              sc.confidenceTier === 'HIGH'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : sc.confidenceTier === 'MODERATE'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : sc.confidenceTier === 'LOW'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                : 'bg-slate-800 text-slate-400 border-slate-700';

            return (
              <div
                key={sc.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                  isDom
                    ? 'bg-[#101a2e] border-cyan-400/50 shadow-lg shadow-cyan-500/5'
                    : 'bg-[#0b1220] border-slate-800'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-black text-white">{sc.title}</h4>
                        {isDom && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 text-[9px] font-mono font-black uppercase">
                            Trọng tâm
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-semibold text-cyan-300">
                        {sc.vietnameseTitle}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0 ${tierBadge}`}
                    >
                      {sc.confidenceLabel}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">{sc.definition}</p>

                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase text-emerald-300">
                      Bằng chứng ủng hộ:
                    </div>
                    <ul className="space-y-0.5">
                      {sc.supportingEvidence.map((item, i) => (
                        <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                          <span className="text-emerald-400 font-bold">+</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase text-rose-300">
                      Tín hiệu còn mâu thuẫn:
                    </div>
                    <ul className="space-y-0.5">
                      {sc.conflictingSignals.map((item, i) => (
                        <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                          <span className="text-rose-400 font-bold">−</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase text-cyan-300">
                      Điều kiện xác nhận:
                    </div>
                    <ul className="space-y-0.5">
                      {sc.confirmationConditions.map((item, i) => (
                        <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                          <span className="text-cyan-400">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <div className="text-[10px] font-bold text-amber-300">Tác động dự kiến:</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {sc.expectedMarketImpact}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================== AREA E: CROSS-ASSET IMPACT MATRIX ==================== */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/35 text-[10px] font-mono font-bold text-blue-300 uppercase">
              Khu vực E • Tác Động Tài Sản
            </span>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              Truyền Dẫn Liên Thị Trường & Chuyển Biểu Đồ Nhanh
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Nhấn mã tài sản để mở biểu đồ phân tích • Không tự động đặt lệnh
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {data.assetImpacts.map(grp => {
            const isBull = grp.directionBias === 'BULLISH';
            const isBear = grp.directionBias === 'BEARISH';
            return (
              <div
                key={grp.id}
                className="p-3.5 rounded-xl bg-[#0c1322] border border-slate-800 flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white">{grp.groupTitle}</h4>
                      <div className="text-[10px] font-mono text-cyan-300">{grp.assetsLabel}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1 ${
                        isBull
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : isBear
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                      }`}
                    >
                      {isBull ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : isBear ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : (
                        <Activity className="w-3 h-3" />
                      )}
                      <span>{grp.directionLabel}</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">{grp.impactMechanism}</p>

                  <div className="p-2 rounded-lg bg-[#080d18] border border-slate-800/80 space-y-1 text-[11px]">
                    <div>
                      <span className="font-bold text-emerald-300">Điều kiện xác nhận: </span>
                      <span className="text-slate-300">{grp.confirmationCondition}</span>
                    </div>
                    <div>
                      <span className="font-bold text-amber-300">Rủi ro phản ứng ngược: </span>
                      <span className="text-slate-400">{grp.contrarianReversalRisk}</span>
                    </div>
                  </div>
                </div>

                {/* Clickable Asset Jump Pills */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Mở biểu đồ:</span>
                  {grp.jumpTickers.map(ticker => {
                    const exists = availableTickerSet.has(ticker.toUpperCase());
                    return (
                      <button
                        key={ticker}
                        type="button"
                        disabled={!exists}
                        onClick={() => onJumpToSymbol(ticker)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 border transition ${
                          exists
                            ? 'bg-[#131f36] hover:bg-cyan-500/20 text-cyan-300 border-slate-700 hover:border-cyan-400 cursor-pointer'
                            : 'bg-slate-900 text-slate-500 border-slate-800 cursor-default'
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
          })}
        </div>
      </section>

      {/* ==================== AREA F: SMART ALERTS & TELEGRAM PHASE-2 CONTRACT ==================== */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/35 text-[10px] font-mono font-bold text-rose-300 uppercase">
              Khu vực F • Cảnh Báo Thông Minh
            </span>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              Hệ Thống Phát Hiện Chuyển Dịch Có Ý Nghĩa & Chống Lặp
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Send className="w-3 h-3 text-cyan-400" />
            <span>Telegram Ready (Server-side Webhook • 0 API Key ở Frontend)</span>
          </span>
        </div>

        {data.dataQuality.validSignalsCount < 4 ? (
          <div className="p-4 rounded-xl bg-[#0c1322] border border-amber-500/35 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-amber-300">
                Tạm khóa phát cảnh báo mới do độ bao phủ dữ liệu dưới ngưỡng an toàn ({data.dataQuality.validSignalsCount}/7)
              </div>
              <p className="text-[11px] text-slate-400">
                Hệ thống tự động chặn phát cảnh báo từ dữ liệu thiếu, lỗi hoặc quá hạn nhằm bảo vệ quyết định của nhà đầu tư.
              </p>
            </div>
          </div>
        ) : data.activeAlerts.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#0c1322] border border-emerald-500/30 flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-emerald-300">
                Trạng thái Ổn định (No Pivot) — Chưa xuất hiện cảnh báo chuyển dịch hoặc rủi ro hệ thống mới
              </div>
              <p className="text-[11px] text-slate-400">
                Bộ lọc chống nhiễu chỉ phát cảnh báo khi điểm hội tụ bước vào vùng Watch / Pivot hoặc xuất hiện tín hiệu căng thẳng tài chính thực sự.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.activeAlerts.map(alert => {
              const st = getAlertTierStyle(alert.tier);
              return (
                <div key={alert.id} className={`p-3.5 rounded-xl border space-y-2.5 ${st.card}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {alert.tier === 'RISK_WARNING' ? (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <BellRing className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border ${st.badge}`}
                      >
                        {alert.tierLabel}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                        alert.isNew
                          ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50'
                          : 'bg-slate-900/90 text-slate-400 border-slate-700'
                      }`}
                    >
                      {alert.isNew ? '● CẢNH BÁO MỚI' : '✓ ĐÃ GHI NHẬN (CHỐNG LẶP)'}
                    </span>
                  </div>

                  {/* 5 Mandatory Structured Answers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
                    <div className="p-2.5 rounded-lg bg-[#080d18]/90 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-cyan-300">1. Điều gì vừa thay đổi?</div>
                      <p className="text-slate-200 leading-relaxed">{alert.whatChanged}</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#080d18]/90 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-emerald-300">2. Bằng chứng nào xác nhận?</div>
                      <ul className="space-y-0.5 text-slate-300">
                        {alert.confirmingEvidence.slice(0, 3).map((ev, i) => (
                          <li key={i}>• {ev}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#080d18]/90 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-rose-300">3. Tín hiệu nào còn mâu thuẫn?</div>
                      <ul className="space-y-0.5 text-slate-300">
                        {alert.conflictingSignals.slice(0, 3).map((cf, i) => (
                          <li key={i}>• {cf}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#080d18]/90 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-amber-300">
                        5. Người dùng nên theo dõi / chuẩn bị gì?
                      </div>
                      <ul className="space-y-0.5 text-slate-300">
                        {alert.actionableChecklist.map((act, i) => (
                          <li key={i}>• {act}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Question 4: Affected Assets with Clickable Chart Jump */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-200">
                        4. Tác động tới tài sản:
                      </span>
                      {alert.affectedAssets.map(ticker => {
                        const exists = availableTickerSet.has(ticker.toUpperCase());
                        return (
                          <button
                            key={ticker}
                            type="button"
                            disabled={!exists}
                            onClick={() => onJumpToSymbol(ticker)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 border transition ${
                              exists
                                ? 'bg-[#131f36] hover:bg-cyan-500/20 text-cyan-300 border-slate-700 hover:border-cyan-400 cursor-pointer'
                                : 'bg-slate-900 text-slate-500 border-slate-800'
                            }`}
                          >
                            <span>{ticker}</span>
                            {exists && <ArrowUpRight className="w-2.5 h-2.5" />}
                          </button>
                        );
                      })}
                    </div>

                    <span className="text-[9px] font-mono text-slate-500">
                      Endpoint giai đoạn 2: {alert.telegramContract.serverEndpoint}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
