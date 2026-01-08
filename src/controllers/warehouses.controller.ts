import { Response } from "express";
import warehousesRepository from "../repositories/warehouses.repository";
import AppError from "../utils/app.error";
import prisma from "../lib/prisma.client";

/**
 * Warehouses Controller
 * Following: Repository pattern, TypeScript strict typing
 */

interface WarehouseRequest {
   user?: {
      id: string;
      carrier_id?: number;
   };
   query: {
      page?: number;
      limit?: number;
      carrier_id?: number;
      province_id?: number;
      is_active?: string;
   };
   body: any;
   params: {
      id?: number;
      trackingNumber?: string;
   };
}

export const warehouses = {
   /**
    * Get all warehouses with pagination and filters
    */
   getAll: async (req: WarehouseRequest, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const carrier_id = req.query.carrier_id ? Number(req.query.carrier_id) : undefined;
      const province_id = req.query.province_id ? Number(req.query.province_id) : undefined;
      const is_active = req.query.is_active !== undefined ? req.query.is_active === "true" : undefined;

      const result = await warehousesRepository.getAll(page, limit, carrier_id, province_id, is_active);

      res.status(200).json({
         rows: result.warehouses,
         total: result.total,
         page,
         limit,
      });
   },

   /**
    * Get warehouse by ID
    */
   getById: async (req: WarehouseRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const warehouse = await warehousesRepository.getById(id!);

      if (!warehouse) {
         res.status(404).json({ error: "Warehouse not found" });
         return;
      }

      res.status(200).json(warehouse);
   },

   /**
    * Create a new warehouse
    */
   create: async (req: WarehouseRequest, res: Response): Promise<void> => {
      const { name, address, carrier_id, province_id, is_main, manager_id } = req.body;

      const warehouse = await warehousesRepository.create({
         name,
         address,
         carrier_id,
         province_id,
         is_main,
         manager_id,
      });

      res.status(201).json(warehouse);
   },

   /**
    * Update warehouse
    */
   update: async (req: WarehouseRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const warehouse = await warehousesRepository.update(id!, req.body);

      res.status(200).json(warehouse);
   },

   /**
    * Delete warehouse
    */
   delete: async (req: WarehouseRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const warehouse = await warehousesRepository.delete(id!);
      res.status(200).json(warehouse);
   },

   /**
    * Get parcels in warehouse
    */
   getParcels: async (req: WarehouseRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await warehousesRepository.getParcels(id!, page, limit);

      res.status(200).json({
         rows: result.parcels,
         total: result.total,
         page,
         limit,
      });
   },

   /**
    * Receive parcel in warehouse
    */
   receiveParcel: async (req: WarehouseRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { tracking_number } = req.body;
      const user = req.user;

      const parcel = await warehousesRepository.receiveParcel(id!, tracking_number, user!.id);

      res.status(200).json(parcel);
   },

   /**
    * Transfer parcel to another warehouse
    */
   transferParcel: async (req: WarehouseRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { to_warehouse_id, tracking_number } = req.body;
      const user = req.user;

      const parcel = await warehousesRepository.transferParcel(id!, to_warehouse_id, tracking_number, user!.id);

      res.status(200).json(parcel);
   },

   /**
    * Get warehouses by carrier
    */
   getByCarrier: async (req: WarehouseRequest, res: Response): Promise<void> => {
      const carrier_id = Number(req.params.id);
      const warehouses = await warehousesRepository.getByCarrier(carrier_id);
      res.status(200).json(warehouses);
   },

   /**
    * Get my carrier's warehouses (for carrier users)
    */
   getMyWarehouses: async (req: WarehouseRequest, res: Response): Promise<void> => {
      const user = req.user!;

      if (!user.carrier_id) {
         throw new AppError("User must belong to a carrier", 403);
      }

      const warehouses = await warehousesRepository.getByCarrier(user.carrier_id);
      res.status(200).json(warehouses);
   },
};

export default warehouses;
