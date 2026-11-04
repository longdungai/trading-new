import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MarketSymbol } from '../../types';
import {
  computeMarketBreadthSnapshot,
  computeNewsFilterCounts,
  fetchLiveMarketNews,
  filterMarketNewsArticles,
  MarketNewsArticle,
  NewsRegionFilter,
  NewsSentimentFilter,
  SegmentBreadthMetrics,
} from '../../services/market/marketBreadthAndNews';
import { formatPercent } from '../../utils/formatters';
import {
  Newspaper,
  Activity,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  X,
  ArrowUpRight,
} from 'lucide-react';

interface MarketNewsAndBreadthViewProps {
  symbols: MarketSymbol[];
  currentSymbol: MarketSymbol;
  onSelectSymbol: (sym: MarketSymbol) => void;
  onClose: () => void;
}

export const MarketNewsAndBreadthView: React.FC<MarketNewsAndBreadthViewProps> = ({
  symbols,
  currentSymbol,
  onSelectSymbol,
  onClose,
}) => {
  const [articles, setArticles] = useState<MarketNewsArticle[]>([]);
  const [activeSources, setActiveSources] = useState<string[]>([]);
  const [loadingNews, setLoadingNews] = useState<boolean>(true);
  const [regionFilter, setRegionFilter] = useState<NewsRegionFilter>('ALL');
  const [sentimentFilter, setSentimentFilter] = useState<NewsSentimentFilter>('ALL');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  const breadth = useMemo(() => computeMarketBreadthSnapshot(symbols), [symbols]);

  const loadNews = async (force: boolean = false) => {
    setLoadingNews(true);
    try {
      const res = await fetchLiveMarketNews(force);
      setArticles(res.items);
      setActiveSources(res.activeSources);
    } finally {
      setLoadingNews(false);
    }
  };

  useEffect(() => {
    void loadNews(false);
  }, []);

  // Reset scroll to top whenever any filter changes so the user immediately sees the new filtered results
  useEffect(() => {
    if (listScrollRef.current) {
      listScrollRef.current.scrollTop = 0;
    }
  }, [regionFilter, sentimentFilter, tagFilter, searchQuery, currentSymbol.symbol]);

  const filterCounts = useMemo(
    () => computeNewsFilterCounts(articles, currentSymbol),
    [articles, currentSymbol]
  );

  const filteredArticles = useMemo(
    () =>
      filterMarketNewsArticles({
        articles,
        regionFilter,
        currentSymbol,
        sentimentFilter,
        tagFilter,
        searchQuery,
      }),
    [articles, regionFilter, currentSymbol, sentimentFilter, tagFilter, searchQuery]
  );

  const hasActiveSubFilters =
    regionFilter !== 'ALL' ||
    sentimentFilter !== 'ALL' ||
    Boolean(tagFilter) ||
    Boolean(searchQuery.trim());

  const handleResetAllFilters = () => {
    setRegionFilter('ALL');
    setSentimentFilter('ALL');
    setTagFilter(null);
    setSearchQuery('');
  };

  const handleJumpTicker = (ticker: string) => {
    const normalized = ticker.toUpperCase() === 'USOIL' ? 'OIL_WTI' : ticker.toUpperCase();
    const found = symbols.find((s) => s.symbol.toUpperCase() === normalized);
    if (found) {
      onSelectSymbol(found);
      onClose();
    }
  };

  const renderSegmentCard = (seg: SegmentBreadthMetrics) => {
    const regimeColors: Record<SegmentBreadthMetrics['breadthRegime'], string> = {
      BROAD_THRUST: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      HEALTHY_BULL: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      GREEN_OUTSIDE_RED_INSIDE: 'bg-amber-500/20 text-amber-200 border-amber-500/50',
      MIXED_ROTATION: 'bg-slate-800 text-slate-300 border-slate-700',
      BROAD_SELL_OFF: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    };

    const advWidth = seg.totalTracked > 0 ? (seg.advancers / seg.totalTracked) * 100 : 0;
    const decWidth = seg.totalTracked > 0 ? (seg.decliners / seg.totalTracked) * 100 : 0;

    return (
      <div
        key={seg.segmentId}
        className="p-3.5 rounded-xl bg-[#0c1322] border border-slate-800/90 flex flex-col justify-between gap-2.5 min-w-0 overflow-hidden"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-tight leading-snug break-words min-w-0">
              {seg.segmentName}
            </h4>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0 ${regimeColors[seg.breadthRegime]}`}
            >
              {seg.breadthRegimeLabel}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed mb-2.5 break-words">
            {seg.breadthDiagnostic}
          </p>

          {/* Advance / Unchanged / Decline Bar */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10.5px] font-mono">
              <span className="text-emerald-400 font-bold whitespace-nowrap">
                ▲ Tăng: {seg.advancers}
              </span>
              <span className="text-slate-400 whitespace-nowrap">
                Tham chiếu: {seg.unchanged}
              </span>
              <span className="text-rose-400 font-bold whitespace-nowrap">
                ▼ Giảm: {seg.decliners}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden flex">
              <div style={{ width: `${advWidth}%` }} className="bg-emerald-500 h-full transition-all" />
              <div
                style={{ width: `${Math.max(0, 100 - advWidth - decWidth)}%` }}
                className="bg-amber-400/60 h-full transition-all"
              />
              <div style={{ width: `${decWidth}%` }} className="bg-rose-500 h-full transition-all" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] text-slate-400 font-mono pt-0.5">
              <span className="whitespace-nowrap">Độ rộng xanh: {seg.advancePct}%</span>
              <span className="whitespace-nowrap">
                Giữ nửa trên biên phiên: {seg.strongAboveMidRangePct}%
              </span>
            </div>
          </div>
        </div>

        {/* Top Leaders & Laggards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[10.5px] font-mono">
          <div className="min-w-0">
            <div className="text-[9.5px] text-emerald-400 font-sans font-bold uppercase mb-1 flex items-center gap-1 whitespace-nowrap">
              <TrendingUp className="w-3 h-3 shrink-0" /> Dẫn sóng
            </div>
            <div className="space-y-1">
              {seg.topGainers.slice(0, 3).map((g) => (
                <button
                  key={g.symbol}
                  type="button"
                  onClick={() => handleJumpTicker(g.symbol)}
                  className="w-full flex items-center justify-between gap-1.5 px-1.5 py-0.5 rounded bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-500/20 text-left min-w-0 transition"
                >
                  <span className="font-bold text-white truncate">{g.symbol}</span>
                  <span className="text-emerald-400 whitespace-nowrap shrink-0">
                    {formatPercent(g.change24h)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-[9.5px] text-rose-400 font-sans font-bold uppercase mb-1 flex items-center gap-1 whitespace-nowrap">
              <TrendingDown className="w-3 h-3 shrink-0" /> Suy yếu
            </div>
            <div className="space-y-1">
              {seg.topLagging.slice(0, 3).map((l) => (
                <button
                  key={l.symbol}
                  type="button"
                  onClick={() => handleJumpTicker(l.symbol)}
                  className="w-full flex items-center justify-between gap-1.5 px-1.5 py-0.5 rounded bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/20 text-left min-w-0 transition"
                >
                  <span className="font-bold text-white truncate">{l.symbol}</span>
                  <span className="text-rose-400 whitespace-nowrap shrink-0">
                    {formatPercent(l.change24h)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const regionTabs: Array<{ id: NewsRegionFilter; label: string; count: number }> = [
    { id: 'ALL', label: 'Tất cả', count: filterCounts.ALL },
    { id: 'VN', label: '🇻🇳 Việt Nam', count: filterCounts.VN },
    { id: 'GLOBAL', label: '🌎 Fed & Quốc tế', count: filterCounts.GLOBAL },
    { id: 'CRYPTO', label: '🪙 Crypto', count: filterCounts.CRYPTO },
    {
      id: 'CURRENT',
      label: `🎯 Theo ${currentSymbol.symbol}`,
      count: filterCounts.CURRENT,
    },
  ];

  return (
    <div className="space-y-5 overflow-x-hidden">
      {/* Section 1: Cross-Market & VN30 Internal Breadth */}
      <section className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wide font-mono leading-snug break-words">
              Độ Rộng Nội Tại Thị Trường (VN30 • Crypto • Quốc Tế)
            </h3>
          </div>
          <span className="text-[10.5px] text-slate-400 font-mono break-words">
            Nhận diện lan tỏa dòng tiền thật vs &ldquo;Xanh vỏ đỏ lòng&rdquo;
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {renderSegmentCard(breadth.vnMarket)}
          {renderSegmentCard(breadth.cryptoMarket)}
          {renderSegmentCard(breadth.globalMarket)}
        </div>
      </section>

      {/* Section 2: Real-Time Verified Financial News Stream */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-start lg:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <Newspaper className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wide font-mono leading-snug break-words">
                Trạm Tin Nóng Tài Chính &amp; Vĩ Mô Thời Gian Thực
              </h3>
              <p className="text-[10.5px] text-slate-400 leading-relaxed break-words">
                Nguồn RSS chính thống trực tiếp (
                {activeSources.length > 0
                  ? activeSources.join(' • ')
                  : 'Fed • CNBC • Yahoo • CoinDesk • VnExpress'}
                ) — 100% link bài gốc xác thực
              </p>
            </div>
          </div>

          {/* Primary Region / Symbol Filter Bar */}
          <div className="flex items-center gap-1.5 flex-wrap max-w-full">
            <div className="flex items-center gap-1 flex-wrap bg-[#0b111d] p-1 rounded-xl border border-slate-800 text-[11px]">
              <Filter className="w-3 h-3 text-cyan-400 ml-1 shrink-0" />
              {regionTabs.map((tab) => {
                const isActive = regionFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setRegionFilter(tab.id);
                      if (tab.id !== 'ALL') {
                        setTagFilter(null);
                      }
                    }}
                    className={`px-2 py-1 rounded-lg font-bold whitespace-nowrap transition flex items-center gap-1 ${
                      isActive
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1 py-0.2 rounded text-[9.5px] font-mono ${
                        isActive ? 'bg-black/30 text-cyan-100' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void loadNews(true)}
              disabled={loadingNews}
              className="px-2.5 py-1.5 rounded-xl bg-[#111b2e] hover:bg-[#182640] border border-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${loadingNews ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Secondary Filter Bar: Keyword Search + Sentiment Filter + Active Tag Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-[#090f1c] border border-slate-800/90 text-[11px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm từ khóa: lãi suất, vàng, khối ngoại, ETF, FPT, BTC..."
              className="w-full pl-8 pr-7 py-1 rounded-lg bg-[#0e1628] border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                title="Xóa từ khóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sentiment Filter Pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {(
              [
                { id: 'ALL', label: 'Mọi sắc thái' },
                { id: 'BULLISH', label: '🟢 Tích cực' },
                { id: 'BEARISH', label: '🔴 Thận trọng' },
              ] as Array<{ id: NewsSentimentFilter; label: string }>
            ).map((sTab) => (
              <button
                key={sTab.id}
                type="button"
                onClick={() => setSentimentFilter(sTab.id)}
                className={`px-2 py-1 rounded-lg font-semibold whitespace-nowrap transition text-[10.5px] ${
                  sentimentFilter === sTab.id
                    ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/50'
                    : 'bg-[#0e1628] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {sTab.label}
              </button>
            ))}

            {tagFilter && (
              <button
                type="button"
                onClick={() => setTagFilter(null)}
                className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-200 font-mono text-[10.5px] font-bold flex items-center gap-1"
                title="Bỏ lọc theo nhãn này"
              >
                <span>Đang lọc: #{tagFilter}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {hasActiveSubFilters && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-semibold transition"
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Status Line */}
        <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-400 px-1">
          <span>
            Hiển thị <strong className="text-cyan-300">{filteredArticles.length}</strong> /{' '}
            {articles.length} tin tức xác thực
            {regionFilter === 'CURRENT' && (
              <span className="text-amber-300">
                {' '}
                • Liên quan trực tiếp &amp; vĩ mô ngành của <strong>{currentSymbol.symbol}</strong>
              </span>
            )}
          </span>
          <span>Nhấp vào #Tag để lọc nhanh theo chủ đề</span>
        </div>

        {loadingNews && articles.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#0b111d] border border-slate-800 text-center text-xs text-slate-400 font-mono leading-relaxed">
            Đang tải luồng tin tức thời gian thực từ Federal Reserve, CNBC, Yahoo Finance, CoinDesk &amp; VnExpress...
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#0b111d] border border-slate-800 text-center text-xs text-slate-300 space-y-2 leading-relaxed">
            <div>Không tìm thấy bài báo nào khớp tổ hợp bộ lọc hiện tại.</div>
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition"
            >
              Xem tất cả ({articles.length} bài viết)
            </button>
          </div>
        ) : (
          <div
            ref={listScrollRef}
            className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1"
          >
            {filteredArticles.map((art) => {
              const ageMin = Math.max(1, Math.round((Date.now() - art.publishedAtMs) / 60000));
              const ageLabel =
                ageMin < 60
                  ? `${ageMin} phút trước`
                  : ageMin < 1440
                  ? `${Math.floor(ageMin / 60)} giờ trước`
                  : `${Math.floor(ageMin / 1440)} ngày trước`;

              const regionBadge =
                art.region === 'VN'
                  ? '🇻🇳 VN'
                  : art.region === 'CRYPTO'
                  ? '🪙 CRYPTO'
                  : '🌎 QUỐC TẾ';

              return (
                <div
                  key={art.id}
                  className="p-3 rounded-xl bg-[#0c1322] hover:bg-[#111b30] border border-slate-800/90 hover:border-cyan-500/40 transition flex flex-col justify-between gap-2 min-w-0 overflow-hidden group"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold break-words">
                          {art.source}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-slate-300 text-[9px]">
                          {regionBadge}
                        </span>
                      </div>
                      <a
                        href={art.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-cyan-300 flex items-center gap-1 whitespace-nowrap shrink-0"
                        title="Mở bài báo gốc"
                      >
                        <span>{ageLabel}</span>
                        <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                      </a>
                    </div>

                    <a
                      href={art.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <h4 className="text-xs font-bold text-slate-100 group-hover:text-cyan-200 leading-snug line-clamp-2 break-words">
                        {art.title}
                      </h4>

                      {art.summary && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed break-words">
                          {art.summary}
                        </p>
                      )}
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      {art.assetTags.map((tag) => {
                        const normalized =
                          tag.toUpperCase() === 'USOIL' ? 'OIL_WTI' : tag.toUpperCase();
                        const matchSym = symbols.find(
                          (s) => s.symbol.toUpperCase() === normalized
                        );
                        const isTagSelected = tagFilter === tag;

                        return (
                          <div key={tag} className="inline-flex items-center">
                            <button
                              type="button"
                              onClick={() =>
                                setTagFilter((prev) => (prev === tag ? null : tag))
                              }
                              title={`Lọc tin tức theo #${tag}`}
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold leading-none whitespace-nowrap border transition ${
                                isTagSelected
                                  ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                                  : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30'
                              }`}
                            >
                              #{tag}
                            </button>
                            {matchSym && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSymbol(matchSym);
                                  onClose();
                                }}
                                title={`Mở biểu đồ ${matchSym.symbol}`}
                                className="ml-0.5 p-0.5 rounded bg-slate-800/90 hover:bg-cyan-500/25 text-slate-400 hover:text-cyan-300 transition"
                              >
                                <ArrowUpRight className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {art.sentimentHint !== 'NEUTRAL' && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetSent = art.sentimentHint as NewsSentimentFilter;
                          setSentimentFilter((prev) => (prev === targetSent ? 'ALL' : targetSent));
                        }}
                        className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded leading-none whitespace-nowrap shrink-0 transition ${
                          art.sentimentHint === 'BULLISH'
                            ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300'
                            : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300'
                        }`}
                      >
                        {art.sentimentHint === 'BULLISH' ? 'Tích cực' : 'Thận trọng'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
