"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isApiKeyExpired = exports.maskApiKey = exports.extractPrefix = exports.validateApiKeyFormat = exports.hashApiKey = exports.generateApiKey = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generates a secure API key with prefix
 * @param environment - 'live' or 'test' to indicate key environment
 * @returns ApiKeyPair with display key, hashed key, and prefix
 */
const generateApiKey = (environment = "live") => {
    // Generate cryptographically secure random bytes (32 bytes = 256 bits)
    const randomBytes = crypto_1.default.randomBytes(32);
    const randomString = randomBytes.toString("base64url"); // URL-safe base64
    // Create prefix for easy identification
    const prefix = `ct_${environment}`;
    // Full key that will be shown to the user (only once!)
    const displayKey = `${prefix}_${randomString}`;
    // Hash the key for storage (never store plain text)
    const hashedKey = (0, exports.hashApiKey)(displayKey);
    return {
        displayKey,
        hashedKey,
        prefix,
    };
};
exports.generateApiKey = generateApiKey;
/**
 * Hashes an API key using SHA-256
 * @param apiKey - The plain text API key
 * @returns Hashed key as hex string
 */
const hashApiKey = (apiKey) => {
    return crypto_1.default.createHash("sha256").update(apiKey).digest("hex");
};
exports.hashApiKey = hashApiKey;
/**
 * Validates API key format
 * @param apiKey - The API key to validate
 * @returns boolean indicating if format is valid
 */
const validateApiKeyFormat = (apiKey) => {
    // Expected format: ct_live_... or ct_test_...
    const apiKeyRegex = /^ct_(live|test)_[A-Za-z0-9_-]{43}$/;
    return apiKeyRegex.test(apiKey);
};
exports.validateApiKeyFormat = validateApiKeyFormat;
/**
 * Extracts prefix from API key
 * @param apiKey - The full API key
 * @returns The prefix part (e.g., "ct_live")
 */
const extractPrefix = (apiKey) => {
    const match = apiKey.match(/^(ct_(live|test))_/);
    return match ? match[1] : null;
};
exports.extractPrefix = extractPrefix;
/**
 * Masks an API key for display purposes (shows only prefix and last 4 chars)
 * @param apiKey - The full API key
 * @returns Masked key (e.g., "ct_live_...xyz123")
 */
const maskApiKey = (apiKey) => {
    if (apiKey.length < 12) {
        return "***";
    }
    const prefix = (0, exports.extractPrefix)(apiKey) || "ct";
    const lastFour = apiKey.slice(-4);
    return `${prefix}_...${lastFour}`;
};
exports.maskApiKey = maskApiKey;
/**
 * Checks if an API key is expired
 * @param expiresAt - Expiration date or null for no expiration
 * @returns boolean indicating if expired
 */
const isApiKeyExpired = (expiresAt) => {
    if (!expiresAt) {
        return false; // No expiration
    }
    return new Date() > expiresAt;
};
exports.isApiKeyExpired = isApiKeyExpired;
