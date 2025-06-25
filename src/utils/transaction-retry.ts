import { PrismaClient } from "@prisma/client";

interface RetryOptions {
	maxRetries?: number;
	baseDelay?: number;
	maxDelay?: number;
}

/**
 * Execute a Prisma transaction with exponential backoff retry logic
 * Helps prevent P2028 transaction timeout errors
 */
export const executeTransactionWithRetry = async <T>(
	prisma: PrismaClient,
	transactionFn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>,
	options: RetryOptions = {},
): Promise<T> => {
	const { maxRetries = 3, baseDelay = 1000, maxDelay = 5000 } = options;

	let lastError: Error;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await prisma.$transaction(transactionFn, {
				maxWait: 15000, // 15 seconds to wait for transaction to start
				timeout: 45000, // 45 seconds for transaction to complete
			});
		} catch (error) {
			lastError = error as Error;

			// Check if it's a transaction timeout error (P2028)
			const isPrismaTimeoutError =
				error instanceof Error && "code" in error && error.code === "P2028";

			// If it's the last attempt or not a timeout error, throw immediately
			if (attempt === maxRetries || !isPrismaTimeoutError) {
				throw error;
			}

			// Calculate delay with exponential backoff
			const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

			console.warn(
				`Transaction attempt ${attempt + 1} failed with P2028, retrying in ${delay}ms...`,
			);

			// Wait before retrying
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError!;
};
