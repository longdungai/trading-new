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

  return (
    <div className="border-t border-[#1b2230] bg-[#0a0e17] select-none">
      {/* ================= RSI PANEL ================= */}
      {settings.rsi && (
        <div className={`h-18 sm:h-24 px-2.5 sm:px-3 py-1 relative flex flex-col justify-between ${
          settings.macd ? 'border-b border-[#1b2230]' : ''
        }`}>
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[11px] sm:text-xs font-semibold text-indigo-400 font-mono">RSI (14)</span>
              <span className={`text-[11px] sm:text-xs font-mono font-bold ${
                currentRSI >= 70 ? 'text-rose-400' : currentRSI <= 30 ? 'text-emerald-400' : 'text-white'
              }`}>
                {currentRSI.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-gray-500 font-mono">
              <span className="text-rose-400">Quá mua 70</span>
              <span>•</span>
              <span className="text-emerald-400">Quá bán 30</span>
            </div>
          </div>

          {/* Vector SVG Chart for RSI */}
          <div className="w-full h-11 sm:h-14 relative">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              {/* Overbought / Oversold Zones */}
              <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(244, 63, 94, 0.35)" strokeDasharray="2,2" strokeWidth="1" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />
              <line x1="0" y1="70" x2="100" y2="70" stroke="rgba(16, 185, 129, 0.35)" strokeDasharray="2,2" strokeWidth="1" />

              {/* RSI Curve */}
              {rsiData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2"
                  points={rsiData
                    .map((d, idx) => {
                      const x = (idx / (rsiData.length - 1)) * 100;
                      const y = 100 - d.value; // map 0-100 to svg 100-0
                      return `${x},${Math.max(2, Math.min(98, y))}`;
                    })
                    .join(' ')}
                />
              )}
            </svg>
          </div>
        </div>
      )}

      {/* ================= MACD PANEL ================= */}
      {settings.macd && (
        <div className="h-20 sm:h-28 px-2.5 sm:px-3 py-1 relative flex flex-col justify-between">
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono">
              <span className="font-semibold text-blue-400">MACD (12, 26, 9)</span>
              <span className="text-blue-300">MACD: {currentMACD.macd.toFixed(2)}</span>
              <span className="text-amber-400">Signal: {currentMACD.signal.toFixed(2)}</span>
              <span className={currentMACD.histogram >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                Hist: {currentMACD.histogram >= 0 ? `+${currentMACD.histogram.toFixed(2)}` : currentMACD.histogram.toFixed(2)}
              </span>
            </div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 font-mono hidden sm:block">
              Chu kỳ (12, 26, 9)
            </div>
          </div>

          {/* Dynamic Normalized Vector SVG Chart for MACD & Histogram */}
          <div className="w-full h-12 sm:h-16 relative">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              {/* Zero line */}
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" />

              {/* Histogram Bars */}
              {macdData.map((d, idx) => {
                const x = (idx / (macdData.length - 1)) * 100;
                const normalizedH = (d.histogram / maxAbsMACD) * 45; // scale between -45 and +45
                const barHeight = Math.abs(normalizedH);
                const y = normalizedH >= 0 ? 50 - barHeight : 50;
                const color = d.histogram >= 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(244, 63, 94, 0.75)';
                return <rect key={idx} x={Math.max(0, x - 0.5)} y={y} width="1.0" height={Math.max(1, barHeight)} fill={color} rx="0.3" />;
              })}

              {/* Signal Line (Orange) */}
              {macdData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  points={macdData
                    .map((d, idx) => {
                      const x = (idx / (macdData.length - 1)) * 100;
                      const y = 50 - (d.signal / maxAbsMACD) * 45;
                      return `${x},${Math.max(3, Math.min(97, y))}`;
                    })
                    .join(' ')}
                />
              )}

              {/* MACD Line (Cyan) */}
              {macdData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
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
