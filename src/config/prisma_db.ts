import { PrismaClient } from "@prisma/client";

// Creating a singleton pattern to prevent multiple instances during development
// This helps avoid connection issues during hot reloading
declare global {
   // eslint-disable-next-line no-var
   var prisma: PrismaClient | undefined;
}

/**
 * Initialize Prisma client with explicit typing and transaction configuration
 *
 * If you see "Cannot find module '.prisma/client/default'" error,
 * run: npx prisma generate
 */
const prisma: PrismaClient =
   global.prisma ||
   new PrismaClient({
      datasources: {
         db: {
            url: process.env.DATABASE_URL,
         },
      },
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

export default prisma;
