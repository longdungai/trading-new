import React, { useState, useEffect } from 'react';
import { Candle, MarketSymbol, StrategyAnalysisHub, StrategyHubItem, TradeSetup } from '../../types';
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
  AlertCircle,
  Download,
  Target,
  ShieldCheck,
} from 'lucide-react';
import { formatPercent, formatPrice, formatTime } from '../../utils/formatters';
import {
  getVnExchangeBoard,
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
  roundToVnTickSize,
} from '../../services/vnMarket/vnStockMicrostructure';
import {
  checkUsPdtRuleWarning,
  isCryptoSymbol,
  isUsOrGlobalEquitySymbol,
} from '../../services/globalMarket/globalExecutionEngines';
import {
  evaluateHighWinrateSniperReport,
  scanTopSniperOpportunities,
} from '../../services/ai/highWinrateSniperEngine';
import { buildSpotProUpgradeSuite } from '../../services/ai/spotProUpgradeEngine';
import {
  UserPaperTrade,
  getUserPaperTrades,
  addUserPaperTrade,
  updateOpenPaperTradesWithLivePrice,
  closePaperTradeManually,
  clearUserPaperTrades,
  calculatePaperPortfolioAnalytics,
  exportPaperTradesToCsv,
  getPaperTradeVnT2State,
  PAPER_TRADES_UPDATED_EVENT,
} from '../../services/paperTrading/userPaperTrading';

interface TradeSetupCardProps {
  strategyHub?: StrategyAnalysisHub | null;
  setup?: TradeSetup | null;
  quoteAsset?: string;
  symbol?: string;
  currentSymbolObj?: MarketSymbol;
  candles?: Candle[];
  allSymbols?: MarketSymbol[];
  onSelectSymbol?: (sym: MarketSymbol) => void;
}

export const TradeSetupCard: React.FC<TradeSetupCardProps> = ({
  strategyHub,
  setup,
  quoteAsset = 'USD',
  symbol = '',
  currentSymbolObj,
  candles = [],
  allSymbols = [],
  onSelectSymbol,
}) => {
  const activeSymbol = strategyHub?.symbol || setup?.symbol || symbol;
  const isVND =
    quoteAsset === 'VND' ||
    isVnStockOrIndexSymbol(activeSymbol) ||
    ['FPT', 'HPG', 'VIC', 'VHM', 'SJC', 'MWG', 'MSN', 'SSI', 'VCB'].includes(activeSymbol);
  const isVnIdxOrDeriv =
    activeSymbol === 'VNINDEX' ||
    activeSymbol === 'VN30' ||
    isVnDerivativeSymbol(activeSymbol);
  const vnBoard = isVND && activeSymbol ? getVnExchangeBoard(activeSymbol) : null;
  const prefix = isVND ? '' : '$';
  const priceSuffix = isVND ? (isVnIdxOrDeriv ? ' đ' : 'k') : '';

  // Active selected strategy in the Hub
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('best');

  // Paper Testing state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [paperTrades, setPaperTrades] = useState<UserPaperTrade[]>(() => getUserPaperTrades());
  const [activeTab, setActiveTab] = useState<'strategy' | 'spot_pro' | 'sniper_winrate' | 'active_trades' | 'stats'>('strategy');
  const [leaderboardMarket, setLeaderboardMarket] = useState<'VN_STOCK' | 'CRYPTO_COIN'>(
    isVND ? 'VN_STOCK' : 'CRYPTO_COIN'
  );
  const [spotProCapital, setSpotProCapital] = useState<number>(isVND ? 100_000_000 : 2_000);

  useEffect(() => {
    setLeaderboardMarket(isVND ? 'VN_STOCK' : 'CRYPTO_COIN');
    setSpotProCapital(isVND ? 100_000_000 : 2_000);
  }, [isVND]);

  // Test Order Form Inputs
  const [testTpTarget, setTestTpTarget] = useState<'TP1' | 'TP2' | 'TP3'>('TP2');
  const [testCapital, setTestCapital] = useState<number>(isVND ? 10000000 : 1000);
  const [testLeverage, setTestLeverage] = useState<number>(1);
  const [testEntryType, setTestEntryType] = useState<'current' | 'entry_zone'>('current');

  // Derive current display item (with official HOSE/HNX/VN30F1M tick-size normalization for Vietnam assets)
  const currentItem: StrategyHubItem = React.useMemo(() => {
    let rawItem: StrategyHubItem | null = null;
    if (!strategyHub || !strategyHub.strategies || strategyHub.strategies.length === 0) {
      if (setup) {
        rawItem = {
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
    } else if (selectedStrategyId === 'best') {
      rawItem = strategyHub.bestStrategy;
    } else {
      rawItem =
        strategyHub.strategies.find((s) => s.id === selectedStrategyId) ||
        strategyHub.bestStrategy;
    }

    if (!rawItem || !rawItem.name) {
      return {} as StrategyHubItem;
    }

    if (isVND && activeSymbol && vnBoard && vnBoard !== 'INDEX') {
      return {
        ...rawItem,
        entryZone: [
          roundToVnTickSize(rawItem.entryZone[0], vnBoard),
          roundToVnTickSize(rawItem.entryZone[1], vnBoard),
        ],
        stopLoss: roundToVnTickSize(rawItem.stopLoss, vnBoard),
        takeProfit1: roundToVnTickSize(rawItem.takeProfit1, vnBoard),
        takeProfit2: roundToVnTickSize(rawItem.takeProfit2, vnBoard),
        takeProfit3: roundToVnTickSize(rawItem.takeProfit3, vnBoard),
      };
    }

    return rawItem;
  }, [strategyHub, setup, selectedStrategyId, isVND, activeSymbol, vnBoard]);

  const currentPrice = strategyHub ? strategyHub.currentPrice : (setup?.currentPrice || 100);

  // Real-time listener for open trades across ALL symbols (global background sync + active symbol)
  useEffect(() => {
    if (currentPrice > 0 && activeSymbol) {
      const updated = updateOpenPaperTradesWithLivePrice(activeSymbol, currentPrice);
      setPaperTrades(updated);
    }
  }, [currentPrice, activeSymbol]);

  useEffect(() => {
    const syncFromGlobal = () => {
      setPaperTrades(getUserPaperTrades());
    };
    window.addEventListener(PAPER_TRADES_UPDATED_EVENT, syncFromGlobal);
    return () => window.removeEventListener(PAPER_TRADES_UPDATED_EVENT, syncFromGlobal);
  }, []);

  if (!currentItem.name) return null;

  const isBuy = currentItem.action === 'STRONG_BUY' || currentItem.action === 'BUY';
  const isSell = currentItem.action === 'STRONG_SELL' || currentItem.action === 'SELL';

  const slDiffPct = currentPrice > 0 ? ((currentItem.stopLoss - currentPrice) / currentPrice) * 100 : 0;
  const tp1DiffPct = currentPrice > 0 ? ((currentItem.takeProfit1 - currentPrice) / currentPrice) * 100 : 0;
  const tp2DiffPct = currentPrice > 0 ? ((currentItem.takeProfit2 - currentPrice) / currentPrice) * 100 : 0;
  const tp3DiffPct = currentPrice > 0 ? ((currentItem.takeProfit3 - currentPrice) / currentPrice) * 100 : 0;

  // Handle open paper trade
  const handleOpenTestTrade = () => {
    const isMarket = testEntryType === 'current';
    const entry = isMarket ? currentPrice : currentItem.entryZone[0];
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
      entryType: isMarket ? 'market' : 'limit',
      entryPrice: entry,
      currentMarketPrice: currentPrice,
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

  // Filter trade lists & compute full portfolio analytics
  const activeAndPendingTrades = paperTrades.filter(t => t.status === 'OPEN' || t.status === 'PENDING');
  const closedTrades = paperTrades.filter(t => t.status !== 'OPEN' && t.status !== 'PENDING');
  const winTrades = closedTrades.filter(t => t.status === 'TP_HIT' || t.pnlPercent > 0);
  const userWinRate = closedTrades.length > 0 ? Math.round((winTrades.length / closedTrades.length) * 100) : 0;
  const totalUserPnL = closedTrades.reduce((sum, t) => sum + t.pnlAmount, 0);
  const portfolioAnalytics = React.useMemo(
    () => calculatePaperPortfolioAnalytics(paperTrades),
    [paperTrades]
  );

  const sniperReport = React.useMemo(
    () =>
      evaluateHighWinrateSniperReport({
        symbol: activeSymbol,
        symbolObj: currentSymbolObj,
        candles,
        entryPrice: currentItem.entryZone?.[0] || currentPrice,
        stopLossPrice: currentItem.stopLoss,
        tp1Price: currentItem.takeProfit1,
        tp2Price: currentItem.takeProfit2,
        tp3Price: currentItem.takeProfit3,
      }),
    [
      activeSymbol,
      currentSymbolObj,
      candles,
      currentItem.entryZone,
      currentItem.stopLoss,
      currentItem.takeProfit1,
      currentItem.takeProfit2,
      currentItem.takeProfit3,
      currentPrice,
    ]
  );

  const sniperLeaderboard = React.useMemo(
    () => scanTopSniperOpportunities(allSymbols, activeSymbol, candles),
    [allSymbols, activeSymbol, candles]
  );

  const fallbackSymbolObj: MarketSymbol = React.useMemo(
    () =>
      currentSymbolObj || {
        symbol: activeSymbol || 'BTCUSDT',
        name: activeSymbol || 'Bitcoin',
        baseAsset: activeSymbol,
        quoteAsset,
        type: isVND ? 'stock' : 'crypto',
        price: currentPrice,
        change24h: 0,
        high24h: currentPrice * 1.02,
        low24h: currentPrice * 0.98,
        volume24h: 1000000,
      },
    [currentSymbolObj, activeSymbol, quoteAsset, isVND, currentPrice]
  );

  const spotProSuite = React.useMemo(
    () =>
      buildSpotProUpgradeSuite({
        symbolObj: fallbackSymbolObj,
        candles,
        allSymbols,
        capitalAmount: spotProCapital,
        stopLossPrice: currentItem.stopLoss,
        tp1Price: currentItem.takeProfit1,
        tp2Price: currentItem.takeProfit2,
        tp3Price: currentItem.takeProfit3,
      }),
    [
      fallbackSymbolObj,
      candles,
      allSymbols,
      spotProCapital,
      currentItem.stopLoss,
      currentItem.takeProfit1,
      currentItem.takeProfit2,
      currentItem.takeProfit3,
    ]
  );

  const handleQuickSniperPaperTrade = () => {
    const isSafeNow = sniperReport.bullTrapShield.isSafeToEnterMarket;
    const entry = isSafeNow
      ? currentPrice
      : sniperReport.bullTrapShield.safeLimitPullbackPrice;
    addUserPaperTrade({
      symbol: activeSymbol,
      strategyName: `🎯 Sniper Winrate Cao (${sniperReport.empiricalBacktest.nonLossWinratePct}% Win+BE)`,
      strategyId: 'high_winrate_sniper',
      action: 'BUY',
      entryType: isSafeNow ? 'market' : 'limit',
      entryPrice: entry,
      currentMarketPrice: currentPrice,
      stopLoss: sniperReport.scaleOutPlan.initialStopLoss,
      takeProfit: sniperReport.scaleOutPlan.tranches[1].targetPrice,
      tpTargetLabel: 'TP2',
      capital: testCapital,
      leverage: 1,
      quoteAsset,
    });
    setPaperTrades(getUserPaperTrades());
    setActiveTab('active_trades');
  };

  const handleExportCsv = () => {
    const csv = exportPaperTradesToCsv(paperTrades);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TradingNew_PaperJournal_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      <div className="flex gap-1 border-b border-[#1c2738] pb-1.5 text-[10px] font-bold overflow-x-auto no-scrollbar whitespace-nowrap">
        <button
          onClick={() => setActiveTab('strategy')}
          className={`px-2.5 py-1 rounded-lg transition shrink-0 ${
            activeTab === 'strategy' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white bg-[#141b27]'
          }`}
        >
          Kế Hoạch Lệnh
        </button>
        <button
          onClick={() => setActiveTab('spot_pro')}
          className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 shrink-0 ${
            activeTab === 'spot_pro'
              ? 'bg-gradient-to-r from-amber-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/25'
              : 'text-amber-300 hover:text-white bg-amber-950/35 border border-amber-500/35'
          }`}
        >
          <span>💵 Spot 1x Pro ({spotProSuite.relativeStrength.rsTier === 'LEADER' ? 'RS Leader' : `DCA ${spotProSuite.smartDynamicDca.multiplier}x`})</span>
        </button>
        <button
          onClick={() => setActiveTab('sniper_winrate')}
          className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 shrink-0 ${
            activeTab === 'sniper_winrate'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-500/25'
              : 'text-emerald-300 hover:text-white bg-emerald-950/35 border border-emerald-500/35'
          }`}
        >
          <Target className="w-3 h-3 text-emerald-300 shrink-0" />
          <span>🎯 Bắn Tỉa ({sniperReport.empiricalBacktest.nonLossWinratePct}%)</span>
        </button>
        <button
          onClick={() => setActiveTab('active_trades')}
          className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 shrink-0 ${
            activeTab === 'active_trades' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white bg-[#141b27]'
          }`}
        >
          <span>Lệnh Đang Test</span>
          {activeAndPendingTrades.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-black">
              {activeAndPendingTrades.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 shrink-0 ${
            activeTab === 'stats' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white bg-[#141b27]'
          }`}
        >
          <Award className="w-3 h-3 text-amber-300 shrink-0" />
          <span>Thống Kê</span>
          {closedTrades.length > 0 && (
            <span className="text-[9px] opacity-75">({closedTrades.length})</span>
          )}
        </button>
      </div>

      {/* ================= TAB 1: STRATEGY DETAILS ================= */}
      {activeTab === 'strategy' && (
        <div className="space-y-3">
          {/* Quick High-Winrate Sniper & Spot 1x Pro Summary Strip inside Strategy Tab */}
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/45 via-[#0d1828] to-teal-950/40 border border-emerald-500/35 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-extrabold text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{sniperReport.tierBadgeVi}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('spot_pro')}
                  className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-[9.5px] font-bold transition whitespace-nowrap"
                >
                  💵 Máy Tính Spot 1x ↗
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sniper_winrate')}
                  className="px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-[9.5px] font-bold transition whitespace-nowrap"
                >
                  🎯 Bắn Tỉa ↗
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px] text-center">
              <div className="p-1.5 rounded-lg bg-[#09111e] border border-slate-800">
                <div className="text-[8.5px] text-slate-400 font-sans">Win + Hòa Vốn Thực</div>
                <div className="font-black text-emerald-400 text-xs">
                  {sniperReport.empiricalBacktest.nonLossWinratePct}%
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#09111e] border border-slate-800">
                <div className="text-[8.5px] text-slate-400 font-sans">Sức Mạnh RS</div>
                <div
                  className={`font-black text-[10px] truncate ${
                    spotProSuite.relativeStrength.rsTier === 'LEADER' ||
                    spotProSuite.relativeStrength.rsTier === 'OUTPERFORM'
                      ? 'text-emerald-300'
                      : spotProSuite.relativeStrength.rsTier === 'LAGGARD'
                      ? 'text-rose-300'
                      : 'text-cyan-300'
                  }`}
                >
                  {spotProSuite.relativeStrength.rsTier} ({spotProSuite.relativeStrength.rsScore})
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#09111e] border border-slate-800">
                <div className="text-[8.5px] text-slate-400 font-sans">Khiên Chống Bẫy</div>
                <div
                  className={`font-black text-[10px] truncate ${
                    sniperReport.bullTrapShield.isSafeToEnterMarket
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }`}
                >
                  {sniperReport.bullTrapShield.isSafeToEnterMarket ? 'Sạch Bẫy' : 'Kê Limit'}
                </div>
              </div>
            </div>
          </div>

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
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
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
                  const displayName = s.shortName || s.name;
                  const isSpot = s.id === 'spot_accumulation';
                  const isDaily = s.id === 'daily_daytrading';

                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStrategyId(s.id)}
                      className={`px-2.5 py-1 rounded text-[10px] font-medium whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                          : isSpot
                          ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:text-white'
                          : isDaily
                          ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30 hover:text-white'
                          : 'bg-[#151e2c] text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        sBuy ? 'bg-emerald-400' : sSell ? 'bg-rose-400' : 'bg-gray-500'
                      }`} />
                      <span>{displayName}</span>
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
            {isVND && vnBoard && vnBoard !== 'INDEX' && (
              <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-[9.5px] font-mono text-cyan-300">
                <span className="whitespace-nowrap">
                  🇻🇳 Chuẩn bước giá {vnBoard === 'HNX_DERIVATIVE' ? 'HNX Phái sinh (0.1 điểm)' : `sàn ${vnBoard}`}
                </span>
                <span className="text-slate-400 whitespace-nowrap">
                  {vnBoard === 'HNX_DERIVATIVE'
                    ? 'Lô 1 HĐ • T+0 • ±7%'
                    : `Lô chẵn 100 CP • T+2 • ±${vnBoard === 'UPCOM' ? 15 : vnBoard === 'HNX' ? 10 : 7}%`}
                </span>
              </div>
            )}
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
            <span>🧪 Mở Lệnh Thử Nghiệm (Test Chiến Lược AI)</span>
          </button>
        </div>
      )}

      {/* ================= TAB 1A: 5-ENGINE PRO SPOT 1X SUITE (COIN & VN STOCK) ================= */}
      {activeTab === 'spot_pro' && (
        <div className="space-y-3 text-xs">
          {/* 1. Interactive Spot Cash & Board-Lot Calculator (30% - 40% - 30%) */}
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-950/40 via-[#0d1626] to-emerald-950/35 border border-amber-500/40 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-black text-amber-300">
                🧮 1. Máy Tính Đi Tiền & Chia Lô Spot 1x ({activeSymbol})
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-mono text-[9.5px] font-bold">
                Tổng gom: {spotProSuite.cashAndLotAllocation.totalQuantityFormatted}
              </span>
            </div>

            <div className="text-[9.5px] text-slate-300">{spotProSuite.cashAndLotAllocation.boardLotRuleVi}</div>

            {/* Preset Capital Buttons + Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                <span>Vốn tiền mặt dự kiến vào kèo ({spotProSuite.cashAndLotAllocation.currencyUnit}):</span>
                <span className="font-mono font-bold text-amber-300">
                  {spotProSuite.cashAndLotAllocation.inputCapitalFormatted}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(isVND
                  ? [
                      { label: '50 Tr', val: 50_000_000 },
                      { label: '100 Tr', val: 100_000_000 },
                      { label: '200 Tr', val: 200_000_000 },
                      { label: '500 Tr', val: 500_000_000 },
                    ]
                  : [
                      { label: '500 $', val: 500 },
                      { label: '2,000 $', val: 2_000 },
                      { label: '5,000 $', val: 5_000 },
                      { label: '10,000 $', val: 10_000 },
                    ]
                ).map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setSpotProCapital(preset.val)}
                    className={`py-1 px-1.5 rounded font-mono text-[10px] font-bold border transition ${
                      spotProCapital === preset.val
                        ? 'bg-amber-500/25 text-amber-200 border-amber-400/60'
                        : 'bg-[#09111e] text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3 Tranches Breakdown */}
            <div className="space-y-1.5 pt-1">
              {spotProSuite.cashAndLotAllocation.tranches.map((tr) => (
                <div
                  key={tr.trancheIndex}
                  className="p-2 rounded-lg bg-[#08101c] border border-slate-800/90 space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="font-bold text-amber-200">{tr.labelVi}</span>
                    <span className="text-emerald-300 font-bold">
                      Mua {tr.quantityFormatted} @ {prefix}
                      {formatPrice(tr.limitPrice)}
                      {priceSuffix} (-{tr.discountFromSpotPct}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[9.5px] text-slate-400">
                    <span className="truncate">{tr.triggerNoteVi}</span>
                    <span className="font-mono text-slate-200 shrink-0">{tr.cashCommittedFormatted}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Metrics: Avg Price, Breakeven, Profit TP1/TP2, Max Loss */}
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] pt-1">
              <div className="p-1.5 rounded-lg bg-[#08101c] border border-slate-800">
                <div className="text-[8.5px] text-slate-400 font-sans">Giá Vốn TB / Hòa Vốn Sau Phí</div>
                <div className="font-bold text-white">
                  {prefix}
                  {formatPrice(spotProSuite.cashAndLotAllocation.weightedAvgEntryPrice)}
                  {priceSuffix}{' '}
                  <span className="text-amber-300">
                    (BE: {prefix}
                    {formatPrice(spotProSuite.cashAndLotAllocation.allInBreakevenPrice)}
                    {priceSuffix})
                  </span>
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#08101c] border border-slate-800">
                <div className="text-[8.5px] text-slate-400 font-sans">Tiền Mặt Còn Dự Phòng</div>
                <div className="font-bold text-cyan-300">
                  {spotProSuite.cashAndLotAllocation.remainingCashReserveFormatted}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-emerald-950/25 border border-emerald-500/30">
                <div className="text-[8.5px] text-emerald-300 font-sans">Lãi Ròng Dự Kiến (TP1 / TP2)</div>
                <div className="font-bold text-emerald-300 truncate">
                  {spotProSuite.cashAndLotAllocation.expectedNetProfitTp1Formatted} /{' '}
                  {spotProSuite.cashAndLotAllocation.expectedNetProfitTp2Formatted}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-rose-950/25 border border-rose-500/30">
                <div className="text-[8.5px] text-rose-300 font-sans">Rủi Ro Nếu Gãy Cấu Trúc</div>
                <div className="font-bold text-rose-300 truncate">
                  {spotProSuite.cashAndLotAllocation.maxStructuralLossFormatted}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Relative Strength (RS Leader vs Laggard) */}
          <div className="p-2.5 rounded-xl bg-[#0d1422] border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-bold text-white">
                ⚖️ 2. Sức Mạnh Tương Đối (RS so với {spotProSuite.relativeStrength.benchmarkSymbol})
              </span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[9.5px] font-bold border ${
                  spotProSuite.relativeStrength.rsTier === 'LEADER' ||
                  spotProSuite.relativeStrength.rsTier === 'OUTPERFORM'
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50'
                    : spotProSuite.relativeStrength.rsTier === 'LAGGARD'
                    ? 'bg-rose-500/20 text-rose-200 border-rose-400/50'
                    : 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                }`}
              >
                Điểm RS: {spotProSuite.relativeStrength.rsScore}/100 (
                {spotProSuite.relativeStrength.rsSpread24hPct >= 0 ? '+' : ''}
                {spotProSuite.relativeStrength.rsSpread24hPct}%)
              </span>
            </div>
            <div className="text-[10px] font-bold text-amber-300">{spotProSuite.relativeStrength.badgeVi}</div>
            <p className="text-[10px] text-slate-300 leading-relaxed">{spotProSuite.relativeStrength.adviceVi}</p>
            {spotProSuite.relativeStrength.topMarketLeaderSymbol !== activeSymbol && (
              <button
                type="button"
                onClick={() => {
                  const leaderObj = allSymbols.find(
                    (s) => s.symbol === spotProSuite.relativeStrength.topMarketLeaderSymbol
                  );
                  if (leaderObj && onSelectSymbol) onSelectSymbol(leaderObj);
                }}
                className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-200 text-[10px] font-bold transition text-center"
              >
                👑 Chuyển sang Mã Dẫn Dắt #1 hiện tại: {spotProSuite.relativeStrength.topMarketLeaderSymbol} (
                {spotProSuite.relativeStrength.topMarketLeaderSpreadPct >= 0 ? '+' : ''}
                {spotProSuite.relativeStrength.topMarketLeaderSpreadPct}% vs {spotProSuite.relativeStrength.benchmarkSymbol}) ↗
              </button>
            )}
          </div>

          {/* 3. Spot Scale-Out 40/40/20 & Free-Ride 0% Risk Plan */}
          <div className="p-2.5 rounded-xl bg-[#0d1422] border border-emerald-500/35 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-bold text-emerald-300">
                🎯 3. Lộ Trình Chốt Lời 40/40/20 & Gồng Lãi 0% Rủi Ro
              </span>
              <span className="text-[9.5px] font-mono text-amber-300 font-bold">
                Chặn Hòa Vốn: {prefix}
                {formatPrice(spotProSuite.scaleOutAndFreeRide.freeRideStopPrice)}
                {priceSuffix}
              </span>
            </div>
            <div className="space-y-1.5">
              {spotProSuite.scaleOutAndFreeRide.steps.map((st) => (
                <div
                  key={st.step}
                  className="p-2 rounded-lg bg-[#08101c] border border-slate-800 space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                    <span className="font-bold text-emerald-300">{st.titleVi}</span>
                    <span className="text-amber-300 font-bold shrink-0">
                      @{prefix}
                      {formatPrice(st.targetPrice)}
                      {priceSuffix} (+{st.gainFromAvgEntryPct}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[9.5px] text-cyan-200">
                    <span>Bán: {st.quantityToSellFormatted}</span>
                    <span>Lãi khóa: {st.netProfitLockedFormatted}</span>
                  </div>
                  <div className="text-[9.5px] text-slate-300 leading-snug">{st.actionInstructionVi}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Cash-Is-King Circuit Breaker & Capitulation Catch Zone */}
          <div
            className={`p-2.5 rounded-xl border space-y-1.5 ${
              spotProSuite.cashCircuitBreaker.defenseState === 'CASH_IS_KING_DEFENSE'
                ? 'bg-rose-950/35 border-rose-500/45'
                : spotProSuite.cashCircuitBreaker.defenseState === 'SELECTIVE_CAUTIOUS'
                ? 'bg-amber-950/30 border-amber-500/40'
                : 'bg-[#0d1422] border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-bold text-white">
                🛑 4. Cầu Dao Giữ Tiền Mặt & Vùng Vợt Xác Hoảng Loạn
              </span>
              <span className="font-mono text-[9.5px] font-bold text-cyan-300">
                Độ rộng: {spotProSuite.cashCircuitBreaker.marketBreadthBullishPct}% mã xanh
              </span>
            </div>
            <div className="text-[10px] font-bold text-amber-200">
              {spotProSuite.cashCircuitBreaker.badgeVi}
            </div>
            {spotProSuite.cashCircuitBreaker.reasonsVi.map((r, idx) => (
              <div key={idx} className="text-[9.5px] text-slate-300">
                • {r}
              </div>
            ))}
            <div className="p-2 rounded-lg bg-[#08101c] border border-slate-800 flex items-center justify-between gap-2 font-mono text-[10px]">
              <span className="text-slate-300 font-sans">Vùng Kê Lệnh Vợt Xác (Panic Flush):</span>
              <span className="font-bold text-emerald-300">
                {prefix}
                {formatPrice(spotProSuite.cashCircuitBreaker.capitulationCatchLowPrice)}
                {priceSuffix} – {prefix}
                {formatPrice(spotProSuite.cashCircuitBreaker.capitulationCatchHighPrice)}
                {priceSuffix} (-{spotProSuite.cashCircuitBreaker.capitulationDiscountPct}%)
              </span>
            </div>
            <div className="text-[9.5px] text-cyan-200 font-semibold">
              💡 {spotProSuite.cashCircuitBreaker.actionDirectiveVi}
            </div>
          </div>

          {/* 5. Smart Dynamic DCA Multiplier */}
          <div className="p-2.5 rounded-xl bg-[#0d1422] border border-purple-500/35 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-bold text-purple-300">
                📦 5. Hệ Số Tích Sản Thông Minh Theo Định Giá (Smart DCA)
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-200 font-mono text-[10px] font-black">
                Hệ số hôm nay: {spotProSuite.smartDynamicDca.multiplier}x
              </span>
            </div>
            <div className="text-[10px] font-bold text-amber-200">
              {spotProSuite.smartDynamicDca.zoneBadgeVi}
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
              <div className="p-1.5 rounded bg-[#08101c] border border-slate-800">
                <div className="text-[8.5px] text-slate-400 font-sans">Định Mức DCA Cơ Sở (1.0x)</div>
                <div className="font-bold text-slate-200">
                  {spotProSuite.smartDynamicDca.basePeriodicBudgetFormatted}
                </div>
              </div>
              <div className="p-1.5 rounded bg-[#08101c] border border-purple-500/30">
                <div className="text-[8.5px] text-purple-300 font-sans">
                  Khuyến Nghị Giải Ngân ({spotProSuite.smartDynamicDca.multiplier}x)
                </div>
                <div className="font-bold text-emerald-300">
                  {spotProSuite.smartDynamicDca.recommendedTodayDcaFormatted} (
                  {spotProSuite.smartDynamicDca.recommendedTodayQuantityFormatted})
                </div>
              </div>
            </div>
            <p className="text-[9.5px] text-slate-300 leading-snug">
              {spotProSuite.smartDynamicDca.rationaleVi}
            </p>
          </div>
        </div>
      )}

      {/* ================= TAB 1B: HIGH-WINRATE SNIPER SUITE (VN STOCK & COIN) ================= */}
      {activeTab === 'sniper_winrate' && (
        <div className="space-y-3 text-xs">
          {/* 1. Sniper Certification & Empirical Backtest Gate */}
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-950/50 via-[#0d1626] to-cyan-950/40 border border-emerald-500/40 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-[11px] font-black text-emerald-300">{sniperReport.tierBadgeVi}</div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-mono text-[10px] font-bold">
                Điểm Sniper: {sniperReport.compositeSniperScore}/100
              </span>
            </div>

            <div className="text-[10px] text-slate-300 flex items-center justify-between gap-2 flex-wrap">
              <span>{sniperReport.marketLabelVi}</span>
              <span className="font-mono font-bold text-cyan-300">{sniperReport.directionBadgeVi}</span>
            </div>

            {/* Empirical Historical Backtest Grid */}
            <div className="grid grid-cols-4 gap-1.5 font-mono text-center pt-1">
              <div className="p-1.5 rounded-lg bg-[#08101c] border border-emerald-500/35">
                <div className="text-[8.5px] text-slate-400 font-sans">Win+Hòa Vốn</div>
                <div className="text-xs font-black text-emerald-400">
                  {sniperReport.empiricalBacktest.nonLossWinratePct}%
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#08101c] border border-slate-800">
                <div className="text-[8.5px] text-slate-400 font-sans">Win Thuần</div>
                <div className="text-xs font-bold text-cyan-300">
                  {sniperReport.empiricalBacktest.pureWinratePct}%
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#08101c] border border-slate-800">
                <div className="text-[8.5px] text-slate-400 font-sans">Profit Factor</div>
                <div className="text-xs font-bold text-amber-300">
                  {sniperReport.empiricalBacktest.profitFactor}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#08101c] border border-slate-800">
                <div className="text-[8.5px] text-slate-400 font-sans">Mẫu Quá Khứ</div>
                <div className="text-xs font-bold text-white">
                  {sniperReport.empiricalBacktest.totalSignalsTested} lần
                </div>
              </div>
            </div>

            {/* 5-Criteria Sniper Checklist */}
            <div className="space-y-1 pt-1 border-t border-slate-800/80">
              {sniperReport.checklistPassed.map((c, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-slate-300 flex items-center gap-1 min-w-0 truncate">
                    <span className={c.passed ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {c.passed ? '✓' : '•'}
                    </span>
                    <span className="truncate">{c.labelVi}</span>
                  </span>
                  <span
                    className={`font-mono font-bold shrink-0 whitespace-nowrap ${
                      c.passed ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {c.valueVi}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Microstructure Trigger & Bull-Trap / T+2.5 Shield */}
          <div className="p-2.5 rounded-xl bg-[#0d1422] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-bold text-cyan-300">
                {sniperReport.microTrigger.triggerLabelVi}
              </span>
              <span className="text-[9.5px] font-mono text-slate-400">
                Vol: {sniperReport.microTrigger.volumeRatio20}x MA20
              </span>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              {sniperReport.microTrigger.detailVi}
            </p>

            {/* Bull-Trap Shield Box */}
            <div
              className={`p-2 rounded-lg border text-[10px] space-y-1 ${
                sniperReport.bullTrapShield.trapRiskLevel === 'SAFE_ENTRY'
                  ? 'bg-emerald-950/25 border-emerald-500/35 text-emerald-200'
                  : sniperReport.bullTrapShield.trapRiskLevel === 'WAIT_PULLBACK_LIMIT'
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  : 'bg-rose-950/35 border-rose-500/45 text-rose-200'
              }`}
            >
              <div className="font-bold">{sniperReport.bullTrapShield.trapBadgeVi}</div>
              {sniperReport.bullTrapShield.warningsVi.map((w, i) => (
                <div key={i} className="text-slate-200 leading-snug">
                  • {w}
                </div>
              ))}
              <div className="text-cyan-200 font-semibold">
                💡 {sniperReport.bullTrapShield.actionAdviceVi}
              </div>
            </div>
          </div>

          {/* 3. k-NN Historical Fractal Pattern Analog Matcher */}
          <div className="p-2.5 rounded-xl bg-[#0d1422] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-bold text-white flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Khớp Mẫu Hình Lịch Sử k-NN ({sniperReport.fractalAnalog.windowBars} Nến)</span>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-200 font-mono text-[9.5px] font-bold">
                Xác suất thắng: {sniperReport.fractalAnalog.analogWinratePct}%
              </span>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              {sniperReport.fractalAnalog.summaryVi}
            </p>
            {sniperReport.fractalAnalog.matches.length > 0 && (
              <div className="grid grid-cols-5 gap-1 font-mono text-[9.5px] text-center">
                {sniperReport.fractalAnalog.matches.map((m, idx) => (
                  <div
                    key={idx}
                    className={`p-1 rounded border ${
                      m.outcome === 'WIN'
                        ? 'bg-emerald-950/30 border-emerald-500/35 text-emerald-300'
                        : m.outcome === 'LOSS'
                        ? 'bg-rose-950/30 border-rose-500/35 text-rose-300'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="text-[8.5px] text-slate-400">Khớp {m.similarityPct}%</div>
                    <div className="font-bold">
                      {m.forward5BarReturnPct >= 0 ? '+' : ''}
                      {m.forward5BarReturnPct}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. 3-Stage Scale-Out & Auto-Breakeven Lock Coach */}
          <div className="p-2.5 rounded-xl bg-[#0d1422] border border-emerald-500/35 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-bold text-emerald-300">
                🛡️ Lộ Trình Chốt Lời 3 Nấc & Khóa Hòa Vốn Bất Bại
              </span>
              <span className="text-[9.5px] font-mono text-amber-300 font-bold">
                Hòa vốn thực: {prefix}
                {formatPrice(sniperReport.scaleOutPlan.breakevenLockPrice)}
                {priceSuffix}
              </span>
            </div>

            <div className="space-y-1.5">
              {sniperReport.scaleOutPlan.tranches.map((tr) => (
                <div
                  key={tr.stage}
                  className="p-2 rounded-lg bg-[#08101c] border border-slate-800 space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                    <span className="font-bold text-emerald-300">
                      {tr.stage} • Chốt {tr.allocationPct}% tại {prefix}
                      {formatPrice(tr.targetPrice)}
                      {priceSuffix} (+{tr.gainFromEntryPct}%)
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-200 text-[9px] font-bold">
                      XS chạm ~{tr.hitProbabilityPct}%
                    </span>
                  </div>
                  <div className="text-[9.5px] text-slate-300 leading-snug">{tr.ruleVi}</div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleQuickSniperPaperTrade}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {sniperReport.bullTrapShield.isSafeToEnterMarket
                  ? `Khớp Lệnh Sniper Ngay (${prefix}${formatPrice(currentPrice)}${priceSuffix})`
                  : `Đặt Limit Sniper Đón Rũ (${prefix}${formatPrice(
                      sniperReport.bullTrapShield.safeLimitPullbackPrice
                    )}${priceSuffix})`}
              </span>
            </button>
          </div>

          {/* 5. Cross-Market Top High-Winrate Leaderboard (VN Stocks & Crypto Coins) */}
          <div className="p-2.5 rounded-xl bg-[#0d1422] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-bold text-white">
                🏆 Top Kèo Bắn Tỉa Winrate Cao Nhất Hôm Nay
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLeaderboardMarket('VN_STOCK')}
                  className={`px-2 py-0.5 rounded text-[9.5px] font-bold border transition ${
                    leaderboardMarket === 'VN_STOCK'
                      ? 'bg-rose-500/20 text-rose-200 border-rose-400/50'
                      : 'bg-[#08101c] text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  🇻🇳 Cổ Phiếu VN ({sniperLeaderboard.vnStockPicks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardMarket('CRYPTO_COIN')}
                  className={`px-2 py-0.5 rounded text-[9.5px] font-bold border transition ${
                    leaderboardMarket === 'CRYPTO_COIN'
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                      : 'bg-[#08101c] text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  🪙 Coin Crypto ({sniperLeaderboard.cryptoCoinPicks.length})
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {(leaderboardMarket === 'VN_STOCK'
                ? sniperLeaderboard.vnStockPicks
                : sniperLeaderboard.cryptoCoinPicks
              ).map((pick, idx) => {
                const isVnPick = pick.marketFocus === 'VN_STOCK';
                const pfx = isVnPick ? '' : '$';
                const sfx = isVnPick ? 'k' : '';
                return (
                  <div
                    key={pick.symbol}
                    onClick={() => {
                      const found = allSymbols.find((s) => s.symbol === pick.symbol);
                      if (found && onSelectSymbol) onSelectSymbol(found);
                    }}
                    className={`p-2 rounded-lg border transition cursor-pointer ${
                      pick.symbol === activeSymbol
                        ? 'bg-emerald-950/35 border-emerald-500/50'
                        : 'bg-[#08101c] hover:bg-[#111c30] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-black">
                          #{idx + 1}
                        </span>
                        <span className="font-mono font-extrabold text-white text-xs">
                          {pick.symbol}
                        </span>
                        <span className="text-[9.5px] text-slate-400 truncate">
                          {pick.setupLabelVi}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono text-[9.5px] font-bold shrink-0">
                        Win+BE ~{pick.estimatedNonLossWinratePct}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 font-mono text-[9.5px] text-slate-300 mt-1 flex-wrap">
                      <span>
                        Entry:{' '}
                        <strong className="text-sky-300">
                          {pfx}
                          {formatPrice(pick.entryPrice)}
                          {sfx}
                        </strong>
                      </span>
                      <span>
                        SL:{' '}
                        <strong className="text-rose-300">
                          {pfx}
                          {formatPrice(pick.stopLossPrice)}
                          {sfx}
                        </strong>
                      </span>
                      <span>
                        TP1/TP2:{' '}
                        <strong className="text-emerald-300">
                          {pfx}
                          {formatPrice(pick.tp1Price)}
                          {sfx} / {pfx}
                          {formatPrice(pick.tp2Price)}
                          {sfx}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: ACTIVE & PENDING TRADES ================= */}
      {activeTab === 'active_trades' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 font-bold uppercase">Lệnh Đang Chạy ({activeAndPendingTrades.length})</span>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Chờ khớp & SL/TP tự động theo giá live
            </span>
          </div>

          {activeAndPendingTrades.length === 0 ? (
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
            activeAndPendingTrades.map(trade => {
              const isPending = trade.status === 'PENDING';
              const isProfit = trade.pnlPercent >= 0;
              const entryDist = trade.entryPrice > 0 ? (((currentPrice - trade.entryPrice) / trade.entryPrice) * 100).toFixed(2) : '0';
              const t2State = getPaperTradeVnT2State(trade);

              return (
                <div key={trade.id} className="p-3 rounded-xl bg-[#0e141f] border border-[#212e42] space-y-2">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5 font-bold text-xs flex-wrap min-w-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        trade.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {trade.action}
                      </span>
                      <span className="text-white font-mono">{trade.symbol}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        isPending
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : t2State.isVnEquityT2 && t2State.isLocked
                          ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {isPending
                          ? '⏳ CHỜ KHỚP ENTRY'
                          : t2State.isVnEquityT2
                          ? t2State.statusBadge
                          : '🟢 ĐÃ KHỚP - ĐANG CHẠY'}
                      </span>
                    </div>

                    <div className="text-right font-mono">
                      {isPending ? (
                        <div className="text-[10px] text-amber-400">Cách entry {entryDist}%</div>
                      ) : (
                        <>
                          <div className={`text-xs font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isProfit ? '+' : ''}{trade.pnlPercent}%
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {isProfit ? '+' : ''}{isVND ? `${formatPrice(trade.pnlAmount)} VNĐ` : `$${formatPrice(trade.pnlAmount)}`}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 bg-[#141b27] p-1.5 rounded-lg text-[10px] font-mono text-gray-300 border border-[#1d2738]">
                    <div>Giá Vào: <span className="text-white font-bold">{prefix}{formatPrice(trade.entryPrice)}{priceSuffix}</span></div>
                    <div>Cắt Lỗ: <span className="text-rose-400 font-bold">{prefix}{formatPrice(trade.stopLoss)}{priceSuffix}</span></div>
                    <div>{trade.tpTargetLabel}: <span className="text-emerald-400 font-bold">{prefix}{formatPrice(trade.takeProfit)}{priceSuffix}</span></div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <span className="text-[9px] text-gray-500 font-mono">
                      Giá thị trường: <span className="text-cyan-300 font-bold">{prefix}{formatPrice(currentPrice)}{priceSuffix}</span>
                    </span>
                    <button
                      onClick={() => handleManualClose(trade.id)}
                      disabled={!isPending && t2State.isVnEquityT2 && t2State.isLocked}
                      title={
                        !isPending && t2State.isVnEquityT2 && t2State.isLocked
                          ? `Chuẩn VSD T+2: Cổ phiếu chưa về tài khoản, mở bán từ ${t2State.unlockTimeLabelVi}`
                          : undefined
                      }
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold transition ${
                        !isPending && t2State.isVnEquityT2 && t2State.isLocked
                          ? 'bg-slate-800/80 text-amber-300/80 border border-amber-500/30 cursor-not-allowed'
                          : 'bg-[#1e293b] hover:bg-rose-600 hover:text-white text-gray-300'
                      }`}
                    >
                      {isPending
                        ? 'Hủy Lệnh Chờ'
                        : t2State.isVnEquityT2 && t2State.isLocked
                        ? `🔒 Mở bán ${t2State.unlockTimeLabelVi}`
                        : 'Đóng Lệnh Ngay'}
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
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <span className="text-xs font-bold uppercase text-white flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              Hiệu Suất Danh Mục Đa Tài Sản
            </span>
            <div className="flex items-center gap-1">
              {paperTrades.length > 0 && (
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1 text-[10px] text-cyan-300 hover:text-white px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 transition"
                  title="Xuất toàn bộ nhật ký giao dịch ra file Excel/CSV"
                >
                  <Download className="w-3 h-3" />
                  <span>CSV</span>
                </button>
              )}
              <button
                onClick={handleClearAllTrades}
                className="flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 transition"
                title="Xóa hết lịch sử để test lại từ đầu"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa</span>
              </button>
            </div>
          </div>

          {/* Stats Metrics Cards */}
          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            <div className="p-2.5 rounded-xl bg-[#0d121c] border border-[#1b2536]">
              <div className="text-[9px] text-gray-400 uppercase font-semibold">Tỉ Lệ Thắng</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">{userWinRate}%</div>
              <div className="text-[9px] text-gray-500">{winTrades.length}/{closedTrades.length} lệnh</div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0d121c] border border-[#1b2536]">
              <div className="text-[9px] text-gray-400 uppercase font-semibold">Profit Factor</div>
              <div className="text-base font-bold text-cyan-300 mt-0.5">
                {portfolioAnalytics.profitFactor !== null ? portfolioAnalytics.profitFactor : '—'}
              </div>
              <div className="text-[9px] text-gray-500">
                MaxDD -{portfolioAnalytics.maxDrawdownPct}%
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0d121c] border border-[#1b2536]">
              <div className="text-[9px] text-gray-400 uppercase font-semibold">Lợi Nhuận Ròng</div>
              <div className={`text-sm font-bold mt-0.5 truncate ${totalUserPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalUserPnL >= 0 ? '+' : ''}{isVND ? `${(totalUserPnL / 1000000).toFixed(2)}Tr` : `$${formatPrice(totalUserPnL)}`}
              </div>
              <div className="text-[9px] text-gray-500">{activeAndPendingTrades.length} đang mở</div>
            </div>
          </div>

          {/* SVG Portfolio Equity Curve */}
          {portfolioAnalytics.equityCurve.length > 1 && (
            <div className="p-2.5 rounded-xl bg-[#0b111c] border border-slate-800/90 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400 font-sans font-semibold">
                  Đường Cong Tăng Trưởng Lũy Kế (% Return)
                </span>
                <span
                  className={
                    portfolioAnalytics.equityCurve[portfolioAnalytics.equityCurve.length - 1]
                      .cumulativeReturnPct >= 0
                      ? 'text-emerald-400 font-bold'
                      : 'text-rose-400 font-bold'
                  }
                >
                  {portfolioAnalytics.equityCurve[portfolioAnalytics.equityCurve.length - 1]
                    .cumulativeReturnPct >= 0
                    ? '+'
                    : ''}
                  {
                    portfolioAnalytics.equityCurve[portfolioAnalytics.equityCurve.length - 1]
                      .cumulativeReturnPct
                  }
                  %
                </span>
              </div>
              {(() => {
                const pts = portfolioAnalytics.equityCurve;
                const vals = pts.map(p => p.cumulativeReturnPct);
                const minV = Math.min(0, ...vals);
                const maxV = Math.max(1, ...vals);
                const span = Math.max(1, maxV - minV);
                const w = 280;
                const h = 56;
                const coords = pts.map((p, idx) => {
                  const x = (idx / Math.max(1, pts.length - 1)) * w;
                  const y = h - 6 - ((p.cumulativeReturnPct - minV) / span) * (h - 12);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                });
                const isUp = vals[vals.length - 1] >= 0;
                return (
                  <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14 overflow-visible">
                    <polyline
                      fill="none"
                      stroke={isUp ? '#10b981' : '#f43f5e'}
                      strokeWidth="2"
                      points={coords.join(' ')}
                    />
                  </svg>
                );
              })()}
            </div>
          )}

          {/* Closed Trades List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {closedTrades.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-gray-500 bg-[#0d121c] rounded-xl border border-[#1b2536]">
                Lịch sử đang trống. Hãy bấm <b>"Mở Lệnh Thử Nghiệm"</b> để tự mình kiểm chứng hiệu quả các chiến lược do AI gợi ý!
              </div>
            ) : (
              closedTrades.map(trade => {
                const isWin = trade.status === 'TP_HIT' || trade.pnlPercent > 0;
                return (
                  <div key={trade.id} className="p-2 rounded-lg bg-[#0e141f] border border-[#1d2738] flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        trade.status === 'TP_HIT' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        trade.status === 'SL_HIT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        trade.status === 'CANCELLED' ? 'bg-gray-800 text-gray-400' : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {trade.status === 'TP_HIT' ? '🎯 CHỐT LỜI' :
                         trade.status === 'SL_HIT' ? '🛡️ CẮT LỖ' :
                         trade.status === 'CANCELLED' ? 'ĐÃ HỦY' : 'ĐÓNG TAY'}
                      </span>
                      <span className="font-bold text-white">{trade.symbol}</span>
                      <span className="text-[9px] text-gray-400 truncate max-w-[80px]">{trade.strategyName}</span>
                    </div>

                    <div className="text-right">
                      <span className={`font-bold ${isWin ? 'text-emerald-400' : trade.pnlPercent < 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                        {trade.pnlPercent > 0 ? '+' : ''}{trade.pnlPercent}%
                      </span>
                      <div className="text-[9px] text-gray-400">
                        {trade.pnlAmount > 0 ? '+' : ''}{isVND ? `${formatPrice(trade.pnlAmount)} VNĐ` : `$${formatPrice(trade.pnlAmount)}`}
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
                  Chọn Điểm Vào Lệnh
                </label>
                <div className="grid grid-cols-2 gap-1.5 font-mono">
                  <button
                    onClick={() => setTestEntryType('current')}
                    className={`p-2 rounded-lg border text-left ${
                      testEntryType === 'current'
                        ? 'bg-blue-600/25 border-blue-500 text-white'
                        : 'bg-[#141b27] border-[#222e42] text-gray-400'
                    }`}
                  >
                    <div className="text-[9px] uppercase font-bold text-emerald-400">⚡ Khớp Ngay Giá Live</div>
                    <div className="font-bold text-xs text-white mt-0.5">{prefix}{formatPrice(currentPrice)}{priceSuffix}</div>
                  </button>

                  <button
                    onClick={() => setTestEntryType('entry_zone')}
                    className={`p-2 rounded-lg border text-left ${
                      testEntryType === 'entry_zone'
                        ? 'bg-blue-600/25 border-blue-500 text-white'
                        : 'bg-[#141b27] border-[#222e42] text-gray-400'
                    }`}
                  >
                    <div className="text-[9px] uppercase font-bold text-amber-400">⏳ Chờ Khớp Vùng Entry</div>
                    <div className="font-bold text-xs text-white mt-0.5">{prefix}{formatPrice(currentItem.entryZone[0])}{priceSuffix}</div>
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
                    <option value={2}>{isVND ? 'Margin 2x (Lãi ~12%/năm)' : 'Futures 2x'}</option>
                    <option value={5}>Đòn bẩy 5x</option>
                    <option value={10}>Đòn bẩy 10x</option>
                  </select>
                </div>
              </div>

              {isVND ? (
                <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[10px] text-amber-200 leading-relaxed font-sans">
                  {symbol.toUpperCase().startsWith('VN30F')
                    ? '⚡ Hợp đồng tương lai VN30F1M: Giao dịch T+0 hai chiều Long/Short ngay trong phiên.'
                    : '📌 Quy tắc VSD Việt Nam: Cổ phiếu cơ sở khóa bán chiều T+0 & T+1, mở bán lúc 13:00 ngày T+2. Tự động khấu trừ phí 2 chiều (~0.30%), thuế bán 0.10% và lãi vay Margin 12%/năm (nếu > 1x).'}
                </div>
              ) : isCryptoSymbol(activeSymbol) || quoteAsset === 'USDT' ? (
                <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-[10px] text-cyan-200 leading-relaxed font-sans">
                  🪙 <b>Chuẩn Khớp Lệnh Crypto 24/7:</b> Tự động khấu trừ phí Taker hai chiều (Perp 0.08%×Đòn bẩy / Spot 0.10%) và phí <b>Funding Rate mỗi 8h</b> khi mở vị thế đòn bẩy &gt; 1x.
                </div>
              ) : isUsOrGlobalEquitySymbol(activeSymbol) ? (
                (() => {
                  const pdt = checkUsPdtRuleWarning(
                    paperTrades.map((t) => ({
                      symbol: t.symbol,
                      openedAt: t.filledTime || t.openTime,
                      closedAt: t.closeTime,
                      status: t.status,
                    })),
                    testCapital
                  );
                  return (
                    <div
                      className={`p-2 rounded-lg border text-[10px] leading-relaxed font-sans space-y-1 ${
                        pdt.status === 'PDT_RESTRICTED'
                          ? 'bg-rose-950/40 border-rose-500/45 text-rose-200'
                          : pdt.status === 'APPROACHING_LIMIT'
                          ? 'bg-amber-950/35 border-amber-500/40 text-amber-200'
                          : 'bg-indigo-950/30 border-indigo-500/35 text-indigo-200'
                      }`}
                    >
                      <div className="font-bold">🌎 {pdt.badgeVi}</div>
                      <div>
                        Thanh toán <b>SEC T+1</b> • Phí SEC/FINRA TAF (~0.015%) • Lãi vay Margin USD{' '}
                        <b>~8.0%/năm</b> (khi Đòn bẩy &gt; 1x).
                      </div>
                      {pdt.warningVi && <div className="text-rose-300 font-semibold">{pdt.warningVi}</div>}
                    </div>
                  );
                })()
              ) : null}
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
                <span>Xác Nhận Mở Lệnh</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
