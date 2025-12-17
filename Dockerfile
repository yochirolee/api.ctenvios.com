# ========= STAGE 1: BUILDER =========
FROM node:22-alpine AS builder

# Prisma needs OpenSSL on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# 1) Copy dependency manifests first for better caching
COPY package.json package-lock.json* ./

# 2) Copy Prisma schema/config early (so generate can run)
COPY prisma ./prisma
COPY prisma.config.* ./

# 3) Dummy DATABASE_URL only for build-time `prisma generate`
# (Generate does NOT need a real DB connection, but Prisma config validation needs a valid URL)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"

# 4) Install ALL deps (incl devDeps) to build
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 5) Generate Prisma Client at build time
RUN npx prisma generate

# 6) Copy the rest of the source and build
COPY . .
RUN npm run build


# ========= STAGE 2: PRODUCTION =========
FROM node:22-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

# 1) Install PROD deps only
# Copy lockfiles so npm ci can reproduce exact versions
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

# 2) Copy Prisma artifacts needed at runtime
# - schema + migrations for migrate deploy
# - prisma.config.* for Prisma 7 config
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.* ./

# 3) Copy generated Prisma Client from builder
# (it lives inside node_modules; copy only what’s necessary)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 4) Copy built app output + runtime assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets

# 5) Entry point: run migrations on startup (recommended for VPS/prod)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 \
    && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

# Optional healthcheck (adjust /health path if needed)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
