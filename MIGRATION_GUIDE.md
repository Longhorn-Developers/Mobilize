# Supabase to Cloudflare Migration Guide

This guide documents the migration of the Mobilize application from Supabase to Cloudflare Workers and D1.

## What Was Migrated

### Database
- **From**: PostgreSQL with PostGIS extension
- **To**: Cloudflare D1 (SQLite) with JSON storage for geospatial data

### Authentication
- **From**: Supabase Auth
- **To**: Custom JWT-based authentication in Cloudflare Workers

### API
- **From**: Supabase REST API with PostgREST
- **To**: Custom REST API built with Hono on Cloudflare Workers

### Edge Functions
- **From**: Supabase Edge Functions (Deno)
- **To**: Cloudflare Workers

## Key Changes

### 1. Database Schema Changes

#### Geospatial Data Storage
- **Before**: PostGIS geometry columns with spatial indexing
- **After**: JSON strings storing GeoJSON format

#### Table Structure
- Removed `auth.users` table (handled by custom auth)
- Added `password_hash` column to `profiles` table
- Changed geometry columns to JSON text columns

### 2. API Changes

#### Authentication
- **Before**: Supabase client with built-in auth
- **After**: Custom JWT tokens with manual token management

#### Data Fetching
- **Before**: Supabase query builder with React Query integration
- **After**: Direct fetch calls to Cloudflare Workers API

#### Data Types
- **Before**: TypeScript types generated from Supabase
- **After**: Custom types matching the new API structure

### 3. Client-Side Changes

#### Supabase Client Replacement
The `utils/supabase.ts` file has been replaced with `utils/cloudflare.ts` that provides a similar interface but uses the new Cloudflare API.

#### Authentication Provider
Updated `utils/AuthProvider.tsx` to work with the new JWT-based authentication system.

#### Data Fetching
Replaced Supabase queries with direct API calls in components.

## Setup Instructions

### 1. Cloudflare Workers Setup

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Create D1 database:
```bash
wrangler d1 create mobilize-db
```

4. Update `wrangler.toml` with your database ID.

5. Run database migrations:
```bash
wrangler d1 execute mobilize-db --file=./src/database/schema.sql
```

6. Deploy the worker:
```bash
wrangler deploy
```

### 2. Environment Variables

Create a `.env` file with:
```bash
EXPO_PUBLIC_CLOUDFLARE_API_URL=https://your-worker.your-subdomain.workers.dev
```

For the worker, set these secrets:
```bash
wrangler secret put JWT_SECRET
```

### 3. Client Setup

1. Update dependencies in `package.json`:
```bash
# Remove Supabase dependencies
npm uninstall @supabase/supabase-js @supabase-cache-helpers/postgrest-react-query supabase

# Add new dependencies (if needed)
npm install hono
```

2. Update environment variables in your client app.

## Migration Steps

### 1. Data Migration

To migrate existing data from Supabase to Cloudflare D1:

1. Export data from Supabase using the admin panel or SQL queries
2. Transform geometry data to GeoJSON format
3. Import data into D1 using the migration scripts

### 2. Feature Parity

The following features have been implemented:

- ✅ User authentication (register/login/logout)
- ✅ User profiles management
- ✅ Avoidance areas CRUD operations
- ✅ POI data management
- ✅ User preferences and common locations
- ✅ Avoidance area reporting
- ✅ POI synchronization from KML

### 3. Limitations

#### Geospatial Queries
- **Before**: Complex spatial queries with PostGIS functions
- **After**: Simple bounding box queries (client-side filtering for complex operations)

#### Real-time Features
- **Before**: Supabase real-time subscriptions
- **After**: Polling or manual refresh (can be enhanced with WebSockets)

#### Row Level Security
- **Before**: Database-level RLS policies
- **After**: Application-level authorization checks

## Testing

### 1. Local Development

1. Start the worker locally:
```bash
wrangler dev
```

2. Update your client to use `http://localhost:8787` as the API URL.

3. Test all functionality:
- User registration/login
- Map data loading
- Avoidance area creation
- POI display

### 2. Production Deployment

1. Deploy to Cloudflare:
```bash
wrangler deploy --env production
```

2. Update environment variables for production.

3. Run integration tests.

## Performance Considerations

### Advantages
- **Global Edge Deployment**: Faster response times worldwide
- **Cost Efficiency**: Pay-per-request pricing model
- **Simplified Architecture**: Fewer moving parts

### Considerations
- **Geospatial Operations**: Less sophisticated than PostGIS
- **Complex Queries**: May require client-side processing
- **Real-time Updates**: Need to implement custom solutions

## Monitoring and Maintenance

### 1. Logs
Monitor Cloudflare Workers logs:
```bash
wrangler tail
```

### 2. Analytics
Use Cloudflare Analytics dashboard for API usage metrics.

### 3. Database Management
Use D1 dashboard or CLI for database operations:
```bash
wrangler d1 execute mobilize-db --command "SELECT * FROM profiles LIMIT 10"
```

## Rollback Plan

If needed, you can rollback to Supabase by:

1. Reverting client code changes
2. Restoring Supabase dependencies
3. Updating environment variables
4. Ensuring data consistency

## Support

For issues with the migration:
1. Check Cloudflare Workers logs
2. Verify D1 database state
3. Test API endpoints directly
4. Review client-side error handling
