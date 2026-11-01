import React, { useMemo, useState } from 'react';
import { KronosModelKey, MarketSymbol } from '../../types';
import { rankUniverseWithKronosAlpha } from '../../services/ai/kronosClient';
import { computeSectorRotation } from '../../services/analysis/intermarketCorrelation';
import {
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  X,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  Award,
  Layers,
} from 'lucide-react';
import { formatPercent, formatPrice, formatVolume } from '../../utils/formatters';

interface MarketHeatmapProps {
  symbols: MarketSymbol[];
  onSelectSymbol: (symbol: MarketSymbol) => void;
  onClose: () => void;
  kronosModelKey?: KronosModelKey;
}

export const MarketHeatmap: React.FC<MarketHeatmapProps> = ({
  symbols,
  onSelectSymbol,
  onClose,
  kronosModelKey = 'kronos-small',
}) => {
  const [filterType, setFilterType] = useState<'all' | 'commodity' | 'crypto' | 'vn30' | 'stock'>('all');
  const [heatmapMode, setHeatmapMode] = useState<'kronos_alpha' | '24h' | 'sector_rotation'>('kronos_alpha');

  const sectorList = useMemo(() => computeSectorRotation(symbols), [symbols]);

  const filtered = useMemo(() => {
    return symbols.filter(s => {
      if (filterType === 'all') return true;
      if (filterType === 'commodity') {
        return (
          s.type === 'commodity' ||
          s.symbol.includes('XAU') ||
          s.symbol.includes('OIL') ||
          s.symbol.includes('PAXG')
        );
      }
      if (filterType === 'crypto') return s.type === 'crypto';
      if (filterType === 'vn30') return s.type === 'vn30' || s.symbol === 'VNINDEX';
      if (filterType === 'stock') return s.type === 'stock' || s.type === 'index';
      return true;
    });
  }, [symbols, filterType]);

  // Run Qlib Cross-Sectional Top-K Alpha Ranking across filtered universe
  const alphaList = useMemo(() => {
    return rankUniverseWithKronosAlpha(filtered, kronosModelKey);
  }, [filtered, kronosModelKey]);

  const alphaMap = useMemo(() => {
    const map = new Map(alphaList.map(item => [item.symbol, item]));
    return map;
  }, [alphaList]);

  const topLongPicks = useMemo(() => {
    return [...alphaList]
      .filter(a => a.expectedReturn24Bar > 0)
      .sort((a, b) => b.alphaScore - a.alphaScore)
      .slice(0, 3);
  }, [alphaList]);

  const topShortPicks = useMemo(() => {
    return [...alphaList]
      .filter(a => a.expectedReturn24Bar < 0)
      .sort((a, b) => a.alphaScore - b.alphaScore)
      .slice(0, 3);
  }, [alphaList]);

  const displaySymbols = useMemo(() => {
    if (heatmapMode === '24h') return filtered;
    return [...filtered].sort((a, b) => {
      const scoreA = alphaMap.get(a.symbol)?.alphaScore ?? 0;
      const scoreB = alphaMap.get(b.symbol)?.alphaScore ?? 0;
      return scoreB - scoreA;
    });
  }, [filtered, heatmapMode, alphaMap]);

  const getHeatmapColor = (metric: number, isKronosMode: boolean) => {
    const highThresh = isKronosMode ? 3.2 : 5;
    const midThresh = isKronosMode ? 1.2 : 2;

    if (metric >= highThresh) return 'bg-emerald-600/90 border-emerald-400 text-white';
    if (metric >= midThresh) return 'bg-emerald-700/80 border-emerald-500 text-emerald-100';
    if (metric > 0.05) return 'bg-emerald-900/60 border-emerald-600/40 text-emerald-200';
    if (metric >= -0.05) return 'bg-gray-800 border-gray-700 text-gray-300';
    if (metric >= -midThresh) return 'bg-rose-900/60 border-rose-600/40 text-rose-200';
    if (metric >= -highThresh) return 'bg-rose-700/80 border-rose-500 text-rose-100';
    return 'bg-rose-600/90 border-rose-400 text-white';
  };

  const handlePickAlphaSymbol = (symCode: string) => {
    const target = symbols.find(s => s.symbol === symCode);
    if (target) onSelectSymbol(target);
  };

  return (
    <div className="flex-1 h-full bg-[#090d15] p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 select-none overflow-y-auto pb-28 md:pb-12">
      {/* Top Header, Mode Toggle & Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 pb-2.5 border-b border-[#1b2536]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className={`p-1.5 sm:p-2 rounded-xl border shrink-0 ${
                heatmapMode === 'kronos_alpha'
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}
            >
              {heatmapMode === 'kronos_alpha' ? (
                <BrainCircuit className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>
                  {heatmapMode === 'kronos_alpha'
                    ? 'Bản Đồ Nhiệt Dự Báo AI Kronos'
                    : 'Bản Đồ Nhiệt Thị Trường'}
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono">
                  Qlib Top-K Alpha
                </span>
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-400">
                {heatmapMode === 'kronos_alpha'
                  ? `Xếp hạng kỳ vọng sinh lời 24 nến tới theo BSQuantizer (${filtered.length} mã)`
                  : `Biến động giá thực tế 24h & thanh khoản dòng tiền (${filtered.length} mã)`}
              </p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg bg-[#141b27] hover:bg-[#1f293b] border border-[#232f44] text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher + Filter Tabs + Desktop Close */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#101723] p-1 rounded-xl border border-cyan-500/30 text-xs shrink-0">
            <button
              onClick={() => setHeatmapMode('kronos_alpha')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition text-[11px] ${
                heatmapMode === 'kronos_alpha'
                  ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>Dự Báo Kronos 24 Nến</span>
            </button>
            <button
              onClick={() => setHeatmapMode('24h')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition text-[11px] ${
                heatmapMode === '24h'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Biến Động 24h</span>
            </button>
            <button
              onClick={() => setHeatmapMode('sector_rotation')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition text-[11px] ${
                heatmapMode === 'sector_rotation'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Dòng Tiền Ngành</span>
            </button>
          </div>

          {/* Asset Category Tabs */}
          <div className="flex items-center gap-1 bg-[#141b27] p-1 rounded-xl border border-[#232f44] text-xs overflow-x-auto no-scrollbar whitespace-nowrap flex-1 sm:flex-initial">
            {(['all', 'commodity', 'crypto', 'vn30', 'stock'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                className={`px-2.5 py-1 rounded-lg font-medium transition text-center shrink-0 text-[11px] sm:text-xs ${
                  filterType === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'all'
                  ? 'Tất cả'
                  : tab === 'commodity'
                  ? '🥇 Vàng & Dầu'
                  : tab === 'crypto'
                  ? '🪙 Top Coin'
                  : tab === 'vn30'
                  ? '🇻🇳 VN30'
                  : '🇺🇸 Mỹ'}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="hidden lg:block p-1.5 rounded-lg bg-[#141b27] hover:bg-[#1f293b] border border-[#232f44] text-gray-400 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Qlib Top-K Long & Short Alpha Portfolio Strip */}
      {(topLongPicks.length > 0 || topShortPicks.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* Top-3 Long Alpha */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                <span>Danh Mục Top-3 Long Alpha (Kỳ Vọng Tăng Tốt Nhất)</span>
              </span>
              <span className="font-mono text-[10px] text-emerald-400/80">Kronos Qlib IC</span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono">
              {topLongPicks.map((pick, idx) => {
                const isVND = pick.quoteAsset === 'VND';
                return (
                  <div
                    key={pick.symbol}
                    onClick={() => handlePickAlphaSymbol(pick.symbol)}
                    className="p-2 rounded-lg bg-[#0d1520] border border-emerald-500/30 hover:border-emerald-400 cursor-pointer transition flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-white">
                        #{idx + 1} {pick.symbol}
                      </span>
                      <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        {pick.bullProbability}%T
                      </span>
                    </div>
                    <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />
                      <span>+{pick.expectedReturn24Bar}%</span>
                    </div>
                    <div className="text-[9px] text-gray-400 truncate mt-0.5">
                      Đích: {isVND ? `${formatPrice(pick.targetPriceP50)}k` : `$${formatPrice(pick.targetPriceP50)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top-3 Short / Hedge Alpha */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-rose-950/25 border border-rose-500/30 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                <span>Cảnh Báo Top-3 Áp Lực Điều Chỉnh / Short Hedge</span>
              </span>
              <span className="font-mono text-[10px] text-rose-400/80">Phòng Hộ Rủi Ro</span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono">
              {topShortPicks.length > 0 ? (
                topShortPicks.map((pick, idx) => {
                  const isVND = pick.quoteAsset === 'VND';
                  return (
                    <div
                      key={pick.symbol}
                      onClick={() => handlePickAlphaSymbol(pick.symbol)}
                      className="p-2 rounded-lg bg-[#160f18] border border-rose-500/30 hover:border-rose-400 cursor-pointer transition flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-white">
                          #{idx + 1} {pick.symbol}
                        </span>
                        <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300 font-bold">
                          {100 - pick.bullProbability}%G
                        </span>
                      </div>
                      <div className="text-xs font-bold text-rose-400 mt-1 flex items-center gap-0.5">
                        <TrendingDown className="w-3 h-3" />
                        <span>{pick.expectedReturn24Bar}%</span>
                      </div>
                      <div className="text-[9px] text-gray-400 truncate mt-0.5">
                        Đích: {isVND ? `${formatPrice(pick.targetPriceP50)}k` : `$${formatPrice(pick.targetPriceP50)}`}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-3 p-2 rounded-lg bg-[#121824] text-[11px] text-gray-400 text-center">
                  Toàn bộ rổ tài sản đang nghiêng về xu hướng tích lũy / tăng trưởng dương.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sector Rotation Relative Strength View */}
      {heatmapMode === 'sector_rotation' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sectorList.map(sec => {
            const phaseColor =
              sec.phase === 'LEADING'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
                : sec.phase === 'IMPROVING'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/45'
                : sec.phase === 'WEAKENING'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/45';

            return (
              <div
                key={sec.sectorId}
                className="p-3.5 rounded-xl bg-[#0d1422] border border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs sm:text-sm font-extrabold text-white">
                      {sec.sectorName}
                    </div>
                    <div className="text-[10.5px] font-mono text-slate-400 mt-0.5">
                      Độ rộng: <span className="text-emerald-400">{sec.advancers}▲</span> /{' '}
                      <span className="text-rose-400">{sec.decliners}▼</span> ({sec.breadthPct}% mã tăng) • TB:{' '}
                      <span className={sec.volumeWeightedChange24h >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {sec.volumeWeightedChange24h >= 0 ? '+' : ''}
                        {sec.volumeWeightedChange24h}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${phaseColor}`}>
                      {sec.phaseLabel} (RS {sec.relativeStrengthScore >= 0 ? `+${sec.relativeStrengthScore}` : sec.relativeStrengthScore})
                    </span>
                  </div>
                </div>

                {/* Sector Breadth Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-rose-500/30 overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${sec.breadthPct}%` }}
                  />
                </div>

                {/* Clickable Member Chips */}
                <div className="flex flex-wrap gap-1.5 pt-0.5 font-mono text-[10.5px]">
                  {sec.members.map(m => (
                    <button
                      key={m.symbol}
                      onClick={() => onSelectSymbol(m)}
                      className={`px-2 py-0.5 rounded-lg border transition flex items-center gap-1 ${
                        m.change24h > 0
                          ? 'bg-emerald-950/40 border-emerald-500/35 text-emerald-200 hover:border-emerald-400'
                          : m.change24h < 0
                          ? 'bg-rose-950/40 border-rose-500/35 text-rose-200 hover:border-rose-400'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300'
                      }`}
                    >
                      <span className="font-bold">{m.symbol}</span>
                      <span>
                        {m.change24h >= 0 ? '+' : ''}
                        {m.change24h.toFixed(2)}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Heatmap Grid */}
      {heatmapMode !== 'sector_rotation' && (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
        {displaySymbols.map(s => {
          const isVND = s.quoteAsset === 'VND';
          const alpha = alphaMap.get(s.symbol);
          const isKronos = heatmapMode === 'kronos_alpha';
          const primaryMetric = isKronos ? alpha?.expectedReturn24Bar ?? s.change24h : s.change24h;
          const isPositive = primaryMetric >= 0;
          const isCommodity =
            s.type === 'commodity' ||
            s.symbol.includes('XAU') ||
            s.symbol.includes('OIL') ||
            s.symbol.includes('PAXG');

          return (
            <div
              key={s.symbol}
              onClick={() => onSelectSymbol(s)}
              className={`p-2.5 sm:p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition transform active:scale-95 sm:hover:scale-[1.02] shadow-lg min-h-[116px] sm:min-h-[130px] ${getHeatmapColor(
                primaryMetric,
                isKronos
              )}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs sm:text-sm tracking-tight">{s.symbol}</span>
                {isKronos && alpha ? (
                  <span className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-black/30 text-cyan-200 border border-white/10">
                    Alpha {alpha.alphaScore >= 0 ? `+${alpha.alphaScore}` : alpha.alphaScore}
                  </span>
                ) : (
                  <span
                    className={`text-[8px] sm:text-[9px] px-1 rounded uppercase font-semibold ${
                      isCommodity ? 'bg-amber-400/20 text-amber-200' : 'opacity-75'
                    }`}
                  >
                    {isCommodity ? 'HÀNG HÓA' : s.type}
                  </span>
                )}
              </div>

              <div className="my-1 sm:my-1.5">
                <div className="text-sm sm:text-base font-mono font-extrabold truncate">
                  {isVND ? `${formatPrice(s.price)}k` : `$${formatPrice(s.price)}`}
                </div>
                {isKronos && alpha ? (
                  <div className="text-[9px] sm:text-[10px] font-mono opacity-90 truncate">
                    P50: {isVND ? `${formatPrice(alpha.targetPriceP50)}k` : `$${formatPrice(alpha.targetPriceP50)}`} ({alpha.bullProbability}%T)
                  </div>
                ) : (
                  <div className="text-[10px] sm:text-[11px] opacity-80 truncate">{s.name}</div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] sm:text-xs font-mono font-bold">
                <span className="flex items-center gap-0.5">
                  {isPositive ? (
                    <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  )}
                  {isKronos ? 'AI ' : ''}
                  {formatPercent(primaryMetric)}
                </span>
                <span className="text-[9px] sm:text-[10px] opacity-80">
                  {isKronos ? `24h: ${formatPercent(s.change24h)}` : formatVolume(s.volume24h)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
