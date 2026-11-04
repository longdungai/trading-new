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
  BinanceDepthSocket,
  BinanceWatchlistSocket,
  BinanceWebSocket,
  fetchBinanceOrderBook,
} from './services/api/binance';
import { getMarketSessionInfo } from './utils/marketHours';
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
import { evaluateChartRecommendation } from './services/ai/chartVerdictEngine';
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
import { VnStockQuickCard } from './components/AIInsight/VnStockQuickCard';
import { GlobalMarketQuickCard } from './components/AIInsight/GlobalMarketQuickCard';
import { TradeSetupCard } from './components/AIInsight/TradeSetupCard';
import { RiskCalculator } from './components/AIInsight/RiskCalculator';
import { PositionRecoveryCard } from './components/AIInsight/PositionRecoveryCard';
import {
  evaluatePositionRecovery,
  getUserHoldingForSymbol,
  USER_HOLDINGS_UPDATED_EVENT,
} from './services/portfolio/holdingsRecoveryEngine';
import {
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
} from './services/vnMarket/vnStockMicrostructure';
import {
  fetchVnStockInsights,
  getCachedVnStockInsights,
  VN_INSIGHTS_UPDATED_EVENT,
} from './services/vnMarket/vnStockInsightsClient';
import {
  isCryptoSymbol,
  isUsOrGlobalEquitySymbol,
} from './services/globalMarket/globalExecutionEngines';
import {
  fetchGlobalMarketInsights,
  getCachedGlobalInsights,
  GLOBAL_INSIGHTS_UPDATED_EVENT,
} from './services/globalMarket/globalMarketInsightsClient';
import { Watchlist } from './components/Market/Watchlist';
import { OrderBook } from './components/Market/OrderBook';
import { SentimentMeter } from './components/Market/SentimentMeter';
import { MarketHeatmap } from './components/Market/MarketHeatmap';
import { BacktestModal } from './components/Backtest/BacktestModal';
import { AccumulationRadarModal } from './components/Market/AccumulationRadarModal';
import { MacroIntelligenceModal, MacroModalTab } from './components/Macro/MacroIntelligenceModal';
import { AlertCenterModal } from './components/Alerts/AlertCenterModal';
import { MtfAndVpvrCard } from './components/AIInsight/MtfAndVpvrCard';
import { MarketReplayBar } from './components/Chart/MarketReplayBar';
import { CommandPaletteModal } from './components/Common/CommandPaletteModal';
import { syncAllPaperTradesWithMarket } from './services/paperTrading/userPaperTrading';
import {
  loadSmartAlertRules,
  loadTriggeredAlertHistory,
  runSmartAlertMonitoringCycle,
  SMART_ALERTS_UPDATED_EVENT,
} from './services/alerts/smartAlertCenter';
import { checkAndPullCloudWorkspace } from './services/storage/cloudSyncClient';
import {
  loadActiveUserProfile,
  loadAllUserProfiles,
  loadPersistedActiveSymbolKey,
  LocalUserProfile,
  syncActiveUserProfilePatch,
} from './services/storage/userProfileManager';
import { AlertTriangle, Sparkles, Layers, Shield, LineChart, Flame, Globe2, Target, X } from 'lucide-react';

export const App: React.FC = () => {
  // Load Local User Profiles & Active Profile (Persists across F5 / Reloads)
  const [userProfiles, setUserProfiles] = useState<LocalUserProfile[]>(() => loadAllUserProfiles());
  const [activeUserProfile, setActiveUserProfile] = useState<LocalUserProfile>(() =>
    loadActiveUserProfile()
  );

  // Load persisted symbols & restore exact last viewed symbol on F5
  const [symbols, setSymbols] = useState<MarketSymbol[]>(() => {
    const prof = loadActiveUserProfile();
    return prof.symbols && prof.symbols.length > 0 ? prof.symbols : loadSymbolsFromStorage();
  });
  const [currentSymbol, setCurrentSymbol] = useState<MarketSymbol>(() => {
    const prof = loadActiveUserProfile();
    const initialList =
      prof.symbols && prof.symbols.length > 0 ? prof.symbols : loadSymbolsFromStorage();
    const targetKey = (prof.activeSymbol || loadPersistedActiveSymbolKey(initialList)).toUpperCase();
    const matched = initialList.find(s => s.symbol.toUpperCase() === targetKey);
    return matched || initialList[0] || DEFAULT_SYMBOLS[0];
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    const prof = loadActiveUserProfile();
    return Array.isArray(prof.favorites) ? prof.favorites : loadFavoritesFromStorage();
  });

  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    const prof = loadActiveUserProfile();
    return prof.timeframe || '1h';
  });
  const [candles, setCandles] = useState<Candle[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBookType | null>(null);
  const [isLiveLoading, setIsLiveLoading] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'chart' | 'heatmap'>('chart');
  const [isBacktestOpen, setIsBacktestOpen] = useState<boolean>(false);
  const [isRadarOpen, setIsRadarOpen] = useState<boolean>(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [presetAlertPrice, setPresetAlertPrice] = useState<number | null>(null);
  const [activeAlertRuleCount, setActiveAlertRuleCount] = useState<number>(
    () => loadSmartAlertRules().filter(r => r.enabled).length
  );
  const [unreadAlertCount, setUnreadAlertCount] = useState<number>(
    () => loadTriggeredAlertHistory().filter(e => !e.read).length
  );
  const [isMacroModalOpen, setIsMacroModalOpen] = useState<boolean>(false);
  const [macroModalTab, setMacroModalTab] = useState<MacroModalTab>('indicators');
  const [isMacroRefreshing, setIsMacroRefreshing] = useState<boolean>(false);
  const [macroSnapshot, setMacroSnapshot] = useState<MacroIntelligenceSnapshot | null>(null);
  const [isMacroBannerDismissed, setIsMacroBannerDismissed] = useState<boolean>(false);
  const [auditEntries, setAuditEntries] = useState<ForecastAuditEntry[]>(() =>
    loadForecastAuditEntries()
  );
  const [isGomBannerDismissed, setIsGomBannerDismissed] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<'ai' | 'market' | 'risk'>(() => {
    const prof = loadActiveUserProfile();
    return prof.layoutPrefs?.rightPanelTab || 'ai';
  });
  const [mobileTab, setMobileTab] = useState<'chart' | 'ai' | 'market' | 'risk'>('chart');
  const [mobileMarketSubTab, setMobileMarketSubTab] = useState<'watchlist' | 'orderbook'>(
    'watchlist'
  );
  const [showLeftDock, setShowLeftDock] = useState<boolean>(() => {
    const prof = loadActiveUserProfile();
    return prof.layoutPrefs?.showLeftDock ?? true;
  });
  const [isZenMode, setIsZenMode] = useState<boolean>(() => {
    const prof = loadActiveUserProfile();
    return prof.layoutPrefs?.isZenMode ?? false;
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [compareSymbol, setCompareSymbol] = useState<string | null>(() => {
    const prof = loadActiveUserProfile();
    return prof.layoutPrefs?.compareSymbol ?? null;
  });
  const [compareCandles, setCompareCandles] = useState<Candle[]>([]);

  // On-Chart Historical Bar Replay State (Zero Look-Ahead Bias)
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [replayCutIndex, setReplayCutIndex] = useState<number>(100);
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);
  const [replaySpeedMs, setReplaySpeedMs] = useState<number>(420);
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

  const timeframeRef = useRef<Timeframe>(timeframe);
  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  const symbolsRef = useRef<MarketSymbol[]>(symbols);
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  // Indicator Settings (Restored from active User Profile on F5)
  const [settings, setSettings] = useState<IndicatorSettings>(() => {
    const prof = loadActiveUserProfile();
    return prof.indicatorSettings;
  });

  // Kronos Foundation Model Configuration & Optional Cloud Override
  const [kronosConfig, setKronosConfig] = useState<KronosConfig>(() => {
    const prof = loadActiveUserProfile();
    return prof.kronosConfig || loadKronosConfig();
  });
  const [kronosCloudOutput, setKronosCloudOutput] = useState<KronosPredictionOutput | null>(null);
  const [mtfCandlesMap, setMtfCandlesMap] = useState<Partial<Record<Timeframe, Candle[]>>>({});
  const mtfCacheRef = useRef<Map<string, { ts: number; map: Partial<Record<Timeframe, Candle[]>> }>>(new Map());

  const handleUpdateKronosConfig = useCallback((nextCfg: KronosConfig) => {
    setKronosConfig(nextCfg);
    saveKronosConfig(nextCfg);
    const updatedProf = syncActiveUserProfilePatch({ kronosConfig: nextCfg });
    setActiveUserProfile(updatedProf);
    setUserProfiles(loadAllUserProfiles());
  }, []);

  const wsRef = useRef<BinanceWebSocket | null>(null);
  const depthWsRef = useRef<BinanceDepthSocket | null>(null);
  const hasLiveDepthStreamRef = useRef<boolean>(false);
  const watchlistWsRef = useRef<BinanceWatchlistSocket | null>(null);
  const isSyncingPricesRef = useRef<boolean>(false);
  const lastStoragePersistRef = useRef<number>(0);

  // Auto-persist active symbol, timeframe, indicator settings, favorites & layout preferences to Active User Profile
  useEffect(() => {
    const updatedProf = syncActiveUserProfilePatch({
      activeSymbol: currentSymbol.symbol,
      timeframe,
      indicatorSettings: settings,
      favorites,
      layoutPrefs: {
        showLeftDock,
        isZenMode,
        rightPanelTab,
        compareSymbol,
      },
    });
    setActiveUserProfile(updatedProf);
    setUserProfiles(loadAllUserProfiles());
  }, [
    currentSymbol.symbol,
    timeframe,
    settings,
    favorites,
    showLeftDock,
    isZenMode,
    rightPanelTab,
    compareSymbol,
  ]);

  const handleProfileSwitched = useCallback(
    (nextProf: LocalUserProfile, allProfs: LocalUserProfile[]) => {
      const nextSymbols =
        nextProf.symbols && nextProf.symbols.length > 0
          ? nextProf.symbols
          : loadSymbolsFromStorage();
      setSymbols(nextSymbols);
      symbolsRef.current = nextSymbols;

      const targetSym =
        nextSymbols.find(s => s.symbol.toUpperCase() === nextProf.activeSymbol.toUpperCase()) ||
        nextSymbols[0] ||
        DEFAULT_SYMBOLS[0];
      setCurrentSymbol(targetSym);
      currentSymbolRef.current = targetSym;

      setTimeframe(nextProf.timeframe || '1h');
      timeframeRef.current = nextProf.timeframe || '1h';
      setSettings(nextProf.indicatorSettings);
      setFavorites(nextProf.favorites);
      if (nextProf.kronosConfig) {
        setKronosConfig(nextProf.kronosConfig);
      }
      if (nextProf.layoutPrefs) {
        setShowLeftDock(nextProf.layoutPrefs.showLeftDock);
        setIsZenMode(nextProf.layoutPrefs.isZenMode);
        setRightPanelTab(nextProf.layoutPrefs.rightPanelTab);
        setCompareSymbol(nextProf.layoutPrefs.compareSymbol);
      }
      setActiveUserProfile(nextProf);
      setUserProfiles(allProfs);
      setHoldingsRevision(r => r + 1);
    },
    []
  );

  const handleProfilesUpdated = useCallback(
    (allProfs: LocalUserProfile[], active: LocalUserProfile) => {
      setUserProfiles(allProfs);
      setActiveUserProfile(active);
    },
    []
  );

  // Toggle Indicator Setting
  const handleToggleIndicator = (key: keyof IndicatorSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Persist Symbols whenever changed
  const updateSymbolsAndPersist = (newSymbols: MarketSymbol[]) => {
    setSymbols(newSymbols);
    symbolsRef.current = newSymbols;
    saveSymbolsToStorage(newSymbols);
    const updatedProf = syncActiveUserProfilePatch({ symbols: newSymbols });
    setActiveUserProfile(updatedProf);
    setUserProfiles(loadAllUserProfiles());
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

      const activeSymMeta = currentSymbolRef.current;
      const activeQuote = quotes.get(activeSymMeta.symbol);
      if (activeQuote) {
        setCurrentSymbol(prev => ({
          ...prev,
          price: activeQuote.price,
          change24h: activeQuote.change24h,
          high24h: activeQuote.high24h ?? Math.max(prev.high24h, activeQuote.price),
          low24h: activeQuote.low24h ?? Math.min(prev.low24h, activeQuote.price),
          volume24h: activeQuote.volume24h ?? prev.volume24h,
        }));

        // Real-time latest candle tick for open non-Binance markets (XAUUSD, Oil, Silver, VN30/HOSE/HNX, US Stocks)
        const isBinanceStreamable =
          activeSymMeta.type === 'crypto' || activeSymMeta.symbol.toUpperCase() === 'PAXGUSDT';
        if (!isBinanceStreamable && getMarketSessionInfo(activeSymMeta).isOpen) {
          setCandles(prev => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            if (last.close === activeQuote.price) return prev;
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...last,
              close: activeQuote.price,
              high: Math.max(last.high, activeQuote.price),
              low: Math.min(last.low, activeQuote.price),
            };
            return updated;
          });
        }
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

  // Single non-overlapping 3s background quote sync loop
  useEffect(() => {
    void syncLivePrices(true);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncLivePrices(false);
      }
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [syncLivePrices]);

  // Load Klines and Depth (supports silent background bar reconciliation without flashing header spinner)
  const loadData = useCallback(
    async (symbolObj: MarketSymbol, tf: Timeframe, options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) {
        setIsLiveLoading(true);
      }
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

          // Guard against stale async responses if user already switched to another symbol/timeframe
          if (
            currentSymbolRef.current.symbol === symbolObj.symbol &&
            timeframeRef.current === tf
          ) {
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

        if (!silent && isDepthSupported && currentSymbolRef.current.symbol === symbolObj.symbol) {
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
        if (!silent && currentSymbolRef.current.symbol === symbolObj.symbol) {
          setIsLiveLoading(false);
        }
      }
    },
    []
  );

  // Instant Symbol Selector Handler: immediately loads fresh data and updates price
  const handleSelectSymbol = (sym: MarketSymbol) => {
    const fresh = symbolsRef.current.find(s => s.symbol === sym.symbol) || sym;
    setCurrentSymbol(fresh);
    currentSymbolRef.current = fresh;
    setOrderBook(null);

    if (activeView === 'heatmap') setActiveView('chart');
    setMobileTab('chart');

    void loadData(fresh, timeframe);
  };

  useEffect(() => {
    void loadData(currentSymbol, timeframe);

    // Setup Binance WebSocket + 1s Level-2 OrderBook WebSocket strictly for 24/7 Crypto & PAXGUSDT
    const isBinanceStreamable =
      currentSymbol.type === 'crypto' || currentSymbol.symbol.toUpperCase() === 'PAXGUSDT';

    let depthFallbackInterval: ReturnType<typeof setInterval> | null = null;
    let candleSyncInterval: ReturnType<typeof setInterval> | null = null;
    hasLiveDepthStreamRef.current = false;

    if (isBinanceStreamable) {
      if (!wsRef.current) {
        wsRef.current = new BinanceWebSocket();
      }
      if (!depthWsRef.current) {
        depthWsRef.current = new BinanceDepthSocket();
      }

      const activeSym = currentSymbol.symbol;

      wsRef.current.connect(activeSym, timeframe, (newCandle) => {
        if (currentSymbolRef.current.symbol !== activeSym) return;
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
          const next = prev.map(s => (s.symbol === activeSym ? { ...s, price: newCandle.close } : s));
          symbolsRef.current = next;
          return next;
        });
      });

      // Real-time 1000ms Level-2 OrderBook WebSocket stream
      depthWsRef.current.connect(activeSym, (liveDepth) => {
        if (currentSymbolRef.current.symbol === activeSym) {
          hasLiveDepthStreamRef.current = true;
          setOrderBook(liveDepth);
        }
      });

      // Fallback REST depth poll (only triggers if WebSocket port is blocked and hasn't delivered frames)
      depthFallbackInterval = setInterval(async () => {
        if (document.visibilityState === 'hidden' || hasLiveDepthStreamRef.current) return;
        try {
          const depth = await fetchBinanceOrderBook(activeSym, 10);
          if (currentSymbolRef.current.symbol === activeSym) {
            setOrderBook(depth);
          }
        } catch {
          // keep last valid real depth snapshot
        }
      }, 8000);

      // Periodic 60s silent kline history reconciliation
      candleSyncInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          void loadData(currentSymbolRef.current, timeframeRef.current, { silent: true });
        }
      }, 60_000);
    } else {
      setOrderBook(null);
      // Real-time 15s silent bar rollover & volume sync for open non-Binance exchanges (XAUUSD, Oil, VN30/HOSE/HNX, US Stocks)
      candleSyncInterval = setInterval(() => {
        if (
          document.visibilityState === 'visible' &&
          getMarketSessionInfo(currentSymbolRef.current).isOpen
        ) {
          void loadData(currentSymbolRef.current, timeframeRef.current, { silent: true });
        }
      }, 15_000);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      if (depthWsRef.current) {
        depthWsRef.current.disconnect();
      }
      if (depthFallbackInterval) {
        clearInterval(depthFallbackInterval);
      }
      if (candleSyncInterval) {
        clearInterval(candleSyncInterval);
      }
    };
  }, [currentSymbol.symbol, timeframe, loadData]);

  // Intermarket Comparison Overlay Candle Sync
  useEffect(() => {
    let active = true;
    if (!compareSymbol || compareSymbol === currentSymbol.symbol) {
      setCompareCandles([]);
      return;
    }
    const targetSym = symbolsRef.current.find(s => s.symbol === compareSymbol);
    if (!targetSym) {
      setCompareCandles([]);
      return;
    }
    void fetchMarketData(targetSym, timeframe).then(data => {
      if (active && Array.isArray(data)) {
        setCompareCandles(data);
      }
    });
    return () => {
      active = false;
    };
  }, [compareSymbol, currentSymbol.symbol, timeframe]);

  // Bar Replay Playback Timer & Safe Bounds
  useEffect(() => {
    if (!isReplayMode) {
      setIsReplayPlaying(false);
      return;
    }
    setReplayCutIndex(prev =>
      candles.length > 0 ? Math.min(candles.length - 1, Math.max(25, prev)) : 0
    );
  }, [isReplayMode, candles.length]);

  useEffect(() => {
    if (!isReplayMode || !isReplayPlaying) return;
    const timer = setInterval(() => {
      setReplayCutIndex(prev => {
        if (prev >= candles.length - 1) {
          setIsReplayPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, replaySpeedMs);
    return () => clearInterval(timer);
  }, [isReplayMode, isReplayPlaying, replaySpeedMs, candles.length]);

  const handleToggleReplayMode = useCallback(() => {
    setIsReplayMode(prev => {
      const next = !prev;
      if (next && candles.length > 35) {
        setReplayCutIndex(Math.max(30, Math.floor(candles.length * 0.6)));
      }
      setIsReplayPlaying(false);
      return next;
    });
  }, [candles.length]);

  const effectiveCandles = useMemo(() => {
    if (!isReplayMode || candles.length === 0) return candles;
    return candles.slice(0, Math.min(candles.length, Math.max(20, replayCutIndex + 1)));
  }, [isReplayMode, candles, replayCutIndex]);

  const effectiveCompareCandles = useMemo(() => {
    if (!compareCandles.length) return [];
    if (!isReplayMode || effectiveCandles.length === 0) return compareCandles;
    const cutoffTime = effectiveCandles[effectiveCandles.length - 1].time;
    return compareCandles.filter(c => c.time <= cutoffTime);
  }, [compareCandles, isReplayMode, effectiveCandles]);

  const effectiveMtfMap = useMemo(() => {
    if (!isReplayMode || effectiveCandles.length === 0) return mtfCandlesMap;
    const cutoffTime = effectiveCandles[effectiveCandles.length - 1].time;
    const sliced: Partial<Record<Timeframe, Candle[]>> = {};
    for (const [tfKey, arr] of Object.entries(mtfCandlesMap)) {
      if (arr) {
        sliced[tfKey as Timeframe] = arr.filter(c => c.time <= cutoffTime);
      }
    }
    return sliced;
  }, [isReplayMode, effectiveCandles, mtfCandlesMap]);

  // Derived Analytics & Calculations (Strictly Bound to effectiveCandles for Zero Look-Ahead Replay)
  const srLevels: SupportResistanceLevel[] = useMemo(() => {
    return calculateSupportResistance(effectiveCandles);
  }, [effectiveCandles]);

  const fibLevels: FibonacciLevel[] = useMemo(() => {
    return calculateFibonacciLevels(effectiveCandles);
  }, [effectiveCandles]);

  const orderBlocks: OrderBlock[] = useMemo(() => {
    return detectOrderBlocks(effectiveCandles);
  }, [effectiveCandles]);

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

  // Background Multi-Timeframe Klines Fetcher (15m • 1h • 4h • 1D) with 30s cache + 45s live auto-refresh
  const syncMtfCandles = useCallback((symObj: MarketSymbol, force: boolean = false) => {
    const symKey = symObj.symbol;
    const cached = mtfCacheRef.current.get(symKey);

    if (!force && cached && Date.now() - cached.ts < 30_000) {
      if (currentSymbolRef.current.symbol === symKey) {
        setMtfCandlesMap(cached.map);
      }
      return;
    }

    const mtfList: Timeframe[] = ['15m', '1h', '4h', '1D'];
    void Promise.allSettled(mtfList.map(tf => fetchMarketData(symObj, tf))).then(results => {
      const nextMap: Partial<Record<Timeframe, Candle[]>> = {};
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value && res.value.length >= 28) {
          nextMap[mtfList[idx]] = res.value;
        }
      });
      mtfCacheRef.current.set(symKey, { ts: Date.now(), map: nextMap });
      if (currentSymbolRef.current.symbol === symKey) {
        setMtfCandlesMap(nextMap);
      }
    });
  }, []);

  useEffect(() => {
    syncMtfCandles(currentSymbol, false);
    const interval = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        getMarketSessionInfo(currentSymbolRef.current).isOpen
      ) {
        syncMtfCandles(currentSymbolRef.current, true);
      }
    }, 45_000);
    return () => clearInterval(interval);
  }, [currentSymbol.symbol, syncMtfCandles]);

  // Live Global & Vietnam Macro Intelligence + Fed Pivot V2 Polling (25s normal / 20s when modal open)
  const refreshMacroSnapshot = useCallback(async (force: boolean = false, silent: boolean = false) => {
    if (!silent) {
      setIsMacroRefreshing(true);
    }
    try {
      const snap = await fetchMacroIntelligenceSnapshot(force);
      if (snap) setMacroSnapshot(snap);
    } finally {
      if (!silent) {
        setIsMacroRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshMacroSnapshot(false, true);
    const pollMs = isMacroModalOpen ? 20_000 : 25_000;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshMacroSnapshot(false, true);
      }
    }, pollMs);
    return () => clearInterval(interval);
  }, [refreshMacroSnapshot, isMacroModalOpen]);

  useEffect(() => {
    setIsMacroBannerDismissed(false);
  }, [currentSymbol.symbol]);

  const currentMacroImpact = useMemo(() => {
    return evaluateSymbolMacroImpact(currentSymbol, macroSnapshot);
  }, [currentSymbol, macroSnapshot]);

  const [liveCryptoFng, setLiveCryptoFng] = useState<number | null>(null);
  const [insightsRevision, setInsightsRevision] = useState<number>(0);
  const [holdingsRevision, setHoldingsRevision] = useState<number>(0);

  // Proactively hydrate VN or Global/Crypto institutional insights for the active chart symbol
  // (works even in Zen Mode or Mobile Chart-only view) and re-evaluate verdict on cache updates
  useEffect(() => {
    const bump = () => setInsightsRevision(r => r + 1);
    const bumpHoldings = () => {
      setHoldingsRevision(r => r + 1);
      const updatedProf = syncActiveUserProfilePatch({});
      setActiveUserProfile(updatedProf);
      setUserProfiles(loadAllUserProfiles());
    };
    window.addEventListener(VN_INSIGHTS_UPDATED_EVENT, bump);
    window.addEventListener(GLOBAL_INSIGHTS_UPDATED_EVENT, bump);
    window.addEventListener(USER_HOLDINGS_UPDATED_EVENT, bumpHoldings);
    return () => {
      window.removeEventListener(VN_INSIGHTS_UPDATED_EVENT, bump);
      window.removeEventListener(GLOBAL_INSIGHTS_UPDATED_EVENT, bump);
      window.removeEventListener(USER_HOLDINGS_UPDATED_EVENT, bumpHoldings);
    };
  }, []);

  useEffect(() => {
    if (isReplayMode) return;
    const symUpper = currentSymbol.symbol.toUpperCase();
    if (isVnStockOrIndexSymbol(currentSymbol)) {
      if (
        !['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX'].includes(symUpper) &&
        !isVnDerivativeSymbol(symUpper)
      ) {
        void fetchVnStockInsights(symUpper, false);
      }
    } else if (isCryptoSymbol(currentSymbol) || isUsOrGlobalEquitySymbol(currentSymbol)) {
      void fetchGlobalMarketInsights(symUpper, false);
    }
  }, [currentSymbol, isReplayMode]);

  useEffect(() => {
    let active = true;
    const syncFng = (force: boolean = false) => {
      void fetchLiveCryptoFearAndGreed(force).then(val => {
        if (active && val !== null) setLiveCryptoFng(val);
      });
    };
    syncFng(false);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFng(false);
      }
    }, 180_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const liveBtcFundingPct8h = useMemo(() => {
    const item = macroSnapshot?.indicators.find(i => i.id === 'BTC_FUNDING');
    return item && Number.isFinite(item.value) ? item.value : null;
  }, [macroSnapshot]);

  const marketSentiment: MarketSentiment = useMemo(() => {
    const perSymbolFunding =
      getCachedGlobalInsights(currentSymbol.symbol)?.perpCarry?.fundingRate8hPct ??
      liveBtcFundingPct8h;
    return getMarketSentiment(
      currentSymbol,
      candles,
      symbols,
      liveCryptoFng,
      perSymbolFunding
    );
  }, [currentSymbol, candles, symbols, liveCryptoFng, liveBtcFundingPct8h, insightsRevision]);

  const aiPrediction: AIPrediction | null = useMemo(() => {
    return generateAIPrediction(
      currentSymbol.symbol,
      effectiveCandles,
      kronosConfig.predLen,
      kronosConfig,
      isReplayMode ? null : kronosCloudOutput,
      timeframe,
      effectiveMtfMap,
      macroSnapshot,
      currentSymbol
    );
  }, [
    currentSymbol,
    effectiveCandles,
    kronosConfig,
    isReplayMode,
    kronosCloudOutput,
    timeframe,
    effectiveMtfMap,
    macroSnapshot,
  ]);

  const chartVerdict = useMemo(() => {
    const vnInsights = isReplayMode ? null : getCachedVnStockInsights(currentSymbol.symbol);
    const globalInsights = isReplayMode ? null : getCachedGlobalInsights(currentSymbol.symbol);
    return evaluateChartRecommendation({
      symbolObj: currentSymbol,
      candles: effectiveCandles,
      timeframe,
      mtfCandlesMap: effectiveMtfMap,
      aiPrediction,
      macroSnapshot,
      marketSentiment,
      vnInsights,
      globalInsights,
      allSymbols: symbols,
      isReplayMode,
    });
  }, [
    currentSymbol,
    effectiveCandles,
    timeframe,
    effectiveMtfMap,
    aiPrediction,
    macroSnapshot,
    marketSentiment,
    symbols,
    isReplayMode,
    insightsRevision,
  ]);

  const activeRecoveryPlan = useMemo(() => {
    const holding = getUserHoldingForSymbol(currentSymbol.symbol);
    if (!holding) return null;
    return evaluatePositionRecovery({
      holding,
      symbolObj: currentSymbol,
      candles: effectiveCandles,
      chartVerdict,
    });
  }, [currentSymbol, effectiveCandles, chartVerdict, holdingsRevision]);

  const strategyHub: StrategyAnalysisHub = useMemo(() => {
    return generateStrategyHub(
      currentSymbol.symbol,
      effectiveCandles,
      timeframe,
      macroSnapshot,
      currentSymbol,
      chartVerdict
    );
  }, [currentSymbol, effectiveCandles, timeframe, macroSnapshot, chartVerdict]);

  const currentAccumulation = useMemo(() => {
    return analyzeAccumulationZone(currentSymbol, effectiveCandles);
  }, [currentSymbol, effectiveCandles]);

  const tradeSetup: TradeSetup | null = useMemo(() => {
    return generateTradeSetup(
      currentSymbol.symbol,
      effectiveCandles,
      timeframe,
      macroSnapshot,
      currentSymbol,
      chartVerdict
    );
  }, [currentSymbol, effectiveCandles, timeframe, macroSnapshot, chartVerdict]);

  // Auto-record & reconcile Kronos P50 checkpoints strictly against REAL closed candles & live quotes
  useEffect(() => {
    if (isReplayMode || !aiPrediction || candles.length < 30) return;
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

  // Global Multi-Asset Paper Trading Sync + Smart Alert Monitoring Cycle + Cloud KV Auto-Pull
  useEffect(() => {
    const syncAlertCounts = () => {
      setActiveAlertRuleCount(loadSmartAlertRules().filter(r => r.enabled).length);
      setUnreadAlertCount(loadTriggeredAlertHistory().filter(e => !e.read).length);
    };
    window.addEventListener(SMART_ALERTS_UPDATED_EVENT, syncAlertCounts);
    void checkAndPullCloudWorkspace().then(({ restoredKeys }) => {
      if (restoredKeys > 0) {
        setFavorites(loadFavoritesFromStorage());
        setAuditEntries(loadForecastAuditEntries());
        setHoldingsRevision(r => r + 1);
        syncAlertCounts();
      }
    });
    return () => window.removeEventListener(SMART_ALERTS_UPDATED_EVENT, syncAlertCounts);
  }, []);

  useEffect(() => {
    syncAllPaperTradesWithMarket(symbols);
    runSmartAlertMonitoringCycle({
      symbols,
      activeSymbol: currentSymbol.symbol,
      activeCandles: candles,
      macroSnapshot,
    });
  }, [symbols, currentSymbol.symbol, candles, macroSnapshot]);

  const handlePinAuditCheckpoint = useCallback(() => {
    if (!aiPrediction || candles.length === 0) return;
    const lastCandleTime = candles[candles.length - 1].time;
    const next = recordKronosForecastCheckpoint(aiPrediction, timeframe, lastCandleTime, true);
    setAuditEntries(next);
  }, [aiPrediction, candles, timeframe]);

  // Unified Tab Wakeup & Network Reconnect Real-Time Resynchronization
  useEffect(() => {
    const resyncAllRealTimeStreams = () => {
      if (document.visibilityState !== 'visible') return;
      void syncLivePrices(true);
      void refreshMacroSnapshot(true, true);
      void loadData(currentSymbolRef.current, timeframeRef.current, { silent: true });
      syncMtfCandles(currentSymbolRef.current, true);
      void fetchLiveCryptoFearAndGreed(true).then(val => {
        if (val !== null) setLiveCryptoFng(val);
      });
      const symUpper = currentSymbolRef.current.symbol.toUpperCase();
      if (isVnStockOrIndexSymbol(currentSymbolRef.current)) {
        if (
          !['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX'].includes(symUpper) &&
          !isVnDerivativeSymbol(symUpper)
        ) {
          void fetchVnStockInsights(symUpper, true);
        }
      } else if (
        isCryptoSymbol(currentSymbolRef.current) ||
        isUsOrGlobalEquitySymbol(currentSymbolRef.current)
      ) {
        void fetchGlobalMarketInsights(symUpper, true);
      }
    };

    document.addEventListener('visibilitychange', resyncAllRealTimeStreams);
    window.addEventListener('online', resyncAllRealTimeStreams);

    return () => {
      document.removeEventListener('visibilitychange', resyncAllRealTimeStreams);
      window.removeEventListener('online', resyncAllRealTimeStreams);
    };
  }, [syncLivePrices, refreshMacroSnapshot, loadData, syncMtfCandles]);

  const isVND = Boolean(
    currentSymbol?.quoteAsset === 'VND' ||
    currentSymbol?.symbol?.includes('VN') ||
    ['FPT', 'HPG', 'VIC', 'VHM', 'SJC', 'MWG', 'MSN', 'SSI', 'VCB'].includes(currentSymbol?.symbol || '')
  );

  const isLeftDockActive = isXlScreen && showLeftDock && !isZenMode;
  const effectiveRightTab =
    isLeftDockActive && rightPanelTab === 'market' ? 'ai' : rightPanelTab;

  return (
    <div className="flex flex-col h-dvh-safe w-full max-w-[100vw] bg-[#06090f] text-slate-100 overflow-hidden select-none font-sans">
      {/* 1. Institutional Top Header */}
      <Header
        currentSymbol={currentSymbol}
        symbols={symbols}
        favorites={favorites}
        timeframe={timeframe}
        onSelectSymbol={handleSelectSymbol}
        onChangeTimeframe={setTimeframe}
        onOpenBacktest={() => setIsBacktestOpen(true)}
        onOpenHeatmap={() => setActiveView(activeView === 'heatmap' ? 'chart' : 'heatmap')}
        onOpenRadar={() => setIsRadarOpen(true)}
        onOpenAlerts={() => {
          setPresetAlertPrice(null);
          setIsAlertModalOpen(true);
        }}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(prev => !prev)}
        unreadAlertCount={unreadAlertCount}
        activeAlertRuleCount={activeAlertRuleCount}
        onRefreshData={() => {
          void syncLivePrices(true);
          void refreshMacroSnapshot(true, false);
          void loadData(currentSymbol, timeframe);
          syncMtfCandles(currentSymbol, true);
          void fetchLiveCryptoFearAndGreed(true).then(val => {
            if (val !== null) setLiveCryptoFng(val);
          });
        }}
        isLiveLoading={isLiveLoading}
        activeView={activeView}
        setActiveView={setActiveView}
        signalAction={strategyHub?.bestStrategy?.action}
        isZenMode={isZenMode}
        onToggleZenMode={() => setIsZenMode(prev => !prev)}
        activeProfile={activeUserProfile}
        profiles={userProfiles}
        onProfileSwitched={handleProfileSwitched}
        onProfilesUpdated={handleProfilesUpdated}
      />

      {/* 2. Macro Benchmark & Market Breadth Ribbon (Hidden on mobile when Zen Mode active) */}
      <div className={isZenMode ? 'hidden md:block shrink-0' : 'block shrink-0'}>
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
      </div>

      {/* 3. Indicator & Workspace Control Toolbar (Hidden on mobile when viewing non-chart tabs or Zen Mode) */}
      {activeView === 'chart' && (
        <div
          className={
            mobileTab !== 'chart' || isZenMode ? 'hidden md:block shrink-0' : 'block shrink-0'
          }
        >
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
            isReplayMode={isReplayMode}
            onToggleReplayMode={handleToggleReplayMode}
            compareSymbol={compareSymbol}
            onChangeCompareSymbol={setCompareSymbol}
            isVnAsset={isVnStockOrIndexSymbol(currentSymbol)}
          />
        </div>
      )}

      {/* 4. Main Pro Workstation Body */}
      <div className="flex-1 flex overflow-hidden relative pb-safe-nav md:pb-0">
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
                candles={effectiveCandles}
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
                  className={`border-b px-2.5 sm:px-3 py-1 sm:py-1.5 flex items-center justify-between gap-2 text-xs z-20 animate-in fade-in shrink-0 whitespace-nowrap overflow-hidden ${
                    currentMacroImpact.bias === 'SEVERE_HEADWIND' ||
                    currentMacroImpact.relevantAlerts.some(a => a.severity === 'CRITICAL')
                      ? 'bg-gradient-to-r from-rose-950/80 via-[#18111d] to-rose-950/80 border-rose-500/40'
                      : 'bg-gradient-to-r from-cyan-950/65 via-[#10192b] to-amber-950/60 border-amber-500/35'
                  }`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
                    <AlertTriangle
                      className={`w-3.5 h-3.5 shrink-0 ${
                        currentMacroImpact.bias === 'SEVERE_HEADWIND'
                          ? 'text-rose-400 animate-pulse'
                          : 'text-amber-400'
                      }`}
                    />
                    <span className="font-black uppercase font-mono tracking-wide shrink-0 text-amber-300 text-[11px] sm:text-xs whitespace-nowrap">
                      <span className="hidden sm:inline">CẢNH BÁO </span>VĨ MÔ:
                    </span>
                    <span className="text-slate-200 truncate text-[11px] sm:text-xs">
                      <strong className="text-white font-mono">{currentSymbol.symbol}</strong> •{' '}
                      {currentMacroImpact.relevantAlerts[0]?.title ||
                        currentMacroImpact.bullets[0] ||
                        currentMacroImpact.headline}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setIsMacroModalOpen(true)}
                      className="px-2 sm:px-2.5 py-0.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-[10.5px] sm:text-[11px] font-bold transition flex items-center gap-1 shrink-0 whitespace-nowrap"
                    >
                      <Globe2 className="w-3 h-3 text-cyan-300 shrink-0" />
                      <span>
                        Chi Tiết<span className="hidden sm:inline"> Vĩ Mô</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMacroBannerDismissed(true)}
                      className="text-slate-400 hover:text-white p-0.5 shrink-0"
                      title="Ẩn cảnh báo vĩ mô"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            {/* Real-time Accumulation Buy Zone Alert Banner */}
            {currentAccumulation?.isHot && !isGomBannerDismissed && currentAccumulation.entryZone && (
              <div className="bg-gradient-to-r from-amber-950/75 via-[#131d2e] to-amber-950/75 border-b border-amber-500/35 px-2.5 sm:px-3 py-1 sm:py-1.5 flex items-center justify-between gap-2 text-xs z-20 animate-in fade-in shrink-0 whitespace-nowrap overflow-hidden">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span className="font-black text-amber-300 uppercase font-mono tracking-wide shrink-0 flex items-center gap-1 text-[11px] sm:text-xs whitespace-nowrap">
                    <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      <span className="hidden sm:inline">VÙNG </span>GOM ĐẸP:
                    </span>
                  </span>
                  <span className="text-slate-200 truncate text-[11px] sm:text-xs">
                    <strong className="text-white font-mono">{currentSymbol?.symbol}</strong> ({currentAccumulation.score}/100đ) • Vùng gom:{' '}
                    <span className="text-emerald-400 font-mono font-bold">
                      {isVND ? '' : '$'}
                      {formatPrice(currentAccumulation.entryZone[0])} - {isVND ? '' : '$'}
                      {formatPrice(currentAccumulation.entryZone[1])}
                      {isVND
                        ? currentSymbol?.symbol === 'VNINDEX' ||
                          currentSymbol?.symbol === 'VN30' ||
                          isVnDerivativeSymbol(currentSymbol?.symbol || '')
                          ? ' đ'
                          : 'k'
                        : ''}
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
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap">
                  <button
                    onClick={() => setIsRadarOpen(true)}
                    className="px-2 sm:px-2.5 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[10.5px] sm:text-[11px] font-black transition flex items-center gap-1 shadow-sm shadow-amber-500/20 shrink-0 whitespace-nowrap"
                  >
                    <span>
                      Quét<span className="hidden sm:inline"> Toàn TT</span>
                    </span>
                  </button>
                  <button
                    onClick={() => setIsGomBannerDismissed(true)}
                    className="text-slate-400 hover:text-white p-0.5 shrink-0"
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
                candles={effectiveCandles}
                timeframe={timeframe}
                settings={settings}
                srLevels={srLevels}
                fibLevels={fibLevels}
                orderBlocks={orderBlocks}
                aiPrediction={aiPrediction}
                chartVerdict={chartVerdict}
                recoveryPlan={activeRecoveryPlan}
                symbolName={currentSymbol.symbol}
                symbolFullName={currentSymbol.name}
                currentSymbol={currentSymbol}
                compareSymbolName={
                  compareSymbol && compareSymbol !== currentSymbol.symbol ? compareSymbol : null
                }
                compareCandles={effectiveCompareCandles}
                onTogglePlanLines={() => handleToggleIndicator('recommendedPlanLines')}
                onOpenFullRecoveryTab={() => {
                  setIsZenMode(false);
                  setRightPanelTab('risk');
                  setMobileTab('risk');
                }}
                onQuickCreatePriceAlert={(price) => {
                  setPresetAlertPrice(price);
                  setIsAlertModalOpen(true);
                }}
              />
            </div>

            {/* On-Chart Zero-Lookahead Bar Replay Transport & Practice Pad */}
            {isReplayMode && (
              <MarketReplayBar
                totalCandles={candles.length}
                cutIndex={replayCutIndex}
                currentCandle={effectiveCandles[effectiveCandles.length - 1]}
                isPlaying={isReplayPlaying}
                speedMs={replaySpeedMs}
                quoteAsset={currentSymbol.quoteAsset}
                isVND={isVND}
                onChangeCutIndex={idx => {
                  setIsReplayPlaying(false);
                  setReplayCutIndex(idx);
                }}
                onTogglePlay={() => setIsReplayPlaying(prev => !prev)}
                onStepForward={() => {
                  setIsReplayPlaying(false);
                  setReplayCutIndex(prev => Math.min(candles.length - 1, prev + 1));
                }}
                onChangeSpeed={setReplaySpeedMs}
                onExitReplay={() => {
                  setIsReplayPlaying(false);
                  setIsReplayMode(false);
                }}
              />
            )}

            {/* Sub-panels (RSI & MACD) */}
            <IndicatorPanels candles={effectiveCandles} settings={settings} />
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
                  <span>Vốn &amp; Về Bờ</span>
                  {activeRecoveryPlan && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeRecoveryPlan.netUnrealizedPnlPct >= 0
                          ? 'bg-emerald-400'
                          : 'bg-rose-400 animate-pulse'
                      }`}
                    />
                  )}
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
                    {activeRecoveryPlan && (
                      <PositionRecoveryCard
                        currentSymbol={currentSymbol}
                        allSymbols={symbols}
                        candles={effectiveCandles}
                        chartVerdict={chartVerdict}
                        recoveryPlan={activeRecoveryPlan}
                        showHoldingLines={settings.holdingCostLines !== false}
                        onToggleHoldingLines={() => handleToggleIndicator('holdingCostLines')}
                        onSelectSymbol={handleSelectSymbol}
                        onQuickCreatePriceAlert={(price) => {
                          setPresetAlertPrice(price);
                          setIsAlertModalOpen(true);
                        }}
                      />
                    )}
                    {isVnStockOrIndexSymbol(currentSymbol) && (
                      <VnStockQuickCard
                        currentSymbol={currentSymbol}
                        symbols={symbols}
                        candles={effectiveCandles}
                        mtfCandlesMap={effectiveMtfMap}
                        showBottomFishingLines={settings.vnBottomFishingLines !== false}
                        onToggleBottomFishingLines={() =>
                          handleToggleIndicator('vnBottomFishingLines')
                        }
                        onQuickCreatePriceAlert={(price) => {
                          setPresetAlertPrice(price);
                          setIsAlertModalOpen(true);
                        }}
                        onSelectSymbol={handleSelectSymbol}
                        onOpenVnMacroTab={() => {
                          setMacroModalTab('vn_market');
                          setIsMacroModalOpen(true);
                        }}
                      />
                    )}
                    {!isVnStockOrIndexSymbol(currentSymbol) &&
                      (isCryptoSymbol(currentSymbol) ||
                        isUsOrGlobalEquitySymbol(currentSymbol)) && (
                        <GlobalMarketQuickCard
                          currentSymbol={currentSymbol}
                          symbols={symbols}
                          candles={effectiveCandles}
                          stopLossPrice={
                            strategyHub?.bestStrategy?.stopLoss ||
                            tradeSetup?.stopLoss ||
                            null
                          }
                          onSelectSymbol={handleSelectSymbol}
                          onOpenGlobalMacroTab={() => {
                            setMacroModalTab('global_markets');
                            setIsMacroModalOpen(true);
                          }}
                        />
                      )}
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
                    <MtfAndVpvrCard
                      symbol={currentSymbol.symbol}
                      quoteAsset={currentSymbol.quoteAsset}
                      activeTimeframe={timeframe}
                      candles={effectiveCandles}
                      mtfCandlesMap={effectiveMtfMap}
                      vpvrEnabled={settings.volumeProfile}
                      vwapEnabled={settings.vwap}
                      onToggleVpvr={() => handleToggleIndicator('volumeProfile')}
                      onToggleVwap={() => handleToggleIndicator('vwap')}
                      onSelectTimeframe={setTimeframe}
                    />
                    <TradeSetupCard
                      strategyHub={strategyHub}
                      setup={tradeSetup}
                      quoteAsset={currentSymbol.quoteAsset}
                      symbol={currentSymbol.symbol}
                      currentSymbolObj={currentSymbol}
                      candles={effectiveCandles}
                      allSymbols={symbols}
                      onSelectSymbol={handleSelectSymbol}
                    />
                    <SentimentMeter sentiment={marketSentiment} />
                  </>
                )}

                {((effectiveRightTab === 'risk' && mobileTab === 'chart') || mobileTab === 'risk') && (
                  <>
                    <PositionRecoveryCard
                      currentSymbol={currentSymbol}
                      allSymbols={symbols}
                      candles={effectiveCandles}
                      chartVerdict={chartVerdict}
                      recoveryPlan={activeRecoveryPlan}
                      showHoldingLines={settings.holdingCostLines !== false}
                      onToggleHoldingLines={() => handleToggleIndicator('holdingCostLines')}
                      onSelectSymbol={handleSelectSymbol}
                      onQuickCreatePriceAlert={(price) => {
                        setPresetAlertPrice(price);
                        setIsAlertModalOpen(true);
                      }}
                    />
                    <RiskCalculator
                      currentPrice={currentSymbol.price}
                      stopLossPrice={
                        strategyHub?.bestStrategy?.stopLoss ||
                        tradeSetup?.stopLoss ||
                        currentSymbol.price * 0.95
                      }
                      quoteAsset={currentSymbol.quoteAsset}
                      symbol={currentSymbol.symbol}
                      aiPrediction={aiPrediction}
                      strategyHub={strategyHub}
                      macroSnapshot={macroSnapshot}
                    />
                    <TradeSetupCard
                      strategyHub={strategyHub}
                      setup={tradeSetup}
                      quoteAsset={currentSymbol.quoteAsset}
                      symbol={currentSymbol.symbol}
                      currentSymbolObj={currentSymbol}
                      candles={effectiveCandles}
                      allSymbols={symbols}
                      onSelectSymbol={handleSelectSymbol}
                    />
                  </>
                )}

                {((!isLeftDockActive && effectiveRightTab === 'market' && mobileTab === 'chart') ||
                  mobileTab === 'market') && (
                  <div className="flex flex-col h-full -m-2.5 sm:-m-3">
                    {/* Mobile Segmented Sub-Tab Switcher (Watchlist vs OrderBook/Shark Tape) */}
                    <div className="md:hidden flex items-center gap-1 p-1.5 bg-[#070b13] border-b border-slate-800/80 shrink-0">
                      <button
                        type="button"
                        onClick={() => setMobileMarketSubTab('watchlist')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition ${
                          mobileMarketSubTab === 'watchlist'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'text-slate-400 hover:text-white bg-[#0d1422]'
                        }`}
                      >
                        📋 Danh Mục ({symbols.length} mã)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileMarketSubTab('orderbook')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition ${
                          mobileMarketSubTab === 'orderbook'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'text-slate-400 hover:text-white bg-[#0d1422]'
                        }`}
                      >
                        📊 Sổ Lệnh &amp; Cá Mập ({currentSymbol.symbol})
                      </button>
                    </div>

                    <div
                      className={`flex-1 overflow-hidden ${
                        mobileMarketSubTab === 'watchlist' ? 'block' : 'hidden md:block'
                      }`}
                    >
                      <Watchlist
                        symbols={symbols}
                        currentSymbol={currentSymbol}
                        favorites={favorites}
                        onSelectSymbol={sym => {
                          handleSelectSymbol(sym);
                          if (window.innerWidth < 768) {
                            setMobileTab('chart');
                          }
                        }}
                        onAddSymbol={handleAddSymbol}
                        onEditSymbol={handleEditSymbol}
                        onDeleteSymbol={handleDeleteSymbol}
                        onToggleFavorite={handleToggleFavorite}
                        onResetDefaults={handleResetDefaults}
                      />
                    </div>
                    <div
                      className={
                        mobileMarketSubTab === 'orderbook'
                          ? 'flex-1 overflow-y-auto md:flex-none'
                          : 'hidden md:block'
                      }
                    >
                      <OrderBook
                        orderBook={orderBook}
                        currentPrice={currentSymbol.price}
                        symbol={currentSymbol.symbol}
                        quoteAsset={currentSymbol.quoteAsset}
                        marketSymbol={currentSymbol}
                        candles={effectiveCandles}
                      />
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ================= MOBILE BOTTOM NAVIGATION BAR (< 768px) ================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bottom-nav-safe bg-[#070b13]/95 border-t border-slate-800/90 flex items-center justify-around z-40 px-1 backdrop-blur-xl">
        {[
          {
            id: 'chart',
            label: 'Biểu Đồ',
            icon: LineChart,
            active: activeView === 'chart' && mobileTab === 'chart',
            color: 'text-cyan-400',
            bar: 'bg-cyan-400',
            badgeDot: null as string | null,
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
            badgeDot: null as string | null,
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
            badgeDot: null as string | null,
            onClick: () => {
              setActiveView('chart');
              setMobileTab('market');
            },
          },
          {
            id: 'risk',
            label: 'Vốn & Về Bờ',
            icon: Shield,
            active: activeView === 'chart' && mobileTab === 'risk',
            color: 'text-indigo-400',
            bar: 'bg-indigo-400',
            badgeDot: activeRecoveryPlan
              ? activeRecoveryPlan.netUnrealizedPnlPct >= 0
                ? 'bg-emerald-400'
                : 'bg-rose-400 animate-pulse'
              : null,
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
            badgeDot: null as string | null,
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
              <div className="relative">
                <Icon className="w-4 h-4" />
                {item.badgeDot && (
                  <span
                    className={`absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full ${item.badgeDot}`}
                  />
                )}
              </div>
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

      {/* Smart Alert Center, Telegram Dispatcher & Cloud KV Sync Modal */}
      {isAlertModalOpen && (
        <AlertCenterModal
          currentSymbol={currentSymbol}
          symbols={symbols}
          initialPresetPrice={presetAlertPrice}
          onSelectSymbol={handleSelectSymbol}
          onWorkspaceRestored={() => {
            setFavorites(loadFavoritesFromStorage());
            setAuditEntries(loadForecastAuditEntries());
            setHoldingsRevision(r => r + 1);
          }}
          onClose={() => {
            setIsAlertModalOpen(false);
            setPresetAlertPrice(null);
          }}
        />
      )}

      {/* Cross-Market Macro Intelligence & VN30F1M Expiry Calendar Modal */}
      {isMacroModalOpen && (
        <MacroIntelligenceModal
          snapshot={macroSnapshot}
          currentSymbol={currentSymbol}
          symbols={symbols}
          activeCandles={effectiveCandles}
          initialTab={macroModalTab}
          isRefreshing={isMacroRefreshing}
          onRefresh={() => void refreshMacroSnapshot(true)}
          onSelectSymbol={handleSelectSymbol}
          onClose={() => setIsMacroModalOpen(false)}
        />
      )}

      {/* Pro Command Palette (Ctrl+K / Cmd+K) */}
      {isCommandPaletteOpen && (
        <CommandPaletteModal
          symbols={symbols}
          currentSymbol={currentSymbol}
          timeframe={timeframe}
          onSelectSymbolAndTimeframe={(sym, tf) => {
            handleSelectSymbol(sym);
            if (tf) setTimeframe(tf);
            setActiveView('chart');
          }}
          onChangeTimeframe={setTimeframe}
          onOpenMacroTab={tab => {
            setMacroModalTab(tab);
            setIsMacroModalOpen(true);
          }}
          onOpenBacktest={() => setIsBacktestOpen(true)}
          onOpenAlerts={() => {
            setPresetAlertPrice(null);
            setIsAlertModalOpen(true);
          }}
          onOpenRadar={() => setIsRadarOpen(true)}
          onToggleReplay={handleToggleReplayMode}
          onToggleVpvr={() => handleToggleIndicator('volumeProfile')}
          onToggleVwap={() => handleToggleIndicator('vwap')}
          onSetCompareSymbol={setCompareSymbol}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
      )}
    </div>
  );
};
export default App;
