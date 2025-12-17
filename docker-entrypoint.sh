#!/bin/sh
set -e

# IMPORTANT: DATABASE_URL must be provided at runtime (docker-compose env)
echo "⏳ Running Prisma migrations..."
npx prisma migrate deploy

echo "🚀 Starting server..."
exec "$@"
