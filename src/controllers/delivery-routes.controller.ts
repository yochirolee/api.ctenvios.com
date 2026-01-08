import { Response } from "express";
import { DeliveryStatus, RouteStatus } from "@prisma/client";
import deliveryRoutesRepository from "../repositories/delivery-routes.repository";
import AppError from "../utils/app.error";

/**
 * Delivery Routes Controller
 * Following: Repository pattern, TypeScript strict typing
 */

interface DeliveryRouteRequest {
   user?: {
      id: string;
      carrier_id?: number;
   };
   query: {
      page?: number;
      limit?: number;
      carrier_id?: number;
      warehouse_id?: number;
      messenger_id?: string;
      status?: RouteStatus;
      scheduled_date?: string;
   };
   body: any;
   params: {
      id?: number;
      parcelId?: number;
      assignmentId?: number;
   };
}

export const deliveryRoutes = {
   /**
    * Get all routes with pagination and filters
    */
   getAll: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const carrier_id = req.query.carrier_id ? Number(req.query.carrier_id) : undefined;
      const warehouse_id = req.query.warehouse_id ? Number(req.query.warehouse_id) : undefined;
      const messenger_id = req.query.messenger_id;
      const status = req.query.status as RouteStatus | undefined;
      const scheduled_date = req.query.scheduled_date ? new Date(req.query.scheduled_date) : undefined;

      const result = await deliveryRoutesRepository.getAll(
         page,
         limit,
         carrier_id,
         warehouse_id,
         messenger_id,
         status,
         scheduled_date
      );

      res.status(200).json({
         rows: result.routes,
         total: result.total,
         page,
         limit,
      });
   },

   /**
    * Get route by ID
    */
   getById: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const route = await deliveryRoutesRepository.getById(id!);

      if (!route) {
         res.status(404).json({ error: "Route not found" });
         return;
      }

      res.status(200).json(route);
   },

   /**
    * Create a new route
    */
   create: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const user = req.user!;
      const { carrier_id, warehouse_id, messenger_id, province_id, scheduled_date, notes } = req.body;

      const route = await deliveryRoutesRepository.create({
         carrier_id,
         warehouse_id,
         messenger_id,
         province_id,
         scheduled_date: new Date(scheduled_date),
         notes,
         created_by_id: user.id,
      });

      res.status(201).json(route);
   },

   /**
    * Update route
    */
   update: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const updateData = {
         ...req.body,
         scheduled_date: req.body.scheduled_date ? new Date(req.body.scheduled_date) : undefined,
      };

      const route = await deliveryRoutesRepository.update(id!, updateData);

      res.status(200).json(route);
   },

   /**
    * Delete route
    */
   delete: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const route = await deliveryRoutesRepository.delete(id!);
      res.status(200).json(route);
   },

   /**
    * Add parcel to route
    */
   addParcel: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { parcel_id } = req.body;
      const user = req.user!;

      const assignment = await deliveryRoutesRepository.addParcelToRoute(id!, parcel_id, user.id);

      res.status(201).json(assignment);
   },

   /**
    * Remove parcel from route
    */
   removeParcel: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const { id, parcelId } = req.params;
      const user = req.user!;

      await deliveryRoutesRepository.removeParcelFromRoute(id!, parcelId!, user.id);

      res.status(200).json({ message: "Parcel removed from route" });
   },

   /**
    * Assign parcel directly to messenger
    */
   assignToMessenger: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const { parcel_id, messenger_id } = req.body;
      const user = req.user!;

      const assignment = await deliveryRoutesRepository.assignToMessenger(parcel_id, messenger_id, user.id);

      res.status(201).json(assignment);
   },

   /**
    * Mark route as ready
    */
   markAsReady: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const route = await deliveryRoutesRepository.markAsReady(id!);

      res.status(200).json(route);
   },

   /**
    * Start route
    */
   startRoute: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user!;

      const route = await deliveryRoutesRepository.startRoute(id!, user.id);

      res.status(200).json(route);
   },

   /**
    * Record delivery attempt
    */
   recordDeliveryAttempt: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const { assignmentId } = req.params;
      const user = req.user!;
      const { success, recipient_name, recipient_ci, signature, photo_proof, notes } = req.body;

      const assignment = await deliveryRoutesRepository.recordDeliveryAttempt(assignmentId!, user.id, success, {
         recipient_name,
         recipient_ci,
         signature,
         photo_proof,
         notes,
      });

      res.status(200).json(assignment);
   },

   /**
    * Reschedule failed delivery
    */
   rescheduleDelivery: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const { assignmentId } = req.params;
      const { notes } = req.body;
      const user = req.user!;

      const assignment = await deliveryRoutesRepository.rescheduleDelivery(assignmentId!, user.id, notes);

      res.status(200).json(assignment);
   },

   /**
    * Get my assignments (for messenger)
    */
   getMyAssignments: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const user = req.user!;
      const status = req.query.status as unknown as DeliveryStatus | undefined;

      const assignments = await deliveryRoutesRepository.getMessengerAssignments(user.id, status);

      res.status(200).json(assignments);
   },

   /**
    * Get parcels ready for delivery
    */
   getParcelsReadyForDelivery: async (req: DeliveryRouteRequest, res: Response): Promise<void> => {
      const { warehouse_id } = req.query;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      if (!warehouse_id) {
         throw new AppError("Warehouse ID is required", 400);
      }

      const result = await deliveryRoutesRepository.getParcelsReadyForDelivery(Number(warehouse_id), page, limit);

      res.status(200).json({
         rows: result.parcels,
         total: result.total,
         page,
         limit,
      });
   },
};

export default deliveryRoutes;
