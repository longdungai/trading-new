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

const STORAGE_KEY = 'trading_ai_user_paper_trades_v2';

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

  // If Market Order: immediately OPEN at currentMarketPrice
  // If Limit Order: check if currentMarketPrice already touched/crossed entryPrice
  let initialStatus: UserPaperTrade['status'] = 'PENDING';
  let actualEntry = newTrade.entryPrice;

  if (isMarket) {
    initialStatus = 'OPEN';
    actualEntry = newTrade.currentMarketPrice;
  } else {
    // For Buy Limit: if currentMarketPrice <= entryPrice -> fill immediately
    // For Sell Limit: if currentMarketPrice >= entryPrice -> fill immediately
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

  // Ensure SL and TP are correctly positioned relative to actual entry price
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

export function updateOpenPaperTradesWithLivePrice(currentSymbol: string, currentPrice: number): UserPaperTrade[] {
  if (!currentPrice || currentPrice <= 0) return getUserPaperTrades();

  const trades = getUserPaperTrades();
  let hasChanges = false;

  const updated = trades.map(trade => {
    if (trade.symbol !== currentSymbol) return trade;

    const isBuy = trade.action === 'BUY';

    // 1. Check PENDING Orders -> Trigger Fill if price touches entry
    if (trade.status === 'PENDING') {
      const isEntryHit = isBuy
        ? currentPrice <= trade.entryPrice
        : currentPrice >= trade.entryPrice;

      if (isEntryHit) {
        hasChanges = true;
        return {
          ...trade,
          status: 'OPEN' as const,
          filledTime: Date.now(),
          entryPrice: currentPrice, // fill at current touch price
        };
      }
      return trade;
    }

    // 2. Check OPEN Orders for Live PnL & SL/TP Triggers
    if (trade.status === 'OPEN') {
      const priceDiff = isBuy ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
      const rawPct = (priceDiff / trade.entryPrice) * 100;
      const leveragedPct = rawPct * (trade.leverage || 1);
      const pnl = trade.capital * (leveragedPct / 100);

      // Check Stop Loss Trigger (Price crosses SL)
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

      // Check Take Profit Trigger (Price crosses TP)
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
    }

    return trade;
  });

  if (hasChanges) {
    saveUserPaperTrades(updated);
  }
  return updated;
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
        exitPrice: exitPrice,
        pnlPercent: parseFloat(finalPct.toFixed(2)),
        pnlAmount: parseFloat((trade.capital * (finalPct / 100)).toFixed(2)),
      };
    }

    return trade;
  });

  saveUserPaperTrades(updated);
  return updated;
}
