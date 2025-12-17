# ========= STAGE 1: BUILDER =========
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl
WORKDIR /app

# Cache deps
COPY package.json package-lock.json* ./

# Copy Prisma files early
COPY prisma ./prisma
COPY prisma.config.* ./

# Dummy DATABASE_URL for prisma generate at build time
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"

# Install all deps (incl devDeps)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Generate Prisma Client (build-time)
RUN npx prisma generate

# Copy source + build
COPY . .
RUN npm run build


# ========= STAGE 2: PRODUCTION =========
FROM node:22-alpine AS production

RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

# 0) Copy Prisma schema/config BEFORE npm ci (helps if any scripts ever run)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.* ./

# 1) Install PROD deps only, but SKIP scripts (avoids postinstall prisma generate)
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# 2) Copy generated Prisma Client artifacts from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 3) Copy built output + assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets

# 4) Entrypoint to apply migrations on startup (recommended)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Non-root
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 \
    && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
