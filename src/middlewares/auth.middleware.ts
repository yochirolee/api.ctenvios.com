import { fromNodeHeaders } from "better-auth/node";
import { NextFunction, Response } from "express";
import { Roles } from "@prisma/client";
import { auth } from "../lib/auth.lib";

export const authMiddleware = async (req: any, res: Response, next: NextFunction): Promise<void> => {
   try {
      const session = await auth.api.getSession({
         headers: fromNodeHeaders(req.headers),
      });
      if (session) {
         req.user = session.user;
         next();
      } else {
         res.status(401).json({ message: "Unauthorized" });
      }
   } catch (error) {
      console.error("Auth middleware error:", error);
      res.status(401).json({ message: "Unauthorized" });
   }
};

/**
 * Role-based authorization middleware factory
 * @param allowedRoles - Array of roles that are permitted to access the route
 * @returns Express middleware function
 */
export const requireRoles = (allowedRoles: Roles[]) => {
   return (req: any, res: Response, next: NextFunction): void => {
      const user = req?.user;

      if (!user) {
         res.status(401).json({ message: "Unauthorized" });
         return;
      }

      if (!allowedRoles.includes(user.role)) {
         res.status(403).json({
            message: `Access denied. You are not authorized to access this resource, if you think this is an error, please contact support.`,
         });
         return;
      }

      next();
   };
};
