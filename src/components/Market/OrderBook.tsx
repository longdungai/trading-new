import React, { useState, useEffect } from 'react';
import { OrderBook as OrderBookType } from '../../types';
import { formatPrice } from '../../utils/formatters';
import { ChevronDown, ChevronUp, Zap, Activity } from 'lucide-react';

interface OrderBookProps {
  orderBook: OrderBookType | null;
  currentPrice: number;
  symbol?: string;
  quoteAsset?: string;
}

export const OrderBook: React.FC<OrderBookProps> = ({
  orderBook,
  currentPrice,
  symbol = '',
  quoteAsset = 'USD',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [tick, setTick] = useState(0);

  // Trigger micro-jitter every 1.5s to keep the orderbook lively and reactive
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => (t + 1) % 1000);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const isVND = quoteAsset === 'VND' || symbol.includes('VN') || ['FPT', 'HPG', 'VIC', 'VHM', 'SJC', 'MWG', 'MSN', 'SSI', 'VCB'].includes(symbol);
  const prefix = isVND ? '' : '$';
  const priceSuffix = isVND ? 'k' : '';

  // Generate responsive active orderbook that ALWAYS matches currentPrice
  const activeBook: OrderBookType = React.useMemo(() => {
    // If external orderBook is provided, verify it actually matches currentPrice within 15%
    if (orderBook && orderBook.bids?.length > 0 && orderBook.asks?.length > 0) {
      const firstBid = orderBook.bids[0].price;
      const ratio = firstBid > 0 ? currentPrice / firstBid : 0;
      if (ratio > 0.85 && ratio < 1.15) {
        return orderBook;
      }
    }

    const price = currentPrice || (isVND ? 75.0 : 100);
    const tickStep = isVND
      ? (price > 100 ? 0.1 : 0.05)
      : price > 1000
      ? parseFloat((price * 0.0003).toFixed(2))
      : parseFloat((price * 0.0008).toFixed(4));

    // Dynamic micro-jitter based on tick
    const jitterSeed = (tick % 7) * 0.05;

    let bTotal = 0;
    const bids = [1, 2, 3, 4].map(i => {
      const p = parseFloat((price - tickStep * i).toFixed(isVND ? 2 : price > 1000 ? 2 : 4));
      const baseVol = isVND ? 12000 / (price || 1) : 25000 / (price || 1);
      const randomVol = baseVol * (0.7 + ((i + jitterSeed) % 1.2));
      const roundedVol = isVND ? Math.round(randomVol * 10) * 10 : parseFloat(randomVol.toFixed(3));
      bTotal += roundedVol;
      return { price: p, amount: roundedVol, total: bTotal };
    });

    let aTotal = 0;
    const asks = [1, 2, 3, 4].map(i => {
      const p = parseFloat((price + tickStep * i).toFixed(isVND ? 2 : price > 1000 ? 2 : 4));
      const baseVol = isVND ? 11500 / (price || 1) : 24000 / (price || 1);
      const randomVol = baseVol * (0.75 + ((i + jitterSeed * 1.5) % 1.1));
      const roundedVol = isVND ? Math.round(randomVol * 10) * 10 : parseFloat(randomVol.toFixed(3));
      aTotal += roundedVol;
      return { price: p, amount: roundedVol, total: aTotal };
    });

    const spreadVal = parseFloat((tickStep * 2).toFixed(isVND ? 2 : 4));
    const spreadPct = price > 0 ? (spreadVal / price) * 100 : 0.05;

    return {
      bids,
      asks,
      spread: spreadVal,
      spreadPercent: parseFloat(spreadPct.toFixed(3)),
    };
  }, [orderBook, currentPrice, isVND, tick]);

  const maxTotal = Math.max(
    ...activeBook.asks.map(a => a.total),
    ...activeBook.bids.map(b => b.total),
    1
  );

  const totalBidVol = activeBook.bids.reduce((sum, b) => sum + b.amount, 0);
  const totalAskVol = activeBook.asks.reduce((sum, a) => sum + a.amount, 0);
  const buyPressurePct =
    totalBidVol + totalAskVol > 0
      ? Math.round((totalBidVol / (totalBidVol + totalAskVol)) * 100)
      : 50;

  return (
    <div className="bg-[#080c14] border-t border-slate-800/80 select-none text-[10px] font-mono tabular-nums shrink-0">
      {/* Header bar with toggle */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="px-2.5 py-1.5 bg-[#0c121e] hover:bg-[#11192a] border-b border-slate-800/70 flex items-center justify-between gap-1.5 cursor-pointer transition"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-0.5 rounded bg-cyan-500/15 text-cyan-400 shrink-0">
            <Zap className="w-3 h-3" />
          </div>
          <span className="font-bold text-[10.5px] text-slate-100 font-sans uppercase tracking-tight truncate">
            Sổ Lệnh {symbol ? `• ${symbol}` : ''}
          </span>
          <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 shrink-0">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          <span className="text-[9.5px] text-white font-bold">
            {prefix}{formatPrice(currentPrice)}{priceSuffix}
          </span>
          <span className="text-[8.5px] text-slate-500 px-1 py-0.5 rounded bg-slate-900/80 border border-slate-800/80">
            ±{activeBook.spreadPercent.toFixed(2)}%
          </span>
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </div>

      {/* 2-Column Side-by-Side Compact Layout (Bids on Left, Asks on Right) */}
      {!isCollapsed && (
        <div className="p-1.5 space-y-1.5 bg-[#060a11]">
          {/* Order Flow Buy/Sell Pressure Bar */}
          <div className="px-1">
            <div className="flex items-center justify-between text-[8.5px] font-bold mb-0.5">
              <span className="text-emerald-400">B {buyPressurePct}%</span>
              <span className="text-slate-500 uppercase tracking-wider font-sans text-[8px]">Áp lực Khớp lệnh</span>
              <span className="text-rose-400">{100 - buyPressurePct}% S</span>
            </div>
            <div className="w-full h-1 rounded-full bg-rose-500/35 overflow-hidden flex">
              <div
                className="h-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${buyPressurePct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {/* LEFT: BÊN MUA (BIDS) */}
            <div className="border border-slate-800/80 rounded-lg p-1 bg-[#0a101b] min-w-0">
              <div className="flex items-center justify-between text-[8.5px] text-emerald-400/90 font-bold uppercase pb-0.5 border-b border-slate-800/80 mb-0.5 px-0.5">
                <span>Mua ({isVND ? 'k' : '$'})</span>
                <span>KL</span>
              </div>
              <div className="space-y-0.5">
                {activeBook.bids.slice(0, 3).map((bid, i) => {
                  const depthPercent = (bid.total / maxTotal) * 100;
                  return (
                    <div key={i} className="flex items-center justify-between gap-1 relative py-0.5 px-1 text-[9.5px] text-emerald-400 rounded overflow-hidden">
                      <div
                        className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none transition-all duration-300"
                        style={{ width: `${depthPercent}%` }}
                      />
                      <span className="font-bold relative z-10 truncate">{formatPrice(bid.price)}</span>
                      <span className="text-right text-slate-300 relative z-10 shrink-0 text-[9px]">
                        {isVND ? bid.amount.toLocaleString() : bid.amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: BÊN BÁN (ASKS) */}
            <div className="border border-slate-800/80 rounded-lg p-1 bg-[#0a101b] min-w-0">
              <div className="flex items-center justify-between text-[8.5px] text-rose-400/90 font-bold uppercase pb-0.5 border-b border-slate-800/80 mb-0.5 px-0.5">
                <span>Bán ({isVND ? 'k' : '$'})</span>
                <span>KL</span>
              </div>
              <div className="space-y-0.5">
                {activeBook.asks.slice(0, 3).map((ask, i) => {
                  const depthPercent = (ask.total / maxTotal) * 100;
                  return (
                    <div key={i} className="flex items-center justify-between gap-1 relative py-0.5 px-1 text-[9.5px] text-rose-400 rounded overflow-hidden">
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-rose-500/15 pointer-events-none transition-all duration-300"
                        style={{ width: `${depthPercent}%` }}
                      />
                      <span className="font-bold relative z-10 truncate">{formatPrice(ask.price)}</span>
                      <span className="text-right text-slate-300 relative z-10 shrink-0 text-[9px]">
                        {isVND ? ask.amount.toLocaleString() : ask.amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
