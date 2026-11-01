import React from 'react';
import { MarketSentiment } from '../../types';
import { Gauge, TrendingUp, Activity } from 'lucide-react';

interface SentimentMeterProps {
  sentiment: MarketSentiment;
}

const VI_CLASSIFICATION: Record<MarketSentiment['sentimentClassification'], string> = {
  'Extreme Fear': 'Cực kỳ Sợ hãi',
  Fear: 'Sợ hãi',
  Neutral: 'Trung lập',
  Greed: 'Tham lam',
  'Extreme Greed': 'Cực kỳ Tham lam',
};

export const SentimentMeter: React.FC<SentimentMeterProps> = ({ sentiment }) => {
  const getIndexColor = (val: number) => {
    if (val >= 75) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15';
    if (val >= 56) return 'text-teal-400 border-teal-500/40 bg-teal-500/15';
    if (val >= 45) return 'text-amber-400 border-amber-500/40 bg-amber-500/15';
    if (val >= 25) return 'text-orange-400 border-orange-500/40 bg-orange-500/15';
    return 'text-rose-400 border-rose-500/40 bg-rose-500/15';
  };

  const getMeterGradient = (val: number) => {
    if (val >= 75) return 'from-emerald-500 to-teal-400';
    if (val >= 56) return 'from-teal-500 to-blue-400';
    if (val >= 45) return 'from-amber-500 to-yellow-400';
    return 'from-rose-500 to-orange-400';
  };

  const up = sentiment.advancers ?? 0;
  const down = sentiment.decliners ?? 0;
  const total = sentiment.totalTracked ?? up + down;

  return (
    <div className="p-3 bg-[#090d16] rounded-xl border border-slate-800/80 select-none text-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 font-bold text-white uppercase tracking-wider">
          <Gauge className="w-3.5 h-3.5 text-amber-400" />
          <span>Tâm Lý & Độ Rộng Thực Tế</span>
        </div>
        {sentiment.sourceLabel && (
          <span className="text-[9px] text-slate-500 truncate max-w-[165px]" title={sentiment.sourceLabel}>
            {sentiment.isLiveCryptoFng ? 'Alternative.me F&G' : 'RSI(14) + Độ rộng'}
          </span>
        )}
      </div>

      {/* Sentiment Score Gauge */}
      <div className="p-2.5 rounded-xl bg-[#0e1522] border border-slate-800/90 mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-slate-400">
            {sentiment.isLiveCryptoFng ? 'Chỉ số Crypto Fear & Greed:' : 'Điểm Tâm lý Kỹ thuật:'}
          </span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border font-mono tabular-nums ${getIndexColor(sentiment.fearAndGreedIndex)}`}>
            {sentiment.fearAndGreedIndex} • {VI_CLASSIFICATION[sentiment.sentimentClassification] || sentiment.sentimentClassification}
          </span>
        </div>

        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className={`h-full bg-gradient-to-r ${getMeterGradient(sentiment.fearAndGreedIndex)} transition-all duration-500`}
            style={{ width: `${sentiment.fearAndGreedIndex}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
          <span>0 (Sợ hãi)</span>
          <span>50 (Trung lập)</span>
          <span>100 (Tham lam)</span>
        </div>
      </div>

      {/* Real Verifiable Market Metrics */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
        <div className="p-2 rounded-lg bg-[#0e1522] border border-slate-800/90">
          <div className="text-[10px] text-slate-400 font-sans uppercase flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            Độ Rộng Nhóm Mã
          </div>
          <div className="text-xs font-bold mt-0.5 flex items-center gap-1.5">
            <span className="text-emerald-400">{up} Tăng</span>
            <span className="text-slate-600">/</span>
            <span className="text-rose-400">{down} Giảm</span>
            {total > up + down && (
              <span className="text-[9.5px] text-slate-400">({total - up - down} TC)</span>
            )}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-[#0e1522] border border-slate-800/90">
          <div className="text-[10px] text-slate-400 font-sans uppercase flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            RSI(14) & Biên Độ TB
          </div>
          <div className="text-xs font-bold text-slate-100 mt-0.5">
            RSI {sentiment.rsi14 ?? 50} <span className="text-slate-500">•</span>{' '}
            <span className="text-cyan-300">±{sentiment.volatilityIndex}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
