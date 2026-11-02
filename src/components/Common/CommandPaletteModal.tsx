import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MarketSymbol, Timeframe } from '../../types';
import { formatPercent, formatPrice } from '../../utils/formatters';
import { loadFavoritesFromStorage } from '../../services/api/symbolCatalog';
import { sortSymbolsWithFavoritesFirst } from '../../services/storage/userProfileManager';
import {
  Search,
  Zap,
  Globe2,
  Bell,
  Play,
  BarChart2,
  Sparkles,
  Newspaper,
  CornerDownLeft,
  X,
} from 'lucide-react';

interface CommandActionItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  keywords: string;
  icon: 'symbol' | 'macro' | 'alert' | 'replay' | 'chart' | 'backtest' | 'news';
  onExecute: () => void;
}

interface CommandPaletteModalProps {
  symbols: MarketSymbol[];
  currentSymbol: MarketSymbol;
  timeframe: Timeframe;
  onSelectSymbolAndTimeframe: (sym: MarketSymbol, tf?: Timeframe) => void;
  onChangeTimeframe: (tf: Timeframe) => void;
  onOpenMacroTab: (tab: any) => void;
  onOpenBacktest: () => void;
  onOpenAlerts: () => void;
  onOpenRadar: () => void;
  onToggleReplay: () => void;
  onToggleVpvr: () => void;
  onToggleVwap: () => void;
  onSetCompareSymbol: (sym: string | null) => void;
  onClose: () => void;
}

const VALID_TFS: { match: string; tf: Timeframe }[] = [
  { match: '1m', tf: '1m' },
  { match: '5m', tf: '5m' },
  { match: '15m', tf: '15m' },
  { match: '1h', tf: '1h' },
  { match: '4h', tf: '4h' },
  { match: '1d', tf: '1D' },
  { match: 'd1', tf: '1D' },
  { match: '1w', tf: '1W' },
  { match: '1mo', tf: '1M' },
];

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  symbols,
  currentSymbol,
  timeframe,
  onSelectSymbolAndTimeframe,
  onOpenMacroTab,
  onOpenBacktest,
  onOpenAlerts,
  onOpenRadar,
  onToggleReplay,
  onToggleVpvr,
  onToggleVwap,
  onSetCompareSymbol,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items: CommandActionItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const parts = q.split(/\s+/).filter(Boolean);
    const tfToken = parts.length >= 2 ? VALID_TFS.find(t => t.match === parts[parts.length - 1]) : undefined;
    const symbolQuery = tfToken ? parts.slice(0, -1).join(' ') : q;

    const systemCommands: CommandActionItem[] = [
      {
        id: 'cmd_vn_market',
        title: '🇻🇳 Mở Chuyên Trang TTCK Việt Nam (VN30F1M Basis • Khối Ngoại • Sóng 10 Ngành)',
        subtitle: 'Độ lệch phái sinh VN30F1M, Top Mua/Bán ròng Khối ngoại HOSE, Định giá P/E ROE & Luân chuyển ngành',
        badge: 'TTCK VN',
        keywords: 'ttck viet nam vn30f1m phai sinh basis khoi ngoai song nganh hose hnx pe roe',
        icon: 'macro',
        onExecute: () => {
          onOpenMacroTab('vn_market');
          onClose();
        },
      },
      {
        id: 'cmd_global_markets',
        title: '🌎 Mở Chuyên Trang Crypto 24/7 & Phố Wall (Deribit/CBOE Options • 11 Ngành Mỹ)',
        subtitle: 'Thanh lý đòn bẩy 25x, Max Pain / Call-Put Wall, BTC.D & Stablecoin Mint, Sóng 11 Ngành S&P 500 & BCTC Mỹ',
        badge: 'GLOBAL',
        keywords: 'crypto pho wall us stocks options max pain call wall put wall deribit cboe funding liquidation sp500 earnings',
        icon: 'macro',
        onExecute: () => {
          onOpenMacroTab('global_markets');
          onClose();
        },
      },
      {
        id: 'cmd_replay',
        title: '🎬 Bật / Tắt Chế Độ Bar Replay (Tua Ngược Lịch Sử Tập Giao Dịch)',
        subtitle: 'Cắt nến quá khứ, chạy từng nến 1x/2x/5x và vào lệnh tập không thiên kiến tương lai',
        badge: 'REPLAY',
        keywords: 'replay tua nguoc lich su tap giao dich bar simulation',
        icon: 'replay',
        onExecute: () => {
          onToggleReplay();
          onClose();
        },
      },
      {
        id: 'cmd_vpvr',
        title: '📊 Bật / Tắt Volume Profile (VPVR — POC / VAH / VAL)',
        subtitle: 'Hiển thị phân bổ khối lượng theo mức giá & vùng giá trị 70% ngay trên biểu đồ',
        badge: 'CHART',
        keywords: 'vpvr volume profile poc vah val thanh khoan',
        icon: 'chart',
        onExecute: () => {
          onToggleVpvr();
          onClose();
        },
      },
      {
        id: 'cmd_vwap',
        title: '📈 Bật / Tắt Đường VWAP Định Chế',
        subtitle: 'Giá bình quân gia quyền khối lượng phiên trên biểu đồ chính',
        badge: 'CHART',
        keywords: 'vwap volume weighted average price',
        icon: 'chart',
        onExecute: () => {
          onToggleVwap();
          onClose();
        },
      },
      {
        id: 'cmd_fed_pivot',
        title: '🏦 Mở Fed Pivot Intelligence V2 (Điểm Hội Tụ 7 Tín Hiệu)',
        subtitle: 'Core PCE, NFP, Sahm Rule, Lợi suất thực 10Y, Kịch bản Soft Landing / Recession',
        badge: 'MACRO',
        keywords: 'fed pivot v2 lai suat fomc vi mo pce nfp',
        icon: 'macro',
        onExecute: () => {
          onOpenMacroTab('fed_pivot');
          onClose();
        },
      },
      {
        id: 'cmd_vn_gold',
        title: '🥇 Mở Quy Đổi Vàng Thế Giới VNĐ/Lượng & Chênh Lệch SJC / 9999',
        subtitle: 'So sánh XAUUSD quy đổi chuẩn quốc tế và áp lực tỷ giá USD/VND',
        badge: 'VÀNG VN',
        keywords: 'vang sjc 9999 xauusd quy doi luong chi ty gia usdvnd',
        icon: 'macro',
        onExecute: () => {
          onOpenMacroTab('vn_gold_fx');
          onClose();
        },
      },
      {
        id: 'cmd_news_breadth',
        title: '📰 Mở Trạm Tin Nóng Tài Chính & Độ Rộng Thị Trường VN30',
        subtitle: 'Tin tức trực tiếp Fed/CNBC/VnExpress & chỉ báo Xanh vỏ đỏ lòng',
        badge: 'NEWS',
        keywords: 'tin tuc news breadth do rong vn30 xanh vo do long',
        icon: 'news',
        onExecute: () => {
          onOpenMacroTab('news_breadth');
          onClose();
        },
      },
      {
        id: 'cmd_backtest',
        title: '🏆 Mở Đấu Trường Backtest 10 Chiến Lược & Kiểm Định Monte Carlo',
        subtitle: 'So sánh 10 chiến lược với phí thực chiến VN T+2 / Crypto & 1,000 kịch bản rủi ro',
        badge: 'BACKTEST',
        keywords: 'backtest dau truong tournament monte carlo t+2 chien luoc',
        icon: 'backtest',
        onExecute: () => {
          onOpenBacktest();
          onClose();
        },
      },
      {
        id: 'cmd_alerts',
        title: '🔔 Mở Trung Tâm Cảnh Báo Đa Điều Kiện & Đồng Bộ Đám Mây / Telegram',
        subtitle: 'Thiết lập chuông báo Giá, RSI, Kronos AI, Fed Pivot & gửi Telegram',
        badge: 'ALERTS',
        keywords: 'canh bao alert chuong telegram cloud sync',
        icon: 'alert',
        onExecute: () => {
          onOpenAlerts();
          onClose();
        },
      },
      {
        id: 'cmd_radar',
        title: '🎯 Mở Radar Quét Vùng Giá Gom Hàng Toàn Thị Trường',
        subtitle: 'Xếp hạng tự động các mã chiết khấu sâu & tích lũy đẹp nhất',
        badge: 'RADAR',
        keywords: 'radar gom hang dca tich san',
        icon: 'chart',
        onExecute: () => {
          onOpenRadar();
          onClose();
        },
      },
      {
        id: 'cmd_compare_btc',
        title: `🔀 So Sánh Tương Quan % Với BTCUSDT Trên Biểu Đồ ${currentSymbol.symbol}`,
        subtitle: 'Chồng đường biến động % của Bitcoin lên biểu đồ hiện tại',
        badge: 'COMPARE',
        keywords: 'compare so sanh overlay btcusdt',
        icon: 'chart',
        onExecute: () => {
          onSetCompareSymbol('BTCUSDT');
          onClose();
        },
      },
      {
        id: 'cmd_compare_xau',
        title: `🔀 So Sánh Tương Quan % Với Vàng XAUUSD Trên Biểu Đồ ${currentSymbol.symbol}`,
        subtitle: 'Chồng đường biến động % của Vàng quốc tế lên biểu đồ hiện tại',
        badge: 'COMPARE',
        keywords: 'compare so sanh overlay xauusd vang gold',
        icon: 'chart',
        onExecute: () => {
          onSetCompareSymbol('XAUUSD');
          onClose();
        },
      },
      {
        id: 'cmd_compare_off',
        title: '✖️ Tắt Đường So Sánh Tương Quan (Compare Overlay)',
        subtitle: 'Quay về biểu đồ đơn tiêu chuẩn',
        badge: 'COMPARE',
        keywords: 'tat compare clear overlay',
        icon: 'chart',
        onExecute: () => {
          onSetCompareSymbol(null);
          onClose();
        },
      },
    ];

    const favList = loadFavoritesFromStorage();
    const favUpperSet = new Set(favList.map(f => String(f || '').toUpperCase()));
    const sortedSymbols = sortSymbolsWithFavoritesFirst(symbols, favList);

    const symbolItems: CommandActionItem[] = sortedSymbols
      .filter(s => {
        if (!symbolQuery) return true;
        return (
          s.symbol.toLowerCase().includes(symbolQuery) ||
          s.name.toLowerCase().includes(symbolQuery) ||
          (s.category || '').toLowerCase().includes(symbolQuery)
        );
      })
      .map(s => {
        const targetTf = tfToken?.tf;
        const prefix = s.quoteAsset === 'VND' ? '' : '$';
        const suffix = s.quoteAsset === 'VND' ? 'k' : '';
        const starPrefix = favUpperSet.has(s.symbol.toUpperCase()) ? '⭐ ' : '';
        return {
          id: `sym_${s.symbol}_${targetTf || timeframe}`,
          title: `${starPrefix}${s.symbol} — ${s.name}${targetTf ? ` • Khung ${targetTf}` : ''}`,
          subtitle: `Giá: ${prefix}${formatPrice(s.price)}${suffix} (${formatPercent(s.change24h)})`,
          badge: targetTf ? `${s.type.toUpperCase()} • ${targetTf}` : s.type.toUpperCase(),
          keywords: `${s.symbol} ${s.name}`,
          icon: 'symbol' as const,
          onExecute: () => {
            onSelectSymbolAndTimeframe(s, targetTf);
            onClose();
          },
        };
      });

    if (!q) {
      return [...systemCommands.slice(0, 6), ...symbolItems.slice(0, 12)];
    }

    const matchedCommands = tfToken
      ? []
      : systemCommands.filter(
          c => c.title.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q)
        );

    return [...symbolItems, ...matchedCommands].slice(0, 24);
  }, [
    query,
    symbols,
    currentSymbol.symbol,
    timeframe,
    onSelectSymbolAndTimeframe,
    onOpenMacroTab,
    onOpenBacktest,
    onOpenAlerts,
    onOpenRadar,
    onToggleReplay,
    onToggleVpvr,
    onToggleVwap,
    onSetCompareSymbol,
    onClose,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (items.length > 0 ? (prev + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      items[activeIndex].onExecute();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const renderIcon = (type: CommandActionItem['icon']) => {
    switch (type) {
      case 'replay':
        return <Play className="w-4 h-4 text-purple-400" />;
      case 'macro':
        return <Globe2 className="w-4 h-4 text-cyan-400" />;
      case 'alert':
        return <Bell className="w-4 h-4 text-amber-400" />;
      case 'backtest':
        return <Sparkles className="w-4 h-4 text-indigo-400" />;
      case 'news':
        return <Newspaper className="w-4 h-4 text-emerald-400" />;
      case 'chart':
        return <BarChart2 className="w-4 h-4 text-sky-400" />;
      default:
        return <Zap className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-md flex items-start justify-center pt-12 sm:pt-20 px-3 select-none animate-in fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl bg-[#0b111e] border border-cyan-500/35 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Input Bar */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 bg-[#0f1729]">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Gõ mã + khung giờ (VD: btc 4h, xau 15m, fpt 1d) hoặc lệnh (vpvr, replay, fed, vàng, tin nóng)..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-sans"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.map((item, idx) => {
            const selected = idx === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={item.onExecute}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-left transition ${
                  selected
                    ? 'bg-cyan-500/15 border border-cyan-400/45'
                    : 'border border-transparent hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#111a2e] border border-slate-800 flex items-center justify-center shrink-0">
                    {renderIcon(item.icon)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-[13px] font-bold text-white truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[9.5px] font-mono font-bold text-cyan-300">
                    {item.badge}
                  </span>
                  {selected && <CornerDownLeft className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2 bg-[#080d16] border-t border-slate-800/80 flex items-center justify-between text-[10.5px] text-slate-400 font-mono">
          <span>↑↓ Di chuyển • Enter Thực thi • ESC Đóng</span>
          <span className="text-cyan-400">Mẹo: Gõ &ldquo;xau 4h&rdquo; hoặc &ldquo;hpg 1d&rdquo; để nhảy nhanh</span>
        </div>
      </div>
    </div>
  );
};
