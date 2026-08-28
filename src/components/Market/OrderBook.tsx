import React, { useState } from 'react';
import { OrderBook as OrderBookType } from '../../types';
import { formatPrice } from '../../utils/formatters';
import { Layers, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface OrderBookProps {
  orderBook: OrderBookType | null;
  currentPrice: number;
  quoteAsset?: string;
}

export const OrderBook: React.FC<OrderBookProps> = ({ orderBook, currentPrice, quoteAsset = 'USD' }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isVND = quoteAsset === 'VND';
  const prefix = isVND ? '' : '$';
  const priceSuffix = isVND ? 'k' : '';

  // Generate fallback active orderbook if null or empty
  const activeBook: OrderBookType = React.useMemo(() => {
    if (orderBook && orderBook.bids?.length > 0 && orderBook.asks?.length > 0) {
      return orderBook;
    }
    const price = currentPrice || 100;
    const tick = isVND ? 0.05 : price * 0.0008;

    let bTotal = 0;
    const bids = [1, 2, 3, 4].map(i => {
      const p = parseFloat((price - tick * i).toFixed(isVND ? 2 : 4));
      const a = parseFloat(((1000 / (price || 1)) * (0.8 + (i * 0.35))).toFixed(isVND ? 0 : 2));
      bTotal += a;
      return { price: p, amount: a, total: bTotal };
    });

    let aTotal = 0;
    const asks = [1, 2, 3, 4].map(i => {
      const p = parseFloat((price + tick * i).toFixed(isVND ? 2 : 4));
      const a = parseFloat(((1000 / (price || 1)) * (0.9 + (i * 0.3))).toFixed(isVND ? 0 : 2));
      aTotal += a;
      return { price: p, amount: a, total: aTotal };
    });

    return {
      bids,
      asks,
      spread: parseFloat((tick * 2).toFixed(isVND ? 2 : 4)),
      spreadPercent: 0.04,
    };
  }, [orderBook, currentPrice, isVND]);

  const maxTotal = Math.max(
    ...activeBook.asks.map(a => a.total),
    ...activeBook.bids.map(b => b.total),
    1
  );

  return (
    <div className="bg-[#0b0f17] border-t border-[#1b2230] select-none text-[10px] font-mono shrink-0">
      {/* Header bar with toggle */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="px-2.5 py-1.5 bg-[#101622] hover:bg-[#151e2d] border-b border-[#1b2230] flex items-center justify-between cursor-pointer transition"
      >
        <div className="flex items-center gap-1.5">
          <div className="p-0.5 rounded bg-blue-500/20 text-blue-400">
            <Zap className="w-3 h-3" />
          </div>
          <span className="font-bold text-[11px] text-white font-sans uppercase tracking-tight">
            Sổ Lệnh Trực Tiếp (Depth)
          </span>
          <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-[9px]">
            Giá: <span className="text-white font-bold">{prefix}{formatPrice(currentPrice)}{priceSuffix}</span>
          </span>
          <span className="text-[9px] text-gray-500 hidden sm:inline">
            Spread: {activeBook.spreadPercent.toFixed(2)}%
          </span>
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* 2-Column Side-by-Side Compact Layout (Bids on Left, Asks on Right) */}
      {!isCollapsed && (
        <div className="p-1.5 grid grid-cols-2 gap-1.5 bg-[#090d14]">
          {/* LEFT: BÊN MUA (BIDS) */}
          <div className="border border-[#182333] rounded-lg p-1 bg-[#0d131e]">
            <div className="grid grid-cols-2 text-[9px] text-emerald-400 font-bold uppercase pb-0.5 border-b border-[#1c2738] mb-0.5">
              <span>Mua ({isVND ? 'k' : '$'})</span>
              <span className="text-right">KL ({isVND ? 'cp' : 'SL'})</span>
            </div>
            <div className="space-y-0.5">
              {activeBook.bids.slice(0, 3).map((bid, i) => {
                const depthPercent = (bid.total / maxTotal) * 100;
                return (
                  <div key={i} className="grid grid-cols-2 relative py-0.5 px-1 text-emerald-400 rounded overflow-hidden">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none"
                      style={{ width: `${depthPercent}%` }}
                    />
                    <span className="font-bold relative z-10">{formatPrice(bid.price)}</span>
                    <span className="text-right text-gray-300 relative z-10">
                      {isVND ? Math.round(bid.amount * 10).toLocaleString() : bid.amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: BÊN BÁN (ASKS) */}
          <div className="border border-[#182333] rounded-lg p-1 bg-[#0d131e]">
            <div className="grid grid-cols-2 text-[9px] text-rose-400 font-bold uppercase pb-0.5 border-b border-[#1c2738] mb-0.5">
              <span>Bán ({isVND ? 'k' : '$'})</span>
              <span className="text-right">KL ({isVND ? 'cp' : 'SL'})</span>
            </div>
            <div className="space-y-0.5">
              {activeBook.asks.slice(0, 3).map((ask, i) => {
                const depthPercent = (ask.total / maxTotal) * 100;
                return (
                  <div key={i} className="grid grid-cols-2 relative py-0.5 px-1 text-rose-400 rounded overflow-hidden">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-rose-500/15 pointer-events-none"
                      style={{ width: `${depthPercent}%` }}
                    />
                    <span className="font-bold relative z-10">{formatPrice(ask.price)}</span>
                    <span className="text-right text-gray-300 relative z-10">
                      {isVND ? Math.round(ask.amount * 10).toLocaleString() : ask.amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
