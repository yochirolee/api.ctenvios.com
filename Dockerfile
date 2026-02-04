# =========================
# STAGE 1: BUILDER
# =========================
FROM node:22-alpine AS builder

# Prisma necesita openssl
RUN apk add --no-cache openssl

WORKDIR /app

# Copiamos solo lo necesario para cachear deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.* ./

# DATABASE_URL dummy solo para prisma generate
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"

# Instala deps (incluye devDependencies)
RUN npm ci

# Genera Prisma Client
RUN npx prisma generate

# Copia el resto del código (sin node_modules gracias a .dockerignore)
COPY . .

# Compila TypeScript
RUN npm run build


# =========================
# STAGE 2: PRODUCTION
# =========================
FROM node:22-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs \
    && adduser  -S nodejs -u 1001 -G nodejs

# Copiar SOLO lo necesario, con ownership correcto
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma.config.* ./
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs
EXPOSE 3000

# Healthcheck liviano
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
