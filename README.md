# 🚀 Trading New PRO - AI Market Terminal

> **Nền tảng phân tích kỹ thuật, dự báo đường giá AI và trung tâm chiến lược giao dịch chuyên nghiệp dành cho Crypto, Chứng khoán Việt Nam (VN30), Vàng (XAUUSD), Dầu mỏ (WTI/Brent), Bạc & Cổ phiếu Mỹ.**

---

## 🌟 Tính Năng Nổi Bật

### 1. 📊 Đa Thị Trường & Cập Nhật Thời Gian Thực (Real-Time 2.5s)
- **Hàng Hóa Toàn Cầu:** Vàng Thế Giới (`XAUUSD`), Vàng số (`PAXGUSDT`), Vàng Miếng SJC Việt Nam (`SJC`), Dầu Thô WTI (`OIL_WTI`), Dầu Thô Brent (`OIL_BRENT`), Bạc (`SILVER`).
- **Top 10 Crypto:** Bitcoin (`BTC`), Ethereum (`ETH`), Solana (`SOL`), BNB, XRP, Dogecoin, Cardano, Avalanche, Sui, Chainlink qua luồng **Binance WebSocket Live**.
- **Chứng Khoán Việt Nam (VN30 & Midcaps):** Dữ liệu chuẩn xác theo **SSI iBoard** (`VNINDEX`, `VN30`, `FPT`, `HPG`, `VIC`, `VHM`, `MWG`, `MSN`, `GAS`, `STB`, `VCB`, `TCB`, `SSI`, `VPB`, `VND`, `DIG`, `DXG`...).
- **Quản lý mã linh hoạt:** Thêm mã mới với danh mục gợi ý thông minh 300+ mã, chỉnh sửa, xóa và lưu trữ tự động (`localStorage`).

### 2. 🤖 Dự Báo Đường Giá AI & Mô Phỏng Monte Carlo
- Dự báo xu hướng giá tương lai với 3 kịch bản xác suất: **Tăng Giá (Bullish)**, **Cơ Sở (Base)**, **Điều Chỉnh (Bearish)**.
- Dải hành lang biến động tin cậy **Monte Carlo 95%**.
- Tự động nhận diện cơ sở dự báo và các động lực kỹ thuật chính.

### 3. 🎯 Trung Tâm 7 Chiến Lược Giao Dịch Định Lượng (Strategy Hub)
1. **SuperTrend + EMA Golden Ribbon:** Bám xu hướng lớn qua SuperTrend và cụm EMA 20/50/200.
2. **Smart Money (SMC) Order Blocks:** Bắt nhịp quét thanh khoản (Liquidity Sweep) và khối lệnh cá mập.
3. **Fibonacci Golden Pocket 0.618:** Đón sóng hồi chuẩn mực tại vùng tỉ lệ vàng 61.8% – 65%.
4. **RSI Mean Reversion (30/70):** Bắt đáy quá bán (< 30) và chốt lời hạ tỉ trọng khi quá mua (> 70).
5. **Bollinger Bands Squeeze & Breakout:** Bắt trọn con sóng lớn khi dải Bollinger nén hẹp sau đó bung mở biên độ.
6. **MACD Momentum Expansion:** Đo lường gia tốc giá qua Histogram và điểm giao cắt Zero-Lag.
7. **Phá Vỡ & Retest Hỗ Trợ/Kháng Cự:** Giao dịch theo các ngưỡng cản cứng nhiều lần chạm bật lịch sử.
- **Thanh đồng thuận đa chiến lược (Confluence Meter):** Thống kê số lượng thuật toán đồng pha MUA/BÁN.
- **Kế hoạch vào lệnh hoàn chỉnh:** Entry Zone, Cắt Lỗ (Stop Loss), 3 Mốc Chốt Lời (TP1, TP2, TP3), Tỉ lệ Risk:Reward và Xác suất thắng (Win Rate %).

### 4. 🧪 Bộ Kiểm Thử Lịch Sử Thực Tế (Backtest Engine)
- Mô phỏng và kiểm thử độc lập cho từng chiến lược trên tập dữ liệu nến lịch sử thực tế.
- Báo cáo chi tiết: **Tỉ lệ thắng (Win Rate %)**, **Hệ số lợi nhuận (Profit Factor)**, **Mức sụt giảm tối đa (Max Drawdown %)**, **Đồ thị tăng trưởng vốn (Equity Curve SVG)** và nhật ký từng lệnh (Trade Log).

### 5. 📱 Trải Nghiệm Hoàn Hảo Đa Nền Tảng (PWA & Mobile UI/UX)
- Hỗ trợ cài đặt thành App Native trên **iPhone (Safari)**, **iPad**, **Android (Chrome)**, **Windows** và **macOS**.
- Thanh điều hướng đáy màn hình (Mobile Bottom Navigation Bar) chuẩn phong cách TradingView / Binance.
- Thanh chọn khung thời gian và thanh chỉ báo vuốt cảm ứng mượt mà.

---

## 🛠️ Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Khởi chạy trên máy tính cục bộ:
```bash
# Cài đặt thư viện
npm install

# Khởi chạy server phát triển
npm run dev
```

Hoặc nhấp đúp chuột vào file **`start.bat`** (Windows) / chạy `bash start.sh` (macOS/Linux).

### 2. Triển khai lên Vercel (Miễn phí 100%):
- Kết nối kho GitHub `https://github.com/longdungai/trading-new.git` với Vercel.
- Vercel tự động build thông qua cấu hình `vercel.json`.

### 3. Đồng bộ cập nhật lên GitHub & Vercel:
- Nhấp đúp chuột vào file **`update.bat`** để tự động commit và đẩy lên GitHub.

---

## 📁 Cấu Trúc Dự Án

```
trading-ai-terminal/
├── src/
│   ├── components/
│   │   ├── AIInsight/       # Dự báo AI, Chiến lược Hub, Quản lý vốn
│   │   ├── Backtest/        # Bộ mô phỏng Backtesting
│   │   ├── Chart/           # Biểu đồ Lightweight Charts & Panels
│   │   ├── Layout/          # Thanh Header, Thanh điều hướng Mobile
│   │   └── Market/          # Danh sách theo dõi, Bản đồ nhiệt, Sổ lệnh
│   ├── services/
│   │   ├── ai/              # Bộ sinh tín hiệu 7 chiến lược & Dự báo ML
│   │   ├── analysis/        # Thuật toán S/R, Fibonacci, Smart Money
│   │   ├── api/             # Kết nối Binance WebSocket, Yahoo & SSI Quotes
│   │   ├── backtesting/     # Động cơ Backtesting đa chiến lược
│   │   └── indicators/      # Bộ chỉ báo kỹ thuật EMA, BB, SuperTrend, RSI, MACD
│   ├── types/               # TypeScript interfaces & types
│   ├── App.tsx              # Component trung tâm điều phối
│   └── main.tsx
├── public/
│   ├── manifest.json        # Cấu hình PWA Native App
│   └── service-worker.js    # Bộ nhớ đệm PWA
├── vercel.json              # Cấu hình Cloud Proxy Vercel
├── update.bat               # Kịch bản 1-click đồng bộ GitHub
└── start.bat                # Kịch bản 1-click khởi chạy
```
