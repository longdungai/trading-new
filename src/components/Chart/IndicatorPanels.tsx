import React from 'react';
import { Candle, IndicatorSettings } from '../../types';
import { calculateMACD, calculateRSI } from '../../services/indicators';

interface IndicatorPanelsProps {
  candles: Candle[];
  settings: IndicatorSettings;
}

export const IndicatorPanels: React.FC<IndicatorPanelsProps> = ({ candles, settings }) => {
  if (!settings.rsi && !settings.macd) return null;
  if (!candles || candles.length < 15) return null;

  // Calculate indicators with full history for accuracy, then take the display slice
  const displayCount = Math.min(candles.length, 80);

  // 1. RSI Data
  const allRSI = settings.rsi ? calculateRSI(candles, 14) : [];
  const rsiData = allRSI.slice(-displayCount);
  const currentRSI = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : 50;

  // 2. MACD Data with Full Warmup
  const allMACD = settings.macd ? calculateMACD(candles, 12, 26, 9) : [];
  const macdData = allMACD.slice(-displayCount);
  const currentMACD = macdData.length > 0
    ? macdData[macdData.length - 1]
    : { macd: 0, signal: 0, histogram: 0 };

  // Dynamic Auto-Scale for MACD (Supports BTC $96k, Gold $4.6k, VN30 70k, Doge $0.08)
  const maxAbsMACD = React.useMemo(() => {
    if (macdData.length === 0) return 1;
    let max = 0.00001;
    for (const d of macdData) {
      if (Math.abs(d.macd) > max) max = Math.abs(d.macd);
      if (Math.abs(d.signal) > max) max = Math.abs(d.signal);
      if (Math.abs(d.histogram) > max) max = Math.abs(d.histogram);
    }
    return max * 1.15; // 15% padding so curves don't touch top/bottom edges
  }, [macdData]);

  const isComboMode = settings.rsi && settings.macd;

  return (
    <div className="border-t border-[#1b2230] bg-[#080b12] select-none shrink-0">
      {/* ================= 1. UNIFIED COMBO PANEL: RSI + MACD IN 1 SLIM FRAME ================= */}
      {isComboMode ? (
        <div className="h-14 sm:h-20 px-2 sm:px-3 py-0.5 sm:py-1 relative flex flex-col justify-between">
          {/* Unified Compact Slim Header */}
          <div className="flex items-center justify-between z-10 text-[9px] sm:text-[10px] font-mono leading-none">
            {/* Left: RSI value & MACD values */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <div className="flex items-center gap-1">
                <span className="font-bold text-indigo-400">RSI(14):</span>
                <span className={`font-bold ${
                  currentRSI >= 70 ? 'text-rose-400' : currentRSI <= 30 ? 'text-emerald-400' : 'text-white'
                }`}>
                  {currentRSI.toFixed(1)}
                </span>
              </div>

              <div className="h-2.5 w-px bg-gray-800" />

              <div className="flex items-center gap-1.5">
                <span className="text-cyan-300">M:{currentMACD.macd.toFixed(2)}</span>
                <span className="text-amber-400">S:{currentMACD.signal.toFixed(2)}</span>
                <span className={`font-semibold ${currentMACD.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  H:{currentMACD.histogram >= 0 ? `+${currentMACD.histogram.toFixed(2)}` : currentMACD.histogram.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Right: Slim legend reference */}
            <div className="flex items-center gap-1.5 text-[8px] sm:text-[9px] text-gray-500 font-mono">
              <span className="text-rose-400/80">70</span>
              <span>/</span>
              <span className="text-emerald-400/80">30</span>
            </div>
          </div>

          {/* Unified SVG Vector Layer with Thin, Crisp Strokes */}
          <div className="w-full h-9 sm:h-14 relative">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              {/* Ultra-fine reference lines */}
              <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(244, 63, 94, 0.25)" strokeDasharray="1.5,1.5" strokeWidth="0.5" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.5" />
              <line x1="0" y1="70" x2="100" y2="70" stroke="rgba(16, 185, 129, 0.25)" strokeDasharray="1.5,1.5" strokeWidth="0.5" />

              {/* 1. Slim Background MACD Histogram Bars */}
              {macdData.map((d, idx) => {
                const x = (idx / (macdData.length - 1)) * 100;
                const normalizedH = (d.histogram / maxAbsMACD) * 35;
                const barHeight = Math.abs(normalizedH);
                const y = normalizedH >= 0 ? 50 - barHeight : 50;
                const color = d.histogram >= 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)';
                return <rect key={idx} x={Math.max(0, x - 0.4)} y={y} width="0.8" height={Math.max(0.8, barHeight)} fill={color} />;
              })}

              {/* 2. Slim MACD Signal Line (Orange - stroke 1.0) */}
              {macdData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.0"
                  strokeOpacity="0.8"
                  points={macdData
                    .map((d, idx) => {
                      const x = (idx / (macdData.length - 1)) * 100;
                      const y = 50 - (d.signal / maxAbsMACD) * 38;
                      return `${x},${Math.max(3, Math.min(97, y))}`;
                    })
                    .join(' ')}
                />
              )}

              {/* 3. Slim MACD Line (Cyan - stroke 1.1) */}
              {macdData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.1"
                  strokeOpacity="0.85"
                  points={macdData
                    .map((d, idx) => {
                      const x = (idx / (macdData.length - 1)) * 100;
                      const y = 50 - (d.macd / maxAbsMACD) * 38;
                      return `${x},${Math.max(3, Math.min(97, y))}`;
                    })
                    .join(' ')}
                />
              )}

              {/* 4. Foreground Slim RSI Curve (Indigo - stroke 1.3) */}
              {rsiData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="1.3"
                  points={rsiData
                    .map((d, idx) => {
                      const x = (idx / (rsiData.length - 1)) * 100;
                      const y = 100 - d.value;
                      return `${x},${Math.max(3, Math.min(97, y))}`;
                    })
                    .join(' ')}
                />
              )}
            </svg>
          </div>
        </div>
      ) : settings.rsi ? (
        /* ================= 2. RSI ONLY (SLIM) ================= */
        <div className="h-12 sm:h-18 px-2 sm:px-3 py-0.5 relative flex flex-col justify-between">
          <div className="flex items-center justify-between z-10 text-[9px] sm:text-[10px] font-mono leading-none">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-indigo-400">RSI(14):</span>
              <span className={`font-bold ${
                currentRSI >= 70 ? 'text-rose-400' : currentRSI <= 30 ? 'text-emerald-400' : 'text-white'
              }`}>
                {currentRSI.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[8px] text-gray-500 font-mono">
              <span className="text-rose-400">70</span>
              <span>/</span>
              <span className="text-emerald-400">30</span>
            </div>
          </div>

          <div className="w-full h-8 sm:h-12 relative">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(244, 63, 94, 0.25)" strokeDasharray="1.5,1.5" strokeWidth="0.5" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.5" />
              <line x1="0" y1="70" x2="100" y2="70" stroke="rgba(16, 185, 129, 0.25)" strokeDasharray="1.5,1.5" strokeWidth="0.5" />

              {rsiData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="1.3"
                  points={rsiData
                    .map((d, idx) => {
                      const x = (idx / (rsiData.length - 1)) * 100;
                      const y = 100 - d.value;
                      return `${x},${Math.max(2, Math.min(98, y))}`;
                    })
                    .join(' ')}
                />
              )}
            </svg>
          </div>
        </div>
      ) : (
        /* ================= 3. MACD ONLY (SLIM) ================= */
        <div className="h-12 sm:h-18 px-2 sm:px-3 py-0.5 relative flex flex-col justify-between">
          <div className="flex items-center justify-between z-10 text-[9px] sm:text-[10px] font-mono leading-none">
            <div className="flex items-center gap-1.5 text-blue-300">
              <span className="font-semibold text-blue-400">MACD:</span>
              <span>M:{currentMACD.macd.toFixed(2)}</span>
              <span className="text-amber-400">S:{currentMACD.signal.toFixed(2)}</span>
              <span className={currentMACD.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                H:{currentMACD.histogram >= 0 ? `+${currentMACD.histogram.toFixed(2)}` : currentMACD.histogram.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="w-full h-8 sm:h-12 relative">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.5" />

              {macdData.map((d, idx) => {
                const x = (idx / (macdData.length - 1)) * 100;
                const normalizedH = (d.histogram / maxAbsMACD) * 45;
                const barHeight = Math.abs(normalizedH);
                const y = normalizedH >= 0 ? 50 - barHeight : 50;
                const color = d.histogram >= 0 ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)';
                return <rect key={idx} x={Math.max(0, x - 0.4)} y={y} width="0.8" height={Math.max(0.8, barHeight)} fill={color} />;
              })}

              {macdData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.0"
                  points={macdData
                    .map((d, idx) => {
                      const x = (idx / (macdData.length - 1)) * 100;
                      const y = 50 - (d.signal / maxAbsMACD) * 45;
                      return `${x},${Math.max(3, Math.min(97, y))}`;
                    })
                    .join(' ')}
                />
              )}

              {macdData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  points={macdData
                    .map((d, idx) => {
                      const x = (idx / (macdData.length - 1)) * 100;
                      const y = 50 - (d.macd / maxAbsMACD) * 45;
                      return `${x},${Math.max(3, Math.min(97, y))}`;
                    })
                    .join(' ')}
                />
              )}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
