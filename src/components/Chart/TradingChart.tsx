import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineStyle,
  IPriceLine,
} from 'lightweight-charts';
import {
  AIPrediction,
  Candle,
  FibonacciLevel,
  IndicatorSettings,
  MarketSymbol,
  OrderBlock,
  SupportResistanceLevel,
  Timeframe,
} from '../../types';
import {
  computeVnPriceLimits,
  isVnStockOrIndexSymbol,
} from '../../services/vnMarket/vnStockMicrostructure';
import {
  getCachedVnFundamentals,
  VN_INSIGHTS_UPDATED_EVENT,
} from '../../services/vnMarket/vnStockInsightsClient';
import {
  computeCryptoLiquidationAndCarry,
  isCryptoSymbol,
  isUsOrGlobalEquitySymbol,
} from '../../services/globalMarket/globalExecutionEngines';
import {
  getCachedGlobalInsights,
  GLOBAL_INSIGHTS_UPDATED_EVENT,
} from '../../services/globalMarket/globalMarketInsightsClient';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateSuperTrend,
} from '../../services/indicators';
import {
  calculateRollingVWAP,
  calculateVisibleVolumeProfile,
} from '../../services/analysis/volumeProfileMtf';
import { ChartRecommendationVerdict } from '../../services/ai/chartVerdictEngine';
import { PositionRecoveryPlan } from '../../services/portfolio/holdingsRecoveryEngine';
import { ChartDrawingOverlay } from './ChartDrawingOverlay';
import { ChartVerdictOverlay } from './ChartVerdictOverlay';

interface TradingChartProps {
  candles: Candle[];
  timeframe?: Timeframe;
  settings: IndicatorSettings;
  srLevels: SupportResistanceLevel[];
  fibLevels: FibonacciLevel[];
  orderBlocks?: OrderBlock[];
  aiPrediction: AIPrediction | null;
  chartVerdict?: ChartRecommendationVerdict | null;
  recoveryPlan?: PositionRecoveryPlan | null;
  symbolName?: string;
  symbolFullName?: string;
  currentSymbol?: MarketSymbol;
  compareSymbolName?: string | null;
  compareCandles?: Candle[];
  onTogglePlanLines?: () => void;
  onOpenFullRecoveryTab?: () => void;
  onQuickCreatePriceAlert?: (price: number) => void;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  timeframe = '1h',
  settings,
  srLevels,
  fibLevels,
  aiPrediction,
  chartVerdict = null,
  recoveryPlan = null,
  symbolName = '',
  symbolFullName = '',
  currentSymbol,
  compareSymbolName = null,
  compareCandles = [],
  onTogglePlanLines,
  onOpenFullRecoveryTab,
  onQuickCreatePriceAlert,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const ohlcHudRef = useRef<HTMLDivElement>(null);
  const latestCandleRef = useRef<Candle | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Line Series References
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const compareSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const supertrendSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // AI Forecast Series References
  const kronosCandleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const kronosWalkForwardRef = useRef<ISeriesApi<'Line'> | null>(null);
  const aiBullishRef = useRef<ISeriesApi<'Line'> | null>(null);
  const aiBaseRef = useRef<ISeriesApi<'Line'> | null>(null);
  const aiBearishRef = useRef<ISeriesApi<'Line'> | null>(null);
  const mcUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const mcLowerRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Price Lines References (S/R, Fibonacci, VPVR POC/VAH/VAL)
  const priceLinesRef = useRef<IPriceLine[]>([]);

  // VPVR coordinate tick for 60fps zoom/pan sync
  const [vpvrCoordTick, setVpvrCoordTick] = useState(0);
  const [globalInsightsTick, setGlobalInsightsTick] = useState(0);

  useEffect(() => {
    const onInsightsUpdated = (e: Event) => {
      const detailSym = (e as CustomEvent)?.detail?.symbol;
      if (!detailSym || detailSym === symbolName.toUpperCase()) {
        setGlobalInsightsTick(t => t + 1);
      }
    };
    window.addEventListener(GLOBAL_INSIGHTS_UPDATED_EVENT, onInsightsUpdated);
    window.addEventListener(VN_INSIGHTS_UPDATED_EVENT, onInsightsUpdated);
    return () => {
      window.removeEventListener(GLOBAL_INSIGHTS_UPDATED_EVENT, onInsightsUpdated);
      window.removeEventListener(VN_INSIGHTS_UPDATED_EVENT, onInsightsUpdated);
    };
  }, [symbolName]);

  // Track hover state and previous symbol/timeframe to preserve pan/zoom on real-time ticks
  const isHoveringRef = useRef<boolean>(false);
  const prevTimeframeRef = useRef<Timeframe>(timeframe);
  const prevSymbolRef = useRef<string>(symbolName);

  const vpvrProfile = useMemo(() => {
    if (!settings.volumeProfile || candles.length < 5) return null;
    return calculateVisibleVolumeProfile(candles, 24, 0.7);
  }, [settings.volumeProfile, candles]);

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#060a12' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Inter', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.045)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.045)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#22d3ee',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#0f172a',
        },
        horzLine: {
          color: '#22d3ee',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#0f172a',
        },
      },
      leftPriceScale: {
        visible: false,
        borderColor: 'rgba(30, 41, 59, 0.85)',
      },
      rightPriceScale: {
        borderColor: 'rgba(30, 41, 59, 0.85)',
        scaleMargins: {
          top: 0.12,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: 'rgba(30, 41, 59, 0.85)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });
    candleSeriesRef.current = candleSeries;

    // Volume Series
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Create Persistent Technical Indicator Series
    ema20SeriesRef.current = chart.addLineSeries({ color: '#06b6d4', lineWidth: 2, title: 'EMA 20' });
    ema50SeriesRef.current = chart.addLineSeries({ color: '#f59e0b', lineWidth: 2, title: 'EMA 50' });
    ema200SeriesRef.current = chart.addLineSeries({ color: '#a855f7', lineWidth: 2, title: 'EMA 200' });
    vwapSeriesRef.current = chart.addLineSeries({
      color: '#2dd4bf',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      title: 'VWAP',
    });

    // Secondary Intermarket Compare Series (% Change Indexed on Left Scale)
    compareSeriesRef.current = chart.addLineSeries({
      color: '#f472b6',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      priceScaleId: 'left',
      title: 'Compare',
    });

    bbUpperRef.current = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.7)', lineWidth: 1, lineStyle: LineStyle.Dotted });
    bbMiddleRef.current = chart.addLineSeries({ color: 'rgba(96, 165, 250, 0.8)', lineWidth: 1 });
    bbLowerRef.current = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.7)', lineWidth: 1, lineStyle: LineStyle.Dotted });

    supertrendSeriesRef.current = chart.addLineSeries({ color: '#10b981', lineWidth: 2, title: 'SuperTrend' });

    // Kronos Ghost Candlestick Series (Future OHLCV Projection)
    kronosCandleSeriesRef.current = chart.addCandlestickSeries({
      upColor: 'rgba(6, 182, 212, 0.48)',
      downColor: 'rgba(249, 115, 22, 0.48)',
      borderVisible: true,
      borderUpColor: '#06b6d4',
      borderDownColor: '#f97316',
      wickUpColor: '#22d3ee',
      wickDownColor: '#fb923c',
    });

    // Kronos Walk-Forward Historical Back-Projection Line
    kronosWalkForwardRef.current = chart.addLineSeries({
      color: '#fbbf24',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: 'AI Kiểm Định',
    });

    // AI Lines
    aiBullishRef.current = chart.addLineSeries({ color: '#10b981', lineWidth: 2, lineStyle: LineStyle.Dashed, title: 'Kronos P85' });
    aiBaseRef.current = chart.addLineSeries({ color: '#38bdf8', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'Kronos P50' });
    aiBearishRef.current = chart.addLineSeries({ color: '#f43f5e', lineWidth: 2, lineStyle: LineStyle.Dashed, title: 'Kronos P15' });
    mcUpperRef.current = chart.addLineSeries({ color: 'rgba(168, 85, 247, 0.65)', lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'Kronos 95%' });
    mcLowerRef.current = chart.addLineSeries({ color: 'rgba(168, 85, 247, 0.65)', lineWidth: 1, lineStyle: LineStyle.Dotted });

    const fmt = (n: number) =>
      n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n >= 1 ? n.toFixed(2) : n.toFixed(4);

    chart.subscribeCrosshairMove(param => {
      isHoveringRef.current = Boolean(param.time);
      if (!ohlcHudRef.current) return;
      const realBar = candleSeriesRef.current ? (param.seriesData.get(candleSeriesRef.current) as any) : null;
      const ghostBar = kronosCandleSeriesRef.current ? (param.seriesData.get(kronosCandleSeriesRef.current) as any) : null;
      const bar = realBar || ghostBar || latestCandleRef.current;
      if (!bar || typeof bar.open !== 'number') return;

      const isGhost = !realBar && Boolean(ghostBar);
      const chg = bar.open > 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0;
      const sign = chg >= 0 ? '+' : '';
      ohlcHudRef.current.dataset.trend = isGhost ? 'ghost' : chg >= 0 ? 'up' : 'down';
      ohlcHudRef.current.textContent = `${isGhost ? '[AI KRONOS] ' : ''}O ${fmt(bar.open)}   H ${fmt(bar.high)}   L ${fmt(bar.low)}   C ${fmt(bar.close)}  (${sign}${chg.toFixed(2)}%)`;
    });

    const bumpVpvr = () => {
      requestAnimationFrame(() => setVpvrCoordTick(t => (t + 1) % 100000));
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(bumpVpvr);

    const handleResize = () => {
      if (!container || !chartRef.current) return;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        chartRef.current.applyOptions({
          width: rect.width,
          height: rect.height,
        });
        bumpVpvr();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(handleResize);
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 50);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // 2. Smoothly Update Data & Indicators
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (!candles || candles.length === 0) return;

    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;

    const formattedCandles = candles.map(c => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(formattedCandles);

    const lastCandle = candles[candles.length - 1];
    latestCandleRef.current = lastCandle || null;
    if (lastCandle && ohlcHudRef.current && !isHoveringRef.current) {
      const chg = lastCandle.open > 0 ? ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100 : 0;
      const fmt = (n: number) =>
        n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n >= 1 ? n.toFixed(2) : n.toFixed(4);
      ohlcHudRef.current.dataset.trend = chg >= 0 ? 'up' : 'down';
      ohlcHudRef.current.textContent = `O ${fmt(lastCandle.open)}   H ${fmt(lastCandle.high)}   L ${fmt(lastCandle.low)}   C ${fmt(lastCandle.close)}  (${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%)`;
    }

    const formattedVolume: { time: any; value: number; color: string }[] = candles.map(c => ({
      time: c.time as any,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)',
    }));

    if (
      settings.kronosGhostCandles &&
      aiPrediction?.predictedCandles &&
      aiPrediction.predictedCandles.length > 0 &&
      lastCandle
    ) {
      const avgHistVol =
        aiPrediction.volumeProfile?.avgHistoricalVolume ||
        candles.slice(-20).reduce((s, x) => s + (x.volume || 0), 0) / Math.min(20, candles.length) ||
        1;
      let prevVolTime = lastCandle.time;

      for (const pc of aiPrediction.predictedCandles) {
        if (pc.time > prevVolTime) {
          const isSurge = (pc.volume || 0) >= avgHistVol * 1.38;
          const isUp = pc.close >= pc.open;
          formattedVolume.push({
            time: pc.time as any,
            value: pc.volume || 0,
            color: isSurge
              ? isUp
                ? 'rgba(34, 211, 238, 0.78)'
                : 'rgba(251, 146, 60, 0.78)'
              : isUp
                ? 'rgba(6, 182, 212, 0.42)'
                : 'rgba(249, 115, 22, 0.42)',
          });
          prevVolTime = pc.time;
        }
      }
    }
    volumeSeries.setData(formattedVolume);

    const closes = candles.map(c => c.close);

    // 3. Update EMA & Institutional VWAP Series
    if (settings.ema20 && ema20SeriesRef.current) {
      const ema20 = calculateEMA(closes, 20);
      const emaData = candles.map((c, i) => ({ time: c.time as any, value: ema20[i] })).filter(d => d.value !== null);
      ema20SeriesRef.current.setData(emaData as any);
    } else if (ema20SeriesRef.current) {
      ema20SeriesRef.current.setData([]);
    }

    if (settings.ema50 && ema50SeriesRef.current) {
      const ema50 = calculateEMA(closes, 50);
      const emaData = candles.map((c, i) => ({ time: c.time as any, value: ema50[i] })).filter(d => d.value !== null);
      ema50SeriesRef.current.setData(emaData as any);
    } else if (ema50SeriesRef.current) {
      ema50SeriesRef.current.setData([]);
    }

    if (settings.ema200 && ema200SeriesRef.current) {
      const ema200 = calculateEMA(closes, 200);
      const emaData = candles.map((c, i) => ({ time: c.time as any, value: ema200[i] })).filter(d => d.value !== null);
      ema200SeriesRef.current.setData(emaData as any);
    } else if (ema200SeriesRef.current) {
      ema200SeriesRef.current.setData([]);
    }

    if (settings.vwap && vwapSeriesRef.current) {
      const vwapPts = calculateRollingVWAP(candles);
      vwapSeriesRef.current.setData(vwapPts.map(p => ({ time: p.time as any, value: p.vwap })));
    } else if (vwapSeriesRef.current) {
      vwapSeriesRef.current.setData([]);
    }

    // 3b. Intermarket Comparison Series (Left Scale)
    if (compareSeriesRef.current) {
      if (compareSymbolName && compareCandles && compareCandles.length > 2) {
        chart.applyOptions({
          leftPriceScale: { visible: true, borderColor: 'rgba(244, 114, 182, 0.35)' },
        });
        compareSeriesRef.current.applyOptions({
          title: `${compareSymbolName}`,
        });
        compareSeriesRef.current.setData(
          compareCandles.map(cc => ({
            time: cc.time as any,
            value: cc.close,
          }))
        );
      } else {
        chart.applyOptions({
          leftPriceScale: { visible: false },
        });
        compareSeriesRef.current.setData([]);
      }
    }

    // 4. Update Bollinger Bands
    if (settings.bollingerBands && bbUpperRef.current && bbMiddleRef.current && bbLowerRef.current) {
      const bb = calculateBollingerBands(candles, 20, 2);
      bbUpperRef.current.setData(bb.map(b => ({ time: b.time as any, value: b.upper })));
      bbMiddleRef.current.setData(bb.map(b => ({ time: b.time as any, value: b.middle })));
      bbLowerRef.current.setData(bb.map(b => ({ time: b.time as any, value: b.lower })));
    } else {
      if (bbUpperRef.current) bbUpperRef.current.setData([]);
      if (bbMiddleRef.current) bbMiddleRef.current.setData([]);
      if (bbLowerRef.current) bbLowerRef.current.setData([]);
    }

    // 5. Update SuperTrend
    if (settings.supertrend && supertrendSeriesRef.current) {
      const st = calculateSuperTrend(candles, 10, 3);
      if (st.length > 0) {
        const lastSt = st[st.length - 1];
        supertrendSeriesRef.current.applyOptions({
          color: lastSt.direction === 1 ? '#10b981' : '#f43f5e',
        });
        supertrendSeriesRef.current.setData(st.map(s => ({ time: s.time as any, value: s.value })));
      } else {
        supertrendSeriesRef.current.setData([]);
      }
    } else if (supertrendSeriesRef.current) {
      supertrendSeriesRef.current.setData([]);
    }

    // 6. Clear and Update Support & Resistance + Fibonacci + VPVR Key Lines
    for (const pl of priceLinesRef.current) {
      try {
        candleSeries.removePriceLine(pl);
      } catch {}
    }
    priceLinesRef.current = [];

    if (settings.autoSupportResistance) {
      for (const sr of srLevels) {
        const isSup = sr.type === 'support';
        const pl = candleSeries.createPriceLine({
          price: sr.price,
          color: isSup ? '#10b981' : '#f43f5e',
          lineWidth: sr.strength >= 3 ? 2 : 1,
          lineStyle: sr.strength >= 4 ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${isSup ? 'SUP' : 'RES'} (${sr.strength}★)`,
        });
        priceLinesRef.current.push(pl);
      }
    }

    if (settings.autoFibonacci) {
      for (const fib of fibLevels) {
        const pl = candleSeries.createPriceLine({
          price: fib.price,
          color: fib.color,
          lineWidth: fib.isKeyZone ? 2 : 1,
          lineStyle: fib.isKeyZone ? LineStyle.Solid : LineStyle.Dotted,
          axisLabelVisible: true,
          title: `FIB ${fib.label}`,
        });
        priceLinesRef.current.push(pl);
      }
    }

    if (settings.volumeProfile && vpvrProfile) {
      priceLinesRef.current.push(
        candleSeries.createPriceLine({
          price: vpvrProfile.pocPrice,
          color: '#f59e0b',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'POC (Đỉnh KL)',
        }),
        candleSeries.createPriceLine({
          price: vpvrProfile.vahPrice,
          color: '#38bdf8',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'VAH 70%',
        }),
        candleSeries.createPriceLine({
          price: vpvrProfile.valPrice,
          color: '#818cf8',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'VAL 70%',
        })
      );
    }

    // 7. Vietnam Official Ceiling (Trần Tím), Reference (Tham Chiếu Vàng), Floor (Sàn Xanh Lơ) Price Lines
    if (
      settings.vnPriceLimits !== false &&
      symbolName &&
      isVnStockOrIndexSymbol(currentSymbol || symbolName) &&
      lastCandle
    ) {
      const fund = getCachedVnFundamentals(symbolName);
      const vnLimits = computeVnPriceLimits({
        symbol: symbolName,
        currentPrice: currentSymbol?.price || lastCandle.close,
        change24hPct: currentSymbol?.change24h,
        officialRefPrice: fund?.officialRefPrice,
        officialCeilingPrice: fund?.officialCeilingPrice,
        officialFloorPrice: fund?.officialFloorPrice,
      });

      if (
        vnLimits.board !== 'INDEX' &&
        vnLimits.ceilingPrice !== null &&
        vnLimits.floorPrice !== null
      ) {
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: vnLimits.ceilingPrice,
            color: '#c084fc', // Tím Trần SSI iBoard
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `TRẦN (+${vnLimits.bandPct}%)`,
          }),
          candleSeries.createPriceLine({
            price: vnLimits.refPrice,
            color: '#facc15', // Vàng Tham chiếu
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'THAM CHIẾU',
          }),
          candleSeries.createPriceLine({
            price: vnLimits.floorPrice,
            color: '#22d3ee', // Xanh lơ Sàn
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `SÀN (-${vnLimits.bandPct}%)`,
          })
        );
      }
    }

    // 7B. Global Institutional Price Lines: Crypto Liquidation Magnets & Deribit/CBOE Options Walls
    if (
      settings.globalOptionsAndLiqLines !== false &&
      symbolName &&
      !isVnStockOrIndexSymbol(currentSymbol || symbolName) &&
      lastCandle
    ) {
      const spot = currentSymbol?.price || lastCandle.close;
      const gInsights = getCachedGlobalInsights(symbolName);

      if (isCryptoSymbol(currentSymbol || symbolName)) {
        const liq = computeCryptoLiquidationAndCarry(
          symbolName,
          spot,
          candles,
          gInsights?.perpCarry
        );
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: liq.shortLiq25x,
            color: '#fb7185',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: '🧲 SHORT LIQ 25x',
          }),
          candleSeries.createPriceLine({
            price: liq.longLiq25x,
            color: '#34d399',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: '🧲 LONG LIQ 25x',
          })
        );

        const opt = gInsights?.optionsSummary;
        if (opt && 'isDirectUnderlying' in opt && opt.isDirectUnderlying) {
          if (opt.callWallPrice && opt.callWallPrice > spot * 0.8 && opt.callWallPrice < spot * 1.3) {
            priceLinesRef.current.push(
              candleSeries.createPriceLine({
                price: opt.callWallPrice,
                color: '#f472b6',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: true,
                title: 'DERIBIT CALL WALL',
              })
            );
          }
          if (opt.maxPainPrice && opt.maxPainPrice > spot * 0.8 && opt.maxPainPrice < spot * 1.25) {
            priceLinesRef.current.push(
              candleSeries.createPriceLine({
                price: opt.maxPainPrice,
                color: '#facc15',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: true,
                title: 'DERIBIT MAX PAIN',
              })
            );
          }
          if (opt.putWallPrice && opt.putWallPrice > spot * 0.75 && opt.putWallPrice < spot * 1.2) {
            priceLinesRef.current.push(
              candleSeries.createPriceLine({
                price: opt.putWallPrice,
                color: '#38bdf8',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: true,
                title: 'DERIBIT PUT WALL',
              })
            );
          }
        }
      } else if (isUsOrGlobalEquitySymbol(currentSymbol || symbolName) && gInsights) {
        const opt = gInsights.optionsSummary;
        if (opt) {
          if (opt.callWallPrice && opt.callWallPrice > spot * 0.8 && opt.callWallPrice < spot * 1.3) {
            priceLinesRef.current.push(
              candleSeries.createPriceLine({
                price: opt.callWallPrice,
                color: '#f472b6',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: 'CBOE CALL WALL',
              })
            );
          }
          if (opt.maxPainPrice && opt.maxPainPrice > spot * 0.8 && opt.maxPainPrice < spot * 1.25) {
            priceLinesRef.current.push(
              candleSeries.createPriceLine({
                price: opt.maxPainPrice,
                color: '#facc15',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: true,
                title: 'CBOE MAX PAIN',
              })
            );
          }
          if (opt.putWallPrice && opt.putWallPrice > spot * 0.75 && opt.putWallPrice < spot * 1.2) {
            priceLinesRef.current.push(
              candleSeries.createPriceLine({
                price: opt.putWallPrice,
                color: '#38bdf8',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: 'CBOE PUT WALL',
              })
            );
          }
        }

        const uq = gInsights.usQuote;
        const extPrice = uq?.preMarketPrice ?? uq?.postMarketPrice ?? null;
        if (extPrice && Math.abs(extPrice - spot) / spot >= 0.002) {
          priceLinesRef.current.push(
            candleSeries.createPriceLine({
              price: extPrice,
              color: '#a78bfa',
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              axisLabelVisible: true,
              title: uq?.preMarketPrice ? 'PRE-MARKET' : 'AFTER-HOURS',
            })
          );
        }
      }
    }

    // 7C. Unified 6-Pillar Recommended Trade Plan Lines (ENTRY • SL • TP1 • TP2)
    if (
      settings.recommendedPlanLines !== false &&
      chartVerdict &&
      chartVerdict.hasActionablePlan &&
      chartVerdict.entryMidPrice > 0
    ) {
      const isReduceOnly = chartVerdict.verdictCode === 'REDUCE_TAKE_PROFIT';
      const entryRef =
        chartVerdict.verdictCode === 'ACCUMULATE_LIMIT'
          ? chartVerdict.entryZone[1]
          : chartVerdict.entryMidPrice;
      const slPct = ((chartVerdict.stopLoss - entryRef) / entryRef) * 100;
      const tp1Pct = ((chartVerdict.takeProfit1 - entryRef) / entryRef) * 100;
      const tp2Pct = ((chartVerdict.takeProfit2 - entryRef) / entryRef) * 100;

      priceLinesRef.current.push(
        candleSeries.createPriceLine({
          price: entryRef,
          color: isReduceOnly ? '#fbbf24' : '#38bdf8',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: isReduceOnly
            ? '⚠️ VÙNG HẠ TỶ TRỌNG'
            : chartVerdict.verdictCode === 'ACCUMULATE_LIMIT'
            ? '🎯 KÊ LIMIT GOM'
            : chartVerdict.isShortPlan
            ? '🎯 ENTRY SHORT'
            : '🎯 ENTRY MUA',
        }),
        candleSeries.createPriceLine({
          price: chartVerdict.stopLoss,
          color: '#fb7185',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: isReduceOnly
            ? `🛡️ CẢN VÔ HIỆU (${slPct >= 0 ? '+' : ''}${slPct.toFixed(1)}%)`
            : `🛑 CẮT LỖ SL (${slPct >= 0 ? '+' : ''}${slPct.toFixed(1)}%)`,
        }),
        candleSeries.createPriceLine({
          price: chartVerdict.takeProfit1,
          color: '#34d399',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: isReduceOnly
            ? `📥 NỀN GOM LẠI 1 (${tp1Pct.toFixed(1)}%)`
            : `✅ CHỐT LỜI TP1 (${tp1Pct >= 0 ? '+' : ''}${tp1Pct.toFixed(1)}%)`,
        }),
        candleSeries.createPriceLine({
          price: chartVerdict.takeProfit2,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: isReduceOnly
            ? `📥 NỀN GOM SÂU (${tp2Pct.toFixed(1)}%)`
            : `🏆 MỤC TIÊU TP2 (${tp2Pct >= 0 ? '+' : ''}${tp2Pct.toFixed(1)}% • 1:${chartVerdict.riskRewardRatio})`,
        })
      );
    }

    // 7D. Personal Holding True Break-Even & Post-DCA Price Lines
    if (
      settings.holdingCostLines !== false &&
      recoveryPlan &&
      recoveryPlan.trueBreakEvenPrice > 0
    ) {
      const isProfit = recoveryPlan.netUnrealizedPnlPct >= 0;
      priceLinesRef.current.push(
        candleSeries.createPriceLine({
          price: recoveryPlan.trueBreakEvenPrice,
          color: isProfit ? '#10b981' : '#f59e0b',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `💼 HÒA VỐN THỰC (${isProfit ? '+' : ''}${recoveryPlan.netUnrealizedPnlPct}%)`,
        })
      );

      if (
        recoveryPlan.smartDcaPlan.allowed &&
        recoveryPlan.smartDcaPlan.newTrueBreakEvenPrice > 0 &&
        recoveryPlan.smartDcaPlan.newTrueBreakEvenPrice < recoveryPlan.trueBreakEvenPrice * 0.995
      ) {
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: recoveryPlan.smartDcaPlan.newTrueBreakEvenPrice,
            color: '#38bdf8',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `🎯 BỜ MỚI SAU DCA (+${recoveryPlan.smartDcaPlan.newGainNeededPct}%)`,
          })
        );
      }
    }

    // 7E. Vietnam 3-Rung Bottom-Fishing Limit Ladder ("Rải Đinh Bắt Đáy B1 / B2")
    if (
      settings.vnBottomFishingLines !== false &&
      chartVerdict?.vnTacticalSummary &&
      chartVerdict.vnTacticalSummary.bottomFishingPlan.board !== 'INDEX'
    ) {
      const bf = chartVerdict.vnTacticalSummary.bottomFishingPlan;
      const rung1 = bf.rungs[0];
      const rung2 = bf.rungs[1];
      if (rung1 && rung1.limitPrice > 0) {
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: rung1.limitPrice,
            color: '#2dd4bf',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `🪝 BẮT ĐÁY B1 20% (${rung1.discountFromRefPct >= 0 ? '+' : ''}${rung1.discountFromRefPct}%)`,
          })
        );
      }
      if (rung2 && rung2.limitPrice > 0 && Math.abs(rung2.limitPrice - rung1.limitPrice) > 0.01) {
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: rung2.limitPrice,
            color: '#14b8a6',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `🪝 HỨNG SÀN B2 30% (${rung2.discountFromRefPct}%)`,
          })
        );
      }
    }

    // 8. Update Kronos Ghost Candlesticks, Walk-Forward & AI Forecast Paths
    if (
      settings.kronosGhostCandles &&
      aiPrediction &&
      aiPrediction.predictedCandles &&
      aiPrediction.predictedCandles.length > 0 &&
      kronosCandleSeriesRef.current &&
      lastCandle
    ) {
      let prevTime = lastCandle.time;
      const validGhost: { time: any; open: number; high: number; low: number; close: number }[] = [];
      for (const c of aiPrediction.predictedCandles) {
        if (c.time > prevTime) {
          validGhost.push({
            time: c.time as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          });
          prevTime = c.time;
        }
      }
      kronosCandleSeriesRef.current.setData(validGhost);
    } else if (kronosCandleSeriesRef.current) {
      kronosCandleSeriesRef.current.setData([]);
    }

    if (
      settings.kronosWalkForward &&
      aiPrediction?.walkForward?.backtestPath &&
      aiPrediction.walkForward.backtestPath.length > 1 &&
      kronosWalkForwardRef.current
    ) {
      kronosWalkForwardRef.current.setData(
        aiPrediction.walkForward.backtestPath.map(p => ({
          time: p.time as any,
          value: p.price,
        }))
      );
    } else if (kronosWalkForwardRef.current) {
      kronosWalkForwardRef.current.setData([]);
    }

    if (settings.aiForecast && aiPrediction && aiPrediction.scenarios.length > 0 && lastCandle) {
      const bullScenario = aiPrediction.scenarios.find(s => s.type === 'BULLISH' || s.name.includes('Tăng'));
      const baseScenario = aiPrediction.scenarios.find(s => s.type === 'BASE' || s.name.includes('Cơ Sở'));
      const bearScenario = aiPrediction.scenarios.find(s => s.type === 'BEARISH' || s.name.includes('Điều Chỉnh'));

      if (bullScenario && aiBullishRef.current) {
        aiBullishRef.current.setData([
          { time: lastCandle.time as any, value: lastCandle.close },
          ...bullScenario.path.filter(p => p.time > lastCandle.time).map(p => ({ time: p.time as any, value: p.price })),
        ]);
      } else if (aiBullishRef.current) aiBullishRef.current.setData([]);

      if (baseScenario && aiBaseRef.current) {
        aiBaseRef.current.setData([
          { time: lastCandle.time as any, value: lastCandle.close },
          ...baseScenario.path.filter(p => p.time > lastCandle.time).map(p => ({ time: p.time as any, value: p.price })),
        ]);
      } else if (aiBaseRef.current) aiBaseRef.current.setData([]);

      if (bearScenario && aiBearishRef.current) {
        aiBearishRef.current.setData([
          { time: lastCandle.time as any, value: lastCandle.close },
          ...bearScenario.path.filter(p => p.time > lastCandle.time).map(p => ({ time: p.time as any, value: p.price })),
        ]);
      } else if (aiBearishRef.current) aiBearishRef.current.setData([]);
    } else {
      if (aiBullishRef.current) aiBullishRef.current.setData([]);
      if (aiBaseRef.current) aiBaseRef.current.setData([]);
      if (aiBearishRef.current) aiBearishRef.current.setData([]);
    }

    if (settings.monteCarloPaths && aiPrediction && aiPrediction.upperConfidenceBound.length > 0 && lastCandle) {
      if (mcUpperRef.current && mcLowerRef.current) {
        mcUpperRef.current.setData([
          { time: lastCandle.time as any, value: lastCandle.close },
          ...aiPrediction.upperConfidenceBound.filter(p => p.time > lastCandle.time).map(p => ({ time: p.time as any, value: p.price })),
        ]);
        mcLowerRef.current.setData([
          { time: lastCandle.time as any, value: lastCandle.close },
          ...aiPrediction.lowerConfidenceBound.filter(p => p.time > lastCandle.time).map(p => ({ time: p.time as any, value: p.price })),
        ]);
      }
    } else {
      if (mcUpperRef.current) mcUpperRef.current.setData([]);
      if (mcLowerRef.current) mcLowerRef.current.setData([]);
    }

    if (prevTimeframeRef.current !== timeframe || prevSymbolRef.current !== symbolName) {
      prevTimeframeRef.current = timeframe;
      prevSymbolRef.current = symbolName;
      requestAnimationFrame(() => {
        chart.timeScale().fitContent();
        setVpvrCoordTick(t => t + 1);
      });
    } else {
      requestAnimationFrame(() => setVpvrCoordTick(t => t + 1));
    }
  }, [
    candles,
    timeframe,
    symbolName,
    currentSymbol,
    settings,
    srLevels,
    fibLevels,
    aiPrediction,
    chartVerdict,
    recoveryPlan,
    vpvrProfile,
    compareSymbolName,
    compareCandles,
    globalInsightsTick,
  ]);

  const wf = aiPrediction?.walkForward;
  const vp = aiPrediction?.volumeProfile;

  return (
    <div className="w-full h-full relative bg-[#060a12] overflow-hidden">
      {/* Subtle Institutional Symbol & Timeframe Watermark */}
      {symbolName && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0 opacity-[0.035]">
          <div className="text-4xl sm:text-6xl lg:text-7xl font-black font-mono tracking-widest text-white uppercase">
            {symbolName} • {timeframe}
          </div>
          {symbolFullName && (
            <div className="text-xs sm:text-base font-semibold tracking-[0.2em] text-cyan-200 uppercase mt-1">
              {symbolFullName} • KRONOS AI
            </div>
          )}
        </div>
      )}

      {/* Top-Left Unified HUD Stack (OHLCV + 6-Pillar Action Verdict + Walk-Forward) */}
      <div className="absolute top-2 left-2.5 right-[68px] z-[18] pointer-events-none flex flex-col items-start gap-1.5">
        <div className="hidden sm:flex items-center gap-2 px-2 py-0.5 rounded-md bg-[#080d18]/80 backdrop-blur-sm border border-slate-800/80 text-[10px] font-mono tabular-nums text-slate-300 shadow max-w-full">
          {symbolName && (
            <span className="font-bold text-white shrink-0">
              {symbolName} <span className="text-cyan-400">({timeframe})</span>
            </span>
          )}
          <span
            ref={ohlcHudRef}
            className="text-slate-300 data-[trend=up]:text-emerald-400 data-[trend=down]:text-rose-400 data-[trend=ghost]:text-cyan-300 font-medium truncate"
          />
          {compareSymbolName && (
            <span className="px-1.5 py-0.2 rounded bg-pink-500/20 border border-pink-400/40 text-pink-300 font-bold shrink-0">
              vs {compareSymbolName} (Trục Trái)
            </span>
          )}
        </div>

        {/* Sub-stack shifted right (pl-9 sm:pl-10) to completely clear the left Drawing Tool Rail */}
        <div className="w-full pl-9 sm:pl-10 flex flex-col items-start gap-1.5">
          {chartVerdict && (
            <ChartVerdictOverlay
              verdict={chartVerdict}
              recoveryPlan={recoveryPlan}
              quoteAsset={currentSymbol?.quoteAsset}
              showPlanLines={settings.recommendedPlanLines !== false}
              onTogglePlanLines={onTogglePlanLines}
              onOpenFullRecoveryTab={onOpenFullRecoveryTab}
              onQuickCreatePriceAlert={onQuickCreatePriceAlert}
            />
          )}

          {(settings.kronosWalkForward || settings.kronosGhostCandles) && aiPrediction && (
            <div className="flex flex-wrap items-center gap-1.5">
              {settings.kronosWalkForward && wf && (
                <div className="px-2 py-0.5 rounded-md bg-[#0b111d]/85 backdrop-blur-sm border border-amber-500/35 text-[10px] font-mono flex items-center gap-1.5 shadow">
                  <span className="w-2 h-0.5 bg-amber-400 inline-block" />
                  <span className="text-amber-300 font-bold">Kiểm định {wf.holdoutBars} nến:</span>
                  <span className="text-emerald-300 font-bold">{wf.directionalAccuracy}% đúng hướng</span>
                  <span className="text-slate-400">• MAPE {wf.mapePercent}%</span>
                </div>
              )}

              {settings.kronosGhostCandles && vp?.surgeDetected && (
                <div className="px-2 py-0.5 rounded-md bg-cyan-950/85 backdrop-blur-sm border border-cyan-400/50 text-[10px] font-mono flex items-center gap-1 text-cyan-200 shadow">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="font-bold">6D Vol Surge:</span>
                  <span>Đột biến thanh khoản tại nến +{vp.peakBarOffset}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right-Docked Visible Range Volume Profile (VPVR) Histogram Overlay */}
      {settings.volumeProfile && vpvrProfile && candleSeriesRef.current && (
        <svg
          data-tick={vpvrCoordTick}
          className="absolute top-0 right-[62px] w-[135px] h-full pointer-events-none z-[4]"
        >
          {vpvrProfile.rows.map(row => {
            const yTop = candleSeriesRef.current?.priceToCoordinate(row.priceHigh);
            const yBot = candleSeriesRef.current?.priceToCoordinate(row.priceLow);
            if (yTop === null || yTop === undefined || yBot === null || yBot === undefined) {
              return null;
            }
            const top = Math.min(yTop, yBot);
            const height = Math.max(2, Math.abs(yBot - yTop) - 1);
            const totalW = (row.volumePctOfMax / 100) * 130;
            const buyW =
              row.totalVolume > 0 ? (row.buyVolume / row.totalVolume) * totalW : totalW * 0.5;
            const sellW = Math.max(0, totalW - buyW);
            const xStart = 135 - totalW;

            return (
              <g key={row.binIndex} opacity={row.isPoc ? 0.88 : row.inValueArea ? 0.62 : 0.28}>
                <rect
                  x={xStart}
                  y={top}
                  width={sellW}
                  height={height}
                  fill={row.isPoc ? '#f59e0b' : '#f43f5e'}
                  rx={1.5}
                />
                <rect
                  x={xStart + sellW}
                  y={top}
                  width={buyW}
                  height={height}
                  fill={row.isPoc ? '#fbbf24' : '#10b981'}
                  rx={1.5}
                />
              </g>
            );
          })}
        </svg>
      )}

      <ChartDrawingOverlay
        chartRef={chartRef}
        candleSeriesRef={candleSeriesRef}
        candles={candles}
        symbolName={symbolName}
        timeframe={timeframe}
        aiPrediction={aiPrediction}
        onQuickCreatePriceAlert={onQuickCreatePriceAlert}
      />

      <div ref={chartContainerRef} className="w-full h-full min-h-[300px] relative z-[1]" />
    </div>
  );
};
