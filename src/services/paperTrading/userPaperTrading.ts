import { MarketSymbol } from '../../types';
import { getMarketSessionInfo } from '../../utils/marketHours';

export interface UserPaperTrade {
  id: string;
  symbol: string;
  strategyName: string;
  strategyId?: string;
  action: 'BUY' | 'SELL';
  entryType: 'market' | 'limit';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  tpTargetLabel: 'TP1' | 'TP2' | 'TP3';
  capital: number;
  leverage: number;
  openTime: number;
  filledTime?: number;
  closeTime?: number;
  exitPrice?: number;
  status: 'PENDING' | 'OPEN' | 'TP_HIT' | 'SL_HIT' | 'CLOSED_MANUAL' | 'CANCELLED';
  pnlAmount: number;
  pnlPercent: number;
  quoteAsset: string;
}

export interface PaperEquityCurvePoint {
  index: number;
  timestamp: number;
  symbol: string;
  tradePnlPct: number;
  cumulativeReturnPct: number;
}

export interface PaperStrategyBreakdown {
  strategyName: string;
  totalClosed: number;
  wins: number;
  winRatePct: number;
  avgPnlPct: number;
}

export interface PaperPortfolioAnalytics {
  totalTrades: number;
  openCount: number;
  pendingCount: number;
  closedCount: number;
  wins: number;
  losses: number;
  winRatePct: number;
  profitFactor: number | null;
  expectancyPct: number;
  maxDrawdownPct: number;
  realizedUsd: number;
  unrealizedUsd: number;
  realizedVnd: number;
  unrealizedVnd: number;
  equityCurve: PaperEquityCurvePoint[];
  strategyBreakdown: PaperStrategyBreakdown[];
}

const STORAGE_KEY = 'trading_ai_user_paper_trades_v2';
export const PAPER_TRADES_UPDATED_EVENT = 'trading_new_paper_trades_updated';

function emitPaperTradesUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PAPER_TRADES_UPDATED_EVENT));
  }
}

export function getUserPaperTrades(): UserPaperTrade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserPaperTrades(trades: UserPaperTrade[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    emitPaperTradesUpdated();
  } catch (e) {
    console.warn('Failed to save paper trades', e);
  }
}

export function clearUserPaperTrades() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    emitPaperTradesUpdated();
  } catch (e) {
    console.warn('Failed to clear paper trades', e);
  }
}

export function addUserPaperTrade(newTrade: {
  symbol: string;
  strategyName: string;
  strategyId?: string;
  action: 'BUY' | 'SELL';
  entryType: 'market' | 'limit';
  entryPrice: number;
  currentMarketPrice: number;
  stopLoss: number;
  takeProfit: number;
  tpTargetLabel: 'TP1' | 'TP2' | 'TP3';
  capital: number;
  leverage: number;
  quoteAsset: string;
}): UserPaperTrade {
  const trades = getUserPaperTrades();
  const isMarket = newTrade.entryType === 'market';

  let initialStatus: UserPaperTrade['status'] = 'PENDING';
  let actualEntry = newTrade.entryPrice;

  if (isMarket) {
    initialStatus = 'OPEN';
    actualEntry = newTrade.currentMarketPrice;
  } else {
    const isBuy = newTrade.action === 'BUY';
    const isAlreadyTouched = isBuy
      ? newTrade.currentMarketPrice <= newTrade.entryPrice
      : newTrade.currentMarketPrice >= newTrade.entryPrice;

    if (isAlreadyTouched) {
      initialStatus = 'OPEN';
      actualEntry = newTrade.currentMarketPrice;
    } else {
      initialStatus = 'PENDING';
    }
  }

  const isBuy = newTrade.action === 'BUY';
  let validSL = newTrade.stopLoss;
  let validTP = newTrade.takeProfit;

  if (isBuy) {
    if (validSL >= actualEntry) validSL = actualEntry * 0.97;
    if (validTP <= actualEntry) validTP = actualEntry * 1.03;
  } else {
    if (validSL <= actualEntry) validSL = actualEntry * 1.03;
    if (validTP >= actualEntry) validTP = actualEntry * 0.97;
  }

  const trade: UserPaperTrade = {
    id: 'trade_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    symbol: newTrade.symbol,
    strategyName: newTrade.strategyName,
    strategyId: newTrade.strategyId,
    action: newTrade.action,
    entryType: newTrade.entryType,
    entryPrice: parseFloat(actualEntry.toFixed(4)),
    stopLoss: parseFloat(validSL.toFixed(4)),
    takeProfit: parseFloat(validTP.toFixed(4)),
    tpTargetLabel: newTrade.tpTargetLabel,
    capital: newTrade.capital,
    leverage: newTrade.leverage || 1,
    openTime: Date.now(),
    filledTime: initialStatus === 'OPEN' ? Date.now() : undefined,
    status: initialStatus,
    pnlAmount: 0,
    pnlPercent: 0,
    quoteAsset: newTrade.quoteAsset,
  };

  trades.unshift(trade);
  saveUserPaperTrades(trades);
  return trade;
}

function evaluateSingleTradeAgainstPrice(
  trade: UserPaperTrade,
  currentPrice: number,
  allowOrderExecution: boolean,
  nowMs: number
): { nextTrade: UserPaperTrade; persistedChange: boolean } {
  if (!(currentPrice > 0)) {
    return { nextTrade: trade, persistedChange: false };
  }

  const isBuy = trade.action === 'BUY';

  // 1. PENDING Limit Orders — only execute when the underlying exchange is officially OPEN
  if (trade.status === 'PENDING') {
    if (!allowOrderExecution) {
      return { nextTrade: trade, persistedChange: false };
    }
    const isEntryHit = isBuy
      ? currentPrice <= trade.entryPrice
      : currentPrice >= trade.entryPrice;

    if (isEntryHit) {
      return {
        nextTrade: {
          ...trade,
          status: 'OPEN',
          filledTime: nowMs,
          entryPrice: currentPrice,
        },
        persistedChange: true,
      };
    }
    return { nextTrade: trade, persistedChange: false };
  }

  // 2. OPEN Orders — update floating PnL, and trigger TP/SL when exchange session is OPEN
  if (trade.status === 'OPEN') {
    const priceDiff = isBuy ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
    const rawPct = (priceDiff / trade.entryPrice) * 100;
    const leveragedPct = rawPct * (trade.leverage || 1);
    const pnl = trade.capital * (leveragedPct / 100);

    if (allowOrderExecution) {
      const isSlHit = isBuy ? currentPrice <= trade.stopLoss : currentPrice >= trade.stopLoss;
      if (isSlHit) {
        const finalDiff = isBuy ? trade.stopLoss - trade.entryPrice : trade.entryPrice - trade.stopLoss;
        const finalPct = (finalDiff / trade.entryPrice) * 100 * (trade.leverage || 1);
        return {
          nextTrade: {
            ...trade,
            status: 'SL_HIT',
            closeTime: nowMs,
            exitPrice: trade.stopLoss,
            pnlPercent: parseFloat(finalPct.toFixed(2)),
            pnlAmount: parseFloat((trade.capital * (finalPct / 100)).toFixed(2)),
          },
          persistedChange: true,
        };
      }

      const isTpHit = isBuy ? currentPrice >= trade.takeProfit : currentPrice <= trade.takeProfit;
      if (isTpHit) {
        const finalDiff = isBuy ? trade.takeProfit - trade.entryPrice : trade.entryPrice - trade.takeProfit;
        const finalPct = (finalDiff / trade.entryPrice) * 100 * (trade.leverage || 1);
        return {
          nextTrade: {
            ...trade,
            status: 'TP_HIT',
            closeTime: nowMs,
            exitPrice: trade.takeProfit,
            pnlPercent: parseFloat(finalPct.toFixed(2)),
            pnlAmount: parseFloat((trade.capital * (finalPct / 100)).toFixed(2)),
          },
          persistedChange: true,
        };
      }
    }

    const nextPct = parseFloat(leveragedPct.toFixed(2));
    const nextAmt = parseFloat(pnl.toFixed(2));
    const changed = trade.pnlPercent !== nextPct || trade.pnlAmount !== nextAmt;
    return {
      nextTrade: changed
        ? {
            ...trade,
            pnlPercent: nextPct,
            pnlAmount: nextAmt,
          }
        : trade,
      persistedChange: changed,
    };
  }

  return { nextTrade: trade, persistedChange: false };
}

export function updateOpenPaperTradesWithLivePrice(
  currentSymbol: string,
  currentPrice: number
): UserPaperTrade[] {
  if (!currentPrice || currentPrice <= 0) return getUserPaperTrades();

  const trades = getUserPaperTrades();
  if (trades.length === 0) return trades;

  const now = new Date();
  const nowMs = now.getTime();
  let hasChanges = false;

  const updated = trades.map(trade => {
    if (trade.symbol !== currentSymbol) return trade;
    const session = getMarketSessionInfo(
      {
        symbol: trade.symbol,
        quoteAsset: trade.quoteAsset,
        type:
          trade.quoteAsset === 'VND'
            ? 'vn30'
            : trade.quoteAsset === 'USDT'
              ? 'crypto'
              : 'stock',
      },
      now
    );
    const { nextTrade, persistedChange } = evaluateSingleTradeAgainstPrice(
      trade,
      currentPrice,
      session.isOpen,
      nowMs
    );
    if (persistedChange) hasChanges = true;
    return nextTrade;
  });

  if (hasChanges) {
    saveUserPaperTrades(updated);
  }
  return updated;
}

/**
 * Global Multi-Asset Real-Time Paper Portfolio Synchronizer:
 * Evaluates all PENDING and OPEN paper trades across every symbol in the watchlist,
 * strictly enforcing official exchange trading hours per symbol.
 */
export function syncAllPaperTradesWithMarket(
  symbols: MarketSymbol[],
  now: Date = new Date()
): { trades: UserPaperTrade[]; statusTransitionEvents: UserPaperTrade[] } {
  const trades = getUserPaperTrades();
  if (trades.length === 0 || symbols.length === 0) {
    return { trades, statusTransitionEvents: [] };
  }

  const symMap = new Map<string, MarketSymbol>();
  for (const s of symbols) {
    symMap.set(s.symbol.toUpperCase(), s);
  }

  const nowMs = now.getTime();
  let hasChanges = false;
  const statusTransitionEvents: UserPaperTrade[] = [];

  const updated = trades.map(trade => {
    if (trade.status !== 'PENDING' && trade.status !== 'OPEN') {
      return trade;
    }
    const symMeta = symMap.get(trade.symbol.toUpperCase());
    if (!symMeta || !(symMeta.price > 0)) {
      return trade;
    }

    const session = getMarketSessionInfo(symMeta, now);
    const { nextTrade, persistedChange } = evaluateSingleTradeAgainstPrice(
      trade,
      symMeta.price,
      session.isOpen,
      nowMs
    );

    if (persistedChange) {
      hasChanges = true;
      if (nextTrade.status !== trade.status) {
        statusTransitionEvents.push(nextTrade);
      }
    }
    return nextTrade;
  });

  if (hasChanges) {
    saveUserPaperTrades(updated);
  }

  return { trades: updated, statusTransitionEvents };
}

export function closePaperTradeManually(tradeId: string, currentPrice: number): UserPaperTrade[] {
  const trades = getUserPaperTrades();
  const updated = trades.map(trade => {
    if (trade.id !== tradeId) return trade;

    if (trade.status === 'PENDING') {
      return {
        ...trade,
        status: 'CANCELLED' as const,
        closeTime: Date.now(),
        pnlPercent: 0,
        pnlAmount: 0,
      };
    }

    if (trade.status === 'OPEN') {
      const isBuy = trade.action === 'BUY';
      const exitPrice = currentPrice || trade.entryPrice;
      const priceDiff = isBuy ? exitPrice - trade.entryPrice : trade.entryPrice - exitPrice;
      const finalPct = (priceDiff / trade.entryPrice) * 100 * (trade.leverage || 1);

      return {
        ...trade,
        status: 'CLOSED_MANUAL' as const,
        closeTime: Date.now(),
        exitPrice,
        pnlPercent: parseFloat(finalPct.toFixed(2)),
        pnlAmount: parseFloat((trade.capital * (finalPct / 100)).toFixed(2)),
      };
    }

    return trade;
  });

  saveUserPaperTrades(updated);
  return updated;
}

export function calculatePaperPortfolioAnalytics(
  trades: UserPaperTrade[]
): PaperPortfolioAnalytics {
  const openTrades = trades.filter(t => t.status === 'OPEN');
  const pendingTrades = trades.filter(t => t.status === 'PENDING');
  const closedTrades = trades
    .filter(t => t.status === 'TP_HIT' || t.status === 'SL_HIT' || t.status === 'CLOSED_MANUAL')
    .sort((a, b) => (a.closeTime || a.openTime) - (b.closeTime || b.openTime));

  let wins = 0;
  let losses = 0;
  let grossProfitPct = 0;
  let grossLossPct = 0;
  let realizedUsd = 0;
  let unrealizedUsd = 0;
  let realizedVnd = 0;
  let unrealizedVnd = 0;

  for (const t of openTrades) {
    if (t.quoteAsset === 'VND') unrealizedVnd += t.pnlAmount;
    else unrealizedUsd += t.pnlAmount;
  }

  const equityCurve: PaperEquityCurvePoint[] = [
    { index: 0, timestamp: closedTrades[0]?.openTime || Date.now(), symbol: 'START', tradePnlPct: 0, cumulativeReturnPct: 0 },
  ];

  let cumPct = 0;
  let peakEquity = 100;
  let maxDrawdownPct = 0;

  const stratMap = new Map<string, { total: number; wins: number; sumPct: number }>();

  closedTrades.forEach((t, idx) => {
    if (t.pnlPercent > 0) {
      wins++;
      grossProfitPct += t.pnlPercent;
    } else if (t.pnlPercent < 0) {
      losses++;
      grossLossPct += Math.abs(t.pnlPercent);
    }

    if (t.quoteAsset === 'VND') realizedVnd += t.pnlAmount;
    else realizedUsd += t.pnlAmount;

    cumPct = parseFloat((cumPct + t.pnlPercent).toFixed(2));
    const eqIndex = 100 * (1 + cumPct / 100);
    if (eqIndex > peakEquity) peakEquity = eqIndex;
    if (peakEquity > 0) {
      const dd = ((peakEquity - eqIndex) / peakEquity) * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }

    equityCurve.push({
      index: idx + 1,
      timestamp: t.closeTime || t.openTime,
      symbol: t.symbol,
      tradePnlPct: t.pnlPercent,
      cumulativeReturnPct: cumPct,
    });

    const key = t.strategyName || 'Chiến lược tùy chỉnh';
    const cur = stratMap.get(key) || { total: 0, wins: 0, sumPct: 0 };
    cur.total += 1;
    if (t.pnlPercent > 0) cur.wins += 1;
    cur.sumPct += t.pnlPercent;
    stratMap.set(key, cur);
  });

  const closedCount = closedTrades.length;
  const winRatePct = closedCount > 0 ? parseFloat(((wins / closedCount) * 100).toFixed(1)) : 0;
  const profitFactor =
    grossLossPct > 0
      ? parseFloat((grossProfitPct / grossLossPct).toFixed(2))
      : grossProfitPct > 0
      ? 99.9
      : null;
  const expectancyPct =
    closedCount > 0 ? parseFloat(((grossProfitPct - grossLossPct) / closedCount).toFixed(2)) : 0;

  const strategyBreakdown: PaperStrategyBreakdown[] = Array.from(stratMap.entries())
    .map(([strategyName, s]) => ({
      strategyName,
      totalClosed: s.total,
      wins: s.wins,
      winRatePct: Math.round((s.wins / s.total) * 100),
      avgPnlPct: parseFloat((s.sumPct / s.total).toFixed(2)),
    }))
    .sort((a, b) => b.avgPnlPct - a.avgPnlPct);

  return {
    totalTrades: trades.length,
    openCount: openTrades.length,
    pendingCount: pendingTrades.length,
    closedCount,
    wins,
    losses,
    winRatePct,
    profitFactor,
    expectancyPct,
    maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
    realizedUsd: parseFloat(realizedUsd.toFixed(2)),
    unrealizedUsd: parseFloat(unrealizedUsd.toFixed(2)),
    realizedVnd: Math.round(realizedVnd),
    unrealizedVnd: Math.round(unrealizedVnd),
    equityCurve,
    strategyBreakdown,
  };
}

export function exportPaperTradesToCsv(trades: UserPaperTrade[]): string {
  const header = [
    'ID',
    'Symbol',
    'Action',
    'OrderType',
    'Status',
    'Strategy',
    'EntryPrice',
    'StopLoss',
    'TakeProfit',
    'ExitPrice',
    'Capital',
    'Leverage',
    'PnL_Amount',
    'PnL_Percent',
    'Currency',
    'OpenedAt',
    'ClosedAt',
  ].join(',');

  const rows = trades.map(t =>
    [
      t.id,
      t.symbol,
      t.action,
      t.entryType.toUpperCase(),
      t.status,
      `"${(t.strategyName || '').replace(/"/g, '""')}"`,
      t.entryPrice,
      t.stopLoss,
      t.takeProfit,
      t.exitPrice ?? '',
      t.capital,
      t.leverage,
      t.pnlAmount,
      t.pnlPercent,
      t.quoteAsset,
      new Date(t.openTime).toISOString(),
      t.closeTime ? new Date(t.closeTime).toISOString() : '',
    ].join(',')
  );

  return [header, ...rows].join('\n');
}
