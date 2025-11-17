# VPS Deployment Guide - CTEnvios API with Docker

This guide covers deploying the CTEnvios API to a VPS using Docker and Docker Compose.

## Table of Contents

-  [Prerequisites](#prerequisites)
-  [VPS Setup](#vps-setup)
-  [Project Setup](#project-setup)
-  [Environment Configuration](#environment-configuration)
-  [Database Setup](#database-setup)
-  [Running the Application](#running-the-application)
-  [Maintenance](#maintenance)
-  [Troubleshooting](#troubleshooting)
-  [Security Best Practices](#security-best-practices)

## Prerequisites

### VPS Requirements

-  **OS**: Ubuntu 20.04+ or Debian 11+ (recommended)
-  **RAM**: Minimum 2GB (4GB+ recommended)
-  **CPU**: 2+ cores recommended
-  **Storage**: 20GB+ free space
-  **Network**: Public IP address

### Software Requirements

-  Docker Engine 20.10+
-  Docker Compose 2.0+
-  Git

## VPS Setup

### 1. Initial Server Configuration

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add your user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# Verify installation
docker --version
docker compose version
```

### 2. Firewall Configuration

```bash
# Install UFW if not present
sudo apt install ufw -y

# Allow SSH (important - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow your API port (default 3000, or configure as needed)
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

**Important**: Do NOT expose PostgreSQL port (5432) externally. It's only accessible within Docker network.

## Project Setup

### 1. Clone Repository

```bash
# Navigate to your preferred directory
cd /opt  # or /home/your-user, /var/www, etc.

# Clone the repository
git clone <your-repository-url> ctenvios-api
cd ctenvios-api
```

### 2. Create Environment File

Create a `.env` file in the project root:

```bash
nano .env
```

Add the following configuration (replace placeholder values):

```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
# Use 'postgres' as hostname (Docker service name for low latency)
DATABASE_URL=postgresql://ctenvios:your_secure_password@postgres:5432/ctenvios?schema=public
DIRECT_URL=postgresql://ctenvios:your_secure_password@postgres:5432/ctenvios?schema=public

# PostgreSQL Configuration (used by docker-compose.yml)
POSTGRES_USER=ctenvios
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=ctenvios

# Authentication
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long
JWT_EXPIRES_IN=7d

# Email Service (Resend)
RESEND_API_KEY=your_resend_api_key_here

# SMS Service (Twilio) - Optional
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

**Security Note**:

-  Use strong, randomly generated passwords
-  Never commit `.env` to version control
-  Restrict file permissions: `chmod 600 .env`

### 3. Secure Environment File

```bash
# Restrict access to .env file
chmod 600 .env
```

## Database Setup

### 1. Start Services

```bash
# Build and start containers in detached mode
docker compose up -d --build

# Check container status
docker compose ps
```

### 2. Run Database Migrations

```bash
# Wait for PostgreSQL to be ready (health check should handle this)
# Then run migrations
docker compose exec api npx prisma migrate deploy

# If Prisma client needs regeneration
docker compose exec api npx prisma generate
```

### 3. Seed Database (Optional)

```bash
# Seed initial data
docker compose exec api npm run seed

# Seed specific data
docker compose exec api npm run seed-provinces
docker compose exec api npm run seed-customs-rates
```

## Running the Application

### Start Services

```bash
# Start in detached mode
docker compose up -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f api
docker compose logs -f postgres
```

### Verify Deployment

```bash
# Check if API is responding
curl http://localhost:3000/health

# Or from outside the server
curl http://your-server-ip:3000/health
```

### Common Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart services
docker compose restart

# Restart specific service
docker compose restart api

# Rebuild and restart (after code changes)
docker compose up -d --build

# View logs
docker compose logs -f api

# Access API container shell
docker compose exec api sh

# Access PostgreSQL
docker compose exec postgres psql -U ctenvios -d ctenvios
```

## Maintenance

### Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose up -d --build

# Run migrations if schema changed
docker compose exec api npx prisma migrate deploy
```

### Database Backups

```bash
# Create backup
docker compose exec postgres pg_dump -U ctenvios ctenvios > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker compose exec -T postgres psql -U ctenvios ctenvios < backup_file.sql
```

### Automated Backups (Optional)

Create a backup script:

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/opt/backups/ctenvios"
mkdir -p $BACKUP_DIR
docker compose exec -T postgres pg_dump -U ctenvios ctenvios | gzip > $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql.gz
# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * /opt/ctenvios-api/backup.sh
```

### Monitoring

```bash
# Check container resource usage
docker stats

# Check disk usage
docker system df

# View container logs
docker compose logs --tail=100 api
```

## Troubleshooting

### Container Won't Start

```bash
# Check container status
docker compose ps

# View detailed logs
docker compose logs api
docker compose logs postgres

# Check if ports are in use
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :5432
```

### Database Connection Issues

```bash
# Verify PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Test connection from API container
docker compose exec api sh
# Inside container:
# npx prisma db pull  # Test connection
```

### Application Errors

```bash
# View application logs
docker compose logs -f api

# Access container to debug
docker compose exec api sh

# Check environment variables
docker compose exec api env | grep DATABASE_URL
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process or change PORT in .env
```

### Out of Disk Space

```bash
# Clean up Docker
docker system prune -a

# Remove unused volumes (⚠️ be careful)
docker volume prune
```

## Security Best Practices

### 1. Environment Variables

-  Use strong, randomly generated passwords
-  Rotate secrets regularly
-  Never commit `.env` to version control
-  Restrict file permissions: `chmod 600 .env`

### 2. Network Security

-  Database port (5432) is NOT exposed externally
-  Only API port (3000) is accessible
-  Use firewall (UFW) to restrict access
-  Consider using a reverse proxy (nginx) with SSL

### 3. Container Security

-  Containers run as non-root user (configured in Dockerfile)
-  Use official base images
-  Keep images updated
-  Regularly update dependencies

### 4. Reverse Proxy with SSL (Recommended)

Set up nginx as reverse proxy with Let's Encrypt SSL:

```nginx
# /etc/nginx/sites-available/ctenvios
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker compose pull
docker compose up -d
```

## Performance Optimization

### Resource Limits

Add to `docker-compose.yml` if needed:

```yaml
services:
   api:
      deploy:
         resources:
            limits:
               cpus: "2"
               memory: 1G
            reservations:
               cpus: "1"
               memory: 512M
```

### Database Optimization

-  Ensure proper indexes (Prisma handles this)
-  Monitor query performance
-  Consider connection pooling (Prisma handles this)

## Low Latency Configuration

The Docker setup is optimized for low latency:

-  **Same VPS**: Both API and PostgreSQL run on the same server
-  **Docker Network**: Containers communicate via internal Docker network
-  **No External Hops**: Database connection uses service name `postgres` (internal DNS)
-  **Minimal Overhead**: Docker network adds <1ms latency

Connection string uses `postgres` as hostname (Docker service name), ensuring internal communication:

```
DATABASE_URL=postgresql://user:password@postgres:5432/dbname
```

## Next Steps

-  Set up monitoring (e.g., PM2, New Relic, DataDog)
-  Configure log aggregation
-  Set up automated backups
-  Configure reverse proxy with SSL
-  Set up CI/CD pipeline
-  Configure health checks and alerts

## Support

For issues or questions:

-  Check logs: `docker compose logs -f`
-  Review this documentation
-  Check project README.md
-  Open an issue in the repository
