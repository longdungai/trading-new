import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Clock,
  Compass,
  Scale,
  Users,
} from 'lucide-react';
import { Candle, MarketSymbol } from '../../types';
import {
  computeVn30BasisAnalytics,
  computeVnIntradaySessionPulse,
  computeVnPriceLimits,
  getVnStockSectorInfo,
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
} from '../../services/vnMarket/vnStockMicrostructure';
import {
  fetchVnStockInsights,
  VnStockInsightsPayload,
} from '../../services/vnMarket/vnStockInsightsClient';
import { formatPrice } from '../../utils/formatters';

interface VnStockQuickCardProps {
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
  candles: Candle[];
  onSelectSymbol: (sym: MarketSymbol) => void;
  onOpenVnMacroTab: () => void;
}

export const VnStockQuickCard: React.FC<VnStockQuickCardProps> = ({
  currentSymbol,
  symbols,
  candles,
  onSelectSymbol,
  onOpenVnMacroTab,
}) => {
  const isVN = isVnStockOrIndexSymbol(currentSymbol);
  const symUpper = currentSymbol.symbol.toUpperCase();
  const isIndex = symUpper === 'VNINDEX' || symUpper === 'VN30';
  const isDeriv = isVnDerivativeSymbol(symUpper);
  const isCorporate = isVN && !isIndex && !isDeriv;

  const [insights, setInsights] = useState<VnStockInsightsPayload | null>(null);
  const [nowClock, setNowClock] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNowClock(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    if (!isCorporate) {
      setInsights(null);
      return;
    }
    void fetchVnStockInsights(symUpper, false).then((res) => {
      if (active) setInsights(res);
    });
    return () => {
      active = false;
    };
  }, [symUpper, isCorporate]);

  const priceLimits = useMemo(() => {
    if (!isVN) return null;
    return computeVnPriceLimits({
      symbol: symUpper,
      currentPrice: currentSymbol.price,
      change24hPct: currentSymbol.change24h,
      officialRefPrice: insights?.fundamentals?.officialRefPrice,
      officialCeilingPrice: insights?.fundamentals?.officialCeilingPrice,
      officialFloorPrice: insights?.fundamentals?.officialFloorPrice,
    });
  }, [
    isVN,
    symUpper,
    currentSymbol.price,
    currentSymbol.change24h,
    insights?.fundamentals?.officialRefPrice,
    insights?.fundamentals?.officialCeilingPrice,
    insights?.fundamentals?.officialFloorPrice,
  ]);

  const sessionPulse = useMemo(
    () => computeVnIntradaySessionPulse(candles, nowClock),
    [candles, nowClock]
  );

  const basisData = useMemo(
    () =>
      symUpper === 'VN30F1M' || symUpper === 'VN30' || symUpper === 'VNINDEX'
        ? computeVn30BasisAnalytics(symbols, nowClock)
        : null,
    [symUpper, symbols, nowClock]
  );

  const sectorInfo = useMemo(() => getVnStockSectorInfo(symUpper), [symUpper]);

  if (!isVN || !priceLimits) return null;

  const unitSuffix = isIndex || isDeriv ? ' đ' : 'k';
  const liveColorClass =
    priceLimits.colorState === 'CEILING'
      ? 'text-fuchsia-400'
      : priceLimits.colorState === 'FLOOR'
      ? 'text-cyan-300'
      : priceLimits.colorState === 'UP'
      ? 'text-emerald-400'
      : priceLimits.colorState === 'DOWN'
      ? 'text-rose-400'
      : 'text-amber-300';

  const foreign = insights?.foreignFlow ?? null;
  const fund = insights?.fundamentals ?? null;

  return (
    <div className="p-3 sm:p-3.5 rounded-xl bg-[#0e1523] border border-rose-500/30 space-y-2.5 shadow-xl select-none min-w-0">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[10px] font-mono font-extrabold text-rose-200 shrink-0 whitespace-nowrap">
              🇻🇳 {priceLimits.board === 'HNX_DERIVATIVE' ? 'HNX PHÁI SINH' : priceLimits.board}
              {priceLimits.bandPct > 0 ? ` ±${priceLimits.bandPct}%` : ''}
            </span>
            {sectorInfo && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/35 text-[10px] font-bold text-indigo-200 shrink-0 whitespace-nowrap">
                {sectorInfo.shortName}
              </span>
            )}
          </div>
          <div className="text-[10.5px] text-slate-400 font-mono">
            {isDeriv
              ? 'Bước giá 0.1 điểm (100k/đ) • Ký quỹ ~17% • T+0'
              : isIndex
              ? 'Chỉ số thị trường cơ sở Sở GDCK TP.HCM'
              : `Bước giá ${(priceLimits.tickSize * 1000).toFixed(0)}đ • Lô chẵn 100 CP • T+2`}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenVnMacroTab}
          className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap transition"
          title="Mở Bảng Sóng 10 Ngành Việt Nam, Top Khối Ngoại & Basis VN30F1M"
        >
          <Compass className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>Sóng Ngành & KN</span>
          <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
        </button>
      </div>

      {/* Ceiling / Reference / Match / Floor Strip (Standard SSI iBoard Color Coding) */}
      {priceLimits.ceilingPrice !== null && priceLimits.floorPrice !== null && (
        <div className="grid grid-cols-4 gap-1.5 font-mono text-center">
          <div className="p-1.5 rounded-lg bg-[#090f1b] border border-fuchsia-500/30 min-w-0">
            <div className="text-[9px] text-fuchsia-300 font-sans font-bold">Trần</div>
            <div className="text-[11px] font-black text-fuchsia-400 truncate">
              {formatPrice(priceLimits.ceilingPrice)}
              {unitSuffix}
            </div>
          </div>

          <div className="p-1.5 rounded-lg bg-[#090f1b] border border-amber-500/30 min-w-0">
            <div className="text-[9px] text-amber-200 font-sans font-bold">Tham chiếu</div>
            <div className="text-[11px] font-black text-amber-300 truncate">
              {formatPrice(priceLimits.refPrice)}
              {unitSuffix}
            </div>
          </div>

          <div className="p-1.5 rounded-lg bg-[#090f1b] border border-slate-700 min-w-0">
            <div className="text-[9px] text-slate-400 font-sans font-bold">Khớp lệnh</div>
            <div className={`text-[11px] font-black truncate ${liveColorClass}`}>
              {formatPrice(priceLimits.currentPrice)}
              {unitSuffix}
            </div>
          </div>

          <div className="p-1.5 rounded-lg bg-[#090f1b] border border-cyan-500/30 min-w-0">
            <div className="text-[9px] text-cyan-200 font-sans font-bold">Sàn</div>
            <div className="text-[11px] font-black text-cyan-300 truncate">
              {formatPrice(priceLimits.floorPrice)}
              {unitSuffix}
            </div>
          </div>
        </div>
      )}

      {/* Floor-lock / Ceiling Warning */}
      {priceLimits.liquidityWarning && (
        <div className="p-2 rounded-lg bg-rose-950/35 border border-rose-500/45 text-[10.5px] text-rose-200 flex items-start gap-1.5 leading-relaxed break-words">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          <span className="min-w-0 flex-1">{priceLimits.liquidityWarning}</span>
        </div>
      )}

      {/* VN30F1M / VN30 Basis Quick Box */}
      {basisData && (
        <div className="p-2.5 rounded-lg bg-[#090f1b] border border-cyan-500/30 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10.5px] font-bold text-cyan-300 flex items-center gap-1">
              <Scale className="w-3 h-3 shrink-0" />
              <span>Basis VN30F1M − VN30:</span>
            </span>
            <span
              className={`font-mono text-xs font-black shrink-0 whitespace-nowrap ${
                basisData.basisPoints >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {basisData.basisPoints >= 0 ? '+' : ''}
              {basisData.basisPoints} đ ({basisData.basisPct >= 0 ? '+' : ''}
              {basisData.basisPct}%)
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 flex-wrap">
            <span>Đáo hạn: {basisData.expiryDateISO} ({basisData.daysToExpiry} ngày)</span>
            {symUpper !== 'VN30F1M' ? (
              <button
                type="button"
                onClick={() => {
                  const f = symbols.find((s) => s.symbol === 'VN30F1M');
                  if (f) onSelectSymbol(f);
                }}
                className="text-cyan-300 hover:underline font-mono font-bold"
              >
                Mở VN30F1M →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const s = symbols.find((x) => x.symbol === 'VN30');
                  if (s) onSelectSymbol(s);
                }}
                className="text-cyan-300 hover:underline font-mono font-bold"
              >
                So với VN30 →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Time-Normalized Intraday RVOL & T+2 Clock */}
      <div className="p-2 rounded-lg bg-[#090f1b] border border-slate-800 space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap text-[10.5px]">
          <span className="text-slate-300 font-semibold flex items-center gap-1 min-w-0">
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">{sessionPulse.phaseLabel}</span>
          </span>
          {sessionPulse.timeNormalizedRvol !== null && (
            <span
              className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold shrink-0 whitespace-nowrap ${
                sessionPulse.rvolState === 'EXPLOSIVE'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : sessionPulse.rvolState === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                  : sessionPulse.rvolState === 'DRY'
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-cyan-500/15 text-cyan-300'
              }`}
            >
              <Activity className="w-2.5 h-2.5 inline mr-0.5" />
              RVOL {sessionPulse.timeNormalizedRvol}x
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-400 leading-snug break-words">
          {sessionPulse.t2Note}
        </div>
      </div>

      {/* Corporate Foreign Flow & Fundamentals */}
      {isCorporate && (foreign || fund) && (
        <div className="space-y-2 pt-0.5 min-w-0">
          {foreign && (
            <div className="p-2 rounded-lg bg-[#090f1b] border border-slate-800 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap text-[10.5px]">
                <span className="font-bold text-slate-200 flex items-center gap-1">
                  <Users className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Khối ngoại ({foreign.latestDate.slice(5)}):</span>
                </span>
                <span
                  className={`font-mono font-black shrink-0 whitespace-nowrap ${
                    foreign.latestNetBillionVnd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {foreign.latestNetBillionVnd >= 0 ? '+' : ''}
                  {foreign.latestNetBillionVnd} tỷ VNĐ
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400 flex-wrap">
                <span>
                  10 phiên:{' '}
                  <strong
                    className={
                      foreign.total10dNetBillionVnd >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }
                  >
                    {foreign.total10dNetBillionVnd >= 0 ? '+' : ''}
                    {foreign.total10dNetBillionVnd} tỷ
                  </strong>
                </span>
                {foreign.remainingRoomPct !== null && (
                  <span>
                    Room còn: <strong className="text-amber-300">{foreign.remainingRoomPct}%</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {fund && (
            <div className="grid grid-cols-4 gap-1.5 font-mono text-center">
              <div className="p-1.5 rounded-lg bg-[#090f1b] border border-slate-800 min-w-0">
                <div className="text-[8.5px] text-slate-400 font-sans">P/E</div>
                <div className="text-[11px] font-bold text-cyan-300 truncate">
                  {fund.peRatio !== null ? `${fund.peRatio}x` : '—'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#090f1b] border border-slate-800 min-w-0">
                <div className="text-[8.5px] text-slate-400 font-sans">P/B</div>
                <div className="text-[11px] font-bold text-sky-300 truncate">
                  {fund.pbRatio !== null ? `${fund.pbRatio}x` : '—'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#090f1b] border border-slate-800 min-w-0">
                <div className="text-[8.5px] text-slate-400 font-sans">ROE</div>
                <div className="text-[11px] font-bold text-emerald-400 truncate">
                  {fund.roePct !== null ? `${fund.roePct}%` : '—'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#090f1b] border border-slate-800 min-w-0">
                <div className="text-[8.5px] text-slate-400 font-sans flex items-center justify-center gap-0.5">
                  <Building2 className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span>Vốn hóa</span>
                </div>
                <div className="text-[10.5px] font-bold text-amber-300 truncate">
                  {fund.marketCapTrillionVnd !== null ? `${fund.marketCapTrillionVnd}k tỷ` : '—'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
