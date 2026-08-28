import React, { useState, useEffect } from 'react';
import { StrategyAnalysisHub, StrategyHubItem, TradeSetup } from '../../types';
import {
  ShieldAlert,
  Crosshair,
  ArrowUpRight,
  Scale,
  Percent,
  Sparkles,
  Zap,
  CheckCircle2,
  Layers,
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Trash2,
  X,
  Play,
  Check,
  Award,
  Clock,
} from 'lucide-react';
import { formatPercent, formatPrice, formatTime } from '../../utils/formatters';
import {
  UserPaperTrade,
  getUserPaperTrades,
  addUserPaperTrade,
  updateOpenPaperTradesWithLivePrice,
  closePaperTradeManually,
  clearUserPaperTrades,
} from '../../services/paperTrading/userPaperTrading';

interface TradeSetupCardProps {
  strategyHub?: StrategyAnalysisHub | null;
  setup?: TradeSetup | null;
  quoteAsset?: string;
  symbol?: string;
}

export const TradeSetupCard: React.FC<TradeSetupCardProps> = ({
  strategyHub,
  setup,
  quoteAsset = 'USD',
  symbol = '',
}) => {
  const isVND = quoteAsset === 'VND' || symbol.includes('VN') || ['FPT', 'HPG', 'VIC', 'VHM', 'SJC', 'MWG', 'MSN', 'SSI', 'VCB'].includes(symbol);
  const prefix = isVND ? '' : '$';
  const suffix = isVND ? 'k VNĐ' : '';
  const priceSuffix = isVND ? 'k' : '';

  // Active selected strategy in the Hub
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('best');

  // Paper Testing state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [paperTrades, setPaperTrades] = useState<UserPaperTrade[]>(() => getUserPaperTrades());
  const [activeTab, setActiveTab] = useState<'strategy' | 'active_trades' | 'history' | 'stats'>('strategy');

  // Test Order Form Inputs
  const [testTpTarget, setTestTpTarget] = useState<'TP1' | 'TP2' | 'TP3'>('TP2');
  const [testCapital, setTestCapital] = useState<number>(isVND ? 10000000 : 1000);
  const [testLeverage, setTestLeverage] = useState<number>(1);
  const [testEntryType, setTestEntryType] = useState<'current' | 'entry_zone'>('entry_zone');

  // Derive current display item
  const currentItem: StrategyHubItem = React.useMemo(() => {
    if (!strategyHub || !strategyHub.strategies || strategyHub.strategies.length === 0) {
      if (setup) {
        return {
          id: 'setup',
          name: setup.strategyName,
          category: 'Chiến Lược Mặc Định',
          description: setup.strategyReason,
          action: setup.action,
          score: 80,
          entryZone: setup.entryZone,
          stopLoss: setup.stopLoss,
          takeProfit1: setup.takeProfit1,
          takeProfit2: setup.takeProfit2,
          takeProfit3: setup.takeProfit3,
          riskRewardRatio: setup.riskRewardRatio,
          winProbability: setup.winProbability,
          triggers: [setup.strategyReason],
          riskLevel: setup.riskLevel,
          isOptimal: true,
        };
      }
      return {} as StrategyHubItem;
    }

    if (selectedStrategyId === 'best') {
      return strategyHub.bestStrategy;
    }
    const found = strategyHub.strategies.find(s => s.id === selectedStrategyId);
    return found || strategyHub.bestStrategy;
  }, [strategyHub, setup, selectedStrategyId]);

  const currentPrice = strategyHub ? strategyHub.currentPrice : (setup?.currentPrice || 100);
  const activeSymbol = strategyHub?.symbol || setup?.symbol || symbol;

  // Real-time listener for open trades: update PnL and trigger SL/TP
  useEffect(() => {
    if (currentPrice > 0 && activeSymbol) {
      const updated = updateOpenPaperTradesWithLivePrice(activeSymbol, currentPrice);
      setPaperTrades(updated);
    }
  }, [currentPrice, activeSymbol]);

  if (!currentItem.name) return null;

  const isBuy = currentItem.action === 'STRONG_BUY' || currentItem.action === 'BUY';
  const isSell = currentItem.action === 'STRONG_SELL' || currentItem.action === 'SELL';

  const slDiffPct = currentPrice > 0 ? ((currentItem.stopLoss - currentPrice) / currentPrice) * 100 : 0;
  const tp1DiffPct = currentPrice > 0 ? ((currentItem.takeProfit1 - currentPrice) / currentPrice) * 100 : 0;
  const tp2DiffPct = currentPrice > 0 ? ((currentItem.takeProfit2 - currentPrice) / currentPrice) * 100 : 0;
  const tp3DiffPct = currentPrice > 0 ? ((currentItem.takeProfit3 - currentPrice) / currentPrice) * 100 : 0;

  // Handle open paper trade
  const handleOpenTestTrade = () => {
    const entry = testEntryType === 'current' ? currentPrice : currentItem.entryZone[0];
    const tpPrice =
      testTpTarget === 'TP1'
        ? currentItem.takeProfit1
        : testTpTarget === 'TP2'
        ? currentItem.takeProfit2
        : currentItem.takeProfit3;

    addUserPaperTrade({
      symbol: activeSymbol,
      strategyName: currentItem.name,
      strategyId: currentItem.id,
      action: isBuy ? 'BUY' : isSell ? 'SELL' : 'BUY',
      entryPrice: entry,
      stopLoss: currentItem.stopLoss,
      takeProfit: tpPrice,
      tpTargetLabel: testTpTarget,
      capital: testCapital,
      leverage: testLeverage,
      quoteAsset: quoteAsset,
    });

    setPaperTrades(getUserPaperTrades());
    setIsTestModalOpen(false);
    setActiveTab('active_trades');
  };

  // Close trade manually
  const handleManualClose = (id: string) => {
    const updated = closePaperTradeManually(id, currentPrice);
    setPaperTrades(updated);
  };

  // Clear all trades
  const handleClearAllTrades = () => {
    if (confirm('Bạn có chắc chắn muốn xóa sạch toàn bộ lịch sử test cũ để bắt đầu thống kê mới?')) {
      clearUserPaperTrades();
      setPaperTrades([]);
    }
  };

  // Compute performance statistics based ONLY on user tested trades
  const closedTrades = paperTrades.filter(t => t.status !== 'OPEN');
  const openTrades = paperTrades.filter(t => t.status === 'OPEN');
  const winTrades = closedTrades.filter(t => t.pnlPercent > 0);
  const lossTrades = closedTrades.filter(t => t.pnlPercent <= 0);
  const userWinRate = closedTrades.length > 0 ? Math.round((winTrades.length / closedTrades.length) * 100) : 0;
  const totalUserPnL = closedTrades.reduce((sum, t) => sum + t.pnlAmount, 0);

  return (
    <div className="p-3 sm:p-4 rounded-xl bg-[#101622] border border-[#1f2a3e] flex flex-col gap-3 sm:gap-3.5 shadow-xl select-none">
      {/* Top Header & Sub-Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${
            isBuy
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : isSell
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}>
            <Crosshair className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Chiến Lược Đề Xuất</span>
              {currentItem.isOptimal && (
                <span className="px-1.5 py-0.2 rounded bg-blue-600/30 border border-blue-500/50 text-blue-300 text-[9px] font-bold flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" /> TỐI ƯU
                </span>
              )}
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-400 truncate max-w-[170px] sm:max-w-[200px]">{currentItem.category}</div>
          </div>
        </div>

        {/* Action Badge */}
        <div className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold font-mono uppercase tracking-wider border shadow-md ${
          currentItem.action === 'STRONG_BUY'
            ? 'bg-emerald-600 text-white border-emerald-400 glow-green'
            : currentItem.action === 'BUY'
            ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
            : currentItem.action === 'STRONG_SELL'
            ? 'bg-rose-600 text-white border-rose-400 glow-red'
            : currentItem.action === 'SELL'
            ? 'bg-rose-600/30 text-rose-300 border-rose-500/50'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        }`}>
          {currentItem.action.replace('_', ' ')}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-1 border-b border-[#1c2738] pb-1.5 text-[10px] font-bold">
        <button
          onClick={() => setActiveTab('strategy')}
          className={`px-2.5 py-1 rounded-lg transition ${
            activeTab === 'strategy' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white bg-[#141b27]'
          }`}
        >
          Kế Hoạch Lệnh
        </button>
        <button
          onClick={() => setActiveTab('active_trades')}
          className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
            activeTab === 'active_trades' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white bg-[#141b27]'
          }`}
        >
          <span>Lệnh Đang Test</span>
          {openTrades.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-black">
              {openTrades.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
            activeTab === 'stats' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white bg-[#141b27]'
          }`}
        >
          <Award className="w-3 h-3 text-amber-300" />
          <span>Thống Kê Của Bạn</span>
          {closedTrades.length > 0 && (
            <span className="text-[9px] opacity-75">({closedTrades.length})</span>
          )}
        </button>
      </div>

      {/* ================= TAB 1: STRATEGY DETAILS ================= */}
      {activeTab === 'strategy' && (
        <div className="space-y-3">
          {/* Multi-Strategy Consensus Bar */}
          {strategyHub && (
            <div className="p-2 rounded-lg bg-[#0d121c] border border-[#1b2536] space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400 font-semibold flex items-center gap-1">
                  <Layers className="w-3 h-3 text-blue-400" />
                  Đồng Thuận ({strategyHub.strategies.length} thuật toán):
                </span>
                <span className={`font-bold font-mono ${
                  strategyHub.overallConsensus.includes('BULLISH') ? 'text-emerald-400' :
                  strategyHub.overallConsensus.includes('BEARISH') ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  {strategyHub.confluenceCount.buy} MUA • {strategyHub.confluenceCount.sell} BÁN • {strategyHub.confluenceCount.neutral} CHỜ
                </span>
              </div>

              {/* Strategy Quick Selector Pills */}
              <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar whitespace-nowrap">
                <button
                  onClick={() => setSelectedStrategyId('best')}
                  className={`px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap transition flex items-center gap-1 shrink-0 ${
                    selectedStrategyId === 'best'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-[#151e2c] text-gray-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  Tối Ưu Nhất
                </button>

                {strategyHub.strategies.map(s => {
                  const sBuy = s.action.includes('BUY');
                  const sSell = s.action.includes('SELL');
                  const isSelected = selectedStrategyId === s.id;

                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStrategyId(s.id)}
                      className={`px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap transition flex items-center gap-1 shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-[#151e2c] text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        sBuy ? 'bg-emerald-400' : sSell ? 'bg-rose-400' : 'bg-gray-500'
                      }`} />
                      <span>{s.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Strategy Title & Description */}
          <div className="bg-[#141b27] p-2.5 rounded-lg border border-[#202c40]">
            <div className="text-xs font-bold text-white font-mono flex items-center justify-between">
              <span>{currentItem.name}</span>
              <span className="text-[10px] text-blue-400 font-normal">Điểm: {currentItem.score}/100</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-400 mt-1 leading-snug">
              {currentItem.description}
            </div>
          </div>

          {/* Entry, SL, TP Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Entry Zone */}
            <div className="p-2 sm:p-2.5 rounded-lg bg-[#141b27] border border-[#232f44]">
              <div className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Vùng Vào Lệnh (Entry)
              </div>
              <div className="text-[11px] sm:text-xs font-mono font-bold text-white mt-1 truncate">
                {prefix}{formatPrice(currentItem.entryZone[0])} - {prefix}{formatPrice(currentItem.entryZone[1])}{priceSuffix}
              </div>
            </div>

            {/* Stop Loss */}
            <div className="p-2 sm:p-2.5 rounded-lg bg-[#141b27] border border-rose-500/30">
              <div className="text-[9px] sm:text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-rose-400" />
                Cắt Lỗ (Stop Loss)
              </div>
              <div className="text-[11px] sm:text-xs font-mono font-bold text-rose-400 mt-1 truncate">
                {prefix}{formatPrice(currentItem.stopLoss)}{priceSuffix}
                <span className="text-[9px] sm:text-[10px] text-rose-300 ml-1 font-normal">
                  ({slDiffPct >= 0 ? `+${slDiffPct.toFixed(1)}%` : `${slDiffPct.toFixed(1)}%`})
                </span>
              </div>
            </div>
          </div>

          {/* Take Profit Targets */}
          <div className="p-2 sm:p-2.5 rounded-lg bg-[#141b27] border border-emerald-500/30 space-y-1.5">
            <div className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                Các Mốc Chốt Lời (Take Profit)
              </span>
              <span className="font-mono text-[9px] sm:text-[10px] text-gray-400">R:R = 1 : {currentItem.riskRewardRatio}</span>
            </div>

            <div className="grid grid-cols-3 gap-1 sm:gap-1.5 font-mono text-center">
              <div className="p-1 sm:p-1.5 rounded bg-[#0f1724] border border-emerald-500/20">
                <div className="text-[8px] sm:text-[9px] text-gray-400">TP 1 (1.5R)</div>
                <div className="text-[11px] sm:text-xs font-bold text-emerald-400">{prefix}{formatPrice(currentItem.takeProfit1)}{priceSuffix}</div>
                <div className="text-[8px] sm:text-[9px] text-emerald-500">+{tp1DiffPct.toFixed(1)}%</div>
              </div>
              <div className="p-1 sm:p-1.5 rounded bg-[#0f1724] border border-emerald-500/30">
                <div className="text-[8px] sm:text-[9px] text-gray-400">TP 2 (2.5R)</div>
                <div className="text-[11px] sm:text-xs font-bold text-emerald-300">{prefix}{formatPrice(currentItem.takeProfit2)}{priceSuffix}</div>
                <div className="text-[8px] sm:text-[9px] text-emerald-400">+{tp2DiffPct.toFixed(1)}%</div>
              </div>
              <div className="p-1 sm:p-1.5 rounded bg-[#0f1724] border border-emerald-500/40">
                <div className="text-[8px] sm:text-[9px] text-gray-400">TP 3 (4.0R)</div>
                <div className="text-[11px] sm:text-xs font-bold text-emerald-200">{prefix}{formatPrice(currentItem.takeProfit3)}{priceSuffix}</div>
                <div className="text-[8px] sm:text-[9px] text-emerald-300">+{tp3DiffPct.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* Action Button: Open Paper Test Modal */}
          <button
            onClick={() => setIsTestModalOpen(true)}
            className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 ${
              isBuy
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20'
                : isSell
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-500/20'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            <span>🧪 Vào Lệnh Test Tại Vùng Entry (Chạy Thử AI)</span>
          </button>
        </div>
      )}

      {/* ================= TAB 2: ACTIVE TRADES ================= */}
      {activeTab === 'active_trades' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 font-bold uppercase">Lệnh Đang Chạy ({openTrades.length})</span>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Tự động SL/TP theo giá live
            </span>
          </div>

          {openTrades.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500 bg-[#0d121c] rounded-xl border border-[#1b2536] space-y-2">
              <FlaskConical className="w-6 h-6 mx-auto text-gray-600" />
              <p>Chưa có lệnh test nào đang mở.</p>
              <button
                onClick={() => setIsTestModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-[11px]"
              >
                + Mở Lệnh Test Ngay
              </button>
            </div>
          ) : (
            openTrades.map(trade => {
              const isProfit = trade.pnlPercent >= 0;
              return (
                <div key={trade.id} className="p-3 rounded-xl bg-[#0e141f] border border-[#212e42] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        trade.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {trade.action}
                      </span>
                      <span className="text-white font-mono">{trade.symbol}</span>
                      <span className="text-[10px] text-gray-400 font-normal truncate max-w-[100px]">{trade.strategyName}</span>
                    </div>

                    <div className="text-right font-mono">
                      <div className={`text-xs font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}{trade.pnlPercent}%
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {isProfit ? '+' : ''}{isVND ? `${formatPrice(trade.pnlAmount)} VNĐ` : `$${formatPrice(trade.pnlAmount)}`}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 bg-[#141b27] p-1.5 rounded-lg text-[10px] font-mono text-gray-300 border border-[#1d2738]">
                    <div>Vào: <span className="text-white font-bold">{prefix}{formatPrice(trade.entryPrice)}{priceSuffix}</span></div>
                    <div>SL: <span className="text-rose-400 font-bold">{prefix}{formatPrice(trade.stopLoss)}{priceSuffix}</span></div>
                    <div>{trade.tpTargetLabel}: <span className="text-emerald-400 font-bold">{prefix}{formatPrice(trade.takeProfit)}{priceSuffix}</span></div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] text-gray-500 font-mono">
                      Mở lúc: {formatTime(trade.openTime, 'time')}
                    </span>
                    <button
                      onClick={() => handleManualClose(trade.id)}
                      className="px-2.5 py-1 rounded bg-[#1e293b] hover:bg-rose-600 hover:text-white text-gray-300 text-[10px] font-semibold transition"
                    >
                      Đóng Lệnh Ngay
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ================= TAB 3: USER PERFORMANCE STATS ================= */}
      {activeTab === 'stats' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-white flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              Thống Kê Hiệu Quả Do Bạn Tự Test
            </span>
            <button
              onClick={handleClearAllTrades}
              className="flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20"
              title="Xóa hết lịch sử để test lại từ đầu"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa Hết Lịch Sử</span>
            </button>
          </div>

          {/* Stats Metrics Cards */}
          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            <div className="p-2.5 rounded-xl bg-[#0d121c] border border-[#1b2536]">
              <div className="text-[9px] text-gray-400 uppercase font-semibold">Tỉ Lệ Thắng</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">{userWinRate}%</div>
              <div className="text-[9px] text-gray-500">{winTrades.length} thắng / {closedTrades.length} lệnh</div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0d121c] border border-[#1b2536]">
              <div className="text-[9px] text-gray-400 uppercase font-semibold">Tổng Lợi Nhuận</div>
              <div className={`text-sm font-bold mt-0.5 truncate ${totalUserPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalUserPnL >= 0 ? '+' : ''}{isVND ? `${(totalUserPnL / 1000000).toFixed(2)}Tr` : `$${formatPrice(totalUserPnL)}`}
              </div>
              <div className="text-[9px] text-gray-500">{isVND ? 'VNĐ' : 'USD'}</div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0d121c] border border-[#1b2536]">
              <div className="text-[9px] text-gray-400 uppercase font-semibold">Tổng Lệnh Test</div>
              <div className="text-base font-bold text-blue-400 mt-0.5">{paperTrades.length}</div>
              <div className="text-[9px] text-gray-500">{openTrades.length} đang chạy</div>
            </div>
          </div>

          {/* Closed Trades List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {closedTrades.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-gray-500 bg-[#0d121c] rounded-xl border border-[#1b2536]">
                Lịch sử đang trống. Hãy bấm <b>"Vào Lệnh Test"</b> để tự mình kiểm chứng hiệu quả các chiến lược do AI gợi ý!
              </div>
            ) : (
              closedTrades.map(trade => {
                const isWin = trade.pnlPercent > 0;
                return (
                  <div key={trade.id} className="p-2 rounded-lg bg-[#0e141f] border border-[#1d2738] flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        trade.status === 'TP_HIT' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        trade.status === 'SL_HIT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-gray-700 text-gray-300'
                      }`}>
                        {trade.status === 'TP_HIT' ? '🎯 CHỐT LỜI' : trade.status === 'SL_HIT' ? '🛡️ CẮT LỖ' : 'ĐÓNG TAY'}
                      </span>
                      <span className="font-bold text-white">{trade.symbol}</span>
                      <span className="text-[9px] text-gray-400 truncate max-w-[80px]">{trade.strategyName}</span>
                    </div>

                    <div className="text-right">
                      <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isWin ? '+' : ''}{trade.pnlPercent}%
                      </span>
                      <div className="text-[9px] text-gray-400">
                        {isWin ? '+' : ''}{isVND ? `${formatPrice(trade.pnlAmount)} VNĐ` : `$${formatPrice(trade.pnlAmount)}`}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: MỞ LỆNH THỬ NGHIỆM ================= */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in select-none">
          <div className="bg-[#0e141f] border border-[#232f44] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-3.5 sm:p-4 border-b border-[#1c2738] flex items-center justify-between bg-[#121927]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase font-mono">
                    Mở Lệnh Thử Nghiệm: {activeSymbol}
                  </h3>
                  <p className="text-[10px] text-gray-400">Chiến lược: {currentItem.name}</p>
                </div>
              </div>

              <button
                onClick={() => setIsTestModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 space-y-3 text-xs">
              {/* Entry Price Selection */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Giá Vào Lệnh (Entry)
                </label>
                <div className="grid grid-cols-2 gap-1.5 font-mono">
                  <button
                    onClick={() => setTestEntryType('entry_zone')}
                    className={`p-2 rounded-lg border text-left ${
                      testEntryType === 'entry_zone'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-[#141b27] border-[#222e42] text-gray-400'
                    }`}
                  >
                    <div className="text-[9px] uppercase">Vùng Entry Đề Xuất</div>
                    <div className="font-bold text-xs text-white">{prefix}{formatPrice(currentItem.entryZone[0])}{priceSuffix}</div>
                  </button>

                  <button
                    onClick={() => setTestEntryType('current')}
                    className={`p-2 rounded-lg border text-left ${
                      testEntryType === 'current'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-[#141b27] border-[#222e42] text-gray-400'
                    }`}
                  >
                    <div className="text-[9px] uppercase">Giá Hiện Tại</div>
                    <div className="font-bold text-xs text-emerald-400">{prefix}{formatPrice(currentPrice)}{priceSuffix}</div>
                  </button>
                </div>
              </div>

              {/* Take Profit Target Selection */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Kịch Bản Chốt Lời Mục Tiêu
                </label>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-center">
                  {[
                    { label: 'TP1', price: currentItem.takeProfit1, r: '1.5R' },
                    { label: 'TP2', price: currentItem.takeProfit2, r: '2.5R' },
                    { label: 'TP3', price: currentItem.takeProfit3, r: '4.0R' },
                  ].map(t => (
                    <button
                      key={t.label}
                      onClick={() => setTestTpTarget(t.label as any)}
                      className={`p-1.5 rounded-lg border ${
                        testTpTarget === t.label
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-[#141b27] border-[#222e42] text-gray-400'
                      }`}
                    >
                      <div className="text-[9px]">{t.label} ({t.r})</div>
                      <div className="text-[11px] font-bold text-white">{prefix}{formatPrice(t.price)}{priceSuffix}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stop Loss Indicator */}
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between font-mono">
                <span className="text-[10px] text-rose-300 uppercase font-semibold">Tự Động Cắt Lỗ Tại:</span>
                <span className="text-xs font-bold text-rose-400">{prefix}{formatPrice(currentItem.stopLoss)}{priceSuffix}</span>
              </div>

              {/* Capital & Leverage */}
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    Vốn Test ({isVND ? 'VNĐ' : '$'})
                  </label>
                  <input
                    type="number"
                    value={testCapital}
                    onChange={(e) => setTestCapital(Math.max(10, Number(e.target.value)))}
                    className="w-full bg-[#141b27] border border-[#232f44] rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    {isVND ? 'Hình Thức' : 'Đòn Bẩy'}
                  </label>
                  <select
                    value={testLeverage}
                    onChange={(e) => setTestLeverage(Number(e.target.value))}
                    className="w-full bg-[#141b27] border border-[#232f44] rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value={1}>{isVND ? 'Tiền Thịt (1x)' : 'Spot 1x'}</option>
                    <option value={2}>{isVND ? 'Margin 2x' : 'Futures 2x'}</option>
                    <option value={5}>Đòn bẩy 5x</option>
                    <option value={10}>Đòn bẩy 10x</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#121927] border-t border-[#1c2738] flex items-center justify-end gap-2">
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleOpenTestTrade}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Xác Nhận Vào Lệnh Test</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
