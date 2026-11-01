import React, { useState, useEffect, useMemo } from 'react';
import { Candle, MarketSymbol, OrderBook as OrderBookType } from '../../types';
import { formatPercent, formatPrice } from '../../utils/formatters';
import { getMarketSessionInfo } from '../../utils/marketHours';
import {
  DerivativesOrderFlowSnapshot,
  fetchDerivativesOrderFlow,
} from '../../services/api/derivativesOrderFlow';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Lock,
  Zap,
  CalendarClock,
  Info,
  Flame,
  AlertTriangle,
} from 'lucide-react';

interface OrderBookProps {
  orderBook: OrderBookType | null;
  currentPrice: number;
  symbol?: string;
  quoteAsset?: string;
  marketSymbol?: MarketSymbol;
  candles?: Candle[];
}

export const OrderBook: React.FC<OrderBookProps> = ({
  orderBook,
  currentPrice,
  symbol = '',
  quoteAsset = 'USD',
  marketSymbol,
  candles = [],
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [subTab, setSubTab] = useState<'book' | 'orderflow'>('book');
  const [now, setNow] = useState<Date>(() => new Date());
  const [flowSnap, setFlowSnap] = useState<DerivativesOrderFlowSnapshot | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  const targetMeta: MarketSymbol = useMemo(
    () =>
      marketSymbol || {
        symbol: symbol || 'BTCUSDT',
        name: symbol || 'BTCUSDT',
        type:
          quoteAsset === 'VND'
            ? 'vn30'
            : quoteAsset === 'USDT'
              ? 'crypto'
              : 'stock',
        baseAsset: symbol,
        quoteAsset,
        price: currentPrice,
        change24h: 0,
        high24h: currentPrice,
        low24h: currentPrice,
        volume24h: 0,
      },
    [marketSymbol, symbol, quoteAsset, currentPrice]
  );

  useEffect(() => {
    let active = true;
    const syncFlow = (force: boolean = false) => {
      void fetchDerivativesOrderFlow(targetMeta, candles, force).then(res => {
        if (active) setFlowSnap(res);
      });
    };
    syncFlow(false);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFlow(false);
      }
    }, 18_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [targetMeta.symbol, candles.length]);

  const session = useMemo(() => getMarketSessionInfo(targetMeta, now), [targetMeta, now]);

  const isVND =
    targetMeta.quoteAsset === 'VND' ||
    targetMeta.type === 'vn30' ||
    symbol.toUpperCase() === 'VNINDEX' ||
    symbol.toUpperCase() === 'VN30';
  const prefix = isVND ? '' : '$';
  const priceSuffix = isVND ? 'k' : '';

  const hasValidRealDepth =
    session.hasRealOrderBook &&
    orderBook !== null &&
    orderBook.bids?.length > 0 &&
    orderBook.asks?.length > 0;

  const formatCompactUsd = (val: number | null) => {
    if (val === null || !Number.isFinite(val)) return '--';
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  const renderOrderFlowPanel = () => {
    if (!flowSnap) {
      return (
        <div className="py-4 text-center text-[10px] text-slate-400">
          Đang đồng bộ dữ liệu dòng tiền OI, CVD & Cá voi...
        </div>
      );
    }

    const regimeBadge =
      flowSnap.regime === 'LONG_BUILDUP'
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        : flowSnap.regime === 'SHORT_SQUEEZE'
          ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
          : flowSnap.regime === 'SHORT_BUILDUP'
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            : flowSnap.regime === 'LONG_LIQUIDATION'
              ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
              : 'bg-slate-800 text-slate-300 border-slate-700';

    const cvdPts = flowSnap.candleCvdSeries;

    return (
      <div className="p-2 space-y-2 bg-[#060a11] text-[9.5px] font-mono">
        {/* Regime Header */}
        <div className="p-1.5 rounded-lg bg-[#0b1220] border border-slate-800 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[8.5px] font-sans font-bold uppercase text-slate-400">
              Trạng Thái Dòng Tiền
            </span>
            <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold border ${regimeBadge}`}>
              {flowSnap.regimeLabel}
            </span>
          </div>
          <p className="text-[9px] font-sans text-slate-300 leading-snug">
            {flowSnap.regimeDetail}
          </p>
        </div>

        {/* Live Binance Futures OI & Top Trader Metrics (when available) */}
        {flowSnap.hasLiveFuturesData && (
          <div className="grid grid-cols-3 gap-1">
            <div className="p-1.5 rounded bg-[#0a101b] border border-slate-800/80">
              <div className="text-[8px] text-slate-400 font-sans">Open Interest</div>
              <div className="font-bold text-white text-[10px]">
                {formatCompactUsd(flowSnap.openInterestUsd)}
              </div>
              {flowSnap.oiChange1hPct !== null && (
                <div
                  className={`text-[8.5px] ${
                    flowSnap.oiChange1hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  1h: {flowSnap.oiChange1hPct >= 0 ? '+' : ''}
                  {flowSnap.oiChange1hPct.toFixed(2)}%
                </div>
              )}
            </div>

            <div className="p-1.5 rounded bg-[#0a101b] border border-slate-800/80">
              <div className="text-[8px] text-slate-400 font-sans">Top Trader L/S</div>
              <div className="font-bold text-cyan-300 text-[10px]">
                {flowSnap.topTraderLongShortRatio !== null
                  ? flowSnap.topTraderLongShortRatio.toFixed(2)
                  : '--'}
              </div>
              {flowSnap.topTraderLongPct !== null && (
                <div className="text-[8.5px] text-slate-400">
                  L {flowSnap.topTraderLongPct.toFixed(0)}% / S{' '}
                  {(100 - flowSnap.topTraderLongPct).toFixed(0)}%
                </div>
              )}
            </div>

            <div className="p-1.5 rounded bg-[#0a101b] border border-slate-800/80">
              <div className="text-[8px] text-slate-400 font-sans">Taker Mua/Bán</div>
              <div
                className={`font-bold text-[10px] ${
                  (flowSnap.takerBuySellRatio ?? 1) >= 1 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {flowSnap.takerBuySellRatio !== null ? flowSnap.takerBuySellRatio.toFixed(2) : '--'}
              </div>
              <div className="text-[8.5px] text-slate-400">
                {(flowSnap.takerBuySellRatio ?? 1) >= 1 ? 'Mua chủ động' : 'Bán chủ động'}
              </div>
            </div>
          </div>
        )}

        {/* CVD Sparkline */}
        {cvdPts.length > 3 && (
          <div className="p-1.5 rounded-lg bg-[#0a101b] border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-[8.5px]">
              <span className="font-sans font-bold text-slate-300 uppercase">
                Đường Lũy Kế CVD ({cvdPts.length} nến)
              </span>
              <span
                className={
                  cvdPts[cvdPts.length - 1].cumulativeDelta >= cvdPts[0].cumulativeDelta
                    ? 'text-emerald-400 font-bold'
                    : 'text-rose-400 font-bold'
                }
              >
                {cvdPts[cvdPts.length - 1].cumulativeDelta >= cvdPts[0].cumulativeDelta
                  ? 'Dòng tiền Gom ▲'
                  : 'Dòng tiền Xả ▼'}
              </span>
            </div>
            <div className="h-8 w-full">
              <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
                {(() => {
                  const vals = cvdPts.map(p => p.cumulativeDelta);
                  const minV = Math.min(...vals);
                  const maxV = Math.max(...vals);
                  const span = Math.max(1e-6, maxV - minV);
                  const pts = cvdPts
                    .map((p, i) => {
                      const x = (i / (cvdPts.length - 1)) * 100;
                      const y = 27 - ((p.cumulativeDelta - minV) / span) * 24;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ');
                  const isUp = vals[vals.length - 1] >= vals[0];
                  return (
                    <polyline
                      fill="none"
                      stroke={isUp ? '#10b981' : '#f43f5e'}
                      strokeWidth="2"
                      points={pts}
                    />
                  );
                })()}
              </svg>
            </div>
          </div>
        )}

        {flowSnap.cvdDivergenceWarning && (
          <div className="p-1.5 rounded bg-amber-950/40 border border-amber-500/40 text-amber-200 font-sans text-[9px] flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <span>{flowSnap.cvdDivergenceWarning}</span>
          </div>
        )}

        {/* Whale Trade Tape */}
        {flowSnap.whaleTrades.length > 0 && (
          <div className="rounded-lg border border-slate-800/80 bg-[#0a101b] p-1.5 space-y-1">
            <div className="flex items-center justify-between text-[8.5px] border-b border-slate-800 pb-0.5">
              <span className="font-sans font-bold text-amber-300 uppercase flex items-center gap-1">
                <Flame className="w-2.5 h-2.5 text-amber-400" />
                Lệnh Cá Voi (&ge;{formatCompactUsd(flowSnap.whaleThresholdUsd)})
              </span>
              <span
                className={
                  flowSnap.whaleNetDeltaUsd >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
                }
              >
                Ròng: {formatCompactUsd(flowSnap.whaleNetDeltaUsd)}
              </span>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-0.5">
              {flowSnap.whaleTrades.slice(0, 5).map(wt => (
                <div
                  key={wt.id}
                  className="flex items-center justify-between text-[9px] px-1 py-0.5 rounded bg-slate-900/70"
                >
                  <span
                    className={`font-bold ${
                      wt.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {wt.side === 'BUY' ? 'MUA' : 'BÁN'} {formatCompactUsd(wt.notionalUsd)}
                  </span>
                  <span className="text-slate-300">@ ${formatPrice(wt.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ================= CASE 1: REAL BINANCE 24/7 LEVEL-2 ORDER BOOK =================
  if (session.hasRealOrderBook) {
    const bids = hasValidRealDepth ? orderBook!.bids.slice(0, 4) : [];
    const asks = hasValidRealDepth ? orderBook!.asks.slice(0, 4) : [];
    const maxTotal = Math.max(
      ...asks.map(a => a.total),
      ...bids.map(b => b.total),
      1
    );
    const totalBidVol = bids.reduce((sum, b) => sum + b.amount, 0);
    const totalAskVol = asks.reduce((sum, a) => sum + a.amount, 0);
    const buyPressurePct =
      totalBidVol + totalAskVol > 0
        ? Math.round((totalBidVol / (totalBidVol + totalAskVol)) * 100)
        : 50;

    return (
      <div className="bg-[#080c14] border-t border-slate-800/80 select-none text-[10px] font-mono tabular-nums shrink-0">
        <div className="px-2 py-1.5 bg-[#0c121e] border-b border-slate-800/70 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsCollapsed(false);
                setSubTab('book');
              }}
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-sans font-bold flex items-center gap-1 transition ${
                subTab === 'book'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-2.5 h-2.5 text-cyan-400" />
              <span>Sổ Lệnh L2</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsCollapsed(false);
                setSubTab('orderflow');
              }}
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-sans font-bold flex items-center gap-1 transition ${
                subTab === 'orderflow'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-2.5 h-2.5 text-amber-400" />
              <span>OI • CVD • Cá Voi</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 text-slate-400 hover:text-white shrink-0"
          >
            <span className="text-[9.5px] text-white font-bold">
              {prefix}
              {formatPrice(currentPrice)}
              {priceSuffix}
            </span>
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {!isCollapsed &&
          (subTab === 'orderflow' ? (
            renderOrderFlowPanel()
          ) : (
            <div className="p-1.5 space-y-1.5 bg-[#060a11]">
              {!hasValidRealDepth ? (
                <div className="py-4 text-center text-[10px] text-slate-400 font-sans">
                  Đang tải sổ lệnh thực tế trực tiếp từ sàn Binance...
                </div>
              ) : (
                <>
                  <div className="px-1">
                    <div className="flex items-center justify-between text-[8.5px] font-bold mb-0.5">
                      <span className="text-emerald-400">Mua {buyPressurePct}%</span>
                      <span className="text-slate-500 uppercase tracking-wider font-sans text-[8px]">
                        Spread {orderBook!.spreadPercent.toFixed(3)}%
                      </span>
                      <span className="text-rose-400">{100 - buyPressurePct}% Bán</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-rose-500/35 overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${buyPressurePct}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {/* BIDS */}
                    <div className="border border-slate-800/80 rounded-lg p-1 bg-[#0a101b] min-w-0">
                      <div className="flex items-center justify-between text-[8.5px] text-emerald-400/90 font-bold uppercase pb-0.5 border-b border-slate-800/80 mb-0.5 px-0.5">
                        <span>Dư Mua ($)</span>
                        <span>KL</span>
                      </div>
                      <div className="space-y-0.5">
                        {bids.map((bid, i) => {
                          const depthPercent = (bid.total / maxTotal) * 100;
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-1 relative py-0.5 px-1 text-[9.5px] text-emerald-400 rounded overflow-hidden"
                            >
                              <div
                                className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none"
                                style={{ width: `${depthPercent}%` }}
                              />
                              <span className="font-bold relative z-10 truncate">
                                {formatPrice(bid.price)}
                              </span>
                              <span className="text-right text-slate-300 relative z-10 shrink-0 text-[9px]">
                                {bid.amount >= 100 ? bid.amount.toFixed(1) : bid.amount.toFixed(3)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ASKS */}
                    <div className="border border-slate-800/80 rounded-lg p-1 bg-[#0a101b] min-w-0">
                      <div className="flex items-center justify-between text-[8.5px] text-rose-400/90 font-bold uppercase pb-0.5 border-b border-slate-800/80 mb-0.5 px-0.5">
                        <span>Dư Bán ($)</span>
                        <span>KL</span>
                      </div>
                      <div className="space-y-0.5">
                        {asks.map((ask, i) => {
                          const depthPercent = (ask.total / maxTotal) * 100;
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-1 relative py-0.5 px-1 text-[9.5px] text-rose-400 rounded overflow-hidden"
                            >
                              <div
                                className="absolute left-0 top-0 bottom-0 bg-rose-500/15 pointer-events-none"
                                style={{ width: `${depthPercent}%` }}
                              />
                              <span className="font-bold relative z-10 truncate">
                                {formatPrice(ask.price)}
                              </span>
                              <span className="text-right text-slate-300 relative z-10 shrink-0 text-[9px]">
                                {ask.amount >= 100 ? ask.amount.toFixed(1) : ask.amount.toFixed(3)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
      </div>
    );
  }

  // ================= CASE 2: STOCKS, INDICES & COMMODITIES (HONEST OFFICIAL SESSION + CVD) =================
  const statusPillClass = session.isOpen
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
    : session.state === 'LUNCH_BREAK'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
      : session.state === 'PRE_OPEN' || session.state === 'AFTER_HOURS'
        ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
        : 'bg-slate-800/90 text-slate-300 border-slate-700/80';

  return (
    <div className="bg-[#080c14] border-t border-slate-800/80 select-none text-[10px] font-sans shrink-0">
      <div className="px-2 py-1.5 bg-[#0c121e] border-b border-slate-800/70 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              setSubTab('book');
            }}
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-1 transition ${
              subTab === 'book'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {session.isOpen ? <Clock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
            <span>Phiên Sàn</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              setSubTab('orderflow');
            }}
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-1 transition ${
              subTab === 'orderflow'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-2.5 h-2.5 text-amber-400" />
            <span>CVD Dòng Tiền</span>
          </button>

          <span
            className={`hidden sm:inline-flex items-center gap-1 text-[8px] font-bold px-1 py-0.2 rounded border shrink-0 uppercase ${statusPillClass}`}
          >
            {session.shortBadge}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1 text-slate-400 hover:text-white shrink-0 font-mono tabular-nums"
        >
          <span className="text-[9.5px] text-white font-bold">
            {prefix}
            {formatPrice(currentPrice)}
            {priceSuffix}
          </span>
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!isCollapsed &&
        (subTab === 'orderflow' ? (
          renderOrderFlowPanel()
        ) : (
          <div className="p-2 space-y-1.5 bg-[#060a11]">
            <div className="rounded-lg border border-slate-800/90 bg-[#0a101b] p-2 space-y-1">
              <div className="flex items-center justify-between gap-1 text-[9.5px]">
                <span className="font-bold text-cyan-300 truncate">{session.exchangeName}</span>
                <span className="font-mono text-[8.5px] text-slate-400 shrink-0">
                  {session.currentExchangeTime}
                </span>
              </div>
              <div
                className={`text-[10px] font-semibold leading-snug ${
                  session.isOpen ? 'text-emerald-300' : 'text-amber-200/95'
                }`}
              >
                {session.statusHeadline}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-slate-400 pt-0.5">
                <CalendarClock className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="truncate">{session.nextSessionLabel}</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800/80 bg-[#090e18] p-1.5 space-y-0.5">
              <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-0.5 border-b border-slate-800/80 flex items-center justify-between">
                <span>Khung Giờ Giao Dịch Quy Định</span>
                <span>{isVND ? 'Giờ VN (GMT+7)' : 'Giờ Sàn'}</span>
              </div>
              {session.scheduleRows.map((row, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between px-1 py-0.5 rounded text-[9px] ${
                    row.isActive ? 'bg-emerald-500/15 text-emerald-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  <span className="truncate">{row.label}</span>
                  <span className="font-mono tabular-nums shrink-0">{row.timeRange}</span>
                </div>
              ))}
            </div>

            {marketSymbol && (
              <div className="rounded-lg border border-slate-800/80 bg-[#090e18] px-2 py-1.5 space-y-1">
                <div className="flex items-center justify-between text-[9.5px] font-mono tabular-nums">
                  <span className="font-sans text-slate-400">
                    {session.isOpen ? 'Giá khớp thực tế:' : 'Giá chốt phiên gần nhất:'}
                  </span>
                  <span className="font-bold text-white">
                    {prefix}
                    {formatPrice(marketSymbol.price)}
                    {priceSuffix}{' '}
                    <span
                      className={
                        marketSymbol.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }
                    >
                      ({formatPercent(marketSymbol.change24h)})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono tabular-nums text-slate-400">
                  <span className="font-sans">Biên độ phiên thực tế:</span>
                  <span>
                    <span className="text-rose-300">
                      {prefix}
                      {formatPrice(marketSymbol.low24h)}
                    </span>
                    {' – '}
                    <span className="text-emerald-300">
                      {prefix}
                      {formatPrice(marketSymbol.high24h)}
                      {priceSuffix}
                    </span>
                  </span>
                </div>
                {session.priceBandNote && (
                  <div className="text-[8.5px] text-slate-500 flex items-center gap-1 pt-0.5 border-t border-slate-800/70">
                    <Info className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                    <span className="truncate">{session.priceBandNote}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
    </div>
  );
};
