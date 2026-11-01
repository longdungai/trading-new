import { Candle, MarketSentiment, MarketSymbol, Timeframe } from '../../types';
import { fetchBinanceKlines, fetchBinance24hTickersForSymbols } from './binance';

export const DEFAULT_SYMBOLS: MarketSymbol[] = [
  // ===================== HÀNG HÓA: VÀNG & DẦU MỎ (COMMODITIES) =====================
  {
    symbol: 'XAUUSD',
    name: 'Vàng Thế Giới (Spot Gold USD/oz)',
    type: 'commodity',
    baseAsset: 'XAU',
    quoteAsset: 'USD',
    price: 4575.65,
    change24h: -0.92,
    high24h: 4618.45,
    low24h: 4560.16,
    volume24h: 88500000000,
    category: 'Kim Loại Quý / Vàng Thế Giới',
  },
  {
    symbol: 'PAXGUSDT',
    name: 'PAX Gold (Vàng số 1:1 Vàng thật)',
    type: 'crypto',
    baseAsset: 'PAXG',
    quoteAsset: 'USDT',
    price: 4575.65,
    change24h: -0.92,
    high24h: 4618.45,
    low24h: 4560.16,
    volume24h: 42000000,
    category: 'Vàng Token Hóa (Binance)',
  },
  {
    symbol: 'OIL_WTI',
    name: 'Dầu Thô WTI (Crude Oil USD/thùng)',
    type: 'commodity',
    baseAsset: 'WTI',
    quoteAsset: 'USD',
    price: 83.12,
    change24h: -0.49,
    high24h: 84.20,
    low24h: 82.50,
    volume24h: 62000000000,
    category: 'Năng Lượng / Dầu Thô Mỹ',
  },
  {
    symbol: 'OIL_BRENT',
    name: 'Dầu Thô Brent (Brent Oil USD/thùng)',
    type: 'commodity',
    baseAsset: 'BRENT',
    quoteAsset: 'USD',
    price: 88.20,
    change24h: -0.36,
    high24h: 89.10,
    low24h: 87.60,
    volume24h: 74000000000,
    category: 'Năng Lượng / Dầu Chuẩn Quốc Tế',
  },
  {
    symbol: 'SILVER',
    name: 'Bạc Thế Giới (Silver USD/oz)',
    type: 'commodity',
    baseAsset: 'XAG',
    quoteAsset: 'USD',
    price: 69.56,
    change24h: -0.96,
    high24h: 70.80,
    low24h: 68.90,
    volume24h: 18500000000,
    category: 'Kim Loại Quý / Bạc',
  },

  // ===================== TOP 10 COIN (CRYPTO) =====================
  {
    symbol: 'BTCUSDT',
    name: 'Bitcoin',
    type: 'crypto',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    price: 79842.47,
    change24h: 1.24,
    high24h: 81200.0,
    low24h: 78500.0,
    volume24h: 42500000000,
    category: 'Top 1 Crypto / Store of Value',
  },
  {
    symbol: 'ETHUSDT',
    name: 'Ethereum',
    type: 'crypto',
    baseAsset: 'ETH',
    quoteAsset: 'USDT',
    price: 2489.60,
    change24h: -0.15,
    high24h: 2540.0,
    low24h: 2460.0,
    volume24h: 19800000000,
    category: 'Top 2 Crypto / Smart Contracts',
  },
  {
    symbol: 'SOLUSDT',
    name: 'Solana',
    type: 'crypto',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    price: 106.93,
    change24h: 5.75,
    high24h: 110.2,
    low24h: 102.5,
    volume24h: 9400000000,
    category: 'Top 3 / High Speed L1',
  },
  {
    symbol: 'BNBUSDT',
    name: 'BNB',
    type: 'crypto',
    baseAsset: 'BNB',
    quoteAsset: 'USDT',
    price: 709.59,
    change24h: 1.45,
    high24h: 720.0,
    low24h: 698.0,
    volume24h: 2100000000,
    category: 'Top 4 / Binance Ecosystem',
  },
  {
    symbol: 'XRPUSDT',
    name: 'XRP',
    type: 'crypto',
    baseAsset: 'XRP',
    quoteAsset: 'USDT',
    price: 1.4315,
    change24h: 1.76,
    high24h: 1.485,
    low24h: 1.392,
    volume24h: 3850000000,
    category: 'Top 5 / Cross-Border Payments',
  },
  {
    symbol: 'DOGEUSDT',
    name: 'Dogecoin',
    type: 'crypto',
    baseAsset: 'DOGE',
    quoteAsset: 'USDT',
    price: 0.08777,
    change24h: 1.00,
    high24h: 0.0915,
    low24h: 0.0852,
    volume24h: 1820000000,
    category: 'Top 6 / Payment & Meme',
  },
  {
    symbol: 'ADAUSDT',
    name: 'Cardano',
    type: 'crypto',
    baseAsset: 'ADA',
    quoteAsset: 'USDT',
    price: 0.2101,
    change24h: 0.38,
    high24h: 0.218,
    low24h: 0.205,
    volume24h: 620000000,
    category: 'Top 7 / Layer 1 PoS',
  },
  {
    symbol: 'AVAXUSDT',
    name: 'Avalanche',
    type: 'crypto',
    baseAsset: 'AVAX',
    quoteAsset: 'USDT',
    price: 7.441,
    change24h: 1.22,
    high24h: 7.68,
    low24h: 7.21,
    volume24h: 480000000,
    category: 'Top 8 / Scalable L1',
  },
  {
    symbol: 'SUIUSDT',
    name: 'Sui Network',
    type: 'crypto',
    baseAsset: 'SUI',
    quoteAsset: 'USDT',
    price: 0.7639,
    change24h: 1.88,
    high24h: 0.812,
    low24h: 0.735,
    volume24h: 890000000,
    category: 'Top 9 / Next-Gen Move L1',
  },
  {
    symbol: 'LINKUSDT',
    name: 'Chainlink',
    type: 'crypto',
    baseAsset: 'LINK',
    quoteAsset: 'USDT',
    price: 11.717,
    change24h: 1.61,
    high24h: 12.15,
    low24h: 11.32,
    volume24h: 730000000,
    category: 'Top 10 / Oracle & RWA',
  },

  // ===================== VN30 & CHỨNG KHOÁN VIỆT NAM (CHUẨN SSI IBOARD) =====================
  {
    symbol: 'VNINDEX',
    name: 'VN-Index (Chỉ số TT Chứng khoán VN)',
    type: 'index',
    baseAsset: 'VNINDEX',
    quoteAsset: 'VND',
    price: 1828.05,
    change24h: -0.19,
    high24h: 1835.20,
    low24h: 1822.40,
    volume24h: 24500000000000,
    category: 'Chỉ số Toàn Thị Trường VN',
  },
  {
    symbol: 'VN30',
    name: 'VN30-Index (Chỉ số Top 30 Cổ phiếu VN)',
    type: 'vn30',
    baseAsset: 'VN30',
    quoteAsset: 'VND',
    price: 1885.20,
    change24h: 0.15,
    high24h: 1892.50,
    low24h: 1878.10,
    volume24h: 14800000000000,
    category: 'Chỉ số VN30 Bluechip',
  },
  {
    symbol: 'VIC',
    name: 'Tập đoàn Vingroup',
    type: 'vn30',
    baseAsset: 'VIC',
    quoteAsset: 'VND',
    price: 236.00,
    change24h: -0.85,
    high24h: 238.50,
    low24h: 233.00,
    volume24h: 1180000000000,
    category: 'VN30 - Đa ngành & Xe điện',
  },
  {
    symbol: 'VHM',
    name: 'CTCP Vinhomes',
    type: 'vn30',
    baseAsset: 'VHM',
    quoteAsset: 'VND',
    price: 73.80,
    change24h: -0.95,
    high24h: 74.50,
    low24h: 73.00,
    volume24h: 1184000000000,
    category: 'VN30 - Bất động sản Dân cư',
  },
  {
    symbol: 'VRE',
    name: 'CTCP Vincom Retail',
    type: 'vn30',
    baseAsset: 'VRE',
    quoteAsset: 'VND',
    price: 18.60,
    change24h: -0.53,
    high24h: 18.90,
    low24h: 18.30,
    volume24h: 420000000000,
    category: 'VN30 - Bất động sản thương mại',
  },
  {
    symbol: 'FPT',
    name: 'CTCP FPT',
    type: 'vn30',
    baseAsset: 'FPT',
    quoteAsset: 'VND',
    price: 72.20,
    change24h: 1.94,
    high24h: 73.00,
    low24h: 71.50,
    volume24h: 654600000000,
    category: 'VN30 - Công nghệ & Viễn thông',
  },
  {
    symbol: 'MWG',
    name: 'CTCP Đầu tư Thế Giới Di Động',
    type: 'vn30',
    baseAsset: 'MWG',
    quoteAsset: 'VND',
    price: 75.30,
    change24h: 0.40,
    high24h: 75.90,
    low24h: 74.50,
    volume24h: 1164000000000,
    category: 'VN30 - Bán lẻ & Chuỗi tiêu dùng',
  },
  {
    symbol: 'MSN',
    name: 'Tập đoàn Masan',
    type: 'vn30',
    baseAsset: 'MSN',
    quoteAsset: 'VND',
    price: 76.50,
    change24h: 0.65,
    high24h: 77.20,
    low24h: 75.80,
    volume24h: 879000000000,
    category: 'VN30 - Tiêu dùng & Bán lẻ',
  },
  {
    symbol: 'GAS',
    name: 'Tổng công ty Khí Việt Nam (PV GAS)',
    type: 'vn30',
    baseAsset: 'GAS',
    quoteAsset: 'VND',
    price: 71.20,
    change24h: 0.85,
    high24h: 72.00,
    low24h: 70.80,
    volume24h: 270000000000,
    category: 'VN30 - Dầu khí & Năng lượng',
  },
  {
    symbol: 'STB',
    name: 'Ngân hàng Sacombank',
    type: 'vn30',
    baseAsset: 'STB',
    quoteAsset: 'VND',
    price: 31.20,
    change24h: 0.64,
    high24h: 31.80,
    low24h: 30.90,
    volume24h: 1695000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'VCB',
    name: 'Ngân hàng TMCP Ngoại thương (Vietcombank)',
    type: 'vn30',
    baseAsset: 'VCB',
    quoteAsset: 'VND',
    price: 60.10,
    change24h: -0.17,
    high24h: 60.80,
    low24h: 59.50,
    volume24h: 1089000000000,
    category: 'VN30 - Ngân hàng Nhà nước',
  },
  {
    symbol: 'TCB',
    name: 'Ngân hàng Kỹ thương (Techcombank)',
    type: 'vn30',
    baseAsset: 'TCB',
    quoteAsset: 'VND',
    price: 33.50,
    change24h: -1.76,
    high24h: 34.00,
    low24h: 33.10,
    volume24h: 1125000000000,
    category: 'VN30 - Ngân hàng Tư nhân',
  },
  {
    symbol: 'HPG',
    name: 'Tập đoàn Hòa Phát',
    type: 'vn30',
    baseAsset: 'HPG',
    quoteAsset: 'VND',
    price: 22.20,
    change24h: 0.45,
    high24h: 22.50,
    low24h: 21.90,
    volume24h: 523000000000,
    category: 'VN30 - Thép & Vật liệu',
  },
  {
    symbol: 'SSI',
    name: 'CTCP Chứng khoán SSI',
    type: 'vn30',
    baseAsset: 'SSI',
    quoteAsset: 'VND',
    price: 21.45,
    change24h: -0.69,
    high24h: 21.80,
    low24h: 21.20,
    volume24h: 562000000000,
    category: 'VN30 - Chứng khoán SSI',
  },
  {
    symbol: 'VPB',
    name: 'Ngân hàng VPBank',
    type: 'vn30',
    baseAsset: 'VPB',
    quoteAsset: 'VND',
    price: 19.30,
    change24h: 0.52,
    high24h: 19.60,
    low24h: 19.00,
    volume24h: 950000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'MBB',
    name: 'Ngân hàng MBBank',
    type: 'vn30',
    baseAsset: 'MBB',
    quoteAsset: 'VND',
    price: 23.80,
    change24h: 0.42,
    high24h: 24.20,
    low24h: 23.50,
    volume24h: 890000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'ACB',
    name: 'Ngân hàng ACB',
    type: 'vn30',
    baseAsset: 'ACB',
    quoteAsset: 'VND',
    price: 24.50,
    change24h: 0.20,
    high24h: 24.80,
    low24h: 24.10,
    volume24h: 680000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'BID',
    name: 'Ngân hàng BIDV',
    type: 'vn30',
    baseAsset: 'BID',
    quoteAsset: 'VND',
    price: 46.95,
    change24h: -0.32,
    high24h: 47.50,
    low24h: 46.50,
    volume24h: 540000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'CTG',
    name: 'Ngân hàng VietinBank',
    type: 'vn30',
    baseAsset: 'CTG',
    quoteAsset: 'VND',
    price: 36.15,
    change24h: 0.42,
    high24h: 36.60,
    low24h: 35.80,
    volume24h: 720000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'HDB',
    name: 'Ngân hàng HDBank',
    type: 'vn30',
    baseAsset: 'HDB',
    quoteAsset: 'VND',
    price: 26.55,
    change24h: 0.76,
    high24h: 26.90,
    low24h: 26.20,
    volume24h: 480000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'SHB',
    name: 'Ngân hàng SHB',
    type: 'vn30',
    baseAsset: 'SHB',
    quoteAsset: 'VND',
    price: 10.95,
    change24h: 0.00,
    high24h: 11.10,
    low24h: 10.80,
    volume24h: 610000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'SSB',
    name: 'Ngân hàng SeABank',
    type: 'vn30',
    baseAsset: 'SSB',
    quoteAsset: 'VND',
    price: 16.85,
    change24h: -0.29,
    high24h: 17.10,
    low24h: 16.70,
    volume24h: 220000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'TPB',
    name: 'Ngân hàng TPBank',
    type: 'vn30',
    baseAsset: 'TPB',
    quoteAsset: 'VND',
    price: 16.70,
    change24h: 0.30,
    high24h: 17.00,
    low24h: 16.50,
    volume24h: 390000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'VIB',
    name: 'Ngân hàng Quốc Tế (VIB)',
    type: 'vn30',
    baseAsset: 'VIB',
    quoteAsset: 'VND',
    price: 18.90,
    change24h: 0.53,
    high24h: 19.20,
    low24h: 18.60,
    volume24h: 340000000000,
    category: 'VN30 - Ngân hàng',
  },
  {
    symbol: 'VNM',
    name: 'Sữa Việt Nam (Vinamilk)',
    type: 'vn30',
    baseAsset: 'VNM',
    quoteAsset: 'VND',
    price: 67.50,
    change24h: -0.44,
    high24h: 68.20,
    low24h: 67.00,
    volume24h: 530000000000,
    category: 'VN30 - Thực phẩm & Đồ uống',
  },
  {
    symbol: 'SAB',
    name: 'Bia - Rượu Sabeco',
    type: 'vn30',
    baseAsset: 'SAB',
    quoteAsset: 'VND',
    price: 55.95,
    change24h: 0.18,
    high24h: 56.50,
    low24h: 55.50,
    volume24h: 160000000000,
    category: 'VN30 - Đồ uống',
  },
  {
    symbol: 'VJC',
    name: 'Hàng không Vietjet',
    type: 'vn30',
    baseAsset: 'VJC',
    quoteAsset: 'VND',
    price: 105.30,
    change24h: 0.86,
    high24h: 106.50,
    low24h: 104.50,
    volume24h: 290000000000,
    category: 'VN30 - Hàng không',
  },
  {
    symbol: 'BVH',
    name: 'Tập đoàn Bảo Việt',
    type: 'vn30',
    baseAsset: 'BVH',
    quoteAsset: 'VND',
    price: 43.70,
    change24h: 0.23,
    high24h: 44.20,
    low24h: 43.20,
    volume24h: 140000000000,
    category: 'VN30 - Bảo hiểm',
  },
  {
    symbol: 'GVR',
    name: 'Tập đoàn Cao su VN',
    type: 'vn30',
    baseAsset: 'GVR',
    quoteAsset: 'VND',
    price: 32.85,
    change24h: 1.23,
    high24h: 33.40,
    low24h: 32.30,
    volume24h: 410000000000,
    category: 'VN30 - Cao su & BĐS KCN',
  },
  {
    symbol: 'BCM',
    name: 'Becamex IDC',
    type: 'vn30',
    baseAsset: 'BCM',
    quoteAsset: 'VND',
    price: 68.30,
    change24h: -0.29,
    high24h: 69.20,
    low24h: 67.80,
    volume24h: 190000000000,
    category: 'VN30 - BĐS Công nghiệp',
  },
  {
    symbol: 'PLX',
    name: 'Tập đoàn Petrolimex',
    type: 'vn30',
    baseAsset: 'PLX',
    quoteAsset: 'VND',
    price: 40.50,
    change24h: 0.50,
    high24h: 41.00,
    low24h: 40.10,
    volume24h: 210000000000,
    category: 'VN30 - Xăng dầu',
  },
  {
    symbol: 'POW',
    name: 'Điện lực PV Power',
    type: 'vn30',
    baseAsset: 'POW',
    quoteAsset: 'VND',
    price: 12.30,
    change24h: 0.00,
    high24h: 12.50,
    low24h: 12.15,
    volume24h: 280000000000,
    category: 'VN30 - Điện lực',
  },
  {
    symbol: 'PNJ',
    name: 'CTCP Vàng bạc Đá quý Phú Nhuận',
    type: 'stock',
    baseAsset: 'PNJ',
    quoteAsset: 'VND',
    price: 96.50,
    change24h: 1.25,
    high24h: 97.20,
    low24h: 95.80,
    volume24h: 385000000000,
    category: 'Bán lẻ Vàng bạc Trang sức',
  },
  {
    symbol: 'SJC',
    name: 'CTCP Sông Đà 1.01 (Mã CK: SJC)',
    type: 'stock',
    baseAsset: 'SJC',
    quoteAsset: 'VND',
    price: 5.20,
    change24h: 0.00,
    high24h: 5.30,
    low24h: 5.10,
    volume24h: 85000000,
    category: 'Chứng khoán VN - Bất động sản & Xây dựng',
  },
  {
    symbol: 'VND',
    name: 'CTCP Chứng khoán VNDIRECT',
    type: 'stock',
    baseAsset: 'VND',
    quoteAsset: 'VND',
    price: 16.80,
    change24h: 0.60,
    high24h: 17.10,
    low24h: 16.50,
    volume24h: 580000000000,
    category: 'Chứng khoán',
  },
  {
    symbol: 'VCI',
    name: 'CTCP Chứng khoán Vietcap',
    type: 'stock',
    baseAsset: 'VCI',
    quoteAsset: 'VND',
    price: 34.80,
    change24h: 1.16,
    high24h: 35.40,
    low24h: 34.20,
    volume24h: 390000000000,
    category: 'Chứng khoán',
  },
  {
    symbol: 'HCM',
    name: 'CTCP Chứng khoán TP.HCM (HSC)',
    type: 'stock',
    baseAsset: 'HCM',
    quoteAsset: 'VND',
    price: 29.50,
    change24h: 0.68,
    high24h: 30.00,
    low24h: 29.10,
    volume24h: 310000000000,
    category: 'Chứng khoán',
  },
  {
    symbol: 'DIG',
    name: 'Tổng CTCP Đầu tư Phát triển Xây dựng (DIC Corp)',
    type: 'stock',
    baseAsset: 'DIG',
    quoteAsset: 'VND',
    price: 20.40,
    change24h: -0.49,
    high24h: 20.80,
    low24h: 20.10,
    volume24h: 460000000000,
    category: 'Bất động sản',
  },
  {
    symbol: 'DXG',
    name: 'CTCP Tập đoàn Đất Xanh',
    type: 'stock',
    baseAsset: 'DXG',
    quoteAsset: 'VND',
    price: 15.20,
    change24h: 0.66,
    high24h: 15.50,
    low24h: 14.90,
    volume24h: 350000000000,
    category: 'Bất động sản',
  },
  {
    symbol: 'PDR',
    name: 'CTCP Phát triển BĐS Phát Đạt',
    type: 'stock',
    baseAsset: 'PDR',
    quoteAsset: 'VND',
    price: 21.80,
    change24h: 0.93,
    high24h: 22.30,
    low24h: 21.40,
    volume24h: 420000000000,
    category: 'Bất động sản',
  },
  {
    symbol: 'NVL',
    name: 'CTCP Tập đoàn Đầu tư Địa ốc No Va (Novaland)',
    type: 'stock',
    baseAsset: 'NVL',
    quoteAsset: 'VND',
    price: 10.60,
    change24h: -0.93,
    high24h: 10.85,
    low24h: 10.45,
    volume24h: 480000000000,
    category: 'Bất động sản',
  },
  {
    symbol: 'DGC',
    name: 'CTCP Tập đoàn Hóa chất Đức Giang',
    type: 'stock',
    baseAsset: 'DGC',
    quoteAsset: 'VND',
    price: 110.50,
    change24h: 1.38,
    high24h: 112.00,
    low24h: 109.00,
    volume24h: 360000000000,
    category: 'Hóa chất & Photpho',
  },
  {
    symbol: 'PVD',
    name: 'Tổng CTCP Khoan và Dịch vụ Khoan Dầu khí',
    type: 'stock',
    baseAsset: 'PVD',
    quoteAsset: 'VND',
    price: 25.80,
    change24h: 0.78,
    high24h: 26.30,
    low24h: 25.40,
    volume24h: 290000000000,
    category: 'Dầu khí',
  },
  {
    symbol: 'PVS',
    name: 'Tổng CTCP Dịch vụ Kỹ thuật Dầu khí Việt Nam',
    type: 'stock',
    baseAsset: 'PVS',
    quoteAsset: 'VND',
    price: 38.50,
    change24h: 1.05,
    high24h: 39.20,
    low24h: 37.90,
    volume24h: 370000000000,
    category: 'Dầu khí & Điện gió',
  },
  {
    symbol: 'BSR',
    name: 'CTCP Lọc Hóa dầu Bình Sơn',
    type: 'stock',
    baseAsset: 'BSR',
    quoteAsset: 'VND',
    price: 22.40,
    change24h: 0.45,
    high24h: 22.80,
    low24h: 22.10,
    volume24h: 410000000000,
    category: 'Lọc Hóa Dầu',
  },

  // ===================== US TECH STOCKS =====================
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp',
    type: 'stock',
    baseAsset: 'NVDA',
    quoteAsset: 'USD',
    price: 132.8,
    change24h: 4.85,
    high24h: 134.5,
    low24h: 127.2,
    volume24h: 45000000000,
    category: 'AI Hardware / Tech',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc',
    type: 'stock',
    baseAsset: 'TSLA',
    quoteAsset: 'USD',
    price: 248.5,
    change24h: -2.15,
    high24h: 256.0,
    low24h: 244.2,
    volume24h: 18500000000,
    category: 'EV & Robotics',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc',
    type: 'stock',
    baseAsset: 'AAPL',
    quoteAsset: 'USD',
    price: 228.4,
    change24h: 1.12,
    high24h: 230.1,
    low24h: 226.5,
    volume24h: 12400000000,
    category: 'Big Tech',
  },
];

const US_EQUITY_SYMBOLS = new Set([
  'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD', 'SPY', 'QQQ',
]);

export function isVietnamSymbol(
  item: Pick<MarketSymbol, 'symbol' | 'type' | 'quoteAsset'>
): boolean {
  const sym = item.symbol.toUpperCase();
  if (sym === 'VNINDEX' || sym === 'VN30') return true;
  if (US_EQUITY_SYMBOLS.has(sym)) return false;
  return item.quoteAsset === 'VND' || item.type === 'vn30';
}

// Helper to map symbols to Yahoo Finance symbols
export function mapToYahooSymbol(symbol: string, type: string, quoteAsset?: string): string {
  const clean = symbol.trim().toUpperCase();
  if (clean === 'XAUUSD' || clean === 'GOLD') return 'GC=F';
  if (clean === 'OIL_WTI' || clean === 'WTI') return 'CL=F';
  if (clean === 'OIL_BRENT' || clean === 'BRENT') return 'BZ=F';
  if (clean === 'SILVER') return 'SI=F';

  const isVNStock =
    clean !== 'VNINDEX' &&
    clean !== 'VN30' &&
    !US_EQUITY_SYMBOLS.has(clean) &&
    (type === 'vn30' || quoteAsset === 'VND');

  if (isVNStock && !clean.includes('.VN') && !clean.includes('=')) {
    return `${clean}.VN`;
  }
  return clean;
}

const ENTRADE_BASES = ['/api/entrade', 'https://services.entrade.com.vn'];
const YAHOO_BASES = ['/api/yahoo', 'https://query1.finance.yahoo.com'];

// Fetch Real Historical Candlesticks from DNSE Entrade for VNINDEX, VN30, and HNX/UPCOM VN Stocks
export async function fetchEntradeKlines(
  symbol: string,
  timeframe: Timeframe = '1h',
  isIndex: boolean = false
): Promise<Candle[]> {
  const cleanSym = symbol.replace(/\.VN$/i, '').toUpperCase();
  const now = Math.floor(Date.now() / 1000);
  let resolution = '1H';
  let lookbackSec = 86400 * 45;

  if (timeframe === '1m' || timeframe === '5m' || timeframe === '15m') {
    resolution = '15';
    lookbackSec = 86400 * 14;
  } else if (timeframe === '1h' || timeframe === '4h') {
    resolution = '1H';
    lookbackSec = 86400 * 60;
  } else if (timeframe === '1D') {
    resolution = '1D';
    lookbackSec = 86400 * 240;
  } else if (timeframe === '1W' || timeframe === '1M') {
    resolution = '1W';
    lookbackSec = 86400 * 730;
  }

  const endpointKind = isIndex || cleanSym === 'VNINDEX' || cleanSym === 'VN30' ? 'index' : 'stock';
  const query = `/chart-api/v2/ohlcs/${endpointKind}?symbol=${encodeURIComponent(cleanSym)}&resolution=${resolution}&from=${now - lookbackSec}&to=${now}`;

  for (const base of ENTRADE_BASES) {
    try {
      const res = await fetch(`${base}${query}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data?.t) || data.t.length === 0) continue;

      const candles: Candle[] = [];
      for (let i = 0; i < data.t.length; i++) {
        const o = data.o?.[i];
        const h = data.h?.[i];
        const l = data.l?.[i];
        const c = data.c?.[i];
        const v = data.v?.[i] || 0;
        if (o != null && h != null && l != null && c != null) {
          candles.push({
            time: Number(data.t[i]),
            open: parseFloat(Number(o).toFixed(2)),
            high: parseFloat(Number(h).toFixed(2)),
            low: parseFloat(Number(l).toFixed(2)),
            close: parseFloat(Number(c).toFixed(2)),
            volume: Number(v),
          });
        }
      }
      if (candles.length > 0) return candles;
    } catch {
      // try next base
    }
  }
  throw new Error(`Failed Entrade klines for ${symbol}`);
}

// Fetch Real Historical Candlesticks for VN Stocks, Commodities, or US Stocks via Yahoo Finance (+ Entrade fallback)
export async function fetchStockKlines(
  symbol: string,
  timeframe: Timeframe = '1h',
  isVN: boolean = true
): Promise<Candle[]> {
  const cleanUpper = symbol.trim().toUpperCase();

  // VNINDEX & VN30 are served directly by DNSE Entrade
  if (cleanUpper === 'VNINDEX' || cleanUpper === 'VN30') {
    return fetchEntradeKlines(cleanUpper, timeframe, true);
  }

  const yahooSymbol = mapToYahooSymbol(cleanUpper, isVN ? 'vn30' : 'stock', isVN ? 'VND' : 'USD');
  let interval = '1d';
  let range = '3mo';

  if (timeframe === '1m' || timeframe === '5m' || timeframe === '15m') {
    interval = '15m';
    range = '5d';
  } else if (timeframe === '1h' || timeframe === '4h') {
    interval = '1h';
    range = '1mo';
  } else if (timeframe === '1D') {
    interval = '1d';
    range = '6mo';
  } else if (timeframe === '1W') {
    interval = '1wk';
    range = '1y';
  } else if (timeframe === '1M') {
    interval = '1mo';
    range = '5y';
  }

  const encodedSymbol = encodeURIComponent(yahooSymbol);

  for (const base of YAHOO_BASES) {
    try {
      const res = await fetch(
        `${base}/v8/finance/chart/${encodedSymbol}?interval=${interval}&range=${range}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) continue;

      const data = await res.json();
      const result = data.chart?.result?.[0];
      if (!result || !result.timestamp) continue;

      const timestamps: number[] = result.timestamp;
      const quote = result.indicators.quote[0];
      const divisor = yahooSymbol.endsWith('.VN') ? 1000 : 1;

      const candles: Candle[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const o = quote.open[i];
        const h = quote.high[i];
        const l = quote.low[i];
        const c = quote.close[i];
        const v = quote.volume[i] || 0;

        if (o !== null && h !== null && l !== null && c !== null) {
          candles.push({
            time: timestamps[i],
            open: parseFloat((o / divisor).toFixed(2)),
            high: parseFloat((h / divisor).toFixed(2)),
            low: parseFloat((l / divisor).toFixed(2)),
            close: parseFloat((c / divisor).toFixed(2)),
            volume: v,
          });
        }
      }

      if (candles.length > 0) {
        return candles;
      }
    } catch {
      // try fallback base
    }
  }

  // Fallback to DNSE Entrade for HNX / UPCOM Vietnam equities (e.g. PVS, BSR) not listed as .VN on Yahoo
  if (isVN) {
    return fetchEntradeKlines(cleanUpper, timeframe, false);
  }

  throw new Error(`Failed to fetch stock klines for ${symbol}`);
}

export interface LiveQuoteUpdate {
  price: number;
  change24h: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  source: 'binance' | 'yahoo' | 'entrade';
  updatedAt: number;
}

// In-memory cache for Macro / Stock quotes (12s TTL) so 3s Binance polls don't spam Yahoo/Entrade
const macroQuoteCache = new Map<string, LiveQuoteUpdate>();
let lastMacroSyncTs = 0;
let macroSyncInFlight: Promise<void> | null = null;
const MACRO_CACHE_TTL_MS = 12_000;

async function fetchYahooSparkBatch(yahooSymbols: string[]): Promise<Record<string, any>> {
  if (yahooSymbols.length === 0) return {};
  const query = `/v8/finance/spark?symbols=${encodeURIComponent(yahooSymbols.join(','))}&range=5d&interval=1d`;
  for (const base of YAHOO_BASES) {
    try {
      const res = await fetch(`${base}${query}`, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // try next base
    }
  }
  return {};
}

async function fetchSingleEntradeQuote(sym: string, isIndex: boolean): Promise<LiveQuoteUpdate | null> {
  const now = Math.floor(Date.now() / 1000);
  const kind = isIndex ? 'index' : 'stock';
  const query = `/chart-api/v2/ohlcs/${kind}?symbol=${encodeURIComponent(sym)}&resolution=1D&from=${now - 86400 * 14}&to=${now}`;

  for (const base of ENTRADE_BASES) {
    try {
      const res = await fetch(`${base}${query}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const d = await res.json();
      if (!Array.isArray(d?.c) || d.c.length === 0) continue;

      const idx = d.c.length - 1;
      const lastClose = Number(d.c[idx]);
      if (!(lastClose > 0)) continue;

      let prevClose = idx >= 1 ? Number(d.c[idx - 1]) : Number(d.o?.[idx] || lastClose);
      for (let k = idx - 1; k >= 0; k--) {
        if (Number(d.c[k]) > 0 && Number(d.c[k]) !== lastClose) {
          prevClose = Number(d.c[k]);
          break;
        }
      }
      const changePct = prevClose > 0 ? ((lastClose - prevClose) / prevClose) * 100 : 0;
      const high = Number(d.h?.[idx]) || lastClose;
      const low = Number(d.l?.[idx]) || lastClose;
      const volRaw = Number(d.v?.[idx]) || 0;
      // Convert share volume to VND turnover estimate for VN equities so Watchlist volume unit stays consistent
      const volume24h = isIndex ? volRaw * 25000 : volRaw * lastClose * 1000;

      return {
        price: parseFloat(lastClose.toFixed(2)),
        change24h: parseFloat(changePct.toFixed(2)),
        high24h: parseFloat(high.toFixed(2)),
        low24h: parseFloat(low.toFixed(2)),
        volume24h,
        source: 'entrade',
        updatedAt: Date.now(),
      };
    } catch {
      // try next base
    }
  }
  return null;
}

async function refreshMacroAndStockQuotes(symbols: MarketSymbol[]): Promise<void> {
  const nonBinanceItems = symbols.filter(s => {
    const upper = s.symbol.toUpperCase();
    const isBinanceGoldOrCrypto =
      s.type === 'crypto' || upper === 'PAXGUSDT' || upper === 'XAUUSD' || upper === 'GOLD';
    return !isBinanceGoldOrCrypto;
  });

  if (nonBinanceItems.length === 0) return;

  const yahooMapToAppSymbols = new Map<string, MarketSymbol[]>();
  const directEntradeItems: MarketSymbol[] = [];

  for (const item of nonBinanceItems) {
    const upper = item.symbol.toUpperCase();
    if (upper === 'VNINDEX' || upper === 'VN30') {
      directEntradeItems.push(item);
      continue;
    }
    const ySym = mapToYahooSymbol(upper, item.type, item.quoteAsset);
    const list = yahooMapToAppSymbols.get(ySym) || [];
    list.push(item);
    yahooMapToAppSymbols.set(ySym, list);
  }

  // Yahoo /v8/finance/spark enforces <= 20 symbols per batch
  const allYahooSyms = Array.from(yahooMapToAppSymbols.keys());
  const chunks: string[][] = [];
  for (let i = 0; i < allYahooSyms.length; i += 20) {
    chunks.push(allYahooSyms.slice(i, i + 20));
  }

  const missingVNStocks: MarketSymbol[] = [];

  const sparkResults = await Promise.all(chunks.map(chunk => fetchYahooSparkBatch(chunk)));
  const mergedSpark: Record<string, any> = Object.assign({}, ...sparkResults);

  for (const [ySym, appItems] of yahooMapToAppSymbols.entries()) {
    const entry = mergedSpark[ySym];
    const validCloses: number[] = Array.isArray(entry?.close)
      ? entry.close.filter((v: any): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)
      : [];

    if (validCloses.length === 0) {
      for (const appSym of appItems) {
        if (isVietnamSymbol(appSym)) {
          missingVNStocks.push(appSym);
        }
      }
      continue;
    }

    const divisor = ySym.endsWith('.VN') ? 1000 : 1;
    const rawLast = validCloses[validCloses.length - 1];
    const price = parseFloat((rawLast / divisor).toFixed(2));

    let change24h = 0;
    if (typeof entry.fulldayChangePercent === 'number' && Number.isFinite(entry.fulldayChangePercent) && entry.fulldayChangePercent !== 0) {
      change24h = parseFloat(entry.fulldayChangePercent.toFixed(2));
    } else {
      let prevRaw = typeof entry.chartPreviousClose === 'number' && entry.chartPreviousClose > 0
        ? entry.chartPreviousClose
        : rawLast;
      for (let i = validCloses.length - 2; i >= 0; i--) {
        if (validCloses[i] !== rawLast) {
          prevRaw = validCloses[i];
          break;
        }
      }
      if (prevRaw > 0) {
        change24h = parseFloat((((rawLast - prevRaw) / prevRaw) * 100).toFixed(2));
      }
    }

    const recentWindow = validCloses.slice(-2);
    const high24h = parseFloat((Math.max(...recentWindow) / divisor).toFixed(2));
    const low24h = parseFloat((Math.min(...recentWindow) / divisor).toFixed(2));

    const quoteUpdate: LiveQuoteUpdate = {
      price,
      change24h,
      high24h,
      low24h,
      source: 'yahoo',
      updatedAt: Date.now(),
    };

    for (const appSym of appItems) {
      macroQuoteCache.set(appSym.symbol, quoteUpdate);
    }
  }

  // Fetch VNINDEX, VN30, and any HNX/UPCOM VN stocks (e.g. PVS) from DNSE Entrade in parallel
  const entradeTargets = [...directEntradeItems, ...missingVNStocks];
  if (entradeTargets.length > 0) {
    await Promise.all(
      entradeTargets.map(async (item) => {
        const isIdx = item.symbol.toUpperCase() === 'VNINDEX' || item.symbol.toUpperCase() === 'VN30' || item.type === 'index';
        const q = await fetchSingleEntradeQuote(item.symbol, isIdx);
        if (q) {
          macroQuoteCache.set(item.symbol, q);
        }
      })
    );
  }

  lastMacroSyncTs = Date.now();
}

// Fetch real-time quotes across ALL Watchlist markets (Binance Crypto/Gold + Yahoo Commodities/US/HOSE + Entrade VNINDEX/VN30/HNX)
export async function fetchAllLiveMarketQuotes(
  symbols: MarketSymbol[],
  options?: { forceMacroRefresh?: boolean }
): Promise<Map<string, LiveQuoteUpdate>> {
  const quotes = new Map<string, LiveQuoteUpdate>();

  // 1. Collect Binance symbols (Crypto + PAXGUSDT for Gold)
  const binanceQuerySymbols = new Set<string>(['PAXGUSDT']);
  for (const s of symbols) {
    if (s.type === 'crypto') {
      binanceQuerySymbols.add(s.symbol.replace(/[/_-]/g, '').toUpperCase());
    }
  }

  // 2. Check whether Macro / Stock quotes need an initial or periodic refresh
  const hasUncachedNonCrypto = symbols.some(s => {
    const upper = s.symbol.toUpperCase();
    const isBinance = s.type === 'crypto' || upper === 'PAXGUSDT' || upper === 'XAUUSD' || upper === 'GOLD';
    return !isBinance && !macroQuoteCache.has(s.symbol) && upper !== 'SJC';
  });

  const shouldRefreshMacro =
    Boolean(options?.forceMacroRefresh) ||
    lastMacroSyncTs === 0 ||
    hasUncachedNonCrypto ||
    Date.now() - lastMacroSyncTs >= MACRO_CACHE_TTL_MS;

  const macroTask = shouldRefreshMacro
    ? (macroSyncInFlight ??= refreshMacroAndStockQuotes(symbols).finally(() => {
        macroSyncInFlight = null;
      }))
    : Promise.resolve();

  const [tickerList] = await Promise.all([
    fetchBinance24hTickersForSymbols(Array.from(binanceQuerySymbols)),
    macroTask,
  ]);

  // Populate Macro / Stock quotes from freshly updated cache
  for (const [sym, q] of macroQuoteCache.entries()) {
    quotes.set(sym, q);
  }

  // Populate Crypto & Gold quotes from Binance
  const binanceMap = new Map<string, LiveQuoteUpdate>();
  if (Array.isArray(tickerList)) {
    const now = Date.now();
    for (const t of tickerList) {
      const price = parseFloat(t.lastPrice);
      if (price > 0) {
        binanceMap.set(t.symbol, {
          price,
          change24h: parseFloat(parseFloat(t.priceChangePercent).toFixed(2)),
          high24h: parseFloat(t.highPrice),
          low24h: parseFloat(t.lowPrice),
          volume24h: parseFloat(t.quoteVolume),
          source: 'binance',
          updatedAt: now,
        });
      }
    }
  }

  const paxgQuote = binanceMap.get('PAXGUSDT');
  for (const s of symbols) {
    const upper = s.symbol.toUpperCase();
    if (upper === 'XAUUSD' || upper === 'GOLD' || upper === 'PAXGUSDT') {
      if (paxgQuote) {
        quotes.set(s.symbol, paxgQuote);
      }
      continue;
    }
    if (s.type === 'crypto') {
      const binKey = upper.replace(/[/_-]/g, '');
      const live = binanceMap.get(binKey);
      if (live) {
        quotes.set(s.symbol, live);
      }
    }
  }

  return quotes;
}

// Backward-compatible helper that returns updated MarketSymbol[] with real live prices across all markets
export async function updateAllLiveMarketPrices(
  symbols: MarketSymbol[],
  forceMacroRefresh: boolean = false
): Promise<MarketSymbol[]> {
  try {
    const quotes = await fetchAllLiveMarketQuotes(symbols, { forceMacroRefresh });
    if (quotes.size === 0) return symbols;

    return symbols.map(s => {
      const q = quotes.get(s.symbol);
      if (!q) return s;
      return {
        ...s,
        price: q.price,
        change24h: q.change24h,
        high24h: q.high24h ?? Math.max(s.high24h, q.price),
        low24h: q.low24h ?? Math.min(s.low24h, q.price),
        volume24h: q.volume24h ?? s.volume24h,
      };
    });
  } catch (e) {
    console.warn('Failed to update bulk live market prices:', e);
    return symbols;
  }
}

// Unified Market Data Fetcher with Real Live Data Sources
export async function fetchMarketData(
  symbolObj: MarketSymbol,
  timeframe: Timeframe = '1h'
): Promise<Candle[]> {
  // 1. Gold (XAUUSD / PAXGUSDT) or Crypto -> Live Binance API
  const isBinanceEligible =
    symbolObj.type === 'crypto' ||
    symbolObj.symbol === 'PAXGUSDT' ||
    symbolObj.symbol === 'XAUUSD' ||
    symbolObj.symbol === 'GOLD';

  if (isBinanceEligible) {
    try {
      const binSymbol = symbolObj.symbol === 'XAUUSD' || symbolObj.symbol === 'GOLD' ? 'PAXGUSDT' : symbolObj.symbol;
      const klines = await fetchBinanceKlines(binSymbol, timeframe, 250);
      if (klines && klines.length > 0) {
        return klines;
      }
    } catch (e) {
      console.warn(`Binance fetch failed for ${symbolObj.symbol}:`, e);
    }
  }

  // 2. Vietnam Stocks/Indices (VNINDEX, VN30, HOSE/HNX), Commodities (Oil/Silver), or US Stocks -> Yahoo Finance / DNSE Entrade
  if (
    symbolObj.type === 'vn30' ||
    symbolObj.type === 'stock' ||
    symbolObj.type === 'commodity' ||
    symbolObj.type === 'index'
  ) {
    try {
      const isVN = isVietnamSymbol(symbolObj);
      const klines = await fetchStockKlines(symbolObj.symbol, timeframe, isVN);
      if (klines && klines.length > 0) {
        return klines;
      }
    } catch (e) {
      console.warn(`Stock/Commodity data fetch failed for ${symbolObj.symbol}:`, e);
    }
  }

  // 3. Realistic high-fidelity fallback if offline
  return generateRealisticKlines(
    symbolObj.price,
    150,
    timeframe,
    symbolObj.type === 'crypto' ? 0.022 : symbolObj.type === 'commodity' ? 0.010 : 0.015
  );
}

// Generate realistic synthetic klines if offline
export function generateRealisticKlines(
  basePrice: number,
  count: number = 150,
  timeframe: Timeframe = '1h',
  volatility: number = 0.018
): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  let intervalSeconds = 3600;

  if (timeframe === '1m') intervalSeconds = 60;
  else if (timeframe === '5m') intervalSeconds = 300;
  else if (timeframe === '15m') intervalSeconds = 900;
  else if (timeframe === '4h') intervalSeconds = 14400;
  else if (timeframe === '1D') intervalSeconds = 86400;
  else if (timeframe === '1W') intervalSeconds = 604800;
  else if (timeframe === '1M') intervalSeconds = 2592000;

  let currentPrice = basePrice * 0.95;
  const startTime = now - count * intervalSeconds;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * intervalSeconds;
    const trendDrift = Math.sin(i / 15) * 0.002 + 0.0005;
    const shock = (Math.random() - 0.49) * volatility;
    const change = trendDrift + shock;

    const open = currentPrice;
    const close = Math.max(0.000001, open * (1 + change));
    const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.5));
    const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.5));
    const volume = Math.floor(basePrice * 1000 * (0.5 + Math.random() * 1.5) * (1 + Math.abs(change) * 10));

    candles.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
  }

  const scale = basePrice / candles[candles.length - 1].close;
  return candles.map(c => ({
    time: c.time,
    open: parseFloat((c.open * scale).toFixed(2)),
    high: parseFloat((c.high * scale).toFixed(2)),
    low: parseFloat((c.low * scale).toFixed(2)),
    close: parseFloat((c.close * scale).toFixed(2)),
    volume: c.volume,
  }));
}

export function getMarketSentiment(): MarketSentiment {
  return {
    fearAndGreedIndex: 74,
    sentimentClassification: 'Greed',
    longShortRatio: 1.38,
    fundingRate: 0.014,
    volatilityIndex: 17.8,
  };
}
