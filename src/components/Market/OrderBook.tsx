import React from 'react';
import { OrderBook as OrderBookType } from '../../types';
import { formatPrice } from '../../utils/formatters';
import { Layers } from 'lucide-react';

interface OrderBookProps {
  orderBook: OrderBookType | null;
  currentPrice: number;
}

export const OrderBook: React.FC<OrderBookProps> = ({ orderBook, currentPrice }) => {
  if (!orderBook) {
    return (
      <div className="p-3 bg-[#0c1017] border-t border-[#1b2230] text-gray-500 text-xs text-center">
        Đang nạp sổ lệnh trực tiếp...
      </div>
    );
  }

  const maxTotal = Math.max(
    ...orderBook.asks.map(a => a.total),
    ...orderBook.bids.map(b => b.total),
    1
  );

  return (
    <div className="flex flex-col bg-[#0c1017] border-t border-[#1b2230] p-3 select-none text-[11px] font-mono">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 font-bold text-xs text-white uppercase tracking-wider font-sans">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>Sổ Lệnh Trực Tiếp (Depth)</span>
        </div>
        <span className="text-[10px] text-gray-400">Spread: {orderBook.spreadPercent.toFixed(3)}%</span>
      </div>

      <div className="grid grid-cols-3 text-[10px] text-gray-500 uppercase font-semibold pb-1 border-b border-gray-800">
        <div>Giá ($)</div>
        <div className="text-right">Khối Lượng</div>
        <div className="text-right">Tích Lũy</div>
      </div>

      {/* Asks (Sell Orders - Top down) */}
      <div className="space-y-0.5 my-1">
        {orderBook.asks.slice(0, 6).reverse().map((ask, i) => {
          const depthPercent = (ask.total / maxTotal) * 100;
          return (
            <div key={i} className="grid grid-cols-3 relative py-0.5 text-rose-400">
              <div
                className="absolute right-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none"
                style={{ width: `${depthPercent}%` }}
              />
              <div className="font-bold relative z-10">{formatPrice(ask.price)}</div>
              <div className="text-right text-gray-300 relative z-10">{ask.amount.toFixed(3)}</div>
              <div className="text-right text-gray-400 relative z-10">{ask.total.toFixed(3)}</div>
            </div>
          );
        })}
      </div>

      {/* Middle Current Price Indicator */}
      <div className="py-1.5 px-2 my-1 rounded bg-[#131b27] border border-gray-800 flex items-center justify-between font-bold text-xs">
        <span className="text-emerald-400 font-bold">${formatPrice(currentPrice)}</span>
        <span className="text-[10px] text-gray-400 font-normal">Chênh lệch ${formatPrice(orderBook.spread)}</span>
      </div>

      {/* Bids (Buy Orders) */}
      <div className="space-y-0.5 my-1">
        {orderBook.bids.slice(0, 6).map((bid, i) => {
          const depthPercent = (bid.total / maxTotal) * 100;
          return (
            <div key={i} className="grid grid-cols-3 relative py-0.5 text-emerald-400">
              <div
                className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none"
                style={{ width: `${depthPercent}%` }}
              />
              <div className="font-bold relative z-10">{formatPrice(bid.price)}</div>
              <div className="text-right text-gray-300 relative z-10">{bid.amount.toFixed(3)}</div>
              <div className="text-right text-gray-400 relative z-10">{bid.total.toFixed(3)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
