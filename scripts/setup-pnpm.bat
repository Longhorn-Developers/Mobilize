@echo off
REM pnpm Setup Script for Cloudflare Migration
echo 🚀 Setting up Mobilize with pnpm and Cloudflare...

REM Check if pnpm is installed
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ pnpm not found. Please install it first:
    echo npm install -g pnpm
    pause
    exit /b 1
)

echo ✅ pnpm found

REM Check if wrangler is installed globally
wrangler --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Installing Wrangler CLI globally...
    pnpm add -g wrangler
)

echo ✅ Wrangler CLI ready

REM Check if user is logged in
wrangler whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔐 Please login to Cloudflare:
    wrangler login
    if %errorlevel% neq 0 (
        echo ❌ Login failed
        pause
        exit /b 1
    )
)

echo ✅ Logged in to Cloudflare

REM Setup worker backend
echo 📦 Setting up worker backend...
cd worker
if exist "package.json" (
    pnpm install
    echo ✅ Worker dependencies installed
) else (
    echo ❌ Worker package.json not found
    cd ..
    pause
    exit /b 1
)

REM Create D1 database
echo 🗄️ Creating D1 database...
wrangler d1 create mobilize-db
echo.
echo ⚠️ IMPORTANT: Copy the database_id from above and update worker/wrangler.toml
echo Replace "your-database-id-here" with the actual database ID
echo.
pause

REM Run database migrations
echo 🗄️ Running database migrations...
wrangler d1 execute mobilize-db --file=./src/database/schema.sql
if %errorlevel% neq 0 (
    echo ❌ Database migration failed
    echo Make sure you updated the database_id in wrangler.toml
    cd ..
    pause
    exit /b 1
)

echo ✅ Database schema applied

REM Set up JWT secret
echo 🔐 Setting up JWT secret...
echo Please enter a secure JWT secret (or press Enter for auto-generated):
set /p JWT_SECRET=
if "%JWT_SECRET%"=="" (
    echo Generating random JWT secret...
    set JWT_SECRET=mobilize-secret-%random%-%random%-%random%
    echo Generated: %JWT_SECRET%
)

echo %JWT_SECRET% | wrangler secret put JWT_SECRET
echo ✅ JWT secret configured

REM Deploy the worker
echo 🚀 Deploying Cloudflare Worker...
wrangler deploy
if %errorlevel% neq 0 (
    echo ❌ Deployment failed
    cd ..
    pause
    exit /b 1
)

echo ✅ Worker deployed successfully!

REM Get worker URL
echo 📋 Getting worker URL...
for /f "tokens=*" %%i in ('wrangler whoami') do set WHOAMI_OUTPUT=%%i
echo %WHOAMI_OUTPUT%

echo.
echo 🎉 Worker setup complete!
echo.
echo 📋 Next steps:
echo 1. Copy the worker URL from above
echo 2. Create a .env file in the project root:
echo    EXPO_PUBLIC_CLOUDFLARE_API_URL=https://your-worker.your-subdomain.workers.dev
echo 3. Go back to project root and install client dependencies:
echo    cd ..
echo    pnpm install
echo 4. Start your app:
echo    pnpm start
echo.
echo 🔧 Useful commands:
echo    - Start worker locally: cd worker ^&^& pnpm run dev
echo    - View logs: cd worker ^&^& wrangler tail
echo    - Update secrets: cd worker ^&^& wrangler secret put SECRET_NAME
echo.
pause

REM Go back to project root
cd ..

echo 🏁 Setup complete! Follow the next steps above to finish the migration.
pause
