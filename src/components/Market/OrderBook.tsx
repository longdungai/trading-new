import React, { useState, useEffect, useMemo } from 'react';
import { MarketSymbol, OrderBook as OrderBookType } from '../../types';
import { formatPercent, formatPrice } from '../../utils/formatters';
import { getMarketSessionInfo } from '../../utils/marketHours';
import { ChevronDown, ChevronUp, Clock, Lock, Zap, CalendarClock, Info } from 'lucide-react';

interface OrderBookProps {
  orderBook: OrderBookType | null;
  currentPrice: number;
  symbol?: string;
  quoteAsset?: string;
  marketSymbol?: MarketSymbol;
}

export const OrderBook: React.FC<OrderBookProps> = ({
  orderBook,
  currentPrice,
  symbol = '',
  quoteAsset = 'USD',
  marketSymbol,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  // Refresh wall-clock every 10s solely to keep official exchange session status & countdown accurate
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  const targetMeta = useMemo(
    () =>
      marketSymbol || {
        symbol: symbol || 'BTCUSDT',
        type: quoteAsset === 'VND' ? ('vn30' as const) : quoteAsset === 'USDT' ? ('crypto' as const) : ('stock' as const),
        quoteAsset,
      },
    [marketSymbol, symbol, quoteAsset]
  );

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
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="px-2.5 py-1.5 bg-[#0c121e] hover:bg-[#11192a] border-b border-slate-800/70 flex items-center justify-between gap-1.5 cursor-pointer transition"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="p-0.5 rounded bg-cyan-500/15 text-cyan-400 shrink-0">
              <Zap className="w-3 h-3" />
            </div>
            <span className="font-bold text-[10.5px] text-slate-100 font-sans uppercase tracking-tight truncate">
              Sổ Lệnh Thực {symbol ? `• ${symbol}` : ''}
            </span>
            <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              24/7
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
            <span className="text-[9.5px] text-white font-bold">
              {prefix}
              {formatPrice(currentPrice)}
              {priceSuffix}
            </span>
            {hasValidRealDepth && (
              <span className="text-[8.5px] text-slate-400 px-1 py-0.5 rounded bg-slate-900/80 border border-slate-800/80">
                Spread {orderBook!.spreadPercent.toFixed(3)}%
              </span>
            )}
            {isCollapsed ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>

        {!isCollapsed && (
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
                      Độ sâu Sổ lệnh Binance
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
                            <span className="font-bold relative z-10 truncate">{formatPrice(bid.price)}</span>
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
                            <span className="font-bold relative z-10 truncate">{formatPrice(ask.price)}</span>
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
        )}
      </div>
    );
  }

  // ================= CASE 2: STOCKS, INDICES & COMMODITIES (HONEST OFFICIAL SESSION & REAL DATA) =================
  const statusPillClass = session.isOpen
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
    : session.state === 'LUNCH_BREAK'
    ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
    : session.state === 'PRE_OPEN' || session.state === 'AFTER_HOURS'
    ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
    : 'bg-slate-800/90 text-slate-300 border-slate-700/80';

  return (
    <div className="bg-[#080c14] border-t border-slate-800/80 select-none text-[10px] font-sans shrink-0">
      {/* Header bar */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="px-2.5 py-1.5 bg-[#0c121e] hover:bg-[#11192a] border-b border-slate-800/70 flex items-center justify-between gap-1.5 cursor-pointer transition"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`p-0.5 rounded shrink-0 ${
              session.isOpen ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {session.isOpen ? <Clock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
          </div>
          <span className="font-bold text-[10.5px] text-slate-100 uppercase tracking-tight truncate">
            Phiên Sàn {symbol ? `• ${symbol}` : ''}
          </span>
          <span
            className={`flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 uppercase ${statusPillClass}`}
          >
            {session.isOpen && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            {session.shortBadge}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 shrink-0 font-mono tabular-nums">
          <span className="text-[9.5px] text-white font-bold">
            {prefix}
            {formatPrice(currentPrice)}
            {priceSuffix}
          </span>
          {isCollapsed ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Body: Official Exchange Status, Trading Schedule & Last Session Real Figures */}
      {!isCollapsed && (
        <div className="p-2 space-y-1.5 bg-[#060a11]">
          {/* Exchange Status & Next Session Countdown */}
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

          {/* Official Trading Hours Table */}
          <div className="rounded-lg border border-slate-800/80 bg-[#090e18] p-1.5 space-y-0.5">
            <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-0.5 border-b border-slate-800/80 flex items-center justify-between">
              <span>Khung Giờ Giao Dịch Quy Định</span>
              <span>{isVND ? 'Giờ VN (GMT+7)' : 'Giờ Sàn'}</span>
            </div>
            {session.scheduleRows.map((row, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between px-1 py-0.5 rounded text-[9px] ${
                  row.isActive
                    ? 'bg-emerald-500/15 text-emerald-300 font-bold'
                    : 'text-slate-400'
                }`}
              >
                <span className="truncate">{row.label}</span>
                <span className="font-mono tabular-nums shrink-0">{row.timeRange}</span>
              </div>
            ))}
          </div>

          {/* Real Last Session Summary + Transparency Note */}
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
      )}
    </div>
  );
};
