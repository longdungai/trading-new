@echo off
title Dong Bo Len GitHub va Vercel - Trading New PRO
echo ========================================================
echo       DONG BO TRADING NEW PRO LEN GITHUB & VERCEL
echo ========================================================
echo.
set /p msg="Nhap noi dung ban vua cap nhat (hoac Enter de mac dinh): "
if "%msg%"=="" set msg="Cap nhat tinh nang Trading New PRO"

echo.
echo [1/3] Dang gom tat ca cac file da sua...
git add .

echo [2/3] Dang luu thay doi (Commit: %msg%)...
git commit -m "%msg%"

echo [3/3] Dang day code len GitHub...
git push origin main

echo.
echo ========================================================
echo [THANH CONG!] 
echo Code da duoc day len GitHub.
echo Vercel se tu dong cap nhat trang web sau 10 - 15 giay!
echo ========================================================
pause
