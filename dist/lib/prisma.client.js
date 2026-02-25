"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
}
function makePool() {
    // Si puedes, usa connectionString directo (menos errores con password encoding)
    return new pg_1.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 30, // 👈 30-40 local, 20-30 prod pequeño
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000, // 👈 baja a 2s
    });
}
// ✅ Pool singleton
const pool = (_a = global.pgPool) !== null && _a !== void 0 ? _a : makePool();
if (process.env.NODE_ENV !== "production")
    global.pgPool = pool;
const adapter = new adapter_pg_1.PrismaPg(pool);
// ✅ Prisma singleton (ya lo tenías)
const prisma = (_b = global.prisma) !== null && _b !== void 0 ? _b : new client_1.PrismaClient({
    adapter,
    transactionOptions: {
        maxWait: 5000, // 👈 baja a 5s para no acumular cola
        timeout: 20000,
        isolationLevel: "ReadCommitted",
    },
    errorFormat: "pretty",
});
if (process.env.NODE_ENV !== "production")
    global.prisma = prisma;
exports.default = prisma;
