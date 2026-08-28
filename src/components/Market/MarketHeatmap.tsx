import React, { useState } from 'react';
import { MarketSymbol } from '../../types';
import { Flame, ArrowUpRight, ArrowDownRight, X } from 'lucide-react';
import { formatPercent, formatPrice, formatVolume } from '../../utils/formatters';

interface MarketHeatmapProps {
  symbols: MarketSymbol[];
  onSelectSymbol: (symbol: MarketSymbol) => void;
  onClose: () => void;
}

export const MarketHeatmap: React.FC<MarketHeatmapProps> = ({ symbols, onSelectSymbol, onClose }) => {
  const [filterType, setFilterType] = useState<'all' | 'commodity' | 'crypto' | 'vn30' | 'stock'>('all');

  const filtered = symbols.filter(s => {
    if (filterType === 'all') return true;
    if (filterType === 'commodity') return s.type === 'commodity' || s.symbol.includes('XAU') || s.symbol.includes('OIL') || s.symbol.includes('PAXG');
    if (filterType === 'crypto') return s.type === 'crypto';
    if (filterType === 'vn30') return s.type === 'vn30' || s.symbol === 'VNINDEX';
    if (filterType === 'stock') return s.type === 'stock' || s.type === 'index';
    return true;
  });

  const getHeatmapColor = (change: number) => {
    if (change >= 5) return 'bg-emerald-600 border-emerald-400 text-white';
    if (change >= 2) return 'bg-emerald-700/80 border-emerald-500 text-emerald-100';
    if (change > 0) return 'bg-emerald-900/60 border-emerald-600/40 text-emerald-200';
    if (change === 0) return 'bg-gray-800 border-gray-700 text-gray-300';
    if (change >= -2) return 'bg-rose-900/60 border-rose-600/40 text-rose-200';
    if (change >= -5) return 'bg-rose-700/80 border-rose-500 text-rose-100';
    return 'bg-rose-600 border-rose-400 text-white';
  };

  return (
    <div className="flex-1 h-full bg-[#090d15] p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 select-none overflow-y-auto pb-28 md:pb-12">
      {/* Top Header & Close */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-[#1b2536]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                Bản Đồ Nhiệt Thị Trường
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-400">
                Biến động 24h & dòng tiền ({filtered.length} mã)
              </p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="sm:hidden p-1.5 rounded-lg bg-[#141b27] hover:bg-[#1f293b] border border-[#232f44] text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs & Desktop Close Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-[#141b27] p-1 rounded-xl border border-[#232f44] text-xs overflow-x-auto no-scrollbar whitespace-nowrap w-full sm:w-auto">
            {(['all', 'commodity', 'crypto', 'vn30', 'stock'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                className={`px-2.5 py-1 rounded-lg font-medium transition text-center shrink-0 text-[11px] sm:text-xs ${
                  filterType === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'all'
                  ? 'Tất cả'
                  : tab === 'commodity'
                  ? '🥇 Vàng & Dầu'
                  : tab === 'crypto'
                  ? '🪙 Top Coin'
                  : tab === 'vn30'
                  ? '🇻🇳 VN30'
                  : '🇺🇸 Mỹ'}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="hidden sm:block p-1.5 rounded-lg bg-[#141b27] hover:bg-[#1f293b] border border-[#232f44] text-gray-400 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Heatmap Grid - Responsive for all mobile phone sizes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
        {filtered.map(s => {
          const isVND = s.quoteAsset === 'VND';
          const isPositive = s.change24h >= 0;
          const isCommodity = s.type === 'commodity' || s.symbol.includes('XAU') || s.symbol.includes('OIL') || s.symbol.includes('PAXG');

          return (
            <div
              key={s.symbol}
              onClick={() => onSelectSymbol(s)}
              className={`p-2.5 sm:p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition transform active:scale-95 sm:hover:scale-[1.02] shadow-lg min-h-[105px] sm:min-h-[120px] ${getHeatmapColor(
                s.change24h
              )}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs sm:text-sm tracking-tight">{s.symbol}</span>
                <span className={`text-[8px] sm:text-[9px] px-1 rounded uppercase font-semibold ${
                  isCommodity ? 'bg-amber-400/20 text-amber-200' : 'opacity-75'
                }`}>
                  {isCommodity ? 'HÀNG HÓA' : s.type}
                </span>
              </div>

              <div className="my-1 sm:my-2">
                <div className="text-sm sm:text-base font-mono font-extrabold truncate">
                  {isVND ? `${formatPrice(s.price)}k` : `$${formatPrice(s.price)}`}
                </div>
                <div className="text-[10px] sm:text-[11px] opacity-80 truncate">{s.name}</div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] sm:text-xs font-mono font-bold">
                <span className="flex items-center gap-0.5">
                  {isPositive ? <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <ArrowDownRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                  {formatPercent(s.change24h)}
                </span>
                <span className="text-[9px] sm:text-[10px] opacity-75">{formatVolume(s.volume24h)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
