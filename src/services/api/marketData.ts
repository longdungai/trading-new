import { Candle, MarketSentiment, MarketSymbol, Timeframe } from '../../types';
import { fetchBinanceKlines, fetchBinance24hTickersForSymbols } from './binance';
import { getMarketSessionInfo } from '../../utils/marketHours';
import { getVnExchangeBoard, isVnDerivativeSymbol } from '../vnMarket/vnStockMicrostructure';

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
    symbol: 'VN30F1M',
    name: 'HĐTL Chỉ số VN30 Kỳ hạn 1 Tháng (Phái sinh)',
    type: 'vn30',
    baseAsset: 'VN30F1M',
    quoteAsset: 'VND',
    price: 1888.50,
    change24h: 0.28,
    high24h: 1896.00,
    low24h: 1881.20,
    volume24h: 34500000000000,
    category: 'Phái sinh HNX - HĐTL Chỉ số VN30',
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
  // --- 10 Nhóm Ngành Dẫn Sóng Việt Nam (HOSE • HNX • UPCOM) ---
  {
    symbol: 'LPB',
    name: 'Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)',
    type: 'stock',
    baseAsset: 'LPB',
    quoteAsset: 'VND',
    price: 33.20,
    change24h: 0.91,
    high24h: 33.80,
    low24h: 32.80,
    volume24h: 420000000000,
    category: 'Ngân hàng',
  },
  {
    symbol: 'SHS',
    name: 'CTCP Chứng khoán Sài Gòn - Hà Nội (HNX)',
    type: 'stock',
    baseAsset: 'SHS',
    quoteAsset: 'VND',
    price: 15.60,
    change24h: 0.65,
    high24h: 15.90,
    low24h: 15.30,
    volume24h: 340000000000,
    category: 'Chứng khoán (HNX)',
  },
  {
    symbol: 'MBS',
    name: 'CTCP Chứng khoán MB (HNX)',
    type: 'stock',
    baseAsset: 'MBS',
    quoteAsset: 'VND',
    price: 28.40,
    change24h: 1.07,
    high24h: 28.90,
    low24h: 27.90,
    volume24h: 265000000000,
    category: 'Chứng khoán (HNX)',
  },
  {
    symbol: 'FTS',
    name: 'CTCP Chứng khoán FPT',
    type: 'stock',
    baseAsset: 'FTS',
    quoteAsset: 'VND',
    price: 42.60,
    change24h: 1.19,
    high24h: 43.30,
    low24h: 41.90,
    volume24h: 245000000000,
    category: 'Chứng khoán',
  },
  {
    symbol: 'VIX',
    name: 'CTCP Chứng khoán VIX',
    type: 'stock',
    baseAsset: 'VIX',
    quoteAsset: 'VND',
    price: 11.80,
    change24h: 0.85,
    high24h: 12.10,
    low24h: 11.60,
    volume24h: 510000000000,
    category: 'Chứng khoán',
  },
  {
    symbol: 'KDH',
    name: 'CTCP Đầu tư và Kinh doanh Nhà Khang Điền',
    type: 'stock',
    baseAsset: 'KDH',
    quoteAsset: 'VND',
    price: 34.50,
    change24h: 0.58,
    high24h: 35.10,
    low24h: 34.00,
    volume24h: 215000000000,
    category: 'Bất động sản Dân cư',
  },
  {
    symbol: 'NLG',
    name: 'CTCP Đầu tư Nam Long',
    type: 'stock',
    baseAsset: 'NLG',
    quoteAsset: 'VND',
    price: 38.90,
    change24h: 0.78,
    high24h: 39.50,
    low24h: 38.30,
    volume24h: 198000000000,
    category: 'Bất động sản Dân cư',
  },
  {
    symbol: 'CEO',
    name: 'CTCP Tập đoàn C.E.O (HNX)',
    type: 'stock',
    baseAsset: 'CEO',
    quoteAsset: 'VND',
    price: 14.90,
    change24h: -0.67,
    high24h: 15.30,
    low24h: 14.60,
    volume24h: 210000000000,
    category: 'Bất động sản (HNX)',
  },
  {
    symbol: 'KBC',
    name: 'Tổng Công ty Phát triển Đô thị Kinh Bắc',
    type: 'stock',
    baseAsset: 'KBC',
    quoteAsset: 'VND',
    price: 29.40,
    change24h: 1.03,
    high24h: 29.95,
    low24h: 28.90,
    volume24h: 385000000000,
    category: 'BĐS Khu Công Nghiệp',
  },
  {
    symbol: 'IDC',
    name: 'Tổng Công ty IDICO (HNX)',
    type: 'stock',
    baseAsset: 'IDC',
    quoteAsset: 'VND',
    price: 56.80,
    change24h: 0.89,
    high24h: 57.60,
    low24h: 56.00,
    volume24h: 240000000000,
    category: 'BĐS Khu Công Nghiệp (HNX)',
  },
  {
    symbol: 'SZC',
    name: 'CTCP Sonadezi Châu Đức',
    type: 'stock',
    baseAsset: 'SZC',
    quoteAsset: 'VND',
    price: 41.20,
    change24h: 1.23,
    high24h: 41.90,
    low24h: 40.50,
    volume24h: 175000000000,
    category: 'BĐS Khu Công Nghiệp',
  },
  {
    symbol: 'VGC',
    name: 'Tổng Công ty Viglacera',
    type: 'stock',
    baseAsset: 'VGC',
    quoteAsset: 'VND',
    price: 46.50,
    change24h: 0.65,
    high24h: 47.20,
    low24h: 45.90,
    volume24h: 165000000000,
    category: 'BĐS KCN & Vật liệu',
  },
  {
    symbol: 'HSG',
    name: 'CTCP Tập đoàn Hoa Sen',
    type: 'stock',
    baseAsset: 'HSG',
    quoteAsset: 'VND',
    price: 19.85,
    change24h: 0.76,
    high24h: 20.20,
    low24h: 19.50,
    volume24h: 365000000000,
    category: 'Thép & Tôn mạ',
  },
  {
    symbol: 'NKG',
    name: 'CTCP Thép Nam Kim',
    type: 'stock',
    baseAsset: 'NKG',
    quoteAsset: 'VND',
    price: 20.60,
    change24h: 0.98,
    high24h: 21.00,
    low24h: 20.20,
    volume24h: 295000000000,
    category: 'Thép & Xuất khẩu',
  },
  {
    symbol: 'HHV',
    name: 'CTCP Đầu tư Hạ tầng Giao thông Đèo Cả',
    type: 'stock',
    baseAsset: 'HHV',
    quoteAsset: 'VND',
    price: 12.65,
    change24h: 0.80,
    high24h: 12.90,
    low24h: 12.45,
    volume24h: 185000000000,
    category: 'Đầu tư công & Hạ tầng',
  },
  {
    symbol: 'VCG',
    name: 'Tổng CTCP Xuất nhập khẩu & Xây dựng VN (Vinaconex)',
    type: 'stock',
    baseAsset: 'VCG',
    quoteAsset: 'VND',
    price: 19.40,
    change24h: 0.52,
    high24h: 19.80,
    low24h: 19.10,
    volume24h: 210000000000,
    category: 'Đầu tư công & Xây dựng',
  },
  {
    symbol: 'CTD',
    name: 'CTCP Xây dựng Coteccons',
    type: 'stock',
    baseAsset: 'CTD',
    quoteAsset: 'VND',
    price: 68.50,
    change24h: 1.33,
    high24h: 69.60,
    low24h: 67.40,
    volume24h: 230000000000,
    category: 'Xây dựng & Hạ tầng',
  },
  {
    symbol: 'LCG',
    name: 'CTCP Lizen',
    type: 'stock',
    baseAsset: 'LCG',
    quoteAsset: 'VND',
    price: 11.40,
    change24h: 0.44,
    high24h: 11.65,
    low24h: 11.20,
    volume24h: 135000000000,
    category: 'Đầu tư công',
  },
  {
    symbol: 'PVT',
    name: 'Tổng CTCP Vận tải Dầu khí (PVTrans)',
    type: 'stock',
    baseAsset: 'PVT',
    quoteAsset: 'VND',
    price: 27.90,
    change24h: 0.72,
    high24h: 28.40,
    low24h: 27.50,
    volume24h: 195000000000,
    category: 'Vận tải Dầu khí',
  },
  {
    symbol: 'REE',
    name: 'CTCP Cơ Điện Lạnh',
    type: 'stock',
    baseAsset: 'REE',
    quoteAsset: 'VND',
    price: 65.80,
    change24h: 0.61,
    high24h: 66.70,
    low24h: 65.00,
    volume24h: 165000000000,
    category: 'Điện & Hạ tầng Nước',
  },
  {
    symbol: 'PC1',
    name: 'CTCP Tập đoàn PC1',
    type: 'stock',
    baseAsset: 'PC1',
    quoteAsset: 'VND',
    price: 28.20,
    change24h: 0.71,
    high24h: 28.70,
    low24h: 27.80,
    volume24h: 175000000000,
    category: 'Xây lắp Điện & Khoáng sản',
  },
  {
    symbol: 'FRT',
    name: 'CTCP Bán lẻ Kỹ thuật số FPT (Long Châu)',
    type: 'stock',
    baseAsset: 'FRT',
    quoteAsset: 'VND',
    price: 178.50,
    change24h: 1.42,
    high24h: 181.00,
    low24h: 175.80,
    volume24h: 260000000000,
    category: 'Bán lẻ Dược phẩm & ICT',
  },
  {
    symbol: 'DGW',
    name: 'CTCP Thế Giới Số (Digiworld)',
    type: 'stock',
    baseAsset: 'DGW',
    quoteAsset: 'VND',
    price: 44.60,
    change24h: 0.90,
    high24h: 45.30,
    low24h: 43.90,
    volume24h: 185000000000,
    category: 'Phân phối ICT & Tiêu dùng',
  },
  {
    symbol: 'DCM',
    name: 'CTCP Phân bón Dầu khí Cà Mau',
    type: 'stock',
    baseAsset: 'DCM',
    quoteAsset: 'VND',
    price: 37.40,
    change24h: 0.81,
    high24h: 38.00,
    low24h: 36.90,
    volume24h: 215000000000,
    category: 'Phân bón & Hóa chất',
  },
  {
    symbol: 'DPM',
    name: 'Tổng CTCP Phân bón và Hóa chất Dầu khí (Đạm Phú Mỹ)',
    type: 'stock',
    baseAsset: 'DPM',
    quoteAsset: 'VND',
    price: 35.60,
    change24h: 0.56,
    high24h: 36.20,
    low24h: 35.10,
    volume24h: 195000000000,
    category: 'Phân bón & Hóa chất',
  },
  {
    symbol: 'GMD',
    name: 'CTCP Gemadept',
    type: 'stock',
    baseAsset: 'GMD',
    quoteAsset: 'VND',
    price: 64.90,
    change24h: 1.09,
    high24h: 65.80,
    low24h: 64.00,
    volume24h: 255000000000,
    category: 'Cảng biển & Logistics',
  },
  {
    symbol: 'HAH',
    name: 'CTCP Vận tải và Xếp dỡ Hải An',
    type: 'stock',
    baseAsset: 'HAH',
    quoteAsset: 'VND',
    price: 43.20,
    change24h: 1.17,
    high24h: 43.90,
    low24h: 42.50,
    volume24h: 225000000000,
    category: 'Vận tải biển Container',
  },
  {
    symbol: 'VHC',
    name: 'CTCP Vĩnh Hoàn',
    type: 'stock',
    baseAsset: 'VHC',
    quoteAsset: 'VND',
    price: 72.40,
    change24h: 0.84,
    high24h: 73.50,
    low24h: 71.50,
    volume24h: 155000000000,
    category: 'Thủy sản Xuất khẩu',
  },
  {
    symbol: 'ANV',
    name: 'CTCP Nam Việt (Navico)',
    type: 'stock',
    baseAsset: 'ANV',
    quoteAsset: 'VND',
    price: 31.80,
    change24h: 0.63,
    high24h: 32.40,
    low24h: 31.30,
    volume24h: 145000000000,
    category: 'Thủy sản Xuất khẩu',
  },
  {
    symbol: 'DBC',
    name: 'CTCP Tập đoàn Dabaco Việt Nam',
    type: 'stock',
    baseAsset: 'DBC',
    quoteAsset: 'VND',
    price: 28.90,
    change24h: 1.05,
    high24h: 29.50,
    low24h: 28.40,
    volume24h: 345000000000,
    category: 'Nông nghiệp & Thực phẩm',
  },
  {
    symbol: 'TNG',
    name: 'CTCP Đầu tư và Thương mại TNG (HNX)',
    type: 'stock',
    baseAsset: 'TNG',
    quoteAsset: 'VND',
    price: 25.40,
    change24h: 0.79,
    high24h: 25.90,
    low24h: 25.00,
    volume24h: 165000000000,
    category: 'Dệt may Xuất khẩu (HNX)',
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
  if (sym === 'VNINDEX' || sym === 'VN30' || isVnDerivativeSymbol(sym)) return true;
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
    !isVnDerivativeSymbol(clean) &&
    !US_EQUITY_SYMBOLS.has(clean) &&
    (type === 'vn30' || quoteAsset === 'VND');

  if (isVNStock && !clean.includes('.VN') && !clean.includes('=')) {
    return `${clean}.VN`;
  }
  return clean;
}

const ENTRADE_BASES = ['/api/entrade', 'https://services.entrade.com.vn'];
const YAHOO_BASES = ['/api/yahoo', 'https://query1.finance.yahoo.com'];

// Fetch Real Historical Candlesticks from DNSE Entrade for VNINDEX, VN30, VN30F1M Derivatives, and HNX/UPCOM VN Stocks
export async function fetchEntradeKlines(
  symbol: string,
  timeframe: Timeframe = '1h',
  isIndex: boolean = false
): Promise<Candle[]> {
  const cleanSym = symbol.replace(/\.VN$/i, '').toUpperCase();
  const isDeriv = isVnDerivativeSymbol(cleanSym);
  const now = Math.floor(Date.now() / 1000);
  let resolution = '1H';
  let lookbackSec = 86400 * 45;

  if (timeframe === '1m') {
    resolution = isDeriv ? '1' : '15';
    lookbackSec = isDeriv ? 86400 * 5 : 86400 * 14;
  } else if (timeframe === '5m') {
    resolution = isDeriv ? '5' : '15';
    lookbackSec = isDeriv ? 86400 * 10 : 86400 * 14;
  } else if (timeframe === '15m') {
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

  const endpointKind = isDeriv
    ? 'derivative'
    : isIndex || cleanSym === 'VNINDEX' || cleanSym === 'VN30'
    ? 'index'
    : 'stock';
  const query = `/chart-api/v2/ohlcs/${endpointKind}?symbol=${encodeURIComponent(cleanSym)}&resolution=${resolution}&from=${now - lookbackSec}&to=${now}`;

  for (const base of ENTRADE_BASES) {
    try {
      const res = await fetch(`${base}${query}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
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

// Fetch Real Historical Candlesticks for VN Stocks, Commodities, or US Stocks via Yahoo Finance (+ Entrade primary/fallback)
export async function fetchStockKlines(
  symbol: string,
  timeframe: Timeframe = '1h',
  isVN: boolean = true
): Promise<Candle[]> {
  const cleanUpper = symbol.trim().toUpperCase();
  const vnBoard = isVN ? getVnExchangeBoard(cleanUpper) : null;

  // VNINDEX, VN30, VN30F1M Derivative, and HNX/UPCOM equities are served directly by DNSE Entrade
  if (
    cleanUpper === 'VNINDEX' ||
    cleanUpper === 'VN30' ||
    isVnDerivativeSymbol(cleanUpper) ||
    vnBoard === 'HNX' ||
    vnBoard === 'UPCOM'
  ) {
    return fetchEntradeKlines(cleanUpper, timeframe, vnBoard === 'INDEX');
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
        { headers: { Accept: 'application/json' }, cache: 'no-store' }
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

// In-memory cache for Macro / Stock quotes (8s TTL) so fast polls stay real-time without spamming Yahoo/Entrade
const macroQuoteCache = new Map<string, LiveQuoteUpdate>();
let lastMacroSyncTs = 0;
let macroSyncInFlight: Promise<void> | null = null;
const MACRO_CACHE_TTL_MS = 8_000;

async function fetchYahooSparkBatch(yahooSymbols: string[]): Promise<Record<string, any>> {
  if (yahooSymbols.length === 0) return {};
  const query = `/v8/finance/spark?symbols=${encodeURIComponent(yahooSymbols.join(','))}&range=5d&interval=1d`;
  for (const base of YAHOO_BASES) {
    try {
      const res = await fetch(`${base}${query}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
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
  const cleanSym = sym.trim().toUpperCase();
  const isDeriv = isVnDerivativeSymbol(cleanSym);
  const now = Math.floor(Date.now() / 1000);
  const kind = isDeriv ? 'derivative' : isIndex ? 'index' : 'stock';
  const query = `/chart-api/v2/ohlcs/${kind}?symbol=${encodeURIComponent(cleanSym)}&resolution=1D&from=${now - 86400 * 14}&to=${now}`;

  for (const base of ENTRADE_BASES) {
    try {
      const res = await fetch(`${base}${query}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
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
      // Convert volume to VND turnover: VN30F1M = 100,000 VND/pt/contract; Equities = price(k)*1000
      const volume24h = isDeriv
        ? volRaw * lastClose * 100_000
        : isIndex
        ? volRaw * 25_000
        : volRaw * lastClose * 1_000;

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

async function refreshMacroAndStockQuotes(
  symbols: MarketSymbol[],
  onlyOpenExchanges: boolean = false
): Promise<void> {
  const nowDate = new Date();
  const nonBinanceItems = symbols.filter(s => {
    const upper = s.symbol.toUpperCase();
    const isBinance24x7 = s.type === 'crypto' || upper === 'PAXGUSDT';
    if (isBinance24x7) return false;
    if (onlyOpenExchanges && macroQuoteCache.has(s.symbol)) {
      return getMarketSessionInfo(s, nowDate).isOpen;
    }
    return true;
  });

  if (nonBinanceItems.length === 0) {
    lastMacroSyncTs = Date.now();
    return;
  }

  const yahooMapToAppSymbols = new Map<string, MarketSymbol[]>();
  const directEntradeItems: MarketSymbol[] = [];

  for (const item of nonBinanceItems) {
    const upper = item.symbol.toUpperCase();
    const vnBoard = isVietnamSymbol(item) ? getVnExchangeBoard(upper) : null;
    if (
      upper === 'VNINDEX' ||
      upper === 'VN30' ||
      isVnDerivativeSymbol(upper) ||
      vnBoard === 'HNX' ||
      vnBoard === 'UPCOM'
    ) {
      if (upper !== 'SJC') {
        directEntradeItems.push(item);
      }
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

// Fetch real-time quotes across ALL Watchlist markets (Binance Crypto/PAXG + Yahoo Commodities/US/HOSE + Entrade VNINDEX/VN30/HNX)
export async function fetchAllLiveMarketQuotes(
  symbols: MarketSymbol[],
  options?: { forceMacroRefresh?: boolean }
): Promise<Map<string, LiveQuoteUpdate>> {
  const quotes = new Map<string, LiveQuoteUpdate>();

  // 1. Collect Binance 24/7 symbols (Crypto + PAXGUSDT)
  const binanceQuerySymbols = new Set<string>();
  for (const s of symbols) {
    const upper = s.symbol.toUpperCase();
    if (s.type === 'crypto' || upper === 'PAXGUSDT') {
      binanceQuerySymbols.add(upper.replace(/[/_-]/g, ''));
    }
  }

  // 2. Check whether Macro / Stock quotes need an initial or periodic refresh
  const hasUncachedNonCrypto = symbols.some(s => {
    const upper = s.symbol.toUpperCase();
    const isBinance = s.type === 'crypto' || upper === 'PAXGUSDT';
    return !isBinance && !macroQuoteCache.has(s.symbol) && upper !== 'SJC';
  });

  const isColdOrForced =
    Boolean(options?.forceMacroRefresh) ||
    lastMacroSyncTs === 0 ||
    hasUncachedNonCrypto;

  const shouldRefreshMacro =
    isColdOrForced || Date.now() - lastMacroSyncTs >= MACRO_CACHE_TTL_MS;

  const macroTask = shouldRefreshMacro
    ? (macroSyncInFlight ??= refreshMacroAndStockQuotes(symbols, !isColdOrForced).finally(() => {
        macroSyncInFlight = null;
      }))
    : Promise.resolve();

  const [tickerList] = await Promise.all([
    fetchBinance24hTickersForSymbols(Array.from(binanceQuerySymbols)),
    macroTask,
  ]);

  // Populate Macro / Stock / Commodity quotes from freshly updated cache
  for (const [sym, q] of macroQuoteCache.entries()) {
    quotes.set(sym, q);
  }

  // Populate 24/7 Crypto & PAXGUSDT quotes from Binance
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

  for (const s of symbols) {
    const upper = s.symbol.toUpperCase();
    if (s.type === 'crypto' || upper === 'PAXGUSDT') {
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
  // 1. 24/7 Crypto & Tokenized Gold (PAXGUSDT) -> Live Binance API
  const isBinanceEligible =
    symbolObj.type === 'crypto' || symbolObj.symbol.toUpperCase() === 'PAXGUSDT';

  if (isBinanceEligible) {
    try {
      const klines = await fetchBinanceKlines(symbolObj.symbol, timeframe, 250);
      if (klines && klines.length > 0) {
        return klines;
      }
    } catch (e) {
      console.warn(`Binance fetch failed for ${symbolObj.symbol}:`, e);
    }
  }

  // 2. Vietnam Stocks/Indices (VNINDEX, VN30, HOSE/HNX), Spot/COMEX Commodities (XAUUSD, Oil, Silver), or US Stocks -> Yahoo Finance / DNSE Entrade
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

let cachedCryptoFng: { value: number; ts: number } | null = null;

export async function fetchLiveCryptoFearAndGreed(
  forceRefresh: boolean = false
): Promise<number | null> {
  if (!forceRefresh && cachedCryptoFng && Date.now() - cachedCryptoFng.ts < 180_000) {
    return cachedCryptoFng.value;
  }
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const val = parseInt(json?.data?.[0]?.value, 10);
      if (Number.isFinite(val) && val >= 0 && val <= 100) {
        cachedCryptoFng = { value: val, ts: Date.now() };
        return val;
      }
    }
  } catch {
    // fallback to calculated RSI + market breadth if offline
  }
  return cachedCryptoFng ? cachedCryptoFng.value : null;
}

function classifySentimentScore(score: number): MarketSentiment['sentimentClassification'] {
  if (score >= 75) return 'Extreme Greed';
  if (score >= 56) return 'Greed';
  if (score >= 45) return 'Neutral';
  if (score >= 25) return 'Fear';
  return 'Extreme Fear';
}

export function getMarketSentiment(
  currentSymbol?: MarketSymbol,
  candles: Candle[] = [],
  symbols: MarketSymbol[] = [],
  liveCryptoFng?: number | null,
  liveFundingRatePct8h?: number | null
): MarketSentiment {
  // 1. Compute real RSI(14) and Realized Volatility from actual historical candles
  let rsi14 = 50;
  let avgRangePct = 1.5;

  if (candles.length >= 15) {
    let gains = 0;
    let losses = 0;
    for (let i = candles.length - 14; i < candles.length; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    rsi14 = Math.round(100 - 100 / (1 + rs));

    const recent = candles.slice(-20);
    const sumRange = recent.reduce(
      (acc, c) => acc + (c.close > 0 ? ((c.high - c.low) / c.close) * 100 : 0),
      0
    );
    avgRangePct = parseFloat((sumRange / recent.length).toFixed(2));
  }

  // 2. Compute real Market Breadth across peer group in Watchlist
  const peerList =
    currentSymbol && symbols.length > 0
      ? symbols.filter(s =>
          isVietnamSymbol(currentSymbol)
            ? isVietnamSymbol(s)
            : currentSymbol.type === 'crypto'
            ? s.type === 'crypto'
            : s.type === currentSymbol.type
        )
      : symbols;

  const activeList = peerList.length > 0 ? peerList : symbols;
  const advancers = activeList.filter(s => s.change24h > 0).length;
  const decliners = activeList.filter(s => s.change24h < 0).length;
  const totalTracked = activeList.length;
  const breadthRatio = totalTracked > 0 ? advancers / totalTracked : 0.5;

  const isCrypto = currentSymbol?.type === 'crypto' || currentSymbol?.symbol === 'PAXGUSDT';
  const useLiveFng = isCrypto && typeof liveCryptoFng === 'number';

  const compositeScore = useLiveFng
    ? liveCryptoFng
    : Math.max(0, Math.min(100, Math.round(rsi14 * 0.6 + breadthRatio * 100 * 0.4)));

  return {
    fearAndGreedIndex: compositeScore,
    sentimentClassification: classifySentimentScore(compositeScore),
    longShortRatio: decliners > 0 ? parseFloat((advancers / decliners).toFixed(2)) : advancers,
    fundingRate: typeof liveFundingRatePct8h === 'number' ? liveFundingRatePct8h : 0,
    volatilityIndex: avgRangePct,
    isLiveCryptoFng: useLiveFng,
    sourceLabel: useLiveFng
      ? 'Alternative.me Crypto F&G (Thực tế)'
      : 'Tính từ RSI(14) & Độ rộng nhóm mã thực tế',
    advancers,
    decliners,
    totalTracked,
    rsi14,
  };
}
