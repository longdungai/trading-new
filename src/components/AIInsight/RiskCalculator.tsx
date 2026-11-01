import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Shield,
  DollarSign,
  BrainCircuit,
  AlertTriangle,
  Sparkles,
  Globe2,
} from 'lucide-react';
import { AIPrediction, MacroIntelligenceSnapshot, StrategyAnalysisHub } from '../../types';
import { calculatePositionSize } from '../../services/ai/signalGenerator';
import { formatPrice } from '../../utils/formatters';

interface RiskCalculatorProps {
  currentPrice: number;
  stopLossPrice: number;
  quoteAsset?: string;
  aiPrediction?: AIPrediction | null;
  strategyHub?: StrategyAnalysisHub | null;
  macroSnapshot?: MacroIntelligenceSnapshot | null;
}

export const RiskCalculator: React.FC<RiskCalculatorProps> = ({
  currentPrice,
  stopLossPrice,
  quoteAsset = 'USD',
  aiPrediction,
  strategyHub,
  macroSnapshot,
}) => {
  const [capital, setCapital] = useState<number>(5000);
  const [riskPercent, setRiskPercent] = useState<number>(1.5);
  const [leverage, setLeverage] = useState<number>(5);

  const isVND = quoteAsset === 'VND';
  const prefix = isVND ? '' : '$';
  const suffix = isVND ? 'k VNĐ' : '';

  const entry = currentPrice || 100;
  const sl = stopLossPrice || entry * 0.95;
  const isShortSetup = sl > entry;

  const result = calculatePositionSize(capital, riskPercent, entry, sl, leverage);

  // Kronos Quantile VaR 95% (P05 / P95) & Entropy-Adjusted Half-Kelly Sizing
  const kronosRiskMetrics = useMemo(() => {
    const entropy = aiPrediction?.kronosMeta?.tokenEntropy ?? 0.85;
    let var95Price = isShortSetup ? entry * 1.032 : entry * 0.968;

    if (aiPrediction) {
      if (!isShortSetup && aiPrediction.lowerConfidenceBound.length > 0) {
        const minP05 = Math.min(...aiPrediction.lowerConfidenceBound.map(p => p.price));
        var95Price = Math.min(entry * 0.992, minP05);
      } else if (isShortSetup && aiPrediction.upperConfidenceBound.length > 0) {
        const maxP95 = Math.max(...aiPrediction.upperConfidenceBound.map(p => p.price));
        var95Price = Math.max(entry * 1.008, maxP95);
      }
    }

    const var95Pct = parseFloat(
      Math.max(0.8, (Math.abs(entry - var95Price) / Math.max(1e-8, entry)) * 100).toFixed(2)
    );

    const winProbRaw =
      strategyHub?.bestStrategy?.winProbability ?? aiPrediction?.confidenceScore ?? 62;
    const p = Math.min(0.78, Math.max(0.42, winProbRaw / 100));
    const b = Math.max(1.2, strategyHub?.bestStrategy?.riskRewardRatio ?? 2.2);

    // Kelly fraction f* = p - (1 - p) / b + Cross-Market Macro Volatility Damper (VIX & Regime)
    const fullKelly = Math.max(0.03, p - (1 - p) / b);
    const entropyDamper = Math.max(0.55, 1.12 - entropy * 0.35);
    const macroDamper = macroSnapshot?.kellyDamper ?? 1.0;
    const combinedDamper = entropyDamper * macroDamper;

    const halfKellyMarginPct = parseFloat(
      Math.min(35, Math.max(4, fullKelly * 0.5 * combinedDamper * 100)).toFixed(1)
    );
    const optimalRiskPct = parseFloat(
      Math.min(2.5, Math.max(0.4, fullKelly * 5.2 * combinedDamper)).toFixed(1)
    );

    // Safe leverage ensures 95% tail excursion + macro VIX shock stays well away from liquidation
    const maxSafeLeverage = isVND
      ? 1
      : Math.max(
          1,
          Math.min(
            20,
            Math.floor((55 * macroDamper) / Math.max(2.0, var95Pct * (1 + entropy * 0.45)))
          )
        );

    const vixIndicator = macroSnapshot?.indicators.find(i => i.id === 'VIX');

    return {
      entropy,
      macroDamper,
      vixIndicator,
      var95Price,
      var95Pct,
      halfKellyMarginPct,
      optimalRiskPct,
      maxSafeLeverage,
      winProbPct: Math.round(p * 100),
      rrRatio: b,
    };
  }, [aiPrediction, strategyHub, macroSnapshot, entry, isShortSetup, isVND]);

  const positionVar95USD = parseFloat(
    ((result.positionSizeUSD ?? 0) * (kronosRiskMetrics.var95Pct / 100)).toFixed(2)
  );
  const isOverLeveraged = leverage > kronosRiskMetrics.maxSafeLeverage;

  const handleApplyOptimalKelly = () => {
    setRiskPercent(kronosRiskMetrics.optimalRiskPct);
    setLeverage(kronosRiskMetrics.maxSafeLeverage);
  };

  return (
    <div className="p-4 rounded-xl bg-[#101622] border border-[#1f2a3e] flex flex-col gap-3 shadow-xl select-none">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              Quản Lý Vốn & VaR Kronos
            </div>
            <div className="text-[10px] text-gray-400">
              Half-Kelly Criterion & Phân Vị Rủi Ro P05/P95
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleApplyOptimalKelly}
          className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold flex items-center gap-1 transition shrink-0"
          title="Tự động điền % Rủi ro & Đòn bẩy tối ưu theo tiêu chuẩn Half-Kelly AI Kronos"
        >
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Tối Ưu Kelly AI</span>
        </button>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
            Tổng Vốn ({prefix || 'Đơn vị'})
          </label>
          <input
            type="number"
            value={capital}
            onChange={e => setCapital(Math.max(1, Number(e.target.value)))}
            className="w-full bg-[#141b27] border border-[#232f44] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
            Rủi Ro (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={riskPercent}
            onChange={e => setRiskPercent(Math.max(0.1, Number(e.target.value)))}
            className="w-full bg-[#141b27] border border-[#232f44] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
            Đòn Bẩy ({leverage}x)
          </label>
          <input
            type="range"
            min="1"
            max={isVND ? 3 : 50}
            value={leverage}
            onChange={e => setLeverage(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-3 accent-indigo-500"
          />
        </div>
      </div>

      {/* Kronos AI Kelly & VaR 95% Advisory Box */}
      <div className="p-2.5 rounded-xl bg-[#0c121d] border border-cyan-500/25 space-y-2 text-[11px] font-mono">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-sans font-bold uppercase text-cyan-300 flex items-center gap-1">
            <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
            <span>Định Lượng Rủi Ro Đuôi Kronos (VaR 95%)</span>
          </span>
          <span className="text-gray-400">H={kronosRiskMetrics.entropy}</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div className="p-1.5 rounded-lg bg-[#131b2a] border border-[#202d44]">
            <div className="text-[9px] text-gray-400 font-sans">Rủi ro Kelly</div>
            <div className="text-xs font-bold text-emerald-400">
              {kronosRiskMetrics.optimalRiskPct}% / lệnh
            </div>
            <div className="text-[8px] text-gray-500">Vốn ~{kronosRiskMetrics.halfKellyMarginPct}%</div>
          </div>

          <div className="p-1.5 rounded-lg bg-[#131b2a] border border-[#202d44]">
            <div className="text-[9px] text-gray-400 font-sans">Đòn bẩy an toàn</div>
            <div className="text-xs font-bold text-cyan-300">
              ≤ {kronosRiskMetrics.maxSafeLeverage}x
            </div>
            <div className="text-[8px] text-gray-500">Chống quét râu</div>
          </div>

          <div className="p-1.5 rounded-lg bg-[#131b2a] border border-[#202d44]">
            <div className="text-[9px] text-gray-400 font-sans">Biên {isShortSetup ? 'P95' : 'P05'}</div>
            <div className="text-xs font-bold text-amber-300">-{kronosRiskMetrics.var95Pct}%</div>
            <div className="text-[8px] text-gray-500 truncate">
              {prefix}
              {formatPrice(kronosRiskMetrics.var95Price)}
            </div>
          </div>
        </div>

        {/* Real-Time Macro Kelly Damper Strip */}
        {macroSnapshot && (
          <div
            className={`px-2 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-[10px] font-sans ${
              kronosRiskMetrics.macroDamper < 0.8
                ? 'bg-rose-950/35 border-rose-500/35 text-rose-200'
                : kronosRiskMetrics.macroDamper < 1.0
                ? 'bg-amber-950/35 border-amber-500/35 text-amber-200'
                : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <Globe2 className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              <span className="truncate">
                Điều tiết Vĩ mô: <strong>{macroSnapshot.regimeLabel}</strong>
                {kronosRiskMetrics.vixIndicator
                  ? ` (VIX ${kronosRiskMetrics.vixIndicator.displayValue})`
                  : ''}
              </span>
            </div>
            <span className="font-mono font-bold shrink-0">
              ×{kronosRiskMetrics.macroDamper.toFixed(2)} Kelly
            </span>
          </div>
        )}

        {isOverLeveraged && (
          <div className="px-2 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[10px] font-sans flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Đòn bẩy <strong>{leverage}x</strong> vượt ngưỡng an toàn Kronos (
              <strong>{kronosRiskMetrics.maxSafeLeverage}x</strong>) khi Entropy H=
              {kronosRiskMetrics.entropy}. Dễ bị quét thanh lý nếu giá chạm đuôi phân vị{' '}
              {isShortSetup ? 'P95' : 'P05'}!
            </span>
          </div>
        )}
      </div>

      {/* Computed Position Outputs */}
      <div className="grid grid-cols-2 gap-2 bg-[#0d131d] p-2.5 rounded-lg border border-[#1b2536] text-xs font-mono">
        <div>
          <div className="text-[10px] text-rose-400 uppercase font-semibold flex items-center gap-1">
            <Shield className="w-3 h-3 text-rose-400" />
            Lỗ Cắt SL ({riskPercent}%)
          </div>
          <div className="text-sm font-bold text-rose-400 mt-0.5">
            -{prefix}
            {formatPrice(result.maxLossUSD ?? 0)}
            {suffix}
          </div>
          <div className="text-[9px] text-gray-400 mt-0.5">
            VaR 95%: -{prefix}
            {formatPrice(positionVar95USD)}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-blue-400 uppercase font-semibold flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-blue-400" />
            Ký Quỹ Cần Thiết (Margin)
          </div>
          <div className="text-sm font-bold text-blue-400 mt-0.5">
            {prefix}
            {formatPrice(result.marginRequired ?? 0)}
            {suffix}
          </div>
          <div className="text-[9px] text-gray-400 mt-0.5">
            Tỷ trọng:{' '}
            {capital > 0 ? Math.min(999, Math.round(((result.marginRequired ?? 0) / capital) * 100)) : 0}% vốn
          </div>
        </div>

        <div className="col-span-2 pt-1.5 border-t border-gray-800 flex justify-between items-center">
          <span className="text-gray-400 text-[11px] font-sans">Tổng Quy Mô Vị Thế:</span>
          <span className="font-bold text-white">
            {prefix}
            {formatPrice(result.positionSizeUSD ?? 0)}
            {suffix} ({result.positionSizeCoins ?? 0} ĐV)
          </span>
        </div>
      </div>
    </div>
  );
};
