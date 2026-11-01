import { Candle, MacroIntelligenceSnapshot, MarketSymbol } from '../../types';
import { scanMarketAccumulation } from '../ai/accumulationScanner';
import { calculateRSI } from '../indicators';
import {
  computeVn30BasisAnalytics,
  computeVnIntradaySessionPulse,
  computeVnPriceLimits,
} from '../vnMarket/vnStockMicrostructure';
import {
  getCachedVnForeignFlow,
  getCachedVnFundamentals,
} from '../vnMarket/vnStockInsightsClient';

export type SmartAlertConditionType =
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'CHANGE_24H_ABOVE'
  | 'CHANGE_24H_BELOW'
  | 'RSI_OVERBOUGHT'
  | 'RSI_OVERSOLD'
  | 'FED_PIVOT_AT_LEAST'
  | 'ACCUMULATION_HOT_BUY'
  | 'VN_VOLUME_BREAKOUT'
  | 'VN_NEAR_FLOOR_WARNING'
  | 'VN30F_BASIS_EXTREME'
  | 'VN_FOREIGN_NET_BUY';

export interface SmartAlertRule {
  id: string;
  symbol: string; // e.g., 'BTCUSDT', 'XAUUSD', 'FPT', or 'GLOBAL' for macro rules
  condition: SmartAlertConditionType;
  threshold: number;
  note?: string;
  enabled: boolean;
  oneShot: boolean;
  cooldownMinutes: number;
  lastTriggeredAtMs?: number;
  createdAtMs: number;
}

export interface TriggeredAlertEvent {
  id: string;
  ruleId: string;
  symbol: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  triggeredAtMs: number;
  read: boolean;
  deliveredTelegram?: boolean;
}

export interface AlertPreferences {
  soundEnabled: boolean;
  browserPushEnabled: boolean;
  telegramAutoForward: boolean;
  autoForwardMacroPivotAlerts: boolean;
  customTelegramChatId: string;
}

const RULES_STORAGE_KEY = 'trading_new_smart_alert_rules_v1';
const HISTORY_STORAGE_KEY = 'trading_new_smart_alert_history_v1';
const PREFS_STORAGE_KEY = 'trading_new_smart_alert_prefs_v1';
const FORWARDED_MACRO_IDS_KEY = 'trading_new_forwarded_macro_alert_ids_v1';

export const SMART_ALERTS_UPDATED_EVENT = 'trading_new_smart_alerts_updated';

function emitAlertsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SMART_ALERTS_UPDATED_EVENT));
  }
}

export function loadSmartAlertRules(): SmartAlertRule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSmartAlertRules(rules: SmartAlertRule[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    emitAlertsUpdated();
  } catch {
    // ignore quota errors
  }
}

export function loadTriggeredAlertHistory(): TriggeredAlertEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTriggeredAlertHistory(events: TriggeredAlertEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(events.slice(0, 60)));
    emitAlertsUpdated();
  } catch {
    // ignore
  }
}

export function markAllAlertsAsRead(): TriggeredAlertEvent[] {
  const current = loadTriggeredAlertHistory();
  const next = current.map(e => (e.read ? e : { ...e, read: true }));
  saveTriggeredAlertHistory(next);
  return next;
}

export function clearTriggeredAlertHistory(): void {
  saveTriggeredAlertHistory([]);
}

export function loadAlertPreferences(): AlertPreferences {
  const defaults: AlertPreferences = {
    soundEnabled: true,
    browserPushEnabled: false,
    telegramAutoForward: false,
    autoForwardMacroPivotAlerts: true,
    customTelegramChatId: '',
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw);
    return {
      soundEnabled: typeof p?.soundEnabled === 'boolean' ? p.soundEnabled : true,
      browserPushEnabled: typeof p?.browserPushEnabled === 'boolean' ? p.browserPushEnabled : false,
      telegramAutoForward: typeof p?.telegramAutoForward === 'boolean' ? p.telegramAutoForward : false,
      autoForwardMacroPivotAlerts:
        typeof p?.autoForwardMacroPivotAlerts === 'boolean' ? p.autoForwardMacroPivotAlerts : true,
      customTelegramChatId: typeof p?.customTelegramChatId === 'string' ? p.customTelegramChatId : '',
    };
  } catch {
    return defaults;
  }
}

export function saveAlertPreferences(prefs: AlertPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    emitAlertsUpdated();
  } catch {
    // ignore
  }
}

export function createSmartAlertRule(input: {
  symbol: string;
  condition: SmartAlertConditionType;
  threshold: number;
  note?: string;
  oneShot?: boolean;
  cooldownMinutes?: number;
}): SmartAlertRule {
  const rule: SmartAlertRule = {
    id: `alr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    symbol: input.symbol.toUpperCase(),
    condition: input.condition,
    threshold: Number(input.threshold),
    note: input.note?.trim() || undefined,
    enabled: true,
    oneShot: input.oneShot ?? true,
    cooldownMinutes: input.cooldownMinutes ?? 30,
    createdAtMs: Date.now(),
  };
  const rules = [rule, ...loadSmartAlertRules()];
  saveSmartAlertRules(rules);
  return rule;
}

export function playTerminalAlertChime(severity: TriggeredAlertEvent['severity'] = 'INFO'): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const freqs =
      severity === 'CRITICAL'
        ? [880, 660, 880]
        : severity === 'SUCCESS'
        ? [587.33, 880]
        : [659.25, 783.99];

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.11);
      gain.gain.setValueAtTime(0.001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.105);
    });

    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Browser autoplay policy may block audio before user gesture
  }
}

export function fireBrowserNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag: `trading-new-${Date.now()}`,
    });
  } catch {
    // Fallback via service worker registration if mobile browser requires SW showNotification
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, { body }))
        .catch(() => {});
    }
  }
}

export async function checkTelegramServerStatus(): Promise<{
  configured: boolean;
  mode: string;
}> {
  try {
    const res = await fetch('/api/telegram-notify', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return { configured: false, mode: 'UNAVAILABLE' };
    const data = await res.json();
    return {
      configured: Boolean(data?.configured),
      mode: String(data?.mode || 'ENV_NOT_SET'),
    };
  } catch {
    return { configured: false, mode: 'OFFLINE_OR_DEV' };
  }
}

export async function dispatchTelegramNotification(payload: {
  title: string;
  message: string;
  severity?: TriggeredAlertEvent['severity'];
  symbol?: string;
  chatId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/telegram-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.error || `HTTP ${res.status}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Lỗi kết nối API Telegram',
    };
  }
}

export function getConditionLabelVi(cond: SmartAlertConditionType): string {
  switch (cond) {
    case 'PRICE_ABOVE':
      return 'Giá chạm / vượt lên ≥';
    case 'PRICE_BELOW':
      return 'Giá chạm / giảm xuống ≤';
    case 'CHANGE_24H_ABOVE':
      return 'Biến động 24h tăng ≥ (%)';
    case 'CHANGE_24H_BELOW':
      return 'Biến động 24h giảm ≤ (%)';
    case 'RSI_OVERBOUGHT':
      return 'RSI(14) quá mua ≥';
    case 'RSI_OVERSOLD':
      return 'RSI(14) quá bán ≤';
    case 'FED_PIVOT_AT_LEAST':
      return 'Fed Pivot Score đạt ≥';
    case 'ACCUMULATION_HOT_BUY':
      return 'Lọt vùng gom hàng HOT_BUY';
    case 'VN_VOLUME_BREAKOUT':
      return 'VN Nổ Vol RVOL nội ngày ≥ (x)';
    case 'VN_NEAR_FLOOR_WARNING':
      return 'VN Cảnh báo sát Sàn ≤ (%)';
    case 'VN30F_BASIS_EXTREME':
      return 'VN30F1M Lệch Basis |đ| ≥';
    case 'VN_FOREIGN_NET_BUY':
      return 'VN Khối ngoại mua ròng ≥ (tỷ)';
  }
}

/**
 * Pure deterministic rule evaluation engine (testable in isolation without DOM/network).
 */
export function evaluateAlertRulesPure(params: {
  rules: SmartAlertRule[];
  symbols: MarketSymbol[];
  activeSymbol?: string;
  activeCandles?: Candle[];
  macroSnapshot?: MacroIntelligenceSnapshot | null;
  nowMs?: number;
}): {
  updatedRules: SmartAlertRule[];
  newlyTriggered: TriggeredAlertEvent[];
  rulesChanged: boolean;
} {
  const {
    rules,
    symbols,
    activeSymbol,
    activeCandles = [],
    macroSnapshot = null,
    nowMs = Date.now(),
  } = params;

  if (rules.length === 0) {
    return { updatedRules: rules, newlyTriggered: [], rulesChanged: false };
  }

  const symMap = new Map<string, MarketSymbol>();
  for (const s of symbols) {
    symMap.set(s.symbol.toUpperCase(), s);
  }

  let activeRsi14: number | null = null;
  if (activeCandles.length >= 16) {
    const rsiArr = calculateRSI(activeCandles, 14);
    const lastRsi = rsiArr[rsiArr.length - 1]?.value;
    if (typeof lastRsi === 'number' && Number.isFinite(lastRsi)) {
      activeRsi14 = parseFloat(lastRsi.toFixed(1));
    }
  }

  let hotBuySet: Set<string> | null = null;
  const newlyTriggered: TriggeredAlertEvent[] = [];
  let rulesChanged = false;

  const updatedRules = rules.map(rule => {
    if (!rule.enabled) return rule;

    const cooldownMs = Math.max(1, rule.cooldownMinutes || 30) * 60_000;
    if (rule.lastTriggeredAtMs && nowMs - rule.lastTriggeredAtMs < cooldownMs) {
      return rule;
    }

    const targetSym = symMap.get(rule.symbol.toUpperCase());
    let matched = false;
    let title = '';
    let message = '';
    let severity: TriggeredAlertEvent['severity'] = 'INFO';

    switch (rule.condition) {
      case 'PRICE_ABOVE': {
        if (targetSym && targetSym.price > 0 && targetSym.price >= rule.threshold) {
          matched = true;
          severity = 'SUCCESS';
          title = `${targetSym.symbol} vượt mốc ${rule.threshold}`;
          message = `Giá thực tế hiện tại đạt ${targetSym.price} (≥ mục tiêu ${rule.threshold}, 24h: ${targetSym.change24h >= 0 ? '+' : ''}${targetSym.change24h}%).`;
        }
        break;
      }
      case 'PRICE_BELOW': {
        if (targetSym && targetSym.price > 0 && targetSym.price <= rule.threshold) {
          matched = true;
          severity = 'WARNING';
          title = `${targetSym.symbol} chạm vùng hỗ trợ ≤ ${rule.threshold}`;
          message = `Giá thực tế hiện tại lùi về ${targetSym.price} (≤ ngưỡng ${rule.threshold}, 24h: ${targetSym.change24h >= 0 ? '+' : ''}${targetSym.change24h}%).`;
        }
        break;
      }
      case 'CHANGE_24H_ABOVE': {
        if (targetSym && targetSym.change24h >= rule.threshold) {
          matched = true;
          severity = 'SUCCESS';
          title = `${targetSym.symbol} bứt phá +${targetSym.change24h}%`;
          message = `Biến động 24h đạt +${targetSym.change24h}% (≥ ngưỡng +${rule.threshold}%), giá hiện tại: ${targetSym.price}.`;
        }
        break;
      }
      case 'CHANGE_24H_BELOW': {
        const negTarget = -Math.abs(rule.threshold);
        if (targetSym && targetSym.change24h <= negTarget) {
          matched = true;
          severity = 'WARNING';
          title = `${targetSym.symbol} điều chỉnh mạnh ${targetSym.change24h}%`;
          message = `Biến động 24h giảm ${targetSym.change24h}% (≤ ngưỡng ${negTarget}%), giá hiện tại: ${targetSym.price}.`;
        }
        break;
      }
      case 'RSI_OVERBOUGHT': {
        if (
          activeSymbol &&
          activeSymbol.toUpperCase() === rule.symbol.toUpperCase() &&
          activeRsi14 !== null &&
          activeRsi14 >= rule.threshold
        ) {
          matched = true;
          severity = 'WARNING';
          title = `${rule.symbol}: RSI(14) chạm vùng Quá Mua (${activeRsi14})`;
          message = `Chỉ báo RSI(14) đạt ${activeRsi14} (≥ ${rule.threshold}) — lưu ý rủi ro chốt lời ngắn hạn.`;
        }
        break;
      }
      case 'RSI_OVERSOLD': {
        if (
          activeSymbol &&
          activeSymbol.toUpperCase() === rule.symbol.toUpperCase() &&
          activeRsi14 !== null &&
          activeRsi14 <= rule.threshold
        ) {
          matched = true;
          severity = 'SUCCESS';
          title = `${rule.symbol}: RSI(14) lọt vùng Quá Bán (${activeRsi14})`;
          message = `Chỉ báo RSI(14) giảm về ${activeRsi14} (≤ ${rule.threshold}) — quan sát tín hiệu phân kỳ hồi phục hoặc gom DCA.`;
        }
        break;
      }
      case 'FED_PIVOT_AT_LEAST': {
        const pivotScore = macroSnapshot?.fedPivotV2?.pivotScore;
        if (typeof pivotScore === 'number' && pivotScore >= rule.threshold) {
          matched = true;
          severity = 'CRITICAL';
          title = `Fed Pivot Score đạt ${pivotScore.toFixed(1)}/7 (${macroSnapshot?.fedPivotV2?.statusLabel || ''})`;
          message = `Điểm hội tụ tín hiệu Fed Pivot vượt ngưỡng ${rule.threshold}/7. Kịch bản chủ đạo: ${macroSnapshot?.fedPivotV2?.dominantScenarioLabel || 'Đang theo dõi'}.`;
        }
        break;
      }
      case 'ACCUMULATION_HOT_BUY': {
        if (!hotBuySet) {
          const scanned = scanMarketAccumulation(symbols);
          hotBuySet = new Set(
            scanned.filter(x => x.status === 'HOT_BUY').map(x => x.symbol.toUpperCase())
          );
        }
        if (hotBuySet.has(rule.symbol.toUpperCase()) && targetSym) {
          matched = true;
          severity = 'SUCCESS';
          title = `${targetSym.symbol} lọt Vùng Gom Siêu Đẹp (HOT_BUY)`;
          message = `AI Scanner xác nhận ${targetSym.symbol} vào vùng chiết khấu tích sản hấp dẫn quanh giá ${targetSym.price}.`;
        }
        break;
      }
      case 'VN_VOLUME_BREAKOUT': {
        if (targetSym && targetSym.change24h >= 1.5) {
          const isTargetActive =
            activeSymbol && activeSymbol.toUpperCase() === rule.symbol.toUpperCase();
          const pulse = computeVnIntradaySessionPulse(
            isTargetActive ? activeCandles : [],
            new Date(nowMs)
          );
          if (
            pulse.timeNormalizedRvol !== null &&
            pulse.timeNormalizedRvol >= rule.threshold
          ) {
            matched = true;
            severity = 'SUCCESS';
            title = `⚡ ${targetSym.symbol} Nổ Vol Đột Biến (${pulse.timeNormalizedRvol.toFixed(2)}x TB20)`;
            message = `Dòng tiền nội ngày cuộn vào ${targetSym.symbol} gấp ${pulse.timeNormalizedRvol.toFixed(2)}x trung bình 20 phiên cùng khung giờ (${pulse.phaseLabel}), giá tăng +${targetSym.change24h}% lên ${targetSym.price}k!`;
          }
        }
        break;
      }
      case 'VN_NEAR_FLOOR_WARNING': {
        if (targetSym && targetSym.price > 0) {
          const fund = getCachedVnFundamentals(targetSym.symbol);
          const limits = computeVnPriceLimits({
            symbol: targetSym.symbol,
            currentPrice: targetSym.price,
            change24hPct: targetSym.change24h,
            officialRefPrice: fund?.officialRefPrice,
            officialCeilingPrice: fund?.officialCeilingPrice,
            officialFloorPrice: fund?.officialFloorPrice,
          });
          if (
            limits.floorPrice !== null &&
            limits.distToFloorPct !== null &&
            limits.distToFloorPct <= rule.threshold
          ) {
            matched = true;
            severity = 'CRITICAL';
            title = `🚨 CẢNH BÁO SÁT SÀN: ${targetSym.symbol} cách Sàn ${limits.distToFloorPct}%`;
            message = `${targetSym.symbol} lùi về ${targetSym.price}k (Sàn ${limits.board}: ${limits.floorPrice}k, biên -${limits.bandPct}%). Cẩn trọng rủi ro trắng bên mua nhốt thanh khoản T+2 & Call Margin chéo!`;
          }
        }
        break;
      }
      case 'VN30F_BASIS_EXTREME': {
        const basis = computeVn30BasisAnalytics(symbols, new Date(nowMs));
        if (basis && Math.abs(basis.basisPoints) >= rule.threshold) {
          matched = true;
          severity = 'WARNING';
          const sign = basis.basisPoints >= 0 ? '+' : '';
          title = `⚖️ VN30F1M Lệch Basis ${sign}${basis.basisPoints} điểm (${basis.regimeLabel})`;
          message = `${basis.headline}. ${basis.guidance}`;
        }
        break;
      }
      case 'VN_FOREIGN_NET_BUY': {
        const flow = getCachedVnForeignFlow(rule.symbol);
        if (flow && flow.latestNetBillionVnd >= rule.threshold) {
          matched = true;
          severity = 'SUCCESS';
          title = `🌍 Khối ngoại gom mạnh ${rule.symbol}: +${flow.latestNetBillionVnd.toFixed(1)} tỷ VNĐ`;
          message = `Nhà đầu tư nước ngoài mua ròng +${flow.latestNetBillionVnd.toFixed(2)} tỷ VNĐ mã ${rule.symbol} (vượt ngưỡng +${rule.threshold} tỷ). Lũy kế 10 phiên: ${flow.total10dNetBillionVnd >= 0 ? '+' : ''}${flow.total10dNetBillionVnd.toFixed(1)} tỷ.`;
        }
        break;
      }
    }

    if (!matched) return rule;

    if (rule.note) {
      message += ` Ghi chú: ${rule.note}`;
    }

    rulesChanged = true;
    newlyTriggered.push({
      id: `evt_${nowMs}_${rule.id}`,
      ruleId: rule.id,
      symbol: rule.symbol,
      title,
      message,
      severity,
      triggeredAtMs: nowMs,
      read: false,
    });

    return {
      ...rule,
      lastTriggeredAtMs: nowMs,
      enabled: rule.oneShot ? false : true,
    };
  });

  return {
    updatedRules,
    newlyTriggered,
    rulesChanged,
  };
}

/**
 * Full runtime cycle: evaluates custom rules + new Fed Pivot V2 smart alerts,
 * persists history, plays Terminal chime, fires Browser Notification, and forwards to Telegram if enabled.
 */
export function runSmartAlertMonitoringCycle(params: {
  symbols: MarketSymbol[];
  activeSymbol?: string;
  activeCandles?: Candle[];
  macroSnapshot?: MacroIntelligenceSnapshot | null;
}): TriggeredAlertEvent[] {
  const rules = loadSmartAlertRules();
  const prefs = loadAlertPreferences();
  const nowMs = Date.now();

  const { updatedRules, newlyTriggered, rulesChanged } = evaluateAlertRulesPure({
    rules,
    symbols: params.symbols,
    activeSymbol: params.activeSymbol,
    activeCandles: params.activeCandles,
    macroSnapshot: params.macroSnapshot,
    nowMs,
  });

  if (rulesChanged) {
    saveSmartAlertRules(updatedRules);
  }

  // Optional auto-bridge for newly generated Fed Pivot V2 Smart Alerts
  const pivotAlerts = params.macroSnapshot?.fedPivotV2?.activeAlerts || [];
  if (prefs.autoForwardMacroPivotAlerts && pivotAlerts.length > 0 && typeof window !== 'undefined') {
    try {
      const seenRaw = window.localStorage.getItem(FORWARDED_MACRO_IDS_KEY);
      const seenIds = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);
      let seenUpdated = false;

      for (const pa of pivotAlerts) {
        if (!pa.isNew || seenIds.has(pa.id)) continue;
        seenIds.add(pa.id);
        seenUpdated = true;
        newlyTriggered.push({
          id: `evt_macro_${pa.id}`,
          ruleId: 'FED_PIVOT_V2_AUTO',
          symbol: 'FED_PIVOT',
          title: `[Fed Pivot ${pa.tier}] ${pa.whatChanged}`,
          message: `${pa.confirmingEvidence.join(' | ')} • Hành động: ${pa.actionableChecklist.join('; ')}`,
          severity: pa.tier === 'RISK_WARNING' ? 'CRITICAL' : 'INFO',
          triggeredAtMs: nowMs,
          read: false,
        });
      }

      if (seenUpdated) {
        window.localStorage.setItem(
          FORWARDED_MACRO_IDS_KEY,
          JSON.stringify(Array.from(seenIds).slice(-50))
        );
      }
    } catch {
      // ignore storage errors
    }
  }

  if (newlyTriggered.length > 0) {
    const existingHistory = loadTriggeredAlertHistory();
    const mergedHistory = [...newlyTriggered, ...existingHistory].slice(0, 60);
    saveTriggeredAlertHistory(mergedHistory);

    if (prefs.soundEnabled) {
      playTerminalAlertChime(newlyTriggered[0].severity);
    }

    for (const evt of newlyTriggered) {
      if (prefs.browserPushEnabled) {
        fireBrowserNotification(evt.title, evt.message);
      }
      if (prefs.telegramAutoForward) {
        void dispatchTelegramNotification({
          title: evt.title,
          message: evt.message,
          severity: evt.severity,
          symbol: evt.symbol,
          chatId: prefs.customTelegramChatId || undefined,
        });
      }
    }
  }

  return newlyTriggered;
}
