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
		transactionOptions: {
			maxWait: 10000, // 10 seconds to wait for transaction to start
			timeout: 30000, // 30 seconds for transaction to complete
		},
	});

// Save reference to global in development
if (process.env.NODE_ENV !== "production") {
	global.prisma = prisma;
}

export default prisma;
