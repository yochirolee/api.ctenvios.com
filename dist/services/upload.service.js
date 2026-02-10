"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cloudinary_1 = __importDefault(require("../lib/cloudinary"));
const streamifier_1 = __importDefault(require("streamifier"));
const CLOUDINARY_FOLDERS = {
    AGENCY_LOGOS: "api.ctenvios.logos",
    FORWARDER_LOGOS: "api.ctenvios.forwarders",
};
const uploadService = {
    /**
     * Upload a buffer to Cloudinary
     */
    uploadBuffer: (buffer, options) => {
        return new Promise((resolve, reject) => {
            var _a;
            const uploadStream = cloudinary_1.default.uploader.upload_stream({
                folder: options.folder,
                public_id: options.publicId,
                transformation: options.transformation,
                overwrite: (_a = options.overwrite) !== null && _a !== void 0 ? _a : true,
                resource_type: "image",
                format: options.format, // Force output format (e.g., 'png' for PDF compatibility)
            }, (error, result) => {
                if (error)
                    return reject(error);
                if (!result)
                    return reject(new Error("Upload failed - no result returned"));
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                    width: result.width,
                    height: result.height,
                });
            });
            streamifier_1.default.createReadStream(buffer).pipe(uploadStream);
        });
    },
    /**
     * Upload an agency logo
     * Images are automatically resized to max 400x400 and converted to PNG
     * PNG format is required for PDF generation (PDFKit doesn't support WEBP)
     */
    uploadAgencyLogo: (agencyId, buffer) => __awaiter(void 0, void 0, void 0, function* () {
        return uploadService.uploadBuffer(buffer, {
            folder: CLOUDINARY_FOLDERS.AGENCY_LOGOS,
            publicId: `agency-${agencyId}`,
            transformation: { width: 400, height: 400, crop: "limit" },
            overwrite: true,
            format: "png", // Force PNG for PDF compatibility
        });
    }),
    /**
     * Upload a forwarder logo
     * Images are automatically resized to max 400x400 and converted to PNG
     */
    uploadForwarderLogo: (forwarderId, buffer) => __awaiter(void 0, void 0, void 0, function* () {
        return uploadService.uploadBuffer(buffer, {
            folder: CLOUDINARY_FOLDERS.FORWARDER_LOGOS,
            publicId: `forwarder-${forwarderId}`,
            transformation: { width: 400, height: 400, crop: "limit" },
            overwrite: true,
            format: "png", // Force PNG for PDF compatibility
        });
    }),
    /**
     * Delete an image from Cloudinary by public ID
     */
    deleteImage: (publicId) => __awaiter(void 0, void 0, void 0, function* () {
        return cloudinary_1.default.uploader.destroy(publicId);
    }),
    /**
     * Get optimized URL with transformations
     */
    getOptimizedUrl: (publicId, width, height) => {
        return cloudinary_1.default.url(publicId, {
            width,
            height,
            crop: "limit",
            fetch_format: "auto",
            quality: "auto",
        });
    },
};
exports.default = uploadService;
