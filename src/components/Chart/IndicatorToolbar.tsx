import React from 'react';
import { IndicatorSettings } from '../../types';
import {
  BrainCircuit,
  GitCommit,
  Sliders,
  Sparkles,
  ShieldAlert,
  Zap,
  Activity,
} from 'lucide-react';

interface IndicatorToolbarProps {
  settings: IndicatorSettings;
  onToggle: (key: keyof IndicatorSettings) => void;
}

export const IndicatorToolbar: React.FC<IndicatorToolbarProps> = ({ settings, onToggle }) => {
  return (
    <div className="h-9 sm:h-10 bg-[#0d121b] border-b border-[#1b2230] px-2 sm:px-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap select-none">
      <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-gray-400 font-semibold uppercase tracking-wider shrink-0 mr-0.5">
        <Sliders className="w-3 h-3 text-blue-400" />
        <span className="hidden sm:inline">Chỉ Báo:</span>
      </div>

      {/* Sub-panels: RSI & MACD - Brought upfront for instant mobile access */}
      <button
        onClick={() => onToggle('rsi')}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border shrink-0 transition ${
          settings.rsi
            ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm shadow-indigo-500/20'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        <Activity className="w-3 h-3 text-indigo-300" />
        <span>RSI (14)</span>
      </button>

      <button
        onClick={() => onToggle('macd')}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border shrink-0 transition ${
          settings.macd
            ? 'bg-blue-600 text-white border-blue-400 shadow-sm shadow-blue-500/20'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        <Activity className="w-3 h-3 text-blue-300" />
        <span>MACD (12,26,9)</span>
      </button>

      <div className="h-4 w-px bg-gray-800 shrink-0 mx-0.5" />

      {/* AI Models & Projections */}
      <button
        onClick={() => onToggle('aiForecast')}
        className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium border shrink-0 transition ${
          settings.aiForecast
            ? 'bg-blue-600/25 text-blue-300 border-blue-500/50 shadow-sm shadow-blue-500/20'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        <Sparkles className="w-3 h-3 text-blue-400" />
        <span>Dự Báo AI</span>
      </button>

      <button
        onClick={() => onToggle('monteCarloPaths')}
        className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium border shrink-0 transition ${
          settings.monteCarloPaths
            ? 'bg-purple-600/25 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/20'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        <BrainCircuit className="w-3 h-3 text-purple-400" />
        <span>Monte Carlo</span>
      </button>

      <div className="h-4 w-px bg-gray-800 shrink-0 mx-0.5" />

      {/* Key Levels & SMC */}
      <button
        onClick={() => onToggle('autoSupportResistance')}
        className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium border shrink-0 transition ${
          settings.autoSupportResistance
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        <ShieldAlert className="w-3 h-3 text-amber-400" />
        <span>Hỗ Trợ/Kháng Cự</span>
      </button>

      <button
        onClick={() => onToggle('autoFibonacci')}
        className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium border shrink-0 transition ${
          settings.autoFibonacci
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        <GitCommit className="w-3 h-3 text-emerald-400" />
        <span>Auto Fib</span>
      </button>

      <button
        onClick={() => onToggle('smartMoneyConcepts')}
        className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium border shrink-0 transition ${
          settings.smartMoneyConcepts
            ? 'bg-indigo-500/25 text-indigo-300 border-indigo-500/50'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        <Zap className="w-3 h-3 text-indigo-400" />
        <span>SMC Order Block</span>
      </button>

      <div className="h-4 w-px bg-gray-800 shrink-0 mx-0.5" />

      {/* Technical Trend Overlays */}
      <button
        onClick={() => onToggle('supertrend')}
        className={`px-2 py-1 rounded text-[11px] font-medium border shrink-0 transition ${
          settings.supertrend
            ? 'bg-emerald-600/25 text-emerald-400 border-emerald-500/50'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        SuperTrend
      </button>

      <button
        onClick={() => onToggle('ema20')}
        className={`px-2 py-1 rounded text-[11px] font-medium border shrink-0 transition ${
          settings.ema20
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        EMA 20
      </button>

      <button
        onClick={() => onToggle('ema50')}
        className={`px-2 py-1 rounded text-[11px] font-medium border shrink-0 transition ${
          settings.ema50
            ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        EMA 50
      </button>

      <button
        onClick={() => onToggle('ema200')}
        className={`px-2 py-1 rounded text-[11px] font-medium border shrink-0 transition ${
          settings.ema200
            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        EMA 200
      </button>

      <button
        onClick={() => onToggle('bollingerBands')}
        className={`px-2 py-1 rounded text-[11px] font-medium border shrink-0 transition ${
          settings.bollingerBands
            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            : 'bg-[#141a24] text-gray-400 border-[#232d3f] hover:text-white'
        }`}
      >
        Bollinger Bands
      </button>
    </div>
  );
};
