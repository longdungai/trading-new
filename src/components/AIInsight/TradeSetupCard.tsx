import React, { useState } from 'react';
import { StrategyAnalysisHub, StrategyHubItem, TradeSetup } from '../../types';
import {
  ShieldAlert,
  Crosshair,
  ArrowUpRight,
  Scale,
  Percent,
  Sparkles,
  Zap,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

interface TradeSetupCardProps {
  strategyHub?: StrategyAnalysisHub | null;
  setup?: TradeSetup | null;
  quoteAsset?: string;
}

export const TradeSetupCard: React.FC<TradeSetupCardProps> = ({
  strategyHub,
  setup,
  quoteAsset = 'USD',
}) => {
  const isVND = quoteAsset === 'VND';
  const prefix = isVND ? '' : '$';
  const suffix = isVND ? 'k VNĐ' : '';

  // Active selected strategy in the Hub
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('best');

  if (!strategyHub && !setup) return null;

  // Derive current display item
  const currentItem: StrategyHubItem = React.useMemo(() => {
    if (!strategyHub || !strategyHub.strategies || strategyHub.strategies.length === 0) {
      if (setup) {
        return {
          id: 'setup',
          name: setup.strategyName,
          category: 'Chiến Lược Mặc Định',
          description: setup.strategyReason,
          action: setup.action,
          score: 80,
          entryZone: setup.entryZone,
          stopLoss: setup.stopLoss,
          takeProfit1: setup.takeProfit1,
          takeProfit2: setup.takeProfit2,
          takeProfit3: setup.takeProfit3,
          riskRewardRatio: setup.riskRewardRatio,
          winProbability: setup.winProbability,
          triggers: [setup.strategyReason],
          riskLevel: setup.riskLevel,
          isOptimal: true,
        };
      }
      return {} as StrategyHubItem;
    }

    if (selectedStrategyId === 'best') {
      return strategyHub.bestStrategy;
    }
    const found = strategyHub.strategies.find(s => s.id === selectedStrategyId);
    return found || strategyHub.bestStrategy;
  }, [strategyHub, setup, selectedStrategyId]);

  if (!currentItem.name) return null;

  const isBuy = currentItem.action === 'STRONG_BUY' || currentItem.action === 'BUY';
  const isSell = currentItem.action === 'STRONG_SELL' || currentItem.action === 'SELL';
  const currentPrice = strategyHub ? strategyHub.currentPrice : (setup?.currentPrice || 100);

  const slDiffPct = currentPrice > 0 ? ((currentItem.stopLoss - currentPrice) / currentPrice) * 100 : 0;
  const tp1DiffPct = currentPrice > 0 ? ((currentItem.takeProfit1 - currentPrice) / currentPrice) * 100 : 0;
  const tp2DiffPct = currentPrice > 0 ? ((currentItem.takeProfit2 - currentPrice) / currentPrice) * 100 : 0;
  const tp3DiffPct = currentPrice > 0 ? ((currentItem.takeProfit3 - currentPrice) / currentPrice) * 100 : 0;

  return (
    <div className="p-3 sm:p-4 rounded-xl bg-[#101622] border border-[#1f2a3e] flex flex-col gap-3 sm:gap-3.5 shadow-xl select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${
            isBuy
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : isSell
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}>
            <Crosshair className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Chiến Lược Đề Xuất</span>
              {currentItem.isOptimal && (
                <span className="px-1.5 py-0.2 rounded bg-blue-600/30 border border-blue-500/50 text-blue-300 text-[9px] font-bold flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" /> TỐI ƯU
                </span>
              )}
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-400 truncate max-w-[170px] sm:max-w-[200px]">{currentItem.category}</div>
          </div>
        </div>

        {/* Action Badge */}
        <div className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold font-mono uppercase tracking-wider border shadow-md ${
          currentItem.action === 'STRONG_BUY'
            ? 'bg-emerald-600 text-white border-emerald-400 glow-green'
            : currentItem.action === 'BUY'
            ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
            : currentItem.action === 'STRONG_SELL'
            ? 'bg-rose-600 text-white border-rose-400 glow-red'
            : currentItem.action === 'SELL'
            ? 'bg-rose-600/30 text-rose-300 border-rose-500/50'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        }`}>
          {currentItem.action.replace('_', ' ')}
        </div>
      </div>

      {/* Multi-Strategy Consensus Bar (if Hub available) */}
      {strategyHub && (
        <div className="p-2 rounded-lg bg-[#0d121c] border border-[#1b2536] space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-400 font-semibold flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-400" />
              Đồng Thuận ({strategyHub.strategies.length} thuật toán):
            </span>
            <span className={`font-bold font-mono ${
              strategyHub.overallConsensus.includes('BULLISH') ? 'text-emerald-400' :
              strategyHub.overallConsensus.includes('BEARISH') ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {strategyHub.confluenceCount.buy} MUA • {strategyHub.confluenceCount.sell} BÁN • {strategyHub.confluenceCount.neutral} CHỜ
            </span>
          </div>

          {/* Strategy Quick Selector Pills */}
          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar whitespace-nowrap">
            <button
              onClick={() => setSelectedStrategyId('best')}
              className={`px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap transition flex items-center gap-1 shrink-0 ${
                selectedStrategyId === 'best'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[#151e2c] text-gray-400 hover:text-white'
              }`}
            >
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              Tối Ưu Nhất
            </button>

            {strategyHub.strategies.map(s => {
              const sBuy = s.action.includes('BUY');
              const sSell = s.action.includes('SELL');
              const isSelected = selectedStrategyId === s.id;

              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStrategyId(s.id)}
                  className={`px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap transition flex items-center gap-1 shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-[#151e2c] text-gray-400 hover:text-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    sBuy ? 'bg-emerald-400' : sSell ? 'bg-rose-400' : 'bg-gray-500'
                  }`} />
                  <span>{s.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Strategy Title & Description */}
      <div className="bg-[#141b27] p-2.5 rounded-lg border border-[#202c40]">
        <div className="text-xs font-bold text-white font-mono flex items-center justify-between">
          <span>{currentItem.name}</span>
          <span className="text-[10px] text-blue-400 font-normal">Điểm: {currentItem.score}/100</span>
        </div>
        <div className="text-[10px] sm:text-[11px] text-gray-400 mt-1 leading-snug">
          {currentItem.description}
        </div>
      </div>

      {/* Entry, SL, TP Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Entry Zone */}
        <div className="p-2 sm:p-2.5 rounded-lg bg-[#141b27] border border-[#232f44]">
          <div className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Vùng Vào Lệnh (Entry)
          </div>
          <div className="text-[11px] sm:text-xs font-mono font-bold text-white mt-1 truncate">
            {prefix}{formatPrice(currentItem.entryZone[0])} - {prefix}{formatPrice(currentItem.entryZone[1])}{suffix}
          </div>
        </div>

        {/* Stop Loss */}
        <div className="p-2 sm:p-2.5 rounded-lg bg-[#141b27] border border-rose-500/30">
          <div className="text-[9px] sm:text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            Cắt Lỗ (Stop Loss)
          </div>
          <div className="text-[11px] sm:text-xs font-mono font-bold text-rose-400 mt-1 truncate">
            {prefix}{formatPrice(currentItem.stopLoss)}{suffix}
            <span className="text-[9px] sm:text-[10px] text-rose-300 ml-1 font-normal">
              ({slDiffPct >= 0 ? `+${slDiffPct.toFixed(1)}%` : `${slDiffPct.toFixed(1)}%`})
            </span>
          </div>
        </div>
      </div>

      {/* Take Profit Targets */}
      <div className="p-2 sm:p-2.5 rounded-lg bg-[#141b27] border border-emerald-500/30 space-y-1.5">
        <div className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-400 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
            Các Mốc Chốt Lời (Take Profit)
          </span>
          <span className="font-mono text-[9px] sm:text-[10px] text-gray-400">R:R = 1 : {currentItem.riskRewardRatio}</span>
        </div>

        <div className="grid grid-cols-3 gap-1 sm:gap-1.5 font-mono text-center">
          <div className="p-1 sm:p-1.5 rounded bg-[#0f1724] border border-emerald-500/20">
            <div className="text-[8px] sm:text-[9px] text-gray-400">TP 1 (1.5R)</div>
            <div className="text-[11px] sm:text-xs font-bold text-emerald-400">{prefix}{formatPrice(currentItem.takeProfit1)}{suffix}</div>
            <div className="text-[8px] sm:text-[9px] text-emerald-500">+{tp1DiffPct.toFixed(1)}%</div>
          </div>
          <div className="p-1 sm:p-1.5 rounded bg-[#0f1724] border border-emerald-500/30">
            <div className="text-[8px] sm:text-[9px] text-gray-400">TP 2 (2.5R)</div>
            <div className="text-[11px] sm:text-xs font-bold text-emerald-300">{prefix}{formatPrice(currentItem.takeProfit2)}{suffix}</div>
            <div className="text-[8px] sm:text-[9px] text-emerald-400">+{tp2DiffPct.toFixed(1)}%</div>
          </div>
          <div className="p-1 sm:p-1.5 rounded bg-[#0f1724] border border-emerald-500/40">
            <div className="text-[8px] sm:text-[9px] text-gray-400">TP 3 (4.0R)</div>
            <div className="text-[11px] sm:text-xs font-bold text-emerald-200">{prefix}{formatPrice(currentItem.takeProfit3)}{suffix}</div>
            <div className="text-[8px] sm:text-[9px] text-emerald-300">+{tp3DiffPct.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Metrics Row: Win Probability & Risk Level */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d131d] border border-[#1d2738] text-xs font-mono">
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Percent className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-gray-400 text-[10px] sm:text-[11px]">Xác Suất:</span>
          <span className="font-bold text-blue-400">{currentItem.winProbability}%</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Scale className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-gray-400 text-[10px] sm:text-[11px]">Rủi Ro:</span>
          <span className={`font-bold uppercase text-[10px] sm:text-[11px] ${
            currentItem.riskLevel === 'LOW' ? 'text-emerald-400' :
            currentItem.riskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {currentItem.riskLevel}
          </span>
        </div>
      </div>

      {/* Technical Trigger Checklist */}
      {currentItem.triggers && currentItem.triggers.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-gray-400">Điều Kiện Kỹ Thuật:</div>
          <div className="space-y-1">
            {currentItem.triggers.map((trig, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-[10px] sm:text-[11px] text-gray-300 bg-[#0c111a] p-1.5 rounded border border-[#1a2333]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span>{trig}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
