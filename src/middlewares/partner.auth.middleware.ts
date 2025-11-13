import { NextFunction, Request, Response } from "express";
import repository from "../repositories";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";

interface AuthenticatedPartner {
   id: number;
   name: string;
   email: string;
   contact_name: string;
   phone: string;
   is_active: boolean;
   rate_limit: number | null;
   agency_id: number;
   forwarder_id: number;
   api_key_id: string;
   agency: {
      id: number;
      name: string;
      forwarder_id: number;
   };
   forwarder: {
      id: number;
      name: string;
   };
}

interface PartnerRequest extends Request {
   partner?: AuthenticatedPartner;
}

/**
 * Middleware to authenticate partners using API Key
 * Validates API key from Authorization header (Bearer token)
 * Checks if partner is active and within rate limits
 */
export const partnerAuthMiddleware = async (req: PartnerRequest, res: Response, next: NextFunction): Promise<void> => {
   try {
      // Extract API key from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "API key is required. Please provide an API key in the Authorization header.");
      }

      // Support both "Bearer TOKEN" and direct token formats
      const apiKey = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

      if (!apiKey || apiKey.trim() === "") {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Invalid API key format");
      }

      // Validate API key and get partner
      const partner = await repository.partners.getByApiKey(apiKey.trim());

      if (!partner) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Invalid API key or partner not found");
      }

      if (!partner.is_active) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "Partner account is inactive. Please contact support.");
      }

      // Check rate limiting (requests per hour)
      if (partner.rate_limit && partner.rate_limit > 0) {
         const stats = await repository.partners.getStats(partner.id);

         if (stats.requests_last_hour >= partner.rate_limit) {
            throw new AppError(HttpStatusCodes.TOO_MANY_REQUESTS, `Rate limit exceeded. You are limited to ${partner.rate_limit} requests per hour.`);
         }
      }

      // Attach partner to request object
      req.partner = partner;

      next();
   } catch (error) {
      console.error("Partner authentication error:", error);

      if (error instanceof AppError) {
         res.status(error.status).json({
            status: "error",
            message: error.message,
         });
      } else {
         res.status(401).json({
            status: "error",
            message: "Authentication failed",
         });
      }
   }
};

/**
 * Middleware to log partner API requests
 * Should be used after partnerAuthMiddleware
 */
export const partnerLogMiddleware = (req: PartnerRequest, res: Response, next: NextFunction): void => {
   if (!req.partner) {
      return next();
   }

   // Store original end function
   const originalEnd = res.end;
   const originalJson = res.json;

   let responseBody: any = null;

   // Override json method to capture response
   res.json = function (body: any): Response {
      responseBody = body;
      return originalJson.call(this, body);
   };

   // Override end to log after response is sent
   res.end = function (chunk?: any, encoding?: any, callback?: any): Response {
      // Restore original function
      res.end = originalEnd;

      // Log the request asynchronously (don't block response)
      setImmediate(() => {
         const partner = req.partner;
         if (partner && partner.api_key_id) {
            repository.partners
               .logRequest({
                  partner_id: partner.id,
                  api_key_id: partner.api_key_id,
                  endpoint: req.path,
                  method: req.method,
                  status_code: res.statusCode,
                  request_body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
                  response_body: responseBody,
                  ip_address: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || undefined,
                  user_agent: req.headers["user-agent"],
               })
               .catch((err) => console.error("Failed to log partner request:", err));
         }
      });

      // Call original end
      return originalEnd.call(this, chunk, encoding, callback);
   };

   next();
};

export default partnerAuthMiddleware;
