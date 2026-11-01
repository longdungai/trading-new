import React, { useMemo } from 'react';
import { AIPrediction, MacroIntelligenceSnapshot, MarketSymbol } from '../../types';
import { formatPercent, formatPrice } from '../../utils/formatters';
import { Activity, AlertTriangle, Cpu, Globe2, TrendingDown, TrendingUp } from 'lucide-react';

interface MarketTickerStripProps {
  symbols: MarketSymbol[];
  currentSymbol: MarketSymbol;
  favorites?: string[];
  aiPrediction?: AIPrediction | null;
  macroSnapshot?: MacroIntelligenceSnapshot | null;
  onOpenMacroModal?: () => void;
  onSelectSymbol: (symbol: MarketSymbol) => void;
}

const BENCHMARK_KEYS = [
  'XAUUSD',
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'OIL_WTI',
  'VNINDEX',
  'FPT',
  'HPG',
  'NVDA',
];

export const MarketTickerStrip: React.FC<MarketTickerStripProps> = ({
  symbols,
  currentSymbol,
  favorites = [],
  aiPrediction,
  macroSnapshot,
  onOpenMacroModal,
  onSelectSymbol,
}) => {
  const { breadth, quickSymbols } = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const s of symbols) {
      if (s.change24h > 0) up++;
      else if (s.change24h < 0) down++;
    }
    const total = Math.max(1, up + down);
    const upRatio = Math.round((up / total) * 100);

    // Prioritize user favorites first, then canonical macro benchmarks
    const orderedKeys = Array.from(new Set([...favorites, ...BENCHMARK_KEYS]));
    const picked: MarketSymbol[] = [];
    for (const key of orderedKeys) {
      const found = symbols.find(s => s.symbol === key);
      if (found && picked.length < 10) {
        picked.push(found);
      }
    }
    if (picked.length < 6) {
      for (const s of symbols) {
        if (!picked.some(p => p.symbol === s.symbol) && picked.length < 8) {
          picked.push(s);
        }
      }
    }

    return {
      breadth: { up, down, upRatio },
      quickSymbols: picked,
    };
  }, [symbols, favorites]);

  const isAiBull =
    aiPrediction?.trend === 'STRONG_BULLISH' || aiPrediction?.trend === 'BULLISH';
  const isAiBear =
    aiPrediction?.trend === 'STRONG_BEARISH' || aiPrediction?.trend === 'BEARISH';

  return (
    <div className="h-7 sm:h-8 bg-[#070b12] border-b border-slate-800/70 px-2 sm:px-3 flex items-center justify-between gap-2 select-none shrink-0 z-20">
      {/* Left: Macro Shock Radar Trigger + Market Breadth Pulse */}
      {onOpenMacroModal && (
        <button
          type="button"
          onClick={onOpenMacroModal}
          className={`px-2 py-0.5 rounded-md border text-[10px] font-mono flex items-center gap-1.5 shrink-0 transition ${
            macroSnapshot?.regime === 'RISK_OFF'
              ? 'bg-rose-500/15 border-rose-500/45 text-rose-200 hover:bg-rose-500/25'
              : macroSnapshot?.regime === 'CAUTIOUS'
              ? 'bg-amber-500/15 border-amber-500/45 text-amber-200 hover:bg-amber-500/25'
              : macroSnapshot?.regime === 'RISK_ON'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25'
              : 'bg-cyan-500/10 border-cyan-500/35 text-cyan-200 hover:bg-cyan-500/20'
          }`}
          title="Mở Radar Vĩ Mô Liên Thị Trường, Cảnh Báo Nóng & Lịch Đáo Hạn VN30F1M"
        >
          <Globe2 className="w-3 h-3 text-cyan-400 shrink-0" />
          <span className="font-sans font-bold">
            Vĩ mô
            <span className="hidden xl:inline">
              :{' '}
              {macroSnapshot?.regime === 'RISK_OFF'
                ? 'Phòng thủ'
                : macroSnapshot?.regime === 'CAUTIOUS'
                ? 'Thận trọng'
                : macroSnapshot?.regime === 'RISK_ON'
                ? 'Risk-On'
                : 'Trung lập'}
            </span>
          </span>
          {macroSnapshot && macroSnapshot.globalAlerts.length > 0 && (
            <span
              className={`px-1 rounded text-[9px] font-bold flex items-center gap-0.5 ${
                macroSnapshot.globalAlerts.some(a => a.severity === 'CRITICAL')
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-amber-500 text-black'
              }`}
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              {macroSnapshot.globalAlerts.length}
            </span>
          )}
        </button>
      )}

      <div className="hidden lg:flex items-center gap-2 pr-2.5 border-r border-slate-800/80 shrink-0 text-[10px] font-mono">
        <Activity className="w-3 h-3 text-cyan-400" />
        <span className="text-slate-400 font-sans font-medium">Độ rộng:</span>
        <span className="text-emerald-400 font-bold">{breadth.up}▲</span>
        <div className="w-12 h-1.5 rounded-full bg-rose-500/35 overflow-hidden flex">
          <div
            className="h-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${breadth.upRatio}%` }}
          />
        </div>
        <span className="text-rose-400 font-bold">{breadth.down}▼</span>
      </div>

      {/* Center: Scrollable Quick-Switch Macro Benchmarks */}
      <div className="flex-1 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap">
        {quickSymbols.map(sym => {
          const isActive = sym.symbol === currentSymbol.symbol;
          const isUp = sym.change24h >= 0;
          const isVND = sym.quoteAsset === 'VND';
          const shortLabel =
            sym.symbol === 'XAUUSD'
              ? 'VÀNG'
              : sym.symbol === 'OIL_WTI'
              ? 'DẦU WTI'
              : sym.symbol.replace('USDT', '');

          return (
            <button
              key={sym.symbol}
              onClick={() => onSelectSymbol(sym)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono flex items-center gap-1.5 transition shrink-0 border ${
                isActive
                  ? 'bg-cyan-500/15 border-cyan-400/50 text-white shadow-sm shadow-cyan-500/10'
                  : 'bg-[#0d1320]/70 border-slate-800/70 text-slate-300 hover:bg-[#141d2f] hover:border-slate-700'
              }`}
            >
              <span className={`font-bold ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>
                {shortLabel}
              </span>
              <span className="text-slate-400 hidden sm:inline">
                {isVND ? `${formatPrice(sym.price)}k` : `$${formatPrice(sym.price)}`}
              </span>
              <span
                className={`font-semibold flex items-center ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isUp ? (
                  <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                )}
                {formatPercent(sym.change24h)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Active Symbol Kronos AI Live Pulse */}
      {aiPrediction && (
        <div className="hidden md:flex items-center gap-1.5 pl-2.5 border-l border-slate-800/80 shrink-0 text-[10px] font-mono">
          <Cpu className="w-3 h-3 text-cyan-400" />
          <span className="text-slate-400">{aiPrediction.kronosMeta?.modelName || 'Kronos'}:</span>
          <span
            className={`px-1.5 py-0.2 rounded font-bold border ${
              isAiBull
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : isAiBear
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            P50 {formatPercent(aiPrediction.expectedPriceChangePercent)}
          </span>
          <span className="text-purple-300 font-bold">{aiPrediction.confidenceScore}%</span>
        </div>
      )}
    </div>
  );
};
