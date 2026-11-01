import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Building2,
  Clock,
  Compass,
  Flame,
  Layers,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Candle, MarketSymbol } from '../../types';
import {
  computeVn30BasisAnalytics,
  computeVnIntradaySessionPulse,
  computeVnSectorRotation,
  getVnExchangeBoard,
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
} from '../../services/vnMarket/vnStockMicrostructure';
import {
  fetchVnStockInsights,
  VnStockInsightsPayload,
} from '../../services/vnMarket/vnStockInsightsClient';
import { formatPercent, formatPrice } from '../../utils/formatters';

interface VnMarketIntelligenceViewProps {
  symbols: MarketSymbol[];
  currentSymbol: MarketSymbol;
  activeCandles?: Candle[];
  onSelectSymbol: (sym: MarketSymbol) => void;
  onClose: () => void;
}

const POPULAR_VN_INSPECT_TICKERS = [
  'FPT',
  'HPG',
  'VCB',
  'SSI',
  'MWG',
  'STB',
  'TCB',
  'DGC',
  'KBC',
  'GMD',
  'PVS',
  'VHM',
];

export const VnMarketIntelligenceView: React.FC<VnMarketIntelligenceViewProps> = ({
  symbols,
  currentSymbol,
  activeCandles = [],
  onSelectSymbol,
  onClose,
}) => {
  const defaultCorpTicker = useMemo(() => {
    const up = currentSymbol.symbol.toUpperCase();
    if (
      isVnStockOrIndexSymbol(currentSymbol) &&
      !isVnDerivativeSymbol(up) &&
      up !== 'VNINDEX' &&
      up !== 'VN30'
    ) {
      return up;
    }
    return 'FPT';
  }, [currentSymbol]);

  const [inspectedTicker, setInspectedTicker] = useState<string>(defaultCorpTicker);
  const [insights, setInsights] = useState<VnStockInsightsPayload | null>(null);
  const [loadingInsights, setLoadingInsights] = useState<boolean>(false);
  const [nowClock, setNowClock] = useState<Date>(() => new Date());

  useEffect(() => {
    setInspectedTicker(defaultCorpTicker);
  }, [defaultCorpTicker]);

  useEffect(() => {
    const timer = setInterval(() => setNowClock(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const loadInsights = async (sym: string, force = false) => {
    setLoadingInsights(true);
    try {
      const res = await fetchVnStockInsights(sym, force);
      setInsights(res);
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    void loadInsights(inspectedTicker, false);
  }, [inspectedTicker]);

  const basisData = useMemo(
    () => computeVn30BasisAnalytics(symbols, nowClock),
    [symbols, nowClock]
  );

  const sessionPulse = useMemo(
    () =>
      computeVnIntradaySessionPulse(
        isVnStockOrIndexSymbol(currentSymbol) ? activeCandles : [],
        nowClock
      ),
    [currentSymbol, activeCandles, nowClock]
  );

  const sectorRotation = useMemo(() => computeVnSectorRotation(symbols), [symbols]);

  const jumpToChart = (ticker: string) => {
    const found = symbols.find((s) => s.symbol.toUpperCase() === ticker.toUpperCase());
    if (found) {
      onSelectSymbol(found);
      onClose();
    }
  };

  const vnIndexSym = symbols.find((s) => s.symbol.toUpperCase() === 'VNINDEX');
  const vn30Sym = symbols.find((s) => s.symbol.toUpperCase() === 'VN30');
  const vn30fSym = symbols.find((s) => s.symbol.toUpperCase() === 'VN30F1M');

  const foreignFlow = insights?.foreignFlow ?? null;
  const fundamentals = insights?.fundamentals ?? null;
  const topBuy = insights?.marketLeaders?.topBuy ?? [];
  const topSell = insights?.marketLeaders?.topSell ?? [];

  return (
    <div className="space-y-4 min-w-0">
      {/* SECTION 1: VN30F1M DERIVATIVE BASIS & INTRADAY HOSE/HNX SESSION CLOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-w-0">
        {/* Left 7 cols: VN30F1M vs VN30 Basis Monitor */}
        <div className="lg:col-span-7 p-3.5 rounded-xl bg-[#0d1525] border border-cyan-500/30 space-y-3 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Scale className="w-4 h-4 text-cyan-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white break-words">
                  Phái Sinh VN30F1M & Độ Lệch Basis (VN30F1M − VN30)
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed break-words">
                Dữ liệu khớp lệnh trực tiếp từ Sở GDCK Hà Nội (HNX Derivatives / DNSE Entrade)
              </p>
            </div>

            {basisData && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shrink-0 whitespace-nowrap ${
                  basisData.isExpiryWeek
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/50 animate-pulse'
                    : basisData.basisPoints >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                Đáo hạn: {basisData.expiryDateISO} (còn {basisData.daysToExpiry} ngày)
              </span>
            )}
          </div>

          {/* 3 Benchmark Index Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
            {[
              { label: 'VN-INDEX (HOSE)', sym: vnIndexSym, ticker: 'VNINDEX' },
              { label: 'VN30 CƠ SỞ', sym: vn30Sym, ticker: 'VN30' },
              { label: 'PHÁI SINH VN30F1M', sym: vn30fSym, ticker: 'VN30F1M' },
            ].map((b) => {
              const up = (b.sym?.change24h ?? 0) >= 0;
              return (
                <button
                  key={b.ticker}
                  type="button"
                  onClick={() => jumpToChart(b.ticker)}
                  className="p-2.5 rounded-xl bg-[#09101d] hover:bg-[#111c33] border border-slate-800 hover:border-cyan-500/50 text-left transition min-w-0"
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-sans font-bold">
                    <span className="truncate">{b.label}</span>
                    <ArrowUpRight className="w-3 h-3 text-cyan-400 shrink-0" />
                  </div>
                  <div className="text-sm sm:text-base font-black text-white mt-1 truncate">
                    {b.sym ? `${formatPrice(b.sym.price)} đ` : '—'}
                  </div>
                  <div
                    className={`text-[11px] font-bold mt-0.5 ${
                      up ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {b.sym ? formatPercent(b.sym.change24h) : '—'}
                  </div>
                </button>
              );
            })}
          </div>

          {basisData && (
            <div
              className={`p-2.5 rounded-xl border space-y-1 min-w-0 ${
                basisData.isExpiryWeek
                  ? 'bg-amber-950/30 border-amber-500/40'
                  : basisData.basisPoints >= 1.2
                  ? 'bg-emerald-950/25 border-emerald-500/35'
                  : basisData.basisPoints <= -1.5
                  ? 'bg-rose-950/25 border-rose-500/35'
                  : 'bg-[#09101d] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-white break-words">
                  {basisData.headline}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900/90 text-cyan-300 border border-slate-700 shrink-0 whitespace-nowrap">
                  {basisData.regimeLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed break-words">
                {basisData.guidance}
              </p>
            </div>
          )}
        </div>

        {/* Right 5 cols: Granular VN Intraday Session Clock & T+2 Settlement */}
        <div className="lg:col-span-5 p-3.5 rounded-xl bg-[#0d1525] border border-slate-800 space-y-3 min-w-0 flex flex-col justify-between">
          <div className="space-y-2.5 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white break-words">
                  Nhịp Phiên Nội Ngày & Chu Kỳ T+2
                </h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shrink-0 whitespace-nowrap ${
                  sessionPulse.phase === 'ATC'
                    ? 'bg-rose-500/25 text-rose-200 border-rose-400/50 animate-pulse'
                    : sessionPulse.phase === 'ATO' ||
                      sessionPulse.phase === 'MORNING_CONTINUOUS' ||
                      sessionPulse.phase === 'AFTERNOON_CONTINUOUS'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {sessionPulse.phase}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#09101d] border border-slate-800/90 space-y-1">
              <div className="text-xs font-bold text-cyan-300 break-words">
                {sessionPulse.phaseLabel}
              </div>
              <div className="text-[11px] font-mono text-slate-300 break-words">
                ⏱ {sessionPulse.countdownLabel}
              </div>
            </div>

            <div
              className={`p-2.5 rounded-xl border text-[11px] leading-relaxed break-words ${
                sessionPulse.isT2SettlementReleased
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  : 'bg-[#09101d] border-slate-800 text-slate-300'
              }`}
            >
              {sessionPulse.t2Note}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-[11px] font-mono">
            <span className="text-slate-400 font-sans">Tỷ trọng KLGD chuẩn theo giờ HOSE:</span>
            <span className="text-emerald-300 font-bold whitespace-nowrap">
              {Math.round(sessionPulse.expectedVolumeWeight * 100)}% thanh khoản cả ngày
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: REAL-TIME FOREIGN INVESTOR FLOW (KHỐI NGOẠI) & FUNDAMENTALS */}
      <div className="p-3.5 rounded-xl bg-[#0d1525] border border-emerald-500/30 space-y-3.5 min-w-0">
        <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="w-4 h-4 text-emerald-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white break-words">
                Dòng Tiền Khối Ngoại Thời Gian Thực (VSD/VNDirect) & Định Giá Cơ Bản
              </h3>
              {insights?.marketLeaders?.tradingDate && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shrink-0 whitespace-nowrap">
                  Phiên {insights.marketLeaders.tradingDate}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed break-words">
              Top Mua/Bán ròng toàn sàn HOSE & Chuỗi 10 phiên Khối ngoại + Room ngoại + P/E, P/B, ROE từng doanh nghiệp
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadInsights(inspectedTicker, true)}
            disabled={loadingInsights}
            className="px-2.5 py-1 rounded-lg bg-[#131f36] hover:bg-[#1a2a47] border border-slate-700 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition"
          >
            <RefreshCw className={`w-3 h-3 text-emerald-400 ${loadingInsights ? 'animate-spin' : ''}`} />
            <span>Đồng bộ Khối ngoại</span>
          </button>
        </div>

        {/* Market-Wide Top 8 Foreign Net Buy & Top 8 Foreign Net Sell */}
        {(topBuy.length > 0 || topSell.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
            {/* Top Net Buy */}
            <div className="p-3 rounded-xl bg-[#09101d] border border-emerald-500/25 space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Top Khối Ngoại Mua Ròng (HOSE)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">Đơn vị: Tỷ VNĐ</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {topBuy.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => setInspectedTicker(item.symbol)}
                    className={`p-2 rounded-lg border text-left transition min-w-0 ${
                      inspectedTicker === item.symbol
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-[#0e1729] hover:bg-[#15223b] border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 font-mono">
                      <span className="text-xs font-black text-white">{item.symbol}</span>
                      <span className="text-[9px] text-slate-400 shrink-0">Chi tiết</span>
                    </div>
                    <div className="text-[11px] font-mono font-bold text-emerald-400 mt-0.5 truncate">
                      +{item.netValBillionVnd} tỷ
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Top Net Sell */}
            <div className="p-3 rounded-xl bg-[#09101d] border border-rose-500/25 space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-rose-300">
                <span className="flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Top Khối Ngoại Bán Ròng (HOSE)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">Đơn vị: Tỷ VNĐ</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {topSell.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => setInspectedTicker(item.symbol)}
                    className={`p-2 rounded-lg border text-left transition min-w-0 ${
                      inspectedTicker === item.symbol
                        ? 'bg-rose-500/20 border-rose-400 text-white'
                        : 'bg-[#0e1729] hover:bg-[#15223b] border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 font-mono">
                      <span className="text-xs font-black text-white">{item.symbol}</span>
                      <span className="text-[9px] text-slate-400 shrink-0">Chi tiết</span>
                    </div>
                    <div className="text-[11px] font-mono font-bold text-rose-400 mt-0.5 truncate">
                      {item.netValBillionVnd} tỷ
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick VN Ticker Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <span className="text-[10px] text-slate-400 font-semibold shrink-0">Soi nhanh mã:</span>
          {POPULAR_VN_INSPECT_TICKERS.map((tk) => (
            <button
              key={tk}
              type="button"
              onClick={() => setInspectedTicker(tk)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border shrink-0 whitespace-nowrap transition ${
                inspectedTicker === tk
                  ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400'
                  : 'bg-[#09101d] text-slate-300 border-slate-800 hover:border-slate-600'
              }`}
            >
              {tk}
            </button>
          ))}
        </div>

        {/* Selected Symbol 10-Session Foreign Bar Chart + Corporate Fundamentals */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-w-0">
          {/* 10-Session Foreign Flow */}
          <div className="lg:col-span-6 p-3 rounded-xl bg-[#09101d] border border-slate-800 space-y-2.5 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 font-mono text-xs font-black text-cyan-300 shrink-0">
                  {inspectedTicker}
                </span>
                <span className="text-xs font-bold text-white break-words">
                  Chuỗi 10 Phiên Khối Ngoại & Room Ngoại
                </span>
              </div>

              {symbols.some((s) => s.symbol.toUpperCase() === inspectedTicker) && (
                <button
                  type="button"
                  onClick={() => jumpToChart(inspectedTicker)}
                  className="px-2 py-0.5 rounded bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/40 text-blue-200 text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap transition"
                >
                  <span>Mở Biểu Đồ</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {foreignFlow && foreignFlow.sessions.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2 font-mono text-center">
                  <div className="p-2 rounded-lg bg-[#0e1729] border border-slate-800">
                    <div className="text-[9.5px] text-slate-400 font-sans">Phiên gần nhất</div>
                    <div
                      className={`text-xs font-black mt-0.5 ${
                        foreignFlow.latestNetBillionVnd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {foreignFlow.latestNetBillionVnd >= 0 ? '+' : ''}
                      {foreignFlow.latestNetBillionVnd} tỷ
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0e1729] border border-slate-800">
                    <div className="text-[9.5px] text-slate-400 font-sans">Lũy kế 10 phiên</div>
                    <div
                      className={`text-xs font-black mt-0.5 ${
                        foreignFlow.total10dNetBillionVnd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {foreignFlow.total10dNetBillionVnd >= 0 ? '+' : ''}
                      {foreignFlow.total10dNetBillionVnd} tỷ
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0e1729] border border-slate-800">
                    <div className="text-[9.5px] text-slate-400 font-sans">Room ngoại còn</div>
                    <div className="text-xs font-black text-amber-300 mt-0.5">
                      {foreignFlow.remainingRoomPct !== null
                        ? `${foreignFlow.remainingRoomPct}%`
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* 10-Session Diverging Bar Chart */}
                {(() => {
                  const maxAbs = Math.max(
                    1,
                    ...foreignFlow.sessions.map((s) => Math.abs(s.netValBillionVnd))
                  );
                  return (
                    <div className="pt-1 space-y-1">
                      <div className="h-24 flex items-end gap-1.5 px-1 pt-2 pb-1 bg-[#0c1424] rounded-lg border border-slate-800/80">
                        {foreignFlow.sessions.map((s) => {
                          const isPos = s.netValBillionVnd >= 0;
                          const hPct = Math.max(
                            10,
                            Math.round((Math.abs(s.netValBillionVnd) / maxAbs) * 100)
                          );
                          return (
                            <div
                              key={s.tradingDate}
                              title={`${s.tradingDate}: ${isPos ? '+' : ''}${s.netValBillionVnd} tỷ VNĐ (Mua ${s.buyValBillionVnd} tỷ / Bán ${s.sellValBillionVnd} tỷ)`}
                              className="flex-1 h-full flex flex-col items-center justify-end gap-1 min-w-0"
                            >
                              <div
                                className={`w-full rounded-t transition-all ${
                                  isPos
                                    ? 'bg-emerald-500/80 border-t border-emerald-300'
                                    : 'bg-rose-500/80 border-t border-rose-300'
                                }`}
                                style={{ height: `${hPct}%` }}
                              />
                              <span className="text-[8.5px] font-mono text-slate-400 truncate max-w-full">
                                {s.tradingDate.slice(5)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                {loadingInsights
                  ? `Đang tải dữ liệu Khối ngoại thực tế của ${inspectedTicker}...`
                  : `Chưa có dữ liệu khớp lệnh Khối ngoại cho mã ${inspectedTicker}.`}
              </div>
            )}
          </div>

          {/* Corporate Fundamentals Valuation */}
          <div className="lg:col-span-6 p-3 rounded-xl bg-[#09101d] border border-slate-800 space-y-2.5 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-xs font-bold text-white truncate">
                  Định Giá Cơ Bản Doanh Nghiệp ({inspectedTicker})
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/35 shrink-0 whitespace-nowrap">
                Sàn {fundamentals?.exchange || getVnExchangeBoard(inspectedTicker)}
              </span>
            </div>

            {fundamentals ? (
              <>
                <div className="text-[11px] text-slate-300 font-medium break-words">
                  {fundamentals.companyNameVi}
                  {fundamentals.industryName ? ` • ${fundamentals.industryName}` : ''}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
                  <div className="p-2 rounded-lg bg-[#0e1729] border border-slate-800">
                    <div className="text-[9.5px] text-slate-400 font-sans">Định giá P/E</div>
                    <div className="text-xs sm:text-sm font-black text-cyan-300 mt-0.5">
                      {fundamentals.peRatio !== null ? `${fundamentals.peRatio}x` : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0e1729] border border-slate-800">
                    <div className="text-[9.5px] text-slate-400 font-sans">Định giá P/B</div>
                    <div className="text-xs sm:text-sm font-black text-sky-300 mt-0.5">
                      {fundamentals.pbRatio !== null ? `${fundamentals.pbRatio}x` : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0e1729] border border-slate-800">
                    <div className="text-[9.5px] text-slate-400 font-sans">Hiệu suất ROE</div>
                    <div
                      className={`text-xs sm:text-sm font-black mt-0.5 ${
                        (fundamentals.roePct ?? 0) >= 15 ? 'text-emerald-400' : 'text-white'
                      }`}
                    >
                      {fundamentals.roePct !== null ? `${fundamentals.roePct}%` : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0e1729] border border-slate-800">
                    <div className="text-[9.5px] text-slate-400 font-sans">EPS (4 Quý)</div>
                    <div className="text-xs sm:text-sm font-black text-white mt-0.5">
                      {fundamentals.epsVnd !== null
                        ? `${fundamentals.epsVnd.toLocaleString('en-US')} đ`
                        : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0e1729] border border-slate-800">
                    <div className="text-[9.5px] text-slate-400 font-sans">Vốn hóa TT</div>
                    <div className="text-xs sm:text-sm font-black text-amber-300 mt-0.5">
                      {fundamentals.marketCapTrillionVnd !== null
                        ? `${fundamentals.marketCapTrillionVnd.toLocaleString('en-US')} nghìn tỷ`
                        : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0e1729] border border-slate-800">
                    <div className="text-[9.5px] text-slate-400 font-sans">Tỷ suất Cổ tức</div>
                    <div className="text-xs sm:text-sm font-black text-emerald-300 mt-0.5">
                      {fundamentals.dividendYieldPct !== null
                        ? `${fundamentals.dividendYieldPct}%`
                        : '—'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                {loadingInsights
                  ? `Đang đồng bộ chỉ số P/E, P/B, ROE của ${inspectedTicker}...`
                  : `Đang cập nhật báo cáo tài chính cho ${inspectedTicker}.`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: 10-SECTOR VIETNAM ROTATION MATRIX (RS VS VN-INDEX) */}
      <div className="p-3.5 rounded-xl bg-[#0d1525] border border-indigo-500/30 space-y-3 min-w-0">
        <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Compass className="w-4 h-4 text-indigo-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white break-words">
                Bản Đồ Luân Chuyển 10 Nhóm Ngành Việt Nam (RS Rotation vs VN-Index)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed break-words">
              So sánh sức mạnh tương đối (Relative Strength) của 10 nhóm ngành chủ lực so với VN-Index ({formatPercent(sectorRotation.vnIndexChangePct)})
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 whitespace-nowrap">
              🚀 Dẫn sóng: {sectorRotation.sectors.filter((s) => s.quadrant === 'LEADING').length} ngành
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/35 whitespace-nowrap">
              🔻 Suy yếu: {sectorRotation.sectors.filter((s) => s.quadrant === 'LAGGING').length} ngành
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 min-w-0">
          {sectorRotation.sectors.map((sec) => {
            const isLeading = sec.quadrant === 'LEADING';
            const isImproving = sec.quadrant === 'IMPROVING';
            const isWeakening = sec.quadrant === 'WEAKENING';

            return (
              <div
                key={sec.sectorId}
                className={`p-3 rounded-xl border space-y-2 min-w-0 ${
                  isLeading
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : isImproving
                    ? 'bg-cyan-950/20 border-cyan-500/35'
                    : isWeakening
                    ? 'bg-amber-950/20 border-amber-500/35'
                    : 'bg-[#09101d] border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white break-words">{sec.sectorName}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      Độ rộng: <span className="text-emerald-400">{sec.advancers} tăng</span> /{' '}
                      <span className="text-rose-400">{sec.decliners} giảm</span> ({sec.trackedCount} mã)
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 whitespace-nowrap ${
                      isLeading
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : isImproving
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : isWeakening
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                    }`}
                  >
                    {sec.quadrantLabel}
                  </span>
                </div>

                {/* Metrics Row */}
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono bg-[#080e1a] px-2.5 py-1.5 rounded-lg border border-slate-800/80 flex-wrap">
                  <span>
                    TB Ngành:{' '}
                    <strong className={sec.avgChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {formatPercent(sec.avgChangePct)}
                    </strong>
                  </span>
                  <span>
                    RS vs VNI:{' '}
                    <strong
                      className={sec.rsSpreadVsVnIndex >= 0 ? 'text-cyan-300' : 'text-amber-300'}
                    >
                      {sec.rsSpreadVsVnIndex >= 0 ? '+' : ''}
                      {sec.rsSpreadVsVnIndex}%
                    </strong>
                  </span>
                </div>

                {/* Clickable Sector Tickers */}
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {sec.leaderSymbol && (
                    <span className="text-[10px] text-slate-400 mr-0.5 shrink-0">Mã ngành:</span>
                  )}
                  {sec.tickers.slice(0, 8).map((tk) => {
                    const isLeader = tk === sec.leaderSymbol;
                    return (
                      <button
                        key={tk}
                        type="button"
                        onClick={() => jumpToChart(tk)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition shrink-0 whitespace-nowrap flex items-center gap-0.5 ${
                          isLeader
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50 hover:bg-emerald-500/30'
                            : 'bg-[#111b2e] text-slate-300 border-slate-700/80 hover:border-cyan-400 hover:text-white'
                        }`}
                        title={isLeader ? `${tk} — Cổ phiếu dẫn đầu nhóm ${sec.shortName}` : `Mở biểu đồ ${tk}`}
                      >
                        {isLeader && <Flame className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                        <span>{tk}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
