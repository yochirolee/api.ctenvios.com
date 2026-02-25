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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configService = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
/**
 * In-memory cache for configuration values
 * Refreshes every 30 seconds or when explicitly updated
 */
class ConfigService {
    constructor() {
        this.cache = new Map();
        this.lastRefresh = 0;
        this.CACHE_TTL = 30000; // 30 seconds
    }
    /**
     * Get configuration value with caching
     */
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if cache needs refresh
            const now = Date.now();
            if (now - this.lastRefresh > this.CACHE_TTL) {
                yield this.refreshCache();
            }
            return this.cache.get(key) || null;
        });
    }
    /**
     * Get boolean configuration value
     */
    getBoolean(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, defaultValue = false) {
            const value = yield this.get(key);
            if (value === null)
                return defaultValue;
            return value.toLowerCase() === "true" || value === "1";
        });
    }
    /**
     * Set configuration value and update cache
     */
    set(key, value, description, updatedBy) {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_client_1.default.appConfig.upsert({
                where: { key },
                update: {
                    value,
                    description,
                    updated_by: updatedBy,
                    updated_at: new Date(),
                },
                create: {
                    key,
                    value,
                    description,
                    updated_by: updatedBy,
                },
            });
            // Update cache immediately
            this.cache.set(key, value);
            this.lastRefresh = Date.now();
        });
    }
    /**
     * Refresh cache from database
     */
    refreshCache() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if prisma client is available
                if (!prisma_client_1.default || !prisma_client_1.default.appConfig) {
                    if (process.env.NODE_ENV === "development") {
                        console.warn("Prisma client or AppConfig model not available");
                    }
                    this.lastRefresh = 0;
                    return;
                }
                const configs = yield prisma_client_1.default.appConfig.findMany({
                    select: {
                        key: true,
                        value: true,
                    },
                });
                this.cache.clear();
                configs.forEach((config) => {
                    this.cache.set(config.key, config.value);
                });
                this.lastRefresh = Date.now();
            }
            catch (error) {
                // If table doesn't exist yet, that's okay - cache will be empty
                // This allows the app to start even if migrations haven't run
                if (process.env.NODE_ENV === "development") {
                    console.warn("Config cache refresh failed (table may not exist):", (error === null || error === void 0 ? void 0 : error.message) || String(error));
                }
                // Reset lastRefresh so it will try again next time
                this.lastRefresh = 0;
            }
        });
    }
    /**
     * Clear cache (force refresh on next get)
     */
    clearCache() {
        this.lastRefresh = 0;
    }
    /**
     * Get all configurations
     */
    getAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_client_1.default.appConfig.findMany({
                select: {
                    key: true,
                    value: true,
                    description: true,
                    updated_at: true,
                    updated_by: true,
                },
                orderBy: {
                    key: "asc",
                },
            });
        });
    }
}
// Create service instance - this must always succeed
exports.configService = new ConfigService();
// Initialize cache on startup (non-blocking, fails gracefully)
// This will be called on first use if it fails here
// Using process.nextTick to ensure it doesn't block module loading
if (typeof process !== "undefined" && typeof process.nextTick === "function") {
    process.nextTick(() => {
        exports.configService.refreshCache().catch(() => {
            // Silently fail - cache will be populated on first use or when table exists
        });
    });
}
else if (typeof setImmediate === "function") {
    setImmediate(() => {
        exports.configService.refreshCache().catch(() => {
            // Silently fail
        });
    });
}
else if (typeof setTimeout === "function") {
    setTimeout(() => {
        exports.configService.refreshCache().catch(() => {
            // Silently fail
        });
    }, 0);
}
