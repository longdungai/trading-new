import React, { useMemo } from 'react';
import { AIPrediction, MacroIntelligenceSnapshot, MarketSymbol } from '../../types';
import { MacroModalTab } from '../Macro/MacroIntelligenceModal';
import { computeVnGoldFxArbitrage } from '../../services/macro/vnGoldFxArbitrage';
import { formatPercent, formatPrice } from '../../utils/formatters';
import { Activity, AlertTriangle, Coins, Cpu, Globe2, Landmark, Newspaper, TrendingDown, TrendingUp } from 'lucide-react';

interface MarketTickerStripProps {
  symbols: MarketSymbol[];
  currentSymbol: MarketSymbol;
  favorites?: string[];
  aiPrediction?: AIPrediction | null;
  macroSnapshot?: MacroIntelligenceSnapshot | null;
  onOpenMacroModal?: (initialTab?: MacroModalTab) => void;
  onSelectSymbol: (symbol: MarketSymbol) => void;
}

const BENCHMARK_KEYS = [
  'XAUUSD',
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'OIL_WTI',
  'VNINDEX',
  'VN30F1M',
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

  const vnGoldArb = useMemo(
    () =>
      computeVnGoldFxArbitrage({
        symbols,
        macroSnapshot: macroSnapshot ?? null,
      }),
    [symbols, macroSnapshot]
  );

  const isAiBull =
    aiPrediction?.trend === 'STRONG_BULLISH' || aiPrediction?.trend === 'BULLISH';
  const isAiBear =
    aiPrediction?.trend === 'STRONG_BEARISH' || aiPrediction?.trend === 'BEARISH';

  return (
    <div className="h-6 sm:h-8 bg-[#070b12] border-b border-slate-800/70 px-1.5 sm:px-3 flex items-center justify-between gap-1.5 sm:gap-2 select-none shrink-0 overflow-x-auto no-scrollbar z-20">
      {/* Left: Macro Shock Radar Trigger + Fed Pivot Watch Pill + VN Gold Parity Pill */}
      {onOpenMacroModal && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onOpenMacroModal('indicators')}
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

          {(macroSnapshot?.fedPivotV2 || macroSnapshot?.fedPivot) && (
            <button
              type="button"
              onClick={() => onOpenMacroModal('fed_pivot')}
              className={`flex px-2 py-0.5 rounded-md border text-[10px] font-mono items-center gap-1 shrink-0 transition ${
                macroSnapshot.fedPivotV2
                  ? macroSnapshot.fedPivotV2.pivotScore >= 4.25
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/30'
                    : macroSnapshot.fedPivotV2.pivotScore >= 2.75
                    ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/25'
                    : 'bg-[#121928] border-slate-700/80 text-slate-200 hover:border-cyan-400/50'
                  : macroSnapshot.fedPivot?.stance === 'DOVISH_PIVOT'
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/30 animate-pulse'
                  : 'bg-[#121928] border-slate-700/80 text-slate-200 hover:border-cyan-400/50'
              }`}
              title="Mở cửa sổ chuyên sâu Fed Pivot Intelligence (7 Tín hiệu FRED/BLS/BEA + Lịch sử + 3 Kịch bản)"
            >
              <Landmark className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="font-bold text-cyan-300">Fed Pivot</span>
              {macroSnapshot.fedPivotV2 ? (
                <span className="text-[9px] font-bold text-emerald-300 whitespace-nowrap">
                  {macroSnapshot.fedPivotV2.pivotScore.toFixed(1)}/7
                  <span className="hidden 2xl:inline text-slate-400">
                    {' '}• {macroSnapshot.fedPivotV2.statusLabel}
                  </span>
                </span>
              ) : (
                macroSnapshot.fedPivot && (
                  <span className="text-[9px] font-bold text-slate-300">
                    {macroSnapshot.fedPivot.effectiveRate.toFixed(2)}%
                  </span>
                )
              )}
            </button>
          )}

          {vnGoldArb && (
            <button
              type="button"
              onClick={() => onOpenMacroModal('vn_gold_fx')}
              className="hidden sm:flex px-2 py-0.5 rounded-md border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/20 text-[10px] font-mono items-center gap-1 shrink-0 text-amber-200 transition"
              title="Xem Giá Vàng Thế Giới quy đổi VNĐ/lượng, Máy tính độ vênh SJC/Nhẫn 9999 & Áp lực Tỷ giá USD/VND"
            >
              <Coins className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="font-bold">Vàng quy đổi:</span>
              <span className="text-white font-extrabold">
                {vnGoldArb.worldCifParityMillionPerTael.toFixed(2)}tr
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenMacroModal('vn_market')}
            className="flex px-2 py-0.5 rounded-md border border-rose-500/40 bg-rose-500/12 hover:bg-rose-500/25 text-[10px] font-mono items-center gap-1 shrink-0 text-rose-200 transition whitespace-nowrap"
            title="Mở Chuyên Trang TTCK Việt Nam: Phái sinh VN30F1M Basis, Khối Ngoại Thời Gian Thực & Sóng 10 Ngành"
          >
            <span className="shrink-0">🇻🇳</span>
            <span className="font-sans font-bold">TTCK VN</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenMacroModal('news_breadth')}
            className="hidden xl:flex px-2 py-0.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-mono items-center gap-1 shrink-0 text-emerald-200 transition whitespace-nowrap"
            title="Mở Trạm Tin Nóng Tài Chính Thời Gian Thực & Độ Rộng Nội Tại VN30"
          >
            <Newspaper className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="font-sans font-bold">Tin nóng & Độ rộng</span>
          </button>
        </div>
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
      <div className="flex-1 min-w-0 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap">
        {quickSymbols.map(sym => {
          const isActive = sym.symbol === currentSymbol.symbol;
          const isUp = sym.change24h >= 0;
          const isVND = sym.quoteAsset === 'VND';
          const isVnIdxOrDeriv =
            sym.symbol === 'VNINDEX' || sym.symbol === 'VN30' || /^VN30F\d/i.test(sym.symbol);
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
                {isVND
                  ? `${formatPrice(sym.price)}${isVnIdxOrDeriv ? 'đ' : 'k'}`
                  : `$${formatPrice(sym.price)}`}
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
