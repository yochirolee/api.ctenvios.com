import prisma from "../lib/prisma.client";

/**
 * In-memory cache for configuration values
 * Refreshes every 30 seconds or when explicitly updated
 */
class ConfigService {
   private cache: Map<string, string> = new Map();
   private lastRefresh: number = 0;
   private readonly CACHE_TTL = 30000; // 30 seconds

   /**
    * Get configuration value with caching
    */
   async get(key: string): Promise<string | null> {
      // Check if cache needs refresh
      const now = Date.now();
      if (now - this.lastRefresh > this.CACHE_TTL) {
         await this.refreshCache();
      }

      return this.cache.get(key) || null;
   }

   /**
    * Get boolean configuration value
    */
   async getBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
      const value = await this.get(key);
      if (value === null) return defaultValue;
      return value.toLowerCase() === "true" || value === "1";
   }

   /**
    * Set configuration value and update cache
    */
   async set(key: string, value: string, description?: string, updatedBy?: string): Promise<void> {
      await prisma.appConfig.upsert({
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
   }

   /**
    * Refresh cache from database
    */
   async refreshCache(): Promise<void> {
      try {
         // Check if prisma client is available
         if (!prisma || !prisma.appConfig) {
            if (process.env.NODE_ENV === "development") {
               console.warn("Prisma client or AppConfig model not available");
            }
            this.lastRefresh = 0;
            return;
         }

         const configs = await prisma.appConfig.findMany({
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
      } catch (error: any) {
         // If table doesn't exist yet, that's okay - cache will be empty
         // This allows the app to start even if migrations haven't run
         if (process.env.NODE_ENV === "development") {
            console.warn("Config cache refresh failed (table may not exist):", error?.message || String(error));
         }
         // Reset lastRefresh so it will try again next time
         this.lastRefresh = 0;
      }
   }

   /**
    * Clear cache (force refresh on next get)
    */
   clearCache(): void {
      this.lastRefresh = 0;
   }

   /**
    * Get all configurations
    */
   async getAll(): Promise<
      Array<{ key: string; value: string; description: string | null; updated_at: Date; updated_by: string | null }>
   > {
      return prisma.appConfig.findMany({
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
   }
}

// Create service instance - this must always succeed
export const configService = new ConfigService();

// Initialize cache on startup (non-blocking, fails gracefully)
// This will be called on first use if it fails here
// Using process.nextTick to ensure it doesn't block module loading
if (typeof process !== "undefined" && typeof process.nextTick === "function") {
   process.nextTick(() => {
      configService.refreshCache().catch(() => {
         // Silently fail - cache will be populated on first use or when table exists
      });
   });
} else if (typeof setImmediate === "function") {
   setImmediate(() => {
      configService.refreshCache().catch(() => {
         // Silently fail
      });
   });
} else if (typeof setTimeout === "function") {
   setTimeout(() => {
      configService.refreshCache().catch(() => {
         // Silently fail
      });
   }, 0);
}
