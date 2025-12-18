import { Request, Response } from "express";
import { z } from "zod";
import { Roles, Prisma } from "@prisma/client";
import { AppError } from "../common/app-errors";
import repository from "../repositories";
import prisma from "../lib/prisma.client";
import { auth } from "../lib/auth";
import HttpStatusCodes from "../common/https-status-codes";
import { Permissions, canViewOwnResource, canManageOwnResource, hasPermission } from "../utils/permissions";

// Extend Express Request type for authenticated requests
interface AuthenticatedRequest extends Request {
   user: {
      id: string;
      email: string;
      role: Roles;
      agency_id?: number | null;
      carrier_id?: number | null;
   };
}

// Nota: Los permisos ahora están centralizados en src/utils/permissions.ts

// Schema para crear carrier
const createCarrierSchema = z.object({
   name: z.string().min(1, "Name is required").max(255),
   forwarder_id: z.number().int().positive("Forwarder ID must be a positive integer"),
});

// Schema para actualizar carrier
const updateCarrierSchema = z.object({
   name: z.string().min(1).max(255).optional(),
   forwarder_id: z.number().int().positive().optional(),
});

// Nota: La creación de usuarios ahora se maneja en users.controller.ts

const carriers = {
   getAll: async (req: Request, res: Response): Promise<void> => {
      const { user } = req as AuthenticatedRequest;

      // Verificar si puede ver todos los carriers
      const canViewAll = hasPermission(user.role, Permissions.CARRIER_VIEW_ALL);

      if (!canViewAll) {
         // Si es usuario de carrier, solo puede ver su propio carrier
         if (user.carrier_id) {
            const carrier = await repository.carriers.getById(user.carrier_id);
            if (!carrier) {
               throw new AppError(HttpStatusCodes.NOT_FOUND, "Carrier not found");
            }
            res.status(200).json([carrier]);
            return;
         }
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to view carriers");
      }

      const carriers = await repository.carriers.getAll();
      res.status(200).json(carriers);
   },

   getById: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { user } = req as AuthenticatedRequest;
      const carrierId = Number(id);

      if (isNaN(carrierId) || carrierId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid carrier ID");
      }

      const carrier = await repository.carriers.getById(carrierId);
      if (!carrier) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Carrier not found");
      }

      // Validar que el usuario tenga permiso para ver este carrier
      if (!canViewOwnResource(user.role, user.carrier_id, carrierId, Permissions.CARRIER_VIEW_ALL)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to view this carrier");
      }

      res.status(200).json(carrier);
   },

   getUsers: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { user } = req as AuthenticatedRequest;
      const carrierId = Number(id);

      if (isNaN(carrierId) || carrierId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid carrier ID");
      }

      // Validar que el carrier existe
      const carrier = await repository.carriers.getById(carrierId);
      if (!carrier) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Carrier not found");
      }

      // Validar permisos
      if (!canViewOwnResource(user.role, user.carrier_id, carrierId, Permissions.CARRIER_VIEW_ALL)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to view users of this carrier");
      }

      const users = await repository.carriers.getUsers(carrierId);
      res.status(200).json(users);
   },

   create: async (req: Request, res: Response): Promise<void> => {
      const { user: currentUser } = req as AuthenticatedRequest;

      // Authorization check
      if (!hasPermission(currentUser.role, Permissions.CARRIER_CREATE)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to create carriers");
      }

      // Validate request body
      const result = createCarrierSchema.safeParse(req.body);
      if (!result.success) {
         const errors = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
         throw new AppError(HttpStatusCodes.BAD_REQUEST, `Invalid carrier data: ${errors}`);
      }

      const { name, forwarder_id } = result.data;

      // Validar que el forwarder existe
      const forwarder = await prisma.forwarder.findUnique({
         where: { id: forwarder_id },
      });

      if (!forwarder) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Forwarder not found");
      }

      // Validar que no existe otro carrier con el mismo nombre
      const existingCarrier = await prisma.carrier.findUnique({
         where: { name },
      });

      if (existingCarrier) {
         throw new AppError(HttpStatusCodes.CONFLICT, "A carrier with this name already exists");
      }

      // Crear carrier
      const carrier = await repository.carriers.create({
         name,
         forwarder: {
            connect: { id: forwarder_id },
         },
      });

      res.status(201).json({
         carrier,
         message: "Carrier created successfully",
      });
   },

   update: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { user: currentUser } = req as AuthenticatedRequest;
      const carrierId = Number(id);

      if (isNaN(carrierId) || carrierId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid carrier ID");
      }

      // Validar que el carrier existe
      const existingCarrier = await repository.carriers.getById(carrierId);
      if (!existingCarrier) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Carrier not found");
      }

      // Validar permisos: solo ROOT, ADMINISTRATOR, FORWARDER_ADMIN, CARRIER_OWNER o CARRIER_ADMIN de ese carrier
      if (!canManageOwnResource(currentUser.role, currentUser.carrier_id, carrierId, Permissions.CARRIER_MANAGE)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to update this carrier");
      }

      // Validate request body
      const result = updateCarrierSchema.safeParse(req.body);
      if (!result.success) {
         const errors = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
         throw new AppError(HttpStatusCodes.BAD_REQUEST, `Invalid carrier data: ${errors}`);
      }

      const updateData = result.data;

      // Si se actualiza el nombre, validar que no existe otro carrier con ese nombre
      if (updateData.name && updateData.name !== existingCarrier.name) {
         const nameExists = await prisma.carrier.findUnique({
            where: { name: updateData.name },
         });

         if (nameExists) {
            throw new AppError(HttpStatusCodes.CONFLICT, "A carrier with this name already exists");
         }
      }

      // Preparar datos para actualización
      const prismaUpdateData: Prisma.CarrierUpdateInput = {};

      if (updateData.name) {
         prismaUpdateData.name = updateData.name;
      }

      // Si se actualiza el forwarder_id, validar que existe
      if (updateData.forwarder_id) {
         const forwarder = await prisma.forwarder.findUnique({
            where: { id: updateData.forwarder_id },
         });

         if (!forwarder) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, "Forwarder not found");
         }

         prismaUpdateData.forwarder = {
            connect: { id: updateData.forwarder_id },
         };
      }

      const updatedCarrier = await repository.carriers.update(carrierId, prismaUpdateData);
      res.status(200).json({
         carrier: updatedCarrier,
         message: "Carrier updated successfully",
      });
   },

   remove: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { user: currentUser } = req as AuthenticatedRequest;
      const carrierId = Number(id);

      if (isNaN(carrierId) || carrierId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid carrier ID");
      }

      // Validar que el carrier existe
      const carrier = await repository.carriers.getById(carrierId);
      if (!carrier) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Carrier not found");
      }

      // Solo ROOT y ADMINISTRATOR pueden eliminar carriers
      if (!hasPermission(currentUser.role, Permissions.CARRIER_DELETE)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "Only administrators can delete carriers");
      }

      // Validar que no tenga servicios asociados
      if (carrier.services && carrier.services.length > 0) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "Cannot delete carrier with associated services. Please remove services first."
         );
      }

      // Validar que no tenga usuarios asociados
      const usersCount = await prisma.user.count({
         where: { carrier_id: carrierId },
      });

      if (usersCount > 0) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "Cannot delete carrier with associated users. Please remove users first."
         );
      }

      await repository.carriers.delete(carrierId);
      res.status(200).json({
         message: "Carrier deleted successfully",
      });
   },
};

export default carriers;
