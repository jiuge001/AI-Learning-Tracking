@echo off
chcp 65001 >nul
title 学习跟踪系统 - 本地服务器

echo.
echo ╔════════════════════════════════╗
echo ║   📚 学习跟踪系统 启动中...    ║
echo ╚════════════════════════════════╝
echo.

cd /d "E:\私人\孩子学习\AI学习任务"

:: 检测Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到Python，请先安装Python 3
    echo    下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo ✅ Python 已就绪
echo.

:: 获取本机IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    set IP=!IP: =!
    goto :found
)
:found

echo ╔══════════════════════════════════════════╗
echo ║  📱 请在手机浏览器中打开以下地址：      ║
echo ╠══════════════════════════════════════════╣
echo ║                                          ║
echo ║   http://%IP%:8080                      ║
echo ║                                          ║
echo ║   ⚠️ 手机必须连接同一WiFi                ║
echo ║                                          ║
echo ╚══════════════════════════════════════════╝
echo.
echo 🔧 按 Ctrl+C 可停止服务器
echo.

python -m http.server 8080

pause
