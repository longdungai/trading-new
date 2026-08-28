import React, { useState } from 'react';
import { Candle } from '../../types';
import { runBacktest, StrategyType } from '../../services/backtesting/backtester';
import { formatPercent, formatPrice, formatTime } from '../../utils/formatters';
import { Sparkles, X, TrendingUp, Percent, ShieldAlert, Award, Activity } from 'lucide-react';

interface BacktestModalProps {
  candles: Candle[];
  symbolName: string;
  onClose: () => void;
}

export const BacktestModal: React.FC<BacktestModalProps> = ({ candles, symbolName, onClose }) => {
  const [strategy, setStrategy] = useState<StrategyType>('SUPERTREND_EMA');
  const [capital, setCapital] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(2);

  const result = runBacktest(candles, strategy, capital, riskPercent);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#0e141f] border border-[#232f44] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-[#1c2738] flex items-center justify-between bg-[#121927]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-tight font-mono">
                Backtest & Kiểm Thử Chiến Lược AI - <span className="text-blue-400">{symbolName}</span>
              </h2>
              <p className="text-xs text-gray-400">Kiểm thử hiệu suất trên {candles.length} nến lịch sử thực tế</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1a2332] text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Strategy & Inputs Controls */}
        <div className="p-4 bg-[#111824] border-b border-[#1c2738] grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-gray-400 uppercase font-semibold block mb-1">
              Chọn Chiến Lược Kiểm Thử (7 Chiến Lược)
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as StrategyType)}
              className="w-full bg-[#182232] border border-[#27364e] rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
            >
              <option value="SUPERTREND_EMA">📈 1. SuperTrend + EMA Golden Ribbon</option>
              <option value="SMC_ORDER_BLOCK">💎 2. Smart Money (SMC) Order Block Bounce</option>
              <option value="FIBONACCI_RETRACE">📐 3. Fibonacci Golden Pocket 0.618</option>
              <option value="RSI_REVERSION">🎯 4. RSI Đảo Chiều Quá Bán/Quá Mua</option>
              <option value="BOLLINGER_BREAKOUT">💥 5. Bollinger Band Squeeze & Breakout</option>
              <option value="MACD_MOMENTUM">⚡ 6. MACD Momentum & Zero-Lag Cross</option>
              <option value="SR_BREAKOUT">🛡️ 7. Phá Vỡ & Retest Hỗ Trợ/Kháng Cự</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-gray-400 uppercase font-semibold block mb-1">
              Vốn Ban Đầu ($)
            </label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              className="w-full bg-[#182232] border border-[#27364e] rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-gray-400 uppercase font-semibold block mb-1">
              Rủi Ro Mỗi Lệnh (%)
            </label>
            <input
              type="number"
              step="0.5"
              value={riskPercent}
              onChange={(e) => setRiskPercent(Number(e.target.value))}
              className="w-full bg-[#182232] border border-[#27364e] rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42]">
              <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-blue-400" />
                Tỉ Lệ Thắng (Win Rate)
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {result.winRate}%
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {result.trades.filter(t => t.status === 'WIN').length} thắng / {result.totalTrades} lệnh
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42]">
              <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Tổng Lợi Nhuận
              </div>
              <div className={`text-xl font-bold font-mono mt-1 ${
                result.totalReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {formatPercent(result.totalReturnPercent)}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                Số dư: ${formatPrice(result.equityCurve[result.equityCurve.length - 1]?.balance || capital)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42]">
              <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                Profit Factor
              </div>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                {result.profitFactor}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">Sharpe Ratio: {result.sharpeRatio}</div>
            </div>

            <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42]">
              <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Sụt Giảm Tối Đa (Max DD)
              </div>
              <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                -{result.maxDrawdownPercent}%
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">Rủi ro tài khoản</div>
            </div>
          </div>

          {/* Equity Curve SVG Chart */}
          <div className="p-3.5 rounded-xl bg-[#131b28] border border-[#212e42] space-y-2">
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-400" />
              Biểu Đồ Tăng Trưởng Vốn (Equity Curve)
            </div>

            <div className="w-full h-36 relative">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                {/* Horizontal gridlines */}
                <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                {result.equityCurve.length > 1 && (() => {
                  const balances = result.equityCurve.map(e => e.balance);
                  const min = Math.min(...balances) * 0.98;
                  const max = Math.max(...balances) * 1.02;
                  const range = max - min || 1;

                  const points = result.equityCurve.map((e, idx) => {
                    const x = (idx / (result.equityCurve.length - 1)) * 100;
                    const y = 100 - ((e.balance - min) / range) * 100;
                    return `${x},${y}`;
                  }).join(' ');

                  return (
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      points={points}
                    />
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* Trade History Table */}
          <div className="rounded-xl bg-[#131b28] border border-[#212e42] overflow-hidden">
            <div className="p-3 bg-[#172233] border-b border-[#212e42] text-xs font-bold text-white uppercase tracking-wider">
              Nhật Ký Các Lệnh Khớp Lịch Sử ({result.trades.length} Lệnh)
            </div>

            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-[11px] font-mono text-left">
                <thead className="bg-[#0f1622] text-gray-400 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2">Lệnh</th>
                    <th className="p-2">Thời Gian Vào</th>
                    <th className="p-2">Giá Vào</th>
                    <th className="p-2">Giá Ra</th>
                    <th className="p-2">Lãi/Lỗ (%)</th>
                    <th className="p-2">PnL ($)</th>
                    <th className="p-2">Lý Do Đóng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2738]">
                  {result.trades.map(t => (
                    <tr key={t.id} className="hover:bg-[#182333]">
                      <td className="p-2 font-bold">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          t.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="p-2 text-gray-300">{formatTime(t.entryTime, 'full')}</td>
                      <td className="p-2 text-gray-200">${formatPrice(t.entryPrice)}</td>
                      <td className="p-2 text-gray-200">${formatPrice(t.exitPrice)}</td>
                      <td className={`p-2 font-bold ${t.profitPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPercent(t.profitPercent)}
                      </td>
                      <td className={`p-2 font-bold ${t.pnlAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.pnlAmount >= 0 ? '+' : ''}${formatPrice(t.pnlAmount)}
                      </td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          t.reason.startsWith('TP') ? 'bg-emerald-500/20 text-emerald-300' :
                          t.reason === 'SL' ? 'bg-rose-500/20 text-rose-300' : 'bg-gray-700 text-gray-300'
                        }`}>
                          {t.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
