import { AIPrediction, Candle, ForecastAuditEntry, ForecastAuditStats, MarketSymbol, Timeframe } from '../../types';

const AUDIT_STORAGE_KEY = 'quant_ai_kronos_audit_log_v1';
const MAX_AUDIT_ENTRIES = 80;

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1D': 86400,
  '1W': 604800,
  '1M': 2592000,
};

export function loadForecastAuditEntries(): ForecastAuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (x): x is ForecastAuditEntry =>
          Boolean(x && typeof x.id === 'string' && typeof x.symbol === 'string' && typeof x.entryPrice === 'number')
      );
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

function saveForecastAuditEntries(entries: ForecastAuditEntry[]): void {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_AUDIT_ENTRIES)));
  } catch {
    // ignore quota errors
  }
}

// Record a real Kronos forecast checkpoint (uses a practical +4 bar verification checkpoint so users can audit real outcomes quickly, or manual pin)
export function recordKronosForecastCheckpoint(
  prediction: AIPrediction,
  timeframe: Timeframe,
  lastCandleTimeSec: number,
  forceManualPin: boolean = false
): ForecastAuditEntry[] {
  const entries = loadForecastAuditEntries();
  if (!prediction.medianForecast || prediction.medianForecast.length === 0 || prediction.currentPrice <= 0) {
    return entries;
  }

  // Use +4 bars checkpoint (or final bar if shorter) so real candle closure can be verified within a practical trading session
  const checkpointIdx = Math.min(3, prediction.medianForecast.length - 1);
  const checkpointBar = prediction.medianForecast[checkpointIdx];
  const horizonBars = checkpointIdx + 1;
  const barSec = TIMEFRAME_SECONDS[timeframe] || 3600;
  const createdAt = Math.floor(Date.now() / 1000);
  const targetTimestamp =
    checkpointBar.time > lastCandleTimeSec
      ? checkpointBar.time
      : lastCandleTimeSec + horizonBars * barSec;

  // Throttle auto-recording: avoid duplicate pending entry for same symbol + timeframe within 2 bars unless manually pinned
  if (!forceManualPin) {
    const recentExisting = entries.find(
      e =>
        e.symbol === prediction.symbol &&
        e.timeframe === timeframe &&
        (e.status === 'PENDING' || Math.abs(createdAt - e.createdAt) < Math.max(1800, barSec * 2))
    );
    if (recentExisting) {
      return entries;
    }
  }

  const predPrice = checkpointBar.price;
  const predChangePct = parseFloat(
    (((predPrice - prediction.currentPrice) / prediction.currentPrice) * 100).toFixed(2)
  );
  const predictedDirection: ForecastAuditEntry['predictedDirection'] =
    predChangePct > 0.08 ? 'BULLISH' : predChangePct < -0.08 ? 'BEARISH' : 'NEUTRAL';

  const newEntry: ForecastAuditEntry = {
    id: `${prediction.symbol}_${timeframe}_${createdAt}`,
    symbol: prediction.symbol,
    timeframe,
    createdAt,
    targetTimestamp,
    horizonBars,
    entryPrice: prediction.currentPrice,
    predictedPriceP50: predPrice,
    predictedChangePct: predChangePct,
    predictedDirection,
    modelKey: prediction.kronosMeta?.modelName || 'Kronos',
    status: 'PENDING',
  };

  const next = [newEntry, ...entries].slice(0, MAX_AUDIT_ENTRIES);
  saveForecastAuditEntries(next);
  return next;
}

// Reconcile pending audit entries strictly against REAL market candles & real live prices once targetTimestamp has passed
export function reconcileForecastAuditLog(
  activeSymbol: string,
  activeTimeframe: Timeframe,
  candles: Candle[],
  liveSymbols: MarketSymbol[]
): ForecastAuditEntry[] {
  const entries = loadForecastAuditEntries();
  if (entries.length === 0) return entries;

  const nowSec = Math.floor(Date.now() / 1000);
  const liveMap = new Map(liveSymbols.map(s => [s.symbol, s.price]));
  let mutated = false;

  const updated = entries.map(entry => {
    if (entry.status === 'VERIFIED') return entry;
    if (nowSec < entry.targetTimestamp) return entry;

    let actualPrice: number | undefined;

    // 1. Prefer exact closed historical candle matching targetTimestamp when viewing same symbol & timeframe
    if (entry.symbol === activeSymbol && entry.timeframe === activeTimeframe && candles.length > 0) {
      const matchedCandle = candles.find(c => c.time >= entry.targetTimestamp);
      if (matchedCandle && matchedCandle.close > 0) {
        actualPrice = matchedCandle.close;
      }
    }

    // 2. Fallback to real synced live price if targetTimestamp has already elapsed
    if (actualPrice === undefined) {
      const livePrice = liveMap.get(entry.symbol);
      if (typeof livePrice === 'number' && livePrice > 0) {
        actualPrice = livePrice;
      }
    }

    if (actualPrice === undefined || entry.entryPrice <= 0) return entry;

    const actualChangePct = parseFloat(
      (((actualPrice - entry.entryPrice) / entry.entryPrice) * 100).toFixed(2)
    );
    const absErrorPct = parseFloat(
      ((Math.abs(actualPrice - entry.predictedPriceP50) / actualPrice) * 100).toFixed(2)
    );

    const directionHit =
      entry.predictedDirection === 'NEUTRAL'
        ? Math.abs(actualChangePct) < 0.35
        : entry.predictedDirection === 'BULLISH'
        ? actualChangePct > 0
        : actualChangePct < 0;

    mutated = true;
    return {
      ...entry,
      status: 'VERIFIED' as const,
      actualPrice,
      actualChangePct,
      absErrorPct,
      directionHit,
      verifiedAt: nowSec,
    };
  });

  if (mutated) {
    saveForecastAuditEntries(updated);
  }
  return updated;
}

export function clearForecastAuditLog(): ForecastAuditEntry[] {
  try {
    localStorage.removeItem(AUDIT_STORAGE_KEY);
  } catch {
    // ignore
  }
  return [];
}

export function computeForecastAuditStats(entries: ForecastAuditEntry[]): ForecastAuditStats {
  const verified = entries.filter(e => e.status === 'VERIFIED');
  const pendingCount = entries.length - verified.length;

  if (verified.length === 0) {
    return {
      totalRecorded: entries.length,
      verifiedCount: 0,
      pendingCount,
      directionalHitRate: null,
      meanAbsErrorPct: null,
    };
  }

  const hits = verified.filter(e => e.directionHit).length;
  const sumErr = verified.reduce((s, e) => s + (e.absErrorPct ?? 0), 0);

  return {
    totalRecorded: entries.length,
    verifiedCount: verified.length,
    pendingCount,
    directionalHitRate: Math.round((hits / verified.length) * 100),
    meanAbsErrorPct: parseFloat((sumErr / verified.length).toFixed(2)),
  };
}
