@echo off
REM Test script to verify the Cloudflare migration setup

echo 🧪 Testing Mobilize Cloudflare Migration Setup...
echo.

REM Test 1: Check if worker is running locally
echo 📡 Testing local worker...
curl -s http://localhost:8787/ >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Local worker is running at http://localhost:8787
    curl -s http://localhost:8787/
    echo.
) else (
    echo ❌ Local worker not running. Start it with: pnpm run dev:worker
    echo.
)

REM Test 2: Check if client dependencies are installed
echo 📦 Checking client dependencies...
if exist "node_modules" (
    echo ✅ Client dependencies installed
) else (
    echo ❌ Client dependencies not installed. Run: pnpm install
)

REM Test 3: Check if worker dependencies are installed
echo 📦 Checking worker dependencies...
if exist "worker\node_modules" (
    echo ✅ Worker dependencies installed
) else (
    echo ❌ Worker dependencies not installed. Run: pnpm run setup:worker
)

REM Test 4: Check environment file
echo 🔧 Checking environment configuration...
if exist ".env" (
    echo ✅ .env file exists
    findstr "EXPO_PUBLIC_CLOUDFLARE_API_URL" .env >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ API URL configured in .env
    ) else (
        echo ⚠️ API URL not found in .env file
    )
) else (
    echo ❌ .env file not found. Create it with your API URL
)

echo.
echo 🎯 Setup Test Complete!
echo.
echo 📋 Next steps:
echo 1. Make sure worker is running: pnpm run dev:worker
echo 2. Start the client app: pnpm start
echo 3. Test authentication and map functionality
echo.
pause
