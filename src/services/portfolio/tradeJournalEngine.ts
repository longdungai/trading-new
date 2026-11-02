import { MarketSymbol } from '../../types';
import {
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
} from '../vnMarket/vnStockMicrostructure';
import {
  getUserHoldingForSymbol,
  removeUserHolding,
  saveUserHolding,
  UserHoldingItem,
} from './holdingsRecoveryEngine';

export const TRADE_JOURNAL_STORAGE_KEY = 'trading_new_closed_trade_journal_v1';
export const TRADE_JOURNAL_UPDATED_EVENT = 'trading_new_trade_journal_updated';

export interface ClosedTradeJournalEntry {
  id: string;
  symbol: string;
  isVN: boolean;
  currencyUnitLabel: 'Tr VNĐ' | 'USD';
  quantityLabel: 'CP' | 'HĐ' | 'ĐV';
  quantityClosed: number;
  entryPrice: number;
  exitPrice: number;
  holdingDays: number;
  grossPnlPct: number;
  feeAndTaxPct: number;
  netRealizedPnlPct: number;
  netRealizedCashValue: number; // In Million VND for VN stocks, or USD for Global/Crypto
  exitReason: 'TAKE_PROFIT_T2' | 'T0_INTRADAY_HARVEST' | 'STOP_LOSS_DISCIPLINE' | 'MANUAL_EXIT';
  exitReasonLabelVi: string;
  note?: string;
  closedAtMs: number;
  closedDateLabel: string;
}

export interface TradeJournalAnalyticsSummary {
  entries: ClosedTradeJournalEntry[];
  totalClosedTrades: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  profitFactor: number;
  avgWinPct: number;
  avgLossPct: number;
  totalNetRealizedMillionVnd: number;
  totalNetRealizedUsd: number;
  avgHoldingDays: number;
  equityCurveVndPoints: { index: number; label: string; cumulativeMillionVnd: number }[];
  coachingBadgeVi: string;
  coachingAdviceVi: string;
}

function emitJournalUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TRADE_JOURNAL_UPDATED_EVENT));
  }
}

export function loadClosedTradeJournal(): ClosedTradeJournalEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TRADE_JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ClosedTradeJournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveClosedTradeJournal(entries: ClosedTradeJournalEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TRADE_JOURNAL_STORAGE_KEY, JSON.stringify(entries.slice(0, 200)));
    emitJournalUpdated();
  } catch {
    // ignore storage errors
  }
}

export function recordClosedTradeEntry(params: {
  symbol: string;
  symbolObj?: MarketSymbol | null;
  quantityClosed: number;
  entryPrice: number;
  exitPrice: number;
  holdingDays?: number;
  exitReason?: ClosedTradeJournalEntry['exitReason'];
  note?: string;
  deductFromOpenHolding?: boolean;
}): ClosedTradeJournalEntry {
  const {
    symbol,
    symbolObj,
    quantityClosed,
    entryPrice,
    exitPrice,
    holdingDays = 3,
    exitReason = 'TAKE_PROFIT_T2',
    note,
    deductFromOpenHolding = true,
  } = params;

  const symUpper = symbol.trim().toUpperCase();
  const isVN = symbolObj
    ? isVnStockOrIndexSymbol(symbolObj)
    : ['FPT', 'HPG', 'SSI', 'VCB', 'MWG', 'VIC', 'VHM', 'MSN', 'TCB', 'MBB', 'STB', 'VND', 'VCI'].includes(
        symUpper
      );
  const isDeriv = isVnDerivativeSymbol(symUpper);

  const feeAndTaxPct = isVN && !isDeriv ? 0.45 : 0.2;
  const grossPnlPct = Number(
    (((exitPrice - entryPrice) / Math.max(0.0001, entryPrice)) * 100).toFixed(2)
  );
  const netRealizedPnlPct = Number((grossPnlPct - feeAndTaxPct).toFixed(2));

  // For VN corporate stocks, chart price is in 1,000 VND -> Million VND = (qty * price) / 1000
  const positionEntryValue =
    isVN && !isDeriv
      ? (quantityClosed * entryPrice) / 1000
      : isDeriv
      ? (quantityClosed * entryPrice * 100) / 1000
      : quantityClosed * entryPrice;

  const netRealizedCashValue = Number(
    (positionEntryValue * (netRealizedPnlPct / 100)).toFixed(2)
  );

  const exitReasonLabelVi =
    exitReason === 'TAKE_PROFIT_T2'
      ? '🎯 Chốt lời T+2.5 thu tiền mặt'
      : exitReason === 'T0_INTRADAY_HARVEST'
      ? '⚡ Lướt T+0 tiền mặt trong phiên'
      : exitReason === 'STOP_LOSS_DISCIPLINE'
      ? '🛡️ Cắt lỗ kỷ luật bảo toàn vốn'
      : '📝 Đóng vị thế thủ công';

  const now = new Date();
  const closedDateLabel = `${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  const entry: ClosedTradeJournalEntry = {
    id: `trd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    symbol: symUpper,
    isVN,
    currencyUnitLabel: isVN ? 'Tr VNĐ' : 'USD',
    quantityLabel: isDeriv ? 'HĐ' : isVN ? 'CP' : 'ĐV',
    quantityClosed,
    entryPrice,
    exitPrice,
    holdingDays: Math.max(0, holdingDays),
    grossPnlPct,
    feeAndTaxPct,
    netRealizedPnlPct,
    netRealizedCashValue,
    exitReason,
    exitReasonLabelVi,
    note,
    closedAtMs: now.getTime(),
    closedDateLabel,
  };

  const currentJournal = loadClosedTradeJournal();
  saveClosedTradeJournal([entry, ...currentJournal]);

  // Optionally deduct or clear from open holdings
  if (deductFromOpenHolding) {
    const existingHolding: UserHoldingItem | null = getUserHoldingForSymbol(symUpper);
    if (existingHolding) {
      const remainingQty = Number((existingHolding.quantity - quantityClosed).toFixed(4));
      if (remainingQty <= 0.0001) {
        removeUserHolding(symUpper);
      } else {
        saveUserHolding({
          ...existingHolding,
          quantity: remainingQty,
        });
      }
    }
  }

  return entry;
}

export function deleteClosedTradeEntry(entryId: string): ClosedTradeJournalEntry[] {
  const next = loadClosedTradeJournal().filter((e) => e.id !== entryId);
  saveClosedTradeJournal(next);
  return next;
}

export function clearClosedTradeJournal(): void {
  saveClosedTradeJournal([]);
}

export function computeTradeJournalAnalytics(
  entries: ClosedTradeJournalEntry[] = loadClosedTradeJournal()
): TradeJournalAnalyticsSummary {
  const totalClosedTrades = entries.length;
  let winCount = 0;
  let lossCount = 0;
  let sumWinPct = 0;
  let sumLossAbsPct = 0;
  let totalNetRealizedMillionVnd = 0;
  let totalNetRealizedUsd = 0;
  let totalHoldingDays = 0;

  for (const e of entries) {
    totalHoldingDays += e.holdingDays;
    if (e.isVN) {
      totalNetRealizedMillionVnd += e.netRealizedCashValue;
    } else {
      totalNetRealizedUsd += e.netRealizedCashValue;
    }

    if (e.netRealizedPnlPct >= 0) {
      winCount++;
      sumWinPct += e.netRealizedPnlPct;
    } else {
      lossCount++;
      sumLossAbsPct += Math.abs(e.netRealizedPnlPct);
    }
  }

  const winRatePct =
    totalClosedTrades > 0 ? Number(((winCount / totalClosedTrades) * 100).toFixed(1)) : 0;
  const avgWinPct = winCount > 0 ? Number((sumWinPct / winCount).toFixed(2)) : 0;
  const avgLossPct = lossCount > 0 ? Number((sumLossAbsPct / lossCount).toFixed(2)) : 0;
  const profitFactor =
    sumLossAbsPct > 0
      ? Number((sumWinPct / sumLossAbsPct).toFixed(2))
      : sumWinPct > 0
      ? 9.99
      : 0;
  const avgHoldingDays =
    totalClosedTrades > 0 ? Number((totalHoldingDays / totalClosedTrades).toFixed(1)) : 0;

  // Build chronological equity curve for VN trades (oldest -> newest)
  const chronologicalVn = [...entries].filter((e) => e.isVN).reverse();
  let runningVnd = 0;
  const equityCurveVndPoints = [
    { index: 0, label: 'Khởi đầu', cumulativeMillionVnd: 0 },
    ...chronologicalVn.map((e, idx) => {
      runningVnd = Number((runningVnd + e.netRealizedCashValue).toFixed(2));
      return {
        index: idx + 1,
        label: `${e.symbol} (${e.closedDateLabel.split(' ')[0]})`,
        cumulativeMillionVnd: runningVnd,
      };
    }),
  ];

  let coachingBadgeVi = '📊 Chưa có lệnh đóng';
  let coachingAdviceVi =
    'Hãy bấm nút "Chốt Lệnh / Ghi Nhật Ký" ở vị thế đang giữ sau khi bán chốt lời hoặc cắt lỗ để hệ thống theo dõi Đường cong Vốn và hiệu suất thực chiến của bạn.';

  if (totalClosedTrades > 0) {
    if (winRatePct >= 60 && profitFactor >= 1.5) {
      coachingBadgeVi = '🏆 Kỷ Luật Spot Xuất Sắc';
      coachingAdviceVi = `Tỷ lệ thắng ${winRatePct}% với Profit Factor ${profitFactor}x (Lãi TB +${avgWinPct}% vs Lỗ TB -${avgLossPct}%). Hãy duy trì đúng nhịp quay vòng 3 ngăn tiền mặt T+2.5.`;
    } else if (avgLossPct > avgWinPct * 1.25 && lossCount > 0) {
      coachingBadgeVi = '⚠️ Cảnh Báo: Chốt Lời Non / Gồng Lỗ Dài';
      coachingAdviceVi = `Mức lỗ trung bình (-${avgLossPct}%) đang lớn hơn mức lãi trung bình (+${avgWinPct}%). Cần tuân thủ nghiêm mốc cắt lỗ -3.5% và chỉ chốt 50% khi chạm +4.5%, giữ 50% gồng theo Trailing Stop.`;
    } else {
      coachingBadgeVi = '✅ Hiệu Suất Đang Tích Lũy';
      coachingAdviceVi = `Đã hoàn thành ${totalClosedTrades} vòng giao dịch (thời gian giữ TB ${avgHoldingDays} ngày). Ưu tiên giải ngân khung 13h45–14h25 ở các mã RS > 75 để nâng tỷ lệ thắng.`;
    }
  }

  return {
    entries,
    totalClosedTrades,
    winCount,
    lossCount,
    winRatePct,
    profitFactor,
    avgWinPct,
    avgLossPct,
    totalNetRealizedMillionVnd: Number(totalNetRealizedMillionVnd.toFixed(2)),
    totalNetRealizedUsd: Number(totalNetRealizedUsd.toFixed(2)),
    avgHoldingDays,
    equityCurveVndPoints,
    coachingBadgeVi,
    coachingAdviceVi,
  };
}
