"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeTransactionWithRetry = void 0;
/**
 * Execute a Prisma transaction with exponential backoff retry logic
 * Helps prevent P2028 transaction timeout errors
 */
const executeTransactionWithRetry = (prisma_1, transactionFn_1, ...args_1) => __awaiter(void 0, [prisma_1, transactionFn_1, ...args_1], void 0, function* (prisma, transactionFn, options = {}) {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 5000 } = options;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return yield prisma.$transaction(transactionFn, {
                maxWait: 15000, // 15 seconds to wait for transaction to start
                timeout: 45000, // 45 seconds for transaction to complete
            });
        }
        catch (error) {
            lastError = error;
            // Check if it's a transaction timeout error (P2028)
            const isPrismaTimeoutError = error instanceof Error && "code" in error && error.code === "P2028";
            // If it's the last attempt or not a timeout error, throw immediately
            if (attempt === maxRetries || !isPrismaTimeoutError) {
                throw error;
            }
            // Calculate delay with exponential backoff
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            console.warn(`Transaction attempt ${attempt + 1} failed with P2028, retrying in ${delay}ms...`);
            // Wait before retrying
            yield new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastError;
});
exports.executeTransactionWithRetry = executeTransactionWithRetry;
