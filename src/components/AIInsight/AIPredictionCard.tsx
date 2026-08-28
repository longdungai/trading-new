import React from 'react';
import { AIPrediction } from '../../types';
import { Sparkles, TrendingUp, TrendingDown, Target, BrainCircuit, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatPercent, formatPrice } from '../../utils/formatters';

interface AIPredictionCardProps {
  prediction: AIPrediction | null;
}

export const AIPredictionCard: React.FC<AIPredictionCardProps> = ({ prediction }) => {
  if (!prediction) {
    return (
      <div className="p-3 sm:p-4 rounded-xl bg-[#121824] border border-[#1e293b] text-gray-400 text-xs">
        Đang khởi chạy mạng thần kinh AI dự báo đường giá...
      </div>
    );
  }

  const isBull = prediction.trend === 'STRONG_BULLISH' || prediction.trend === 'BULLISH';
  const isBear = prediction.trend === 'STRONG_BEARISH' || prediction.trend === 'BEARISH';

  return (
    <div className="p-3 sm:p-4 rounded-xl bg-[#101622] border border-[#1f2a3e] flex flex-col gap-3 sm:gap-4 shadow-xl select-none">
      {/* Header with AI Badge & Confidence Gauge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              Dự Báo Đường Giá AI
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-400">Monte Carlo & ML Corridor</div>
          </div>
        </div>

        {/* Confidence Badge */}
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-[#182234] border border-[#2b3a54]">
          <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[11px] sm:text-xs font-mono font-bold text-purple-300">
            {prediction.confidenceScore}% Tin Cậy
          </span>
        </div>
      </div>

      {/* Main Trend Status & Expected Move */}
      <div className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between ${
        isBull
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : isBear
          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      }`}>
        <div className="flex items-center gap-2 sm:gap-2.5">
          {isBull ? (
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
          ) : isBear ? (
            <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
          ) : (
            <BrainCircuit className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
          )}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">
              {prediction.trend === 'STRONG_BULLISH' ? '🚀 TĂNG GIÁ MẠNH' :
               prediction.trend === 'BULLISH' ? '📈 TĂNG TRƯỞNG' :
               prediction.trend === 'STRONG_BEARISH' ? '💥 GIẢM GIÁ MẠNH' :
               prediction.trend === 'BEARISH' ? '📉 ĐIỀU CHỈNH GIẢM' : '⚖️ ĐI NGANG (SIDEWAYS)'}
            </div>
            <div className="text-[10px] sm:text-[11px] opacity-80">
              Biến động: <span className="font-mono font-bold">{formatPercent(prediction.expectedPriceChangePercent)}</span> ({prediction.forecastHorizonBars} nến tới)
            </div>
          </div>
        </div>

        <div className="text-right font-mono shrink-0 pl-1">
          <div className="text-[9px] uppercase opacity-75">Biến Động</div>
          <div className="text-xs font-bold text-gray-200">±{prediction.volatilityForecast}%</div>
        </div>
      </div>

      {/* 3 Actionable Scenarios */}
      <div className="space-y-1.5 sm:space-y-2">
        <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          3 Kịch Bản Xác Suất Mô Phỏng:
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {prediction.scenarios.map((sc, idx) => (
            <div
              key={idx}
              className="p-2 sm:p-2.5 rounded-lg bg-[#141b27] border border-[#222e42] flex flex-col justify-between hover:border-blue-500/40 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] sm:text-[10px] font-bold truncate max-w-[50px] sm:max-w-[70px]" style={{ color: sc.color }}>
                    {idx === 0 ? 'Tăng Giá' : idx === 1 ? 'Cơ Sở' : 'Điều Chỉnh'}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1 rounded bg-[#1c2738] text-gray-200">
                    {sc.probability}%
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-white mb-0.5">
                  ${formatPrice(sc.targetPrice)}
                </div>
              </div>
              <div className="text-[9px] sm:text-[10px] text-gray-400 line-clamp-2 mt-1">
                {sc.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Market Drivers & AI Reasoning */}
      <div className="p-2.5 sm:p-3 rounded-lg bg-[#0d131d] border border-[#1b2536] space-y-1.5">
        <div className="text-[10px] font-semibold uppercase text-gray-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-blue-400" />
          Cơ Sở Dự Báo Thuật Toán AI:
        </div>
        <ul className="space-y-1">
          {prediction.aiReasoning.map((r, i) => (
            <li key={i} className="text-[10px] sm:text-[11px] text-gray-300 flex items-start gap-1.5">
              <span className="text-blue-400 font-bold shrink-0">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
