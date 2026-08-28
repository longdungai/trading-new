#!/bin/bash
echo "========================================================"
echo "       TRADING NEW PRO - AI MARKET TERMINAL"
echo "========================================================"
echo ""
echo "[1/2] Kiểm tra Node.js..."
if ! command -v node &> /dev/null
then
    echo "[LỖI] Chưa cài đặt Node.js. Vui lòng cài tại https://nodejs.org"
    exit 1
fi

echo "[2/2] Đang khởi chạy hệ thống..."
echo "Truy cập tại: http://localhost:5173"
echo "========================================================"
npm run dev
