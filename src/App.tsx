import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AIPrediction,
  Candle,
  FibonacciLevel,
  IndicatorSettings,
  MarketSentiment,
  MarketSymbol,
  OrderBlock,
  OrderBook as OrderBookType,
  StrategyAnalysisHub,
  SupportResistanceLevel,
  Timeframe,
  TradeSetup,
} from './types';
import {
  DEFAULT_SYMBOLS,
  fetchMarketData,
  getMarketSentiment,
  updateAllLiveMarketPrices,
} from './services/api/marketData';
import {
  loadSymbolsFromStorage,
  saveSymbolsToStorage,
  loadFavoritesFromStorage,
  saveFavoritesToStorage,
} from './services/api/symbolCatalog';
import { BinanceWebSocket, fetchBinanceOrderBook } from './services/api/binance';
import { calculateSupportResistance } from './services/analysis/supportResistance';
import { calculateFibonacciLevels } from './services/analysis/fibonacci';
import { detectOrderBlocks } from './services/analysis/smartMoney';
import { generateAIPrediction } from './services/ai/mlForecaster';
import { generateTradeSetup, generateStrategyHub } from './services/ai/signalGenerator';

// Components
import { Header } from './components/Layout/Header';
import { IndicatorToolbar } from './components/Chart/IndicatorToolbar';
import { TradingChart } from './components/Chart/TradingChart';
import { IndicatorPanels } from './components/Chart/IndicatorPanels';
import { AIPredictionCard } from './components/AIInsight/AIPredictionCard';
import { TradeSetupCard } from './components/AIInsight/TradeSetupCard';
import { RiskCalculator } from './components/AIInsight/RiskCalculator';
import { Watchlist } from './components/Market/Watchlist';
import { OrderBook } from './components/Market/OrderBook';
import { SentimentMeter } from './components/Market/SentimentMeter';
import { MarketHeatmap } from './components/Market/MarketHeatmap';
import { BacktestModal } from './components/Backtest/BacktestModal';
import { Sparkles, Layers, Shield, LineChart, Flame } from 'lucide-react';

export const App: React.FC = () => {
  // Load persisted symbols or fallback to defaults
  const [symbols, setSymbols] = useState<MarketSymbol[]>(() => loadSymbolsFromStorage());
  const [currentSymbol, setCurrentSymbol] = useState<MarketSymbol>(() => {
    const initial = loadSymbolsFromStorage();
    return initial[0] || DEFAULT_SYMBOLS[0];
  });
  const [favorites, setFavorites] = useState<string[]>(() => loadFavoritesFromStorage());

  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBookType | null>(null);
  const [isLiveLoading, setIsLiveLoading] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'chart' | 'heatmap'>('chart');
  const [isBacktestOpen, setIsBacktestOpen] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<'ai' | 'market' | 'risk'>('ai');
  const [mobileTab, setMobileTab] = useState<'chart' | 'ai' | 'market' | 'risk'>('chart');

  // References for live ticker background polling
  const currentSymbolRef = useRef<MarketSymbol>(currentSymbol);
  useEffect(() => {
    currentSymbolRef.current = currentSymbol;
  }, [currentSymbol]);

  const symbolsRef = useRef<MarketSymbol[]>(symbols);
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  // Indicator Settings
  const [settings, setSettings] = useState<IndicatorSettings>({
    ema20: true,
    ema50: true,
    ema200: false,
    bollingerBands: false,
    supertrend: true,
    ichimoku: false,
    rsi: true,
    macd: false,
    stochastic: false,
    vwap: false,
    volumeProfile: false,
    autoSupportResistance: true,
    autoFibonacci: true,
    smartMoneyConcepts: true,
    aiForecast: true,
    monteCarloPaths: true,
  });

  const wsRef = useRef<BinanceWebSocket | null>(null);

  // Toggle Indicator Setting
  const handleToggleIndicator = (key: keyof IndicatorSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Persist Symbols whenever changed
  const updateSymbolsAndPersist = (newSymbols: MarketSymbol[]) => {
    setSymbols(newSymbols);
    symbolsRef.current = newSymbols;
    saveSymbolsToStorage(newSymbols);
  };

  // Add new symbol
  const handleAddSymbol = (newSymbol: MarketSymbol) => {
    const updated = [newSymbol, ...symbols];
    updateSymbolsAndPersist(updated);
    handleSelectSymbol(newSymbol);
  };

  // Edit existing symbol
  const handleEditSymbol = (updatedSymbol: MarketSymbol) => {
    const updated = symbols.map(s => (s.symbol === updatedSymbol.symbol ? updatedSymbol : s));
    updateSymbolsAndPersist(updated);
    if (currentSymbol.symbol === updatedSymbol.symbol) {
      setCurrentSymbol(updatedSymbol);
      currentSymbolRef.current = updatedSymbol;
    }
  };

  // Delete symbol
  const handleDeleteSymbol = (symbolKey: string) => {
    if (symbols.length <= 1) {
      alert('Không thể xóa mã cuối cùng trong danh sách theo dõi!');
      return;
    }
    const updated = symbols.filter(s => s.symbol !== symbolKey);
    updateSymbolsAndPersist(updated);

    if (currentSymbol.symbol === symbolKey) {
      handleSelectSymbol(updated[0]);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = (symbolKey: string) => {
    setFavorites(prev => {
      const next = prev.includes(symbolKey) ? prev.filter(k => k !== symbolKey) : [...prev, symbolKey];
      saveFavoritesToStorage(next);
      return next;
    });
  };

  // Reset to default symbols
  const handleResetDefaults = () => {
    if (confirm('Khôi phục danh sách theo dõi về mặc định ban đầu?')) {
      updateSymbolsAndPersist(DEFAULT_SYMBOLS);
      handleSelectSymbol(DEFAULT_SYMBOLS[0]);
    }
  };

  // Continuous Real-Time Price Sync (2.0 seconds rapid poll)
  const syncLivePrices = useCallback(async () => {
    try {
      const currentList = symbolsRef.current;
      const updated = await updateAllLiveMarketPrices(currentList);
      setSymbols(updated);
      symbolsRef.current = updated;

      // Keep current symbol updated with latest price & change
      const activeKey = currentSymbolRef.current.symbol;
      const currentUpdated = updated.find(s => s.symbol === activeKey);
      if (currentUpdated) {
        setCurrentSymbol(prev => ({
          ...prev,
          price: currentUpdated.price,
          change24h: currentUpdated.change24h,
          high24h: currentUpdated.high24h,
          low24h: currentUpdated.low24h,
          volume24h: currentUpdated.volume24h,
        }));
      }
    } catch (e) {
      console.warn('Error syncing live prices', e);
    }
  }, []);

  useEffect(() => {
    syncLivePrices();
    const interval = setInterval(() => {
      syncLivePrices();
    }, 2000);

    return () => clearInterval(interval);
  }, [syncLivePrices]);

  // Load Klines and Depth
  const loadData = async (symbolObj: MarketSymbol, tf: Timeframe) => {
    setIsLiveLoading(true);
    try {
      const data = await fetchMarketData(symbolObj, tf);
      setCandles(data);

      // Synchronize currentSymbol's price and 24h stats immediately with latest candle
      if (data && data.length > 0) {
        const lastCandle = data[data.length - 1];
        const firstCandle = data[0];
        const change24h = firstCandle.open > 0 ? ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100 : 0;
        const maxHigh = Math.max(...data.map(d => d.high));
        const minLow = Math.min(...data.map(d => d.low));

        setCurrentSymbol(prev => ({
          ...prev,
          price: lastCandle.close,
          change24h: parseFloat(change24h.toFixed(2)),
          high24h: maxHigh,
          low24h: minLow,
        }));

        setSymbols(prev =>
          prev.map(s => (s.symbol === symbolObj.symbol ? {
            ...s,
            price: lastCandle.close,
            change24h: parseFloat(change24h.toFixed(2)),
            high24h: maxHigh,
            low24h: minLow
          } : s))
        );
      }

      const isDepthSupported =
        symbolObj.type === 'crypto' ||
        symbolObj.symbol === 'PAXGUSDT' ||
        symbolObj.symbol === 'XAUUSD' ||
        symbolObj.symbol === 'GOLD';

      if (isDepthSupported) {
        try {
          const depthSymbol = symbolObj.symbol === 'XAUUSD' || symbolObj.symbol === 'GOLD' ? 'PAXGUSDT' : symbolObj.symbol;
          const depth = await fetchBinanceOrderBook(depthSymbol, 12);
          setOrderBook(depth);
        } catch (e) {
          console.warn('Depth fetch error', e);
        }
      }
    } catch (e) {
      console.error('Error fetching market data', e);
    } finally {
      setIsLiveLoading(false);
    }
  };

  // Instant Symbol Selector Handler: immediately loads fresh data and updates price
  const handleSelectSymbol = (sym: MarketSymbol) => {
    const fresh = symbols.find(s => s.symbol === sym.symbol) || sym;
    setCurrentSymbol(fresh);
    currentSymbolRef.current = fresh;

    if (activeView === 'heatmap') setActiveView('chart');
    setMobileTab('chart');

    loadData(fresh, timeframe);
  };

  useEffect(() => {
    loadData(currentSymbol, timeframe);

    // Setup Binance WebSocket for real-time crypto & PAXG gold price updates
    const streamSymbol = currentSymbol.symbol === 'XAUUSD' || currentSymbol.symbol === 'GOLD' ? 'PAXGUSDT' : currentSymbol.symbol;
    const isBinanceStreamable =
      currentSymbol.type === 'crypto' ||
      currentSymbol.symbol === 'PAXGUSDT' ||
      currentSymbol.symbol === 'XAUUSD' ||
      currentSymbol.symbol === 'GOLD';

    if (isBinanceStreamable) {
      if (!wsRef.current) {
        wsRef.current = new BinanceWebSocket();
      }

      wsRef.current.connect(streamSymbol, timeframe, (newCandle) => {
        setCandles(prev => {
          if (prev.length === 0) return [newCandle];
          const last = prev[prev.length - 1];

          if (last.time === newCandle.time) {
            const updated = [...prev];
            updated[updated.length - 1] = newCandle;
            return updated;
          } else if (newCandle.time > last.time) {
            return [...prev.slice(1), newCandle];
          }
          return prev;
        });

        setCurrentSymbol(prev => ({
          ...prev,
          price: newCandle.close,
        }));

        setSymbols(prev =>
          prev.map(s => (s.symbol === currentSymbol.symbol ? { ...s, price: newCandle.close } : s))
        );
      });
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, [currentSymbol.symbol, timeframe]);

  // Derived Analytics & Calculations
  const srLevels: SupportResistanceLevel[] = useMemo(() => {
    return calculateSupportResistance(candles);
  }, [candles]);

  const fibLevels: FibonacciLevel[] = useMemo(() => {
    return calculateFibonacciLevels(candles);
  }, [candles]);

  const orderBlocks: OrderBlock[] = useMemo(() => {
    return detectOrderBlocks(candles);
  }, [candles]);

  const aiPrediction: AIPrediction | null = useMemo(() => {
    return generateAIPrediction(currentSymbol.symbol, candles, 24);
  }, [currentSymbol.symbol, candles]);

  const strategyHub: StrategyAnalysisHub = useMemo(() => {
    return generateStrategyHub(currentSymbol.symbol, candles, timeframe);
  }, [currentSymbol.symbol, candles, timeframe]);

  const tradeSetup: TradeSetup | null = useMemo(() => {
    return generateTradeSetup(currentSymbol.symbol, candles, timeframe);
  }, [currentSymbol.symbol, candles, timeframe]);

  const marketSentiment: MarketSentiment = useMemo(() => {
    return getMarketSentiment();
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080b11] text-gray-100 overflow-hidden select-none font-sans">
      {/* Top Header */}
      <Header
        currentSymbol={currentSymbol}
        symbols={symbols}
        timeframe={timeframe}
        onSelectSymbol={handleSelectSymbol}
        onChangeTimeframe={setTimeframe}
        onOpenBacktest={() => setIsBacktestOpen(true)}
        onOpenHeatmap={() => setActiveView(activeView === 'heatmap' ? 'chart' : 'heatmap')}
        onRefreshData={() => {
          syncLivePrices();
          loadData(currentSymbol, timeframe);
        }}
        isLiveLoading={isLiveLoading}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Indicator Toolbar (Rendered on chart view) */}
      {activeView === 'chart' && (
        <IndicatorToolbar
          settings={settings}
          onToggle={handleToggleIndicator}
        />
      )}

      {/* Main Workstation Body: Chart View and Heatmap View toggled without unmounting */}
      <div className="flex-1 flex overflow-hidden relative pb-14 md:pb-0">
        {/* Heatmap View */}
        <div className={`flex-1 flex flex-col ${activeView === 'heatmap' ? 'flex' : 'hidden'}`}>
          <MarketHeatmap
            symbols={symbols}
            onSelectSymbol={handleSelectSymbol}
            onClose={() => setActiveView('chart')}
          />
        </div>

        {/* Main Trading Chart & Workstation Panels */}
        <div className={`flex-1 flex overflow-hidden ${activeView === 'chart' ? 'flex' : 'hidden'}`}>
          {/* Main Chart Area (Visible on Desktop OR when MobileTab === 'chart') */}
          <div className={`flex-1 flex-col min-w-0 bg-[#090d15] relative ${
            mobileTab === 'chart' ? 'flex' : 'hidden md:flex'
          }`}>
            {/* Lightweight Candles & Indicators Chart */}
            <div className="flex-1 relative">
              <TradingChart
                candles={candles}
                timeframe={timeframe}
                settings={settings}
                srLevels={srLevels}
                fibLevels={fibLevels}
                orderBlocks={orderBlocks}
                aiPrediction={aiPrediction}
              />
            </div>

            {/* Sub-panels (RSI & MACD) */}
            <IndicatorPanels
              candles={candles}
              settings={settings}
            />
          </div>

          {/* Right Sidebar on Desktop (OR full view on mobile when tab is selected) */}
          <div className={`flex-col bg-[#0d121c] border-l border-[#1b2230] overflow-hidden ${
            mobileTab !== 'chart' ? 'flex flex-1 w-full' : 'hidden md:flex w-80 lg:w-96'
          }`}>
            {/* Panel Tabs (Desktop) */}
            <div className="hidden md:flex border-b border-[#1b2230] bg-[#0f1522] text-xs font-semibold">
              <button
                onClick={() => setRightPanelTab('ai')}
                className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition ${
                  rightPanelTab === 'ai'
                    ? 'bg-[#141b27] text-blue-400 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI & Tín Hiệu</span>
              </button>

              <button
                onClick={() => setRightPanelTab('risk')}
                className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition ${
                  rightPanelTab === 'risk'
                    ? 'bg-[#141b27] text-indigo-400 border-b-2 border-indigo-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Quản Lý Vốn</span>
              </button>

              <button
                onClick={() => setRightPanelTab('market')}
                className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition ${
                  rightPanelTab === 'market'
                    ? 'bg-[#141b27] text-emerald-400 border-b-2 border-emerald-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Thị Trường ({symbols.length})</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {((rightPanelTab === 'ai' && mobileTab === 'chart') || mobileTab === 'ai') && (
                <>
                  <AIPredictionCard
                    prediction={aiPrediction}
                    quoteAsset={currentSymbol.quoteAsset}
                  />
                  <TradeSetupCard
                    strategyHub={strategyHub}
                    setup={tradeSetup}
                    quoteAsset={currentSymbol.quoteAsset}
                  />
                  <SentimentMeter sentiment={marketSentiment} />
                </>
              )}

              {((rightPanelTab === 'risk' && mobileTab === 'chart') || mobileTab === 'risk') && (
                <>
                  <RiskCalculator
                    currentPrice={currentSymbol.price}
                    stopLossPrice={strategyHub?.bestStrategy?.stopLoss || tradeSetup?.stopLoss || currentSymbol.price * 0.95}
                    quoteAsset={currentSymbol.quoteAsset}
                  />
                  <TradeSetupCard
                    strategyHub={strategyHub}
                    setup={tradeSetup}
                    quoteAsset={currentSymbol.quoteAsset}
                  />
                </>
              )}

              {((rightPanelTab === 'market' && mobileTab === 'chart') || mobileTab === 'market') && (
                <div className="flex flex-col h-full -m-3">
                  <div className="flex-1 overflow-hidden">
                    <Watchlist
                      symbols={symbols}
                      currentSymbol={currentSymbol}
                      favorites={favorites}
                      onSelectSymbol={handleSelectSymbol}
                      onAddSymbol={handleAddSymbol}
                      onEditSymbol={handleEditSymbol}
                      onDeleteSymbol={handleDeleteSymbol}
                      onToggleFavorite={handleToggleFavorite}
                      onResetDefaults={handleResetDefaults}
                    />
                  </div>
                  <OrderBook
                    orderBook={orderBook}
                    currentPrice={currentSymbol.price}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= MOBILE BOTTOM NAVIGATION BAR (< 768px) ================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#0a0e17] border-t border-[#1f293d] flex items-center justify-around z-40 px-1 backdrop-blur-xl">
        <button
          onClick={() => {
            setActiveView('chart');
            setMobileTab('chart');
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
            activeView === 'chart' && mobileTab === 'chart' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <LineChart className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5">Biểu Đồ</span>
        </button>

        <button
          onClick={() => {
            setActiveView('chart');
            setMobileTab('ai');
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
            activeView === 'chart' && mobileTab === 'ai' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5">Tín Hiệu AI</span>
        </button>

        <button
          onClick={() => {
            setActiveView('chart');
            setMobileTab('market');
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
            activeView === 'chart' && mobileTab === 'market' ? 'text-emerald-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5">Thị Trường</span>
        </button>

        <button
          onClick={() => {
            setActiveView('chart');
            setMobileTab('risk');
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
            activeView === 'chart' && mobileTab === 'risk' ? 'text-indigo-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5">Vốn & Rủi Ro</span>
        </button>

        <button
          onClick={() => setActiveView(activeView === 'heatmap' ? 'chart' : 'heatmap')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
            activeView === 'heatmap' ? 'text-amber-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5">Nhiệt</span>
        </button>
      </div>

      {/* Backtest Strategy Modal */}
      {isBacktestOpen && (
        <BacktestModal
          candles={candles}
          symbolName={currentSymbol.symbol}
          quoteAsset={currentSymbol.quoteAsset}
          onClose={() => setIsBacktestOpen(false)}
        />
      )}
    </div>
  );
};
export default App;
