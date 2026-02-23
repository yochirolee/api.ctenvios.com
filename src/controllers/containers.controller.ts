import { Response } from "express";
import { z } from "zod";
import { AgencyType, ContainerStatus, Prisma, Status } from "@prisma/client";
import containersRepository from "../repositories/containers.repository";
import AppError from "../utils/app.error";
import prisma from "../lib/prisma.client";
import repository from "../repositories";
import {
   generateContainerManifestExcel,
   getContainerManifestData,
} from "../utils/excel/generate-container-manifest-excel";

const ALLOWED_CONTAINER_STATUSES: Status[] = [
   Status.IN_AGENCY,
   Status.IN_PALLET,
   Status.IN_DISPATCH,
   Status.RECEIVED_IN_DISPATCH,
   Status.IN_WAREHOUSE,
];

const addParcelParamsSchema = z.object({
   id: z.coerce.number().int().positive(),
});

const addParcelBodySchema = z.object({
   tracking_number: z.string().min(1),
});

interface ContainerRequest {
   user?: {
      id: string;
      forwarder_id?: number;
      agency_id?: number;
   };
   query: {
      page?: string;
      limit?: string;
      status?: string;
   };
   body: unknown;
   params: {
      id?: string;
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
      const container = await containersRepository.getById(Number(id));

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
      const body = req.body as Prisma.ContainerUncheckedCreateInput;

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
         ...body,
         forwarder_id: agency.forwarder_id,
         created_by_id: user.id,
         estimated_departure: body.estimated_departure ? new Date(body.estimated_departure as string) : undefined,
         estimated_arrival: body.estimated_arrival ? new Date(body.estimated_arrival as string) : undefined,
      });

      res.status(201).json(container);
   },

   /**
    * Update container
    */
   update: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user;
      const body = req.body as Record<string, unknown>;

      console.log("updateing container", body);

      const updateData = {
         ...body,
         estimated_departure: body.estimated_departure ? new Date(body.estimated_departure as string) : undefined,
         estimated_arrival: body.estimated_arrival ? new Date(body.estimated_arrival as string) : undefined,
         actual_departure: body.actual_departure ? new Date(body.actual_departure as string) : undefined,
         actual_arrival: body.actual_arrival ? new Date(body.actual_arrival as string) : undefined,
      };

      const container = await containersRepository.update(Number(id), updateData, user?.id);

      res.status(200).json(container);
   },

   /**
    * Delete container
    */
   delete: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const container = await containersRepository.delete(Number(id));
      res.status(200).json(container);
   },

   /**
    * Get parcels in container
    */
   getParcels: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await containersRepository.getParcels(Number(id), page, limit);

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
      const user = req.user!;
      const { id } = addParcelParamsSchema.parse(req.params);
      const { tracking_number } = addParcelBodySchema.parse(req.body);

      const parcel = await containersRepository.getParcelAttachInfo(tracking_number);

      if (!parcel) {
         throw new AppError("Parcel not found", 404);
      }

      if (parcel.deleted_at) {
         throw new AppError(`Cannot add parcel ${tracking_number} - its order has been deleted`, 400);
      }

      if (parcel.service?.service_type !== "MARITIME") {
         throw new AppError(
            `Parcel ${tracking_number} uses ${parcel.service?.service_name || "AIR"} service (${
               parcel.service?.service_type
            }). Only MARITIME parcels can be added to containers. Use flights for AIR parcels.`,
            400
         );
      }

      if (parcel.container_id) {
         throw new AppError(`Parcel ${tracking_number} is already in container ${parcel.container_id}`, 409);
      }

      if (parcel.flight_id) {
         throw new AppError(`Parcel ${tracking_number} is already in flight ${parcel.flight_id}`, 409);
      }

      if (!ALLOWED_CONTAINER_STATUSES.includes(parcel.status)) {
         throw new AppError(
            `Parcel with status ${
               parcel.status
            } cannot be added to container. Allowed statuses: ${ALLOWED_CONTAINER_STATUSES.join(", ")}`,
            400
         );
      }

      const container = await containersRepository.getContainerAttachInfo(id);

      if (!container) {
         throw new AppError(`Container with id ${id} not found`, 404);
      }

      if (container.status !== ContainerStatus.PENDING && container.status !== ContainerStatus.LOADING) {
         throw new AppError(
            `Cannot add parcels to container with status ${container.status}. Container must be PENDING or LOADING.`,
            400
         );
      }

      const updatedParcel = await containersRepository.addParcel(id, tracking_number, user.id);

      res.status(200).json({ data: updatedParcel });
   },

   /**
    * Add all parcels from an order to container
    */
   addParcelsByOrderId: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { order_id } = req.body as { order_id: number };
      const user = req.user;

      const result = await containersRepository.addParcelsByOrderId(Number(id), order_id, user!.id);

      res.status(200).json(result);
   },

   /**
    * Add all parcels from a dispatch to container
    */
   addParcelsByDispatchId: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { dispatch_id } = req.body as { dispatch_id: number };
      const user = req.user;

      const result = await containersRepository.addParcelsByDispatchId(Number(id), dispatch_id, user!.id);

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
      const { status, seal_number, booking_number, cat_number, location, description } = req.body as {
         status: ContainerStatus;
         location?: string;
         description?: string;
         seal_number?: string;
         booking_number?: string;
         cat_number?: string;
      };
      const user = req.user;

      const container = await containersRepository.updateStatus(Number(id), status, user!.id, location, description, seal_number, booking_number, cat_number);

      res.status(200).json(container);
   },

   /**
    * Get container events
    */
   getEvents: async (req: ContainerRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const events = await containersRepository.getEvents(Number(id));
      res.status(200).json(events);
   },

   /**
    * Get parcels ready to be added to container (uses unified parcels listFiltered)
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

      const allowedStatuses: Status[] = [
         Status.IN_AGENCY,
         Status.IN_PALLET,
         Status.IN_DISPATCH,
         Status.RECEIVED_IN_DISPATCH,
         Status.IN_WAREHOUSE,
      ];
      const { rows, total } = await repository.parcels.listFiltered(
         {
            forwarder_id: agency.forwarder_id,
            container_id_null: true,
            flight_id_null: true,
            service_type: "MARITIME",
            status_in: allowedStatuses,
         },
         page,
         limit,
      );

      res.status(200).json({
         rows,
         total,
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

      const datePart = new Date().toISOString().split("T")[0];
      const safeContainerName = container?.container_name?.trim().replace(/\s+/g, "_");
      const filename = container
         ? `Manifiesto_${safeContainerName || container.container_number}_${datePart}.xlsx`
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
