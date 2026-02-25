"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLogo = exports.uploadMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid file type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP, GIF`));
    }
};
/**
 * Multer middleware configured for image uploads
 * - Stores files in memory (buffer)
 * - Max file size: 5MB
 * - Allowed types: JPEG, PNG, WebP, GIF
 */
exports.uploadMiddleware = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
    },
    fileFilter,
});
/**
 * Single file upload middleware for 'logo' field
 */
exports.uploadLogo = exports.uploadMiddleware.single("logo");
