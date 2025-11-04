# Complete Setup Guide with pnpm

This guide will help you set up the Cloudflare migration using pnpm package manager.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **pnpm** (latest version)
3. **Cloudflare account** (free tier is sufficient)

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

This will open your browser to authenticate with Cloudflare.

## Step 3: Setup the Worker Backend

```bash
# Navigate to worker directory
cd worker

# Install dependencies
pnpm install

# Create D1 database
pnpm run db:create
```

**Important**: Copy the `database_id` from the output and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "mobilize-db"
database_id = "your-actual-database-id-here"  # Replace this
```

## Step 4: Run Database Migrations

```bash
# Apply the database schema
pnpm run db:migrate
```

## Step 5: Set Environment Variables

```bash
# Set JWT secret (use a strong random string)
echo "your-secure-jwt-secret-here" | wrangler secret put JWT_SECRET

# Optional: Set environment
wrangler secret put ENVIRONMENT development
```

## Step 6: Test the Worker Locally

```bash
# Start local development server
pnpm run dev
```

This will start the worker at `http://localhost:8787`

### Test the API endpoints:

```bash
# Health check
curl http://localhost:8787/

# Expected response:
# {"message":"Mobilize API","environment":"development","timestamp":"..."}
```

## Step 7: Deploy to Cloudflare

```bash
# Deploy the worker
pnpm run deploy
```

Copy the deployment URL (e.g., `https://mobilize-api.your-subdomain.workers.dev`)

## Step 8: Setup the Client App

```bash
# Go back to project root
cd ..

# Install client dependencies
pnpm install

# Add wrangler for client scripts
pnpm add -D wrangler
```

## Step 9: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# .env
EXPO_PUBLIC_CLOUDFLARE_API_URL=https://mobilize-api.your-subdomain.workers.dev
```

For local development:
```bash
# .env.local
EXPO_PUBLIC_CLOUDFLARE_API_URL=http://localhost:8787
```

## Step 10: Test the Complete Application

### Start the client app:

```bash
# Start Expo development server
pnpm start
```

### Test the migration:

1. **Open the app** in your simulator/device
2. **Test authentication**:
   - Try registering a new user
   - Try logging in
   - Check if user data persists

3. **Test map functionality**:
   - Verify map loads with POIs
   - Check if avoidance areas display
   - Test reporting new avoidance areas

4. **Test data persistence**:
   - Create some data
   - Refresh the app
   - Verify data persists

## Troubleshooting

### Common Issues:

1. **Database not found**:
   ```bash
   cd worker
   pnpm run db:create
   # Update wrangler.toml with new database_id
   pnpm run db:migrate
   ```

2. **Authentication errors**:
   ```bash
   # Check JWT secret is set
   wrangler secret list
   
   # Reset JWT secret
   echo "new-secure-secret" | wrangler secret put JWT_SECRET
   ```

3. **CORS errors**:
   - Check if the API URL is correct in your `.env` file
   - Verify the worker is deployed and accessible

4. **Data not loading**:
   ```bash
   # Check worker logs
   wrangler tail
   
   # Test API directly
   curl https://your-worker.your-subdomain.workers.dev/pois
   ```

### Useful Commands:

```bash
# Worker management
cd worker
pnpm run dev              # Start local development
pnpm run deploy           # Deploy to Cloudflare
pnpm run db:shell         # Open database shell
wrangler tail             # View live logs

# Client management
pnpm start                # Start Expo app
pnpm run lint             # Lint code
pnpm run format           # Format code
```

## Data Migration (if needed)

If you have existing Supabase data to migrate:

1. **Export data from Supabase**:
   ```sql
   -- Export avoidance areas
   SELECT id, name, ST_AsGeoJSON(boundary) as boundary_json, description, user_id, created_at, updated_at 
   FROM avoidance_areas;
   
   -- Export POIs
   SELECT id, poi_type, metadata, ST_AsGeoJSON(location) as location_json, created_at, updated_at 
   FROM pois;
   ```

2. **Transform data** to match the new schema (convert PostGIS to GeoJSON)

3. **Import to D1**:
   ```bash
   cd worker
   pnpm run db:shell
   # Then run INSERT statements with your data
   ```

## Production Deployment

1. **Update environment**:
   ```bash
   cd worker
   wrangler secret put ENVIRONMENT production
   ```

2. **Deploy to production**:
   ```bash
   pnpm run deploy:production
   ```

3. **Update client environment**:
   ```bash
   # Update .env with production URL
   EXPO_PUBLIC_CLOUDFLARE_API_URL=https://mobilize-api-prod.your-subdomain.workers.dev
   ```

## Monitoring

- **Cloudflare Dashboard**: Monitor API usage and performance
- **Worker Logs**: `wrangler tail` for real-time logs
- **D1 Database**: Use the Cloudflare dashboard or CLI to monitor database

## Next Steps

1. Test all functionality thoroughly
2. Set up monitoring and alerts
3. Configure custom domain (optional)
4. Set up CI/CD for automated deployments
5. Implement backup strategies for D1 data

## Support

If you encounter issues:
1. Check the worker logs: `wrangler tail`
2. Verify database state: `pnpm run db:shell`
3. Test API endpoints directly with curl
4. Check environment variables and secrets
5. Review the MIGRATION_GUIDE.md for detailed information
