import { beforeEach, describe, expect, it } from 'vitest';
import { MarketSymbol } from '../../../types';
import {
  createNewUserProfile,
  DEFAULT_INDICATOR_SETTINGS,
  deleteUserProfile,
  loadActiveUserProfile,
  loadAllUserProfiles,
  sortSymbolsWithFavoritesFirst,
  switchActiveUserProfile,
  syncActiveUserProfilePatch,
  updateUserProfileMetadata,
} from '../userProfileManager';

const sampleSymbols: MarketSymbol[] = [
  {
    symbol: 'XAUUSD',
    name: 'Spot Gold',
    baseAsset: 'XAU',
    quoteAsset: 'USD',
    price: 4575,
    change24h: 0.8,
    high24h: 4590,
    low24h: 4540,
    volume24h: 120000,
    type: 'commodity',
  },
  {
    symbol: 'BTCUSDT',
    name: 'Bitcoin',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    price: 79800,
    change24h: 1.5,
    high24h: 80500,
    low24h: 78500,
    volume24h: 35000,
    type: 'crypto',
  },
  {
    symbol: 'FPT',
    name: 'FPT Corp',
    baseAsset: 'FPT',
    quoteAsset: 'VND',
    price: 132.5,
    change24h: 2.1,
    high24h: 133.2,
    low24h: 130.0,
    volume24h: 4500000,
    type: 'vn30',
  },
  {
    symbol: 'HPG',
    name: 'Hoa Phat Group',
    baseAsset: 'HPG',
    quoteAsset: 'VND',
    price: 27.4,
    change24h: 0.9,
    high24h: 27.6,
    low24h: 27.0,
    volume24h: 18000000,
    type: 'vn30',
  },
];

describe('Local User Profile Manager & Starred Symbol Top-Pinning', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
    };
    (globalThis as any).localStorage = mockStorage;
    (globalThis as any).window = {
      localStorage: mockStorage,
      dispatchEvent: () => true,
    };
  });

  it('1. pins starred (favorite) symbols to the top of any watchlist while preserving non-starred order', () => {
    const favorites = ['HPG', 'FPT'];
    const sorted = sortSymbolsWithFavoritesFirst(sampleSymbols, favorites);

    expect(sorted.map((s) => s.symbol)).toEqual(['HPG', 'FPT', 'XAUUSD', 'BTCUSDT']);
  });

  it('2. persists active symbol, timeframe, and custom indicator settings across F5 reloads', () => {
    const initial = loadActiveUserProfile();
    expect(initial.id).toBe('usr_default');

    syncActiveUserProfilePatch({
      activeSymbol: 'FPT',
      timeframe: '1D',
      indicatorSettings: {
        ...DEFAULT_INDICATOR_SETTINGS,
        ema20: true,
        vwap: true,
        volumeProfile: true,
      },
      favorites: ['FPT', 'HPG'],
    });

    // Simulate F5 reload by reading fresh from storage
    const afterReload = loadActiveUserProfile();
    expect(afterReload.activeSymbol).toBe('FPT');
    expect(afterReload.timeframe).toBe('1D');
    expect(afterReload.indicatorSettings.ema20).toBe(true);
    expect(afterReload.indicatorSettings.vwap).toBe(true);
    expect(afterReload.indicatorSettings.volumeProfile).toBe(true);
    expect(afterReload.favorites).toEqual(['FPT', 'HPG']);
  });

  it('3. creates multiple local user profiles, switches workspaces cleanly, renames, and deletes', () => {
    // Setup Default User
    syncActiveUserProfilePatch({
      activeSymbol: 'BTCUSDT',
      timeframe: '4h',
    });
    const defaultUser = loadActiveUserProfile();

    // Create second user with VN Spot Pro preset
    const vnSpotUser = createNewUserProfile({
      name: 'Tài khoản Spot VN',
      avatarColor: 'emerald',
      presetType: 'vn_spot_pro',
    });

    expect(vnSpotUser.name).toBe('Tài khoản Spot VN');
    expect(vnSpotUser.activeSymbol).toBe('FPT');
    expect(vnSpotUser.timeframe).toBe('1D');
    expect(vnSpotUser.indicatorSettings.ema20).toBe(true);
    expect(loadAllUserProfiles()).toHaveLength(2);

    // Switch back to Default User
    const switchedBack = switchActiveUserProfile(defaultUser.id);
    expect(switchedBack?.activeSymbol).toBe('BTCUSDT');
    expect(switchedBack?.timeframe).toBe('4h');

    // Rename VN Spot User
    const renamedList = updateUserProfileMetadata({
      profileId: vnSpotUser.id,
      name: 'Spot TTCK Việt Nam Pro',
    });
    expect(renamedList.find((p) => p.id === vnSpotUser.id)?.name).toBe('Spot TTCK Việt Nam Pro');

    // Delete VN Spot User
    const afterDelete = deleteUserProfile(vnSpotUser.id);
    expect(afterDelete.profiles).toHaveLength(1);
    expect(afterDelete.activeProfile.id).toBe(defaultUser.id);
  });
});
