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
}

export const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  timeframe = '1h',
  settings,
  srLevels,
  fibLevels,
  aiPrediction,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
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
        background: { type: ColorType.Solid, color: '#090d15' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Inter', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#3b82f6',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          color: '#3b82f6',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b',
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#1e293b',
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

    // AI Lines
    aiBullishRef.current = chart.addLineSeries({ color: '#10b981', lineWidth: 2, lineStyle: LineStyle.Dashed, title: 'AI Bull' });
    aiBaseRef.current = chart.addLineSeries({ color: '#38bdf8', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'AI Base' });
    aiBearishRef.current = chart.addLineSeries({ color: '#f43f5e', lineWidth: 2, lineStyle: LineStyle.Dashed, title: 'AI Bear' });
    mcUpperRef.current = chart.addLineSeries({ color: 'rgba(168, 85, 247, 0.65)', lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'MC 95%' });
    mcLowerRef.current = chart.addLineSeries({ color: 'rgba(168, 85, 247, 0.65)', lineWidth: 1, lineStyle: LineStyle.Dotted });

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

    // 2. Update Volume Data
    const formattedVolume = candles.map(c => ({
      time: c.time as any,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)',
    }));
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

    // 8. Update AI Forecast Paths
    const lastCandle = candles[candles.length - 1];
    if (settings.aiForecast && aiPrediction && aiPrediction.scenarios.length > 0 && lastCandle) {
      const bullScenario = aiPrediction.scenarios.find(s => s.name.includes('Tăng'));
      const baseScenario = aiPrediction.scenarios.find(s => s.name.includes('Cơ sở'));
      const bearScenario = aiPrediction.scenarios.find(s => s.name.includes('Điều chỉnh'));

      if (bullScenario && aiBullishRef.current) {
        aiBullishRef.current.setData([
          { time: lastCandle.time as any, value: lastCandle.close },
          ...bullScenario.path.map(p => ({ time: p.time as any, value: p.price })),
        ]);
      } else if (aiBullishRef.current) aiBullishRef.current.setData([]);

      if (baseScenario && aiBaseRef.current) {
        aiBaseRef.current.setData([
          { time: lastCandle.time as any, value: lastCandle.close },
          ...baseScenario.path.map(p => ({ time: p.time as any, value: p.price })),
        ]);
      } else if (aiBaseRef.current) aiBaseRef.current.setData([]);

      if (bearScenario && aiBearishRef.current) {
        aiBearishRef.current.setData([
          { time: lastCandle.time as any, value: lastCandle.close },
          ...bearScenario.path.map(p => ({ time: p.time as any, value: p.price })),
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
          ...aiPrediction.upperConfidenceBound.map(p => ({ time: p.time as any, value: p.price })),
        ]);
        mcLowerRef.current.setData([
          { time: lastCandle.time as any, value: lastCandle.close },
          ...aiPrediction.lowerConfidenceBound.map(p => ({ time: p.time as any, value: p.price })),
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

  return (
    <div className="w-full h-full relative bg-[#090d15]">
      <div ref={chartContainerRef} className="w-full h-full min-h-[300px]" />
    </div>
  );
};
