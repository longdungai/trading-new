import React, { useMemo, useState } from 'react';
import { Candle, Timeframe } from '../../types';
import {
  calculateVisibleVolumeProfile,
  evaluateTechnicalMtfConfluence,
} from '../../services/analysis/volumeProfileMtf';
import { formatPrice } from '../../utils/formatters';
import { Layers, BarChart2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface MtfAndVpvrCardProps {
  symbol: string;
  quoteAsset?: string;
  activeTimeframe: Timeframe;
  candles: Candle[];
  mtfCandlesMap: Partial<Record<Timeframe, Candle[]>>;
  vpvrEnabled: boolean;
  vwapEnabled: boolean;
  onToggleVpvr: () => void;
  onToggleVwap: () => void;
  onSelectTimeframe: (tf: Timeframe) => void;
}

export const MtfAndVpvrCard: React.FC<MtfAndVpvrCardProps> = ({
  symbol,
  quoteAsset = 'USD',
  activeTimeframe,
  candles,
  mtfCandlesMap,
  vpvrEnabled,
  vwapEnabled,
  onToggleVpvr,
  onToggleVwap,
  onSelectTimeframe,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const isVND = quoteAsset === 'VND';
  const prefix = isVND ? '' : '$';
  const suffix = isVND ? 'k' : '';

  const mtfSummary = useMemo(
    () => evaluateTechnicalMtfConfluence(symbol, activeTimeframe, candles, mtfCandlesMap),
    [symbol, activeTimeframe, candles, mtfCandlesMap]
  );

  const vpvr = useMemo(() => calculateVisibleVolumeProfile(candles, 24, 0.7), [candles]);

  const regimeBadgeClass =
    mtfSummary.overallRegime === 'STRONG_BULL_ALIGN' || mtfSummary.overallRegime === 'BULL_BIAS'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : mtfSummary.overallRegime === 'STRONG_BEAR_ALIGN' || mtfSummary.overallRegime === 'BEAR_BIAS'
        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/35';

  return (
    <div className="bg-[#0b111d] border border-slate-800/90 rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div
        onClick={() => setCollapsed(prev => !prev)}
        className="px-3 py-2 bg-gradient-to-r from-[#0f1728] to-[#0b111d] border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-[#131d32] transition"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-white font-mono tracking-tight truncate">
              ĐỒNG THUẬN ĐA KHUNG & VOLUME PROFILE
            </div>
            <div className="text-[10px] text-slate-400 truncate">{mtfSummary.regimeLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${regimeBadgeClass}`}>
            {mtfSummary.overallScore >= 0 ? `+${mtfSummary.overallScore}` : mtfSummary.overallScore}đ
          </span>
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="p-2.5 space-y-2.5 text-[11px]">
          {/* 4-Timeframe Matrix */}
          <div className="grid grid-cols-4 gap-1.5">
            {mtfSummary.rows.map(row => {
              const isCurr = activeTimeframe === row.timeframe;
              const biasColor = !row.available
                ? 'border-slate-800 bg-[#0d1422] text-slate-500'
                : row.score >= 20
                  ? 'border-emerald-500/35 bg-emerald-950/25 text-emerald-300'
                  : row.score <= -20
                    ? 'border-rose-500/35 bg-rose-950/25 text-rose-300'
                    : 'border-slate-700/70 bg-slate-900/60 text-amber-300';

              return (
                <button
                  key={row.timeframe}
                  type="button"
                  onClick={() => onSelectTimeframe(row.timeframe)}
                  className={`p-1.5 rounded-lg border text-left transition hover:brightness-110 ${biasColor} ${
                    isCurr ? 'ring-1 ring-cyan-400' : ''
                  }`}
                  title={`Nhấn để chuyển biểu đồ sang khung ${row.timeframe}`}
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-black text-[10.5px] text-white">{row.timeframe}</span>
                    <span className="text-[9px] font-bold">
                      {!row.available
                        ? '...'
                        : row.score >= 20
                          ? 'TĂNG'
                          : row.score <= -20
                            ? 'GIẢM'
                            : 'NGANG'}
                    </span>
                  </div>
                  <div className="mt-1 text-[9.5px] font-mono text-slate-300 flex items-center justify-between">
                    <span>RSI {row.rsi14 !== null ? row.rsi14.toFixed(0) : '--'}</span>
                    <span className="opacity-80">
                      {row.supertrendDir === 'BULL' ? 'ST↑' : row.supertrendDir === 'BEAR' ? 'ST↓' : '•'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Counter-trend warning */}
          {mtfSummary.conflictWarning && (
            <div className="px-2.5 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/35 text-[10.5px] text-amber-200 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{mtfSummary.conflictWarning}</span>
            </div>
          )}

          {/* VPVR Key Institutional Levels (POC / VAH / VAL) */}
          {vpvr && (
            <div className="p-2 rounded-lg bg-[#080d17] border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-300 uppercase">
                  <BarChart2 className="w-3 h-3 text-amber-400" />
                  <span>Vùng Giá Trị Khối Lượng (VA 70%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onToggleVpvr}
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold border transition ${
                      vpvrEnabled
                        ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    VPVR {vpvrEnabled ? 'BẬT' : 'TẮT'}
                  </button>
                  <button
                    type="button"
                    onClick={onToggleVwap}
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold border transition ${
                      vwapEnabled
                        ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    VWAP {vwapEnabled ? 'BẬT' : 'TẮT'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                  <div className="text-[9px] text-slate-400">VAH (Cận Trên)</div>
                  <div className="font-bold text-sky-300">
                    {prefix}
                    {formatPrice(vpvr.vahPrice)}
                    {suffix}
                  </div>
                </div>
                <div className="p-1.5 rounded bg-amber-950/30 border border-amber-500/40">
                  <div className="text-[9px] text-amber-300 font-semibold">POC (Đỉnh KL)</div>
                  <div className="font-extrabold text-amber-200">
                    {prefix}
                    {formatPrice(vpvr.pocPrice)}
                    {suffix}
                  </div>
                </div>
                <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                  <div className="text-[9px] text-slate-400">VAL (Cận Dưới)</div>
                  <div className="font-bold text-indigo-300">
                    {prefix}
                    {formatPrice(vpvr.valPrice)}
                    {suffix}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span>
                  Vị thế giá:{' '}
                  <strong
                    className={
                      vpvr.pricePositionVsVa === 'ABOVE_VAH'
                        ? 'text-emerald-400'
                        : vpvr.pricePositionVsVa === 'BELOW_VAL'
                          ? 'text-rose-400'
                          : 'text-cyan-300'
                    }
                  >
                    {vpvr.pricePositionVsVa === 'ABOVE_VAH'
                      ? 'Bứt phá trên VAH'
                      : vpvr.pricePositionVsVa === 'BELOW_VAL'
                        ? 'Dưới vùng giá trị VAL'
                        : 'Cân bằng trong VA 70%'}
                  </strong>
                </span>
                <span className="font-mono text-emerald-300">
                  Mua chủ động: {vpvr.buyPressurePct.toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
