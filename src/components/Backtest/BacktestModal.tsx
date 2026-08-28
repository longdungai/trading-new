import React, { useState, useEffect, useRef } from 'react';
import { Candle } from '../../types';
import { runBacktest, StrategyType, BacktestResult, BacktestTrade } from '../../services/backtesting/backtester';
import { formatPercent, formatPrice, formatTime } from '../../utils/formatters';
import {
  Sparkles,
  X,
  TrendingUp,
  Percent,
  ShieldAlert,
  Award,
  Activity,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Settings2,
  CheckCircle2,
  Flame,
  Zap,
} from 'lucide-react';

interface BacktestModalProps {
  candles: Candle[];
  symbolName: string;
  onClose: () => void;
}

export const BacktestModal: React.FC<BacktestModalProps> = ({ candles, symbolName, onClose }) => {
  // Test Options
  const [mode, setMode] = useState<'instant' | 'replay'>('instant');
  const [strategy, setStrategy] = useState<StrategyType>('SUPERTREND_EMA');
  const [capital, setCapital] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(2);
  const [leverage, setLeverage] = useState<number>(1);
  const [feePercent, setFeePercent] = useState<number>(0.04);
  const [tpStrategy, setTpStrategy] = useState<'TP1' | 'TP2' | 'TP3'>('TP2');

  // Simulation Replay States
  const [replayIndex, setReplayIndex] = useState<number>(() => Math.max(20, Math.floor(candles.length * 0.3)));
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(500); // ms per candle
  const timerRef = useRef<any>(null);

  // Derive active candles based on mode
  const activeCandles = mode === 'instant' ? candles : candles.slice(0, replayIndex + 1);

  // Run backtest calculation
  const result: BacktestResult = React.useMemo(() => {
    return runBacktest(activeCandles, strategy, capital, riskPercent);
  }, [activeCandles, strategy, capital, riskPercent]);

  // Adjust for leverage
  const leveragedReturn = result.totalReturnPercent * leverage;
  const leveragedBalance = capital * (1 + leveragedReturn / 100);

  // Playback timer effect
  useEffect(() => {
    if (isPlaying && mode === 'replay') {
      timerRef.current = setInterval(() => {
        setReplayIndex(prev => {
          if (prev >= candles.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, mode, candles.length, playbackSpeed]);

  const handleResetReplay = () => {
    setIsPlaying(false);
    setReplayIndex(Math.max(20, Math.floor(candles.length * 0.3)));
  };

  const handleStepNext = () => {
    setIsPlaying(false);
    setReplayIndex(prev => Math.min(candles.length - 1, prev + 1));
  };

  const currentReplayCandle = candles[replayIndex] || candles[candles.length - 1];
  const lastTrade = result.trades[result.trades.length - 1];
  const isCurrentlyInTrade = lastTrade && lastTrade.exitTime === currentReplayCandle?.time;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in">
      <div className="bg-[#0e141f] border border-[#232f44] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-[#1c2738] flex items-center justify-between bg-[#121927]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-tight font-mono">
                  Kiểm Thử & Chạy Thử Chiến Lược AI - <span className="text-blue-400">{symbolName}</span>
                </h2>
                <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                  SIMULATOR PRO
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Tùy chọn kiểm thử siêu tốc hoặc chạy thử mô phỏng từng bước (Replay Simulation)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1a2332] text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector & Quick Toggles */}
        <div className="px-3 sm:px-4 py-2.5 bg-[#0a0e16] border-b border-[#1c2738] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-[#141c28] p-1 rounded-xl border border-[#24334a]">
            <button
              onClick={() => {
                setMode('instant');
                setIsPlaying(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                mode === 'instant'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Kiểm Thử Toàn Diện (Tổng Hợp)</span>
            </button>

            <button
              onClick={() => setMode('replay')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                mode === 'replay'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>🎬 Chạy Thử Mô Phỏng (Bar Replay)</span>
            </button>
          </div>

          {/* Replay Control Bar (Visible when in Replay mode) */}
          {mode === 'replay' && (
            <div className="flex items-center gap-2 bg-[#121927] px-3 py-1.5 rounded-xl border border-[#233147] animate-in fade-in">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-1.5 rounded-lg text-white font-bold transition flex items-center gap-1 text-xs px-2.5 ${
                  isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Tạm Dừng' : 'Chạy Thử'}</span>
              </button>

              <button
                onClick={handleStepNext}
                disabled={replayIndex >= candles.length - 1}
                title="Tiến 1 nến tiếp theo"
                className="p-1.5 rounded-lg bg-[#1a2436] hover:bg-[#233147] text-gray-200 disabled:opacity-40 transition"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleResetReplay}
                title="Đặt lại từ đầu"
                className="p-1.5 rounded-lg bg-[#1a2436] hover:bg-[#233147] text-gray-200 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-gray-700 mx-0.5" />

              {/* Playback Speed Chips */}
              <div className="flex items-center gap-1 text-[10px] font-mono">
                {[
                  { label: '1x', speed: 800 },
                  { label: '2x', speed: 400 },
                  { label: '5x', speed: 150 },
                ].map(s => (
                  <button
                    key={s.label}
                    onClick={() => setPlaybackSpeed(s.speed)}
                    className={`px-1.5 py-0.5 rounded font-bold ${
                      playbackSpeed === s.speed ? 'bg-blue-600 text-white' : 'bg-[#1b2538] text-gray-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Progress */}
              <div className="text-[11px] font-mono font-bold text-cyan-300 ml-1">
                Nến: {replayIndex + 1}/{candles.length} ({Math.round(((replayIndex + 1) / candles.length) * 100)}%)
              </div>
            </div>
          )}
        </div>

        {/* Strategy & Custom Parameters Toolbar */}
        <div className="p-3 sm:p-4 bg-[#111824] border-b border-[#1c2738] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {/* Strategy Select */}
          <div className="sm:col-span-2">
            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1 flex items-center gap-1">
              <Settings2 className="w-3 h-3 text-blue-400" />
              Chiến Lược Giao Dịch
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as StrategyType)}
              className="w-full bg-[#182232] border border-[#27364e] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
            >
              <option value="SUPERTREND_EMA">📈 1. SuperTrend + EMA Golden Ribbon</option>
              <option value="SMC_ORDER_BLOCK">💎 2. Smart Money (SMC) Order Blocks</option>
              <option value="FIBONACCI_RETRACE">📐 3. Fibonacci Golden Pocket 0.618</option>
              <option value="RSI_REVERSION">🎯 4. RSI Đảo Chiều Quá Bán/Quá Mua</option>
              <option value="BOLLINGER_BREAKOUT">💥 5. Bollinger Band Squeeze & Breakout</option>
              <option value="MACD_MOMENTUM">⚡ 6. MACD Momentum & Zero-Lag</option>
              <option value="SR_BREAKOUT">🛡️ 7. Phá Vỡ & Retest Hỗ Trợ/Kháng Cự</option>
            </select>
          </div>

          {/* Capital Input */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
              Vốn Ban Đầu ($)
            </label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Math.max(100, Number(e.target.value)))}
              className="w-full bg-[#182232] border border-[#27364e] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Risk Per Trade */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
              Rủi Ro Mỗi Lệnh (%)
            </label>
            <select
              value={riskPercent}
              onChange={(e) => setRiskPercent(Number(e.target.value))}
              className="w-full bg-[#182232] border border-[#27364e] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
            >
              <option value={1}>1% (An toàn)</option>
              <option value={2}>2% (Tiêu chuẩn)</option>
              <option value={3}>3% (Tăng trưởng)</option>
              <option value={5}>5% (Mạo hiểm)</option>
            </select>
          </div>

          {/* Leverage */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
              Đòn Bẩy (Leverage)
            </label>
            <select
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full bg-[#182232] border border-[#27364e] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
            >
              <option value={1}>Spot (1x)</option>
              <option value={3}>Futures 3x</option>
              <option value={5}>Futures 5x</option>
              <option value={10}>Futures 10x</option>
              <option value={20}>Futures 20x</option>
            </select>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42] shadow-sm">
              <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-blue-400" />
                Tỉ Lệ Thắng (Win Rate)
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-1">
                {result.winRate}%
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {result.trades.filter(t => t.status === 'WIN').length} thắng / {result.totalTrades} lệnh
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42] shadow-sm">
              <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Tổng Lợi Nhuận ({leverage > 1 ? `${leverage}x` : 'Spot'})
              </div>
              <div className={`text-lg sm:text-xl font-bold font-mono mt-1 ${
                leveragedReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {formatPercent(leveragedReturn)}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                Số dư: ${formatPrice(leveragedBalance)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42] shadow-sm">
              <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                Profit Factor
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-amber-400 mt-1">
                {result.profitFactor}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">Sharpe: {result.sharpeRatio}</div>
            </div>

            <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42] shadow-sm">
              <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Sụt Giảm Tối Đa (Max DD)
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-rose-400 mt-1">
                -{result.maxDrawdownPercent}%
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">Rủi ro tài khoản</div>
            </div>
          </div>

          {/* Active Replay Candle Banner (When in Replay Mode) */}
          {mode === 'replay' && currentReplayCandle && (
            <div className="p-2.5 rounded-xl bg-[#151f2e] border border-blue-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                <span className="text-xs font-mono font-bold text-white">
                  Nến Hiện Tại ({formatTime(currentReplayCandle.time, 'full')}):
                </span>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  Đóng cửa: ${formatPrice(currentReplayCandle.close)}
                </span>
              </div>
              <div className="text-xs font-mono text-gray-300">
                Cao: ${formatPrice(currentReplayCandle.high)} • Thấp: ${formatPrice(currentReplayCandle.low)}
              </div>
            </div>
          )}

          {/* Equity Curve SVG Chart */}
          <div className="p-3.5 rounded-xl bg-[#131b28] border border-[#212e42] space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-400" />
                Đồ Thị Tăng Trưởng Tài Khoản (Equity Curve)
              </div>
              <div className="text-[10px] font-mono text-gray-400">
                Khởi điểm: ${formatPrice(capital)} $\to$ Hiện tại: ${formatPrice(leveragedBalance)}
              </div>
            </div>

            <div className="w-full h-32 sm:h-36 relative">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
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
                    return `${x},${Math.max(5, Math.min(95, y))}`;
                  }).join(' ');

                  return (
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
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
            <div className="p-2.5 sm:p-3 bg-[#172233] border-b border-[#212e42] flex items-center justify-between text-xs font-bold text-white uppercase tracking-wider">
              <span>Nhật Ký Các Lệnh Đã Chạy Thử ({result.trades.length} Lệnh)</span>
              <span className="text-[11px] font-mono text-gray-400">
                Thắng: <span className="text-emerald-400">{result.trades.filter(t => t.status === 'WIN').length}</span> • Thua: <span className="text-rose-400">{result.trades.filter(t => t.status === 'LOSS').length}</span>
              </span>
            </div>

            <div className="max-h-48 sm:max-h-56 overflow-y-auto">
              <table className="w-full text-[11px] font-mono text-left">
                <thead className="bg-[#0f1622] text-gray-400 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2">Lệnh</th>
                    <th className="p-2">Vào Lệnh</th>
                    <th className="p-2">Giá Vào</th>
                    <th className="p-2">Giá Ra</th>
                    <th className="p-2">Lãi/Lỗ (%)</th>
                    <th className="p-2">PnL ($)</th>
                    <th className="p-2">Kết Quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2738]">
                  {result.trades.map(t => {
                    const tradePnl = t.pnlAmount * leverage;
                    const tradePct = t.profitPercent * leverage;

                    return (
                      <tr key={t.id} className="hover:bg-[#182333]">
                        <td className="p-2 font-bold">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            t.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="p-2 text-gray-300">{formatTime(t.entryTime, 'time')}</td>
                        <td className="p-2 text-gray-200">${formatPrice(t.entryPrice)}</td>
                        <td className="p-2 text-gray-200">${formatPrice(t.exitPrice)}</td>
                        <td className={`p-2 font-bold ${tradePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatPercent(tradePct)}
                        </td>
                        <td className={`p-2 font-bold ${tradePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tradePnl >= 0 ? '+' : ''}${formatPrice(tradePnl)}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
