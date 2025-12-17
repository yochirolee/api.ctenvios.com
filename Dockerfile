# ========= STAGE 1: BUILDER =========
FROM node:22-alpine AS builder

# Para Prisma (openssl)
RUN apk add --no-cache openssl

WORKDIR /app

# 1) Copiar solo lo necesario para instalar deps y cachear bien
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.* ./  

# 2) Definir un DATABASE_URL DUMMY solo para el build (para prisma generate)
# No necesita apuntar a una base real, solo ser una URL válida.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"

# 3) Instalar TODAS las dependencias (incluyendo devDependencies)
# Asegúrate de que en package.json ya NO tienes "postinstall": "prisma generate"
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 4) Generar Prisma Client (usa schema + prisma.config.ts)
RUN npx prisma generate

# 5) Copiar el resto del código
COPY . .

# 6) Build de TypeScript (asumo que genera dist/server.js)
RUN npm run build

# ========= STAGE 2: PRODUCTION =========
FROM node:22-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

# 1) Copiar node_modules desde el builder (incluye @prisma/client generado)
COPY --from=builder /app/node_modules ./node_modules

# 2) Copiar package.json
COPY --from=builder /app/package.json ./package.json

# 3) Copiar prisma (schema + migrations)
COPY --from=builder /app/prisma ./prisma

# 3.1) Copiar prisma.config (ts/js) para Prisma 7 (migrate deploy, studio, etc.)
COPY --from=builder /app/prisma.config.* ./

# 4) Copiar el build compilado
COPY --from=builder /app/dist ./dist

# 5) Copiar assets si los usas en runtime
COPY --from=builder /app/assets ./assets

# (Opcional) Seeds TS u otros scripts que usen el código fuente
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Usuario no root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

# Healthcheck opcional
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/server.js"]
