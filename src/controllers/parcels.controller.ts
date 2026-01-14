import { Response } from "express";
import { Status } from "@prisma/client";
import prisma from "../lib/prisma.client";
import AppError from "../utils/app.error";

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
   body: any;
   params: {
      id?: string;
      hbl?: string;
      orderId?: string;
   };
}

export const parcels = {
   /**
    * Get all parcels with pagination
    */
   getAll: async (req: ParcelRequest, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 25;
      const status = req.query.status as Status | undefined;

      const where = status ? { status } : {};

      const [rows, total] = await Promise.all([
         prisma.parcel.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { created_at: "desc" },

            include: {
               agency: { select: { id: true, name: true } },
               service: { select: { id: true, name: true } },
               order_items: true,
               order: {
                  select: {
                     id: true,
                     receiver: { select: { id: true, first_name: true, last_name: true, second_last_name: true } },
                  },
               },
            },
         }),
         prisma.parcel.count({ where }),
      ]);

      res.status(200).json({ rows, total, page, limit });
   },

   /**
    * Get parcel by HBL (tracking number)
    */
   getByHbl: async (req: ParcelRequest, res: Response): Promise<void> => {
      const { hbl } = req.params;

      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number: hbl },
         include: {
            agency: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
            order: {
               select: {
                  id: true,
                  receiver: {
                     select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        second_last_name: true,
                        phone: true,
                        address: true,
                     },
                  },
               },
            },
            order_items: true,
            container: { select: { id: true, container_name: true, container_number: true, status: true } },
            flight: { select: { id: true, awb_number: true, flight_number: true, status: true } },
            dispatch: { select: { id: true, status: true } },
         },
      });

      if (!parcel) {
         throw new AppError("Parcel not found", 404);
      }

      res.status(200).json(parcel);
   },

   /**
    * Get parcels by order ID
    */
   getByOrderId: async (req: ParcelRequest, res: Response): Promise<void> => {
      const { orderId } = req.params;

      const rows = await prisma.parcel.findMany({
         where: { order_id: Number(orderId) },
         include: {
            service: { select: { id: true, name: true } },
         },
      });

      res.status(200).json({ rows });
   },

   /**
    * Get parcel events/history
    */
   getEvents: async (req: ParcelRequest, res: Response): Promise<void> => {
      const { hbl } = req.params;

      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number: hbl },
         select: { id: true },
      });

      if (!parcel) {
         throw new AppError("Parcel not found", 404);
      }

      const events = await prisma.parcelEvent.findMany({
         where: { parcel_id: parcel.id },
         orderBy: { created_at: "desc" },
         include: {
            user: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
            dispatch: { select: { id: true } },
            container: { select: { id: true, container_name: true, container_number: true } },
            flight: { select: { id: true, awb_number: true, flight_number: true } },
         },
      });

      res.status(200).json(events);
   },

   /**
    * Get parcels in agency (not dispatched)
    */
   getInAgency: async (req: ParcelRequest, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 25;
      const user = req.user!;

      if (!user.agency_id) {
         throw new AppError("User must belong to an agency", 403);
      }

      const where = { agency_id: user.agency_id, dispatch_id: null };

      const [rows, total] = await Promise.all([
         prisma.parcel.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { tracking_number: "asc" },
            select: {
               id: true,
               tracking_number: true,
               description: true,
               weight: true,
               agency_id: true,
               service_id: true,
               status: true,
               order_id: true,
               dispatch_id: true,
            },
         }),
         prisma.parcel.count({ where }),
      ]);

      res.status(200).json({ rows, total, page, limit });
   },

   /**
    * Update parcel status
    */
   updateStatus: async (req: ParcelRequest, res: Response): Promise<void> => {
      const { hbl } = req.params;
      const { status, notes } = req.body;
      const user = req.user!;

      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number: hbl },
      });

      if (!parcel) {
         throw new AppError("Parcel not found", 404);
      }

      const updated = await prisma.$transaction(async (tx) => {
         const updatedParcel = await tx.parcel.update({
            where: { tracking_number: hbl },
            data: { status },
         });

         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: "STATUS_CORRECTED",
               user_id: user.id,
               status,
               notes,
            },
         });

         return updatedParcel;
      });

      res.status(200).json(updated);
   },

   /**
    * Public tracking - Get parcel status by HBL (no auth required)
    */
   track: async (req: ParcelRequest, res: Response): Promise<void> => {
      const { hbl } = req.params;

      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number: hbl },
         select: {
            tracking_number: true,
            status: true,
            description: true,
            weight: true,
            created_at: true,
            order: {
               select: {
                  id: true,
                  receiver: {
                     select: {
                        first_name: true,
                        last_name: true,
                        province: { select: { name: true } },
                        city: { select: { name: true } },
                     },
                  },
               },
            },
            container: {
               select: {
                  container_name: true,
                  status: true,
                  estimated_arrival: true,
               },
            },
            flight: {
               select: {
                  flight_number: true,
                  status: true,
                  estimated_arrival: true,
               },
            },
            events: {
               orderBy: { created_at: "desc" },
               select: {
                  status: true,
                  notes: true,
                  created_at: true,
                  location: { select: { name: true } },
               },
            },
         },
      });

      if (!parcel) {
         throw new AppError("Parcel not found", 404);
      }

      res.status(200).json(parcel);
   },
};

export default parcels;
