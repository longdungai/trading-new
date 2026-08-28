@echo off
title Trading New PRO - AI Terminal Launcher
echo ========================================================
echo        TRADING NEW PRO - AI MARKET TERMINAL
echo ========================================================
echo.
echo [1/3] Kiem tra Node.js moi truong...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] May tinh cua ban chua cai dat Node.js. Vui long cai dat Node.js tai https://nodejs.org
    pause
    exit /b 1
)

echo [2/3] Khoi dong may chu he thong...
echo.
echo ========================================================
echo   Terminal dang chay tai:
echo   - Tren may tinh nay : http://localhost:5173
echo   - Tren dien thoai/iPad cung mang Wi-Fi: Xem dong ben duoi
echo ========================================================
echo.

npm run dev
pause
