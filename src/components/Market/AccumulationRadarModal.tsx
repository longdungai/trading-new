import React, { useState, useMemo } from 'react';
import { MarketSymbol } from '../../types';
import { AccumulationAnalysis, scanMarketAccumulation } from '../../services/ai/accumulationScanner';
import { formatPrice } from '../../utils/formatters';
import {
  Sparkles,
  X,
  Target,
  Flame,
  Gem,
  ArrowUpRight,
  TrendingDown,
  ShieldAlert,
  Search,
  ExternalLink,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface AccumulationRadarModalProps {
  symbols: MarketSymbol[];
  onSelectSymbol: (symbol: MarketSymbol) => void;
  onClose: () => void;
}

export const AccumulationRadarModal: React.FC<AccumulationRadarModalProps> = ({
  symbols,
  onSelectSymbol,
  onClose,
}) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'vn30' | 'commodity' | 'crypto' | 'stock'>('all');
  const [search, setSearch] = useState('');

  // Scan and rank all symbols
  const rankedList: AccumulationAnalysis[] = useMemo(() => {
    return scanMarketAccumulation(symbols);
  }, [symbols]);

  // Filter list
  const filteredList = useMemo(() => {
    return rankedList.filter(item => {
      if (filterCategory === 'vn30' && item.type !== 'vn30' && item.symbol !== 'VNINDEX') return false;
      if (filterCategory === 'commodity' && item.type !== 'commodity' && !item.symbol.includes('XAU') && !item.symbol.includes('OIL') && !item.symbol.includes('PAXG')) return false;
      if (filterCategory === 'crypto' && item.type !== 'crypto') return false;
      if (filterCategory === 'stock' && item.type !== 'stock' && item.type !== 'index') return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rankedList, filterCategory, search]);

  const hotCount = rankedList.filter(r => r.status === 'HOT_BUY').length;
  const dcaCount = rankedList.filter(r => r.status === 'GOOD_DCA').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="bg-[#0b1018] border border-[#233147] w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#121c2c] via-[#0f1726] to-[#121c2c] border-b border-[#202e44] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white font-mono">
                  Radar Cảnh Báo Vùng Giá Gom Hàng
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-black animate-pulse">
                  AI SCANNER
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-400">
                Tự động quét & xếp hạng các mã có vùng giá gom tích sản tốt nhất toàn thị trường
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#182333] hover:bg-[#223147] text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div className="px-3 sm:px-4 py-2.5 bg-[#0e1522] border-b border-[#1b273a] grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-[#141d2c] border border-amber-500/20">
            <div className="text-[10px] text-gray-400 font-semibold uppercase flex items-center justify-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" />
              Vùng Gom Siêu Đẹp
            </div>
            <div className="text-base font-black text-amber-400 font-mono mt-0.5">{hotCount} Mã</div>
          </div>

          <div className="p-2 rounded-xl bg-[#141d2c] border border-emerald-500/20">
            <div className="text-[10px] text-gray-400 font-semibold uppercase flex items-center justify-center gap-1">
              <Gem className="w-3 h-3 text-emerald-400" />
              Tích Lũy DCA Tốt
            </div>
            <div className="text-base font-black text-emerald-400 font-mono mt-0.5">{dcaCount} Mã</div>
          </div>

          <div className="p-2 rounded-xl bg-[#141d2c] border border-blue-500/20">
            <div className="text-[10px] text-gray-400 font-semibold uppercase flex items-center justify-center gap-1">
              <Layers className="w-3 h-3 text-blue-400" />
              Đang Quét Toàn Bộ
            </div>
            <div className="text-base font-black text-blue-400 font-mono mt-0.5">{symbols.length} Mã</div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="p-3 bg-[#0d131f] border-b border-[#1a2536] flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="flex gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'vn30', label: '🇻🇳 VN30' },
              { id: 'commodity', label: '🥇 Vàng & Dầu' },
              { id: 'crypto', label: '🪙 Crypto' },
              { id: 'stock', label: '🇺🇸 Cổ phiếu Mỹ' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  filterCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-[#151e2c] text-gray-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm mã hoặc tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#151e2c] border border-[#233044] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Scanned List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#172130] p-2 sm:p-3 space-y-2">
          {filteredList.map((item, index) => {
            const symObj = symbols.find(s => s.symbol === item.symbol);
            const isVND = item.type === 'vn30' || item.symbol === 'VNINDEX' || symObj?.quoteAsset === 'VND';
            const prefix = isVND ? '' : '$';
            const priceSuffix = isVND ? 'k' : '';

            return (
              <div
                key={item.symbol}
                onClick={() => {
                  if (symObj) {
                    onSelectSymbol(symObj);
                    onClose();
                  }
                }}
                className={`p-3 rounded-xl border transition cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  item.status === 'HOT_BUY'
                    ? 'bg-amber-950/20 border-amber-500/40 hover:bg-amber-950/30'
                    : item.status === 'GOOD_DCA'
                    ? 'bg-emerald-950/20 border-emerald-500/30 hover:bg-emerald-950/30'
                    : 'bg-[#111824] border-[#1d293b] hover:bg-[#162030]'
                }`}
              >
                {/* Left: Rank + Symbol + Reasons */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                    index < 3 ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30' : 'bg-[#1a2538] text-gray-300'
                  }`}>
                    #{index + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm sm:text-base text-white">
                        {item.symbol}
                      </span>
                      <span className="text-xs text-gray-400 font-medium truncate max-w-[200px]">
                        {item.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        item.status === 'HOT_BUY'
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                          : item.status === 'GOOD_DCA'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                          : 'bg-gray-800 text-gray-400'
                      }`}>
                        {item.statusLabel}
                      </span>
                    </div>

                    {/* Reasons Tags */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {item.reasons.map((r, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#162130] text-gray-300 border border-[#24334a]">
                          ✓ {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Score + Price + Target + Action Button */}
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-800">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] text-gray-400 font-semibold uppercase">
                      Vùng Gom Khuyến Nghị
                    </div>
                    <div className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
                      {prefix}{formatPrice(item.entryZone[0])} - {prefix}{formatPrice(item.entryZone[1])}{priceSuffix}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      Hiện tại: {prefix}{formatPrice(item.currentPrice)}{priceSuffix} • Target: +{((item.targetTakeProfit - item.currentPrice) / item.currentPrice * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* Gom Score Gauge */}
                  <div className="text-center px-2 py-1 rounded-lg bg-[#162132] border border-[#25364e]">
                    <div className="text-[9px] text-gray-400 font-bold uppercase">Điểm Gom</div>
                    <div className={`text-base font-mono font-black ${
                      item.score >= 78 ? 'text-amber-400' : item.score >= 64 ? 'text-emerald-400' : 'text-gray-300'
                    }`}>
                      {item.score}
                    </div>
                  </div>

                  <button
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-blue-500/20 shrink-0"
                  >
                    <span>Vào Lệnh</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
