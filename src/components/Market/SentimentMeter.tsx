import React from 'react';
import { MarketSentiment } from '../../types';
import { Gauge, TrendingUp, DollarSign, Activity } from 'lucide-react';

interface SentimentMeterProps {
  sentiment: MarketSentiment;
}

export const SentimentMeter: React.FC<SentimentMeterProps> = ({ sentiment }) => {
  const getIndexColor = (val: number) => {
    if (val >= 75) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15';
    if (val >= 55) return 'text-teal-400 border-teal-500/40 bg-teal-500/15';
    if (val >= 45) return 'text-amber-400 border-amber-500/40 bg-amber-500/15';
    if (val >= 25) return 'text-orange-400 border-orange-500/40 bg-orange-500/15';
    return 'text-rose-400 border-rose-500/40 bg-rose-500/15';
  };

  const getMeterGradient = (val: number) => {
    if (val >= 75) return 'from-emerald-500 to-teal-400';
    if (val >= 55) return 'from-teal-500 to-blue-400';
    if (val >= 45) return 'from-amber-500 to-yellow-400';
    return 'from-rose-500 to-orange-400';
  };

  return (
    <div className="p-3 bg-[#0c1017] border-t border-[#1b2230] select-none text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 font-bold text-white uppercase tracking-wider">
          <Gauge className="w-3.5 h-3.5 text-amber-400" />
          <span>Tâm Lý Thị Trường</span>
        </div>
      </div>

      {/* Fear & Greed Index Gauge */}
      <div className="p-2.5 rounded-xl bg-[#121824] border border-[#1f293d] mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-gray-400">Chỉ số Sợ hãi & Tham lam:</span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getIndexColor(sentiment.fearAndGreedIndex)}`}>
            {sentiment.fearAndGreedIndex} - {sentiment.sentimentClassification}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden flex">
          <div
            className={`h-full bg-gradient-to-r ${getMeterGradient(sentiment.fearAndGreedIndex)} transition-all duration-500`}
            style={{ width: `${sentiment.fearAndGreedIndex}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-gray-500 mt-1 font-mono">
          <span>0 (Cực kỳ sợ hãi)</span>
          <span>50 (Trung lập)</span>
          <span>100 (Cực kỳ tham lam)</span>
        </div>
      </div>

      {/* Ratios */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div className="p-2 rounded-lg bg-[#121824] border border-[#1f293d]">
          <div className="text-[10px] text-gray-400 uppercase flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-blue-400" />
            Tỉ Lệ Long / Short
          </div>
          <div className="text-xs font-bold text-white mt-0.5">{sentiment.longShortRatio} : 1</div>
        </div>

        <div className="p-2 rounded-lg bg-[#121824] border border-[#1f293d]">
          <div className="text-[10px] text-gray-400 uppercase flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            Funding Rate 8h
          </div>
          <div className="text-xs font-bold text-emerald-400 mt-0.5">+{sentiment.fundingRate}%</div>
        </div>
      </div>
    </div>
  );
};
