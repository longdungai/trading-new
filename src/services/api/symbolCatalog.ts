import { MarketSymbol, MarketType } from '../../types';
import { DEFAULT_SYMBOLS } from './marketData';

export interface CatalogItem {
  symbol: string;
  name: string;
  type: MarketType;
  baseAsset: string;
  quoteAsset: string;
  category: string;
  defaultPrice: number;
}

// 300+ Popular Assets Catalog for Smart Autocomplete Suggestions
export const GLOBAL_SYMBOL_CATALOG: CatalogItem[] = [
  // ========== HÀNG HÓA: VÀNG & DẦU MỎ (COMMODITIES) ==========
  { symbol: 'XAUUSD', name: 'Vàng Thế Giới (Spot Gold)', type: 'commodity', baseAsset: 'XAU', quoteAsset: 'USD', category: 'Kim Loại Quý / Vàng Thế Giới', defaultPrice: 4575.65 },
  { symbol: 'PAXGUSDT', name: 'PAX Gold (Vàng số 1:1 Vàng thật)', type: 'crypto', baseAsset: 'PAXG', quoteAsset: 'USDT', category: 'Vàng Token Hóa (Binance)', defaultPrice: 4575.65 },
  { symbol: 'OIL_WTI', name: 'Dầu Thô WTI (Crude Oil)', type: 'commodity', baseAsset: 'WTI', quoteAsset: 'USD', category: 'Năng Lượng / Dầu Thô Mỹ', defaultPrice: 83.12 },
  { symbol: 'OIL_BRENT', name: 'Dầu Thô Brent (Brent Oil)', type: 'commodity', baseAsset: 'BRENT', quoteAsset: 'USD', category: 'Năng Lượng / Dầu Chuẩn Quốc Tế', defaultPrice: 88.20 },
  { symbol: 'SILVER', name: 'Bạc Thế Giới (Silver)', type: 'commodity', baseAsset: 'XAG', quoteAsset: 'USD', category: 'Kim Loại Quý / Bạc', defaultPrice: 69.56 },

  // ========== TOP CRYPTO (BINANCE) ==========
  { symbol: 'BTCUSDT', name: 'Bitcoin', type: 'crypto', baseAsset: 'BTC', quoteAsset: 'USDT', category: 'Top 1 Crypto / Store of Value', defaultPrice: 79842.47 },
  { symbol: 'ETHUSDT', name: 'Ethereum', type: 'crypto', baseAsset: 'ETH', quoteAsset: 'USDT', category: 'Top 2 Crypto / Smart Contracts', defaultPrice: 2489.60 },
  { symbol: 'SOLUSDT', name: 'Solana', type: 'crypto', baseAsset: 'SOL', quoteAsset: 'USDT', category: 'Top 3 / High Speed L1', defaultPrice: 106.93 },
  { symbol: 'BNBUSDT', name: 'BNB', type: 'crypto', baseAsset: 'BNB', quoteAsset: 'USDT', category: 'Top 4 / Binance Ecosystem', defaultPrice: 709.59 },
  { symbol: 'XRPUSDT', name: 'XRP', type: 'crypto', baseAsset: 'XRP', quoteAsset: 'USDT', category: 'Top 5 / Cross-Border Payments', defaultPrice: 1.4315 },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', type: 'crypto', baseAsset: 'DOGE', quoteAsset: 'USDT', category: 'Top 6 / Payment & Meme', defaultPrice: 0.08777 },
  { symbol: 'ADAUSDT', name: 'Cardano', type: 'crypto', baseAsset: 'ADA', quoteAsset: 'USDT', category: 'Top 7 / Layer 1 PoS', defaultPrice: 0.2101 },
  { symbol: 'AVAXUSDT', name: 'Avalanche', type: 'crypto', baseAsset: 'AVAX', quoteAsset: 'USDT', category: 'Top 8 / Scalable L1', defaultPrice: 7.441 },
  { symbol: 'SUIUSDT', name: 'Sui Network', type: 'crypto', baseAsset: 'SUI', quoteAsset: 'USDT', category: 'Top 9 / Next-Gen Move L1', defaultPrice: 0.7639 },
  { symbol: 'LINKUSDT', name: 'Chainlink', type: 'crypto', baseAsset: 'LINK', quoteAsset: 'USDT', category: 'Top 10 / Oracle & RWA', defaultPrice: 11.717 },
  { symbol: 'TRXUSDT', name: 'TRON', type: 'crypto', baseAsset: 'TRX', quoteAsset: 'USDT', category: 'Stablecoin Settlement L1', defaultPrice: 0.3384 },
  { symbol: 'NEARUSDT', name: 'NEAR Protocol', type: 'crypto', baseAsset: 'NEAR', quoteAsset: 'USDT', category: 'AI & Sharded L1', defaultPrice: 2.85 },
  { symbol: 'PEPEUSDT', name: 'Pepe', type: 'crypto', baseAsset: 'PEPE', quoteAsset: 'USDT', category: 'Top Meme Token', defaultPrice: 0.0000085 },
  { symbol: 'SHIBUSDT', name: 'Shiba Inu', type: 'crypto', baseAsset: 'SHIB', quoteAsset: 'USDT', category: 'Meme Ecosystem', defaultPrice: 0.0000185 },
  { symbol: 'TONUSDT', name: 'Toncoin (Telegram)', type: 'crypto', baseAsset: 'TON', quoteAsset: 'USDT', category: 'Telegram Web3 L1', defaultPrice: 5.42 },
  { symbol: 'WIFUSDT', name: 'dogwifhat', type: 'crypto', baseAsset: 'WIF', quoteAsset: 'USDT', category: 'Solana Meme Leader', defaultPrice: 1.85 },
  { symbol: 'APTUSDT', name: 'Aptos', type: 'crypto', baseAsset: 'APT', quoteAsset: 'USDT', category: 'Move Language L1', defaultPrice: 8.45 },
  { symbol: 'ARBUSDT', name: 'Arbitrum', type: 'crypto', baseAsset: 'ARB', quoteAsset: 'USDT', category: 'Ethereum Layer 2', defaultPrice: 0.58 },
  { symbol: 'OPUSDT', name: 'Optimism', type: 'crypto', baseAsset: 'OP', quoteAsset: 'USDT', category: 'Ethereum Layer 2', defaultPrice: 1.62 },
  { symbol: 'RENDERUSDT', name: 'Render Token', type: 'crypto', baseAsset: 'RENDER', quoteAsset: 'USDT', category: 'AI & GPU Computing', defaultPrice: 6.25 },
  { symbol: 'FETUSDT', name: 'Artificial Superintelligence Alliance', type: 'crypto', baseAsset: 'FET', quoteAsset: 'USDT', category: 'AI Ecosystem', defaultPrice: 1.34 },
  { symbol: 'INJUSDT', name: 'Injective', type: 'crypto', baseAsset: 'INJ', quoteAsset: 'USDT', category: 'DeFi Layer 1', defaultPrice: 21.50 },
  { symbol: 'TIAUSDT', name: 'Celestia', type: 'crypto', baseAsset: 'TIA', quoteAsset: 'USDT', category: 'Modular Blockchain', defaultPrice: 5.15 },
  { symbol: 'SEIUSDT', name: 'Sei Network', type: 'crypto', baseAsset: 'SEI', quoteAsset: 'USDT', category: 'Parallelized EVM L1', defaultPrice: 0.38 },
  { symbol: 'KASUSDT', name: 'Kaspa', type: 'crypto', baseAsset: 'KAS', quoteAsset: 'USDT', category: 'BlockDAG PoW', defaultPrice: 0.165 },
  { symbol: 'PENDLEUSDT', name: 'Pendle', type: 'crypto', baseAsset: 'PENDLE', quoteAsset: 'USDT', category: 'Yield Trading DeFi', defaultPrice: 4.85 },
  { symbol: 'ONDOUSDT', name: 'Ondo Finance', type: 'crypto', baseAsset: 'ONDO', quoteAsset: 'USDT', category: 'Real World Assets (RWA)', defaultPrice: 0.78 },
  { symbol: 'DOTUSDT', name: 'Polkadot', type: 'crypto', baseAsset: 'DOT', quoteAsset: 'USDT', category: 'Interoperability L0', defaultPrice: 4.25 },
  { symbol: 'LTCUSDT', name: 'Litecoin', type: 'crypto', baseAsset: 'LTC', quoteAsset: 'USDT', category: 'Digital Silver', defaultPrice: 68.50 },
  { symbol: 'UNIUSDT', name: 'Uniswap', type: 'crypto', baseAsset: 'UNI', quoteAsset: 'USDT', category: 'DEX Protocol', defaultPrice: 7.80 },

  // ========== VIETNAM STOCKS (VN30 & POPULAR MIDCAPS - CHUẨN SSI IBOARD) ==========
  { symbol: 'VNINDEX', name: 'VN-Index (Chỉ số TT Chứng khoán VN)', type: 'index', baseAsset: 'VNINDEX', quoteAsset: 'VND', category: 'Chỉ số Toàn Thị Trường VN', defaultPrice: 1828.05 },
  { symbol: 'VN30', name: 'VN30-Index (Chỉ số Top 30 Cổ phiếu VN)', type: 'vn30', baseAsset: 'VN30', quoteAsset: 'VND', category: 'Chỉ số VN30 Bluechip', defaultPrice: 1885.20 },
  { symbol: 'VIC', name: 'Tập đoàn Vingroup', type: 'vn30', baseAsset: 'VIC', quoteAsset: 'VND', category: 'VN30 - Đa ngành & Xe điện', defaultPrice: 236.00 },
  { symbol: 'VHM', name: 'CTCP Vinhomes', type: 'vn30', baseAsset: 'VHM', quoteAsset: 'VND', category: 'VN30 - Bất động sản Dân cư', defaultPrice: 73.80 },
  { symbol: 'FPT', name: 'CTCP FPT', type: 'vn30', baseAsset: 'FPT', quoteAsset: 'VND', category: 'VN30 - Công nghệ & Viễn thông', defaultPrice: 72.20 },
  { symbol: 'MWG', name: 'CTCP Đầu tư Thế Giới Di Động', type: 'vn30', baseAsset: 'MWG', quoteAsset: 'VND', category: 'VN30 - Bán lẻ & Chuỗi tiêu dùng', defaultPrice: 75.30 },
  { symbol: 'MSN', name: 'Tập đoàn Masan', type: 'vn30', baseAsset: 'MSN', quoteAsset: 'VND', category: 'VN30 - Tiêu dùng & Bán lẻ', defaultPrice: 76.50 },
  { symbol: 'GAS', name: 'Tổng công ty Khí Việt Nam (PV GAS)', type: 'vn30', baseAsset: 'GAS', quoteAsset: 'VND', category: 'VN30 - Dầu khí & Năng lượng', defaultPrice: 71.20 },
  { symbol: 'STB', name: 'Ngân hàng Sacombank', type: 'vn30', baseAsset: 'STB', quoteAsset: 'VND', category: 'VN30 - Ngân hàng', defaultPrice: 31.20 },
  { symbol: 'VCB', name: 'Ngân hàng TMCP Ngoại thương (Vietcombank)', type: 'vn30', baseAsset: 'VCB', quoteAsset: 'VND', category: 'VN30 - Ngân hàng Nhà nước', defaultPrice: 60.10 },
  { symbol: 'TCB', name: 'Ngân hàng Kỹ thương (Techcombank)', type: 'vn30', baseAsset: 'TCB', quoteAsset: 'VND', category: 'VN30 - Ngân hàng Tư nhân', defaultPrice: 33.50 },
  { symbol: 'HPG', name: 'Tập đoàn Hòa Phát', type: 'vn30', baseAsset: 'HPG', quoteAsset: 'VND', category: 'VN30 - Thép & Vật liệu', defaultPrice: 22.20 },
  { symbol: 'SSI', name: 'CTCP Chứng khoán SSI', type: 'vn30', baseAsset: 'SSI', quoteAsset: 'VND', category: 'VN30 - Chứng khoán SSI', defaultPrice: 21.45 },
  { symbol: 'VPB', name: 'Ngân hàng VPBank', type: 'vn30', baseAsset: 'VPB', quoteAsset: 'VND', category: 'VN30 - Ngân hàng', defaultPrice: 19.30 },
  { symbol: 'PNJ', name: 'CTCP Vàng bạc Đá quý Phú Nhuận', type: 'stock', baseAsset: 'PNJ', quoteAsset: 'VND', category: 'VN30 - Bán lẻ Vàng bạc Trang sức', defaultPrice: 96.50 },
  { symbol: 'SJC', name: 'CTCP Sông Đà 1.01 (Mã CK: SJC)', type: 'stock', baseAsset: 'SJC', quoteAsset: 'VND', category: 'Chứng khoán VN - Bất động sản & Xây dựng', defaultPrice: 5.20 },
  { symbol: 'VRE', name: 'Vincom Retail', type: 'vn30', baseAsset: 'VRE', quoteAsset: 'VND', category: 'VN30 - Bất động sản thương mại', defaultPrice: 18.60 },
  { symbol: 'VNM', name: 'Sữa Việt Nam (Vinamilk)', type: 'vn30', baseAsset: 'VNM', quoteAsset: 'VND', category: 'VN30 - Thực phẩm & Đồ uống', defaultPrice: 67.50 },
  { symbol: 'VJC', name: 'Hàng không Vietjet', type: 'vn30', baseAsset: 'VJC', quoteAsset: 'VND', category: 'VN30 - Hàng không', defaultPrice: 105.30 },
  { symbol: 'BVH', name: 'Tập đoàn Bảo Việt', type: 'vn30', baseAsset: 'BVH', quoteAsset: 'VND', category: 'VN30 - Bảo hiểm', defaultPrice: 43.70 },
  { symbol: 'BID', name: 'Ngân hàng BIDV', type: 'vn30', baseAsset: 'BID', quoteAsset: 'VND', category: 'VN30 - Ngân hàng', defaultPrice: 46.95 },
  { symbol: 'CTG', name: 'Ngân hàng VietinBank', type: 'vn30', baseAsset: 'CTG', quoteAsset: 'VND', category: 'VN30 - Ngân hàng', defaultPrice: 36.15 },
  { symbol: 'HDB', name: 'Ngân hàng HDBank', type: 'vn30', baseAsset: 'HDB', quoteAsset: 'VND', category: 'VN30 - Ngân hàng', defaultPrice: 26.55 },
  { symbol: 'MBB', name: 'Ngân hàng MBBank', type: 'vn30', baseAsset: 'MBB', quoteAsset: 'VND', category: 'VN30 - Ngân hàng', defaultPrice: 23.80 },
  { symbol: 'ACB', name: 'Ngân hàng ACB', type: 'vn30', baseAsset: 'ACB', quoteAsset: 'VND', category: 'VN30 - Ngân hàng', defaultPrice: 24.50 },
  { symbol: 'GVR', name: 'Tập đoàn Cao su VN', type: 'vn30', baseAsset: 'GVR', quoteAsset: 'VND', category: 'VN30 - Cao su & BĐS KCN', defaultPrice: 32.85 },
  { symbol: 'BCM', name: 'Becamex IDC', type: 'vn30', baseAsset: 'BCM', quoteAsset: 'VND', category: 'VN30 - BĐS Công nghiệp', defaultPrice: 68.30 },
  { symbol: 'PLX', name: 'Tập đoàn Petrolimex', type: 'vn30', baseAsset: 'PLX', quoteAsset: 'VND', category: 'VN30 - Xăng dầu', defaultPrice: 40.50 },
  { symbol: 'POW', name: 'Điện lực PV Power', type: 'vn30', baseAsset: 'POW', quoteAsset: 'VND', category: 'VN30 - Điện lực', defaultPrice: 12.30 },
  { symbol: 'SAB', name: 'Bia - Rượu Sabeco', type: 'vn30', baseAsset: 'SAB', quoteAsset: 'VND', category: 'VN30 - Đồ uống', defaultPrice: 55.95 },
  { symbol: 'SHB', name: 'Ngân hàng SHB', type: 'vn30', baseAsset: 'SHB', quoteAsset: 'VND', category: 'VN30 - Ngân hàng', defaultPrice: 10.95 },
  { symbol: 'SSB', name: 'Ngân hàng SeABank', type: 'vn30', baseAsset: 'SSB', quoteAsset: 'VND', category: 'VN30 - Ngân hàng', defaultPrice: 16.85 },
  { symbol: 'TPB', name: 'Ngân hàng TPBank', type: 'vn30', baseAsset: 'TPB', quoteAsset: 'VND', category: 'VN30 - Ngân hàng', defaultPrice: 16.70 },
  { symbol: 'VIB', name: 'Ngân hàng Quốc Tế (VIB)', type: 'vn30', baseAsset: 'VIB', quoteAsset: 'VND', category: 'VN30 - Ngân hàng', defaultPrice: 18.90 },

  // --- Popular VN Midcaps ---
  { symbol: 'VND', name: 'CTCP Chứng khoán VNDIRECT', type: 'stock', baseAsset: 'VND', quoteAsset: 'VND', category: 'Chứng khoán', defaultPrice: 16.80 },
  { symbol: 'VCI', name: 'CTCP Chứng khoán Vietcap', type: 'stock', baseAsset: 'VCI', quoteAsset: 'VND', category: 'Chứng khoán', defaultPrice: 34.80 },
  { symbol: 'HCM', name: 'CTCP Chứng khoán TP.HCM (HSC)', type: 'stock', baseAsset: 'HCM', quoteAsset: 'VND', category: 'Chứng khoán', defaultPrice: 29.50 },
  { symbol: 'DIG', name: 'Tổng CTCP Đầu tư Phát triển Xây dựng (DIC Corp)', type: 'stock', baseAsset: 'DIG', quoteAsset: 'VND', category: 'Bất động sản', defaultPrice: 20.40 },
  { symbol: 'DXG', name: 'CTCP Tập đoàn Đất Xanh', type: 'stock', baseAsset: 'DXG', quoteAsset: 'VND', category: 'Bất động sản', defaultPrice: 15.20 },
  { symbol: 'PDR', name: 'CTCP Phát triển BĐS Phát Đạt', type: 'stock', baseAsset: 'PDR', quoteAsset: 'VND', category: 'Bất động sản', defaultPrice: 21.80 },
  { symbol: 'NVL', name: 'CTCP Tập đoàn Đầu tư Địa ốc No Va (Novaland)', type: 'stock', baseAsset: 'NVL', quoteAsset: 'VND', category: 'Bất động sản', defaultPrice: 10.60 },
  { symbol: 'DGC', name: 'CTCP Tập đoàn Hóa chất Đức Giang', type: 'stock', baseAsset: 'DGC', quoteAsset: 'VND', category: 'Hóa chất & Photpho', defaultPrice: 110.50 },
  { symbol: 'PVD', name: 'Tổng CTCP Khoan và Dịch vụ Khoan Dầu khí', type: 'stock', baseAsset: 'PVD', quoteAsset: 'VND', category: 'Dầu khí', defaultPrice: 25.80 },
  { symbol: 'PVS', name: 'Tổng CTCP Dịch vụ Kỹ thuật Dầu khí Việt Nam', type: 'stock', baseAsset: 'PVS', quoteAsset: 'VND', category: 'Dầu khí & Điện gió', defaultPrice: 38.50 },
  { symbol: 'BSR', name: 'CTCP Lọc Hóa dầu Bình Sơn', type: 'stock', baseAsset: 'BSR', quoteAsset: 'VND', category: 'Lọc Hóa Dầu', defaultPrice: 22.40 },

  // ========== US STOCKS ==========
  { symbol: 'NVDA', name: 'NVIDIA Corp', type: 'stock', baseAsset: 'NVDA', quoteAsset: 'USD', category: 'AI Hardware / Tech', defaultPrice: 132.80 },
  { symbol: 'TSLA', name: 'Tesla Inc', type: 'stock', baseAsset: 'TSLA', quoteAsset: 'USD', category: 'EV & Robotics', defaultPrice: 248.50 },
  { symbol: 'AAPL', name: 'Apple Inc', type: 'stock', baseAsset: 'AAPL', quoteAsset: 'USD', category: 'Big Tech', defaultPrice: 228.40 },
  { symbol: 'MSFT', name: 'Microsoft Corp', type: 'stock', baseAsset: 'MSFT', quoteAsset: 'USD', category: 'AI & Cloud Leader', defaultPrice: 418.20 },
  { symbol: 'AMZN', name: 'Amazon.com Inc', type: 'stock', baseAsset: 'AMZN', quoteAsset: 'USD', category: 'E-Commerce & AWS Cloud', defaultPrice: 188.50 },
  { symbol: 'GOOGL', name: 'Alphabet Inc (Google)', type: 'stock', baseAsset: 'GOOGL', quoteAsset: 'USD', category: 'Search & Cloud AI', defaultPrice: 165.20 },
  { symbol: 'META', name: 'Meta Platforms Inc', type: 'stock', baseAsset: 'META', quoteAsset: 'USD', category: 'Social Media & AI', defaultPrice: 512.40 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', type: 'stock', baseAsset: 'AMD', quoteAsset: 'USD', category: 'Semiconductor Chips', defaultPrice: 148.60 },
  { symbol: 'SPY', name: 'S&P 500 ETF', type: 'index', baseAsset: 'SPY', quoteAsset: 'USD', category: 'Macro Index ETF', defaultPrice: 562.40 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq-100)', type: 'index', baseAsset: 'QQQ', quoteAsset: 'USD', category: 'Tech Index ETF', defaultPrice: 485.60 },
];

// LocalStorage Persistence Keys
export const STORAGE_KEYS = {
  SYMBOLS: 'quant_ai_symbols_v6',
  FAVORITES: 'quant_ai_favorites_v6',
  LAST_SYMBOL: 'quant_ai_last_symbol_v6',
};

// Save symbols list to LocalStorage
export function saveSymbolsToStorage(symbols: MarketSymbol[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.SYMBOLS, JSON.stringify(symbols));
  } catch (e) {
    console.warn('Failed to save symbols to localStorage:', e);
  }
}

// Load symbols list from LocalStorage, fallback to DEFAULT_SYMBOLS
export function loadSymbolsFromStorage(): MarketSymbol[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SYMBOLS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load symbols from localStorage:', e);
  }
  return DEFAULT_SYMBOLS;
}

// Save Favorites
export function saveFavoritesToStorage(favorites: string[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  } catch (e) {
    console.warn('Failed to save favorites to localStorage:', e);
  }
}

// Load Favorites
export function loadFavoritesFromStorage(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load favorites from localStorage:', e);
  }
  return ['XAUUSD', 'OIL_WTI', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'FPT', 'HPG', 'VIC', 'NVDA'];
}
