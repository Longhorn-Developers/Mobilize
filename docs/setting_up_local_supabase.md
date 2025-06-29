# Setting Up Local Supabase Development

This guide will help you set up a local Supabase development environment for the Mobilize project.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (recommended) or npm
- **Docker Desktop** (required for local Supabase)
- **Supabase CLI** (we'll install this)

## 1. Install Supabase CLI

First, install the Supabase CLI globally:

```bash
# Using npm
npm install -g supabase

# Using pnpm
pnpm add -g supabase

# Using Homebrew (macOS)
brew install supabase/tap/supabase
```

Verify the installation:

```bash
supabase --version
```

## 2. Install Project Dependencies

Navigate to the project directory and install dependencies:

```bash
cd /path/to/mobilize
pnpm install
```

## 3. Set Up Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Local Supabase URLs (these are the default local ports)
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# Optional: OpenAI API Key for Supabase AI features in Studio
OPENAI_API_KEY=your_openai_api_key_here
```

## 4. Start Local Supabase

Start the local Supabase services:

```bash
supabase start
```

This command will:

- Pull and start Docker containers for PostgreSQL, PostgREST, GoTrue, and other services
- Create a local database with the schema defined in your migrations
- Start Supabase Studio on `http://127.0.0.1:54323`
- Display connection information

You should see output similar to:

```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

## 5. Apply Migrations

The initial migration should be applied automatically when you start Supabase. However, if you need to apply migrations manually:

```bash
# Apply all pending migrations
supabase db reset

# Or apply specific migration
supabase db push
```

## 6. Access Supabase Studio

Open your browser and navigate to `http://127.0.0.1:54323` to access the local Supabase Studio. Here you can:

- View and manage your database tables
- Execute SQL queries
- Manage authentication
- Test API endpoints
- View logs

## Working with Migrations

### Understanding Migrations

Migrations are SQL files that define your database schema changes. They're stored in the `supabase/migrations/` directory and are applied in chronological order based on their timestamp prefix.

### Creating a New Migration

When you need to make database changes, create a new migration:

```bash
# Generate a new migration file
supabase migration new your_migration_name

# Example
supabase migration new add_user_preferences_table
```

This creates a new file in `supabase/migrations/` with a timestamp prefix, like:
`20250101120000_add_user_preferences_table.sql`

### Writing Migration Files

Edit the generated migration file with your SQL changes:

```sql
-- Example migration: add_user_preferences_table.sql
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'light',
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);
```

### Applying Migrations

After creating a migration, apply it to your local database:

```bash
# Apply the latest migration
supabase db push

# Or reset the entire database and apply all migrations
supabase db reset
```

### Creating Migrations from Supabase Studio Changes

When you make changes in Supabase Studio (like creating tables, modifying columns, etc.), you need to generate a migration to capture those changes:

```bash
# Generate a migration from the current database state
supabase db diff --schema public -f migration_name

# Example
supabase db diff --schema public -f add_new_table_from_studio
```

This will:

1. Compare your current database state with the last migration
2. Generate a new migration file with the differences
3. Apply the migration to your local database

### Best Practices for Migrations

1. **Always create migrations for schema changes** - Don't make direct changes to production databases
2. **Use descriptive names** - Migration names should clearly describe what they do
3. **Test migrations locally first** - Always test on your local environment before applying to production
4. **Keep migrations small and focused** - One logical change per migration
5. **Include rollback considerations** - Think about how to undo changes if needed

## Development Workflow

### Daily Development

1. **Start local Supabase** (if not already running):

   ```bash
   supabase start
   ```

2. **Start your development server**:

   ```bash
   pnpm start
   ```

3. **Make database changes** either through:

   - Supabase Studio (then generate migration)
   - Direct migration files

4. **Test your changes** in the local environment

### When Making Database Changes

1. **If using Supabase Studio**:

   - Make your changes in the Studio interface
   - Generate a migration: `supabase db diff --schema public -f descriptive_name`
   - Review the generated migration file
   - Commit the migration to version control

2. **If writing migrations directly**:
   - Create a new migration: `supabase migration new descriptive_name`
   - Write your SQL changes
   - Apply the migration: `supabase db push`
   - Test your changes

### Stopping Local Supabase

When you're done developing:

```bash
# Stop all Supabase services
supabase stop

# Or stop and remove all data
supabase stop --no-backup
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: If ports 54321-54329 are in use, Supabase will fail to start. Stop other services using these ports.

2. **Docker not running**: Make sure Docker Desktop is running before starting Supabase.

3. **Migration conflicts**: If you have conflicting migrations, you may need to reset the database:

   ```bash
   supabase db reset
   ```

4. **Connection issues**: Ensure your `.env` file has the correct local URLs and keys.

### Useful Commands

```bash
# Check Supabase status
supabase status

# View logs
supabase logs

# Reset database (careful - this deletes all data)
supabase db reset

# Generate types for TypeScript
supabase gen types typescript --local > types/supabase.ts

# Backup database
supabase db dump --data-only > backup.sql
```

## Next Steps

- Read the [Supabase CLI documentation](https://supabase.com/docs/guides/cli)
- Explore the [Supabase Studio](http://127.0.0.1:54323) to understand your database structure
- Check out the existing migrations in `supabase/migrations/` to understand the current schema
- Review the Supabase client setup in `utils/supabase.ts`

## Additional Resources

- [Supabase Local Development Guide](https://supabase.com/docs/guides/local-development)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Database Schema Design](https://supabase.com/docs/guides/database/designing-schemas)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
