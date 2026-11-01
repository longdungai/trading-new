import React, { useState } from 'react';
import { AIPrediction, AIPredictionScenario, KronosConfig, KronosModelKey } from '../../types';
import { KRONOS_MODELS } from '../../services/ai/kronosClient';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  BrainCircuit,
  CheckCircle2,
  X,
  Clock,
  Scale,
  Zap,
  Activity,
  Settings2,
  Cpu,
  Eye,
  EyeOff,
} from 'lucide-react';
import { formatPercent, formatPrice } from '../../utils/formatters';

interface AIPredictionCardProps {
  prediction: AIPrediction | null;
  quoteAsset?: string;
  kronosConfig?: KronosConfig;
  onUpdateKronosConfig?: (next: KronosConfig) => void;
  showGhostCandles?: boolean;
  onToggleGhostCandles?: () => void;
}

export const AIPredictionCard: React.FC<AIPredictionCardProps> = ({
  prediction,
  quoteAsset = 'USD',
  kronosConfig,
  onUpdateKronosConfig,
  showGhostCandles = true,
  onToggleGhostCandles,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<AIPredictionScenario | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

  if (!prediction) {
    return (
      <div className="p-3 sm:p-4 rounded-xl bg-[#121824] border border-[#1e293b] text-gray-400 text-xs">
        Đang khởi chạy mạng thần kinh Kronos Foundation Model dự báo đường giá...
      </div>
    );
  }

  const isVND = quoteAsset === 'VND';
  const prefix = isVND ? '' : '$';
  const priceSuffix = isVND ? 'k' : '';

  const isBull = prediction.trend === 'STRONG_BULLISH' || prediction.trend === 'BULLISH';
  const isBear = prediction.trend === 'STRONG_BEARISH' || prediction.trend === 'BEARISH';
  const meta = prediction.kronosMeta;

  const handleModelChange = (modelKey: KronosModelKey) => {
    if (!kronosConfig || !onUpdateKronosConfig) return;
    onUpdateKronosConfig({ ...kronosConfig, modelKey });
  };

  const handleHorizonChange = (predLen: number) => {
    if (!kronosConfig || !onUpdateKronosConfig) return;
    onUpdateKronosConfig({ ...kronosConfig, predLen });
  };

  const handleTempChange = (temperature: number) => {
    if (!kronosConfig || !onUpdateKronosConfig) return;
    onUpdateKronosConfig({ ...kronosConfig, temperature });
  };

  return (
    <>
      <div className="p-3 sm:p-4 rounded-xl bg-[#101622] border border-[#1f2a3e] flex flex-col gap-3 sm:gap-3.5 shadow-xl select-none">
        {/* Header with Kronos Badge & Confidence Gauge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Dự Báo AI Kronos</span>
                <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[9px] font-mono">
                  {meta?.modelName || 'Kronos-small'} ({meta?.params || '24.7M'})
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-gray-400 flex items-center gap-1.5">
                <span>BSQuantizer {meta?.s1Bits || 10}+{meta?.s2Bits || 10}bit</span>
                <span>•</span>
                <span className="text-cyan-400 font-mono">H={meta?.tokenEntropy ?? 0.88}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onUpdateKronosConfig && (
              <button
                onClick={() => setIsConfigOpen(prev => !prev)}
                className={`p-1.5 rounded-lg border transition ${
                  isConfigOpen
                    ? 'bg-cyan-600/30 text-cyan-300 border-cyan-400'
                    : 'bg-[#182234] text-gray-400 border-[#2b3a54] hover:text-white'
                }`}
                title="Tùy chỉnh tham số mô hình Kronos"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Confidence Badge */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#182234] border border-[#2b3a54]">
              <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] font-mono font-bold text-purple-300">
                {prediction.confidenceScore}%
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Bar: Ghost Candles Toggle & Model Selector */}
        <div className="flex items-center justify-between gap-2 bg-[#0d121c] px-2.5 py-1.5 rounded-lg border border-[#1b2536]">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-300 font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                meta?.engineMode === 'KRONOS_CLOUD_PYTORCH' ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400'
              }`}
            />
            <span>
              {meta?.engineMode === 'KRONOS_CLOUD_PYTORCH'
                ? 'PyTorch GPU Server'
                : 'Kronos Transformer Engine'}
            </span>
            <span className="text-gray-500">({meta?.latencyMs || 2}ms)</span>
          </div>

          {onToggleGhostCandles && (
            <button
              onClick={onToggleGhostCandles}
              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border transition ${
                showGhostCandles
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                  : 'bg-[#161f2e] text-gray-400 border-gray-700 hover:text-white'
              }`}
            >
              {showGhostCandles ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>{showGhostCandles ? 'Đang Vẽ Nến Tương Lai' : 'Hiện Nến Tương Lai'}</span>
            </button>
          )}
        </div>

        {/* Expandable Kronos Model Hyperparameters Panel */}
        {isConfigOpen && kronosConfig && onUpdateKronosConfig && (
          <div className="p-2.5 rounded-xl bg-[#0c111a] border border-cyan-500/30 space-y-2.5 text-[11px] animate-in fade-in">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-cyan-300">
              <span>Cấu Hình Kronos Foundation Model</span>
              <span className="font-mono text-gray-400">Context: {meta?.contextLength || 512} bars</span>
            </div>

            {/* Model Variant Selector */}
            <div className="grid grid-cols-3 gap-1.5">
              {(['kronos-mini', 'kronos-small', 'kronos-base'] as KronosModelKey[]).map(key => {
                const m = KRONOS_MODELS[key];
                const active = kronosConfig.modelKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleModelChange(key)}
                    className={`p-1.5 rounded-lg border text-left transition ${
                      active
                        ? 'bg-cyan-600/25 border-cyan-400 text-white'
                        : 'bg-[#141c2b] border-[#223046] text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="font-mono font-bold text-[10px] text-cyan-300">{m.name}</div>
                    <div className="text-[9px] text-gray-400">{m.params} • {m.contextLength}ctx</div>
                  </button>
                );
              })}
            </div>

            {/* Horizon & Temperature Controls */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[9px] text-gray-400 uppercase font-semibold mb-1">
                  Số Nến Dự Báo (pred_len)
                </div>
                <div className="flex gap-1 font-mono">
                  {[12, 24, 36, 48].map(len => (
                    <button
                      key={len}
                      onClick={() => handleHorizonChange(len)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold border ${
                        kronosConfig.predLen === len
                          ? 'bg-blue-600 text-white border-blue-400'
                          : 'bg-[#141c2b] text-gray-400 border-[#223046]'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[9px] text-gray-400 uppercase font-semibold mb-1">
                  Nhiệt Độ Lấy Mẫu (T={kronosConfig.temperature})
                </div>
                <div className="flex gap-1 font-mono">
                  {[
                    { label: '0.6', val: 0.6 },
                    { label: '0.85', val: 0.85 },
                    { label: '1.1', val: 1.1 },
                  ].map(t => (
                    <button
                      key={t.label}
                      onClick={() => handleTempChange(t.val)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold border ${
                        kronosConfig.temperature === t.val
                          ? 'bg-purple-600 text-white border-purple-400'
                          : 'bg-[#141c2b] text-gray-400 border-[#223046]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
                Kỳ vọng P50: <span className="font-mono font-bold">{formatPercent(prediction.expectedPriceChangePercent)}</span> ({prediction.forecastHorizonBars} nến OHLCV tới)
              </div>
            </div>
          </div>

          <div className="text-right font-mono shrink-0 pl-1">
            <div className="text-[9px] uppercase opacity-75">Biên P95</div>
            <div className="text-xs font-bold text-gray-200">±{prediction.volatilityForecast}%</div>
          </div>
        </div>

        {/* 3 Actionable Scenarios (Clickable with Hint) */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <span>3 Phân Vị Xác Suất Kronos (P85 / P50 / P15):</span>
            <span className="text-[9px] text-cyan-400 font-normal lowercase">(Chạm xem chi tiết)</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {prediction.scenarios.map((sc, idx) => {
              const isSelected = selectedScenario?.type === sc.type;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedScenario(sc)}
                  className={`p-2 sm:p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition transform active:scale-95 hover:scale-[1.02] shadow-md ${
                    isSelected
                      ? 'bg-[#182335] border-blue-500 ring-2 ring-blue-500/30'
                      : 'bg-[#141b27] border-[#222e42] hover:border-blue-500/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] sm:text-[10px] font-bold truncate max-w-[55px] sm:max-w-[75px]" style={{ color: sc.color }}>
                        {idx === 0 ? 'P85 Tăng' : idx === 1 ? 'P50 Cơ Sở' : 'P15 Giảm'}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1 rounded bg-[#1c2738] text-gray-200">
                        {sc.probability}%
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-mono font-bold text-white mb-0.5 truncate">
                      {prefix}{formatPrice(sc.targetPrice)}{priceSuffix}
                    </div>
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-gray-400 line-clamp-2 mt-1">
                    {sc.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Key Market Drivers & AI Reasoning */}
        <div className="p-2.5 sm:p-3 rounded-lg bg-[#0d131d] border border-[#1b2536] space-y-1.5">
          <div className="text-[10px] font-semibold uppercase text-gray-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
            Luận Giải Kronos K-Line Foundation Model:
          </div>
          <ul className="space-y-1">
            {prediction.aiReasoning.map((r, i) => (
              <li key={i} className="text-[10px] sm:text-[11px] text-gray-300 flex items-start gap-1.5">
                <span className="text-cyan-400 font-bold shrink-0">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ================= MODAL: CHI TIẾT KỊCH BẢN MÔ PHỎNG ================= */}
      {selectedScenario && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in select-none">
          <div className="bg-[#0e141f] border border-[#232f44] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-[#1c2738] flex items-center justify-between bg-[#121927]">
              <div className="flex items-center gap-2">
                <div
                  className="p-1.5 rounded-lg text-white"
                  style={{ backgroundColor: `${selectedScenario.color}25`, color: selectedScenario.color }}
                >
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase font-mono flex items-center gap-2">
                    <span>{selectedScenario.name}</span>
                    <span
                      className="px-2 py-0.2 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: `${selectedScenario.color}25`, color: selectedScenario.color }}
                    >
                      Xác Suất: {selectedScenario.probability}%
                    </span>
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-gray-400">Chi tiết lộ trình Kronos, điều kiện kích hoạt & kế hoạch hành động</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedScenario(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              {/* Summary Metrics Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                <div className="p-2 rounded-lg bg-[#141b27] border border-[#222e42]">
                  <div className="text-[9px] text-gray-400 uppercase font-semibold">Giá Mục Tiêu</div>
                  <div className="text-sm font-bold text-white mt-0.5 truncate" style={{ color: selectedScenario.color }}>
                    {prefix}{formatPrice(selectedScenario.targetPrice)}{priceSuffix}
                  </div>
                  <div className="text-[9px] font-semibold" style={{ color: selectedScenario.color }}>
                    {selectedScenario.priceChangePercent >= 0 ? '+' : ''}{selectedScenario.priceChangePercent}%
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[#141b27] border border-[#222e42]">
                  <div className="text-[9px] text-gray-400 uppercase font-semibold">Cắt Lỗ / Hủy Bỏ</div>
                  <div className="text-sm font-bold text-rose-400 mt-0.5 truncate">
                    {prefix}{formatPrice(selectedScenario.invalidationPrice)}{priceSuffix}
                  </div>
                  <div className="text-[9px] text-gray-400">Thủng giá = Hủy</div>
                </div>

                <div className="p-2 rounded-lg bg-[#141b27] border border-[#222e42]">
                  <div className="text-[9px] text-gray-400 uppercase font-semibold">Khung Dự Báo</div>
                  <div className="text-xs font-bold text-cyan-300 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>{prediction.forecastHorizonBars} nến</span>
                  </div>
                  <div className="text-[9px] text-gray-400">{selectedScenario.timeHorizon}</div>
                </div>

                <div className="p-2 rounded-lg bg-[#141b27] border border-[#222e42]">
                  <div className="text-[9px] text-gray-400 uppercase font-semibold">Tỉ Lệ R:R</div>
                  <div className="text-sm font-bold text-amber-400 mt-0.5 flex items-center gap-1">
                    <Scale className="w-3 h-3 text-amber-400" />
                    <span>{selectedScenario.riskReward}</span>
                  </div>
                  <div className="text-[9px] text-gray-400">Risk : Reward</div>
                </div>
              </div>

              {/* Trajectory Simulation SVG Preview */}
              <div className="p-2.5 rounded-xl bg-[#0c1017] border border-[#1b2536] space-y-1">
                <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold uppercase">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-blue-400" />
                    Quỹ Đạo Nến Tương Lai Kronos (Autoregressive Path):
                  </span>
                  <span className="font-mono" style={{ color: selectedScenario.color }}>
                    Xác suất: {selectedScenario.probability}%
                  </span>
                </div>

                <div className="w-full h-20 relative">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" strokeWidth="1" />
                    {selectedScenario.path.length > 1 && (() => {
                      const prices = selectedScenario.path.map(p => p.price);
                      const min = Math.min(...prices) * 0.98;
                      const max = Math.max(...prices) * 1.02;
                      const range = max - min || 1;

                      const points = selectedScenario.path.map((p, idx) => {
                        const x = (idx / (selectedScenario.path.length - 1)) * 100;
                        const y = 100 - ((p.price - min) / range) * 100;
                        return `${x},${Math.max(5, Math.min(95, y))}`;
                      }).join(' ');

                      return (
                        <polyline
                          fill="none"
                          stroke={selectedScenario.color}
                          strokeWidth="2.5"
                          points={points}
                        />
                      );
                    })()}
                  </svg>
                </div>
              </div>

              {/* Triggers Checklist */}
              <div className="p-3 rounded-xl bg-[#141b27] border border-[#222e42] space-y-2">
                <div className="text-[11px] font-bold uppercase text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Điều Kiện Kích Hoạt Kịch Bản:
                </div>
                <div className="space-y-1.5">
                  {selectedScenario.triggers.map((trig, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px] text-gray-300 bg-[#0e141f] p-2 rounded-lg border border-[#1c2738]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{trig}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Plan / Playbook */}
              <div className="p-3 rounded-xl bg-[#121927] border border-blue-500/30 space-y-1.5">
                <div className="text-[11px] font-bold uppercase text-blue-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Chiến Lược Hành Động Khuyến Nghị:
                </div>
                <p className="text-[11px] text-gray-200 leading-relaxed font-medium">
                  {selectedScenario.actionPlan}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#121927] border-t border-[#1c2738] flex items-center justify-end">
              <button
                onClick={() => setSelectedScenario(null)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition"
              >
                Đóng Chi Tiết
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
