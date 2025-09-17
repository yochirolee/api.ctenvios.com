import { PrismaClient } from "@prisma/client";

// Extend Jest timeout for stress tests
jest.setTimeout(120000);

// Global test database instance
export const testPrisma = new PrismaClient({
	datasources: {
		db: {
			url: process.env.DATABASE_URL,
		},
	},
});

// Clean up after all tests
afterAll(async () => {
	await testPrisma.$disconnect();
});

// Global error handler for unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
