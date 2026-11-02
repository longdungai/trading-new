import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Edit3,
  Eye,
  EyeOff,
  Layers,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Candle, MarketSymbol } from '../../types';
import { ChartRecommendationVerdict } from '../../services/ai/chartVerdictEngine';
import {
  evaluatePositionRecovery,
  loadUserHoldings,
  PositionRecoveryPlan,
  removeUserHolding,
  saveUserHolding,
  USER_HOLDINGS_UPDATED_EVENT,
  UserHoldingItem,
} from '../../services/portfolio/holdingsRecoveryEngine';
import {
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
} from '../../services/vnMarket/vnStockMicrostructure';
import { formatPrice } from '../../utils/formatters';

interface PositionRecoveryCardProps {
  currentSymbol: MarketSymbol;
  allSymbols: MarketSymbol[];
  candles: Candle[];
  chartVerdict: ChartRecommendationVerdict;
  recoveryPlan: PositionRecoveryPlan | null;
  showHoldingLines?: boolean;
  onToggleHoldingLines?: () => void;
  onSelectSymbol?: (sym: MarketSymbol) => void;
  onQuickCreatePriceAlert?: (price: number) => void;
}

export const PositionRecoveryCard: React.FC<PositionRecoveryCardProps> = ({
  currentSymbol,
  allSymbols,
  chartVerdict,
  recoveryPlan,
  showHoldingLines = true,
  onToggleHoldingLines,
  onSelectSymbol,
  onQuickCreatePriceAlert,
}) => {
  const symUpper = currentSymbol.symbol.toUpperCase();
  const isVN = isVnStockOrIndexSymbol(currentSymbol) || currentSymbol.quoteAsset === 'VND';
  const isVnDeriv = isVnDerivativeSymbol(symUpper);
  const isVnIdx = ['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX'].includes(symUpper);
  const isVnCorp = isVN && !isVnDeriv && !isVnIdx;

  const [holdingsMap, setHoldingsMap] = useState<Record<string, UserHoldingItem>>(() =>
    loadUserHoldings()
  );
  const existingHolding = holdingsMap[symUpper] ?? null;

  const [isFormOpen, setIsFormOpen] = useState<boolean>(() => !existingHolding);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [activeScenarioTab, setActiveScenarioTab] = useState<'dca' | 't0' | 'trim'>('dca');
  const [savedFlash, setSavedFlash] = useState<boolean>(false);

  // Controlled form inputs
  const [qtyInput, setQtyInput] = useState<string>('');
  const [avgPriceInput, setAvgPriceInput] = useState<string>('');
  const [marginPctInput, setMarginPctInput] = useState<string>('0');
  const [daysInput, setDaysInput] = useState<string>('5');
  const [dcaBudgetInput, setDcaBudgetInput] = useState<string>('');

  useEffect(() => {
    const sync = () => setHoldingsMap(loadUserHoldings());
    window.addEventListener(USER_HOLDINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(USER_HOLDINGS_UPDATED_EVENT, sync);
  }, []);

  // Re-sync form inputs whenever active symbol changes
  useEffect(() => {
    const cur = loadUserHoldings()[symUpper] ?? null;
    if (cur) {
      setQtyInput(String(cur.quantity));
      setAvgPriceInput(String(cur.avgCostPrice));
      setMarginPctInput(String(cur.marginRatioPct || 0));
      setDaysInput(String(cur.holdingDays ?? 5));
      setDcaBudgetInput(cur.extraDcaBudget !== null ? String(cur.extraDcaBudget) : '');
      setIsFormOpen(false);
    } else {
      setQtyInput(isVnCorp ? '1000' : isVnDeriv ? '2' : currentSymbol.type === 'stock' ? '20' : '0.5');
      setAvgPriceInput('');
      setMarginPctInput('0');
      setDaysInput('5');
      setDcaBudgetInput('');
      setIsFormOpen(true);
    }
  }, [symUpper, isVnCorp, isVnDeriv, currentSymbol.type]);

  // Automatically select the most appropriate scenario tab when recoveryPlan updates
  useEffect(() => {
    if (!recoveryPlan) return;
    if (recoveryPlan.primaryMode === 'ANTI_FALLING_KNIFE_VETO') {
      setActiveScenarioTab('trim');
    } else if (recoveryPlan.primaryMode === 'T0_INVENTORY_SURFING') {
      setActiveScenarioTab('t0');
    } else {
      setActiveScenarioTab('dca');
    }
  }, [recoveryPlan?.primaryMode, symUpper]);

  const heldSymbolsSummary = useMemo(() => {
    const entries = Object.values(holdingsMap).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    const symLookup = new Map<string, MarketSymbol>();
    for (const s of allSymbols) symLookup.set(s.symbol.toUpperCase(), s);

    return entries.map((h) => {
      const sObj = symLookup.get(h.symbol);
      const livePrice = sObj?.price || h.avgCostPrice;
      const rawPct =
        h.avgCostPrice > 0 ? ((livePrice - h.avgCostPrice) / h.avgCostPrice) * 100 : 0;
      return {
        holding: h,
        symbolObj: sObj || null,
        livePrice,
        rawPct: Number(rawPct.toFixed(1)),
      };
    });
  }, [holdingsMap, allSymbols]);

  const prefix = isVN ? '' : '$';
  const priceSuffix = isVN ? (isVnDeriv || isVnIdx ? ' đ' : 'k') : '';
  const fmtP = (val: number) => `${prefix}${formatPrice(val)}${priceSuffix}`;
  const qtyUnit = isVnCorp ? 'CP' : isVnDeriv ? 'HĐ' : currentSymbol.type === 'stock' ? 'CP' : 'Coin/ĐV';
  const budgetUnit = isVN ? 'Triệu VNĐ' : 'USD';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = Number(qtyInput.replace(/,/g, '').trim());
    const parsedAvg = Number(avgPriceInput.replace(/,/g, '').trim());
    if (!Number.isFinite(parsedQty) || parsedQty <= 0 || !Number.isFinite(parsedAvg) || parsedAvg <= 0) {
      return;
    }
    const parsedMargin = Math.max(0, Math.min(80, Number(marginPctInput) || 0));
    const parsedDays = Math.max(0, Math.round(Number(daysInput) || 3));
    const cleanBudgetStr = dcaBudgetInput.replace(/,/g, '').trim();
    const parsedBudget = cleanBudgetStr === '' ? null : Math.max(0, Number(cleanBudgetStr));

    const saved = saveUserHolding(
      {
        symbol: symUpper,
        quantity: parsedQty,
        avgCostPrice: parsedAvg,
        marginRatioPct: parsedMargin,
        holdingDays: parsedDays,
        extraDcaBudget: parsedBudget,
      },
      currentSymbol.price
    );

    if (saved) {
      setAvgPriceInput(String(saved.avgCostPrice));
      setIsFormOpen(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    }
  };

  const handleRemove = () => {
    removeUserHolding(symUpper);
    setAvgPriceInput('');
    setIsFormOpen(true);
  };

  return (
    <div className="p-3 sm:p-4 rounded-xl bg-[#101726] border border-amber-500/35 flex flex-col gap-3 shadow-xl select-none min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
              <span>Vị Thế Đang Giữ & Lộ Trình Về Bờ</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[9.5px] font-mono font-bold shrink-0">
                {symUpper}
              </span>
            </div>
            <div className="text-[10.5px] text-slate-400 truncate">
              Tính chuẩn phí, thuế TNCN, Margin & neo theo cản VPVR / 6 tầng
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {existingHolding && onToggleHoldingLines && (
            <button
              type="button"
              onClick={onToggleHoldingLines}
              className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition whitespace-nowrap ${
                showHoldingLines
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Bật/Tắt đường Giá Hòa Vốn Thực & Hòa Vốn Sau DCA trên biểu đồ"
            >
              {showHoldingLines ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>Đường Giá Vốn</span>
            </button>
          )}

          {existingHolding && (
            <button
              type="button"
              onClick={() => setIsFormOpen((v) => !v)}
              className="px-2 py-1 rounded-lg bg-[#172236] hover:bg-[#1f2e49] border border-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1 transition whitespace-nowrap"
            >
              <Edit3 className="w-3 h-3 text-cyan-400" />
              <span>{isFormOpen ? 'Đóng sửa' : 'Sửa giá vốn'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Saved Multi-Symbol Holdings Strip */}
      {heldSymbolsSummary.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <span className="text-[10px] text-slate-400 font-semibold shrink-0 flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-400" />
            Đang giữ ({heldSymbolsSummary.length}):
          </span>
          {heldSymbolsSummary.map(({ holding, symbolObj: sObj, rawPct }) => {
            const active = holding.symbol === symUpper;
            const pos = rawPct >= 0;
            return (
              <button
                key={holding.symbol}
                type="button"
                onClick={() => {
                  if (sObj && onSelectSymbol) onSelectSymbol(sObj);
                }}
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1 shrink-0 whitespace-nowrap transition ${
                  active
                    ? 'bg-amber-500/25 border-amber-400 text-white shadow-sm'
                    : 'bg-[#0b111d] border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <span>{holding.symbol}</span>
                <span className={pos ? 'text-emerald-400' : 'text-rose-400'}>
                  {pos ? '+' : ''}
                  {rawPct}%
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Input / Edit Holding Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSave}
          className="p-2.5 rounded-xl bg-[#0b111e] border border-slate-800 space-y-2.5 text-xs"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                Khối lượng nắm giữ ({qtyUnit})
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                placeholder={isVnCorp ? 'VD: 2000' : 'VD: 1.5'}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#131d31] border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <label className="text-[10px] text-slate-300 font-semibold truncate">
                  Giá vốn TB ({isVnCorp ? 'nghìn đ/CP' : isVN ? 'điểm' : 'USD'})
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setAvgPriceInput(
                      String(
                        isVnCorp
                          ? Number((currentSymbol.price * 1.08).toFixed(2))
                          : Number((currentSymbol.price * 1.08).toFixed(2))
                      )
                    )
                  }
                  className="text-[9.5px] text-cyan-400 hover:underline shrink-0"
                  title="Điền nhanh mẫu giá vốn cao hơn giá hiện tại +8% để thử kịch bản về bờ"
                >
                  Mẫu kẹp +8%
                </button>
              </div>
              <input
                type="number"
                step="any"
                min="0.0000001"
                required
                value={avgPriceInput}
                onChange={(e) => setAvgPriceInput(e.target.value)}
                placeholder={
                  isVnCorp
                    ? `VD: ${(currentSymbol.price * 1.06).toFixed(1)} hoặc ${Math.round(currentSymbol.price * 1060)}`
                    : `VD: ${(currentSymbol.price * 1.06).toFixed(2)}`
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#131d31] border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {isVnCorp && (
            <div className="text-[10px] text-slate-400 leading-snug">
              Mẹo: Nhập <code className="text-amber-300">{currentSymbol.price.toFixed(1)}</code> hay{' '}
              <code className="text-amber-300">{Math.round(currentSymbol.price * 1000)}</code> đều
              được — hệ thống tự chuẩn hóa theo đơn vị nghìn đồng/CP trên bảng điện.
            </div>
          )}

          {/* Optional Margin & Extra DCA Budget */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[10.5px] text-cyan-300 hover:text-cyan-200 font-semibold flex items-center gap-1"
          >
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>Tùy chọn nâng cao: Tỷ lệ vay Margin, Số ngày giữ & Vốn dự phòng DCA</span>
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Tỷ lệ vay Margin (%)</label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  step="5"
                  value={marginPctInput}
                  onChange={(e) => setMarginPctInput(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg bg-[#131d31] border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Số ngày đã nắm giữ</label>
                <input
                  type="number"
                  min="0"
                  max="3650"
                  value={daysInput}
                  onChange={(e) => setDaysInput(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg bg-[#131d31] border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Vốn DCA thêm ({budgetUnit})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={dcaBudgetInput}
                  onChange={(e) => setDcaBudgetInput(e.target.value)}
                  placeholder="Để trống = Tự tính"
                  className="w-full px-2 py-1 rounded-lg bg-[#131d31] border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow transition whitespace-nowrap"
            >
              {savedFlash ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã lưu & Cập nhật biểu đồ!</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Lưu Vị Thế & Lập Chiến Lược Về Bờ</span>
                </>
              )}
            </button>

            {existingHolding && (
              <button
                type="button"
                onClick={handleRemove}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-1 shrink-0 transition"
                title={`Xóa vị thế đang lưu của ${symUpper}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>
            )}
          </div>
        </form>
      )}

      {/* LIVE POSITION RECOVERY ENGINE OUTPUT */}
      {recoveryPlan && (
        <div className="space-y-2.5 text-xs min-w-0">
          {/* 1. Core Position PnL & True Break-Even Summary */}
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#0b1220] border border-slate-800 font-mono">
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 font-sans">
                Đang giữ:{' '}
                <strong className="text-white font-mono">
                  {recoveryPlan.holding.quantity.toLocaleString('en-US')} {recoveryPlan.quantityLabel}
                </strong>
              </div>
              <div
                className={`text-sm font-black mt-0.5 break-words ${
                  recoveryPlan.netUnrealizedPnlValue >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {recoveryPlan.netUnrealizedPnlValue >= 0 ? '+' : ''}
                {recoveryPlan.netUnrealizedPnlValue.toLocaleString('en-US')}{' '}
                {recoveryPlan.currencyUnitLabel} ({recoveryPlan.netUnrealizedPnlPct >= 0 ? '+' : ''}
                {recoveryPlan.netUnrealizedPnlPct}%)
              </div>
              <div className="text-[9.5px] text-slate-400 font-sans mt-0.5 leading-snug">
                Giá trị TT: {recoveryPlan.marketValueTotal.toLocaleString('en-US')}{' '}
                {recoveryPlan.currencyUnitLabel} (Phí/Thuế/Margin:{' '}
                {recoveryPlan.accruedFeeTaxAndMargin} {recoveryPlan.currencyUnitLabel})
              </div>
            </div>

            <div className="min-w-0 border-l border-slate-800 pl-2.5">
              <div className="text-[10px] text-amber-300 font-sans font-bold">
                Giá Hòa Vốn Thực (+Phí/Thuế)
              </div>
              <div className="text-sm font-black text-amber-200 mt-0.5">
                {fmtP(recoveryPlan.trueBreakEvenPrice)}
              </div>
              <div className="text-[9.5px] font-sans mt-0.5 leading-snug">
                {recoveryPlan.gainRequiredToBreakEvenPct > 0 ? (
                  <span className="text-amber-300 font-semibold">
                    Cần tăng +{recoveryPlan.gainRequiredToBreakEvenPct}% từ giá hiện tại
                  </span>
                ) : (
                  <span className="text-emerald-300 font-semibold">
                    Đã vượt trên ngưỡng hòa vốn thực!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Overhead Resistance Obstacles Before Shore */}
          {recoveryPlan.gainRequiredToBreakEvenPct > 0 && (
            <div className="p-2 rounded-xl bg-[#0c1424] border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-[10.5px] font-bold text-slate-200 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Cản kỹ thuật chắn giữa Giá hiện tại & Bờ</span>
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold shrink-0 whitespace-nowrap ${
                    recoveryPlan.difficultyGrade === 'EASY'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                      : recoveryPlan.difficultyGrade === 'MODERATE'
                      ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/35'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/35'
                  }`}
                >
                  {recoveryPlan.difficultyLabelVi}
                </span>
              </div>

              {recoveryPlan.obstaclesBeforeBreakEven.length === 0 ? (
                <div className="text-[10.5px] text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Đường lên giá hòa vốn khá thoáng — Chưa gặp tường cản thanh khoản lớn.</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {recoveryPlan.obstaclesBeforeBreakEven.map((obs, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-lg bg-[#141f35] border border-amber-500/30 text-[10px] font-mono text-amber-200"
                    >
                      {obs.labelVi}: <strong>{fmtP(obs.price)}</strong> (+{obs.distanceFromSpotPct}%)
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Primary Recommended Action Roadmap */}
          <div
            className={`p-2.5 rounded-xl border space-y-1.5 ${
              recoveryPlan.primaryMode === 'ANTI_FALLING_KNIFE_VETO'
                ? 'bg-rose-950/35 border-rose-500/45'
                : recoveryPlan.primaryMode === 'PROFIT_TRAILING_GUARD'
                ? 'bg-emerald-950/30 border-emerald-500/40'
                : 'bg-cyan-950/30 border-cyan-500/40'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-black/40 border border-white/15 text-[10px] font-black uppercase tracking-wide text-white flex items-center gap-1">
                {recoveryPlan.primaryMode === 'ANTI_FALLING_KNIFE_VETO' ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : recoveryPlan.primaryMode === 'PROFIT_TRAILING_GUARD' ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                )}
                <span>{recoveryPlan.primaryBadgeVi}</span>
              </span>
            </div>

            <div className="text-[11px] font-semibold text-white leading-snug">
              {recoveryPlan.primaryHeadlineVi}
            </div>

            <div className="space-y-1 pt-0.5">
              {recoveryPlan.actionStepsVi.map((step, i) => (
                <div key={i} className="text-[10.5px] text-slate-200 leading-relaxed">
                  {i + 1}. {step}
                </div>
              ))}
            </div>
          </div>

          {/* 4. 3-Method Interactive Recovery Comparison Tabs (When Underwater) */}
          {recoveryPlan.netUnrealizedPnlPct < -1.0 && (
            <div className="rounded-xl bg-[#0a101d] border border-slate-800 p-2 space-y-2">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#060a12] text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setActiveScenarioTab('dca')}
                  className={`py-1 px-1.5 rounded-md transition truncate ${
                    activeScenarioTab === 'dca'
                      ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-400/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1. DCA Hỗ Trợ
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScenarioTab('t0')}
                  className={`py-1 px-1.5 rounded-md transition truncate ${
                    activeScenarioTab === 't0'
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2. Lướt T+0 Kho
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScenarioTab('trim')}
                  className={`py-1 px-1.5 rounded-md transition truncate ${
                    activeScenarioTab === 'trim'
                      ? 'bg-rose-500/25 text-rose-200 border border-rose-400/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3. Hạ Nhịp Hồi
                </button>
              </div>

              {activeScenarioTab === 'dca' && (
                <div className="space-y-1.5 text-[10.5px]">
                  {!recoveryPlan.smartDcaPlan.allowed ? (
                    <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{recoveryPlan.smartDcaPlan.blockedReasonVi}</span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-1.5 font-mono">
                        <div className="p-1.5 rounded-lg bg-[#10192b] border border-slate-800">
                          <div className="text-[9.5px] font-sans text-slate-400">
                            Mua thêm tại {recoveryPlan.smartDcaPlan.dcaAnchorVi}
                          </div>
                          <div className="text-xs font-bold text-cyan-300">
                            +{recoveryPlan.smartDcaPlan.addQuantity.toLocaleString('en-US')}{' '}
                            {recoveryPlan.quantityLabel} @ {fmtP(recoveryPlan.smartDcaPlan.dcaBuyPrice)}
                          </div>
                          <div className="text-[9px] font-sans text-slate-400">
                            Cần vốn: {recoveryPlan.smartDcaPlan.additionalCapitalRequired.toLocaleString('en-US')}{' '}
                            {recoveryPlan.currencyUnitLabel}
                          </div>
                        </div>

                        <div className="p-1.5 rounded-lg bg-[#10192b] border border-emerald-500/30">
                          <div className="text-[9.5px] font-sans text-emerald-300">
                            Hòa vốn thực mới sau DCA
                          </div>
                          <div className="text-xs font-bold text-emerald-300">
                            {fmtP(recoveryPlan.smartDcaPlan.newTrueBreakEvenPrice)}
                          </div>
                          <div className="text-[9px] font-sans text-slate-300">
                            Quãng đường: +{recoveryPlan.smartDcaPlan.oldGainNeededPct}% →{' '}
                            <strong className="text-emerald-300">
                              +{recoveryPlan.smartDcaPlan.newGainNeededPct}%
                            </strong>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {recoveryPlan.smartDcaPlan.summaryVi}
                      </p>
                    </>
                  )}
                </div>
              )}

              {activeScenarioTab === 't0' && (
                <div className="space-y-1.5 text-[10.5px]">
                  {!recoveryPlan.t0SurfPlan.eligible ? (
                    <div className="p-2 rounded-lg bg-amber-950/35 border border-amber-500/35 text-amber-200">
                      {recoveryPlan.t0SurfPlan.ineligibleReasonVi}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-1.5 font-mono">
                        <div className="p-1.5 rounded-lg bg-[#10192b] border border-slate-800">
                          <div className="text-[9.5px] font-sans text-slate-400">
                            Biên lướt 30% kho ({recoveryPlan.t0SurfPlan.surfQuantity.toLocaleString('en-US')}{' '}
                            {recoveryPlan.quantityLabel})
                          </div>
                          <div className="text-xs font-bold text-amber-200">
                            {fmtP(recoveryPlan.t0SurfPlan.buySupportPrice)} →{' '}
                            {fmtP(recoveryPlan.t0SurfPlan.sellBouncePrice)}
                          </div>
                          <div className="text-[9px] font-sans text-emerald-300">
                            Lãi ròng/vòng: +{recoveryPlan.t0SurfPlan.netSpreadAfterFeeTaxPct}%
                          </div>
                        </div>

                        <div className="p-1.5 rounded-lg bg-[#10192b] border border-slate-800">
                          <div className="text-[9.5px] font-sans text-slate-400">
                            Tiền thu về giảm giá vốn
                          </div>
                          <div className="text-xs font-bold text-emerald-300">
                            +{recoveryPlan.t0SurfPlan.netCashEarnedPerCycle.toLocaleString('en-US')}{' '}
                            {recoveryPlan.currencyUnitLabel}/vòng
                          </div>
                          <div className="text-[9px] font-sans text-slate-300">
                            Dự kiến:{' '}
                            <strong>
                              {recoveryPlan.t0SurfPlan.estimatedCyclesToBreakEven
                                ? `~${recoveryPlan.t0SurfPlan.estimatedCyclesToBreakEven} vòng về bờ`
                                : 'Hạ dần giá vốn'}
                            </strong>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {recoveryPlan.t0SurfPlan.summaryVi}
                      </p>
                    </>
                  )}
                </div>
              )}

              {activeScenarioTab === 'trim' && (
                <div className="space-y-1.5 text-[10.5px]">
                  <div className="grid grid-cols-2 gap-1.5 font-mono">
                    <div className="p-1.5 rounded-lg bg-[#10192b] border border-slate-800">
                      <div className="text-[9.5px] font-sans text-slate-400">
                        Hạ 40% khi hồi kỹ thuật
                      </div>
                      <div className="text-xs font-bold text-rose-300">
                        Bán {recoveryPlan.defensiveTrimPlan.trimQuantity.toLocaleString('en-US')}{' '}
                        {recoveryPlan.quantityLabel} @{' '}
                        {fmtP(recoveryPlan.defensiveTrimPlan.bounceTrimPrice)}
                      </div>
                      <div className="text-[9px] font-sans text-slate-400">
                        Thu tiền mặt: {recoveryPlan.defensiveTrimPlan.cashFreed.toLocaleString('en-US')}{' '}
                        {recoveryPlan.currencyUnitLabel}
                      </div>
                    </div>

                    <div className="p-1.5 rounded-lg bg-[#10192b] border border-slate-800">
                      <div className="text-[9.5px] font-sans text-slate-400">
                        Mua lại tại đáy hỗ trợ dưới
                      </div>
                      <div className="text-xs font-bold text-cyan-300">
                        @ {fmtP(recoveryPlan.defensiveTrimPlan.reentrySupportPrice)}
                      </div>
                      <div className="text-[9px] font-sans text-emerald-300">
                        Tăng thêm +{recoveryPlan.defensiveTrimPlan.extraUnitsReacquired}{' '}
                        {recoveryPlan.quantityLabel} (0đ vốn mới)
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {recoveryPlan.defensiveTrimPlan.summaryVi}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 4B. Vietnam T+2.5 Locked Equity Beta Hedge via Short VN30F1M */}
          {recoveryPlan.isVnCorporateStock &&
            recoveryPlan.netUnrealizedPnlPct < 0 &&
            chartVerdict.vnTacticalSummary && (
              <div className="p-2.5 rounded-xl bg-indigo-950/35 border border-indigo-500/40 space-y-1 text-[10.5px]">
                <div className="flex items-center justify-between gap-2 flex-wrap font-bold text-indigo-200">
                  <span>
                    🛡️ Hộ Vệ Phái Sinh Short VN30F1M{' '}
                    {recoveryPlan.holding.holdingDays < 3 ? '(Khi Đang Kẹp T+2.5)' : '(Bảo Hiểm Danh Mục)'}:
                  </span>
                  <span className="font-mono text-amber-300">
                    Short{' '}
                    {
                      chartVerdict.vnTacticalSummary.postCrashAndHedge.betaHedgePlan
                        .recommendedShortContractsHalfHedge
                    }
                    –
                    {
                      chartVerdict.vnTacticalSummary.postCrashAndHedge.betaHedgePlan
                        .recommendedShortContractsFullHedge
                    }{' '}
                    HĐ
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 leading-snug">
                  {chartVerdict.vnTacticalSummary.postCrashAndHedge.betaHedgePlan.hedgeSummaryVi}
                </div>
              </div>
            )}

          {/* 5. Quick Alert Actions for Break-Even & Support Entry */}
          {onQuickCreatePriceAlert && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => onQuickCreatePriceAlert(recoveryPlan.trueBreakEvenPrice)}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#142038] hover:bg-[#1b2b4b] border border-amber-500/40 text-amber-200 text-[10.5px] font-bold flex items-center justify-center gap-1 transition whitespace-nowrap"
              >
                <Bell className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Báo Khi Về Bờ ({fmtP(recoveryPlan.trueBreakEvenPrice)})</span>
              </button>

              {recoveryPlan.smartDcaPlan.allowed && (
                <button
                  type="button"
                  onClick={() => onQuickCreatePriceAlert(recoveryPlan.smartDcaPlan.dcaBuyPrice)}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#11242b] hover:bg-[#16313b] border border-cyan-500/40 text-cyan-200 text-[10.5px] font-bold flex items-center justify-center gap-1 transition whitespace-nowrap"
                >
                  <TrendingDown className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>Báo Điểm DCA ({fmtP(recoveryPlan.smartDcaPlan.dcaBuyPrice)})</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
