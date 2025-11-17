#!/bin/bash

# CTEnvios API - Local Docker Testing Script
# This script helps you test the Docker setup locally

set -e

echo "🐳 CTEnvios API - Local Docker Testing"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "📋 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    echo "Creating .env file from template..."
    cat > .env << 'EOF'
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://ctenvios:local_test_password@postgres:5432/ctenvios?schema=public
DIRECT_URL=postgresql://ctenvios:local_test_password@postgres:5432/ctenvios?schema=public

# PostgreSQL Configuration
POSTGRES_USER=ctenvios
POSTGRES_PASSWORD=local_test_password
POSTGRES_DB=ctenvios

# Authentication
JWT_SECRET=local_test_jwt_secret_key_min_32_characters_long_for_testing_only
JWT_EXPIRES_IN=7d

# Email Service (Optional for local testing)
RESEND_API_KEY=

# SMS Service (Optional for local testing)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
EOF
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo -e "${YELLOW}⚠️  Please review and update .env file if needed${NC}"
    echo ""
else
    echo -e "${GREEN}✅ .env file exists${NC}"
    echo ""
fi

# Check if ports are available
echo "🔍 Checking if ports are available..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  Port 3000 is already in use${NC}"
    echo "   You may need to stop the service using port 3000 or change PORT in .env"
    read -p "   Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ Port 3000 is available${NC}"
fi
echo ""

# Build and start containers
echo "🏗️  Building and starting containers..."
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# Check container status
echo ""
echo "📊 Container Status:"
docker compose ps

echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
timeout=30
counter=0
while ! docker compose exec -T postgres pg_isready -U ctenvios > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}❌ PostgreSQL failed to start within ${timeout} seconds${NC}"
        echo "Check logs with: docker compose logs postgres"
        exit 1
    fi
    sleep 1
    counter=$((counter + 1))
    echo -n "."
done
echo ""
echo -e "${GREEN}✅ PostgreSQL is ready${NC}"

# Run migrations
echo ""
echo "🔄 Running database migrations..."
docker compose exec -T api npx prisma generate || true
docker compose exec -T api npx prisma migrate deploy || echo -e "${YELLOW}⚠️  Migrations may have already been applied${NC}"

# Wait for API to be ready
echo ""
echo "⏳ Waiting for API to be ready..."
timeout=30
counter=0
while ! curl -s http://localhost:3000/health > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}❌ API failed to start within ${timeout} seconds${NC}"
        echo "Check logs with: docker compose logs api"
        exit 1
    fi
    sleep 1
    counter=$((counter + 1))
    echo -n "."
done
echo ""

# Test endpoints
echo ""
echo "🧪 Testing API endpoints..."
echo ""

# Health check
if curl -s http://localhost:3000/health | grep -q "ok"; then
    echo -e "${GREEN}✅ Health endpoint: OK${NC}"
else
    echo -e "${RED}❌ Health endpoint: FAILED${NC}"
fi

# Root endpoint
if curl -s http://localhost:3000/ | grep -q "CTEnvios"; then
    echo -e "${GREEN}✅ Root endpoint: OK${NC}"
else
    echo -e "${YELLOW}⚠️  Root endpoint: Unexpected response${NC}"
fi

echo ""
echo "======================================"
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "📝 Useful commands:"
echo "   View logs:        docker compose logs -f"
echo "   Stop services:    docker compose down"
echo "   Restart API:      docker compose restart api"
echo "   Access API shell: docker compose exec api sh"
echo "   Access DB:        docker compose exec postgres psql -U ctenvios -d ctenvios"
echo ""
echo "🌐 API is available at: http://localhost:3000"
echo "   Health check:     http://localhost:3000/health"
echo ""
echo "📚 For more information, see: docs/LOCAL_DOCKER_TESTING.md"
echo ""

