import { Request, Response, NextFunction } from "express";

/**
 * Middleware to track API endpoint performance
 * Logs slow requests (>1000ms) for monitoring
 */
export const performanceMonitor = (req: Request, res: Response, next: NextFunction): void => {
   const startTime = Date.now();
   const { method, path, query, params } = req;

   // Override res.json to capture when response is sent
   const originalJson = res.json.bind(res);
   res.json = function (body: any) {
      const duration = Date.now() - startTime;

      // Log slow requests
      if (duration > 1000) {
         console.warn(`🐌 SLOW REQUEST: ${method} ${path}`, {
            duration: `${duration}ms`,
            query,
            params,
            statusCode: res.statusCode,
         });
      } else if (duration > 500) {
         console.log(`⚠️  MODERATE REQUEST: ${method} ${path}`, {
            duration: `${duration}ms`,
         });
      }

      // For development, log all requests
      if (process.env.NODE_ENV === "development") {
         console.log(`✅ ${method} ${path} - ${duration}ms - ${res.statusCode}`);
      }

      return originalJson(body);
   };

   next();
};

/**
 * Middleware to add database query logging
 * Use this to identify N+1 queries and slow database operations
 */
export const queryLogger = (req: Request, res: Response, next: NextFunction): void => {
   const startTime = Date.now();

   res.on("finish", () => {
      const duration = Date.now() - startTime;
      if (duration > 2000) {
         console.error(`🔴 VERY SLOW QUERY: ${req.method} ${req.path} - ${duration}ms`);
      }
   });

   next();
};

export default { performanceMonitor, queryLogger };
