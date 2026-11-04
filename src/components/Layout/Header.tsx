import React, { useEffect, useState } from 'react';
import {
  Bell,
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
  Maximize2,
  Minimize2,
  Star,
} from 'lucide-react';
import { MarketSymbol, SignalAction, Timeframe } from '../../types';
import { formatPercent, formatPrice, formatVolume } from '../../utils/formatters';
import { getMarketSessionInfo } from '../../utils/marketHours';
import { isVnDerivativeSymbol } from '../../services/vnMarket/vnStockMicrostructure';
import {
  LocalUserProfile,
  sortSymbolsWithFavoritesFirst,
} from '../../services/storage/userProfileManager';
import { UserProfileMenu } from './UserProfileMenu';

interface HeaderProps {
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
  favorites?: string[];
  timeframe: Timeframe;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  onChangeTimeframe: (tf: Timeframe) => void;
  onOpenBacktest: () => void;
  onOpenHeatmap: () => void;
  onOpenRadar?: () => void;
  onOpenAlerts?: () => void;
  onOpenCommandPalette?: () => void;
  unreadAlertCount?: number;
  activeAlertRuleCount?: number;
  onRefreshData: () => void;
  isLiveLoading: boolean;
  activeView: 'chart' | 'heatmap';
  setActiveView: (view: 'chart' | 'heatmap') => void;
  signalAction?: SignalAction;
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
  activeProfile?: LocalUserProfile;
  profiles?: LocalUserProfile[];
  onProfileSwitched?: (profile: LocalUserProfile, allProfiles: LocalUserProfile[]) => void;
  onProfilesUpdated?: (allProfiles: LocalUserProfile[], active: LocalUserProfile) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSymbol,
  symbols,
  favorites = [],
  timeframe,
  onSelectSymbol,
  onChangeTimeframe,
  onOpenBacktest,
  onOpenRadar,
  onOpenAlerts,
  onOpenCommandPalette,
  unreadAlertCount = 0,
  activeAlertRuleCount = 0,
  onRefreshData,
  isLiveLoading,
  activeView,
  setActiveView,
  signalAction,
  isZenMode = false,
  onToggleZenMode,
  activeProfile,
  profiles = [],
  onProfileSwitched,
  onProfilesUpdated,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'commodity' | 'crypto' | 'vn30' | 'stock'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [nowClock, setNowClock] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNowClock(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  const session = getMarketSessionInfo(currentSymbol, nowClock);

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D', '1W', '1M'];

  // Global keyboard shortcut: Ctrl+K / Cmd+K to open Pro Command Palette (or Symbol Search), Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (onOpenCommandPalette) {
          onOpenCommandPalette();
        } else {
          setSearchOpen(prev => !prev);
        }
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, onOpenCommandPalette]);

  const favUpperSet = new Set(favorites.map(f => String(f || '').toUpperCase()));

  const filteredSymbols = sortSymbolsWithFavoritesFirst(
    symbols.filter(s => {
      const matchesType =
        filterType === 'all' ||
        (filterType === 'commodity' &&
          (s.type === 'commodity' ||
            s.symbol.includes('XAU') ||
            s.symbol.includes('OIL') ||
            s.symbol.includes('PAXG'))) ||
        (filterType === 'crypto' && s.type === 'crypto') ||
        (filterType === 'vn30' &&
          (s.type === 'vn30' || s.quoteAsset === 'VND' || s.symbol === 'VNINDEX')) ||
        (filterType === 'stock' &&
          (s.type === 'stock' || s.type === 'index') &&
          s.quoteAsset !== 'VND' &&
          s.symbol !== 'VNINDEX');

      const matchesSearch =
        s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.category && s.category.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesType && matchesSearch;
    }),
    favorites
  );

  const isPositive = currentSymbol.change24h >= 0;
  const isVND = currentSymbol.quoteAsset === 'VND';
  const isVnIdxOrDeriv =
    currentSymbol.symbol === 'VNINDEX' ||
    currentSymbol.symbol === 'VN30' ||
    isVnDerivativeSymbol(currentSymbol.symbol);
  const prefix = isVND ? '' : '$';
  const suffix = isVND ? (isVnIdxOrDeriv ? ' đ' : 'k') : '';
  const isCommodity =
    currentSymbol.type === 'commodity' ||
    currentSymbol.symbol.includes('XAU') ||
    currentSymbol.symbol.includes('OIL') ||
    currentSymbol.symbol.includes('PAXG');

  return (
    <>
      <header className="min-h-[48px] sm:h-[58px] py-1 sm:py-0 bg-[#080c14]/95 backdrop-blur-xl border-b border-slate-800/80 px-2 sm:px-4 flex items-center justify-between gap-1 sm:gap-2 z-30 select-none shrink-0 overflow-hidden shadow-[0_4px_20px_-8px_rgba(0,0,0,0.6)]">
        {/* Left: Brand + Symbol Command Selector + Live Quote & 24h Stats */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 overflow-hidden">
          {/* Brand Logo */}
          <div
            onClick={() => setActiveView('chart')}
            className="flex items-center gap-2 shrink-0 cursor-pointer group"
          >
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-teal-400 p-[1px] shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/35 transition">
              <div className="w-full h-full rounded-[11px] bg-[#080d17] flex items-center justify-center">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="font-extrabold text-sm tracking-tight text-white font-mono">
                  TRADING<span className="text-cyan-400">NEW</span>
                </span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                  KRONOS
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-slate-400 whitespace-nowrap">
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

          <div className="hidden sm:block h-6 w-px bg-slate-800/90 shrink-0" />

          {/* Symbol Command Selector Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[#101725] hover:bg-[#162033] border border-slate-700/70 hover:border-cyan-500/50 transition text-left shadow-inner shrink-0 whitespace-nowrap"
            title="Tìm kiếm mã nhanh (Ctrl + K)"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                <span className="font-extrabold text-xs sm:text-sm text-white font-mono tracking-tight whitespace-nowrap">
                  {currentSymbol.symbol}
                </span>
                <span
                  className={`hidden sm:inline-block text-[9px] px-1.5 py-0.2 rounded uppercase font-bold whitespace-nowrap ${
                    isCommodity
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                      : isVnDerivativeSymbol(currentSymbol.symbol)
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/35'
                      : currentSymbol.type === 'crypto'
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : currentSymbol.type === 'vn30' || isVND
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  {isCommodity
                    ? 'HÀNG HÓA'
                    : isVnDerivativeSymbol(currentSymbol.symbol)
                    ? 'PHÁI SINH'
                    : currentSymbol.type === 'vn30'
                    ? 'VN30'
                    : isVND
                    ? 'CP VN'
                    : currentSymbol.type}
                </span>
              </div>
              <span className="hidden sm:block text-[10px] text-slate-400 truncate max-w-[135px]">
                {currentSymbol.name}
              </span>
            </div>

            <div
              onClick={e => {
                if (onOpenCommandPalette) {
                  e.stopPropagation();
                  onOpenCommandPalette();
                }
              }}
              title="Mở bảng Lệnh Nhanh Command Palette (Ctrl + K)"
              className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#090d16] hover:bg-cyan-500/20 border border-slate-800 hover:border-cyan-400/50 text-[9px] font-mono text-cyan-300 transition shrink-0"
            >
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
            <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
          </button>

          {/* Real-Time Price & Official Session Metrics */}
          <div className="flex items-center gap-2 sm:gap-3 font-mono tabular-nums pl-0.5 shrink-0 whitespace-nowrap">
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                <span
                  className={`text-xs sm:text-base font-extrabold leading-none whitespace-nowrap ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {prefix}
                  {formatPrice(currentSymbol.price)}
                  {suffix}
                </span>
                <span
                  title={`${session.statusHeadline}\n${session.scheduleSummary}\n${session.nextSessionLabel}`}
                  className={`hidden lg:inline-flex items-center gap-1 text-[8.5px] font-sans font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
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
              <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                <span
                  className={`text-[9.5px] sm:text-[10px] font-bold px-1 py-0.2 rounded leading-none whitespace-nowrap ${
                    isPositive
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-rose-500/15 text-rose-400'
                  }`}
                >
                  {formatPercent(currentSymbol.change24h)}
                </span>
                {signalAction && (
                  <span
                    className={`hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border whitespace-nowrap ${
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
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 whitespace-nowrap">
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
              className="flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold shadow-sm shadow-amber-500/10 transition shrink-0 whitespace-nowrap"
              title="Radar quét vùng gom tích sản toàn thị trường"
            >
              <Target className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              <span className="hidden lg:inline">Vùng Gom</span>
              <span className="hidden sm:inline lg:hidden">Gom</span>
            </button>
          )}

          {onOpenAlerts && (
            <button
              onClick={onOpenAlerts}
              title="Trung tâm Chuông Cảnh Báo Thông Minh, Telegram & Đồng bộ Cloud KV"
              className={`relative p-1.5 sm:p-2 rounded-xl border transition shrink-0 ${
                unreadAlertCount > 0
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                  : activeAlertRuleCount > 0
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25'
                  : 'bg-[#101725] hover:bg-[#172236] border-slate-700/70 text-slate-300 hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {(unreadAlertCount > 0 || activeAlertRuleCount > 0) && (
                <span
                  className={`absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8.5px] font-mono font-extrabold flex items-center justify-center ${
                    unreadAlertCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-cyan-500 text-black'
                  }`}
                >
                  {unreadAlertCount > 0 ? unreadAlertCount : activeAlertRuleCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={onRefreshData}
            disabled={isLiveLoading}
            title="Làm mới dữ liệu nến & giá thời gian thực"
            className="p-1.5 sm:p-2 rounded-xl bg-[#101725] hover:bg-[#172236] border border-slate-700/70 text-slate-300 hover:text-white transition disabled:opacity-50 shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                isLiveLoading ? 'animate-spin text-cyan-400' : ''
              }`}
            />
          </button>

          {activeProfile && onProfileSwitched && onProfilesUpdated && (
            <UserProfileMenu
              activeProfile={activeProfile}
              profiles={profiles}
              onProfileSwitched={onProfileSwitched}
              onProfilesUpdated={onProfilesUpdated}
            />
          )}

          <button
            onClick={onOpenBacktest}
            title="Chạy Backtest AI & Kiểm định chiến lược"
            className="flex items-center gap-1 p-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 border border-cyan-400/30 transition shrink-0 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Backtest AI</span>
          </button>
        </div>
      </header>

      {/* Sub-Header Timeframe Bar on Mobile (< 768px) */}
      <div className="md:hidden flex items-center justify-between px-1.5 py-1 bg-[#080c14] border-b border-slate-800/80 overflow-x-auto no-scrollbar gap-1 shrink-0 whitespace-nowrap">
        <div className="flex items-center gap-1 w-full justify-between min-w-max">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => onChangeTimeframe(tf)}
              className={`flex-1 min-w-[32px] px-1.5 py-0.5 text-center text-[10.5px] font-mono font-bold rounded-md transition shrink-0 whitespace-nowrap ${
                timeframe === tf
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white bg-[#101725]'
              }`}
            >
              {tf}
            </button>
          ))}
          {onToggleZenMode && (
            <button
              type="button"
              onClick={onToggleZenMode}
              title="Chế độ Zen: Ẩn/Hiện thanh công cụ để phóng đại Biểu đồ trên di động"
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold flex items-center gap-0.5 shrink-0 border transition whitespace-nowrap ${
                isZenMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                  : 'bg-[#101725] text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {isZenMode ? (
                <Minimize2 className="w-2.5 h-2.5 shrink-0" />
              ) : (
                <Maximize2 className="w-2.5 h-2.5 shrink-0" />
              )}
              <span>Zen</span>
            </button>
          )}
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
                      ? '🇻🇳 Cổ phiếu VN'
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
                        {favUpperSet.has(s.symbol.toUpperCase()) && (
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                        )}
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
                        {sVnd
                          ? `${formatPrice(s.price)}${
                              s.symbol === 'VNINDEX' ||
                              s.symbol === 'VN30' ||
                              isVnDerivativeSymbol(s.symbol)
                                ? ' đ'
                                : 'k'
                            }`
                          : `$${formatPrice(s.price)}`}
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
