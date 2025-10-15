# 🚀 Quick Start Guide - Supabase to Cloudflare Migration

This guide will get your Mobilize app running with Cloudflare in under 10 minutes using pnpm.

## Prerequisites ✅

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Cloudflare account (free tier works)

## Step 1: Install Global Dependencies

```bash
# Install Wrangler CLI globally
pnpm add -g wrangler

# Verify installation
wrangler --version
```

## Step 2: Login to Cloudflare

```bash
wrangler login
```
This opens your browser to authenticate with Cloudflare.

## Step 3: Run the Setup Script

```bash
# Run the automated setup script
pnpm run setup:cloudflare
```

**OR manually follow these steps:**

### 3a. Setup Worker Backend
```bash
# Install worker dependencies
pnpm run setup:worker

# This will create the D1 database and show you a database_id
# IMPORTANT: Copy this database_id and update worker/wrangler.toml
```

### 3b. Update wrangler.toml
Open `worker/wrangler.toml` and replace `your-database-id-here` with the actual database ID from step 3a.

### 3c. Run Database Migrations
```bash
pnpm run db:migrate
```

### 3d. Set JWT Secret
```bash
cd worker
echo "your-secure-jwt-secret-here" | wrangler secret put JWT_SECRET
cd ..
```

### 3e. Deploy Worker
```bash
pnpm run deploy:worker
```

## Step 4: Configure Environment

Create a `.env` file in the project root:

```bash
# For local development
EXPO_PUBLIC_CLOUDFLARE_API_URL=http://localhost:8787

# For production (replace with your actual worker URL)
# EXPO_PUBLIC_CLOUDFLARE_API_URL=https://mobilize-api.your-subdomain.workers.dev
```

## Step 5: Install All Dependencies

```bash
# Install both client and worker dependencies
pnpm run install:all
```

## Step 6: Test the Setup

### 6a. Start the Worker Locally
```bash
pnpm run dev:worker
```
You should see: `[mf:inf] Ready on http://localhost:8787`

### 6b. Test the API
```bash
# In a new terminal
pnpm run test:api
```
Expected response: `{"message":"Mobilize API","environment":"development","timestamp":"..."}`

### 6c. Start the Client App
```bash
# In another terminal
pnpm start
```

## Step 7: Test the Migration

1. **Open your app** in simulator/device
2. **Test authentication**:
   - Try registering a new user
   - Try logging in
3. **Test map functionality**:
   - Verify map loads
   - Check if POIs display
   - Test reporting avoidance areas
4. **Verify data persistence**:
   - Create some data
   - Refresh the app
   - Check if data persists

## 🎯 Success Indicators

✅ Worker responds at `http://localhost:8787`  
✅ App loads without errors  
✅ Authentication works (register/login)  
✅ Map displays with POIs  
✅ Can create avoidance areas  
✅ Data persists after refresh  

## 🚨 Troubleshooting

### Worker not starting?
```bash
cd worker
pnpm install
pnpm run dev
```

### Database errors?
```bash
# Check if database_id is correct in wrangler.toml
# Re-run migrations
pnpm run db:migrate
```

### Authentication issues?
```bash
# Check JWT secret is set
cd worker
wrangler secret list
```

### CORS errors?
- Verify `.env` file has correct API URL
- Make sure worker is running on the URL in `.env`

### Data not loading?
```bash
# Check worker logs
pnpm run worker:logs

# Test API directly
curl http://localhost:8787/pois
```

## 📋 Useful Commands

```bash
# Development
pnpm run dev:worker          # Start worker locally
pnpm start                   # Start Expo app
pnpm run test:api           # Test API endpoint

# Database
pnpm run db:shell           # Open database shell
pnpm run db:migrate         # Run migrations

# Deployment
pnpm run deploy:worker      # Deploy to Cloudflare

# Monitoring
pnpm run worker:logs        # View live logs
```

## 🎉 You're Done!

Your Mobilize app is now running on Cloudflare! 

### Next Steps:
1. Test all functionality thoroughly
2. Deploy to production when ready
3. Set up monitoring and backups
4. Configure custom domain (optional)

### Need Help?
- Check `MIGRATION_GUIDE.md` for detailed documentation
- Check `scripts/setup-pnpm.md` for comprehensive setup guide
- Run `pnpm run worker:logs` to see what's happening

## 🏆 Migration Benefits

- **Global Edge Deployment**: Faster worldwide
- **Cost Efficient**: Pay-per-request
- **Simplified Architecture**: Fewer dependencies
- **Better DX**: Modern tooling with Wrangler
- **Auto-scaling**: Handles traffic spikes automatically
