# Local Docker Testing Guide

This guide helps you test the Docker setup on your local computer before deploying to VPS.

## Prerequisites

-  Docker Desktop installed and running (or Docker Engine + Docker Compose)
-  Git (to clone the repository if needed)

## Quick Start

### 1. Verify Docker Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker compose version

# Verify Docker is running
docker ps
```

### 2. Create Environment File

Create a `.env` file in the project root:

```bash
# Copy and edit the example below
nano .env
```

**Local Testing `.env` file:**

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
# Use 'postgres' as hostname (Docker service name)
DATABASE_URL=postgresql://ctenvios:local_test_password@postgres:5432/ctenvios?schema=public
DIRECT_URL=postgresql://ctenvios:local_test_password@postgres:5432/ctenvios?schema=public

# PostgreSQL Configuration (used by docker-compose.yml)
POSTGRES_USER=ctenvios
POSTGRES_PASSWORD=local_test_password
POSTGRES_DB=ctenvios

# Authentication
JWT_SECRET=local_test_jwt_secret_key_min_32_characters_long_for_testing
JWT_EXPIRES_IN=7d

# Email Service (Resend) - Optional for local testing
RESEND_API_KEY=

# SMS Service (Twilio) - Optional for local testing
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

**Note**: For local testing, you can use simple passwords. For production, use strong passwords.

### 3. Build and Start Containers

```bash
# Build images and start containers
docker compose up -d --build

# Watch the logs to see if everything starts correctly
docker compose logs -f
```

### 4. Wait for Services to Start

Wait about 30-60 seconds for:

-  PostgreSQL to initialize
-  API container to build and start

Check status:

```bash
# Check container status
docker compose ps

# Should show both containers as "Up" and "healthy"
```

### 5. Run Database Migrations

```bash
# Generate Prisma Client (if needed)
docker compose exec api npx prisma generate

# Run migrations
docker compose exec api npx prisma migrate deploy
```

### 6. Test the API

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test root endpoint
curl http://localhost:3000/

# Expected response: {"status":"ok","timestamp":"..."}
```

### 7. Seed Database (Optional)

```bash
# Seed initial data
docker compose exec api npm run seed
```

## Common Commands for Local Testing

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f api
docker compose logs -f postgres

# View all logs
docker compose logs -f

# Restart a service
docker compose restart api

# Rebuild after code changes
docker compose up -d --build

# Access API container shell
docker compose exec api sh

# Access PostgreSQL
docker compose exec postgres psql -U ctenvios -d ctenvios

# Check container resource usage
docker stats

# Remove everything (including volumes - ⚠️ deletes database)
docker compose down -v
```

## Testing Workflow

### 1. Make Code Changes

After making code changes:

```bash
# Rebuild and restart
docker compose up -d --build

# Or just restart if no dependencies changed
docker compose restart api
```

### 2. Test API Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Test with authentication (if you have a test user)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/invoices
```

### 3. View Logs

```bash
# Follow API logs
docker compose logs -f api

# Follow database logs
docker compose logs -f postgres
```

## Troubleshooting

### Containers Won't Start

```bash
# Check what's wrong
docker compose ps
docker compose logs

# Check if ports are in use
# On Mac/Linux:
lsof -i :3000
lsof -i :5432

# On Windows:
netstat -ano | findstr :3000
```

**Solution**: Stop any local services using these ports, or change the PORT in `.env`

### Database Connection Errors

```bash
# Check if PostgreSQL is ready
docker compose exec postgres pg_isready -U ctenvios

# Check PostgreSQL logs
docker compose logs postgres

# Test connection from API container
docker compose exec api sh
# Inside container:
# npx prisma db pull
```

### Build Errors

```bash
# Clean build (removes cache)
docker compose build --no-cache

# Remove old images
docker system prune -a
```

### Port Already in Use

If port 3000 is already in use:

1. Change PORT in `.env`:

   ```env
   PORT=3001
   ```

2. Update docker-compose.yml port mapping:

   ```yaml
   ports:
      - "${PORT:-3001}:3000"
   ```

3. Restart:
   ```bash
   docker compose up -d
   ```

### Permission Errors (Linux)

If you get permission errors:

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or:
newgrp docker
```

## Database Management

### View Database

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U ctenvios -d ctenvios

# Inside psql:
# \dt          # List tables
# \d table_name # Describe table
# SELECT * FROM "User" LIMIT 10;
# \q            # Quit
```

### Backup Database

```bash
# Create backup
docker compose exec postgres pg_dump -U ctenvios ctenvios > backup.sql

# Restore from backup
docker compose exec -T postgres psql -U ctenvios ctenvios < backup.sql
```

### Reset Database

```bash
# Stop containers
docker compose down

# Remove volume (⚠️ deletes all data)
docker compose down -v

# Start fresh
docker compose up -d
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
```

## Development Tips

### Hot Reload (Not Available in Docker)

For development with hot reload, you have two options:

1. **Run locally without Docker** (use local PostgreSQL or Docker only for DB):

   ```bash
   # Start only PostgreSQL
   docker compose up -d postgres

   # Run API locally
   npm install
   npm run dev
   ```

2. **Use volume mounts for code** (advanced):
   Modify `docker-compose.yml` to mount source code (not recommended for production)

### Accessing Logs

```bash
# Real-time logs
docker compose logs -f api

# Last 100 lines
docker compose logs --tail=100 api

# Logs with timestamps
docker compose logs -f -t api
```

## Next Steps

Once local testing is successful:

1. ✅ Verify all endpoints work
2. ✅ Test database operations
3. ✅ Check logs for errors
4. ✅ Verify health checks
5. 📦 Ready for VPS deployment!

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for VPS deployment instructions.

## Quick Reference

```bash
# Start everything
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f

# Stop everything
docker compose down

# Clean start (removes volumes)
docker compose down -v && docker compose up -d --build
```
