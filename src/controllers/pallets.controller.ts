import { Response } from "express";
import { PalletStatus } from "@prisma/client";
import palletsRepository from "../repositories/pallets.repository";
import AppError from "../utils/app.error";

/**
 * Pallets Controller
 * Following: Repository pattern, TypeScript strict typing
 */

interface PalletRequest {
   user?: {
      id: string;
      agency_id?: number;
   };
   query: {
      page?: number;
      limit?: number;
      status?: PalletStatus;
   };
   body: any;
   params: {
      id?: number;
      palletNumber?: string;
      trackingNumber?: string;
   };
}

export const pallets = {
   /**
    * Get all pallets with pagination and filters
    */
   getAll: async (req: PalletRequest, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const status = req.query.status as PalletStatus | undefined;
      const user = req.user!;

      // Filter by user's agency
      const agency_id = user.agency_id;

      const result = await palletsRepository.getAll(page, limit, agency_id, status);

      res.status(200).json({
         rows: result.pallets,
         total: result.total,
         page,
         limit,
      });
   },

   /**
    * Get pallet by ID
    */
   getById: async (req: PalletRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const pallet = await palletsRepository.getById(id!);

      if (!pallet) {
         res.status(404).json({ error: "Pallet not found" });
         return;
      }

      res.status(200).json(pallet);
   },

   /**
    * Get pallet by pallet number
    */
   getByPalletNumber: async (req: PalletRequest, res: Response): Promise<void> => {
      const { palletNumber } = req.params;
      const pallet = await palletsRepository.getByPalletNumber(palletNumber!);

      if (!pallet) {
         res.status(404).json({ error: "Pallet not found" });
         return;
      }

      res.status(200).json(pallet);
   },

   /**
    * Create a new pallet
    */
   create: async (req: PalletRequest, res: Response): Promise<void> => {
      const user = req.user!;

      if (!user.agency_id) {
         throw new AppError("User must belong to an agency", 403);
      }

      const pallet = await palletsRepository.create(user.agency_id, user.id, req.body?.notes);

      res.status(201).json(pallet);
   },

   /**
    * Update pallet
    */
   update: async (req: PalletRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const pallet = await palletsRepository.update(id!, {
         notes: req.body.notes,
      });

      res.status(200).json(pallet);
   },

   /**
    * Delete pallet
    */
   delete: async (req: PalletRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const pallet = await palletsRepository.delete(id!);
      res.status(200).json(pallet);
   },

   /**
    * Get parcels in pallet
    */
   getParcels: async (req: PalletRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await palletsRepository.getParcels(id!, page, limit);

      res.status(200).json({
         rows: result.parcels,
         total: result.total,
         page,
         limit,
      });
   },

   /**
    * Add parcel to pallet
    */
   addParcel: async (req: PalletRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { tracking_number } = req.body;
      const user = req.user;

      const parcel = await palletsRepository.addParcel(id!, tracking_number, user!.id);

      res.status(200).json(parcel);
   },

   /**
    * Add all parcels from an order to a pallet
    */
   addParcelsByOrderId: async (req: PalletRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { order_id } = req.body;
      const user = req.user;

      const result = await palletsRepository.addParcelsByOrderId(Number(id), Number(order_id), user!.id);

      res.status(200).json(result);
   },

   /**
    * Remove parcel from pallet
    */
   removeParcel: async (req: PalletRequest, res: Response): Promise<void> => {
      const { id, trackingNumber } = req.params;
      const user = req.user;

      const parcel = await palletsRepository.removeParcel(Number(id), trackingNumber!, user!.id);

      res.status(200).json(parcel);
   },

   /**
    * Seal pallet
    */
   seal: async (req: PalletRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user;

      const pallet = await palletsRepository.seal(id!, user!.id);

      res.status(200).json(pallet);
   },

   /**
    * Unseal pallet
    */
   unseal: async (req: PalletRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user;

      const pallet = await palletsRepository.unseal(id!, user!.id);

      res.status(200).json(pallet);
   },

   /**
    * Get parcels ready to be added to pallet
    */
   getReadyForPallet: async (req: PalletRequest, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      

      const result = await palletsRepository.getParcelsForPallet( page, limit);

      res.status(200).json({
         rows: result.parcels,
         total: result.total,
         page,
         limit,
      });
   },
};

export default pallets;
