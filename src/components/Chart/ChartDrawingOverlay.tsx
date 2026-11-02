import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import {
  Bell,
  Camera,
  MousePointer,
  Minus,
  TrendingUp,
  Square,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  Pencil,
  X,
} from 'lucide-react';
import { AIPrediction, Candle, Timeframe } from '../../types';
import { formatPrice } from '../../utils/formatters';

export type DrawingToolType =
  | 'CURSOR'
  | 'HLINE'
  | 'TRENDLINE'
  | 'ZONE'
  | 'RR_LONG'
  | 'RR_SHORT';

export interface ChartDrawingItem {
  id: string;
  symbol: string;
  type: Exclude<DrawingToolType, 'CURSOR'>;
  t1: number;
  p1: number;
  t2?: number;
  p2?: number;
  tpPrice?: number;
  slPrice?: number;
}

const DRAWINGS_STORAGE_KEY = 'trading_new_chart_drawings_v1';

function loadDrawingsForSymbol(symbol: string): ChartDrawingItem[] {
  if (typeof window === 'undefined' || !symbol) return [];
  try {
    const raw = window.localStorage.getItem(DRAWINGS_STORAGE_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, ChartDrawingItem[]>;
    const list = map?.[symbol.toUpperCase()];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveDrawingsForSymbol(symbol: string, items: ChartDrawingItem[]): void {
  if (typeof window === 'undefined' || !symbol) return;
  try {
    const raw = window.localStorage.getItem(DRAWINGS_STORAGE_KEY);
    const map: Record<string, ChartDrawingItem[]> = raw ? JSON.parse(raw) : {};
    map[symbol.toUpperCase()] = items.slice(-40);
    window.localStorage.setItem(DRAWINGS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

interface ChartDrawingOverlayProps {
  chartRef: React.MutableRefObject<IChartApi | null>;
  candleSeriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  candles: Candle[];
  symbolName: string;
  timeframe: Timeframe;
  aiPrediction: AIPrediction | null;
  onQuickCreatePriceAlert?: (price: number) => void;
}

export const ChartDrawingOverlay: React.FC<ChartDrawingOverlayProps> = ({
  chartRef,
  candleSeriesRef,
  candles,
  symbolName,
  timeframe,
  aiPrediction,
  onQuickCreatePriceAlert,
}) => {
  const [activeTool, setActiveTool] = useState<DrawingToolType>('CURSOR');
  const [isMobileRailOpen, setIsMobileRailOpen] = useState<boolean>(false);
  const [drawings, setDrawings] = useState<ChartDrawingItem[]>(() =>
    loadDrawingsForSymbol(symbolName)
  );
  const [draftAnchor, setDraftAnchor] = useState<{ t: number; p: number } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ t: number; p: number; x: number; y: number } | null>(
    null
  );
  const [, setRenderTick] = useState<number>(0);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Reload drawings when symbol switches
  useEffect(() => {
    setDrawings(loadDrawingsForSymbol(symbolName));
    setDraftAnchor(null);
    setActiveTool('CURSOR');
  }, [symbolName]);

  // Re-project coordinates smoothly whenever chart scrolls, zooms, or candles update
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const triggerRepaint = () => {
      setRenderTick(t => (t + 1) % 100000);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(triggerRepaint);
    window.addEventListener('resize', triggerRepaint);

    return () => {
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(triggerRepaint);
      } catch {
        // chart may already be disposed
      }
      window.removeEventListener('resize', triggerRepaint);
    };
  }, [chartRef, candles.length]);

  const resolveTimeAndPrice = useCallback(
    (clientX: number, clientY: number): { t: number; p: number; x: number; y: number } | null => {
      const svg = svgRef.current;
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      if (!svg || !chart || !series || candles.length === 0) return null;

      const rect = svg.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const price = series.coordinateToPrice(y);
      if (price === null || !Number.isFinite(price) || price <= 0) return null;

      let timeNum = chart.timeScale().coordinateToTime(x) as unknown as number | null;
      if (typeof timeNum !== 'number' || !Number.isFinite(timeNum)) {
        const logical = chart.timeScale().coordinateToLogical(x);
        if (logical !== null && candles.length >= 2) {
          const step = Math.max(60, candles[candles.length - 1].time - candles[candles.length - 2].time);
          const idx = Math.round(logical);
          if (idx >= 0 && idx < candles.length) {
            timeNum = candles[idx].time;
          } else if (idx >= candles.length) {
            timeNum = candles[candles.length - 1].time + (idx - (candles.length - 1)) * step;
          } else {
            timeNum = candles[0].time + idx * step;
          }
        } else {
          timeNum = candles[candles.length - 1].time;
        }
      }

      return {
        t: timeNum,
        p: parseFloat(price.toFixed(4)),
        x,
        y,
      };
    },
    [chartRef, candleSeriesRef, candles]
  );

  const timeToX = (t: number, fallbackWidth: number): number => {
    const chart = chartRef.current;
    if (!chart) return 0;
    const coord = chart.timeScale().timeToCoordinate(t as any);
    if (coord !== null && Number.isFinite(coord)) return coord;

    if (candles.length >= 2) {
      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2];
      const step = Math.max(60, last.time - prev.time);
      const lastCoord = chart.timeScale().timeToCoordinate(last.time as any);
      const prevCoord = chart.timeScale().timeToCoordinate(prev.time as any);
      if (lastCoord !== null && prevCoord !== null) {
        const pxPerBar = Math.max(2, lastCoord - prevCoord);
        const barsAhead = (t - last.time) / step;
        return lastCoord + barsAhead * pxPerBar;
      }
    }
    return fallbackWidth * 0.75;
  };

  const priceToY = (p: number): number | null => {
    const series = candleSeriesRef.current;
    if (!series) return null;
    const y = series.priceToCoordinate(p);
    return y !== null && Number.isFinite(y) ? y : null;
  };

  const persistAndSet = (next: ChartDrawingItem[]) => {
    setDrawings(next);
    saveDrawingsForSymbol(symbolName, next);
  };

  const placeDrawingPointAt = (clientX: number, clientY: number) => {
    if (activeTool === 'CURSOR') return;
    const pt = resolveTimeAndPrice(clientX, clientY);
    if (!pt) return;

    if (activeTool === 'HLINE') {
      const item: ChartDrawingItem = {
        id: `drw_${Date.now()}`,
        symbol: symbolName,
        type: 'HLINE',
        t1: pt.t,
        p1: pt.p,
      };
      persistAndSet([...drawings, item]);
      setActiveTool('CURSOR');
      setIsMobileRailOpen(false);
      return;
    }

    if (activeTool === 'RR_LONG' || activeTool === 'RR_SHORT') {
      const stepSec =
        candles.length >= 2
          ? Math.max(60, candles[candles.length - 1].time - candles[candles.length - 2].time)
          : 3600;
      const isLong = activeTool === 'RR_LONG';
      const tpPrice = parseFloat((isLong ? pt.p * 1.03 : pt.p * 0.97).toFixed(4));
      const slPrice = parseFloat((isLong ? pt.p * 0.985 : pt.p * 1.015).toFixed(4));
      const item: ChartDrawingItem = {
        id: `drw_${Date.now()}`,
        symbol: symbolName,
        type: activeTool,
        t1: pt.t,
        p1: pt.p,
        t2: pt.t + stepSec * 12,
        tpPrice,
        slPrice,
      };
      persistAndSet([...drawings, item]);
      setActiveTool('CURSOR');
      setIsMobileRailOpen(false);
      return;
    }

    // Two-point tools: TRENDLINE & ZONE
    if (!draftAnchor) {
      setDraftAnchor({ t: pt.t, p: pt.p });
    } else {
      const item: ChartDrawingItem = {
        id: `drw_${Date.now()}`,
        symbol: symbolName,
        type: activeTool,
        t1: draftAnchor.t,
        p1: draftAnchor.p,
        t2: pt.t,
        p2: pt.p,
      };
      persistAndSet([...drawings, item]);
      setDraftAnchor(null);
      setActiveTool('CURSOR');
      setIsMobileRailOpen(false);
    }
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    placeDrawingPointAt(e.clientX, e.clientY);
  };

  const handleSvgTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (activeTool === 'CURSOR') return;
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    placeDrawingPointAt(touch.clientX, touch.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'CURSOR') return;
    const pt = resolveTimeAndPrice(e.clientX, e.clientY);
    if (pt) setHoverPoint(pt);
  };

  const handleDeleteDrawing = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    persistAndSet(drawings.filter(d => d.id !== id));
  };

  const handleClearAll = () => {
    persistAndSet([]);
    setDraftAnchor(null);
    setActiveTool('CURSOR');
  };

  const handleCaptureSnapshot = () => {
    const chart = chartRef.current;
    if (!chart) return;
    try {
      const baseCanvas = chart.takeScreenshot();
      const out = document.createElement('canvas');
      out.width = baseCanvas.width;
      out.height = baseCanvas.height + 44;
      const ctx = out.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, out.width, out.height);

      // Top institutional banner
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, out.width, 44);
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(0, 43.5);
      ctx.lineTo(out.width, 43.5);
      ctx.stroke();

      const lastClose = candles[candles.length - 1]?.close ?? 0;
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(
        `TRADING NEW PRO • ${symbolName} (${timeframe}) • Giá: ${formatPrice(lastClose)}`,
        14,
        27
      );

      if (aiPrediction) {
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 12px monospace';
        const p50Target =
          aiPrediction.medianForecast[aiPrediction.medianForecast.length - 1]?.price ??
          aiPrediction.currentPrice;
        const aiText = `Kronos P50: ${formatPrice(p50Target)} (${aiPrediction.trend})`;
        const textWidth = ctx.measureText(aiText).width;
        ctx.fillText(aiText, Math.max(380, out.width - textWidth - 16), 27);
      }

      ctx.drawImage(baseCanvas, 0, 44);

      const url = out.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `TradingNew_${symbolName}_${timeframe}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      console.warn('Snapshot export failed', err);
    }
  };

  const svgWidth = svgRef.current?.clientWidth || 900;

  return (
    <>
      {/* Mobile Compact Floating Drawing Toggle Button (< 640px) */}
      <button
        type="button"
        onClick={() => setIsMobileRailOpen(v => !v)}
        title="Bật/Tắt Thanh công cụ Vẽ kỹ thuật & Chụp ảnh biểu đồ"
        className={`sm:hidden absolute left-1.5 bottom-7 z-20 w-7 h-7 rounded-lg flex items-center justify-center border shadow-lg transition select-none ${
          isMobileRailOpen || activeTool !== 'CURSOR'
            ? 'bg-cyan-600 text-white border-cyan-400'
            : 'bg-[#090f1c]/90 backdrop-blur-md text-slate-300 border-slate-700/90'
        }`}
      >
        {isMobileRailOpen ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
        {drawings.length > 0 && !isMobileRailOpen && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-500 text-slate-950 text-[8px] font-mono font-black flex items-center justify-center">
            {drawings.length}
          </span>
        )}
      </button>

      {/* Compact Floating Left-Side Drawing Tool Rail (Collapsible on < 640px, Always visible on >= 640px) */}
      <div
        className={`${
          isMobileRailOpen ? 'flex' : 'hidden sm:flex'
        } absolute left-1.5 sm:left-2 bottom-16 sm:bottom-auto sm:top-14 z-20 flex-col gap-1 p-1 rounded-xl bg-[#090f1c]/95 backdrop-blur-md border border-slate-800/90 shadow-xl select-none`}
      >
        {(
          [
            { id: 'CURSOR', icon: MousePointer, tip: 'Con trỏ xem & kéo biểu đồ' },
            { id: 'HLINE', icon: Minus, tip: 'Kẻ đường ngang Hỗ trợ / Kháng cự (+ Đặt Chuông Giá)' },
            { id: 'TRENDLINE', icon: TrendingUp, tip: 'Kẻ đường xu hướng Trendline (chọn 2 điểm)' },
            { id: 'ZONE', icon: Square, tip: 'Vẽ hộp Vùng Cung / Cầu (chọn 2 góc)' },
            { id: 'RR_LONG', icon: ArrowUpCircle, tip: 'Thước đo Tỷ lệ Lãi/Lỗ vị thế Mua (Long R:R)' },
            { id: 'RR_SHORT', icon: ArrowDownCircle, tip: 'Thước đo Tỷ lệ Lãi/Lỗ vị thế Bán (Short R:R)' },
          ] as const
        ).map(tool => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => {
                setActiveTool(tool.id);
                setDraftAnchor(null);
              }}
              title={tool.tip}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                active
                  ? 'bg-cyan-600 text-white shadow shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          );
        })}

        <div className="h-px w-full bg-slate-800 my-0.5" />

        <button
          type="button"
          onClick={handleCaptureSnapshot}
          title="Chụp ảnh Biểu đồ PNG sắc nét kèm dự báo Kronos AI"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sky-400 hover:text-white hover:bg-sky-500/20 transition"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>

        {drawings.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            title={`Xóa toàn bộ nét vẽ của ${symbolName} (${drawings.length})`}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-400 hover:text-white hover:bg-rose-500/20 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Active Drawing Helper Pill */}
      {activeTool !== 'CURSOR' && (
        <div className="absolute bottom-7 left-10 sm:bottom-auto sm:left-auto sm:top-2 sm:right-16 z-20 px-2.5 py-1 rounded-lg bg-cyan-950/90 border border-cyan-400/50 text-[10px] sm:text-[10.5px] font-mono text-cyan-200 shadow flex items-center gap-2 pointer-events-none">
          <span>
            {draftAnchor
              ? 'Chạm điểm thứ 2 trên biểu đồ để hoàn tất'
              : activeTool === 'HLINE'
              ? 'Chạm vào mức giá cần kẻ đường ngang'
              : activeTool === 'RR_LONG' || activeTool === 'RR_SHORT'
              ? 'Chạm vào điểm Entry để đặt thước đo R:R'
              : 'Chạm điểm bắt đầu trên biểu đồ'}
          </span>
        </div>
      )}

      {/* Synchronized 60fps Vector Overlay */}
      <svg
        ref={svgRef}
        onClick={handleSvgClick}
        onTouchStart={handleSvgTouchStart}
        onMouseMove={handleMouseMove}
        className={`absolute inset-0 w-full h-full z-[12] ${
          activeTool === 'CURSOR' ? 'pointer-events-none' : 'pointer-events-auto cursor-crosshair'
        }`}
      >
        {drawings.map(d => {
          if (d.type === 'HLINE') {
            const y = priceToY(d.p1);
            if (y === null) return null;
            return (
              <g key={d.id}>
                <line
                  x1={0}
                  y1={y}
                  x2={svgWidth}
                  y2={y}
                  stroke="#22d3ee"
                  strokeWidth={1.5}
                  strokeDasharray="5,4"
                />
                <foreignObject
                  x={Math.max(48, svgWidth - 205)}
                  y={Math.max(4, y - 12)}
                  width={145}
                  height={24}
                  className="pointer-events-auto"
                >
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#081221]/95 border border-cyan-500/50 text-[10px] font-mono text-cyan-200 shadow">
                    <span className="truncate">{formatPrice(d.p1)}</span>
                    {onQuickCreatePriceAlert && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onQuickCreatePriceAlert(d.p1);
                        }}
                        title="Đặt chuông cảnh báo tại mức giá này"
                        className="px-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 flex items-center"
                      >
                        <Bell className="w-2.5 h-2.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={e => handleDeleteDrawing(d.id, e)}
                      title="Xóa đường này"
                      className="text-rose-400 hover:text-rose-200 ml-auto font-bold px-0.5"
                    >
                      ×
                    </button>
                  </div>
                </foreignObject>
              </g>
            );
          }

          if (d.type === 'TRENDLINE' && d.t2 !== undefined && d.p2 !== undefined) {
            const x1 = timeToX(d.t1, svgWidth);
            const y1 = priceToY(d.p1);
            const x2 = timeToX(d.t2, svgWidth);
            const y2 = priceToY(d.p2);
            if (y1 === null || y2 === null) return null;
            return (
              <g key={d.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth={2} />
                <circle cx={x1} cy={y1} r={3.5} fill="#fbbf24" />
                <circle cx={x2} cy={y2} r={3.5} fill="#fbbf24" />
                <foreignObject
                  x={(x1 + x2) / 2 - 12}
                  y={(y1 + y2) / 2 - 12}
                  width={24}
                  height={24}
                  className="pointer-events-auto"
                >
                  <button
                    type="button"
                    onClick={e => handleDeleteDrawing(d.id, e)}
                    title="Xóa Trendline"
                    className="w-5 h-5 rounded-full bg-slate-900/90 border border-amber-400/60 text-amber-300 hover:text-rose-300 text-[10px] font-bold flex items-center justify-center"
                  >
                    ×
                  </button>
                </foreignObject>
              </g>
            );
          }

          if (d.type === 'ZONE' && d.t2 !== undefined && d.p2 !== undefined) {
            const x1 = timeToX(d.t1, svgWidth);
            const y1 = priceToY(d.p1);
            const x2 = timeToX(d.t2, svgWidth);
            const y2 = priceToY(d.p2);
            if (y1 === null || y2 === null) return null;
            const left = Math.min(x1, x2);
            const top = Math.min(y1, y2);
            const w = Math.max(12, Math.abs(x2 - x1));
            const h = Math.max(6, Math.abs(y2 - y1));
            return (
              <g key={d.id}>
                <rect
                  x={left}
                  y={top}
                  width={w}
                  height={h}
                  fill="rgba(56, 189, 248, 0.14)"
                  stroke="rgba(56, 189, 248, 0.65)"
                  strokeWidth={1.2}
                />
                <foreignObject
                  x={left + w - 22}
                  y={top + 2}
                  width={20}
                  height={20}
                  className="pointer-events-auto"
                >
                  <button
                    type="button"
                    onClick={e => handleDeleteDrawing(d.id, e)}
                    title="Xóa vùng Cung/Cầu"
                    className="w-4 h-4 rounded bg-slate-900/90 text-sky-300 hover:text-rose-300 text-[10px] flex items-center justify-center"
                  >
                    ×
                  </button>
                </foreignObject>
              </g>
            );
          }

          if ((d.type === 'RR_LONG' || d.type === 'RR_SHORT') && d.tpPrice && d.slPrice && d.t2) {
            const x1 = timeToX(d.t1, svgWidth);
            const x2 = Math.max(x1 + 95, timeToX(d.t2, svgWidth));
            const yEntry = priceToY(d.p1);
            const yTp = priceToY(d.tpPrice);
            const ySl = priceToY(d.slPrice);
            if (yEntry === null || yTp === null || ySl === null) return null;

            const reward = Math.abs(d.tpPrice - d.p1);
            const risk = Math.max(1e-8, Math.abs(d.p1 - d.slPrice));
            const rr = (reward / risk).toFixed(2);
            const tpPct = ((reward / d.p1) * 100).toFixed(2);
            const slPct = ((risk / d.p1) * 100).toFixed(2);

            const tpTop = Math.min(yEntry, yTp);
            const tpH = Math.max(4, Math.abs(yEntry - yTp));
            const slTop = Math.min(yEntry, ySl);
            const slH = Math.max(4, Math.abs(yEntry - ySl));

            return (
              <g key={d.id}>
                <rect
                  x={x1}
                  y={tpTop}
                  width={x2 - x1}
                  height={tpH}
                  fill="rgba(16, 185, 129, 0.18)"
                  stroke="rgba(16, 185, 129, 0.7)"
                  strokeWidth={1}
                />
                <rect
                  x={x1}
                  y={slTop}
                  width={x2 - x1}
                  height={slH}
                  fill="rgba(244, 63, 94, 0.18)"
                  stroke="rgba(244, 63, 94, 0.7)"
                  strokeWidth={1}
                />
                <line x1={x1} y1={yEntry} x2={x2} y2={yEntry} stroke="#f8fafc" strokeWidth={1.5} />
                <foreignObject
                  x={x1 + 4}
                  y={Math.max(4, yEntry - 11)}
                  width={Math.max(135, x2 - x1 - 8)}
                  height={22}
                  className="pointer-events-auto"
                >
                  <div className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-[#09101d]/95 border border-slate-700 text-[9.5px] font-mono text-white shadow">
                    <span className={d.type === 'RR_LONG' ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
                      {d.type === 'RR_LONG' ? 'LONG' : 'SHORT'} R:R 1:{rr}
                    </span>
                    <span className="text-emerald-400">+{tpPct}%</span>
                    <span className="text-rose-400">-{slPct}%</span>
                    <button
                      type="button"
                      onClick={e => handleDeleteDrawing(d.id, e)}
                      className="text-slate-400 hover:text-rose-400 font-bold ml-1"
                    >
                      ×
                    </button>
                  </div>
                </foreignObject>
              </g>
            );
          }

          return null;
        })}

        {/* Live Draft Preview while placing 2nd point */}
        {draftAnchor && hoverPoint && (
          <>
            {(() => {
              const x1 = timeToX(draftAnchor.t, svgWidth);
              const y1 = priceToY(draftAnchor.p);
              if (y1 === null) return null;
              if (activeTool === 'TRENDLINE') {
                return (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={hoverPoint.x}
                    y2={hoverPoint.y}
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    strokeDasharray="4,3"
                  />
                );
              }
              if (activeTool === 'ZONE') {
                return (
                  <rect
                    x={Math.min(x1, hoverPoint.x)}
                    y={Math.min(y1, hoverPoint.y)}
                    width={Math.abs(hoverPoint.x - x1)}
                    height={Math.abs(hoverPoint.y - y1)}
                    fill="rgba(56, 189, 248, 0.12)"
                    stroke="#38bdf8"
                    strokeDasharray="4,3"
                  />
                );
              }
              return null;
            })()}
          </>
        )}
      </svg>
    </>
  );
};
