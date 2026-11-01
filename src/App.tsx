import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AIPrediction,
  Candle,
  FibonacciLevel,
  ForecastAuditEntry,
  IndicatorSettings,
  KronosConfig,
  MacroIntelligenceSnapshot,
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
  fetchAllLiveMarketQuotes,
  fetchLiveCryptoFearAndGreed,
  fetchMarketData,
  getMarketSentiment,
} from './services/api/marketData';
import {
  loadSymbolsFromStorage,
  saveSymbolsToStorage,
  loadFavoritesFromStorage,
  saveFavoritesToStorage,
} from './services/api/symbolCatalog';
import {
  BinanceWatchlistSocket,
  BinanceWebSocket,
  fetchBinanceOrderBook,
} from './services/api/binance';
import { calculateSupportResistance } from './services/analysis/supportResistance';
import { calculateFibonacciLevels } from './services/analysis/fibonacci';
import { detectOrderBlocks } from './services/analysis/smartMoney';
import { generateAIPrediction } from './services/ai/mlForecaster';
import {
  fetchKronosCloudPrediction,
  KronosPredictionOutput,
  loadKronosConfig,
  saveKronosConfig,
} from './services/ai/kronosClient';
import { generateTradeSetup, generateStrategyHub } from './services/ai/signalGenerator';
import { analyzeAccumulationZone } from './services/ai/accumulationScanner';
import {
  evaluateSymbolMacroImpact,
  fetchMacroIntelligenceSnapshot,
} from './services/macro/macroIntelligence';
import {
  clearForecastAuditLog,
  loadForecastAuditEntries,
  reconcileForecastAuditLog,
  recordKronosForecastCheckpoint,
} from './services/ai/forecastAuditLog';
import { formatPrice, formatPercent, formatVolume } from './utils/formatters';

// Components
import { Header } from './components/Layout/Header';
import { MarketTickerStrip } from './components/Layout/MarketTickerStrip';
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
import { AccumulationRadarModal } from './components/Market/AccumulationRadarModal';
import { MacroIntelligenceModal, MacroModalTab } from './components/Macro/MacroIntelligenceModal';
import { AlertTriangle, Sparkles, Layers, Shield, LineChart, Flame, Globe2, Target, X } from 'lucide-react';

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
  const [isRadarOpen, setIsRadarOpen] = useState<boolean>(false);
  const [isMacroModalOpen, setIsMacroModalOpen] = useState<boolean>(false);
  const [macroModalTab, setMacroModalTab] = useState<MacroModalTab>('indicators');
  const [isMacroRefreshing, setIsMacroRefreshing] = useState<boolean>(false);
  const [macroSnapshot, setMacroSnapshot] = useState<MacroIntelligenceSnapshot | null>(null);
  const [isMacroBannerDismissed, setIsMacroBannerDismissed] = useState<boolean>(false);
  const [auditEntries, setAuditEntries] = useState<ForecastAuditEntry[]>(() =>
    loadForecastAuditEntries()
  );
  const [isGomBannerDismissed, setIsGomBannerDismissed] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<'ai' | 'market' | 'risk'>('ai');
  const [mobileTab, setMobileTab] = useState<'chart' | 'ai' | 'market' | 'risk'>('chart');
  const [showLeftDock, setShowLeftDock] = useState<boolean>(true);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isXlScreen, setIsXlScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  );

  useEffect(() => {
    const onResize = () => setIsXlScreen(window.innerWidth >= 1280);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // References for live ticker background polling
  const currentSymbolRef = useRef<MarketSymbol>(currentSymbol);
  useEffect(() => {
    currentSymbolRef.current = currentSymbol;
  }, [currentSymbol]);

  const symbolsRef = useRef<MarketSymbol[]>(symbols);
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  // Indicator Settings (Mặc định bật RSI, MACD, Hỗ trợ/Kháng cự, BB, và Nến AI Kronos)
  const [settings, setSettings] = useState<IndicatorSettings>({
    rsi: true,
    macd: true,
    autoSupportResistance: true,
    bollingerBands: true,
    ema20: false,
    ema50: false,
    ema200: false,
    supertrend: false,
    ichimoku: false,
    stochastic: false,
    vwap: false,
    volumeProfile: false,
    autoFibonacci: false,
    smartMoneyConcepts: false,
    aiForecast: true,
    monteCarloPaths: false,
    kronosGhostCandles: true,
    kronosWalkForward: true,
  });

  // Kronos Foundation Model Configuration & Optional Cloud Override
  const [kronosConfig, setKronosConfig] = useState<KronosConfig>(() => loadKronosConfig());
  const [kronosCloudOutput, setKronosCloudOutput] = useState<KronosPredictionOutput | null>(null);
  const [mtfCandlesMap, setMtfCandlesMap] = useState<Partial<Record<Timeframe, Candle[]>>>({});
  const mtfCacheRef = useRef<Map<string, { ts: number; map: Partial<Record<Timeframe, Candle[]>> }>>(new Map());

  const handleUpdateKronosConfig = useCallback((nextCfg: KronosConfig) => {
    setKronosConfig(nextCfg);
    saveKronosConfig(nextCfg);
  }, []);

  const wsRef = useRef<BinanceWebSocket | null>(null);
  const watchlistWsRef = useRef<BinanceWatchlistSocket | null>(null);
  const isSyncingPricesRef = useRef<boolean>(false);
  const lastStoragePersistRef = useRef<number>(0);

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

  // Continuous Real-Time Multi-Market Price Sync (Binance Crypto/Gold + Yahoo Commodities/Stocks + Entrade VNINDEX/VN30/HNX)
  const syncLivePrices = useCallback(async (forceMacroRefresh: boolean = false) => {
    if (isSyncingPricesRef.current && !forceMacroRefresh) return;
    isSyncingPricesRef.current = true;
    try {
      const quotes = await fetchAllLiveMarketQuotes(symbolsRef.current, { forceMacroRefresh });
      if (quotes.size === 0) return;

      setSymbols(prev => {
        let hasChanges = false;
        const next = prev.map(s => {
          const q = quotes.get(s.symbol);
          if (!q) return s;
          const nextHigh = q.high24h ?? Math.max(s.high24h, q.price);
          const nextLow = q.low24h ?? Math.min(s.low24h, q.price);
          const nextVol = q.volume24h ?? s.volume24h;
          if (
            s.price === q.price &&
            s.change24h === q.change24h &&
            s.high24h === nextHigh &&
            s.low24h === nextLow &&
            s.volume24h === nextVol
          ) {
            return s;
          }
          hasChanges = true;
          return {
            ...s,
            price: q.price,
            change24h: q.change24h,
            high24h: nextHigh,
            low24h: nextLow,
            volume24h: nextVol,
          };
        });

        if (hasChanges) {
          symbolsRef.current = next;
          const now = Date.now();
          if (forceMacroRefresh || now - lastStoragePersistRef.current >= 15_000) {
            lastStoragePersistRef.current = now;
            saveSymbolsToStorage(next);
          }
          return next;
        }
        return prev;
      });

      const activeQuote = quotes.get(currentSymbolRef.current.symbol);
      if (activeQuote) {
        setCurrentSymbol(prev => ({
          ...prev,
          price: activeQuote.price,
          change24h: activeQuote.change24h,
          high24h: activeQuote.high24h ?? Math.max(prev.high24h, activeQuote.price),
          low24h: activeQuote.low24h ?? Math.min(prev.low24h, activeQuote.price),
          volume24h: activeQuote.volume24h ?? prev.volume24h,
        }));
      }
    } catch (e) {
      console.warn('Error syncing live prices', e);
    } finally {
      isSyncingPricesRef.current = false;
    }
  }, []);

  // Add new symbol & immediately fetch live market price
  const handleAddSymbol = (newSymbol: MarketSymbol) => {
    const updated = [newSymbol, ...symbols];
    updateSymbolsAndPersist(updated);
    handleSelectSymbol(newSymbol);
    void syncLivePrices(true);
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

  // Reset to default symbols & immediately refresh live market prices
  const handleResetDefaults = () => {
    if (confirm('Khôi phục danh sách theo dõi về mặc định ban đầu?')) {
      updateSymbolsAndPersist(DEFAULT_SYMBOLS);
      handleSelectSymbol(DEFAULT_SYMBOLS[0]);
      void syncLivePrices(true);
    }
  };

  // Real-time Watchlist WebSocket stream strictly for 24/7 Binance Crypto + PAXGUSDT symbols
  const binanceWatchlistKey = useMemo(() => {
    const list: string[] = [];
    for (const s of symbols) {
      if (s.type === 'crypto' || s.symbol.toUpperCase() === 'PAXGUSDT') {
        list.push(s.symbol.replace(/[/_-]/g, '').toUpperCase());
      }
    }
    return Array.from(new Set(list)).sort().join(',');
  }, [symbols]);

  useEffect(() => {
    if (!watchlistWsRef.current) {
      watchlistWsRef.current = new BinanceWatchlistSocket();
    }
    const streamSymbols = binanceWatchlistKey.split(',').filter(Boolean);

    watchlistWsRef.current.connect(streamSymbols, (batch) => {
      setSymbols(prev => {
        let changed = false;
        const next = prev.map(s => {
          const upper = s.symbol.toUpperCase();
          const tick =
            s.type === 'crypto' || upper === 'PAXGUSDT'
              ? batch.get(upper.replace(/[/_-]/g, ''))
              : undefined;
          if (!tick || (s.price === tick.price && s.change24h === tick.change24h)) {
            return s;
          }
          changed = true;
          return {
            ...s,
            price: tick.price,
            change24h: tick.change24h,
            high24h: tick.high24h,
            low24h: tick.low24h,
            volume24h: tick.volume24h || s.volume24h,
          };
        });
        if (changed) {
          symbolsRef.current = next;
          return next;
        }
        return prev;
      });

      const curUpper = currentSymbolRef.current.symbol.toUpperCase();
      const activeTick =
        currentSymbolRef.current.type === 'crypto' || curUpper === 'PAXGUSDT'
          ? batch.get(curUpper.replace(/[/_-]/g, ''))
          : undefined;
      if (activeTick) {
        setCurrentSymbol(prev => ({
          ...prev,
          price: activeTick.price,
          change24h: activeTick.change24h,
          high24h: activeTick.high24h,
          low24h: activeTick.low24h,
          volume24h: activeTick.volume24h || prev.volume24h,
        }));
      }
    });

    return () => {
      if (watchlistWsRef.current) {
        watchlistWsRef.current.disconnect();
      }
    };
  }, [binanceWatchlistKey]);

  // Single non-overlapping background sync loop + tab focus instant refresh
  useEffect(() => {
    void syncLivePrices(true);
    const interval = setInterval(() => {
      void syncLivePrices(false);
    }, 3000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncLivePrices(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [syncLivePrices]);

  // Load Klines and Depth
  const loadData = async (symbolObj: MarketSymbol, tf: Timeframe) => {
    setIsLiveLoading(true);
    try {
      const data = await fetchMarketData(symbolObj, tf);

      if (data && data.length > 0) {
        const lastCandle = data[data.length - 1];

        // Update Watchlist entry with latest candle close while preserving true 24h % change
        setSymbols(prev => {
          const next = prev.map(s =>
            s.symbol === symbolObj.symbol
              ? {
                  ...s,
                  price: lastCandle.close,
                  high24h: Math.max(s.high24h, lastCandle.close),
                  low24h: s.low24h > 0 ? Math.min(s.low24h, lastCandle.close) : lastCandle.low,
                }
              : s
          );
          symbolsRef.current = next;
          return next;
        });

        // Guard against stale async responses if user already switched to another symbol
        if (currentSymbolRef.current.symbol === symbolObj.symbol) {
          setCandles(data);
          setCurrentSymbol(prev => ({
            ...prev,
            price: lastCandle.close,
            high24h: Math.max(prev.high24h, lastCandle.close),
            low24h: prev.low24h > 0 ? Math.min(prev.low24h, lastCandle.close) : lastCandle.low,
          }));
        }
      }

      const isDepthSupported =
        symbolObj.type === 'crypto' || symbolObj.symbol.toUpperCase() === 'PAXGUSDT';

      if (isDepthSupported && currentSymbolRef.current.symbol === symbolObj.symbol) {
        try {
          const depth = await fetchBinanceOrderBook(symbolObj.symbol, 10);
          if (currentSymbolRef.current.symbol === symbolObj.symbol) {
            setOrderBook(depth);
          }
        } catch (e) {
          console.warn('Depth fetch error', e);
        }
      } else if (!isDepthSupported && currentSymbolRef.current.symbol === symbolObj.symbol) {
        setOrderBook(null);
      }
    } catch (e) {
      console.error('Error fetching market data', e);
    } finally {
      if (currentSymbolRef.current.symbol === symbolObj.symbol) {
        setIsLiveLoading(false);
      }
    }
  };

  // Instant Symbol Selector Handler: immediately loads fresh data and updates price
  const handleSelectSymbol = (sym: MarketSymbol) => {
    const fresh = symbolsRef.current.find(s => s.symbol === sym.symbol) || sym;
    setCurrentSymbol(fresh);
    currentSymbolRef.current = fresh;
    setOrderBook(null);

    if (activeView === 'heatmap') setActiveView('chart');
    setMobileTab('chart');

    loadData(fresh, timeframe);
  };

  useEffect(() => {
    loadData(currentSymbol, timeframe);

    // Setup Binance WebSocket & real Level-2 OrderBook polling strictly for 24/7 Crypto & PAXGUSDT
    const isBinanceStreamable =
      currentSymbol.type === 'crypto' || currentSymbol.symbol.toUpperCase() === 'PAXGUSDT';

    let depthInterval: ReturnType<typeof setInterval> | null = null;

    if (isBinanceStreamable) {
      if (!wsRef.current) {
        wsRef.current = new BinanceWebSocket();
      }

      wsRef.current.connect(currentSymbol.symbol, timeframe, (newCandle) => {
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

        setSymbols(prev => {
          const next = prev.map(s => (s.symbol === currentSymbol.symbol ? { ...s, price: newCandle.close } : s));
          symbolsRef.current = next;
          return next;
        });
      });

      const activeSym = currentSymbol.symbol;
      depthInterval = setInterval(async () => {
        if (document.visibilityState === 'hidden') return;
        try {
          const depth = await fetchBinanceOrderBook(activeSym, 10);
          if (currentSymbolRef.current.symbol === activeSym) {
            setOrderBook(depth);
          }
        } catch {
          // keep last valid real depth snapshot
        }
      }, 4000);
    } else {
      setOrderBook(null);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      if (depthInterval) {
        clearInterval(depthInterval);
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

  // Attempt non-blocking connection to Kronos PyTorch Server if configured
  useEffect(() => {
    let active = true;
    if (candles.length >= 30) {
      fetchKronosCloudPrediction(currentSymbol.symbol, candles, kronosConfig).then(res => {
        if (active) setKronosCloudOutput(res);
      });
    } else {
      setKronosCloudOutput(null);
    }
    return () => {
      active = false;
    };
  }, [currentSymbol.symbol, candles.length, kronosConfig]);

  // Background Multi-Timeframe Klines Fetcher (15m • 1h • 4h • 1D) with 60s per-symbol cache
  useEffect(() => {
    let active = true;
    const symKey = currentSymbol.symbol;
    const cached = mtfCacheRef.current.get(symKey);

    if (cached && Date.now() - cached.ts < 60000) {
      setMtfCandlesMap(cached.map);
      return;
    }

    const mtfList: Timeframe[] = ['15m', '1h', '4h', '1D'];
    Promise.allSettled(mtfList.map(tf => fetchMarketData(currentSymbol, tf))).then(results => {
      if (!active) return;
      const nextMap: Partial<Record<Timeframe, Candle[]>> = {};
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value && res.value.length >= 28) {
          nextMap[mtfList[idx]] = res.value;
        }
      });
      mtfCacheRef.current.set(symKey, { ts: Date.now(), map: nextMap });
      setMtfCandlesMap(nextMap);
    });

    return () => {
      active = false;
    };
  }, [currentSymbol.symbol]);

  // Live Global & Vietnam Macro Intelligence Polling (DXY, USD/VND, US10Y, VIX, Brent, Nasdaq, BTC Funding)
  const refreshMacroSnapshot = useCallback(async (force: boolean = false) => {
    setIsMacroRefreshing(true);
    try {
      const snap = await fetchMacroIntelligenceSnapshot(force);
      if (snap) setMacroSnapshot(snap);
    } finally {
      setIsMacroRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshMacroSnapshot(false);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshMacroSnapshot(false);
      }
    }, 45_000);
    return () => clearInterval(interval);
  }, [refreshMacroSnapshot]);

  useEffect(() => {
    setIsMacroBannerDismissed(false);
  }, [currentSymbol.symbol]);

  const currentMacroImpact = useMemo(() => {
    return evaluateSymbolMacroImpact(currentSymbol, macroSnapshot);
  }, [currentSymbol, macroSnapshot]);

  const aiPrediction: AIPrediction | null = useMemo(() => {
    return generateAIPrediction(
      currentSymbol.symbol,
      candles,
      kronosConfig.predLen,
      kronosConfig,
      kronosCloudOutput,
      timeframe,
      mtfCandlesMap,
      macroSnapshot,
      currentSymbol
    );
  }, [
    currentSymbol,
    candles,
    kronosConfig,
    kronosCloudOutput,
    timeframe,
    mtfCandlesMap,
    macroSnapshot,
  ]);

  const strategyHub: StrategyAnalysisHub = useMemo(() => {
    return generateStrategyHub(
      currentSymbol.symbol,
      candles,
      timeframe,
      macroSnapshot,
      currentSymbol
    );
  }, [currentSymbol, candles, timeframe, macroSnapshot]);

  const currentAccumulation = useMemo(() => {
    return analyzeAccumulationZone(currentSymbol, candles);
  }, [currentSymbol, candles]);

  const tradeSetup: TradeSetup | null = useMemo(() => {
    return generateTradeSetup(
      currentSymbol.symbol,
      candles,
      timeframe,
      macroSnapshot,
      currentSymbol
    );
  }, [currentSymbol, candles, timeframe, macroSnapshot]);

  // Auto-record & reconcile Kronos P50 checkpoints strictly against REAL closed candles & live quotes
  useEffect(() => {
    if (!aiPrediction || candles.length < 30) return;
    const lastCandleTime = candles[candles.length - 1]?.time || Math.floor(Date.now() / 1000);
    const recorded = recordKronosForecastCheckpoint(aiPrediction, timeframe, lastCandleTime, false);
    const reconciled = reconcileForecastAuditLog(currentSymbol.symbol, timeframe, candles, symbols);
    setAuditEntries(reconciled.length > 0 ? reconciled : recorded);
  }, [currentSymbol.symbol, timeframe, candles.length]);

  useEffect(() => {
    if (auditEntries.length === 0) return;
    const reconciled = reconcileForecastAuditLog(currentSymbol.symbol, timeframe, candles, symbols);
    setAuditEntries(reconciled);
  }, [candles, symbols]);

  const handlePinAuditCheckpoint = useCallback(() => {
    if (!aiPrediction || candles.length === 0) return;
    const lastCandleTime = candles[candles.length - 1].time;
    const next = recordKronosForecastCheckpoint(aiPrediction, timeframe, lastCandleTime, true);
    setAuditEntries(next);
  }, [aiPrediction, candles, timeframe]);

  const [liveCryptoFng, setLiveCryptoFng] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchLiveCryptoFearAndGreed().then(val => {
      if (active && val !== null) setLiveCryptoFng(val);
    });
    return () => {
      active = false;
    };
  }, []);

  const marketSentiment: MarketSentiment = useMemo(() => {
    return getMarketSentiment(currentSymbol, candles, symbols, liveCryptoFng);
  }, [currentSymbol, candles, symbols, liveCryptoFng]);

  const isVND = Boolean(
    currentSymbol?.quoteAsset === 'VND' ||
    currentSymbol?.symbol?.includes('VN') ||
    ['FPT', 'HPG', 'VIC', 'VHM', 'SJC', 'MWG', 'MSN', 'SSI', 'VCB'].includes(currentSymbol?.symbol || '')
  );

  const isLeftDockActive = isXlScreen && showLeftDock && !isZenMode;
  const effectiveRightTab =
    isLeftDockActive && rightPanelTab === 'market' ? 'ai' : rightPanelTab;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#06090f] text-slate-100 overflow-hidden select-none font-sans">
      {/* 1. Institutional Top Header */}
      <Header
        currentSymbol={currentSymbol}
        symbols={symbols}
        timeframe={timeframe}
        onSelectSymbol={handleSelectSymbol}
        onChangeTimeframe={setTimeframe}
        onOpenBacktest={() => setIsBacktestOpen(true)}
        onOpenHeatmap={() => setActiveView(activeView === 'heatmap' ? 'chart' : 'heatmap')}
        onOpenRadar={() => setIsRadarOpen(true)}
        onRefreshData={() => {
          syncLivePrices(true);
          void refreshMacroSnapshot(true);
          loadData(currentSymbol, timeframe);
        }}
        isLiveLoading={isLiveLoading}
        activeView={activeView}
        setActiveView={setActiveView}
        signalAction={strategyHub?.bestStrategy?.action}
      />

      {/* 2. Macro Benchmark & Market Breadth Ribbon */}
      <MarketTickerStrip
        symbols={symbols}
        currentSymbol={currentSymbol}
        favorites={favorites}
        aiPrediction={aiPrediction}
        macroSnapshot={macroSnapshot}
        onOpenMacroModal={(tab = 'indicators') => {
          setMacroModalTab(tab);
          setIsMacroModalOpen(true);
        }}
        onSelectSymbol={handleSelectSymbol}
      />

      {/* 3. Indicator & Workspace Control Toolbar (Rendered on chart view) */}
      {activeView === 'chart' && (
        <IndicatorToolbar
          settings={settings}
          onToggle={handleToggleIndicator}
          showLeftDock={showLeftDock}
          onToggleLeftDock={() => {
            setShowLeftDock(prev => {
              const next = !prev;
              if (next && rightPanelTab === 'market') {
                setRightPanelTab('ai');
              }
              return next;
            });
          }}
          isZenMode={isZenMode}
          onToggleZenMode={() => setIsZenMode(prev => !prev)}
        />
      )}

      {/* 4. Main Pro Workstation Body */}
      <div className="flex-1 flex overflow-hidden relative pb-14 md:pb-0">
        {/* Heatmap View */}
        <div className={`flex-1 flex flex-col ${activeView === 'heatmap' ? 'flex' : 'hidden'}`}>
          <MarketHeatmap
            symbols={symbols}
            onSelectSymbol={handleSelectSymbol}
            onClose={() => setActiveView('chart')}
            kronosModelKey={kronosConfig.modelKey}
          />
        </div>

        {/* Main 3-Column Trading Workstation */}
        <div className={`flex-1 flex overflow-hidden ${activeView === 'chart' ? 'flex' : 'hidden'}`}>
          {/* LEFT DOCK (Desktop >= 1280px): Live Watchlist + Direct OrderBook */}
          {isLeftDockActive && (
            <aside className="hidden xl:flex flex-col w-[275px] 2xl:w-[300px] bg-[#080c15] border-r border-slate-800/80 overflow-hidden shrink-0">
              <div className="flex-1 min-h-0 overflow-hidden">
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
                symbol={currentSymbol.symbol}
                quoteAsset={currentSymbol.quoteAsset}
                marketSymbol={currentSymbol}
              />
            </aside>
          )}

          {/* CENTER HERO COLUMN: Interactive Kronos AI Chart & Sub-Panels */}
          <main
            className={`flex-1 flex-col min-w-0 bg-[#060a12] relative overflow-hidden h-full ${
              mobileTab === 'chart' ? 'flex' : 'hidden md:flex'
            }`}
          >
            {/* Contextual Cross-Market Macro Shock / Headwind Alert Banner */}
            {!isMacroBannerDismissed &&
              currentMacroImpact &&
              (currentMacroImpact.bias === 'SEVERE_HEADWIND' ||
                currentMacroImpact.bias === 'HEADWIND' ||
                currentMacroImpact.relevantAlerts.length > 0) && (
                <div
                  className={`border-b px-3 py-1.5 flex items-center justify-between text-xs z-20 animate-in fade-in shrink-0 ${
                    currentMacroImpact.bias === 'SEVERE_HEADWIND' ||
                    currentMacroImpact.relevantAlerts.some(a => a.severity === 'CRITICAL')
                      ? 'bg-gradient-to-r from-rose-950/80 via-[#18111d] to-rose-950/80 border-rose-500/40'
                      : 'bg-gradient-to-r from-cyan-950/65 via-[#10192b] to-amber-950/60 border-amber-500/35'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle
                      className={`w-3.5 h-3.5 shrink-0 ${
                        currentMacroImpact.bias === 'SEVERE_HEADWIND'
                          ? 'text-rose-400 animate-pulse'
                          : 'text-amber-400'
                      }`}
                    />
                    <span className="font-black uppercase font-mono tracking-wide shrink-0 text-amber-300">
                      CẢNH BÁO VĨ MÔ:
                    </span>
                    <span className="text-slate-200 truncate">
                      <strong className="text-white font-mono">{currentSymbol.symbol}</strong> •{' '}
                      {currentMacroImpact.relevantAlerts[0]?.title ||
                        currentMacroImpact.bullets[0] ||
                        currentMacroImpact.headline}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => setIsMacroModalOpen(true)}
                      className="px-2.5 py-0.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-[11px] font-bold transition flex items-center gap-1"
                    >
                      <Globe2 className="w-3 h-3 text-cyan-300" />
                      <span>Chi Tiết Vĩ Mô</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMacroBannerDismissed(true)}
                      className="text-slate-400 hover:text-white p-0.5"
                      title="Ẩn cảnh báo vĩ mô"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            {/* Real-time Accumulation Buy Zone Alert Banner */}
            {currentAccumulation?.isHot && !isGomBannerDismissed && currentAccumulation.entryZone && (
              <div className="bg-gradient-to-r from-amber-950/75 via-[#131d2e] to-amber-950/75 border-b border-amber-500/35 px-3 py-1.5 flex items-center justify-between text-xs z-20 animate-in fade-in shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span className="font-black text-amber-300 uppercase font-mono tracking-wide shrink-0 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                    VÙNG GOM ĐẸP:
                  </span>
                  <span className="text-slate-200 truncate">
                    <strong className="text-white font-mono">{currentSymbol?.symbol}</strong> ({currentAccumulation.score}/100đ) • Vùng gom:{' '}
                    <span className="text-emerald-400 font-mono font-bold">
                      {isVND ? '' : '$'}
                      {formatPrice(currentAccumulation.entryZone[0])} - {isVND ? '' : '$'}
                      {formatPrice(currentAccumulation.entryZone[1])}
                      {isVND ? 'k' : ''}
                    </span>{' '}
                    • Đích:{' '}
                    <span className="text-amber-300 font-mono font-bold">
                      +
                      {currentSymbol?.price
                        ? (
                            ((currentAccumulation.targetTakeProfit - currentSymbol.price) /
                              currentSymbol.price) *
                            100
                          ).toFixed(0)
                        : 0}
                      %
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    onClick={() => setIsRadarOpen(true)}
                    className="px-2.5 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black transition flex items-center gap-1 shadow-sm shadow-amber-500/20"
                  >
                    <span>Quét Toàn TT</span>
                  </button>
                  <button
                    onClick={() => setIsGomBannerDismissed(true)}
                    className="text-slate-400 hover:text-white p-0.5"
                    title="Đóng thông báo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Lightweight Candles & Kronos Ghost Projections */}
            <div className="flex-1 relative min-h-0 overflow-hidden">
              <TradingChart
                candles={candles}
                timeframe={timeframe}
                settings={settings}
                srLevels={srLevels}
                fibLevels={fibLevels}
                orderBlocks={orderBlocks}
                aiPrediction={aiPrediction}
                symbolName={currentSymbol.symbol}
                symbolFullName={currentSymbol.name}
              />
            </div>

            {/* Sub-panels (RSI & MACD) */}
            <IndicatorPanels candles={candles} settings={settings} />
          </main>

          {/* RIGHT COMMAND CENTER (Desktop Sidebar OR Full Mobile View when tab selected) */}
          {(!isZenMode || mobileTab !== 'chart') && (
            <aside
              className={`flex-col bg-[#080d16] border-l border-slate-800/80 overflow-hidden shrink-0 ${
                mobileTab !== 'chart'
                  ? 'flex flex-1 w-full'
                  : 'hidden md:flex w-80 lg:w-[355px] 2xl:w-[385px]'
              }`}
            >
              {/* Segmented Panel Tabs (Desktop) */}
              <div className="hidden md:flex p-1.5 gap-1 border-b border-slate-800/80 bg-[#070b13] text-xs font-semibold shrink-0">
                <button
                  onClick={() => setRightPanelTab('ai')}
                  className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                    effectiveRightTab === 'ai'
                      ? 'bg-gradient-to-b from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>AI Kronos & Lệnh</span>
                </button>

                <button
                  onClick={() => setRightPanelTab('risk')}
                  className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                    effectiveRightTab === 'risk'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Vốn & VaR</span>
                </button>

                {!isLeftDockActive && (
                  <button
                    onClick={() => setRightPanelTab('market')}
                    className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      effectiveRightTab === 'market'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Danh Mục ({symbols.length})</span>
                  </button>
                )}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-3">
                {((effectiveRightTab === 'ai' && mobileTab === 'chart') || mobileTab === 'ai') && (
                  <>
                    <AIPredictionCard
                      prediction={aiPrediction}
                      quoteAsset={currentSymbol.quoteAsset}
                      kronosConfig={kronosConfig}
                      onUpdateKronosConfig={handleUpdateKronosConfig}
                      showGhostCandles={settings.kronosGhostCandles}
                      onToggleGhostCandles={() => handleToggleIndicator('kronosGhostCandles')}
                      showWalkForward={settings.kronosWalkForward}
                      onToggleWalkForward={() => handleToggleIndicator('kronosWalkForward')}
                      activeTimeframe={timeframe}
                      onSelectTimeframe={setTimeframe}
                      auditEntries={auditEntries}
                      onPinAuditCheckpoint={handlePinAuditCheckpoint}
                      onClearAuditLog={() => setAuditEntries(clearForecastAuditLog())}
                      onOpenMacroModal={() => setIsMacroModalOpen(true)}
                    />
                    <TradeSetupCard
                      strategyHub={strategyHub}
                      setup={tradeSetup}
                      quoteAsset={currentSymbol.quoteAsset}
                      symbol={currentSymbol.symbol}
                    />
                    <SentimentMeter sentiment={marketSentiment} />
                  </>
                )}

                {((effectiveRightTab === 'risk' && mobileTab === 'chart') || mobileTab === 'risk') && (
                  <>
                    <RiskCalculator
                      currentPrice={currentSymbol.price}
                      stopLossPrice={
                        strategyHub?.bestStrategy?.stopLoss ||
                        tradeSetup?.stopLoss ||
                        currentSymbol.price * 0.95
                      }
                      quoteAsset={currentSymbol.quoteAsset}
                      aiPrediction={aiPrediction}
                      strategyHub={strategyHub}
                      macroSnapshot={macroSnapshot}
                    />
                    <TradeSetupCard
                      strategyHub={strategyHub}
                      setup={tradeSetup}
                      quoteAsset={currentSymbol.quoteAsset}
                      symbol={currentSymbol.symbol}
                    />
                  </>
                )}

                {((!isLeftDockActive && effectiveRightTab === 'market' && mobileTab === 'chart') ||
                  mobileTab === 'market') && (
                  <div className="flex flex-col h-full -m-2.5 sm:-m-3">
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
                      symbol={currentSymbol.symbol}
                      quoteAsset={currentSymbol.quoteAsset}
                      marketSymbol={currentSymbol}
                    />
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ================= MOBILE BOTTOM NAVIGATION BAR (< 768px) ================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#070b13]/95 border-t border-slate-800/90 flex items-center justify-around z-40 px-1 backdrop-blur-xl">
        {[
          {
            id: 'chart',
            label: 'Biểu Đồ',
            icon: LineChart,
            active: activeView === 'chart' && mobileTab === 'chart',
            color: 'text-cyan-400',
            bar: 'bg-cyan-400',
            onClick: () => {
              setActiveView('chart');
              setMobileTab('chart');
            },
          },
          {
            id: 'ai',
            label: 'AI Kronos',
            icon: Sparkles,
            active: activeView === 'chart' && mobileTab === 'ai',
            color: 'text-blue-400',
            bar: 'bg-blue-400',
            onClick: () => {
              setActiveView('chart');
              setMobileTab('ai');
            },
          },
          {
            id: 'market',
            label: 'Thị Trường',
            icon: Layers,
            active: activeView === 'chart' && mobileTab === 'market',
            color: 'text-emerald-400',
            bar: 'bg-emerald-400',
            onClick: () => {
              setActiveView('chart');
              setMobileTab('market');
            },
          },
          {
            id: 'risk',
            label: 'Vốn & VaR',
            icon: Shield,
            active: activeView === 'chart' && mobileTab === 'risk',
            color: 'text-indigo-400',
            bar: 'bg-indigo-400',
            onClick: () => {
              setActiveView('chart');
              setMobileTab('risk');
            },
          },
          {
            id: 'heatmap',
            label: 'Nhiệt AI',
            icon: Flame,
            active: activeView === 'heatmap',
            color: 'text-amber-400',
            bar: 'bg-amber-400',
            onClick: () => setActiveView(activeView === 'heatmap' ? 'chart' : 'heatmap'),
          },
        ].map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition ${
                item.active ? item.color : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.active && (
                <span className={`absolute top-0 w-7 h-0.5 rounded-b-full ${item.bar}`} />
              )}
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-semibold mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Backtest Strategy Modal */}
      {isBacktestOpen && (
        <BacktestModal
          candles={candles}
          symbolName={currentSymbol.symbol}
          quoteAsset={currentSymbol.quoteAsset}
          onClose={() => setIsBacktestOpen(false)}
        />
      )}

      {/* Market Accumulation Radar Scanner Modal */}
      {isRadarOpen && (
        <AccumulationRadarModal
          symbols={symbols}
          onSelectSymbol={handleSelectSymbol}
          onClose={() => setIsRadarOpen(false)}
        />
      )}

      {/* Cross-Market Macro Intelligence & VN30F1M Expiry Calendar Modal */}
      {isMacroModalOpen && (
        <MacroIntelligenceModal
          snapshot={macroSnapshot}
          currentSymbol={currentSymbol}
          symbols={symbols}
          initialTab={macroModalTab}
          isRefreshing={isMacroRefreshing}
          onRefresh={() => void refreshMacroSnapshot(true)}
          onSelectSymbol={handleSelectSymbol}
          onClose={() => setIsMacroModalOpen(false)}
        />
      )}
    </div>
  );
};
export default App;
