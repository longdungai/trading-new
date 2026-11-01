import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Candle } from '../../types';
import {
  runBacktest,
  runStrategyTournament,
  runMonteCarloEquityStressTest,
  StrategyType,
  BacktestMarketProfile,
  ProBacktestResult,
} from '../../services/backtesting/backtester';
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
  Zap,
  Trophy,
  Dice5,
} from 'lucide-react';

interface BacktestModalProps {
  candles: Candle[];
  symbolName: string;
  quoteAsset?: string;
  onClose: () => void;
}

export const BacktestModal: React.FC<BacktestModalProps> = ({
  candles,
  symbolName,
  quoteAsset = 'USD',
  onClose,
}) => {
  const isVND =
    quoteAsset === 'VND' ||
    symbolName.includes('VN') ||
    ['FPT', 'HPG', 'VIC', 'VHM', 'SJC', 'MWG', 'MSN', 'GAS', 'STB', 'VCB', 'TCB', 'SSI', 'VPB'].includes(
      symbolName
    );
  const isCrypto = quoteAsset === 'USDT';

  const defaultCapital = isVND ? 100000000 : 10000;
  const prefix = isVND ? '' : '$';
  const priceSuffix = isVND ? 'k' : '';

  const defaultMarketProfile: BacktestMarketProfile = isVND
    ? 'VN_EQUITY_T2'
    : isCrypto
      ? 'CRYPTO_FUTURES'
      : 'GLOBAL_CFD';

  // Test Options
  const [mode, setMode] = useState<'instant' | 'tournament' | 'replay'>('instant');
  const [strategy, setStrategy] = useState<StrategyType>('KRONOS_AI_FOUNDATION');
  const [marketProfile, setMarketProfile] = useState<BacktestMarketProfile>(defaultMarketProfile);
  const [capital, setCapital] = useState<number>(defaultCapital);
  const [riskPercent, setRiskPercent] = useState<number>(2);
  const [leverage, setLeverage] = useState<number>(1);

  // Simulation Replay States
  const [replayIndex, setReplayIndex] = useState<number>(() =>
    Math.max(52, Math.floor(candles.length * 0.35))
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(500);
  const timerRef = useRef<any>(null);

  const stopPlayback = () => {
    setIsPlaying(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleModeChange = (newMode: 'instant' | 'tournament' | 'replay') => {
    stopPlayback();
    setMode(newMode);
  };

  const handleClose = () => {
    stopPlayback();
    onClose();
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) stopPlayback();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPlayback();
    };
  }, []);

  const activeCandles = mode === 'replay' ? candles.slice(0, replayIndex + 1) : candles;

  const result: ProBacktestResult = useMemo(() => {
    return runBacktest(activeCandles, strategy, capital, riskPercent, { marketProfile });
  }, [activeCandles, strategy, capital, riskPercent, marketProfile]);

  const tournamentResults: ProBacktestResult[] = useMemo(() => {
    if (mode !== 'tournament') return [];
    return runStrategyTournament(candles, capital, riskPercent, { marketProfile });
  }, [mode, candles, capital, riskPercent, marketProfile]);

  const monteCarlo = useMemo(() => {
    return runMonteCarloEquityStressTest(result.trades, capital, 1000);
  }, [result.trades, capital]);

  const leveragedReturn = result.totalReturnPercent * leverage;
  const leveragedBalance = capital * (1 + leveragedReturn / 100);

  useEffect(() => {
    if (isPlaying && mode === 'replay') {
      timerRef.current = setInterval(() => {
        setReplayIndex(prev => {
          if (prev >= candles.length - 1) {
            stopPlayback();
            return prev;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, mode, candles.length, playbackSpeed]);

  const handleResetReplay = () => {
    stopPlayback();
    setReplayIndex(Math.max(52, Math.floor(candles.length * 0.35)));
  };

  const handleStepNext = () => {
    stopPlayback();
    setReplayIndex(prev => Math.min(candles.length - 1, prev + 1));
  };

  const currentReplayCandle = candles[replayIndex] || candles[candles.length - 1];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in">
      <div className="bg-[#0e141f] border border-[#232f44] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-[#1c2738] flex items-center justify-between bg-[#121927]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-tight font-mono">
                  Backtest Pro V2 & Đấu Trường Chiến Lược —{' '}
                  <span className="text-blue-400">{symbolName}</span>
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isVND
                      ? 'bg-red-500/20 text-red-300 border-red-500/30'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  }`}
                >
                  {isVND ? 'CHUẨN CƠ SỞ VNĐ (T+2)' : 'CHUẨN QUỐC TẾ USD'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">{result.marketProfileLabel}</p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-[#1a2332] text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="px-3 sm:px-4 py-2.5 bg-[#0a0e16] border-b border-[#1c2738] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-[#141c28] p-1 rounded-xl border border-[#24334a] flex-wrap">
            <button
              onClick={() => handleModeChange('instant')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                mode === 'instant'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Kiểm Thử Thực Chiến + Monte Carlo</span>
            </button>

            <button
              onClick={() => handleModeChange('tournament')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                mode === 'tournament'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold shadow'
                  : 'text-amber-300 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>🏆 Đấu Trường 10 Chiến Lược</span>
            </button>

            <button
              onClick={() => handleModeChange('replay')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                mode === 'replay'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>🎬 Mô Phỏng Từng Nến</span>
            </button>
          </div>

          {mode === 'replay' && (
            <div className="flex items-center gap-2 bg-[#121927] px-3 py-1.5 rounded-xl border border-[#233147]">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-1.5 rounded-lg text-white font-bold transition flex items-center gap-1 text-xs px-2.5 ${
                  isPlaying
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Tạm Dừng' : 'Chạy'}</span>
              </button>

              <button
                onClick={handleStepNext}
                disabled={replayIndex >= candles.length - 1}
                className="p-1.5 rounded-lg bg-[#1a2436] hover:bg-[#233147] text-gray-200 disabled:opacity-40 transition"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleResetReplay}
                className="p-1.5 rounded-lg bg-[#1a2436] hover:bg-[#233147] text-gray-200 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

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
                      playbackSpeed === s.speed
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#1b2538] text-gray-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-mono font-bold text-cyan-300">
                {replayIndex + 1}/{candles.length}
              </div>
            </div>
          )}
        </div>

        {/* Parameters Toolbar */}
        <div className="p-3 sm:p-4 bg-[#111824] border-b border-[#1c2738] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="lg:col-span-2">
            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1 flex items-center gap-1">
              <Settings2 className="w-3 h-3 text-blue-400" />
              Chiến Lược Giao Dịch
            </label>
            <select
              value={strategy}
              onChange={e => {
                stopPlayback();
                setStrategy(e.target.value as StrategyType);
              }}
              className="w-full bg-[#182232] border border-[#27364e] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
            >
              <option value="KRONOS_AI_FOUNDATION">🤖 0. Kronos Foundation Model (AAAI 2026)</option>
              <option value="SPOT_ACCUMULATION">🎯 1. Kịch Bản Spot & Tích Sản DCA</option>
              <option value="DAILY_DAYTRADING">⚡ 2. Kịch Bản Trading Daily (Lướt Sóng)</option>
              <option value="SUPERTREND_EMA">📈 3. SuperTrend + EMA Golden Ribbon</option>
              <option value="SMC_ORDER_BLOCK">💎 4. Smart Money (SMC) Order Blocks</option>
              <option value="FIBONACCI_RETRACE">📐 5. Fibonacci Golden Pocket 0.618</option>
              <option value="RSI_REVERSION">🎯 6. RSI Đảo Chiều Quá Bán/Quá Mua</option>
              <option value="BOLLINGER_BREAKOUT">💥 7. Bollinger Band Squeeze & Breakout</option>
              <option value="MACD_MOMENTUM">⚡ 8. MACD Momentum & Zero-Lag</option>
              <option value="SR_BREAKOUT">🛡️ 9. Phá Vỡ & Retest Hỗ Trợ/Kháng Cự</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-amber-300 uppercase font-semibold block mb-1">
              Ma Sát Phí & Quy Tắc Sàn
            </label>
            <select
              value={marketProfile}
              onChange={e => setMarketProfile(e.target.value as BacktestMarketProfile)}
              className="w-full bg-[#182232] border border-amber-500/40 rounded-lg px-2 py-1.5 text-xs font-semibold text-amber-200 focus:outline-none"
            >
              <option value="VN_EQUITY_T2">VN30 Cơ sở (Long • T+2 • Phí+Thuế)</option>
              <option value="CRYPTO_FUTURES">Crypto Futures (Taker 0.05% + Slippage)</option>
              <option value="GLOBAL_CFD">Vàng / US Stock (Spread 0.06%)</option>
              <option value="ZERO_FRICTION">Lý thuyết (0% Phí & Không trượt)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
              Vốn Ban Đầu ({isVND ? 'VNĐ' : '$'})
            </label>
            <input
              type="number"
              value={capital}
              onChange={e => setCapital(Math.max(100, Number(e.target.value)))}
              className="w-full bg-[#182232] border border-[#27364e] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
              Rủi Ro / Lệnh
            </label>
            <select
              value={riskPercent}
              onChange={e => setRiskPercent(Number(e.target.value))}
              className="w-full bg-[#182232] border border-[#27364e] rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-white"
            >
              <option value={1}>1% (An toàn)</option>
              <option value={2}>2% (Tiêu chuẩn)</option>
              <option value={3}>3% (Tăng trưởng)</option>
              <option value={5}>5% (Mạo hiểm)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
              Đòn Bẩy
            </label>
            <select
              value={leverage}
              onChange={e => setLeverage(Number(e.target.value))}
              className="w-full bg-[#182232] border border-[#27364e] rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-white"
            >
              <option value={1}>1x (Tiền thịt)</option>
              <option value={2}>2x (Margin 1:1)</option>
              <option value={3}>3x</option>
              <option value={5}>5x</option>
              <option value={10}>10x</option>
            </select>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {mode === 'tournament' ? (
            /* ================= TOURNAMENT LEADERBOARD VIEW ================= */
            <div className="rounded-xl bg-[#131b28] border border-amber-500/35 overflow-hidden">
              <div className="p-3 bg-gradient-to-r from-amber-950/50 via-[#162032] to-[#131b28] border-b border-[#212e42] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-extrabold text-white uppercase tracking-wide">
                    Bảng Xếp Hạng Thực Chiến Đồng Loạt 10 Chiến Lược trên {symbolName}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-cyan-300">
                  Buy & Hold cơ sở:{' '}
                  <strong>{formatPercent(tournamentResults[0]?.buyAndHoldReturnPercent || 0)}</strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="bg-[#0d1420] text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Hạng</th>
                      <th className="p-2.5">Chiến Lược</th>
                      <th className="p-2.5">Số Lệnh</th>
                      <th className="p-2.5">Win Rate</th>
                      <th className="p-2.5">Lợi Nhuận Ròng</th>
                      <th className="p-2.5">Alpha vs Hold</th>
                      <th className="p-2.5">Max DD</th>
                      <th className="p-2.5">Profit Factor</th>
                      <th className="p-2.5">Sharpe</th>
                      <th className="p-2.5 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2738]">
                    {tournamentResults.map((row, idx) => (
                      <tr
                        key={row.strategyKey}
                        className={`hover:bg-[#192538] transition ${
                          idx === 0 ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        <td className="p-2.5 font-extrabold">
                          {idx === 0 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500 text-black">#1 TOP</span>
                          ) : (
                            <span className="text-slate-400">#{idx + 1}</span>
                          )}
                        </td>
                        <td className="p-2.5 font-sans font-bold text-white">{row.strategyName}</td>
                        <td className="p-2.5 text-slate-300">{row.totalTrades}</td>
                        <td className="p-2.5 text-cyan-300 font-bold">{row.winRate}%</td>
                        <td
                          className={`p-2.5 font-extrabold ${
                            row.totalReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatPercent(row.totalReturnPercent)}
                        </td>
                        <td
                          className={`p-2.5 font-bold ${
                            row.alphaVsBuyHoldPercent >= 0 ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                        >
                          {row.alphaVsBuyHoldPercent >= 0 ? '+' : ''}
                          {row.alphaVsBuyHoldPercent}%
                        </td>
                        <td className="p-2.5 text-rose-400">-{row.maxDrawdownPercent}%</td>
                        <td className="p-2.5 text-amber-300 font-bold">{row.profitFactor}</td>
                        <td className="p-2.5 text-slate-200">{row.sharpeRatio}</td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setStrategy(row.strategyKey);
                              setMode('instant');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans font-bold text-[10.5px]"
                          >
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42]">
                  <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-blue-400" />
                    Win Rate
                  </div>
                  <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-1">
                    {result.winRate}%
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {result.trades.filter(t => t.status === 'WIN').length}/{result.totalTrades} lệnh thắng
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42]">
                  <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Lợi Nhuận Ròng ({leverage}x)
                  </div>
                  <div
                    className={`text-lg sm:text-xl font-bold font-mono mt-1 ${
                      leveragedReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatPercent(leveragedReturn)}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                    Cuối kỳ:{' '}
                    {isVND
                      ? `${(leveragedBalance / 1000000).toFixed(1)}Tr VNĐ`
                      : `$${formatPrice(leveragedBalance)}`}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42]">
                  <div className="text-[10px] text-gray-400 uppercase font-semibold">
                    So Với Buy & Hold
                  </div>
                  <div
                    className={`text-lg sm:text-xl font-bold font-mono mt-1 ${
                      result.alphaVsBuyHoldPercent >= 0 ? 'text-cyan-300' : 'text-amber-300'
                    }`}
                  >
                    {result.alphaVsBuyHoldPercent >= 0 ? '+' : ''}
                    {result.alphaVsBuyHoldPercent}%
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Hold: {formatPercent(result.buyAndHoldReturnPercent)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42]">
                  <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    Profit Factor / Sharpe
                  </div>
                  <div className="text-lg sm:text-xl font-bold font-mono text-amber-400 mt-1">
                    {result.profitFactor}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Sharpe {result.sharpeRatio} • Calmar {result.calmarRatio}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#131b28] border border-[#212e42]">
                  <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    Max Drawdown & Phí
                  </div>
                  <div className="text-lg sm:text-xl font-bold font-mono text-rose-400 mt-1">
                    -{result.maxDrawdownPercent}%
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                    Phí+Thuế:{' '}
                    {isVND
                      ? `${(result.totalFeesPaid / 1000000).toFixed(2)}Tr`
                      : `$${formatPrice(result.totalFeesPaid)}`}
                  </div>
                </div>
              </div>

              {/* Active Replay Candle Banner */}
              {mode === 'replay' && currentReplayCandle && (
                <div className="p-2.5 rounded-xl bg-[#151f2e] border border-blue-500/30 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isPlaying ? 'bg-blue-400 animate-ping' : 'bg-gray-500'
                      }`}
                    />
                    <span className="text-xs font-mono font-bold text-white">
                      Nến ({formatTime(currentReplayCandle.time, 'full')}):
                    </span>
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {prefix}
                      {formatPrice(currentReplayCandle.close)}
                      {priceSuffix}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-gray-300">
                    Cao: {prefix}
                    {formatPrice(currentReplayCandle.high)}
                    {priceSuffix} • Thấp: {prefix}
                    {formatPrice(currentReplayCandle.low)}
                    {priceSuffix}
                  </div>
                </div>
              )}

              {/* Monte Carlo 1,000-Iteration Stress Test Card */}
              {monteCarlo.iterations > 0 && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#11192a] to-[#131b28] border border-indigo-500/35 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs font-extrabold text-indigo-200 uppercase flex items-center gap-1.5">
                      <Dice5 className="w-4 h-4 text-indigo-400" />
                      Kiểm Định Chịu Đựng Rủi Ro Monte Carlo (1,000 Chuỗi Xáo Trộn Lệnh)
                    </div>
                    <span className="text-[10.5px] font-mono text-slate-400">
                      Đo lường kịch bản chuỗi thua liên tiếp xấu nhất (Tail-Risk 95%)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                    <div className="p-2 rounded-lg bg-[#0b111d] border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-sans">Kỳ vọng Trung vị (P50)</div>
                      <div
                        className={`font-bold text-sm ${
                          monteCarlo.medianReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatPercent(monteCarlo.medianReturnPercent)}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#0b111d] border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-sans">Kịch bản Xấu 5% (P05)</div>
                      <div
                        className={`font-bold text-sm ${
                          monteCarlo.p05WorstReturnPercent >= 0 ? 'text-cyan-300' : 'text-amber-300'
                        }`}
                      >
                        {formatPercent(monteCarlo.p05WorstReturnPercent)}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#0b111d] border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-sans">Sụt giảm Xấu 95% (MC95 DD)</div>
                      <div className="font-bold text-sm text-rose-400">
                        -{monteCarlo.p95WorstDrawdownPercent}%
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#0b111d] border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-sans">Xác suất Sụt &ge; 30% Vốn</div>
                      <div
                        className={`font-bold text-sm ${
                          monteCarlo.riskOfRuin30Percent <= 5
                            ? 'text-emerald-400'
                            : monteCarlo.riskOfRuin30Percent <= 20
                              ? 'text-amber-300'
                              : 'text-rose-400'
                        }`}
                      >
                        {monteCarlo.riskOfRuin30Percent}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Equity Curve SVG Chart */}
              <div className="p-3.5 rounded-xl bg-[#131b28] border border-[#212e42] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Đồ Thị Tăng Trưởng Tài Khoản (Equity Curve Thực Chiến)
                  </div>
                  <div className="text-[10px] font-mono text-gray-400">
                    Kỳ vọng mỗi lệnh: {result.expectancyPercent >= 0 ? '+' : ''}
                    {result.expectancyPercent}%
                  </div>
                </div>

                <div className="w-full h-32 sm:h-36 relative">
                  <svg
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                  >
                    <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                    {result.equityCurve.length > 1 &&
                      (() => {
                        const balances = result.equityCurve.map(e => e.balance);
                        const min = Math.min(...balances) * 0.98;
                        const max = Math.max(...balances) * 1.02;
                        const range = max - min || 1;

                        const points = result.equityCurve
                          .map((e, idx) => {
                            const x = (idx / (result.equityCurve.length - 1)) * 100;
                            const y = 100 - ((e.balance - min) / range) * 100;
                            return `${x},${Math.max(5, Math.min(95, y))}`;
                          })
                          .join(' ');

                        return <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={points} />;
                      })()}
                  </svg>
                </div>
              </div>

              {/* Trade History Table */}
              <div className="rounded-xl bg-[#131b28] border border-[#212e42] overflow-hidden">
                <div className="p-2.5 sm:p-3 bg-[#172233] border-b border-[#212e42] flex items-center justify-between text-xs font-bold text-white uppercase tracking-wider">
                  <span>Nhật Ký Các Lệnh Thực Chiến ({result.trades.length} Lệnh)</span>
                  <span className="text-[11px] font-mono text-gray-400">
                    Thắng:{' '}
                    <span className="text-emerald-400">
                      {result.trades.filter(t => t.status === 'WIN').length}
                    </span>{' '}
                    • Thua:{' '}
                    <span className="text-rose-400">
                      {result.trades.filter(t => t.status === 'LOSS').length}
                    </span>
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
                        <th className="p-2">Lãi/Lỗ Ròng</th>
                        <th className="p-2">PnL ({isVND ? 'VNĐ' : '$'})</th>
                        <th className="p-2">Lý Do</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c2738]">
                      {result.trades.map(t => {
                        const tradePnl = t.pnlAmount * leverage;
                        const tradePct = t.profitPercent * leverage;

                        return (
                          <tr key={t.id} className="hover:bg-[#182333]">
                            <td className="p-2 font-bold">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  t.type === 'BUY'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}
                              >
                                {t.type}
                              </span>
                            </td>
                            <td className="p-2 text-gray-300">{formatTime(t.entryTime, 'time')}</td>
                            <td className="p-2 text-gray-200">
                              {prefix}
                              {formatPrice(t.entryPrice)}
                              {priceSuffix}
                            </td>
                            <td className="p-2 text-gray-200">
                              {prefix}
                              {formatPrice(t.exitPrice)}
                              {priceSuffix}
                            </td>
                            <td
                              className={`p-2 font-bold ${
                                tradePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatPercent(tradePct)}
                            </td>
                            <td
                              className={`p-2 font-bold ${
                                tradePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {tradePnl >= 0 ? '+' : ''}
                              {isVND
                                ? `${(tradePnl / 1000000).toFixed(2)} Triệu`
                                : `$${formatPrice(tradePnl)}`}
                            </td>
                            <td className="p-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  t.reason.startsWith('TP')
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : t.reason === 'SL'
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : 'bg-gray-700 text-gray-300'
                                }`}
                              >
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
