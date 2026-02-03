import { Response } from "express";
import { Status } from "@prisma/client";
import repository from "../repositories";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";

/**
 * Parcels controller – HTTP + thin logic only.
 * Calls repository directly (no service; per .cursorrules: skip service for simple CRUD).
 */

interface ParcelRequest {
   user?: {
      id: string;
      agency_id?: number;
   };
   query: {
      page?: string;
      limit?: string;
      status?: string;
   };
   body: { status?: Status; notes?: string };
   params: {
      id?: string;
      hbl?: string;
      orderId?: string;
   };
}

const parsePage = (q: string | undefined, fallback: number): number => {
   const n = Number(q);
   return Number.isFinite(n) && n >= 1 ? n : fallback;
};

const parseLimit = (q: string | undefined, fallback: number): number => {
   const n = Number(q);
   return Number.isFinite(n) && n >= 1 ? n : fallback;
};

export const parcels = {
   getAll: async (req: ParcelRequest, res: Response): Promise<void> => {
      const page = parsePage(req.query.page, 1);
      const limit = parseLimit(req.query.limit, 25);
      const where = req.query.status ? { status: req.query.status as Status } : {};
      const result = await repository.parcels.getAllPaginated(where, page, limit);
      res.status(200).json({ ...result, page, limit });
   },

   getByHbl: async (req: ParcelRequest, res: Response): Promise<void> => {
      const { hbl } = req.params;
      if (!hbl) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "HBL (tracking number) is required");
      }
      const parcel = await repository.parcels.getByHblWithDetails(hbl);
      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Parcel not found");
      }
      res.status(200).json(parcel);
   },

   getByOrderId: async (req: ParcelRequest, res: Response): Promise<void> => {
      const orderId = Number(req.params.orderId);
      if (!Number.isFinite(orderId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid order ID is required");
      }
      const { parcels } = await repository.parcels.getByOrderId(orderId, 1, 1000);
      res.status(200).json({ rows: parcels });
   },

   getEvents: async (req: ParcelRequest, res: Response): Promise<void> => {
      const { hbl } = req.params;
      if (!hbl) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "HBL (tracking number) is required");
      }
      const events = await repository.parcels.getEventsByHbl(hbl);
      if (events === null) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Parcel not found");
      }
      res.status(200).json(events);
   },

   getInAgency: async (req: ParcelRequest, res: Response): Promise<void> => {
      const page = parsePage(req.query.page, 1);
      const limit = parseLimit(req.query.limit, 25);
      const agencyId = req.user?.agency_id;
      if (agencyId == null) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "User must belong to an agency");
      }
      const result = await repository.parcels.getInAgency(agencyId, page, limit);
      res.status(200).json({ ...result, page, limit });
   },

   updateStatus: async (req: ParcelRequest, res: Response): Promise<void> => {
      const { hbl } = req.params;
      const { status, notes } = req.body ?? {};
      const userId = req.user?.id;

      if (!hbl) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "HBL (tracking number) is required");
      }
      if (!userId) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Authentication required");
      }
      if (!status) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "status is required");
      }

      const updated = await repository.parcels.updateStatusWithEvent(hbl, status, notes ?? null, userId);
      if (!updated) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Parcel not found");
      }
      res.status(200).json(updated);
   },

   track: async (req: ParcelRequest, res: Response): Promise<void> => {
      const { hbl } = req.params;
      if (!hbl) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "HBL (tracking number) is required");
      }
      const parcel = await repository.parcels.getTrackByHbl(hbl);
      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Parcel not found");
      }
      res.status(200).json(parcel);
   },
};

export default parcels;
