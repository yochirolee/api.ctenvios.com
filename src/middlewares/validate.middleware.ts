import { z, ZodSchema } from "zod";
import { Request, Response, NextFunction } from "express";

export const validate =
   (schemas: { params?: ZodSchema; query?: ZodSchema; body?: ZodSchema }) =>
   (req: Request, res: Response, next: NextFunction) => {
      try {
         // Check if body validation is required but body is undefined/empty
         if (schemas.body && (req.body === undefined || req.body === null || Object.keys(req.body).length === 0)) {
            return res.status(400).json({
               error: "Validation failed",
               source: "zod",
               errors: [
                  {
                     field: "body",
                     message:
                        "Request body is empty. Make sure you are sending JSON data with Content-Type: application/json header.",
                  },
               ],
            });
         }

         // Validate and override req.params if schema exists
         if (schemas.params) {
            req.params = schemas.params.parse(req.params);
         }
         // Validate and override req.query if schema exists
         if (schemas.query) {
            const parsed = schemas.query.parse(req.query);
            Object.assign(req.query, parsed);
         }
         // Validate and override req.body if schema exists
         if (schemas.body) {
            req.body = schemas.body.parse(req.body);
         }

         // If all validations pass, continue to next middleware/controller
         next();
      } catch (error) {
         // If validation fails, handle Zod error
         if (error instanceof z.ZodError) {
            // Extract only field and message for clean, simple errors
            const errors = error.errors.map((err) => ({
               field: err.path.length > 0 ? err.path.join(".") : "root",
               message: err.message,
            }));

            console.log(
               "❌ Validation failed:",
               JSON.stringify(
                  {
                     url: req.url,
                     method: req.method,
                     errors,
                  },
                  null,
                  2
               )
            );

            return res.status(400).json({
               error: "Validation failed",
               source: "zod",
               errors,
            });
         }
         // If it's another type of error, pass it to error middleware
         next(error);
      }
   };
