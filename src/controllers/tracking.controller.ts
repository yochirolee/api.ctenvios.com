import { Response, Request } from "express";
import trackingRepository from "../repositories/tracking.repository";

/**
 * Tracking Controller
 * Following: Repository pattern, TypeScript strict typing
 */

interface TrackingRequest extends Request {
   user?: {
      id: string;
   };
   query: {
      page?: string;
      limit?: string;
      q?: string;
   };
   params: {
      trackingNumber?: string;
   };
}

export const tracking = {
   /**
    * Get public tracking (no auth required)
    */
   getPublicTracking: async (req: TrackingRequest, res: Response): Promise<void> => {
      const { trackingNumber } = req.params;

      const tracking = await trackingRepository.getPublicTracking(trackingNumber!);

      res.status(200).json(tracking);
   },

   /**
    * Get full internal tracking (staff only)
    */
   getInternalTracking: async (req: TrackingRequest, res: Response): Promise<void> => {
      const { trackingNumber } = req.params;

      const tracking = await trackingRepository.getInternalTracking(trackingNumber!);

      res.status(200).json(tracking);
   },

   /**
    * Search parcels by tracking number
    */
   search: async (req: TrackingRequest, res: Response): Promise<void> => {
      const query = req.query.q || "";
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await trackingRepository.searchByTrackingNumber(query, page, limit);

      res.status(200).json({
         rows: result.parcels,
         total: result.total,
         page,
         limit,
      });
   },

   /**
    * Get location history for a parcel
    */
   getLocationHistory: async (req: TrackingRequest, res: Response): Promise<void> => {
      const { trackingNumber } = req.params;

      const history = await trackingRepository.getLocationHistory(trackingNumber!);

      res.status(200).json(history);
   },

   /**
    * Get last scan info for a parcel
    */
   getLastScan: async (req: TrackingRequest, res: Response): Promise<void> => {
      const { trackingNumber } = req.params;

      const lastScan = await trackingRepository.getLastScanInfo(trackingNumber!);

      res.status(200).json(lastScan);
   },
};

export default tracking;
