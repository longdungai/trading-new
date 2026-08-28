import React, { useState } from 'react';
import {
  Bot,
  Flame,
  Search,
  Sparkles,
  ChevronDown,
  RefreshCw,
  X,
} from 'lucide-react';
import { MarketSymbol, Timeframe } from '../../types';
import { formatPercent, formatPrice, formatVolume } from '../../utils/formatters';

interface HeaderProps {
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
  timeframe: Timeframe;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  onChangeTimeframe: (tf: Timeframe) => void;
  onOpenBacktest: () => void;
  onOpenHeatmap: () => void;
  onRefreshData: () => void;
  isLiveLoading: boolean;
  activeView: 'chart' | 'heatmap';
  setActiveView: (view: 'chart' | 'heatmap') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSymbol,
  symbols,
  timeframe,
  onSelectSymbol,
  onChangeTimeframe,
  onOpenBacktest,
  onRefreshData,
  isLiveLoading,
  activeView,
  setActiveView,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'commodity' | 'crypto' | 'vn30' | 'stock'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];

  const filteredSymbols = symbols.filter(s => {
    const matchesType =
      filterType === 'all' ||
      (filterType === 'commodity' && (s.type === 'commodity' || s.symbol.includes('XAU') || s.symbol.includes('OIL') || s.symbol.includes('PAXG'))) ||
      (filterType === 'crypto' && s.type === 'crypto') ||
      (filterType === 'vn30' && (s.type === 'vn30' || s.symbol === 'VNINDEX')) ||
      (filterType === 'stock' && (s.type === 'stock' || s.type === 'index'));

    const matchesSearch =
      s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.category && s.category.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesType && matchesSearch;
  });

  const isPositive = currentSymbol.change24h >= 0;
  const isVND = currentSymbol.quoteAsset === 'VND';
  const isCommodity = currentSymbol.type === 'commodity' || currentSymbol.symbol.includes('XAU') || currentSymbol.symbol.includes('OIL') || currentSymbol.symbol.includes('PAXG');

  return (
    <>
      <header className="h-14 sm:h-16 bg-[#0c1017] border-b border-[#1b2230] px-2.5 sm:px-4 flex items-center justify-between z-30 select-none">
        {/* Left: Logo & Symbol Selector */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Brand Logo */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm sm:text-base tracking-tight text-white font-mono">TRADING<span className="text-blue-400"> NEW</span></span>
                <span className="text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">PRO</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400 -mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-emerald-400 font-mono font-bold text-[9px]">REAL-TIME</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-6 w-px bg-gray-800 mx-0.5" />

          {/* Symbol Selector Button */}
          <div className="relative">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#141a24] hover:bg-[#1a2332] border border-[#232d3f] transition text-left"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs sm:text-sm text-white font-mono">{currentSymbol.symbol}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded uppercase font-semibold ${
                    isCommodity ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                    currentSymbol.type === 'crypto' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                    currentSymbol.type === 'vn30' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                    'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                  }`}>
                    {isCommodity ? 'HÀNG HÓA' : currentSymbol.type === 'vn30' ? 'VN30' : currentSymbol.type}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 block truncate max-w-[90px] sm:max-w-[130px]">{currentSymbol.name}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
            </button>
          </div>

          {/* Real-time Price on Mobile & Tablet */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 font-mono ml-1">
            <div className={`text-xs sm:text-sm font-extrabold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isVND ? `${formatPrice(currentSymbol.price)}k` : `$${formatPrice(currentSymbol.price)}`}
            </div>
            <div className={`text-[10px] font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPercent(currentSymbol.change24h)}
            </div>
          </div>
        </div>

        {/* Center: Timeframe Selector (Hidden on tiny mobile, shown in dedicated mobile bar below) */}
        <div className="hidden md:flex items-center bg-[#141a24] p-1 rounded-lg border border-[#232d3f]">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => onChangeTimeframe(tf)}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition ${
                timeframe === tf ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onRefreshData}
            disabled={isLiveLoading}
            title="Làm mới dữ liệu nến & giá"
            className="p-1.5 sm:p-2 rounded-lg bg-[#141a24] hover:bg-[#1a2332] border border-[#232d3f] text-gray-300 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLiveLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            onClick={() => setActiveView(activeView === 'heatmap' ? 'chart' : 'heatmap')}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              activeView === 'heatmap'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[#141a24] hover:bg-[#1a2332] text-gray-300 border-[#232d3f]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Nhiệt</span>
          </button>

          <button
            onClick={onOpenBacktest}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 border border-blue-400/30 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Backtest AI</span>
            <span className="sm:hidden">Test</span>
          </button>
        </div>
      </header>

      {/* Sub-Header Timeframe Bar on Mobile (< 768px) */}
      <div className="md:hidden flex items-center justify-between px-2 py-1 bg-[#090d14] border-b border-[#1b2230] overflow-x-auto no-scrollbar gap-1">
        <div className="flex items-center gap-1 w-full justify-around">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => onChangeTimeframe(tf)}
              className={`flex-1 py-1 text-center text-xs font-mono font-bold rounded-md transition ${
                timeframe === tf ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white bg-[#121824]'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Full-Screen Search Modal for Mobile & Dropdown for Desktop */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-[#0e141f] border border-[#232f44] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden mt-2 sm:mt-10 flex flex-col max-h-[85vh]">
            <div className="p-3 border-b border-[#1c2738] flex items-center justify-between bg-[#121927]">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold font-mono text-white uppercase">Tìm kiếm mã giao dịch</span>
              </div>
              <button
                onClick={() => setSearchOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm Vàng (XAU), Dầu (OIL), Coin, VN30..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#141b27] border border-[#27364e] rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              {/* Market Filter Tabs */}
              <div className="flex gap-1 p-1 bg-[#090d15] rounded-xl text-[11px] overflow-x-auto no-scrollbar">
                {(['all', 'commodity', 'crypto', 'vn30', 'stock'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFilterType(tab)}
                    className={`flex-1 min-w-[70px] py-1.5 rounded-lg font-medium text-center transition ${
                      filterType === tab ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab === 'all' ? 'Tất cả' : tab === 'commodity' ? '🥇 Vàng/Dầu' : tab === 'crypto' ? '🪙 Coin' : tab === 'vn30' ? '🇻🇳 VN30' : '🇺🇸 Mỹ'}
                  </button>
                ))}
              </div>
            </div>

            {/* Symbol List with Large Mobile Touch Targets */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-[#17202f]">
              {filteredSymbols.map(s => {
                const sVnd = s.quoteAsset === 'VND';
                const sCommodity = s.type === 'commodity' || s.symbol.includes('XAU') || s.symbol.includes('OIL') || s.symbol.includes('PAXG');
                return (
                  <div
                    key={s.symbol}
                    onClick={() => {
                      onSelectSymbol(s);
                      setSearchOpen(false);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                      s.symbol === currentSymbol.symbol ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-[#16202f]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white font-mono">{s.symbol}</span>
                        <span className={`text-[9px] px-1 rounded uppercase font-semibold ${
                          sCommodity ? 'bg-amber-500/20 text-amber-300' : 'bg-[#1e293b] text-gray-400'
                        }`}>
                          {sCommodity ? 'HÀNG HÓA' : s.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 truncate max-w-[180px]">{s.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-white">
                        {sVnd ? `${formatPrice(s.price)}k` : `$${formatPrice(s.price)}`}
                      </div>
                      <div className={`text-[10px] font-mono font-semibold ${s.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPercent(s.change24h)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
