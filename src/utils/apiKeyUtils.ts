import crypto from "crypto";

/**
 * API Key Utility Functions
 * Implements secure API key generation and validation following best practices:
 * - Cryptographically secure random generation
 * - SHA-256 hashing for storage
 * - Prefixed keys for easy identification
 * - Separate display and storage formats
 */

interface ApiKeyPair {
   displayKey: string; // Full key shown only once to user (e.g., "ct_live_abc123...")
   hashedKey: string; // Hashed version stored in database
   prefix: string; // Prefix for quick identification (e.g., "ct_live")
}

/**
 * Generates a secure API key with prefix
 * @param environment - 'live' or 'test' to indicate key environment
 * @returns ApiKeyPair with display key, hashed key, and prefix
 */
export const generateApiKey = (environment: "live" | "test" = "live"): ApiKeyPair => {
   // Generate cryptographically secure random bytes (32 bytes = 256 bits)
   const randomBytes = crypto.randomBytes(32);
   const randomString = randomBytes.toString("base64url"); // URL-safe base64

   // Create prefix for easy identification
   const prefix = `ct_${environment}`;

   // Full key that will be shown to the user (only once!)
   const displayKey = `${prefix}_${randomString}`;

   // Hash the key for storage (never store plain text)
   const hashedKey = hashApiKey(displayKey);

   return {
      displayKey,
      hashedKey,
      prefix,
   };
};

/**
 * Hashes an API key using SHA-256
 * @param apiKey - The plain text API key
 * @returns Hashed key as hex string
 */
export const hashApiKey = (apiKey: string): string => {
   return crypto.createHash("sha256").update(apiKey).digest("hex");
};

/**
 * Validates API key format
 * @param apiKey - The API key to validate
 * @returns boolean indicating if format is valid
 */
export const validateApiKeyFormat = (apiKey: string): boolean => {
   // Expected format: ct_live_... or ct_test_...
   const apiKeyRegex = /^ct_(live|test)_[A-Za-z0-9_-]{43}$/;
   return apiKeyRegex.test(apiKey);
};

/**
 * Extracts prefix from API key
 * @param apiKey - The full API key
 * @returns The prefix part (e.g., "ct_live")
 */
export const extractPrefix = (apiKey: string): string | null => {
   const match = apiKey.match(/^(ct_(live|test))_/);
   return match ? match[1] : null;
};

/**
 * Masks an API key for display purposes (shows only prefix and last 4 chars)
 * @param apiKey - The full API key
 * @returns Masked key (e.g., "ct_live_...xyz123")
 */
export const maskApiKey = (apiKey: string): string => {
   if (apiKey.length < 12) {
      return "***";
   }
   const prefix = extractPrefix(apiKey) || "ct";
   const lastFour = apiKey.slice(-4);
   return `${prefix}_...${lastFour}`;
};

/**
 * Checks if an API key is expired
 * @param expiresAt - Expiration date or null for no expiration
 * @returns boolean indicating if expired
 */
export const isApiKeyExpired = (expiresAt: Date | null): boolean => {
   if (!expiresAt) {
      return false; // No expiration
   }
   return new Date() > expiresAt;
};
