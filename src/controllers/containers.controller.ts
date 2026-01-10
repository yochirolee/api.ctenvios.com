import { Response } from "express";
import { AgencyType, ContainerStatus } from "@prisma/client";
import containersRepository from "../repositories/containers.repository";
import AppError from "../utils/app.error";
import prisma from "../lib/prisma.client";
import repository from "../repositories";
import { generateContainerManifestExcel, getContainerManifestData } from "../utils/generate-container-manifest-excel";

interface ContainerRequest {
   user?: {
      id: string;
      forwarder_id?: number;
      agency_id?: number;
   };
   query: {
      page?: number;
      limit?: number;
      status?: ContainerStatus;
   };
   body: any;
   params: {
      id?: number;
      containerNumber?: string;
      trackingNumber?: string;
   };
}

export const containers = {
   /**
    * Get all containers with pagination and filters
    */
   getAll: async (req: ContainerRequest, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const status = req.query.status as ContainerStatus | undefined;
      const user = req.user!;

      // Get forwarder_id from user's agency
      let forwarder_id: number | undefined;
      if (user.agency_id) {
         const agency = await prisma.agency.findUnique({
            where: { id: user.agency_id },
            select: { forwarder_id: true },
         });
         forwarder_id = agency?.forwarder_id ?? undefined;
      }

      const result = await containersRepository.getAll(page, limit, forwarder_id, status);

      res.status(200).json({
         rows: result.containers,
         total: result.total,
         page,
         limit,
      });
   },

   /**
    * Get container by ID
    */
   getById: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const container = await containersRepository.getById(id!);

      if (!container) {
         res.status(404).json({ error: "Container not found" });
         return;
      }

      res.status(200).json(container);
   },

   /**
    * Get container by container number
    */
   getByContainerNumber: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { containerNumber } = req.params;
      const container = await containersRepository.getByContainerNumber(containerNumber!);

      if (!container) {
         res.status(404).json({ error: "Container not found" });
         return;
      }

      res.status(200).json(container);
   },

   /**
    * Create a new container
    */
   create: async (req: ContainerRequest, res: Response): Promise<void> => {
      const user = req.user!;

      if (!user.agency_id) {
         throw new AppError("User must belong to an agency", 403);
      }

      const agency = await repository.agencies.getById(user.agency_id);

      if (!agency) {
         throw new AppError("Agency not found", 404);
      }

      if (agency.agency_type !== AgencyType.FORWARDER) {
         throw new AppError("Only reseller agencies can create containers", 403);
      }

      const container = await containersRepository.create({
         ...req.body,
         forwarder_id: agency.forwarder_id,
         created_by_id: user.id,
         estimated_departure: req.body.estimated_departure ? new Date(req.body.estimated_departure) : undefined,
         estimated_arrival: req.body.estimated_arrival ? new Date(req.body.estimated_arrival) : undefined,
      });

      res.status(201).json(container);
   },

   /**
    * Update container
    */
   update: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user;

      const updateData = {
         ...req.body,
         estimated_departure: req.body.estimated_departure ? new Date(req.body.estimated_departure) : undefined,
         estimated_arrival: req.body.estimated_arrival ? new Date(req.body.estimated_arrival) : undefined,
         actual_departure: req.body.actual_departure ? new Date(req.body.actual_departure) : undefined,
         actual_arrival: req.body.actual_arrival ? new Date(req.body.actual_arrival) : undefined,
      };

      const container = await containersRepository.update(id!, updateData, user?.id);

      res.status(200).json(container);
   },

   /**
    * Delete container
    */
   delete: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const container = await containersRepository.delete(id!);
      res.status(200).json(container);
   },

   /**
    * Get parcels in container
    */
   getParcels: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await containersRepository.getParcels(id!, page, limit);

      res.status(200).json({
         rows: result.parcels,
         total: result.total,
         page,
         limit,
      });
   },

   /**
    * Add parcel to container
    */
   addParcel: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { tracking_number } = req.body;
      const user = req.user;

      const parcel = await containersRepository.addParcel(id!, tracking_number, user!.id);

      res.status(200).json(parcel);
   },

   /**
    * Add all parcels from an order to container
    */
   addParcelsByOrderId: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { order_id } = req.body;
      const user = req.user;

      const result = await containersRepository.addParcelsByOrderId(Number(id), order_id, user!.id);

      res.status(200).json(result);
   },

   /**
    * Remove parcel from container
    */
   removeParcel: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id, trackingNumber } = req.params;
      const user = req.user;

      const parcel = await containersRepository.removeParcel(Number(id), trackingNumber!, user!.id);

      res.status(200).json(parcel);
   },

   /**
    * Update container status
    */
   updateStatus: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { status, location, description } = req.body;
      const user = req.user;

      const container = await containersRepository.updateStatus(id!, status, user!.id, location, description);

      res.status(200).json(container);
   },

   /**
    * Get container events
    */
   getEvents: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const events = await containersRepository.getEvents(id!);
      res.status(200).json(events);
   },

   /**
    * Get parcels ready to be added to container
    */
   getReadyForContainer: async (req: ContainerRequest, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const user = req.user!;

      if (!user.agency_id) {
         throw new AppError("User must belong to an agency", 403);
      }

      const agency = await prisma.agency.findUnique({
         where: { id: user.agency_id },
         select: { forwarder_id: true },
      });

      if (!agency?.forwarder_id) {
         throw new AppError("Agency must be associated with a forwarder", 403);
      }

      const result = await containersRepository.getReadyParcels(agency.forwarder_id, page, limit);

      res.status(200).json({
         rows: result.parcels,
         total: result.total,
         page,
         limit,
      });
   },

   /**
    * Export container manifest as Excel file
    */
   exportManifestExcel: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const containerId = Number(id);

      const buffer = await generateContainerManifestExcel(containerId);

      // Get container info for filename
      const container = await prisma.container.findUnique({
         where: { id: containerId },
         select: { container_number: true, container_name: true },
      });

      const filename = container
         ? `Manifiesto_${container.container_number}_${new Date().toISOString().split("T")[0]}.xlsx`
         : `Manifiesto_${containerId}.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
   },

   /**
    * Get container manifest data (JSON) for frontend rendering
    */
   getManifestData: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const containerId = Number(id);

      const data = await getContainerManifestData(containerId);

      res.status(200).json(data);
   },
};

export default containers;
