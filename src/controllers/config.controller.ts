import { Response } from "express";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";

// Import configService - if it fails, we'll handle it in each function
import { configService } from "../services/config.service";

interface ConfigRequest {
   user?: {
      id: string;
      email: string;
      role: string;
   };
   body: {
      enabled?: boolean;
      value?: string;
   };
}

/**
 * Get logging configuration status
 * GET /api/v1/config/logging
 */

const config = {
   getLoggingConfig: async (req: ConfigRequest, res: Response): Promise<void> => {
      const enabled = await configService.getBoolean("logging_enabled", true);
      res.status(200).json({
         status: enabled,
         message: enabled ? "Logging is currently enabled" : "Logging is currently disabled",
      });
   },
   updateLoggingConfig: async (req: ConfigRequest, res: Response): Promise<void> => {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "enabled must be a boolean value");
      }
      const userId = req.user?.id;
      await configService.set(
         "logging_enabled",
         enabled.toString(),
         "Controls whether application logs are saved to database",
         userId
      );
      res.status(200).json({
         status: enabled,
         message: enabled ? "Logging has been enabled" : "Logging has been disabled",
         updated_by: userId,
         updated_at: new Date().toISOString(),
      });
   },
   getAllConfig: async (req: ConfigRequest, res: Response): Promise<void> => {
      const configs = await configService.getAll();
      res.status(200).json(configs);
   },
};

export default config;
