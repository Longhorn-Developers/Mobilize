@echo off
REM Cloudflare Setup Script for Mobilize Migration (Windows)
REM This script helps set up the Cloudflare infrastructure for the migrated application

echo 🚀 Setting up Cloudflare infrastructure for Mobilize...

REM Check if wrangler is installed
wrangler --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Wrangler CLI not found. Please install it first:
    echo npm install -g wrangler
    pause
    exit /b 1
)

echo ✅ Wrangler CLI found

REM Check if user is logged in
wrangler whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔐 Please login to Cloudflare first:
    echo wrangler login
    pause
    exit /b 1
)

echo ✅ Logged in to Cloudflare

REM Create D1 database
echo 📦 Creating D1 database...
wrangler d1 create mobilize-db

echo ✅ Database created

REM Update wrangler.toml with the database ID (manual step)
echo ⚠️ Please manually update wrangler.toml with your database ID
echo Find the database_id in the output above and replace "your-database-id-here" in wrangler.toml

REM Run database migrations
echo 🗄️ Running database migrations...
if exist "src\database\schema.sql" (
    wrangler d1 execute mobilize-db --file=./src/database/schema.sql
    echo ✅ Database schema applied
) else (
    echo ❌ Schema file not found at src\database\schema.sql
    pause
    exit /b 1
)

REM Set up JWT secret
echo 🔐 Setting up JWT secret...
echo Please enter a secure JWT secret:
set /p JWT_SECRET=
if "%JWT_SECRET%"=="" (
    echo Generating random JWT secret...
    set JWT_SECRET=random-secret-%random%-%random%
)

echo %JWT_SECRET% | wrangler secret put JWT_SECRET
echo ✅ JWT secret configured

REM Deploy the worker
echo 🚀 Deploying Cloudflare Worker...
wrangler deploy

echo ✅ Worker deployed successfully!

echo.
echo 🎉 Setup complete!
echo.
echo 📋 Next steps:
echo 1. Update your client app's environment variables with your worker URL
echo 2. Test the API endpoints
echo 3. Run your client application and test the migration
echo.
echo 🔧 Useful commands:
echo    - View logs: wrangler tail
echo    - Update secrets: wrangler secret put SECRET_NAME
echo    - Execute SQL: wrangler d1 execute mobilize-db --command "SELECT * FROM profiles"
echo    - Deploy updates: wrangler deploy
echo.
echo 📚 For more information, see MIGRATION_GUIDE.md
pause
