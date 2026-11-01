import React, { useEffect, useRef } from 'react';
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
  OrderBlock,
  SupportResistanceLevel,
  Timeframe,
} from '../../types';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateSuperTrend,
} from '../../services/indicators';

interface TradingChartProps {
  candles: Candle[];
  timeframe?: Timeframe;
  settings: IndicatorSettings;
  srLevels: SupportResistanceLevel[];
  fibLevels: FibonacciLevel[];
  orderBlocks?: OrderBlock[];
  aiPrediction: AIPrediction | null;
  symbolName?: string;
  symbolFullName?: string;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  timeframe = '1h',
  settings,
  srLevels,
  fibLevels,
  aiPrediction,
  symbolName = '',
  symbolFullName = '',
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

  // Price Lines References (S/R, Fibonacci)
  const priceLinesRef = useRef<IPriceLine[]>([]);

  // Track previous timeframe to trigger smooth auto-fit
  const prevTimeframeRef = useRef<Timeframe>(timeframe);

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

    // 60fps Crosshair OHLC Readout (Historical + Kronos Ghost Candles, zero React re-renders)
    const fmt = (n: number) =>
      n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n >= 1 ? n.toFixed(2) : n.toFixed(4);

    chart.subscribeCrosshairMove(param => {
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

    // Resize Observer with smooth handling
    const handleResize = () => {
      if (!container || !chartRef.current) return;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        chartRef.current.applyOptions({
          width: rect.width,
          height: rect.height,
        });
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

  // 2. Smoothly Update Data & Indicators (No recreation of series = 60fps ultra smooth)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (!candles || candles.length === 0) return;

    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;

    // 1. Update Candlestick Data
    const formattedCandles = candles.map(c => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(formattedCandles);

    // 2. Update Volume Data (Historical + Kronos 6D Predicted Future Volume)
    const lastCandle = candles[candles.length - 1];
    latestCandleRef.current = lastCandle || null;
    if (lastCandle && ohlcHudRef.current) {
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

    // 3. Update EMA Series
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

    // 6. Clear and Update Support & Resistance Lines
    for (const pl of priceLinesRef.current) {
      try {
        candleSeries.removePriceLine(pl);
      } catch (e) {}
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

    // 7. Update Auto Fibonacci
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

    // 8. Update Kronos Ghost Candlesticks, Walk-Forward Back-Projection & AI Forecast Paths
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

    // 8b. Update Kronos Historical Walk-Forward Verification Line
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

    // 9. Update Monte Carlo Bounds
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

    // 10. Auto-Fit TimeScale Smoothly When Timeframe Changes
    if (prevTimeframeRef.current !== timeframe) {
      prevTimeframeRef.current = timeframe;
      requestAnimationFrame(() => {
        chart.timeScale().fitContent();
      });
    }
  }, [candles, timeframe, settings, srLevels, fibLevels, aiPrediction]);

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

      {/* Top-Left Live OHLCV + KronosChart HUD Legend (Non-intrusive pointer-events-none) */}
      <div className="absolute top-2 left-2.5 z-10 pointer-events-none flex flex-col gap-1 max-w-[86%]">
        <div className="hidden sm:flex items-center gap-2 px-2 py-0.5 rounded-md bg-[#080d18]/80 backdrop-blur-sm border border-slate-800/80 text-[10px] font-mono tabular-nums text-slate-300 shadow">
          {symbolName && (
            <span className="font-bold text-white">
              {symbolName} <span className="text-cyan-400">({timeframe})</span>
            </span>
          )}
          <span
            ref={ohlcHudRef}
            className="text-slate-300 data-[trend=up]:text-emerald-400 data-[trend=down]:text-rose-400 data-[trend=ghost]:text-cyan-300 font-medium"
          />
        </div>

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

      <div ref={chartContainerRef} className="w-full h-full min-h-[300px] relative z-[1]" />
    </div>
  );
};
