import React from 'react';
import { Candle, IndicatorSettings } from '../../types';
import { calculateMACD, calculateRSI } from '../../services/indicators';

interface IndicatorPanelsProps {
  candles: Candle[];
  settings: IndicatorSettings;
}

export const IndicatorPanels: React.FC<IndicatorPanelsProps> = ({ candles, settings }) => {
  if (!settings.rsi && !settings.macd) return null;

  const recentCandles = candles.slice(-80);
  const rsiData = settings.rsi ? calculateRSI(recentCandles, 14) : [];
  const macdData = settings.macd ? calculateMACD(recentCandles) : [];

  const currentRSI = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : 50;
  const currentMACD = macdData.length > 0 ? macdData[macdData.length - 1] : { macd: 0, signal: 0, histogram: 0 };

  return (
    <div className="border-t border-[#1b2230] bg-[#0a0e17] select-none">
      {/* RSI Panel */}
      {settings.rsi && (
        <div className="h-18 sm:h-24 border-b border-[#1b2230] px-2.5 sm:px-3 py-1 relative flex flex-col justify-between">
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[11px] sm:text-xs font-semibold text-indigo-400 font-mono">RSI (14)</span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-white">{currentRSI.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-gray-500 font-mono">
              <span className="text-rose-400">Quá mua 70</span>
              <span>•</span>
              <span className="text-emerald-400">Quá bán 30</span>
            </div>
          </div>

          {/* Simple Vector SVG Chart for RSI */}
          <div className="w-full h-11 sm:h-14 relative">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              {/* Overbought / Oversold Zones */}
              <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(244, 63, 94, 0.3)" strokeDasharray="2,2" strokeWidth="1" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
              <line x1="0" y1="70" x2="100" y2="70" stroke="rgba(16, 185, 129, 0.3)" strokeDasharray="2,2" strokeWidth="1" />

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
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
              )}
            </svg>
          </div>
        </div>
      )}

      {/* MACD Panel */}
      {settings.macd && (
        <div className="h-20 sm:h-28 px-2.5 sm:px-3 py-1 relative flex flex-col justify-between">
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono">
              <span className="font-semibold text-blue-400">MACD (12, 26, 9)</span>
              <span className="text-blue-300">M: {currentMACD.macd.toFixed(2)}</span>
              <span className="text-amber-400">S: {currentMACD.signal.toFixed(2)}</span>
              <span className={currentMACD.histogram >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                H: {currentMACD.histogram.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Simple Vector SVG Chart for MACD & Histogram */}
          <div className="w-full h-12 sm:h-16 relative">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              {/* Zero line */}
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />

              {/* Histogram Bars */}
              {macdData.map((d, idx) => {
                const x = (idx / (macdData.length - 1)) * 100;
                const barHeight = Math.min(45, Math.abs(d.histogram) * 15);
                const y = d.histogram >= 0 ? 50 - barHeight : 50;
                const color = d.histogram >= 0 ? 'rgba(16, 185, 129, 0.65)' : 'rgba(244, 63, 94, 0.65)';
                return <rect key={idx} x={x - 0.4} y={y} width="0.8" height={barHeight} fill={color} />;
              })}

              {/* MACD Line */}
              {macdData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  points={macdData
                    .map((d, idx) => {
                      const x = (idx / (macdData.length - 1)) * 100;
                      const y = 50 - d.macd * 15;
                      return `${x},${Math.max(5, Math.min(95, y))}`;
                    })
                    .join(' ')}
                />
              )}

              {/* Signal Line */}
              {macdData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  points={macdData
                    .map((d, idx) => {
                      const x = (idx / (macdData.length - 1)) * 100;
                      const y = 50 - d.signal * 15;
                      return `${x},${Math.max(5, Math.min(95, y))}`;
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
