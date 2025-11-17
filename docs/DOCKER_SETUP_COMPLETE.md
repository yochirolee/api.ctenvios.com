# Complete Docker Database Setup Guide

This guide covers the complete setup process from scratch: migrations, Prisma Client generation, and seeding.

## Complete Setup Order

### Step 1: Start Containers

```bash
# Start Docker containers
docker compose up -d

# Verify containers are running
docker compose ps
```

### Step 2: Wait for PostgreSQL to be Ready

```bash
# Watch PostgreSQL logs until it's ready
docker compose logs -f postgres

# You'll see: "database system is ready to accept connections"
# Press Ctrl+C when ready
```

Or wait about 10-20 seconds after starting containers.

### Step 3: Generate Prisma Client

```bash
# Generate Prisma Client (creates the database client)
docker compose exec api npx prisma generate
```

**Why?** Prisma Client needs to be generated to interact with the database. This reads your `prisma/schema.prisma` and creates the TypeScript client.

### Step 4: Run Database Migrations

```bash
# Apply all migrations (creates tables and schema)
docker compose exec api npx prisma migrate deploy
```

**Why?** Migrations create the actual database structure (tables, indexes, etc.) based on your Prisma schema.

### Step 5: Seed the Database

```bash
# Run seed scripts to populate initial data
docker compose exec api npm run seed
docker compose exec api npm run seed-provinces
docker compose exec api npm run seed-customers
docker compose exec api npm run seed-customs-rates
```

**Why?** Seeds populate your database with initial data (users, provinces, rates, etc.).

## Complete One-Liner Setup

```bash
# Start containers
docker compose up -d && \
# Wait a moment for PostgreSQL
sleep 15 && \
# Generate Prisma Client
docker compose exec api npx prisma generate && \
# Run migrations
docker compose exec api npx prisma migrate deploy && \
# Seed database
docker compose exec api npm run seed && \
docker compose exec api npm run seed-provinces && \
docker compose exec api npm run seed-customers && \
docker compose exec api npm run seed-customs-rates && \
echo "✅ Setup complete!"
```

## Quick Reference: Order Matters!

```
1. docker compose up -d              # Start containers
2. npx prisma generate               # Generate Prisma Client
3. npx prisma migrate deploy         # Create database schema
4. npm run seed                      # Populate with data
```

## What Each Step Does

### `prisma generate`

-  Reads `prisma/schema.prisma`
-  Generates TypeScript types and Prisma Client
-  Creates files in `node_modules/.prisma/`
-  **Must run before** any database operations

### `prisma migrate deploy`

-  Reads migration files from `prisma/migrations/`
-  Creates tables, indexes, relationships in PostgreSQL
-  **Must run before** seeding (database structure must exist)

### `npm run seed`

-  Runs TypeScript seed scripts
-  Inserts initial data into existing tables
-  **Must run after** migrations (tables must exist)

## Troubleshooting

### "Prisma Client not generated"

```bash
docker compose exec api npx prisma generate
```

### "Table does not exist"

```bash
# Run migrations first
docker compose exec api npx prisma migrate deploy
```

### "Cannot connect to database"

```bash
# Check if PostgreSQL is ready
docker compose logs postgres

# Check connection string
docker compose exec api env | grep DATABASE_URL
```

### Check Migration Status

```bash
# See which migrations have been applied
docker compose exec api npx prisma migrate status
```

### Reset Everything (⚠️ Deletes all data)

```bash
# Stop and remove everything
docker compose down -v

# Start fresh
docker compose up -d

# Then follow steps 2-5 above
```

## Verification

After setup, verify everything works:

```bash
# Check database connection
docker compose exec api npx prisma db pull

# Check data was seeded
docker compose exec postgres psql -U ctenvios -d ctenvios -c "SELECT COUNT(*) FROM \"Customer\";"

# Test API
curl http://localhost:3000/health
```

## Common Workflow

### First Time Setup

```bash
docker compose up -d
docker compose exec api npx prisma generate
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
docker compose exec api npm run seed-provinces
docker compose exec api npm run seed-customers
docker compose exec api npm run seed-customs-rates
```

### After Code Changes (Schema Updates)

```bash
# If you changed schema.prisma:
docker compose exec api npx prisma generate
docker compose exec api npx prisma migrate dev --name your_migration_name
```

### After Pulling New Migrations

```bash
docker compose exec api npx prisma generate
docker compose exec api npx prisma migrate deploy
```

## Notes

-  **Always generate Prisma Client** after schema changes
-  **Always run migrations** before seeding
-  **Migrations create structure**, seeds populate data
-  The order is critical: Generate → Migrate → Seed
