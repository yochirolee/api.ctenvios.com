# Seeding Docker Database

This guide explains how to seed your PostgreSQL database running in Docker.

## Prerequisites

-  Docker containers are running (`docker compose up -d`)
-  Database migrations have been applied
-  API container is healthy

## Quick Start

### 1. Run All Seeds (Main Seed)

```bash
docker compose exec api npm run seed
```

This runs the main seed script (`prisma/seed.ts`) which typically seeds core data.

### 2. Run Individual Seed Scripts

You have several seed scripts available:

```bash
# Seed provinces and cities
docker compose exec api npm run seed-provinces

# Seed customers
docker compose exec api npm run seed-customers

# Seed receipts
docker compose exec api npm run seed-receipts

# Seed customs rates
docker compose exec api npm run seed-customs-rates
```

## Step-by-Step Seeding Process

### Step 1: Ensure Containers Are Running

```bash
# Check container status
docker compose ps

# If not running, start them
docker compose up -d
```

### Step 2: Verify Database Connection

```bash
# Test database connection from API container
docker compose exec api npx prisma db pull
```

### Step 3: Run Migrations (if not done already)

```bash
# Generate Prisma Client (if needed)
docker compose exec api npx prisma generate

# Run migrations
docker compose exec api npx prisma migrate deploy
```

### Step 4: Run Seed Scripts

```bash
# Run main seed (usually includes basic data)
docker compose exec api npm run seed

# Run additional seeds as needed
docker compose exec api npm run seed-provinces
docker compose exec api npm run seed-customers
docker compose exec api npm run seed-customs-rates
```

## Complete Seeding Workflow

Here's a complete workflow to set up a fresh database:

```bash
# 1. Start containers
docker compose up -d

# 2. Wait for PostgreSQL to be ready (usually takes 10-20 seconds)
docker compose logs -f postgres
# Press Ctrl+C when you see "database system is ready to accept connections"

# 3. Run migrations
docker compose exec api npx prisma migrate deploy

# 4. Run all seeds
docker compose exec api npm run seed
docker compose exec api npm run seed-provinces
docker compose exec api npm run seed-customers
docker compose exec api npm run seed-customs-rates
```

## Alternative: Using tsx Directly

If you prefer to run the seed scripts directly with `tsx`:

```bash
# Main seed
docker compose exec api npx tsx prisma/seed.ts

# Individual seeds
docker compose exec api npx tsx prisma/province-cities.seed.ts
docker compose exec api npx tsx prisma/customers-seed.ts
docker compose exec api npx tsx prisma/recepit-seed.ts
docker compose exec api npx tsx prisma/customsRates.seed.ts
```

## Resetting and Re-seeding

If you need to reset the database and start fresh:

```bash
# ⚠️ WARNING: This will delete all data!
# Stop containers
docker compose down

# Remove the database volume
docker compose down -v

# Start fresh
docker compose up -d

# Wait for PostgreSQL to be ready, then:
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
docker compose exec api npm run seed-provinces
docker compose exec api npm run seed-customers
docker compose exec api npm run seed-customs-rates
```

## Troubleshooting

### Error: "Cannot connect to database"

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Verify DATABASE_URL in container
docker compose exec api env | grep DATABASE_URL
```

### Error: "Prisma Client not generated"

```bash
# Generate Prisma Client
docker compose exec api npx prisma generate
```

### Error: "Migration not applied"

```bash
# Check migration status
docker compose exec api npx prisma migrate status

# Apply pending migrations
docker compose exec api npx prisma migrate deploy
```

### Seed Script Fails

```bash
# Check seed script logs
docker compose exec api npm run seed

# Or run with more verbose output
docker compose exec api npx tsx prisma/seed.ts
```

## Verifying Seeded Data

### Check Data in Database

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U ctenvios -d ctenvios

# Inside psql, run queries:
# \dt                    # List all tables
# SELECT COUNT(*) FROM "Customer";  # Count customers
# SELECT COUNT(*) FROM "Province";  # Count provinces
# \q                     # Quit
```

### Check via API

```bash
# Test API endpoints (if you have them)
curl http://localhost:3000/api/v1/customers
curl http://localhost:3000/api/v1/provinces
```

## Quick Reference

```bash
# Most common commands:
docker compose exec api npm run seed              # Main seed
docker compose exec api npm run seed-provinces    # Provinces
docker compose exec api npm run seed-customers    # Customers
docker compose exec api npm run seed-customs-rates # Customs rates

# Database access:
docker compose exec postgres psql -U ctenvios -d ctenvios

# View logs:
docker compose logs -f api
```

## Notes

-  Seed scripts run inside the API container, which has access to the database via Docker network
-  The `DATABASE_URL` in the container points to `postgres:5432` (Docker service name)
-  Seeds are idempotent in most cases, but running them multiple times may create duplicates
-  Always run migrations before seeding
