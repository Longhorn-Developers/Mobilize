#!/bin/bash

# Cloudflare Setup Script for Mobilize Migration
# This script helps set up the Cloudflare infrastructure for the migrated application

set -e

echo "🚀 Setting up Cloudflare infrastructure for Mobilize..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI found"

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare first:"
    echo "wrangler login"
    exit 1
fi

echo "✅ Logged in to Cloudflare"

# Create D1 database
echo "📦 Creating D1 database..."
DB_OUTPUT=$(wrangler d1 create mobilize-db)
echo "$DB_OUTPUT"

# Extract database ID from output
DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)

if [ -z "$DB_ID" ]; then
    echo "❌ Failed to extract database ID"
    exit 1
fi

echo "✅ Database created with ID: $DB_ID"

# Update wrangler.toml with the database ID
if [ -f "wrangler.toml" ]; then
    sed -i.bak "s/your-database-id-here/$DB_ID/g" wrangler.toml
    echo "✅ Updated wrangler.toml with database ID"
    rm wrangler.toml.bak 2>/dev/null || true
else
    echo "❌ wrangler.toml not found"
    exit 1
fi

# Run database migrations
echo "🗄️ Running database migrations..."
if [ -f "src/database/schema.sql" ]; then
    wrangler d1 execute mobilize-db --file=./src/database/schema.sql
    echo "✅ Database schema applied"
else
    echo "❌ Schema file not found at src/database/schema.sql"
    exit 1
fi

# Set up JWT secret
echo "🔐 Setting up JWT secret..."
echo "Please enter a secure JWT secret (or press Enter for auto-generated):"
read -s JWT_SECRET

if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "Generated JWT secret: $JWT_SECRET"
fi

echo "$JWT_SECRET" | wrangler secret put JWT_SECRET
echo "✅ JWT secret configured"

# Deploy the worker
echo "🚀 Deploying Cloudflare Worker..."
wrangler deploy

echo "✅ Worker deployed successfully!"

# Get the worker URL
WORKER_URL=$(wrangler whoami | grep -o 'https://[^.]*\.workers\.dev' | head -1)
if [ -z "$WORKER_URL" ]; then
    WORKER_URL="https://mobilize-api.your-subdomain.workers.dev"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your client app's environment variables:"
echo "   EXPO_PUBLIC_CLOUDFLARE_API_URL=$WORKER_URL"
echo ""
echo "2. Test the API endpoints:"
echo "   curl $WORKER_URL/"
echo ""
echo "3. Run your client application and test the migration"
echo ""
echo "🔧 Useful commands:"
echo "   - View logs: wrangler tail"
echo "   - Update secrets: wrangler secret put SECRET_NAME"
echo "   - Execute SQL: wrangler d1 execute mobilize-db --command 'SELECT * FROM profiles'"
echo "   - Deploy updates: wrangler deploy"
echo ""
echo "📚 For more information, see MIGRATION_GUIDE.md"
