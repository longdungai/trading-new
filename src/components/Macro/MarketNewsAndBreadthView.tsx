import React, { useEffect, useMemo, useState } from 'react';
import { MarketSymbol } from '../../types';
import {
  computeMarketBreadthSnapshot,
  fetchLiveMarketNews,
  MarketNewsArticle,
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
  const [regionFilter, setRegionFilter] = useState<'ALL' | 'VN' | 'GLOBAL' | 'CRYPTO' | 'CURRENT'>('ALL');

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

  const filteredArticles = useMemo(() => {
    if (regionFilter === 'ALL') return articles;
    if (regionFilter === 'CURRENT') {
      const symUpper = currentSymbol.symbol.toUpperCase();
      return articles.filter(
        a =>
          a.assetTags.some(t => symUpper.includes(t) || t.includes(symUpper)) ||
          (currentSymbol.quoteAsset === 'VND' && a.region === 'VN')
      );
    }
    return articles.filter(a => a.region === regionFilter);
  }, [articles, regionFilter, currentSymbol]);

  const handleJumpTicker = (ticker: string) => {
    const found = symbols.find(s => s.symbol.toUpperCase() === ticker.toUpperCase());
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
              {seg.topGainers.slice(0, 3).map(g => (
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
              {seg.topLagging.slice(0, 3).map(l => (
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
                Trạm Tin Nóng Tài Chính & Vĩ Mô Thời Gian Thực
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

          <div className="flex items-center gap-1.5 flex-wrap max-w-full">
            <div className="flex items-center gap-1 flex-wrap bg-[#0b111d] p-1 rounded-xl border border-slate-800 text-[11px]">
              <Filter className="w-3 h-3 text-slate-400 ml-1 shrink-0" />
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'VN', label: 'Việt Nam' },
                { id: 'GLOBAL', label: 'Fed & Quốc tế' },
                { id: 'CRYPTO', label: 'Crypto' },
                { id: 'CURRENT', label: `Theo ${currentSymbol.symbol}` },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRegionFilter(tab.id as any)}
                  className={`px-2 py-0.5 rounded-lg font-semibold whitespace-nowrap transition ${
                    regionFilter === tab.id
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
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

        {loadingNews && articles.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#0b111d] border border-slate-800 text-center text-xs text-slate-400 font-mono leading-relaxed">
            Đang tải luồng tin tức thời gian thực từ Federal Reserve, CNBC, Yahoo Finance & VnExpress...
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#0b111d] border border-slate-800 text-center text-xs text-slate-400 leading-relaxed">
            Chưa có bài báo khớp bộ lọc này. Hãy chuyển sang tab &ldquo;Tất cả&rdquo; để xem toàn bộ luồng tin mới nhất.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredArticles.map(art => {
              const ageMin = Math.max(1, Math.round((Date.now() - art.publishedAtMs) / 60000));
              const ageLabel =
                ageMin < 60
                  ? `${ageMin} phút trước`
                  : ageMin < 1440
                  ? `${Math.floor(ageMin / 60)} giờ trước`
                  : `${Math.floor(ageMin / 1440)} ngày trước`;

              return (
                <a
                  key={art.id}
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-[#0c1322] hover:bg-[#111b30] border border-slate-800/90 hover:border-cyan-500/40 transition flex flex-col justify-between gap-2 min-w-0 overflow-hidden group"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono mb-1">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold break-words">
                        {art.source}
                      </span>
                      <span className="text-slate-400 flex items-center gap-1 whitespace-nowrap shrink-0">
                        {ageLabel}
                        <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-100 group-hover:text-cyan-200 leading-snug line-clamp-2 break-words">
                      {art.title}
                    </h4>

                    {art.summary && (
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed break-words">
                        {art.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      {art.assetTags.map(tag => (
                        <span
                          key={tag}
                          onClick={e => {
                            const match = symbols.find(s => s.symbol === tag);
                            if (match) {
                              e.preventDefault();
                              onSelectSymbol(match);
                              onClose();
                            }
                          }}
                          className="px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[9.5px] font-mono font-bold hover:bg-indigo-500/30 leading-none whitespace-nowrap"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {art.sentimentHint !== 'NEUTRAL' && (
                      <span
                        className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded leading-none whitespace-nowrap shrink-0 ${
                          art.sentimentHint === 'BULLISH'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {art.sentimentHint === 'BULLISH' ? 'Tích cực' : 'Thận trọng'}
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
