import React, { useMemo, useState } from 'react';
import { Candle, IndicatorSettings } from '../../types';
import { calculateMACD, calculateRSI } from '../../services/indicators';

interface IndicatorPanelsProps {
  candles: Candle[];
  settings: IndicatorSettings;
}

export const IndicatorPanels: React.FC<IndicatorPanelsProps> = ({ candles, settings }) => {
  const [hoverRsiIdx, setHoverRsiIdx] = useState<number | null>(null);

  const safeCandles = candles && candles.length >= 15 ? candles : [];
  const displayCount = Math.min(safeCandles.length, 90);

  // 1. RSI(14) + RSI-SMA(14) Signal Line (TradingView Standard) — Hooks ALWAYS run unconditionally
  const allRSI = useMemo(
    () => (settings.rsi && safeCandles.length >= 15 ? calculateRSI(safeCandles, 14) : []),
    [safeCandles, settings.rsi]
  );
  const rsiData = useMemo(
    () => (displayCount > 0 ? allRSI.slice(-displayCount) : []),
    [allRSI, displayCount]
  );

  // Compute 14-period SMA of RSI for crossover visibility
  const rsiSmaData = useMemo(() => {
    if (!settings.rsi || allRSI.length === 0 || displayCount === 0) return [];
    const period = 14;
    const smaFull: (number | null)[] = new Array(allRSI.length).fill(null);
    let sum = 0;
    for (let i = 0; i < allRSI.length; i++) {
      sum += allRSI[i].value;
      if (i >= period) {
        sum -= allRSI[i - period].value;
      }
      if (i >= period - 1) {
        smaFull[i] = sum / period;
      } else {
        smaFull[i] = sum / (i + 1);
      }
    }
    return smaFull.slice(-displayCount);
  }, [allRSI, displayCount, settings.rsi]);

  const activeRsiIndex =
    hoverRsiIdx !== null && hoverRsiIdx >= 0 && hoverRsiIdx < rsiData.length
      ? hoverRsiIdx
      : Math.max(0, rsiData.length - 1);

  const currentRSI = rsiData.length > 0 ? rsiData[activeRsiIndex]?.value ?? 50 : 50;
  const currentRsiSma =
    rsiSmaData.length > 0 && rsiSmaData[activeRsiIndex] !== null && rsiSmaData[activeRsiIndex] !== undefined
      ? (rsiSmaData[activeRsiIndex] as number)
      : currentRSI;
  const latestRsi = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : 50;

  // 2. MACD(12, 26, 9) Data
  const allMACD = useMemo(
    () => (settings.macd && safeCandles.length >= 15 ? calculateMACD(safeCandles, 12, 26, 9) : []),
    [safeCandles, settings.macd]
  );
  const macdData = useMemo(
    () => (displayCount > 0 ? allMACD.slice(-displayCount) : []),
    [allMACD, displayCount]
  );
  const currentMACD =
    macdData.length > 0
      ? macdData[macdData.length - 1]
      : { macd: 0, signal: 0, histogram: 0 };

  const maxAbsMACD = useMemo(() => {
    if (macdData.length === 0) return 1;
    let max = 0.00001;
    for (const d of macdData) {
      if (Math.abs(d.macd) > max) max = Math.abs(d.macd);
      if (Math.abs(d.signal) > max) max = Math.abs(d.signal);
      if (Math.abs(d.histogram) > max) max = Math.abs(d.histogram);
    }
    return max * 1.15;
  }, [macdData]);

  // Build SVG path & area points for RSI
  const rsiPoints = useMemo(() => {
    if (rsiData.length < 2) return '';
    return rsiData
      .map((d, idx) => {
        const x = (idx / (rsiData.length - 1)) * 100;
        const y = Math.max(2, Math.min(98, 100 - d.value));
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [rsiData]);

  const rsiAreaPoints = useMemo(() => {
    if (!rsiPoints) return '';
    return `0,100 ${rsiPoints} 100,100`;
  }, [rsiPoints]);

  const rsiSmaPoints = useMemo(() => {
    if (rsiSmaData.length < 2) return '';
    return rsiSmaData
      .map((val, idx) => {
        const v = val !== null && val !== undefined ? val : 50;
        const x = (idx / (rsiSmaData.length - 1)) * 100;
        const y = Math.max(2, Math.min(98, 100 - v));
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [rsiSmaData]);

  const rsiStateBadge = useMemo(() => {
    if (currentRSI >= 70) {
      return {
        label: 'QUÁ MUA (>70)',
        cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        lineColor: '#fb7185',
        pillBg: 'bg-rose-500 text-white',
      };
    }
    if (currentRSI <= 30) {
      return {
        label: 'QUÁ BÁN (<30 • VÙNG GOM)',
        cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        lineColor: '#34d399',
        pillBg: 'bg-emerald-500 text-slate-950',
      };
    }
    if (currentRSI >= 50) {
      return {
        label: 'XUNG LỰC TĂNG (>50)',
        cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
        lineColor: '#c084fc',
        pillBg: 'bg-purple-500 text-white',
      };
    }
    return {
      label: 'XUNG LỰC YẾU (<50)',
      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
      lineColor: '#c084fc',
      pillBg: 'bg-purple-500 text-white',
    };
  }, [currentRSI]);

  // Early return ONLY AFTER all hooks have executed
  if (!settings.rsi && !settings.macd) return null;
  if (safeCandles.length < 15) return null;

  const latestRsiY = Math.max(6, Math.min(94, 100 - latestRsi));

  return (
    <div className="border-t border-slate-800/90 bg-[#060a12] select-none shrink-0 divide-y divide-slate-800/80">
      {/* ================= 1. DEDICATED HIGH-CLARITY RSI(14) PANEL ================= */}
      {settings.rsi && (
        <div
          className="h-[74px] sm:h-[92px] px-2 sm:px-3 py-1 relative flex flex-col justify-between"
          onMouseLeave={() => setHoverRsiIdx(null)}
          onMouseMove={(e) => {
            if (rsiData.length < 2) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const chartWidth = Math.max(1, rect.width - 52);
            const relX = Math.max(0, Math.min(chartWidth, e.clientX - rect.left));
            const idx = Math.round((relX / chartWidth) * (rsiData.length - 1));
            setHoverRsiIdx(idx);
          }}
        >
          {/* Top RSI Header Bar */}
          <div className="flex items-center justify-between gap-2 z-10 text-[9.5px] sm:text-[10.5px] font-mono leading-none">
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="w-2 h-0.5 rounded-full bg-purple-400 inline-block" />
                <span className="font-extrabold text-purple-300">RSI(14):</span>
                <span
                  className={`font-black text-[11px] sm:text-xs ${
                    currentRSI >= 70
                      ? 'text-rose-400'
                      : currentRSI <= 30
                      ? 'text-emerald-400'
                      : 'text-white'
                  }`}
                >
                  {currentRSI.toFixed(1)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <span className="w-2 h-0.5 rounded-full bg-amber-400 inline-block" />
                <span className="text-amber-300/90 font-semibold">MA(14):</span>
                <span className="font-bold text-amber-300">{currentRsiSma.toFixed(1)}</span>
              </div>

              <span
                className={`px-1.5 py-0.5 rounded border text-[8.5px] sm:text-[9px] font-sans font-bold ${rsiStateBadge.cls}`}
              >
                {rsiStateBadge.label}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[9px] text-slate-400 font-mono">
              <span className="text-rose-400 font-semibold">Quá mua: 70</span>
              <span>•</span>
              <span className="text-slate-300">Trục giữa: 50</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">Quá bán: 30</span>
            </div>
          </div>

          {/* Main RSI Canvas + Right Scale Gutter */}
          <div className="flex-1 flex items-stretch gap-1 min-h-0 pt-1">
            <div className="flex-1 h-full relative">
              <svg
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <defs>
                  <linearGradient id="rsiCurveFillGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.28" />
                    <stop offset="50%" stopColor="#818cf8" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0.03" />
                  </linearGradient>
                </defs>

                {/* Overbought Zone (70..100 -> y: 0..30) */}
                <rect x="0" y="0" width="100" height="30" fill="rgba(244, 63, 94, 0.07)" />
                {/* Normal Channel Band (30..70 -> y: 30..70) */}
                <rect x="0" y="30" width="100" height="40" fill="rgba(139, 92, 246, 0.07)" />
                {/* Oversold Zone (0..30 -> y: 70..100) */}
                <rect x="0" y="70" width="100" height="30" fill="rgba(16, 185, 129, 0.08)" />

                {/* Crisp Horizontal Reference Lines (70 / 50 / 30) with non-scaling stroke */}
                <line
                  x1="0"
                  y1="30"
                  x2="100"
                  y2="30"
                  stroke="rgba(251, 113, 133, 0.65)"
                  strokeDasharray="4,3"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1="0"
                  y1="50"
                  x2="100"
                  y2="50"
                  stroke="rgba(148, 163, 184, 0.38)"
                  strokeDasharray="2,3"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1="0"
                  y1="70"
                  x2="100"
                  y2="70"
                  stroke="rgba(52, 211, 153, 0.65)"
                  strokeDasharray="4,3"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Soft Gradient Fill under RSI Curve */}
                {rsiAreaPoints && <polygon points={rsiAreaPoints} fill="url(#rsiCurveFillGrad)" />}

                {/* RSI-SMA(14) Signal Line (TradingView Warm Amber) */}
                {rsiSmaPoints && (
                  <polyline
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                    strokeOpacity="0.88"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={rsiSmaPoints}
                  />
                )}

                {/* Outer Glow Layer for Main RSI(14) Curve */}
                {rsiPoints && (
                  <polyline
                    fill="none"
                    stroke={rsiStateBadge.lineColor}
                    strokeWidth="4.5"
                    strokeOpacity="0.22"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={rsiPoints}
                  />
                )}

                {/* Main High-Contrast RSI(14) Curve */}
                {rsiPoints && (
                  <polyline
                    fill="none"
                    stroke={rsiStateBadge.lineColor}
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={rsiPoints}
                  />
                )}

                {/* Hover Crosshair Guide Line */}
                {hoverRsiIdx !== null && rsiData.length > 1 && (
                  <line
                    x1={(hoverRsiIdx / (rsiData.length - 1)) * 100}
                    y1="0"
                    x2={(hoverRsiIdx / (rsiData.length - 1)) * 100}
                    y2="100"
                    stroke="rgba(34, 211, 238, 0.65)"
                    strokeDasharray="2,2"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {/* Live Pulsing Endpoint Dot at Right Edge of RSI Curve */}
              <div
                className="absolute right-0 w-2.5 h-2.5 -mr-1 -mt-1.5 rounded-full border border-white shadow-md pointer-events-none"
                style={{
                  top: `${latestRsiY}%`,
                  backgroundColor: rsiStateBadge.lineColor,
                }}
              />
            </div>

            {/* Right Scale Axis (70 / 50 / 30 + Live RSI Pill) */}
            <div className="w-[46px] sm:w-[54px] shrink-0 relative border-l border-slate-800/80 pl-1 font-mono text-[8.5px] sm:text-[9px] text-slate-400">
              <span className="absolute right-1 top-[22%] text-rose-400/90 font-semibold">70</span>
              <span className="absolute right-1 top-[44%] text-slate-400">50</span>
              <span className="absolute right-1 top-[66%] text-emerald-400/90 font-semibold">30</span>

              {/* Floating Live RSI Tag on Axis */}
              <span
                className={`absolute right-0.5 left-1 -mt-2 px-1 py-0.2 rounded text-[9px] font-black text-center shadow ${rsiStateBadge.pillBg}`}
                style={{ top: `${latestRsiY}%` }}
              >
                {latestRsi.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. DEDICATED MACD(12, 26, 9) PANEL ================= */}
      {settings.macd && (
        <div className="h-[54px] sm:h-[68px] px-2 sm:px-3 py-1 relative flex flex-col justify-between">
          <div className="flex items-center justify-between z-10 text-[9.5px] sm:text-[10px] font-mono leading-none">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sky-400">MACD(12,26,9):</span>
              <span className="text-sky-300 font-semibold">M: {currentMACD.macd.toFixed(2)}</span>
              <span className="text-amber-400 font-semibold">S: {currentMACD.signal.toFixed(2)}</span>
              <span
                className={`font-bold ${
                  currentMACD.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                Hist: {currentMACD.histogram >= 0 ? `+${currentMACD.histogram.toFixed(2)}` : currentMACD.histogram.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex-1 flex items-stretch gap-1 min-h-0 pt-0.5">
            <div className="flex-1 h-full relative">
              <svg
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <line
                  x1="0"
                  y1="50"
                  x2="100"
                  y2="50"
                  stroke="rgba(148, 163, 184, 0.28)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />

                {macdData.map((d, idx) => {
                  const x = (idx / Math.max(1, macdData.length - 1)) * 100;
                  const normalizedH = (d.histogram / maxAbsMACD) * 44;
                  const barHeight = Math.abs(normalizedH);
                  const y = normalizedH >= 0 ? 50 - barHeight : 50;
                  const color =
                    d.histogram >= 0 ? 'rgba(16, 185, 129, 0.48)' : 'rgba(244, 63, 94, 0.48)';
                  return (
                    <rect
                      key={idx}
                      x={Math.max(0, x - 0.45)}
                      y={y}
                      width="0.9"
                      height={Math.max(1, barHeight)}
                      fill={color}
                    />
                  );
                })}

                {macdData.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={macdData
                      .map((d, idx) => {
                        const x = (idx / (macdData.length - 1)) * 100;
                        const y = 50 - (d.signal / maxAbsMACD) * 44;
                        return `${x.toFixed(2)},${Math.max(3, Math.min(97, y)).toFixed(2)}`;
                      })
                      .join(' ')}
                  />
                )}

                {macdData.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={macdData
                      .map((d, idx) => {
                        const x = (idx / (macdData.length - 1)) * 100;
                        const y = 50 - (d.macd / maxAbsMACD) * 44;
                        return `${x.toFixed(2)},${Math.max(3, Math.min(97, y)).toFixed(2)}`;
                      })
                      .join(' ')}
                  />
                )}
              </svg>
            </div>
            <div className="w-[46px] sm:w-[54px] shrink-0 relative border-l border-slate-800/80 pl-1 font-mono text-[8.5px] text-slate-400">
              <span className="absolute right-1 top-[40%]">0.0</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
