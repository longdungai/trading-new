export interface UserPaperTrade {
  id: string;
  symbol: string;
  strategyName: string;
  strategyId?: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  tpTargetLabel: 'TP1' | 'TP2' | 'TP3';
  capital: number;
  leverage: number;
  openTime: number;
  closeTime?: number;
  exitPrice?: number;
  status: 'OPEN' | 'TP_HIT' | 'SL_HIT' | 'CLOSED_MANUAL';
  pnlAmount: number;
  pnlPercent: number;
  quoteAsset: string;
}

const STORAGE_KEY = 'trading_ai_user_paper_trades_v1';

export function getUserPaperTrades(): UserPaperTrade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveUserPaperTrades(trades: UserPaperTrade[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  } catch (e) {
    console.warn('Failed to save paper trades', e);
  }
}

export function clearUserPaperTrades() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear paper trades', e);
  }
}

export function addUserPaperTrade(newTrade: Omit<UserPaperTrade, 'id' | 'openTime' | 'status' | 'pnlAmount' | 'pnlPercent'>): UserPaperTrade {
  const trades = getUserPaperTrades();
  const trade: UserPaperTrade = {
    ...newTrade,
    id: 'trade_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    openTime: Date.now(),
    status: 'OPEN',
    pnlAmount: 0,
    pnlPercent: 0,
  };
  trades.unshift(trade);
  saveUserPaperTrades(trades);
  return trade;
}

export function updateOpenPaperTradesWithLivePrice(currentSymbol: string, currentPrice: number): UserPaperTrade[] {
  if (!currentPrice || currentPrice <= 0) return getUserPaperTrades();

  const trades = getUserPaperTrades();
  let hasChanges = false;

  const updated = trades.map(trade => {
    if (trade.status !== 'OPEN' || trade.symbol !== currentSymbol) {
      return trade;
    }

    const isBuy = trade.action === 'BUY';
    const priceDiff = isBuy ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
    const rawPct = (priceDiff / trade.entryPrice) * 100;
    const leveragedPct = rawPct * (trade.leverage || 1);
    const pnl = (trade.capital * (leveragedPct / 100));

    // Check Stop Loss Trigger
    const isSlHit = isBuy ? currentPrice <= trade.stopLoss : currentPrice >= trade.stopLoss;
    if (isSlHit) {
      hasChanges = true;
      const finalDiff = isBuy ? trade.stopLoss - trade.entryPrice : trade.entryPrice - trade.stopLoss;
      const finalPct = (finalDiff / trade.entryPrice) * 100 * (trade.leverage || 1);
      return {
        ...trade,
        status: 'SL_HIT' as const,
        closeTime: Date.now(),
        exitPrice: trade.stopLoss,
        pnlPercent: parseFloat(finalPct.toFixed(2)),
        pnlAmount: parseFloat((trade.capital * (finalPct / 100)).toFixed(2)),
      };
    }

    // Check Take Profit Trigger
    const isTpHit = isBuy ? currentPrice >= trade.takeProfit : currentPrice <= trade.takeProfit;
    if (isTpHit) {
      hasChanges = true;
      const finalDiff = isBuy ? trade.takeProfit - trade.entryPrice : trade.entryPrice - trade.takeProfit;
      const finalPct = (finalDiff / trade.entryPrice) * 100 * (trade.leverage || 1);
      return {
        ...trade,
        status: 'TP_HIT' as const,
        closeTime: Date.now(),
        exitPrice: trade.takeProfit,
        pnlPercent: parseFloat(finalPct.toFixed(2)),
        pnlAmount: parseFloat((trade.capital * (finalPct / 100)).toFixed(2)),
      };
    }

    // Still Open: Update Live floating PnL
    return {
      ...trade,
      pnlPercent: parseFloat(leveragedPct.toFixed(2)),
      pnlAmount: parseFloat(pnl.toFixed(2)),
    };
  });

  if (hasChanges) {
    saveUserPaperTrades(updated);
  }
  return updated;
}

export function closePaperTradeManually(tradeId: string, currentPrice: number): UserPaperTrade[] {
  const trades = getUserPaperTrades();
  const updated = trades.map(trade => {
    if (trade.id !== tradeId || trade.status !== 'OPEN') return trade;

    const isBuy = trade.action === 'BUY';
    const exitPrice = currentPrice || trade.entryPrice;
    const priceDiff = isBuy ? exitPrice - trade.entryPrice : trade.entryPrice - exitPrice;
    const finalPct = (priceDiff / trade.entryPrice) * 100 * (trade.leverage || 1);

    return {
      ...trade,
      status: 'CLOSED_MANUAL' as const,
      closeTime: Date.now(),
      exitPrice: exitPrice,
      pnlPercent: parseFloat(finalPct.toFixed(2)),
      pnlAmount: parseFloat((trade.capital * (finalPct / 100)).toFixed(2)),
    };
  });

  saveUserPaperTrades(updated);
  return updated;
}
