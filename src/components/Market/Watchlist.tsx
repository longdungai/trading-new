import React, { useState, useMemo } from 'react';
import { MarketSymbol, MarketType } from '../../types';
import {
  Star,
  Search,
  TrendingUp,
  TrendingDown,
  Layers,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  X,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { formatPercent, formatPrice } from '../../utils/formatters';
import { GLOBAL_SYMBOL_CATALOG, CatalogItem } from '../../services/api/symbolCatalog';

interface WatchlistProps {
  symbols: MarketSymbol[];
  currentSymbol: MarketSymbol;
  favorites: string[];
  onSelectSymbol: (symbol: MarketSymbol) => void;
  onAddSymbol: (newSymbol: MarketSymbol) => void;
  onEditSymbol: (updatedSymbol: MarketSymbol) => void;
  onDeleteSymbol: (symbolKey: string) => void;
  onToggleFavorite: (symbolKey: string) => void;
  onResetDefaults: () => void;
}

export const Watchlist: React.FC<WatchlistProps> = ({
  symbols,
  currentSymbol,
  favorites,
  onSelectSymbol,
  onAddSymbol,
  onEditSymbol,
  onDeleteSymbol,
  onToggleFavorite,
  onResetDefaults,
}) => {
  const [filter, setFilter] = useState<'all' | 'commodity' | 'crypto' | 'vn30' | 'stock' | 'favorite'>('all');
  const [search, setSearch] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSymbol, setEditingSymbol] = useState<MarketSymbol | null>(null);

  // Add symbol input states
  const [addSearchInput, setAddSearchInput] = useState('');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null);
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<MarketType>('commodity');
  const [customCategory, setCustomCategory] = useState('');

  // Autocomplete suggestions based on user typing
  const suggestions = useMemo(() => {
    if (!addSearchInput.trim()) return GLOBAL_SYMBOL_CATALOG.slice(0, 15);
    const query = addSearchInput.toLowerCase().trim();
    return GLOBAL_SYMBOL_CATALOG.filter(
      item =>
        item.symbol.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    ).slice(0, 15);
  }, [addSearchInput]);

  // Filter existing symbols in Watchlist
  const filteredSymbols = symbols.filter(s => {
    const matchesSearch =
      s.symbol.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.category && s.category.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (filter === 'favorite') return favorites.includes(s.symbol);
    if (filter === 'commodity') return s.type === 'commodity' || s.symbol.includes('PAXG') || s.symbol.includes('GOLD') || s.symbol.includes('OIL');
    if (filter === 'crypto') return s.type === 'crypto';
    if (filter === 'vn30') return s.type === 'vn30' || s.symbol === 'VNINDEX';
    if (filter === 'stock') return s.type === 'stock' || s.type === 'index';
    return true;
  });

  // Handle Pick Suggestion or Custom Input
  const handleSelectSuggestion = (item: CatalogItem) => {
    setSelectedCatalogItem(item);
    setAddSearchInput(item.symbol);
    setCustomName(item.name);
    setCustomType(item.type);
    setCustomCategory(item.category);
  };

  const handleConfirmAdd = () => {
    const cleanSym = addSearchInput.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanSym) return;

    // Check if already in list
    if (symbols.some(s => s.symbol === cleanSym)) {
      alert(`Mã ${cleanSym} đã có sẵn trong danh sách theo dõi!`);
      return;
    }

    const isCrypto = selectedCatalogItem ? selectedCatalogItem.type === 'crypto' : cleanSym.endsWith('USDT') || cleanSym.endsWith('BTC');
    const isCommodity = selectedCatalogItem ? selectedCatalogItem.type === 'commodity' : cleanSym.includes('XAU') || cleanSym.includes('OIL') || cleanSym.includes('GOLD');
    const isVND = selectedCatalogItem ? selectedCatalogItem.quoteAsset === 'VND' : customType === 'vn30' || customType === 'index';

    const base = selectedCatalogItem ? selectedCatalogItem.baseAsset : cleanSym.replace(/(USDT|USD|BUSD|VND)$/i, '');
    const quote = selectedCatalogItem ? selectedCatalogItem.quoteAsset : isCrypto ? 'USDT' : isVND ? 'VND' : 'USD';
    const price = selectedCatalogItem ? selectedCatalogItem.defaultPrice : isVND ? 50.0 : 100.0;

    const newObj: MarketSymbol = {
      symbol: cleanSym,
      name: customName || (selectedCatalogItem ? selectedCatalogItem.name : cleanSym),
      type: customType || (selectedCatalogItem ? selectedCatalogItem.type : isCommodity ? 'commodity' : isCrypto ? 'crypto' : 'stock'),
      baseAsset: base,
      quoteAsset: quote,
      price: price,
      change24h: 0.5,
      high24h: price * 1.02,
      low24h: price * 0.98,
      volume24h: 1000000000,
      category: customCategory || (selectedCatalogItem ? selectedCatalogItem.category : 'Tự thêm'),
    };

    onAddSymbol(newObj);
    setIsAddModalOpen(false);
    setAddSearchInput('');
    setSelectedCatalogItem(null);
  };

  // Handle Edit Save
  const handleSaveEdit = () => {
    if (!editingSymbol) return;
    onEditSymbol(editingSymbol);
    setIsEditModalOpen(false);
    setEditingSymbol(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0c1017] border-l border-[#1b2230] select-none relative">
      {/* Top Header */}
      <div className="p-3 border-b border-[#1b2230] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-xs text-white uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Danh Sách Theo Dõi</span>
            <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold shadow-sm transition"
              title="Thêm mã mới (có gợi ý)"
            >
              <Plus className="w-3 h-3" />
              <span>Thêm Mã</span>
            </button>

            <button
              onClick={onResetDefaults}
              className="p-1 rounded-md bg-[#141b27] hover:bg-[#1f293b] text-gray-400 hover:text-white transition"
              title="Khôi phục danh sách mặc định"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Search inside Watchlist */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm Vàng, Dầu, Coin, VN30..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#141b27] border border-[#232f44] rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1 text-[10px]">
          {(['all', 'commodity', 'crypto', 'vn30', 'stock', 'favorite'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-2 py-1 rounded font-medium transition ${
                filter === tab ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#141b27] text-gray-400 hover:text-white'
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
                : tab === 'stock'
                ? '🇺🇸 Cổ phiếu Mỹ'
                : '★ Yêu thích'}
            </button>
          ))}
        </div>
      </div>

      {/* Symbol List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#171f2e]">
        {filteredSymbols.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500 space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto text-gray-600" />
            <p>Không tìm thấy mã nào phù hợp.</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="text-blue-400 hover:underline font-semibold"
            >
              + Nhấn để thêm mã mới
            </button>
          </div>
        ) : (
          filteredSymbols.map(s => {
            const isSelected = s.symbol === currentSymbol.symbol;
            const isFav = favorites.includes(s.symbol);
            const isPos = s.change24h >= 0;
            const isVND = s.quoteAsset === 'VND';
            const isCommodity = s.type === 'commodity' || s.symbol.includes('XAU') || s.symbol.includes('OIL') || s.symbol.includes('PAXG');

            return (
              <div
                key={s.symbol}
                onClick={() => onSelectSymbol(s)}
                className={`group p-2.5 flex items-center justify-between cursor-pointer transition relative ${
                  isSelected ? 'bg-blue-600/15 border-l-2 border-blue-500' : 'hover:bg-[#121824]'
                }`}
              >
                {/* Left Part: Star + Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(s.symbol);
                    }}
                    className="text-gray-500 hover:text-amber-400 transition"
                    title={isFav ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
                  >
                    <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-white">{s.symbol}</span>
                      <span className={`text-[9px] px-1 rounded uppercase font-semibold ${
                        isCommodity
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : s.type === 'crypto'
                          ? 'bg-blue-500/15 text-blue-400'
                          : s.type === 'vn30'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : 'bg-purple-500/15 text-purple-400'
                      }`}>
                        {isCommodity ? 'HÀNG HÓA' : s.type === 'vn30' ? 'VN30' : s.type}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 truncate max-w-[110px]">{s.name}</div>
                  </div>
                </div>

                {/* Right Part: Price & Action Buttons */}
                <div className="flex items-center gap-2">
                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-gray-100 flex items-center justify-end gap-1">
                      {isVND ? `${formatPrice(s.price)}k` : `$${formatPrice(s.price)}`}
                    </div>
                    <div className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${
                      isPos ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isPos ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {formatPercent(s.change24h)}
                    </div>
                  </div>

                  {/* Edit & Delete Action Buttons (visible on hover) */}
                  <div className="hidden group-hover:flex items-center gap-1 bg-[#121824] pl-1 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSymbol({ ...s });
                        setIsEditModalOpen(true);
                      }}
                      className="p-1 rounded text-gray-400 hover:text-blue-400 hover:bg-[#1a2332] transition"
                      title="Chỉnh sửa mã"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Bạn có chắc chắn muốn xóa mã ${s.symbol} khỏi danh sách theo dõi?`)) {
                          onDeleteSymbol(s.symbol);
                        }
                      }}
                      className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-[#1a2332] transition"
                      title="Xóa mã này"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ================= MODAL: THÊM MÃ MỚI ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e141f] border border-[#232f44] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-[#1c2738] flex items-center justify-between bg-[#121927]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-tight font-mono">
                    Thêm Mã Giao Dịch Mới
                  </h3>
                  <p className="text-[11px] text-gray-400">Gõ mã hoặc tên để nhận gợi ý tự động (Vàng, Dầu, Coin, Cổ phiếu...)</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 uppercase font-semibold block mb-1">
                  Nhập mã hoặc tên (Gợi ý tức thì)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Ví dụ: XAUUSD (Vàng), OIL_WTI (Dầu), SOL, VND, NVDA..."
                    value={addSearchInput}
                    onChange={(e) => {
                      setAddSearchInput(e.target.value);
                      setSelectedCatalogItem(null);
                    }}
                    className="w-full bg-[#141b27] border border-[#27364e] rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Suggestions List Grid */}
              <div className="border border-[#202c3e] rounded-xl bg-[#0c1017] p-2 max-h-48 overflow-y-auto space-y-1">
                <div className="text-[10px] text-gray-500 font-semibold uppercase px-1 mb-1">
                  Gợi ý ({suggestions.length} mã phù hợp):
                </div>
                {suggestions.map((item) => (
                  <div
                    key={item.symbol}
                    onClick={() => handleSelectSuggestion(item)}
                    className={`p-2 rounded-lg cursor-pointer flex items-center justify-between text-xs transition ${
                      selectedCatalogItem?.symbol === item.symbol
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-[#16202f] text-gray-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-mono">{item.symbol}</span>
                        <span className={`text-[9px] px-1 rounded uppercase font-semibold ${
                          item.type === 'commodity'
                            ? 'bg-amber-500/20 text-amber-300'
                            : item.type === 'crypto'
                            ? 'bg-blue-500/20 text-blue-300'
                            : item.type === 'vn30'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-purple-500/20 text-purple-300'
                        }`}>
                          {item.type === 'commodity' ? 'HÀNG HÓA' : item.type}
                        </span>
                      </div>
                      <div className="text-[10px] opacity-75">{item.name}</div>
                    </div>

                    <div className="text-right font-mono text-[11px]">
                      <div>{item.quoteAsset === 'VND' ? `${item.defaultPrice}k` : `$${item.defaultPrice}`}</div>
                      <div className="text-[9px] opacity-70 truncate max-w-[120px]">{item.category}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Tên Hiển Thị</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Tên tài sản / Coin..."
                    className="w-full bg-[#141b27] border border-[#232f44] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Phân Loại Thị Trường</label>
                  <select
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value as MarketType)}
                    className="w-full bg-[#141b27] border border-[#232f44] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="commodity">🥇 Vàng, Dầu, Hàng Hóa</option>
                    <option value="crypto">🪙 Crypto (Binance)</option>
                    <option value="vn30">🇻🇳 Rổ VN30</option>
                    <option value="stock">🇻🇳 Chứng khoán VN / 🇺🇸 Mỹ</option>
                    <option value="index">📊 Chỉ Số Thị Trường</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#121927] border-t border-[#1c2738] flex items-center justify-end gap-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleConfirmAdd}
                disabled={!addSearchInput.trim()}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition"
              >
                Thêm Vào Danh Sách
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHỈNH SỬA MÃ ================= */}
      {isEditModalOpen && editingSymbol && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e141f] border border-[#232f44] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-[#1c2738] flex items-center justify-between bg-[#121927]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-mono">
                    Chỉnh Sửa Mã: {editingSymbol.symbol}
                  </h3>
                  <p className="text-[11px] text-gray-400">Thay đổi tên hiển thị, loại thị trường hoặc nhóm ngành</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Tên Hiển Thị</label>
                <input
                  type="text"
                  value={editingSymbol.name}
                  onChange={(e) => setEditingSymbol({ ...editingSymbol, name: e.target.value })}
                  className="w-full bg-[#141b27] border border-[#27364e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Loại Thị Trường</label>
                <select
                  value={editingSymbol.type}
                  onChange={(e) => setEditingSymbol({ ...editingSymbol, type: e.target.value as MarketType })}
                  className="w-full bg-[#141b27] border border-[#27364e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="commodity">🥇 Vàng, Dầu, Hàng Hóa</option>
                  <option value="crypto">🪙 Crypto (Binance)</option>
                  <option value="vn30">🇻🇳 Rổ VN30</option>
                  <option value="stock">🇻🇳 Chứng khoán VN / 🇺🇸 Mỹ</option>
                  <option value="index">📊 Chỉ Số</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Nhóm Ngành / Danh Mục</label>
                <input
                  type="text"
                  value={editingSymbol.category || ''}
                  onChange={(e) => setEditingSymbol({ ...editingSymbol, category: e.target.value })}
                  className="w-full bg-[#141b27] border border-[#27364e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-3 bg-[#121927] border-t border-[#1c2738] flex items-center justify-end gap-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
