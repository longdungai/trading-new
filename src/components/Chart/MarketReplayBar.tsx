import React, { useState, useEffect } from 'react';
import { Candle } from '../../types';
import { formatPrice, formatTime } from '../../utils/formatters';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  X,
  TrendingUp,
  TrendingDown,
  Award,
} from 'lucide-react';

interface PracticePosition {
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  entryTime: number;
}

interface MarketReplayBarProps {
  totalCandles: number;
  cutIndex: number;
  currentCandle: Candle | undefined;
  isPlaying: boolean;
  speedMs: number;
  quoteAsset?: string;
  isVND?: boolean;
  onChangeCutIndex: (index: number) => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onChangeSpeed: (ms: number) => void;
  onExitReplay: () => void;
}

export const MarketReplayBar: React.FC<MarketReplayBarProps> = ({
  totalCandles,
  cutIndex,
  currentCandle,
  isPlaying,
  speedMs,
  isVND = false,
  onChangeCutIndex,
  onTogglePlay,
  onStepForward,
  onChangeSpeed,
  onExitReplay,
}) => {
  const minCut = Math.min(30, Math.max(5, Math.floor(totalCandles * 0.15)));
  const maxCut = Math.max(minCut, totalCandles - 1);

  const [position, setPosition] = useState<PracticePosition | null>(null);
  const [closedPnlPct, setClosedPnlPct] = useState<number>(0);
  const [winCount, setWinCount] = useState<number>(0);
  const [tradeCount, setTradeCount] = useState<number>(0);

  useEffect(() => {
    // Reset practice position if user rewinds before entry candle
    if (position && currentCandle && currentCandle.time < position.entryTime) {
      setPosition(null);
    }
  }, [currentCandle, position]);

  const livePrice = currentCandle?.close || 0;
  const prefix = isVND ? '' : '$';
  const suffix = isVND ? 'k' : '';

  const openPnlPct =
    position && position.entryPrice > 0 && livePrice > 0
      ? position.side === 'LONG'
        ? ((livePrice - position.entryPrice) / position.entryPrice) * 100
        : ((position.entryPrice - livePrice) / position.entryPrice) * 100
      : 0;

  const handleOpenSide = (side: 'LONG' | 'SHORT') => {
    if (!currentCandle) return;
    if (position) {
      // Close existing first
      setClosedPnlPct(prev => prev + openPnlPct);
      setTradeCount(prev => prev + 1);
      if (openPnlPct > 0) setWinCount(prev => prev + 1);
    }
    setPosition({
      side,
      entryPrice: currentCandle.close,
      entryTime: currentCandle.time,
    });
  };

  const handleClosePosition = () => {
    if (!position) return;
    setClosedPnlPct(prev => prev + openPnlPct);
    setTradeCount(prev => prev + 1);
    if (openPnlPct > 0) setWinCount(prev => prev + 1);
    setPosition(null);
  };

  return (
    <div className="bg-[#0b1220]/95 backdrop-blur-xl border-t border-purple-500/40 px-3 py-2 z-20 flex flex-wrap items-center justify-between gap-2 text-xs shadow-[0_-6px_25px_rgba(0,0,0,0.65)] shrink-0">
      {/* Left: Playback Transport & Timeline Scrubber */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded-md bg-purple-500/25 border border-purple-400/50 text-purple-200 font-mono font-extrabold text-[10px] uppercase tracking-wider">
          🎬 BAR REPLAY
        </span>

        <button
          type="button"
          onClick={onTogglePlay}
          disabled={cutIndex >= maxCut}
          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] transition ${
            isPlaying
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40'
          }`}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isPlaying ? 'Tạm dừng' : 'Chạy'}</span>
        </button>

        <button
          type="button"
          onClick={onStepForward}
          disabled={cutIndex >= maxCut}
          className="px-2 py-1 rounded-lg bg-[#162136] hover:bg-[#1e2d4a] border border-slate-700 text-slate-200 font-semibold flex items-center gap-1 text-[11px] disabled:opacity-40 transition"
          title="Tiến thêm 1 cây nến (Không nhìn trước tương lai)"
        >
          <SkipForward className="w-3.5 h-3.5 text-cyan-400" />
          <span>+1 Nến</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeCutIndex(Math.max(minCut, Math.floor(totalCandles * 0.45)))}
          className="p-1 rounded-lg bg-[#162136] hover:bg-[#1e2d4a] border border-slate-700 text-slate-300"
          title="Tua lại mốc 45% lịch sử"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Speed Selector */}
        <div className="flex items-center gap-0.5 bg-[#090e19] p-0.5 rounded-lg border border-slate-800 font-mono text-[10px]">
          {[
            { label: '1x', ms: 850 },
            { label: '2x', ms: 420 },
            { label: '5x', ms: 160 },
          ].map(sp => (
            <button
              key={sp.label}
              type="button"
              onClick={() => onChangeSpeed(sp.ms)}
              className={`px-1.5 py-0.5 rounded font-bold transition ${
                speedMs === sp.ms ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {sp.label}
            </button>
          ))}
        </div>

        {/* Scrubber */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={minCut}
            max={maxCut}
            value={Math.min(maxCut, Math.max(minCut, cutIndex))}
            onChange={e => onChangeCutIndex(Number(e.target.value))}
            className="w-24 sm:w-36 accent-purple-500 cursor-pointer"
          />
          <span className="font-mono text-[10.5px] text-cyan-300">
            Nến {cutIndex + 1}/{totalCandles}
            {currentCandle ? ` • ${formatTime(currentCandle.time)}` : ''}
          </span>
        </div>
      </div>

      {/* Right: Zero-Lookahead Practice Trading Pad */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-[#080d17] px-2 py-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => handleOpenSide('LONG')}
            className="px-2 py-0.5 rounded bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-[10.5px] flex items-center gap-1 transition"
          >
            <TrendingUp className="w-3 h-3" />
            <span>Mua Tập</span>
          </button>

          {!isVND && (
            <button
              type="button"
              onClick={() => handleOpenSide('SHORT')}
              className="px-2 py-0.5 rounded bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-[10.5px] flex items-center gap-1 transition"
            >
              <TrendingDown className="w-3 h-3" />
              <span>Bán Tập</span>
            </button>
          )}

          {position && (
            <button
              type="button"
              onClick={handleClosePosition}
              className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10.5px] transition"
            >
              Chốt ({openPnlPct >= 0 ? '+' : ''}
              {openPnlPct.toFixed(2)}%)
            </button>
          )}
        </div>

        {position && (
          <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200">
            {position.side} @ {prefix}
            {formatPrice(position.entryPrice)}
            {suffix}
          </span>
        )}

        {tradeCount > 0 && (
          <span
            className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
              closedPnlPct >= 0
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
            }`}
          >
            <Award className="w-3 h-3" />
            <span>
              Phiên tập: {closedPnlPct >= 0 ? '+' : ''}
              {closedPnlPct.toFixed(2)}% ({winCount}/{tradeCount} thắng)
            </span>
          </span>
        )}

        <button
          type="button"
          onClick={onExitReplay}
          className="px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 font-bold text-[10.5px] flex items-center gap-1 transition"
          title="Thoát chế độ Bar Replay, quay về thời gian thực"
        >
          <X className="w-3.5 h-3.5" />
          <span>Thoát Replay</span>
        </button>
      </div>
    </div>
  );
};
