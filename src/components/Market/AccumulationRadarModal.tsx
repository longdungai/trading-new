import React, { useState, useMemo, useEffect } from 'react';
import { MarketSymbol } from '../../types';
import {
  AccumulationAnalysis,
  scanMarketAccumulation,
} from '../../services/ai/accumulationScanner';
import {
  scanVnMomentumBreakouts,
  VnMarketMomentumSummary,
} from '../../services/vnMarket/vnExecutionEngines';
import { fetchVnStockInsights } from '../../services/vnMarket/vnStockInsightsClient';
import {
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
} from '../../services/vnMarket/vnStockMicrostructure';
import { formatPrice } from '../../utils/formatters';
import {
  X,
  Target,
  Flame,
  Gem,
  Search,
  ChevronRight,
  Layers,
  Rocket,
  Activity,
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
  const [radarMode, setRadarMode] = useState<'accumulation' | 'vn_momentum'>('accumulation');
  const [filterCategory, setFilterCategory] = useState<
    'all' | 'vn_all' | 'vn30' | 'commodity' | 'crypto' | 'stock'
  >('all');
  const [vnSetupFilter, setVnSetupFilter] = useState<
    'all' | 'BREAKOUT_LEADER' | 'VCP_TIGHT_BASE' | 'POCKET_PIVOT' | 'high_rs'
  >('all');
  const [search, setSearch] = useState('');
  const [insightsTick, setInsightsTick] = useState(0);

  // Mode 1: Multi-Market Accumulation & Value Scanner
  const rankedList: AccumulationAnalysis[] = useMemo(() => {
    void insightsTick;
    return scanMarketAccumulation(symbols);
  }, [symbols, insightsTick]);

  // Mode 2: Vietnam CANSLIM / VCP / Pocket Pivot Momentum Scanner
  const vnMomentum: VnMarketMomentumSummary = useMemo(() => {
    void insightsTick;
    return scanVnMomentumBreakouts(symbols);
  }, [symbols, insightsTick]);

  const filteredList = useMemo(() => {
    return rankedList.filter(item => {
      const symObj = symbols.find(s => s.symbol === item.symbol);
      const isVN = symObj ? isVnStockOrIndexSymbol(symObj) : item.type === 'vn30';
      if (filterCategory === 'vn_all' && (!isVN || isVnDerivativeSymbol(item.symbol))) return false;
      if (filterCategory === 'vn30' && item.type !== 'vn30' && item.symbol !== 'VNINDEX') return false;
      if (
        filterCategory === 'commodity' &&
        item.type !== 'commodity' &&
        !item.symbol.includes('XAU') &&
        !item.symbol.includes('OIL') &&
        !item.symbol.includes('PAXG')
      )
        return false;
      if (filterCategory === 'crypto' && item.type !== 'crypto') return false;
      if (filterCategory === 'stock' && (isVN || (item.type !== 'stock' && item.type !== 'index')))
        return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.symbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          (item.vnSectorName && item.vnSectorName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [rankedList, symbols, filterCategory, search]);

  const filteredVnMomentum = useMemo(() => {
    return vnMomentum.candidates.filter(c => {
      if (vnSetupFilter === 'BREAKOUT_LEADER' && c.setupType !== 'BREAKOUT_LEADER') return false;
      if (vnSetupFilter === 'VCP_TIGHT_BASE' && c.setupType !== 'VCP_TIGHT_BASE') return false;
      if (vnSetupFilter === 'POCKET_PIVOT' && c.setupType !== 'POCKET_PIVOT') return false;
      if (vnSetupFilter === 'high_rs' && c.rsRating < 80) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.sectorName.toLowerCase().includes(q) ||
          c.board.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vnMomentum.candidates, vnSetupFilter, search]);

  // Background enrich top visible Vietnam equities with live P/E, ROE & Foreign Flow
  useEffect(() => {
    let active = true;
    const targetsFromMode =
      radarMode === 'vn_momentum'
        ? filteredVnMomentum
            .filter(c => c.peRatio == null && c.roePct == null)
            .slice(0, 12)
            .map(c => c.symbol)
        : filteredList
            .filter(
              it =>
                isVnStockOrIndexSymbol(it.symbol) &&
                !isVnDerivativeSymbol(it.symbol) &&
                it.symbol !== 'VNINDEX' &&
                it.symbol !== 'VN30' &&
                it.peRatio == null
            )
            .slice(0, 10)
            .map(it => it.symbol);

    if (targetsFromMode.length === 0) return;
    void Promise.allSettled(targetsFromMode.map(sym => fetchVnStockInsights(sym))).then(() => {
      if (active) setInsightsTick(prev => prev + 1);
    });
    return () => {
      active = false;
    };
  }, [radarMode, filterCategory, vnSetupFilter, search]);

  const hotCount = rankedList.filter(r => r.status === 'HOT_BUY').length;
  const dcaCount = rankedList.filter(r => r.status === 'GOOD_DCA').length;
  const vnActionableCount = vnMomentum.breakoutCount + vnMomentum.vcpCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="bg-[#0b1018] border border-[#233147] w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#121c2c] via-[#0f1726] to-[#121c2c] border-b border-[#202e44] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10 shrink-0">
              {radarMode === 'vn_momentum' ? (
                <Rocket className="w-5 h-5 text-fuchsia-400" />
              ) : (
                <Target className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-black text-white font-mono truncate">
                  {radarMode === 'vn_momentum'
                    ? 'Bộ Lọc Săn Cổ Phiếu Dẫn Sóng VN (CANSLIM • VCP • RS)'
                    : 'Radar Cảnh Báo Vùng Giá Gom Hàng & Tích Sản'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-black shrink-0 whitespace-nowrap">
                  AI SCANNER
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-400 truncate">
                {radarMode === 'vn_momentum'
                  ? 'Quét sức mạnh giá RS 1–99, nền phẳng siết biên VCP, điểm mua Pivot chuẩn bước giá HOSE/HNX & Cắt lỗ -6%'
                  : 'Tự động quét & xếp hạng các mã có vùng giá gom tích sản tốt nhất toàn thị trường'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#182333] hover:bg-[#223147] text-gray-400 hover:text-white transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual-Mode Switcher Strip */}
        <div className="px-3 sm:px-4 py-2 bg-[#090e17] border-b border-[#1b273a] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setRadarMode('accumulation')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap border transition ${
              radarMode === 'accumulation'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                : 'bg-[#121a28] text-slate-400 hover:text-white border-slate-800'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Vùng Gom Tích Sản ({hotCount + dcaCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setRadarMode('vn_momentum')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap border transition ${
              radarMode === 'vn_momentum'
                ? 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/50 shadow-sm'
                : 'bg-[#121a28] text-slate-400 hover:text-white border-slate-800'
            }`}
          >
            <Rocket className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
            <span>🇻🇳 Săn Cổ Phiếu Dẫn Sóng VCP / CANSLIM</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/40 leading-none">
              {vnActionableCount}
            </span>
          </button>
        </div>

        {radarMode === 'accumulation' ? (
          <>
            {/* Stats Summary Bar */}
            <div className="px-3 sm:px-4 py-2.5 bg-[#0e1522] border-b border-[#1b273a] grid grid-cols-3 gap-2 text-center text-xs shrink-0">
              <div className="p-2 rounded-xl bg-[#141d2c] border border-amber-500/20">
                <div className="text-[10px] text-gray-400 font-semibold uppercase flex items-center justify-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">Vùng Gom Siêu Đẹp</span>
                </div>
                <div className="text-base font-black text-amber-400 font-mono mt-0.5">
                  {hotCount} Mã
                </div>
              </div>

              <div className="p-2 rounded-xl bg-[#141d2c] border border-emerald-500/20">
                <div className="text-[10px] text-gray-400 font-semibold uppercase flex items-center justify-center gap-1">
                  <Gem className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">Tích Lũy DCA Tốt</span>
                </div>
                <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                  {dcaCount} Mã
                </div>
              </div>

              <div className="p-2 rounded-xl bg-[#141d2c] border border-blue-500/20">
                <div className="text-[10px] text-gray-400 font-semibold uppercase flex items-center justify-center gap-1">
                  <Layers className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate">Đang Quét Toàn Bộ</span>
                </div>
                <div className="text-base font-black text-blue-400 font-mono mt-0.5">
                  {symbols.length} Mã
                </div>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="p-3 bg-[#0d131f] border-b border-[#1a2536] flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
              <div className="flex gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'vn_all', label: '🇻🇳 Toàn Sàn VN' },
                  { id: 'vn30', label: '🇻🇳 VN30' },
                  { id: 'commodity', label: '🥇 Vàng & Dầu' },
                  { id: 'crypto', label: '🪙 Crypto' },
                  { id: 'stock', label: '🇺🇸 Cổ phiếu Mỹ' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategory(cat.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition ${
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
                  placeholder="Tìm mã, tên hoặc ngành VN..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#151e2c] border border-[#233044] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Scanned Accumulation List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#172130] p-2 sm:p-3 space-y-2">
              {filteredList.map((item, index) => {
                const symObj = symbols.find(s => s.symbol === item.symbol);
                const isVND =
                  item.type === 'vn30' || item.symbol === 'VNINDEX' || symObj?.quoteAsset === 'VND';
                const isVnIdxOrDeriv =
                  item.symbol === 'VNINDEX' ||
                  item.symbol === 'VN30' ||
                  isVnDerivativeSymbol(item.symbol);
                const prefix = isVND ? '' : '$';
                const priceSuffix = isVND ? (isVnIdxOrDeriv ? ' đ' : 'k') : '';

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
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                          index < 3
                            ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                            : 'bg-[#1a2538] text-gray-300'
                        }`}
                      >
                        #{index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-sm sm:text-base text-white shrink-0">
                            {item.symbol}
                          </span>
                          <span className="text-xs text-gray-400 font-medium truncate max-w-[200px]">
                            {item.name}
                          </span>
                          {item.vnSectorName && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 shrink-0 whitespace-nowrap">
                              {item.vnSectorName}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase shrink-0 whitespace-nowrap ${
                              item.status === 'HOT_BUY'
                                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                                : item.status === 'GOOD_DCA'
                                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {item.statusLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 font-mono font-bold shrink-0 whitespace-nowrap">
                            🤖 Kronos 24N:{' '}
                            {item.kronosForecastPct >= 0
                              ? `+${item.kronosForecastPct}%`
                              : `${item.kronosForecastPct}%`}{' '}
                            ({item.kronosBullProb}% Bull)
                          </span>
                          {item.peRatio != null && item.peRatio > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-500/35 font-mono font-bold shrink-0 whitespace-nowrap">
                              P/E {item.peRatio}x
                              {item.roePct != null ? ` • ROE ${item.roePct}%` : ''}
                            </span>
                          )}
                          {item.foreignNetBillion != null && item.foreignNetBillion !== 0 && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 whitespace-nowrap border ${
                                item.foreignNetBillion > 0
                                  ? 'bg-teal-950/50 text-teal-300 border-teal-500/35'
                                  : 'bg-rose-950/50 text-rose-300 border-rose-500/35'
                              }`}
                            >
                              Khối ngoại: {item.foreignNetBillion > 0 ? '+' : ''}
                              {item.foreignNetBillion} tỷ
                            </span>
                          )}
                          {item.reasons.map((r, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-[#162130] text-gray-300 border border-[#24334a] break-words"
                            >
                              ✓ {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-800">
                      <div className="text-left sm:text-right">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase">
                          Vùng Gom Khuyến Nghị
                        </div>
                        <div className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
                          {prefix}
                          {formatPrice(item.entryZone[0])} - {prefix}
                          {formatPrice(item.entryZone[1])}
                          {priceSuffix}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          Hiện tại: {prefix}
                          {formatPrice(item.currentPrice)}
                          {priceSuffix} • Target: +
                          {(
                            ((item.targetTakeProfit - item.currentPrice) / item.currentPrice) *
                            100
                          ).toFixed(0)}
                          %
                        </div>
                      </div>

                      <div className="text-center px-2 py-1 rounded-lg bg-[#162132] border border-[#25364e]">
                        <div className="text-[9px] text-gray-400 font-bold uppercase">Điểm Gom</div>
                        <div
                          className={`text-base font-mono font-black ${
                            item.score >= 78
                              ? 'text-amber-400'
                              : item.score >= 64
                                ? 'text-emerald-400'
                                : 'text-gray-300'
                          }`}
                        >
                          {item.score}
                        </div>
                      </div>

                      <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-blue-500/20 shrink-0">
                        <span>Vào Lệnh</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* VN-Index Market Regime / Follow-Through Day Banner */}
            <div className="px-3.5 sm:px-4 py-2.5 bg-[#0e1524] border-b border-[#1b273a] space-y-2 shrink-0">
              <div
                className={`p-2.5 rounded-xl border space-y-1 ${
                  vnMomentum.marketRegime === 'FTD_CONFIRMED'
                    ? 'bg-emerald-950/35 border-emerald-500/45'
                    : vnMomentum.marketRegime === 'UPTREND_ROTATION'
                      ? 'bg-cyan-950/30 border-cyan-500/40'
                      : vnMomentum.marketRegime === 'CORRECTION_DEFENSE'
                        ? 'bg-rose-950/35 border-rose-500/45'
                        : 'bg-[#121c2e] border-slate-700/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-white break-words">
                    {vnMomentum.marketRegimeLabelVi}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#090f1b] text-cyan-300 border border-slate-700 shrink-0 whitespace-nowrap">
                    VN-INDEX: {formatPrice(vnMomentum.vnIndexPrice)} đ (
                    {vnMomentum.vnIndexChangePct >= 0 ? '+' : ''}
                    {vnMomentum.vnIndexChangePct}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed break-words">
                  {vnMomentum.marketGuidanceVi}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-[#131d2d] border border-fuchsia-500/25">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center justify-center gap-1">
                    <Rocket className="w-3 h-3 text-fuchsia-400 shrink-0" />
                    <span className="truncate">Bứt Phá Dẫn Sóng</span>
                  </div>
                  <div className="text-base font-black text-fuchsia-300 font-mono mt-0.5">
                    {vnMomentum.breakoutCount} Mã
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-[#131d2d] border border-cyan-500/25">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center justify-center gap-1">
                    <Gem className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">Nền Siết Biên VCP</span>
                  </div>
                  <div className="text-base font-black text-cyan-300 font-mono mt-0.5">
                    {vnMomentum.vcpCount} Mã
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-[#131d2d] border border-emerald-500/25">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center justify-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate">Tổng Quét Sàn VN</span>
                  </div>
                  <div className="text-base font-black text-emerald-300 font-mono mt-0.5">
                    {vnMomentum.candidates.length} Mã
                  </div>
                </div>
              </div>
            </div>

            {/* VN Momentum Filters & Search */}
            <div className="p-3 bg-[#0d131f] border-b border-[#1a2536] flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
              <div className="flex gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
                {[
                  { id: 'all', label: 'Tất cả Sàn VN' },
                  { id: 'BREAKOUT_LEADER', label: '🚀 Bứt Phá Dẫn Sóng' },
                  { id: 'VCP_TIGHT_BASE', label: '💎 Nền Siết VCP' },
                  { id: 'POCKET_PIVOT', label: '⚡ Pocket Pivot' },
                  { id: 'high_rs', label: '🔥 RS ≥ 80' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setVnSetupFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                      vnSetupFilter === tab.id
                        ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-500/20'
                        : 'bg-[#151e2c] text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm mã, ngành, sàn HOSE/HNX..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#151e2c] border border-[#233044] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500"
                />
              </div>
            </div>

            {/* Ranked VN Momentum / VCP List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#172130] p-2 sm:p-3 space-y-2">
              {filteredVnMomentum.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 rounded-xl bg-[#101826] border border-slate-800">
                  Chưa có mã cổ phiếu Việt Nam nào khớp bộ lọc hiện tại. Hãy chọn &quot;Tất cả Sàn VN&quot; để xem bảng xếp hạng RS toàn thị trường.
                </div>
              ) : (
                filteredVnMomentum.map((c, idx) => {
                  const symObj = symbols.find(s => s.symbol.toUpperCase() === c.symbol);
                  const isBreakout = c.setupType === 'BREAKOUT_LEADER';
                  const isVcp = c.setupType === 'VCP_TIGHT_BASE';
                  const isPocket = c.setupType === 'POCKET_PIVOT';

                  return (
                    <div
                      key={c.symbol}
                      onClick={() => {
                        if (symObj) {
                          onSelectSymbol(symObj);
                          onClose();
                        }
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isBreakout
                          ? 'bg-fuchsia-950/20 border-fuchsia-500/45 hover:bg-fuchsia-950/30'
                          : isVcp
                            ? 'bg-cyan-950/20 border-cyan-500/40 hover:bg-cyan-950/30'
                            : isPocket
                              ? 'bg-emerald-950/20 border-emerald-500/35 hover:bg-emerald-950/30'
                              : 'bg-[#111824] border-[#1d293b] hover:bg-[#162030]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                            idx < 3
                              ? 'bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/30'
                              : 'bg-[#1a2538] text-gray-300'
                          }`}
                        >
                          #{idx + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm sm:text-base text-white shrink-0">
                              {c.symbol}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 shrink-0 whitespace-nowrap">
                              {c.board}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 shrink-0 whitespace-nowrap">
                              {c.sectorName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 whitespace-nowrap ${
                                isBreakout
                                  ? 'bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/50'
                                  : isVcp
                                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
                                    : isPocket
                                      ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50'
                                      : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {c.setupLabelVi}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 whitespace-nowrap border ${
                                c.rsRating >= 80
                                  ? 'bg-fuchsia-950/60 text-fuchsia-200 border-fuchsia-500/45'
                                  : 'bg-slate-900 text-cyan-300 border-slate-700'
                              }`}
                            >
                              RS {c.rsRating}/99 ({c.rsSpreadVsVnIndex >= 0 ? '+' : ''}
                              {c.rsSpreadVsVnIndex}% vs VNI)
                            </span>

                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#141f30] text-slate-300 border border-slate-700/80 font-mono shrink-0 whitespace-nowrap">
                              24h: {c.change24h >= 0 ? '+' : ''}
                              {c.change24h}% • Biên {c.intradayRangePct}%
                            </span>

                            {c.roePct != null && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-500/35 font-mono font-bold shrink-0 whitespace-nowrap">
                                ROE {c.roePct}%{c.peRatio != null ? ` • P/E ${c.peRatio}x` : ''}
                              </span>
                            )}

                            {c.foreignNet10dBillion != null && c.foreignNet10dBillion !== 0 && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 whitespace-nowrap border ${
                                  c.foreignNet10dBillion > 0
                                    ? 'bg-teal-950/50 text-teal-300 border-teal-500/35'
                                    : 'bg-rose-950/50 text-rose-300 border-rose-500/35'
                                }`}
                              >
                                Ngoại 10P: {c.foreignNet10dBillion > 0 ? '+' : ''}
                                {c.foreignNet10dBillion} tỷ
                              </span>
                            )}

                            {c.catalysts.map((cat, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-[#162130] text-gray-300 border border-[#24334a] break-words"
                              >
                                ✓ {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-800">
                        <div className="text-left sm:text-right font-mono">
                          <div className="text-[10px] text-slate-400 font-sans font-semibold uppercase">
                            Điểm Mua Pivot Chuẩn Bước Giá
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-fuchsia-300">
                            Pivot: {formatPrice(c.pivotBuyPrice)}k
                          </div>
                          <div className="text-[10px] text-slate-400">
                            SL -6%: <span className="text-rose-400">{formatPrice(c.stopLossPrice)}k</span> •
                            TP +18%:{' '}
                            <span className="text-emerald-400">{formatPrice(c.targetProfitPrice)}k</span>
                          </div>
                        </div>

                        <div className="text-center px-2 py-1 rounded-lg bg-[#162132] border border-[#25364e]">
                          <div className="text-[9px] text-gray-400 font-bold uppercase">Điểm Sóng</div>
                          <div
                            className={`text-base font-mono font-black ${
                              c.momentumScore >= 75
                                ? 'text-fuchsia-300'
                                : c.momentumScore >= 62
                                  ? 'text-cyan-300'
                                  : 'text-gray-300'
                            }`}
                          >
                            {c.momentumScore}
                          </div>
                        </div>

                        <button className="px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-fuchsia-500/20 shrink-0">
                          <span>Soi Đồ Thị</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
