import { Response } from "express";
import { Roles, Status } from "@prisma/client";
import repository from "../repositories";
import prisma from "../lib/prisma.client";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";

/**
 * Parcels controller – HTTP + thin logic only.
 * GET /parcels is the unified list: filter by status, search by hbl, filter by order_id, and optional scope (ready_for=dispatch|container).
 */

const ALLOWED_DISPATCH_STATUSES: Status[] = [
   Status.IN_AGENCY,
   Status.IN_PALLET,
   Status.IN_DISPATCH,
   Status.IN_WAREHOUSE,
];

const ALLOWED_CONTAINER_STATUSES: Status[] = [
   Status.IN_AGENCY,
   Status.IN_PALLET,
   Status.IN_DISPATCH,
   Status.RECEIVED_IN_DISPATCH,
   Status.IN_WAREHOUSE,
];

interface ParcelRequest {
   user?: {
      id: string;
      role?: Roles;
      agency_id?: number;
   };
   query: {
      page?: string;
      limit?: string;
      status?: string;
      hbl?: string;
      q?: string;
      order_id?: string;
      description?: string;
      customer?: string;
      receiver?: string;
      agency_id?: string;
      dispatch_id_null?: string;
      container_id_null?: string;
      flight_id_null?: string;
      forwarder_id?: string;
      scope?: string;
      ready_for?: string;
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

const parseBool = (s: string | undefined): boolean => s === "true" || s === "1";

export const parcels = {
   getAll: async (req: ParcelRequest, res: Response): Promise<void> => {
      const page = parsePage(req.query.page, 1);
      const limit = parseLimit(req.query.limit, 25);
      const q = req.query;

      const filters: Parameters<typeof repository.parcels.listFiltered>[0] = {};

      if (q.ready_for === "dispatch") {
         if (req.user?.role !== Roles.ROOT && req.user?.agency_id == null) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
         }
         filters.dispatch_id_null = true;
         filters.status_in = ALLOWED_DISPATCH_STATUSES;
      } else if (q.ready_for === "container") {
         if (req.user?.agency_id == null) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
         }
         const agency = await prisma.agency.findUnique({
            where: { id: req.user.agency_id },
            select: { forwarder_id: true },
         });
         if (agency?.forwarder_id == null) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "Agency must be associated with a forwarder");
         }
         filters.forwarder_id = agency.forwarder_id;
         filters.container_id_null = true;
         filters.flight_id_null = true;
         filters.service_type = "MARITIME";
         filters.status_in = ALLOWED_CONTAINER_STATUSES;
         
      } else {
         if (q.status) filters.status = q.status as Status;
         const hbl = (q.hbl ?? q.q ?? "").trim();
         if (hbl) filters.hbl = hbl;
         const orderId = q.order_id != null ? Number(q.order_id) : undefined;
         if (orderId != null && Number.isFinite(orderId)) filters.order_id = orderId;
         if (q.description?.trim()) filters.description = q.description.trim();
         if (q.customer?.trim()) filters.customer = q.customer.trim();
         if (q.receiver?.trim()) filters.receiver = q.receiver.trim();
         if (q.scope === "agency" && req.user?.agency_id != null) filters.agency_id = req.user.agency_id;
         if (q.agency_id != null) {
            const n = Number(q.agency_id);
            if (Number.isFinite(n)) filters.agency_id = n;
         }
         if (parseBool(q.dispatch_id_null)) filters.dispatch_id_null = true;
         if (parseBool(q.container_id_null)) filters.container_id_null = true;
         if (parseBool(q.flight_id_null)) filters.flight_id_null = true;
         if (q.forwarder_id != null) {
            const n = Number(q.forwarder_id);
            if (Number.isFinite(n)) filters.forwarder_id = n;
         }
      }

      // RBAC: ROOT sees all parcels; non-ROOT see only their agency + child agencies
      if (req.user?.role !== Roles.ROOT && req.user?.agency_id != null) {
         const childAgencies = await repository.agencies.getAllChildrenRecursively(req.user.agency_id);
         filters.agency_id_in = [req.user.agency_id, ...childAgencies];
      }

      const result = await repository.parcels.listFiltered(filters, page, limit);

      console.log(result);
      res.status(200).json({ rows: result.rows, total: result.total, page, limit });
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
