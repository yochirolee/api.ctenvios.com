"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
/**
 * Initialize Prisma client with explicit typing and transaction configuration
 *
 * Prisma 7 requires either an adapter or accelerateUrl for the "client" engine type.
 * We use PrismaPg adapter for direct PostgreSQL connections.
 *
 * If you see "Cannot find module '.prisma/client/default'" error,
 * run: npx prisma generate
 */
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
}
// Validate and parse DATABASE_URL format
let pool;
try {
    const url = new URL(process.env.DATABASE_URL);
    if (!url.protocol.startsWith("postgres")) {
        throw new Error(`Invalid DATABASE_URL protocol: ${url.protocol}. Expected postgresql:// or postgres://`);
    }
    // Parse connection string and use explicit parameters for better reliability
    // This ensures password is properly handled even with special characters
    pool = new pg_1.Pool({
        host: url.hostname,
        port: parseInt(url.port || "5432", 10),
        database: url.pathname.slice(1), // Remove leading slash
        user: url.username || undefined,
        password: url.password || undefined,
        // Additional pool configuration for better connection handling
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
    });
}
catch (error) {
    // Fallback to connectionString if URL parsing fails
    pool = new pg_1.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });
}
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = global.prisma ||
    new client_1.PrismaClient({
        adapter,
        transactionOptions: {
            maxWait: 10000, // 10 seconds to wait for transaction to start (increased for stress tests)
            timeout: 20000, // 20 seconds for transaction to complete
            isolationLevel: "ReadCommitted", // Better performance for reads
        },
        errorFormat: "pretty",
    });
// Save reference to global in development
if (process.env.NODE_ENV !== "production") {
    global.prisma = prisma;
}
exports.default = prisma;
