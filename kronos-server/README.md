---
title: Kronos Financial Foundation Model Server
emoji: 📈
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# 🚀 Kronos Foundation Model Inference Server (FastAPI)

Đây là Microservice chạy mô hình **Kronos: A Foundation Model for the Language of Financial Markets (AAAI 2026)** từ [`shiyu-coder/Kronos`](https://github.com/shiyu-coder/Kronos), đã được tối ưu hóa trích xuất **Phân vị Đa Kịch Bản (P05, P15, P50, P85, P95)** và **Nến Tương Lai OHLCV (Ghost Candlesticks)** cho dự án **Trading New Pro**.

## Các Endpoint Chính
* `GET /api/kronos/status`: Kiểm tra trạng thái GPU/CPU và danh sách model (`Kronos-mini 4.1M`, `Kronos-small 24.7M`, `Kronos-base 102.3M`).
* `POST /api/kronos/predict`: Dự báo chuỗi nến OHLCV tương lai kèm phân vị xác suất P05/P15/P50/P85/P95.
* `POST /api/kronos/batch`: Dự báo song song (`predict_batch`) cho nhiều mã chứng khoán/crypto cùng lúc.

## Cách chạy Local
```bash
cd kronos-server
pip install -r requirements.txt
python app.py
```
Server sẽ khởi chạy tại `http://localhost:7860` và tự động kết nối với giao diện `trading-new`.
