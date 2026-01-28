import cloudinary from "../lib/cloudinary";
import streamifier from "streamifier";

interface UploadResult {
   url: string;
   publicId: string;
   width?: number;
   height?: number;
}

interface UploadOptions {
   folder: string;
   publicId?: string;
   transformation?: {
      width?: number;
      height?: number;
      crop?: string;
   };
   overwrite?: boolean;
   format?: string; // Force output format (png, jpg, etc.)
}

const CLOUDINARY_FOLDERS = {
   AGENCY_LOGOS: "api.ctenvios.logos",
   FORWARDER_LOGOS: "api.ctenvios.forwarders",
} as const;

const uploadService = {
   /**
    * Upload a buffer to Cloudinary
    */
   uploadBuffer: (buffer: Buffer, options: UploadOptions): Promise<UploadResult> => {
      return new Promise((resolve, reject) => {
         const uploadStream = cloudinary.uploader.upload_stream(
            {
               folder: options.folder,
               public_id: options.publicId,
               transformation: options.transformation,
               overwrite: options.overwrite ?? true,
               resource_type: "image",
               format: options.format, // Force output format (e.g., 'png' for PDF compatibility)
            },
            (error, result) => {
               if (error) return reject(error);
               if (!result) return reject(new Error("Upload failed - no result returned"));

               resolve({
                  url: result.secure_url,
                  publicId: result.public_id,
                  width: result.width,
                  height: result.height,
               });
            }
         );

         streamifier.createReadStream(buffer).pipe(uploadStream);
      });
   },

   /**
    * Upload an agency logo
    * Images are automatically resized to max 400x400 and converted to PNG
    * PNG format is required for PDF generation (PDFKit doesn't support WEBP)
    */
   uploadAgencyLogo: async (agencyId: number, buffer: Buffer): Promise<UploadResult> => {
      return uploadService.uploadBuffer(buffer, {
         folder: CLOUDINARY_FOLDERS.AGENCY_LOGOS,
         publicId: `agency-${agencyId}`,
         transformation: { width: 400, height: 400, crop: "limit" },
         overwrite: true,
         format: "png", // Force PNG for PDF compatibility
      });
   },

   /**
    * Upload a forwarder logo
    * Images are automatically resized to max 400x400 and converted to PNG
    */
   uploadForwarderLogo: async (forwarderId: number, buffer: Buffer): Promise<UploadResult> => {
      return uploadService.uploadBuffer(buffer, {
         folder: CLOUDINARY_FOLDERS.FORWARDER_LOGOS,
         publicId: `forwarder-${forwarderId}`,
         transformation: { width: 400, height: 400, crop: "limit" },
         overwrite: true,
         format: "png", // Force PNG for PDF compatibility
      });
   },

   /**
    * Delete an image from Cloudinary by public ID
    */
   deleteImage: async (publicId: string): Promise<{ result: string }> => {
      return cloudinary.uploader.destroy(publicId);
   },

   /**
    * Get optimized URL with transformations
    */
   getOptimizedUrl: (publicId: string, width?: number, height?: number): string => {
      return cloudinary.url(publicId, {
         width,
         height,
         crop: "limit",
         fetch_format: "auto",
         quality: "auto",
      });
   },
};

export default uploadService;
