import { IndicatorSettings, KronosConfig, MarketSymbol, Timeframe } from '../../types';
import { DEFAULT_SYMBOLS } from '../api/marketData';
import {
  loadFavoritesFromStorage,
  loadSymbolsFromStorage,
  saveFavoritesToStorage,
  saveSymbolsToStorage,
  STORAGE_KEYS,
} from '../api/symbolCatalog';
import { loadKronosConfig, saveKronosConfig } from '../ai/kronosClient';
import {
  loadUserHoldings,
  USER_HOLDINGS_STORAGE_KEY,
  USER_HOLDINGS_UPDATED_EVENT,
  UserHoldingItem,
} from '../portfolio/holdingsRecoveryEngine';

export const USER_PROFILES_STORAGE_KEY = 'trading_new_local_user_profiles_v1';
export const ACTIVE_USER_PROFILE_ID_KEY = 'trading_new_active_user_profile_id_v1';
export const ACTIVE_TIMEFRAME_STORAGE_KEY = 'trading_new_active_timeframe_v1';
export const INDICATOR_SETTINGS_STORAGE_KEY = 'trading_new_indicator_settings_v1';
export const LAYOUT_PREFS_STORAGE_KEY = 'trading_new_layout_prefs_v1';
export const USER_PROFILE_CHANGED_EVENT = 'trading_new_user_profile_changed';

export type ProfileAvatarColor = 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple';

export interface UserLayoutPreferences {
  showLeftDock: boolean;
  isZenMode: boolean;
  rightPanelTab: 'ai' | 'market' | 'risk';
  compareSymbol: string | null;
}

export interface LocalUserProfile {
  id: string;
  name: string;
  avatarColor: ProfileAvatarColor;
  activeSymbol: string;
  timeframe: Timeframe;
  indicatorSettings: IndicatorSettings;
  kronosConfig: KronosConfig;
  favorites: string[];
  symbols: MarketSymbol[];
  holdings: Record<string, UserHoldingItem>;
  layoutPrefs: UserLayoutPreferences;
  createdAtMs: number;
  updatedAtMs: number;
}

export const DEFAULT_INDICATOR_SETTINGS: IndicatorSettings = {
  rsi: true,
  macd: true,
  autoSupportResistance: true,
  bollingerBands: true,
  ema20: false,
  ema50: false,
  ema200: false,
  supertrend: false,
  ichimoku: false,
  stochastic: false,
  vwap: false,
  volumeProfile: false,
  autoFibonacci: false,
  smartMoneyConcepts: false,
  aiForecast: true,
  monteCarloPaths: false,
  kronosGhostCandles: true,
  kronosWalkForward: true,
  vnPriceLimits: true,
  globalOptionsAndLiqLines: true,
  recommendedPlanLines: true,
  holdingCostLines: true,
  vnBottomFishingLines: true,
};

export const DEFAULT_LAYOUT_PREFS: UserLayoutPreferences = {
  showLeftDock: true,
  isZenMode: false,
  rightPanelTab: 'ai',
  compareSymbol: null,
};

const VALID_TIMEFRAMES: Set<Timeframe> = new Set([
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
  '1D',
  '1W',
  '1M',
]);

/**
 * Pure deterministic sorter: Starred (favorite) symbols are ALWAYS pinned to the top
 * of the list in their favorite order, while non-starred symbols keep their relative order.
 */
export function sortSymbolsWithFavoritesFirst(
  symbols: MarketSymbol[],
  favorites: string[]
): MarketSymbol[] {
  if (!Array.isArray(symbols) || symbols.length <= 1) return symbols;
  const favUpperOrder = new Map<string, number>();
  favorites.forEach((fav, idx) => {
    const key = String(fav || '').toUpperCase();
    if (key && !favUpperOrder.has(key)) {
      favUpperOrder.set(key, idx);
    }
  });

  if (favUpperOrder.size === 0) return [...symbols];

  return [...symbols]
    .map((item, originalIndex) => ({
      item,
      originalIndex,
      favIndex: favUpperOrder.get(item.symbol.toUpperCase()),
    }))
    .sort((a, b) => {
      const aIsFav = a.favIndex !== undefined;
      const bIsFav = b.favIndex !== undefined;
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      if (aIsFav && bIsFav) {
        return (a.favIndex as number) - (b.favIndex as number);
      }
      return a.originalIndex - b.originalIndex;
    })
    .map((entry) => entry.item);
}

export function loadPersistedActiveSymbolKey(fallbackSymbols?: MarketSymbol[]): string {
  const list = fallbackSymbols && fallbackSymbols.length > 0 ? fallbackSymbols : loadSymbolsFromStorage();
  const fallback = list[0]?.symbol || DEFAULT_SYMBOLS[0].symbol;
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEYS.LAST_SYMBOL);
    if (saved && typeof saved === 'string' && saved.trim()) {
      return saved.trim().toUpperCase();
    }
  } catch {
    // ignore storage errors
  }
  return fallback;
}

export function savePersistedActiveSymbolKey(symbol: string): void {
  if (typeof window === 'undefined' || !symbol) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.LAST_SYMBOL, symbol.trim().toUpperCase());
  } catch {
    // ignore
  }
}

export function loadPersistedTimeframe(): Timeframe {
  if (typeof window === 'undefined') return '1h';
  try {
    const raw = window.localStorage.getItem(ACTIVE_TIMEFRAME_STORAGE_KEY) as Timeframe | null;
    if (raw && VALID_TIMEFRAMES.has(raw)) {
      return raw;
    }
  } catch {
    // ignore
  }
  return '1h';
}

export function savePersistedTimeframe(tf: Timeframe): void {
  if (typeof window === 'undefined' || !VALID_TIMEFRAMES.has(tf)) return;
  try {
    window.localStorage.setItem(ACTIVE_TIMEFRAME_STORAGE_KEY, tf);
  } catch {
    // ignore
  }
}

export function loadPersistedIndicatorSettings(): IndicatorSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_INDICATOR_SETTINGS };
  try {
    const raw = window.localStorage.getItem(INDICATOR_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_INDICATOR_SETTINGS,
          ...parsed,
        };
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_INDICATOR_SETTINGS };
}

export function savePersistedIndicatorSettings(settings: IndicatorSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INDICATOR_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function loadPersistedLayoutPrefs(): UserLayoutPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_LAYOUT_PREFS };
  try {
    const raw = window.localStorage.getItem(LAYOUT_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_LAYOUT_PREFS,
          ...parsed,
        };
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_LAYOUT_PREFS };
}

export function savePersistedLayoutPrefs(prefs: UserLayoutPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAYOUT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function buildDefaultProfileFromCurrentStorage(): LocalUserProfile {
  const symbols = loadSymbolsFromStorage();
  const favorites = loadFavoritesFromStorage();
  const activeSymbol = loadPersistedActiveSymbolKey(symbols);
  const timeframe = loadPersistedTimeframe();
  const indicatorSettings = loadPersistedIndicatorSettings();
  const kronosConfig = loadKronosConfig();
  const holdings = loadUserHoldings();
  const layoutPrefs = loadPersistedLayoutPrefs();
  const now = Date.now();

  return {
    id: 'usr_default',
    name: 'Trader Mặc Định',
    avatarColor: 'cyan',
    activeSymbol,
    timeframe,
    indicatorSettings,
    kronosConfig,
    favorites,
    symbols,
    holdings,
    layoutPrefs,
    createdAtMs: now,
    updatedAtMs: now,
  };
}

export function loadAllUserProfiles(): LocalUserProfile[] {
  if (typeof window === 'undefined') {
    return [buildDefaultProfileFromCurrentStorage()];
  }
  try {
    const raw = window.localStorage.getItem(USER_PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p: LocalUserProfile) => ({
          ...p,
          indicatorSettings: {
            ...DEFAULT_INDICATOR_SETTINGS,
            ...(p.indicatorSettings || {}),
          },
          layoutPrefs: {
            ...DEFAULT_LAYOUT_PREFS,
            ...(p.layoutPrefs || {}),
          },
          favorites: Array.isArray(p.favorites) ? p.favorites : loadFavoritesFromStorage(),
          symbols: Array.isArray(p.symbols) && p.symbols.length > 0 ? p.symbols : DEFAULT_SYMBOLS,
          holdings: p.holdings && typeof p.holdings === 'object' ? p.holdings : {},
        }));
      }
    }
  } catch {
    // ignore
  }

  const initialProfile = buildDefaultProfileFromCurrentStorage();
  saveAllUserProfiles([initialProfile]);
  try {
    window.localStorage.setItem(ACTIVE_USER_PROFILE_ID_KEY, initialProfile.id);
  } catch {
    // ignore
  }
  return [initialProfile];
}

export function saveAllUserProfiles(profiles: LocalUserProfile[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // ignore
  }
}

export function loadActiveUserProfile(): LocalUserProfile {
  const profiles = loadAllUserProfiles();
  if (typeof window === 'undefined') return profiles[0];
  try {
    const activeId = window.localStorage.getItem(ACTIVE_USER_PROFILE_ID_KEY);
    if (activeId) {
      const found = profiles.find((p) => p.id === activeId);
      if (found) return found;
    }
  } catch {
    // ignore
  }
  return profiles[0];
}

function applyProfileToActiveStorageKeys(profile: LocalUserProfile): void {
  if (typeof window === 'undefined') return;
  savePersistedActiveSymbolKey(profile.activeSymbol);
  savePersistedTimeframe(profile.timeframe);
  savePersistedIndicatorSettings(profile.indicatorSettings);
  savePersistedLayoutPrefs(profile.layoutPrefs);
  saveFavoritesToStorage(profile.favorites);
  saveSymbolsToStorage(profile.symbols);
  saveKronosConfig(profile.kronosConfig);
  try {
    window.localStorage.setItem(USER_HOLDINGS_STORAGE_KEY, JSON.stringify(profile.holdings || {}));
    window.localStorage.setItem(ACTIVE_USER_PROFILE_ID_KEY, profile.id);
    window.dispatchEvent(new CustomEvent(USER_HOLDINGS_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

export function syncActiveUserProfilePatch(
  patch: Partial<
    Pick<
      LocalUserProfile,
      | 'activeSymbol'
      | 'timeframe'
      | 'indicatorSettings'
      | 'kronosConfig'
      | 'favorites'
      | 'symbols'
      | 'holdings'
      | 'layoutPrefs'
    >
  >
): LocalUserProfile {
  const profiles = loadAllUserProfiles();
  const active = loadActiveUserProfile();
  const updated: LocalUserProfile = {
    ...active,
    ...patch,
    holdings: patch.holdings !== undefined ? patch.holdings : loadUserHoldings(),
    updatedAtMs: Date.now(),
  };

  if (patch.activeSymbol !== undefined) {
    savePersistedActiveSymbolKey(patch.activeSymbol);
  }
  if (patch.timeframe !== undefined) {
    savePersistedTimeframe(patch.timeframe);
  }
  if (patch.indicatorSettings !== undefined) {
    savePersistedIndicatorSettings(patch.indicatorSettings);
  }
  if (patch.layoutPrefs !== undefined) {
    savePersistedLayoutPrefs(patch.layoutPrefs);
  }
  if (patch.favorites !== undefined) {
    saveFavoritesToStorage(patch.favorites);
  }
  if (patch.symbols !== undefined) {
    saveSymbolsToStorage(patch.symbols);
  }
  if (patch.kronosConfig !== undefined) {
    saveKronosConfig(patch.kronosConfig);
  }

  const nextProfiles = profiles.map((p) => (p.id === updated.id ? updated : p));
  saveAllUserProfiles(nextProfiles);
  return updated;
}

export function createNewUserProfile(params: {
  name: string;
  avatarColor?: ProfileAvatarColor;
  presetType?: 'clone_current' | 'vn_spot_pro' | 'gold_crypto_pro';
}): LocalUserProfile {
  const { name, avatarColor = 'emerald', presetType = 'clone_current' } = params;
  const profiles = loadAllUserProfiles();
  const current = loadActiveUserProfile();
  const now = Date.now();
  const cleanName = name.trim() || `User ${profiles.length + 1}`;

  let activeSymbol = current.activeSymbol;
  let timeframe: Timeframe = current.timeframe;
  let favorites = [...current.favorites];
  let indicatorSettings: IndicatorSettings = { ...current.indicatorSettings };
  let holdings: Record<string, UserHoldingItem> = {};

  if (presetType === 'vn_spot_pro') {
    activeSymbol = 'FPT';
    timeframe = '1D';
    favorites = ['FPT', 'HPG', 'SSI', 'VCB', 'MWG', 'VNINDEX', 'VIC', 'VHM', 'MSN'];
    indicatorSettings = {
      ...DEFAULT_INDICATOR_SETTINGS,
      ema20: true,
      ema50: true,
      vwap: true,
      volumeProfile: true,
      vnPriceLimits: true,
      recommendedPlanLines: true,
      holdingCostLines: true,
      vnBottomFishingLines: true,
    };
  } else if (presetType === 'gold_crypto_pro') {
    activeSymbol = 'XAUUSD';
    timeframe = '1h';
    favorites = ['XAUUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'PAXGUSDT', 'OIL_WTI', 'NVDA'];
    indicatorSettings = {
      ...DEFAULT_INDICATOR_SETTINGS,
      bollingerBands: true,
      smartMoneyConcepts: true,
      vwap: true,
      globalOptionsAndLiqLines: true,
      recommendedPlanLines: true,
    };
  } else {
    holdings = { ...current.holdings };
  }

  const newProfile: LocalUserProfile = {
    id: `usr_${now}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    avatarColor,
    activeSymbol,
    timeframe,
    indicatorSettings,
    kronosConfig: { ...current.kronosConfig },
    favorites,
    symbols: [...current.symbols],
    holdings,
    layoutPrefs: { ...current.layoutPrefs },
    createdAtMs: now,
    updatedAtMs: now,
  };

  const nextProfiles = [...profiles, newProfile];
  saveAllUserProfiles(nextProfiles);
  applyProfileToActiveStorageKeys(newProfile);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(USER_PROFILE_CHANGED_EVENT, { detail: { profile: newProfile } })
    );
  }

  return newProfile;
}

export function switchActiveUserProfile(profileId: string): LocalUserProfile | null {
  // First snapshot latest holdings into current profile before switching away
  const current = loadActiveUserProfile();
  const allCurrent = loadAllUserProfiles().map((p) =>
    p.id === current.id
      ? {
          ...p,
          holdings: loadUserHoldings(),
          updatedAtMs: Date.now(),
        }
      : p
  );

  const target = allCurrent.find((p) => p.id === profileId);
  if (!target) return null;

  saveAllUserProfiles(allCurrent);
  applyProfileToActiveStorageKeys(target);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(USER_PROFILE_CHANGED_EVENT, { detail: { profile: target } })
    );
  }
  return target;
}

export function updateUserProfileMetadata(params: {
  profileId: string;
  name: string;
  avatarColor?: ProfileAvatarColor;
}): LocalUserProfile[] {
  const { profileId, name, avatarColor } = params;
  const cleanName = name.trim();
  if (!cleanName) return loadAllUserProfiles();

  const next = loadAllUserProfiles().map((p) =>
    p.id === profileId
      ? {
          ...p,
          name: cleanName,
          avatarColor: avatarColor || p.avatarColor,
          updatedAtMs: Date.now(),
        }
      : p
  );
  saveAllUserProfiles(next);
  return next;
}

export function deleteUserProfile(profileId: string): {
  profiles: LocalUserProfile[];
  activeProfile: LocalUserProfile;
} {
  const all = loadAllUserProfiles();
  if (all.length <= 1) {
    return { profiles: all, activeProfile: all[0] };
  }
  const remaining = all.filter((p) => p.id !== profileId);
  saveAllUserProfiles(remaining);

  const currentActiveId =
    typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_USER_PROFILE_ID_KEY) : null;

  if (currentActiveId === profileId) {
    const nextActive = remaining[0];
    applyProfileToActiveStorageKeys(nextActive);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(USER_PROFILE_CHANGED_EVENT, { detail: { profile: nextActive } })
      );
    }
    return { profiles: remaining, activeProfile: nextActive };
  }

  return {
    profiles: remaining,
    activeProfile: remaining.find((p) => p.id === currentActiveId) || remaining[0],
  };
}
