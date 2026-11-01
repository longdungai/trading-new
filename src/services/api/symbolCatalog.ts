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
  { symbol: 'VN30F1M', name: 'HĐTL Chỉ số VN30 Kỳ hạn 1 Tháng (Phái sinh HNX)', type: 'vn30', baseAsset: 'VN30F1M', quoteAsset: 'VND', category: 'Phái sinh HNX - HĐTL Chỉ số VN30', defaultPrice: 1888.50 },
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
  { symbol: 'LPB', name: 'Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)', type: 'stock', baseAsset: 'LPB', quoteAsset: 'VND', category: 'Ngân hàng', defaultPrice: 33.20 },
  { symbol: 'SHS', name: 'CTCP Chứng khoán Sài Gòn - Hà Nội (HNX)', type: 'stock', baseAsset: 'SHS', quoteAsset: 'VND', category: 'Chứng khoán (HNX)', defaultPrice: 15.60 },
  { symbol: 'MBS', name: 'CTCP Chứng khoán MB (HNX)', type: 'stock', baseAsset: 'MBS', quoteAsset: 'VND', category: 'Chứng khoán (HNX)', defaultPrice: 28.40 },
  { symbol: 'FTS', name: 'CTCP Chứng khoán FPT', type: 'stock', baseAsset: 'FTS', quoteAsset: 'VND', category: 'Chứng khoán', defaultPrice: 42.60 },
  { symbol: 'BSI', name: 'CTCP Chứng khoán BIDV', type: 'stock', baseAsset: 'BSI', quoteAsset: 'VND', category: 'Chứng khoán', defaultPrice: 48.20 },
  { symbol: 'VIX', name: 'CTCP Chứng khoán VIX', type: 'stock', baseAsset: 'VIX', quoteAsset: 'VND', category: 'Chứng khoán', defaultPrice: 11.80 },
  { symbol: 'KDH', name: 'CTCP Đầu tư và Kinh doanh Nhà Khang Điền', type: 'stock', baseAsset: 'KDH', quoteAsset: 'VND', category: 'Bất động sản Dân cư', defaultPrice: 34.50 },
  { symbol: 'NLG', name: 'CTCP Đầu tư Nam Long', type: 'stock', baseAsset: 'NLG', quoteAsset: 'VND', category: 'Bất động sản Dân cư', defaultPrice: 38.90 },
  { symbol: 'CEO', name: 'CTCP Tập đoàn C.E.O (HNX)', type: 'stock', baseAsset: 'CEO', quoteAsset: 'VND', category: 'Bất động sản (HNX)', defaultPrice: 14.90 },
  { symbol: 'KBC', name: 'Tổng Công ty Phát triển Đô thị Kinh Bắc', type: 'stock', baseAsset: 'KBC', quoteAsset: 'VND', category: 'BĐS Khu Công Nghiệp', defaultPrice: 29.40 },
  { symbol: 'IDC', name: 'Tổng Công ty IDICO (HNX)', type: 'stock', baseAsset: 'IDC', quoteAsset: 'VND', category: 'BĐS Khu Công Nghiệp (HNX)', defaultPrice: 56.80 },
  { symbol: 'SZC', name: 'CTCP Sonadezi Châu Đức', type: 'stock', baseAsset: 'SZC', quoteAsset: 'VND', category: 'BĐS Khu Công Nghiệp', defaultPrice: 41.20 },
  { symbol: 'VGC', name: 'Tổng Công ty Viglacera', type: 'stock', baseAsset: 'VGC', quoteAsset: 'VND', category: 'BĐS KCN & Vật liệu', defaultPrice: 46.50 },
  { symbol: 'PHR', name: 'CTCP Cao su Phước Hòa', type: 'stock', baseAsset: 'PHR', quoteAsset: 'VND', category: 'BĐS KCN & Cao su', defaultPrice: 58.40 },
  { symbol: 'HSG', name: 'CTCP Tập đoàn Hoa Sen', type: 'stock', baseAsset: 'HSG', quoteAsset: 'VND', category: 'Thép & Tôn mạ', defaultPrice: 19.85 },
  { symbol: 'NKG', name: 'CTCP Thép Nam Kim', type: 'stock', baseAsset: 'NKG', quoteAsset: 'VND', category: 'Thép & Xuất khẩu', defaultPrice: 20.60 },
  { symbol: 'HHV', name: 'CTCP Đầu tư Hạ tầng Giao thông Đèo Cả', type: 'stock', baseAsset: 'HHV', quoteAsset: 'VND', category: 'Đầu tư công & Hạ tầng', defaultPrice: 12.65 },
  { symbol: 'VCG', name: 'Tổng CTCP Vinaconex', type: 'stock', baseAsset: 'VCG', quoteAsset: 'VND', category: 'Đầu tư công & Xây dựng', defaultPrice: 19.40 },
  { symbol: 'CTD', name: 'CTCP Xây dựng Coteccons', type: 'stock', baseAsset: 'CTD', quoteAsset: 'VND', category: 'Xây dựng & Hạ tầng', defaultPrice: 68.50 },
  { symbol: 'LCG', name: 'CTCP Lizen', type: 'stock', baseAsset: 'LCG', quoteAsset: 'VND', category: 'Đầu tư công', defaultPrice: 11.40 },
  { symbol: 'FCN', name: 'CTCP FECON', type: 'stock', baseAsset: 'FCN', quoteAsset: 'VND', category: 'Đầu tư công & Nền móng', defaultPrice: 13.80 },
  { symbol: 'PVT', name: 'Tổng CTCP Vận tải Dầu khí (PVTrans)', type: 'stock', baseAsset: 'PVT', quoteAsset: 'VND', category: 'Vận tải Dầu khí', defaultPrice: 27.90 },
  { symbol: 'REE', name: 'CTCP Cơ Điện Lạnh', type: 'stock', baseAsset: 'REE', quoteAsset: 'VND', category: 'Điện & Hạ tầng Nước', defaultPrice: 65.80 },
  { symbol: 'PC1', name: 'CTCP Tập đoàn PC1', type: 'stock', baseAsset: 'PC1', quoteAsset: 'VND', category: 'Xây lắp Điện & Khoáng sản', defaultPrice: 28.20 },
  { symbol: 'FRT', name: 'CTCP Bán lẻ Kỹ thuật số FPT (Long Châu)', type: 'stock', baseAsset: 'FRT', quoteAsset: 'VND', category: 'Bán lẻ Dược phẩm & ICT', defaultPrice: 178.50 },
  { symbol: 'DGW', name: 'CTCP Thế Giới Số (Digiworld)', type: 'stock', baseAsset: 'DGW', quoteAsset: 'VND', category: 'Phân phối ICT & Tiêu dùng', defaultPrice: 44.60 },
  { symbol: 'DCM', name: 'CTCP Phân bón Dầu khí Cà Mau', type: 'stock', baseAsset: 'DCM', quoteAsset: 'VND', category: 'Phân bón & Hóa chất', defaultPrice: 37.40 },
  { symbol: 'DPM', name: 'Tổng CTCP Phân bón và Hóa chất Dầu khí (Đạm Phú Mỹ)', type: 'stock', baseAsset: 'DPM', quoteAsset: 'VND', category: 'Phân bón & Hóa chất', defaultPrice: 35.60 },
  { symbol: 'GMD', name: 'CTCP Gemadept', type: 'stock', baseAsset: 'GMD', quoteAsset: 'VND', category: 'Cảng biển & Logistics', defaultPrice: 64.90 },
  { symbol: 'HAH', name: 'CTCP Vận tải và Xếp dỡ Hải An', type: 'stock', baseAsset: 'HAH', quoteAsset: 'VND', category: 'Vận tải biển Container', defaultPrice: 43.20 },
  { symbol: 'VHC', name: 'CTCP Vĩnh Hoàn', type: 'stock', baseAsset: 'VHC', quoteAsset: 'VND', category: 'Thủy sản Xuất khẩu', defaultPrice: 72.40 },
  { symbol: 'ANV', name: 'CTCP Nam Việt (Navico)', type: 'stock', baseAsset: 'ANV', quoteAsset: 'VND', category: 'Thủy sản Xuất khẩu', defaultPrice: 31.80 },
  { symbol: 'DBC', name: 'CTCP Tập đoàn Dabaco Việt Nam', type: 'stock', baseAsset: 'DBC', quoteAsset: 'VND', category: 'Nông nghiệp & Thực phẩm', defaultPrice: 28.90 },
  { symbol: 'TNG', name: 'CTCP Đầu tư và Thương mại TNG (HNX)', type: 'stock', baseAsset: 'TNG', quoteAsset: 'VND', category: 'Dệt may Xuất khẩu (HNX)', defaultPrice: 25.40 },
  { symbol: 'ACV', name: 'Tổng Công ty Cảng Hàng không Việt Nam (UPCOM)', type: 'stock', baseAsset: 'ACV', quoteAsset: 'VND', category: 'Cảng Hàng không (UPCOM)', defaultPrice: 121.00 },
  { symbol: 'VEA', name: 'Tổng Công ty Máy động lực & Máy nông nghiệp VN (UPCOM)', type: 'stock', baseAsset: 'VEA', quoteAsset: 'VND', category: 'Cổ tức cao (UPCOM)', defaultPrice: 42.50 },
  { symbol: 'QNS', name: 'CTCP Đường Quảng Ngãi (UPCOM)', type: 'stock', baseAsset: 'QNS', quoteAsset: 'VND', category: 'Thực phẩm & Đường (UPCOM)', defaultPrice: 49.20 },

  // ========== PHỐ WALL (US STOCKS), 11 SECTOR SPDR ETFs & GLOBAL INDICES ==========
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', type: 'index', baseAsset: 'SPY', quoteAsset: 'USD', category: 'US Benchmark ETF (S&P 500)', defaultPrice: 582.40 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq-100)', type: 'index', baseAsset: 'QQQ', quoteAsset: 'USD', category: 'US Tech Index ETF (Nasdaq-100)', defaultPrice: 504.20 },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF', type: 'index', baseAsset: 'DIA', quoteAsset: 'USD', category: 'US Bluechip Benchmark (Dow 30)', defaultPrice: 423.80 },
  { symbol: 'IWM', name: 'iShares Russell 2000 Small-Cap ETF', type: 'index', baseAsset: 'IWM', quoteAsset: 'USD', category: 'US Small-Cap Benchmark (Russell 2000)', defaultPrice: 221.50 },
  { symbol: 'SOXX', name: 'iShares Semiconductor ETF', type: 'index', baseAsset: 'SOXX', quoteAsset: 'USD', category: 'US Sector ETF — Bán dẫn (Semiconductors)', defaultPrice: 229.40 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', type: 'stock', baseAsset: 'NVDA', quoteAsset: 'USD', category: 'AI Hardware / Semiconductors', defaultPrice: 138.60 },
  { symbol: 'TSLA', name: 'Tesla Inc', type: 'stock', baseAsset: 'TSLA', quoteAsset: 'USD', category: 'EV, Autonomous & Robotics', defaultPrice: 254.50 },
  { symbol: 'AAPL', name: 'Apple Inc', type: 'stock', baseAsset: 'AAPL', quoteAsset: 'USD', category: 'Magnificent 7 / Consumer Tech', defaultPrice: 231.40 },
  { symbol: 'MSFT', name: 'Microsoft Corp', type: 'stock', baseAsset: 'MSFT', quoteAsset: 'USD', category: 'Magnificent 7 / Cloud & AI', defaultPrice: 424.80 },
  { symbol: 'AMZN', name: 'Amazon.com Inc', type: 'stock', baseAsset: 'AMZN', quoteAsset: 'USD', category: 'Magnificent 7 / E-Commerce & AWS', defaultPrice: 196.40 },
  { symbol: 'GOOGL', name: 'Alphabet Inc (Google)', type: 'stock', baseAsset: 'GOOGL', quoteAsset: 'USD', category: 'Magnificent 7 / Search & Cloud AI', defaultPrice: 174.20 },
  { symbol: 'META', name: 'Meta Platforms Inc', type: 'stock', baseAsset: 'META', quoteAsset: 'USD', category: 'Magnificent 7 / Social Media & AI', defaultPrice: 578.50 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', type: 'stock', baseAsset: 'AMD', quoteAsset: 'USD', category: 'Semiconductor Chips', defaultPrice: 156.40 },
  { symbol: 'AVGO', name: 'Broadcom Inc', type: 'stock', baseAsset: 'AVGO', quoteAsset: 'USD', category: 'Custom AI Silicon & Networking', defaultPrice: 176.80 },
  { symbol: 'TSM', name: 'Taiwan Semiconductor (TSMC ADR)', type: 'stock', baseAsset: 'TSM', quoteAsset: 'USD', category: 'Global Foundry Leader (NYSE ADR)', defaultPrice: 194.50 },
  { symbol: 'ASML', name: 'ASML Holding NV (NASDAQ)', type: 'stock', baseAsset: 'ASML', quoteAsset: 'USD', category: 'EUV Lithography Monopoly', defaultPrice: 712.00 },
  { symbol: 'ARM', name: 'Arm Holdings plc', type: 'stock', baseAsset: 'ARM', quoteAsset: 'USD', category: 'CPU & Edge AI Architecture', defaultPrice: 154.00 },
  { symbol: 'MU', name: 'Micron Technology Inc', type: 'stock', baseAsset: 'MU', quoteAsset: 'USD', category: 'HBM3E Memory & AI DRAM', defaultPrice: 106.50 },
  { symbol: 'INTC', name: 'Intel Corp', type: 'stock', baseAsset: 'INTC', quoteAsset: 'USD', category: 'x86 & US Foundry', defaultPrice: 23.40 },
  { symbol: 'QCOM', name: 'Qualcomm Inc', type: 'stock', baseAsset: 'QCOM', quoteAsset: 'USD', category: 'Mobile & Edge AI Chips', defaultPrice: 171.20 },
  { symbol: 'SMCI', name: 'Super Micro Computer', type: 'stock', baseAsset: 'SMCI', quoteAsset: 'USD', category: 'AI Server Infrastructure', defaultPrice: 46.80 },
  { symbol: 'PLTR', name: 'Palantir Technologies', type: 'stock', baseAsset: 'PLTR', quoteAsset: 'USD', category: 'Enterprise & Defense AI', defaultPrice: 44.20 },
  { symbol: 'MSTR', name: 'Strategy (MicroStrategy)', type: 'stock', baseAsset: 'MSTR', quoteAsset: 'USD', category: 'Bitcoin Treasury Proxy', defaultPrice: 238.40 },
  { symbol: 'COIN', name: 'Coinbase Global Inc', type: 'stock', baseAsset: 'COIN', quoteAsset: 'USD', category: 'US Crypto Exchange & Custody', defaultPrice: 214.60 },
  { symbol: 'NFLX', name: 'Netflix Inc', type: 'stock', baseAsset: 'NFLX', quoteAsset: 'USD', category: 'Streaming & Entertainment', defaultPrice: 758.20 },
  { symbol: 'CRM', name: 'Salesforce Inc', type: 'stock', baseAsset: 'CRM', quoteAsset: 'USD', category: 'Enterprise Cloud & Agentforce AI', defaultPrice: 294.50 },
  { symbol: 'ORCL', name: 'Oracle Corp', type: 'stock', baseAsset: 'ORCL', quoteAsset: 'USD', category: 'Cloud Infrastructure & Database', defaultPrice: 174.80 },
  { symbol: 'UBER', name: 'Uber Technologies Inc', type: 'stock', baseAsset: 'UBER', quoteAsset: 'USD', category: 'Mobility & Autonomous Network', defaultPrice: 78.60 },
  { symbol: 'PANW', name: 'Palo Alto Networks', type: 'stock', baseAsset: 'PANW', quoteAsset: 'USD', category: 'Cybersecurity Leader', defaultPrice: 368.00 },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings', type: 'stock', baseAsset: 'CRWD', quoteAsset: 'USD', category: 'Cloud Endpoint Security', defaultPrice: 312.50 },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co', type: 'stock', baseAsset: 'JPM', quoteAsset: 'USD', category: 'US Money-Center Banking', defaultPrice: 224.80 },
  { symbol: 'GS', name: 'Goldman Sachs Group', type: 'stock', baseAsset: 'GS', quoteAsset: 'USD', category: 'US Investment Banking', defaultPrice: 518.40 },
  { symbol: 'BAC', name: 'Bank of America Corp', type: 'stock', baseAsset: 'BAC', quoteAsset: 'USD', category: 'US Commercial Banking', defaultPrice: 42.10 },
  { symbol: 'V', name: 'Visa Inc', type: 'stock', baseAsset: 'V', quoteAsset: 'USD', category: 'Global Payments Network', defaultPrice: 289.40 },
  { symbol: 'LLY', name: 'Eli Lilly & Co', type: 'stock', baseAsset: 'LLY', quoteAsset: 'USD', category: 'Biopharma & GLP-1 Leader', defaultPrice: 892.50 },
  { symbol: 'UNH', name: 'UnitedHealth Group', type: 'stock', baseAsset: 'UNH', quoteAsset: 'USD', category: 'Managed Healthcare Leader', defaultPrice: 568.00 },
  { symbol: 'COST', name: 'Costco Wholesale Corp', type: 'stock', baseAsset: 'COST', quoteAsset: 'USD', category: 'Consumer Retail Leader', defaultPrice: 889.00 },
  { symbol: 'WMT', name: 'Walmart Inc', type: 'stock', baseAsset: 'WMT', quoteAsset: 'USD', category: 'Global Retail Giant', defaultPrice: 81.40 },
  { symbol: 'XOM', name: 'Exxon Mobil Corp', type: 'stock', baseAsset: 'XOM', quoteAsset: 'USD', category: 'US Integrated Oil & Gas', defaultPrice: 119.60 },
  { symbol: 'CVX', name: 'Chevron Corp', type: 'stock', baseAsset: 'CVX', quoteAsset: 'USD', category: 'US Integrated Energy', defaultPrice: 152.30 },
  { symbol: 'CAT', name: 'Caterpillar Inc', type: 'stock', baseAsset: 'CAT', quoteAsset: 'USD', category: 'Heavy Industrials & Infrastructure', defaultPrice: 388.50 },
  { symbol: 'LMT', name: 'Lockheed Martin Corp', type: 'stock', baseAsset: 'LMT', quoteAsset: 'USD', category: 'Aerospace & Defense', defaultPrice: 562.00 },
  // --- 11 S&P 500 Sector SPDR ETFs ---
  { symbol: 'XLK', name: 'Technology Select Sector SPDR', type: 'index', baseAsset: 'XLK', quoteAsset: 'USD', category: 'US Sector ETF — Công nghệ', defaultPrice: 228.50 },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR', type: 'index', baseAsset: 'XLF', quoteAsset: 'USD', category: 'US Sector ETF — Tài chính Ngân hàng', defaultPrice: 46.80 },
  { symbol: 'XLV', name: 'Health Care Select Sector SPDR', type: 'index', baseAsset: 'XLV', quoteAsset: 'USD', category: 'US Sector ETF — Y tế Dược phẩm', defaultPrice: 151.20 },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR', type: 'index', baseAsset: 'XLE', quoteAsset: 'USD', category: 'US Sector ETF — Năng lượng Dầu khí', defaultPrice: 90.40 },
  { symbol: 'XLI', name: 'Industrial Select Sector SPDR', type: 'index', baseAsset: 'XLI', quoteAsset: 'USD', category: 'US Sector ETF — Công nghiệp & Quốc phòng', defaultPrice: 136.80 },
  { symbol: 'XLY', name: 'Consumer Discretionary Select SPDR', type: 'index', baseAsset: 'XLY', quoteAsset: 'USD', category: 'US Sector ETF — Tiêu dùng Không thiết yếu', defaultPrice: 201.40 },
  { symbol: 'XLP', name: 'Consumer Staples Select Sector SPDR', type: 'index', baseAsset: 'XLP', quoteAsset: 'USD', category: 'US Sector ETF — Hàng Tiêu dùng Thiết yếu', defaultPrice: 82.10 },
  { symbol: 'XLC', name: 'Communication Services Select SPDR', type: 'index', baseAsset: 'XLC', quoteAsset: 'USD', category: 'US Sector ETF — Truyền thông & Internet', defaultPrice: 92.60 },
  { symbol: 'XLU', name: 'Utilities Select Sector SPDR', type: 'index', baseAsset: 'XLU', quoteAsset: 'USD', category: 'US Sector ETF — Điện & Tiện ích AI Data Center', defaultPrice: 80.50 },
  { symbol: 'XLB', name: 'Materials Select Sector SPDR', type: 'index', baseAsset: 'XLB', quoteAsset: 'USD', category: 'US Sector ETF — Nguyên vật liệu & Hóa chất', defaultPrice: 95.20 },
  { symbol: 'XLRE', name: 'Real Estate Select Sector SPDR', type: 'index', baseAsset: 'XLRE', quoteAsset: 'USD', category: 'US Sector ETF — Bất động sản Mỹ (REITs)', defaultPrice: 44.10 },
  // --- Global Equity Benchmarks ---
  { symbol: 'N225', name: 'Nikkei 225 Index (Nhật Bản)', type: 'index', baseAsset: 'N225', quoteAsset: 'USD', category: 'Chỉ số Chứng khoán Nhật Bản (Tokyo)', defaultPrice: 38920.00 },
  { symbol: 'HSI', name: 'Hang Seng Index (Hồng Kông)', type: 'index', baseAsset: 'HSI', quoteAsset: 'USD', category: 'Chỉ số Chứng khoán Hồng Kông', defaultPrice: 20540.00 },
  { symbol: 'DAX', name: 'DAX Performance Index (Đức / Châu Âu)', type: 'index', baseAsset: 'DAX', quoteAsset: 'USD', category: 'Chỉ số Chứng khoán Đức / Châu Âu', defaultPrice: 19480.00 },
];

// LocalStorage Persistence Keys
export const STORAGE_KEYS = {
  SYMBOLS: 'quant_ai_symbols_v9',
  LEGACY_SYMBOLS_V8: 'quant_ai_symbols_v8',
  LEGACY_SYMBOLS_V7: 'quant_ai_symbols_v7',
  FAVORITES: 'quant_ai_favorites_v7',
  LAST_SYMBOL: 'quant_ai_last_symbol_v7',
};

// Save symbols list to LocalStorage
export function saveSymbolsToStorage(symbols: MarketSymbol[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.SYMBOLS, JSON.stringify(symbols));
  } catch (e) {
    console.warn('Failed to save symbols to localStorage:', e);
  }
}

// Load symbols list from LocalStorage, fallback to DEFAULT_SYMBOLS (with seamless v8/v7 custom symbol migration)
export function loadSymbolsFromStorage(): MarketSymbol[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SYMBOLS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validated = parsed.filter((s: unknown): s is MarketSymbol =>
          Boolean(
            s &&
              typeof s === 'object' &&
              'symbol' in s &&
              typeof (s as MarketSymbol).symbol === 'string' &&
              typeof (s as MarketSymbol).price === 'number'
          )
        );
        if (validated.length > 0) {
          return validated;
        }
      }
    }

    // Migrate any user-created custom symbols from v8/v7 while injecting v9 Global US + Crypto Narrative universe
    const legacyRaw =
      localStorage.getItem(STORAGE_KEYS.LEGACY_SYMBOLS_V8) ||
      localStorage.getItem(STORAGE_KEYS.LEGACY_SYMBOLS_V7);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (Array.isArray(parsedLegacy)) {
        const defaultSet = new Set(DEFAULT_SYMBOLS.map(d => d.symbol.toUpperCase()));
        const customExtras = parsedLegacy.filter(
          (s: unknown): s is MarketSymbol =>
            Boolean(
              s &&
                typeof s === 'object' &&
                'symbol' in s &&
                typeof (s as MarketSymbol).symbol === 'string' &&
                typeof (s as MarketSymbol).price === 'number' &&
                !defaultSet.has((s as MarketSymbol).symbol.toUpperCase())
            )
        );
        const merged = [...customExtras, ...DEFAULT_SYMBOLS];
        saveSymbolsToStorage(merged);
        return merged;
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
