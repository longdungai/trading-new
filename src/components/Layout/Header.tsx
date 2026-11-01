import React, { useEffect, useState } from 'react';
import {
  Bot,
  Flame,
  Search,
  Sparkles,
  ChevronDown,
  RefreshCw,
  X,
  Target,
  LineChart,
  Command,
} from 'lucide-react';
import { MarketSymbol, SignalAction, Timeframe } from '../../types';
import { formatPercent, formatPrice, formatVolume } from '../../utils/formatters';
import { getMarketSessionInfo } from '../../utils/marketHours';

interface HeaderProps {
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
  timeframe: Timeframe;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  onChangeTimeframe: (tf: Timeframe) => void;
  onOpenBacktest: () => void;
  onOpenHeatmap: () => void;
  onOpenRadar?: () => void;
  onRefreshData: () => void;
  isLiveLoading: boolean;
  activeView: 'chart' | 'heatmap';
  setActiveView: (view: 'chart' | 'heatmap') => void;
  signalAction?: SignalAction;
}

export const Header: React.FC<HeaderProps> = ({
  currentSymbol,
  symbols,
  timeframe,
  onSelectSymbol,
  onChangeTimeframe,
  onOpenBacktest,
  onOpenRadar,
  onRefreshData,
  isLiveLoading,
  activeView,
  setActiveView,
  signalAction,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'commodity' | 'crypto' | 'vn30' | 'stock'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [nowClock, setNowClock] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNowClock(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const session = getMarketSessionInfo(currentSymbol, nowClock);

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D', '1W', '1M'];

  // Global keyboard shortcut: Ctrl+K / Cmd+K to open Symbol Search, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  const filteredSymbols = symbols.filter(s => {
    const matchesType =
      filterType === 'all' ||
      (filterType === 'commodity' &&
        (s.type === 'commodity' ||
          s.symbol.includes('XAU') ||
          s.symbol.includes('OIL') ||
          s.symbol.includes('PAXG'))) ||
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
  const prefix = isVND ? '' : '$';
  const suffix = isVND ? 'k' : '';
  const isCommodity =
    currentSymbol.type === 'commodity' ||
    currentSymbol.symbol.includes('XAU') ||
    currentSymbol.symbol.includes('OIL') ||
    currentSymbol.symbol.includes('PAXG');

  return (
    <>
      <header className="h-14 sm:h-[58px] bg-[#080c14]/95 backdrop-blur-xl border-b border-slate-800/80 px-2.5 sm:px-4 flex items-center justify-between gap-2 z-30 select-none shrink-0 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.6)]">
        {/* Left: Brand + Symbol Command Selector + Live Quote & 24h Stats */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Brand Logo */}
          <div
            onClick={() => setActiveView('chart')}
            className="flex items-center gap-2 shrink-0 cursor-pointer group"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-teal-400 p-[1px] shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/35 transition">
              <div className="w-full h-full rounded-[11px] bg-[#080d17] flex items-center justify-center">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white font-mono">
                  TRADING<span className="text-cyan-400">NEW</span>
                </span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                  KRONOS
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-slate-400">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    session.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`font-mono font-semibold tracking-wider ${
                    session.isOpen ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {session.isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-6 w-px bg-slate-800/90" />

          {/* Symbol Command Selector Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#101725] hover:bg-[#162033] border border-slate-700/70 hover:border-cyan-500/50 transition text-left shadow-inner"
            title="Tìm kiếm mã nhanh (Ctrl + K)"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-sm text-white font-mono tracking-tight">
                  {currentSymbol.symbol}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold ${
                    isCommodity
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                      : currentSymbol.type === 'crypto'
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : currentSymbol.type === 'vn30'
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  {isCommodity ? 'HÀNG HÓA' : currentSymbol.type === 'vn30' ? 'VN30' : currentSymbol.type}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate max-w-[85px] sm:max-w-[135px]">
                {currentSymbol.name}
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#090d16] border border-slate-800 text-[9px] font-mono text-slate-400">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Real-Time Price & Official Session Metrics */}
          <div className="flex items-center gap-3 font-mono tabular-nums pl-0.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-sm sm:text-base font-extrabold leading-tight ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {prefix}
                  {formatPrice(currentSymbol.price)}
                  {suffix}
                </span>
                <span
                  title={`${session.statusHeadline}\n${session.scheduleSummary}\n${session.nextSessionLabel}`}
                  className={`hidden lg:inline-flex items-center gap-1 text-[8.5px] font-sans font-bold px-1.5 py-0.5 rounded border ${
                    session.isOpen
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                      : session.state === 'LUNCH_BREAK'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                      : 'bg-slate-800/90 text-slate-300 border-slate-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      session.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {session.badgeText}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-bold px-1 rounded ${
                    isPositive
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-rose-500/15 text-rose-400'
                  }`}
                >
                  {formatPercent(currentSymbol.change24h)}
                </span>
                {signalAction && (
                  <span
                    className={`hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                      signalAction.includes('BUY')
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : signalAction.includes('SELL')
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {signalAction.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>

            {/* Session High / Low / Vol (Visible on Desktop >= 1536px) */}
            <div className="hidden 2xl:flex items-center gap-3.5 pl-3 border-l border-slate-800/80 text-[10px]">
              <div>
                <div className="text-slate-500 font-sans text-[9px] uppercase font-semibold">
                  {session.is24x7 ? 'Đỉnh 24h' : 'Cao Phiên'}
                </div>
                <div className="text-emerald-300 font-semibold">
                  {prefix}
                  {formatPrice(currentSymbol.high24h)}
                  {suffix}
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-sans text-[9px] uppercase font-semibold">
                  {session.is24x7 ? 'Đáy 24h' : 'Thấp Phiên'}
                </div>
                <div className="text-rose-300 font-semibold">
                  {prefix}
                  {formatPrice(currentSymbol.low24h)}
                  {suffix}
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-sans text-[9px] uppercase font-semibold">
                  {session.is24x7 ? 'KL 24h' : 'GTGD Phiên'}
                </div>
                <div className="text-slate-200 font-semibold">
                  {formatVolume(currentSymbol.volume24h)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Precision Timeframe Selector (Desktop >= 768px) */}
        <div className="hidden md:flex items-center bg-[#0d1320] p-1 rounded-xl border border-slate-800/90 shadow-inner">
          {timeframes.map(tf => {
            const active = timeframe === tf;
            return (
              <button
                key={tf}
                onClick={() => onChangeTimeframe(tf)}
                className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition ${
                  active
                    ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {tf}
              </button>
            );
          })}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Desktop View Mode Switcher (Chart vs Heatmap) */}
          <div className="hidden sm:flex items-center bg-[#0d1320] p-0.5 rounded-xl border border-slate-800/90 text-xs">
            <button
              onClick={() => setActiveView('chart')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition ${
                activeView === 'chart'
                  ? 'bg-[#1a253a] text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Biểu Đồ</span>
            </button>
            <button
              onClick={() => setActiveView('heatmap')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition ${
                activeView === 'heatmap'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">Nhiệt AI</span>
            </button>
          </div>

          {onOpenRadar && (
            <button
              onClick={onOpenRadar}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold shadow-sm shadow-amber-500/10 transition"
              title="Radar quét vùng gom tích sản toàn thị trường"
            >
              <Target className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="hidden lg:inline">Vùng Gom</span>
              <span className="lg:hidden">Gom</span>
            </button>
          )}

          <button
            onClick={onRefreshData}
            disabled={isLiveLoading}
            title="Làm mới dữ liệu nến & giá thời gian thực"
            className="p-1.5 sm:p-2 rounded-xl bg-[#101725] hover:bg-[#172236] border border-slate-700/70 text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                isLiveLoading ? 'animate-spin text-cyan-400' : ''
              }`}
            />
          </button>

          <button
            onClick={onOpenBacktest}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 border border-cyan-400/30 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Backtest AI</span>
            <span className="sm:hidden">Test</span>
          </button>
        </div>
      </header>

      {/* Sub-Header Timeframe Bar on Mobile (< 768px) */}
      <div className="md:hidden flex items-center justify-between px-2 py-1 bg-[#080c14] border-b border-slate-800/80 overflow-x-auto no-scrollbar gap-1 shrink-0">
        <div className="flex items-center gap-1 w-full justify-around">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => onChangeTimeframe(tf)}
              className={`flex-1 py-1 text-center text-[11px] font-mono font-bold rounded-lg transition ${
                timeframe === tf
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white bg-[#101725]'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Command Palette Search Modal */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 animate-in fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#0c121e] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden mt-2 sm:mt-12 flex flex-col max-h-[82vh]"
          >
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-[#101827]">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                  Tìm Kiếm Nhanh Tài Sản (Command Palette)
                </span>
              </div>
              <button
                onClick={() => setSearchOpen(false)}
                className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1"
              >
                <span>ESC</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 space-y-2.5 bg-[#0a0f1a]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Gõ mã hoặc tên: Vàng (XAU), BTC, Dầu (OIL), FPT, HPG, NVDA..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-[#121a2a] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  autoFocus
                />
              </div>

              {/* Market Filter Tabs */}
              <div className="flex gap-1 p-1 bg-[#070b12] rounded-xl border border-slate-800/80 text-[11px] overflow-x-auto no-scrollbar">
                {(['all', 'commodity', 'crypto', 'vn30', 'stock'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFilterType(tab)}
                    className={`flex-1 min-w-[70px] py-1.5 rounded-lg font-semibold text-center transition ${
                      filterType === tab
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab === 'all'
                      ? 'Tất cả'
                      : tab === 'commodity'
                      ? '🥇 Vàng/Dầu'
                      : tab === 'crypto'
                      ? '🪙 Coin'
                      : tab === 'vn30'
                      ? '🇻🇳 VN30'
                      : '🇺🇸 Mỹ'}
                  </button>
                ))}
              </div>
            </div>

            {/* Symbol List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-800/50">
              {filteredSymbols.map(s => {
                const sVnd = s.quoteAsset === 'VND';
                const sCommodity =
                  s.type === 'commodity' ||
                  s.symbol.includes('XAU') ||
                  s.symbol.includes('OIL') ||
                  s.symbol.includes('PAXG');
                return (
                  <div
                    key={s.symbol}
                    onClick={() => {
                      onSelectSymbol(s);
                      setSearchOpen(false);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                      s.symbol === currentSymbol.symbol
                        ? 'bg-cyan-500/15 border border-cyan-500/40'
                        : 'hover:bg-[#131d2e]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white font-mono">{s.symbol}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-semibold ${
                            sCommodity
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {sCommodity ? 'HÀNG HÓA' : s.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {s.name}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-xs font-bold text-white">
                        {sVnd ? `${formatPrice(s.price)}k` : `$${formatPrice(s.price)}`}
                      </div>
                      <div
                        className={`text-[10px] font-semibold ${
                          s.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
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
