import multer from "multer";
import { Request } from "express";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileFilter = (
   req: Request,
   file: Express.Multer.File,
   cb: multer.FileFilterCallback
): void => {
   if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
   } else {
      cb(
         new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Invalid file type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP, GIF`
         )
      );
   }
};

/**
 * Multer middleware configured for image uploads
 * - Stores files in memory (buffer)
 * - Max file size: 5MB
 * - Allowed types: JPEG, PNG, WebP, GIF
 */
export const uploadMiddleware = multer({
   storage: multer.memoryStorage(),
   limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1,
   },
   fileFilter,
});

/**
 * Single file upload middleware for 'logo' field
 */
export const uploadLogo = uploadMiddleware.single("logo");
