import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Coins,
  GitCompare,
  Scale,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { Candle, MacroIntelligenceSnapshot, MarketSymbol } from '../../types';
import { fetchMarketData } from '../../services/api/marketData';
import {
  computeVnGoldFxArbitrage,
  DealerGoldQuoteInput,
  GoldSpreadComparison,
  loadDealerGoldQuoteInput,
  saveDealerGoldQuoteInput,
  TROY_OZ_PER_VN_TAEL,
} from '../../services/macro/vnGoldFxArbitrage';
import {
  buildIntermarketCorrelationMatrix,
  IntermarketSeriesInput,
} from '../../services/analysis/intermarketCorrelation';

interface VnGoldFxArbitrageViewProps {
  symbols: MarketSymbol[];
  macroSnapshot: MacroIntelligenceSnapshot | null;
  onJumpToSymbol: (ticker: string) => void;
}

function renderComparisonCard(comp: GoldSpreadComparison | null, emptyTitle: string) {
  if (!comp) {
    return (
      <div className="p-3 rounded-xl bg-[#0b111e] border border-slate-800/90 text-slate-400 text-[11px] min-w-0">
        <div className="font-bold text-slate-200 mb-1 break-words">{emptyTitle}</div>
        <p className="leading-relaxed break-words">
          Nhập giá bán niêm yết tại tiệm vàng (triệu VNĐ/lượng) ở ô bên trên để hệ thống tính chính xác độ vênh thực tế so với giá thế giới quy đổi.
        </p>
      </div>
    );
  }

  const badgeStyle =
    comp.regime === 'DISCOUNT_OR_PARITY'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
      : comp.regime === 'FAIR_SPREAD'
      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/45'
      : comp.regime === 'MODERATE_PREMIUM'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
      : 'bg-rose-500/20 text-rose-300 border-rose-500/45';

  const regimeLabel =
    comp.regime === 'DISCOUNT_OR_PARITY'
      ? 'SÁT / RẺ HƠN THẾ GIỚI'
      : comp.regime === 'FAIR_SPREAD'
      ? 'ĐỘ VÊNH HỢP LÝ'
      : comp.regime === 'MODERATE_PREMIUM'
      ? 'CHÊNH LỆCH TRUNG BÌNH'
      : 'CẢNH BÁO ĐỘ VÊNH CAO';

  return (
    <div className="p-3.5 rounded-xl bg-[#0d1423] border border-slate-800 space-y-2.5 min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-white text-xs leading-snug break-words min-w-0">
          {comp.label}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border whitespace-nowrap shrink-0 ${badgeStyle}`}
        >
          {regimeLabel}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
        <div className="p-2 rounded-lg bg-[#080d17] border border-slate-800/80 min-w-0">
          <div className="text-[10px] text-slate-400 font-sans">Giá nội địa</div>
          <div className="font-extrabold text-white break-words">
            {comp.dealerSellMillion.toFixed(2)} tr
          </div>
        </div>
        <div className="p-2 rounded-lg bg-[#080d17] border border-slate-800/80 min-w-0">
          <div className="text-[10px] text-slate-400 font-sans">Chênh lệch/lượng</div>
          <div
            className={`font-extrabold break-words ${
              comp.spreadMillionPerTael > 8 ? 'text-rose-400' : 'text-amber-300'
            }`}
          >
            {comp.spreadMillionPerTael >= 0 ? '+' : ''}
            {comp.spreadMillionPerTael.toFixed(2)} tr
          </div>
        </div>
        <div className="p-2 rounded-lg bg-[#080d17] border border-slate-800/80 min-w-0">
          <div className="text-[10px] text-slate-400 font-sans">% Độ vênh</div>
          <div
            className={`font-extrabold break-words ${
              comp.spreadPct > 9.5 ? 'text-rose-400' : 'text-cyan-300'
            }`}
          >
            {comp.spreadPct >= 0 ? '+' : ''}
            {comp.spreadPct.toFixed(2)}%
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-300 leading-relaxed break-words">{comp.guidance}</p>
    </div>
  );
}

export const VnGoldFxArbitrageView: React.FC<VnGoldFxArbitrageViewProps> = ({
  symbols,
  macroSnapshot,
  onJumpToSymbol,
}) => {
  const [dealerInput, setDealerInput] = useState<DealerGoldQuoteInput>(() =>
    loadDealerGoldQuoteInput()
  );

  const [sjcText, setSjcText] = useState<string>(() =>
    dealerInput.sjcSellMillion ? String(dealerInput.sjcSellMillion) : ''
  );
  const [ringText, setRingText] = useState<string>(() =>
    dealerInput.ring9999SellMillion ? String(dealerInput.ring9999SellMillion) : ''
  );
  const [fxText, setFxText] = useState<string>(() =>
    dealerInput.customUsdVndFreeMarket ? String(dealerInput.customUsdVndFreeMarket) : ''
  );

  const updateDealerInputs = (nextSjc: string, nextRing: string, nextFx: string) => {
    const sjcNum = parseFloat(nextSjc);
    const ringNum = parseFloat(nextRing);
    const fxNum = parseFloat(nextFx);
    const nextObj: DealerGoldQuoteInput = {
      sjcSellMillion: Number.isFinite(sjcNum) && sjcNum > 0 ? sjcNum : null,
      ring9999SellMillion: Number.isFinite(ringNum) && ringNum > 0 ? ringNum : null,
      customUsdVndFreeMarket: Number.isFinite(fxNum) && fxNum > 15000 ? fxNum : null,
      updatedAtMs: Date.now(),
    };
    setDealerInput(nextObj);
    saveDealerGoldQuoteInput(nextObj);
  };

  const arb = useMemo(
    () =>
      computeVnGoldFxArbitrage({
        symbols,
        macroSnapshot,
        dealerInput,
      }),
    [symbols, macroSnapshot, dealerInput]
  );

  if (!arb) {
    return (
      <div className="p-6 text-center rounded-xl bg-[#0c121e] border border-slate-800 text-slate-400 text-xs">
        Đang đồng bộ báo giá thực tế XAUUSD và tỷ giá USD/VND từ thị trường liên ngân hàng...
      </div>
    );
  }

  const fxBadge =
    arb.fxPressureRegime === 'HIGH_OUTFLOW_RISK'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/45'
      : arb.fxPressureRegime === 'ELEVATED_FX_PRESSURE'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
      : arb.fxPressureRegime === 'FAVORABLE_INFLOW'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/45';

  return (
    <div className="space-y-4 text-xs overflow-x-hidden">
      {/* World Gold Converted to VND Live Parity */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-950/25 via-[#0d1424] to-[#0a101d] border border-amber-500/35 space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-extrabold text-amber-200 uppercase tracking-wider text-xs leading-snug break-words">
              Giá Vàng Thế Giới Quy Đổi Chuẩn Việt Nam (Thời Gian Thực)
            </span>
          </div>
          <button
            type="button"
            onClick={() => onJumpToSymbol('XAUUSD')}
            className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-200 font-mono text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition"
          >
            <span>Biểu đồ XAUUSD</span>
            <ArrowUpRight className="w-3 h-3 shrink-0" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 font-mono">
          <div className="p-2.5 rounded-xl bg-[#080d17]/90 border border-slate-800 min-w-0">
            <div className="text-[10px] text-slate-400 font-sans break-words">
              Vàng Quốc tế ({arb.spotGoldSource})
            </div>
            <div className="text-sm sm:text-base font-black text-white mt-0.5 break-words">
              $
              {arb.spotGoldUsdOz.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              /oz
            </div>
            <div
              className={`text-[10px] font-bold ${
                arb.spotGoldChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {arb.spotGoldChange24h >= 0 ? '+' : ''}
              {arb.spotGoldChange24h}% (24h)
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#080d17]/90 border border-slate-800 min-w-0">
            <div className="text-[10px] text-slate-400 font-sans break-words">
              Tỷ giá áp dụng ({arb.isCustomUsdVnd ? 'Tự chọn' : 'Liên NH'})
            </div>
            <div className="text-sm sm:text-base font-black text-cyan-300 mt-0.5 break-words">
              {arb.effectiveUsdVnd.toLocaleString('en-US', { maximumFractionDigits: 0 })} ₫
            </div>
            <div className="text-[10px] text-slate-400 font-sans break-words">
              1 lượng = {TROY_OZ_PER_VN_TAEL.toFixed(5)} oz
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#080d17]/90 border border-amber-500/30 min-w-0">
            <div className="text-[10px] text-amber-300/90 font-sans font-semibold break-words">
              Quy đổi gốc (Chưa phí)
            </div>
            <div className="text-sm sm:text-base font-black text-amber-300 mt-0.5 break-words">
              {arb.worldRawMillionPerTael.toFixed(2)} tr/lượng
            </div>
            <div className="text-[10px] text-slate-400 break-words">
              ~ {arb.worldRawMillionPerMace.toFixed(3)} tr/chỉ
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/50 min-w-0">
            <div className="text-[10px] text-amber-200 font-sans font-bold break-words">
              Giá nhập khẩu CIF (+1.05%)
            </div>
            <div className="text-sm sm:text-base font-black text-white mt-0.5 break-words">
              {arb.worldCifParityMillionPerTael.toFixed(2)} tr/lượng
            </div>
            <div className="text-[10px] text-amber-200/90 break-words">
              ~ {arb.worldCifParityMillionPerMace.toFixed(3)} tr/chỉ
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Domestic Dealer Spread Calculator (Zero Fabricated SJC Quotes) */}
      <div className="p-3.5 rounded-xl bg-[#0c1322] border border-slate-800 space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-bold text-white flex items-center gap-1.5 min-w-0">
            <Scale className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="leading-snug break-words">
              Máy Tính Độ Vênh Vàng Miếng SJC & Vàng Nhẫn 9999 Nội Địa
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono break-words">
            Đối chiếu trực tiếp với chuẩn CIF {arb.worldCifParityMillionPerTael.toFixed(2)} tr/lượng
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="min-w-0">
            <label className="block text-[10px] text-slate-400 mb-1 leading-snug break-words">
              Giá bán Vàng miếng SJC (triệu/lượng)
            </label>
            <input
              type="number"
              step="0.05"
              placeholder={`VD: ${(arb.worldCifParityMillionPerTael + 5).toFixed(1)}`}
              value={sjcText}
              onChange={e => {
                setSjcText(e.target.value);
                updateDealerInputs(e.target.value, ringText, fxText);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#070b13] border border-slate-700 text-white font-mono text-xs focus:border-amber-400 outline-none"
            />
          </div>

          <div className="min-w-0">
            <label className="block text-[10px] text-slate-400 mb-1 leading-snug break-words">
              Giá bán Vàng Nhẫn 9999 (triệu/lượng)
            </label>
            <input
              type="number"
              step="0.05"
              placeholder={`VD: ${(arb.worldCifParityMillionPerTael + 2).toFixed(1)}`}
              value={ringText}
              onChange={e => {
                setRingText(e.target.value);
                updateDealerInputs(sjcText, e.target.value, fxText);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#070b13] border border-slate-700 text-white font-mono text-xs focus:border-amber-400 outline-none"
            />
          </div>

          <div className="min-w-0">
            <label className="block text-[10px] text-slate-400 mb-1 leading-snug break-words">
              Tỷ giá USD/VND quy đổi riêng (Tùy chọn)
            </label>
            <input
              type="number"
              step="10"
              placeholder={`Mặc định Liên NH: ${Math.round(arb.officialUsdVnd)}`}
              value={fxText}
              onChange={e => {
                setFxText(e.target.value);
                updateDealerInputs(sjcText, ringText, e.target.value);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#070b13] border border-slate-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {renderComparisonCard(arb.sjcComparison, 'Vàng miếng SJC')}
          {renderComparisonCard(arb.ring9999Comparison, 'Vàng Nhẫn Tròn Trơn 9999')}
        </div>
      </div>

      {/* Vietnam FX & Foreign Institutional Flow Pressure Meter */}
      <div className="p-3.5 rounded-xl bg-[#0c1322] border border-slate-800 space-y-2.5 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-bold text-white flex items-center gap-1.5 min-w-0">
            <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="leading-snug break-words">
              Thước Đo Áp Lực Tỷ Giá USD/VND & Dòng Vốn Khối Ngoại (VN-Index)
            </span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border whitespace-nowrap shrink-0 ${fxBadge}`}
          >
            Điểm Áp lực: {arb.fxPressureScore}/100
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              arb.fxPressureScore >= 72
                ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                : arb.fxPressureScore >= 56
                ? 'bg-gradient-to-r from-cyan-500 to-amber-400'
                : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
            }`}
            style={{ width: `${arb.fxPressureScore}%` }}
          />
        </div>

        <div className="font-bold text-slate-100 leading-snug break-words">
          {arb.fxPressureHeadline}
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed break-words">
          {arb.fxPressureGuidance}
        </p>

        <div className="flex flex-wrap gap-1.5 pt-1 font-mono text-[10.5px]">
          {['VNINDEX', 'VCB', 'FPT', 'SSI', 'HPG'].map(tk => (
            <button
              key={tk}
              type="button"
              onClick={() => onJumpToSymbol(tk)}
              className="px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-cyan-300 flex items-center gap-1 whitespace-nowrap transition"
            >
              <span>{tk}</span>
              <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface IntermarketCorrelationViewProps {
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
  onJumpToSymbol: (ticker: string) => void;
}

const BENCHMARK_CORR_TICKERS = ['BTCUSDT', 'XAUUSD', 'OIL_WTI', 'VNINDEX', 'FPT', 'NVDA'];

export const IntermarketCorrelationView: React.FC<IntermarketCorrelationViewProps> = ({
  currentSymbol,
  symbols,
  onJumpToSymbol,
}) => {
  const [seriesInputs, setSeriesInputs] = useState<IntermarketSeriesInput[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const targetKeys = useMemo(() => {
    const set = new Set<string>([currentSymbol.symbol.toUpperCase(), ...BENCHMARK_CORR_TICKERS]);
    return Array.from(set).slice(0, 7);
  }, [currentSymbol.symbol]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const targets: MarketSymbol[] = [];
    for (const k of targetKeys) {
      const found = symbols.find(s => s.symbol.toUpperCase() === k);
      if (found) targets.push(found);
    }

    void Promise.allSettled(targets.map(sym => fetchMarketData(sym, '1D'))).then(results => {
      if (!active) return;
      const loaded: IntermarketSeriesInput[] = [];
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length >= 15) {
          loaded.push({
            symbol: targets[idx].symbol,
            label: targets[idx].name,
            candles: res.value as Candle[],
          });
        }
      });
      setSeriesInputs(loaded);
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [targetKeys, symbols]);

  const corrData = useMemo(
    () => buildIntermarketCorrelationMatrix(seriesInputs, 30),
    [seriesInputs]
  );

  const getCellStyle = (r: number | null, isDiagonal: boolean) => {
    if (isDiagonal) return 'bg-slate-800/90 text-slate-400';
    if (r === null) return 'bg-slate-900 text-slate-600';
    if (r >= 0.65) return 'bg-emerald-500/30 text-emerald-200 font-bold';
    if (r >= 0.3) return 'bg-emerald-500/15 text-emerald-300';
    if (r <= -0.65) return 'bg-rose-500/30 text-rose-200 font-bold';
    if (r <= -0.3) return 'bg-rose-500/15 text-rose-300';
    return 'bg-[#0b1220] text-slate-300';
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center rounded-xl bg-[#0c121e] border border-slate-800 text-slate-400 text-xs font-mono leading-relaxed break-words">
        Đang tính toán Ma trận Tương quan Log-Return 30 phiên thực tế giữa {targetKeys.join(', ')}...
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs overflow-x-hidden">
      {/* Correlation Matrix Table */}
      <div className="p-3.5 rounded-xl bg-[#0c1322] border border-slate-800 space-y-2.5 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-bold text-white flex items-center gap-1.5 min-w-0">
            <GitCompare className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="leading-snug break-words">
              Ma Trận Tương Quan Liên Thị Trường (30 Phiên 1D — Pearson Log-Return)
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 break-words">
            +1.00 Cùng chiều chặt • 0.00 Độc lập • -1.00 Ngược chiều
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse font-mono text-[11px] text-center">
            <thead>
              <tr>
                <th className="px-2.5 py-2 text-left text-slate-400 bg-[#080d17] border border-slate-800 whitespace-nowrap">
                  Tài sản
                </th>
                {corrData.symbols.map(sym => (
                  <th
                    key={sym}
                    onClick={() => onJumpToSymbol(sym)}
                    className="px-2.5 py-2 text-cyan-300 bg-[#080d17] border border-slate-800 cursor-pointer hover:text-white whitespace-nowrap"
                  >
                    {sym}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corrData.symbols.map(rowSym => (
                <tr key={rowSym}>
                  <td
                    onClick={() => onJumpToSymbol(rowSym)}
                    className="px-2.5 py-2 text-left font-bold text-white bg-[#080d17] border border-slate-800 cursor-pointer hover:text-cyan-300 whitespace-nowrap"
                  >
                    {rowSym}
                  </td>
                  {corrData.symbols.map(colSym => {
                    const r = corrData.matrix[rowSym]?.[colSym] ?? null;
                    const diag = rowSym === colSym;
                    return (
                      <td
                        key={colSym}
                        className={`px-2.5 py-2 border border-slate-800/80 whitespace-nowrap ${getCellStyle(
                          r,
                          diag
                        )}`}
                      >
                        {r === null
                          ? 'N/A'
                          : diag
                          ? '1.00'
                          : r > 0
                          ? `+${r.toFixed(2)}`
                          : r.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Intermarket Divergence Detector */}
      <div className="p-3.5 rounded-xl bg-[#0c1322] border border-slate-800 space-y-2.5 min-w-0">
        <div className="font-bold text-white flex items-center gap-1.5 min-w-0">
          <Activity className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="leading-snug break-words">
            Phát Hiện Phân Kỳ Liên Thị Trường Ngắn Hạn (5 Phiên Gần Nhất vs Nền 30 Phiên)
          </span>
        </div>

        {corrData.divergences.length === 0 ? (
          <div className="p-3 rounded-lg bg-[#080d17] border border-slate-800 text-slate-400 text-[11px] flex items-start sm:items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
            <span className="leading-relaxed break-words">
              Các cặp tài sản liên thị trường hiện vận động đồng pha với cấu trúc tương quan lịch sử 30 phiên — chưa xuất hiện phân kỳ bất thường.
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {corrData.divergences.map(div => (
              <div
                key={div.id}
                className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/35 space-y-1.5 min-w-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-amber-200 flex items-center gap-1.5 font-mono break-words">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      {div.pairLabel} (r = {div.correlation30Bar > 0 ? '+' : ''}
                      {div.correlation30Bar.toFixed(2)})
                    </span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed break-words">
                  {div.summary}
                </p>
                <p className="text-[11px] text-cyan-300 leading-relaxed break-words">
                  💡 {div.actionableHint}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
