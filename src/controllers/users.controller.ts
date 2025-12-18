import { Request, Response } from "express";
import { z } from "zod";
import { Roles } from "@prisma/client";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../lib/prisma.client";
import { auth } from "../lib/auth";
import { Permissions, canManageOwnResource, hasPermission } from "../utils/permissions";

interface AuthenticatedRequest extends Request {
   user: {
      id: string;
      email: string;
      role: Roles;
      agency_id?: number | null;
      carrier_id?: number | null;
   };
}

// Schema para crear usuario (acepta agency_id o carrier_id, pero no ambos)
const createUserSchema = z
   .object({
      email: z.string().email("Invalid email format"),
      password: z.string().min(8, "Password must be at least 8 characters"),
      name: z.string().min(1, "Name is required"),
      phone: z.string().min(10, "Phone must be at least 10 characters").optional(),
      role: z.nativeEnum(Roles),
      agency_id: z.number().int().positive().optional(),
      carrier_id: z.number().int().positive().optional(),
   })
   .refine((data) => !data.agency_id || !data.carrier_id, {
      message: "Cannot specify both agency_id and carrier_id. User must belong to either an agency or a carrier.",
   })
   .refine((data) => data.agency_id || data.carrier_id, {
      message: "Must specify either agency_id or carrier_id.",
   });

const users = {
   create: async (req: Request, res: Response): Promise<void> => {
      const { user: currentUser } = req as AuthenticatedRequest;

      // Validate request body
      const result = createUserSchema.safeParse(req.body);
      if (!result.success) {
         const errors = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
         throw new AppError(HttpStatusCodes.BAD_REQUEST, `Invalid user data: ${errors}`);
      }

      const { email, password, name, phone, role, agency_id, carrier_id } = result.data;

      // Validar que el email no existe
      const existingUser = await prisma.user.findUnique({
         where: { email },
      });

      if (existingUser) {
         throw new AppError(HttpStatusCodes.CONFLICT, "A user with this email already exists");
      }

      // Validar permisos según el tipo de organización
      if (agency_id) {
         // Validar que la agencia existe
         const agency = await prisma.agency.findUnique({
            where: { id: agency_id },
         });

         if (!agency) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, "Agency not found");
         }

         // Validar permisos para crear usuario de agencia
         // Solo ROOT, ADMINISTRATOR, FORWARDER_ADMIN o AGENCY_ADMIN de esa agencia pueden crear usuarios
         const adminRoles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN] as const;
         const canCreateAgencyUser = hasPermission(currentUser.role, adminRoles);
         const isAgencyAdmin = currentUser.agency_id === agency_id && currentUser.role === Roles.AGENCY_ADMIN;

         if (!canCreateAgencyUser && !isAgencyAdmin) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to create users for this agency");
         }

         // Validar roles permitidos para usuarios de agencia
         const agencyRoles = [Roles.AGENCY_ADMIN, Roles.AGENCY_SUPERVISOR, Roles.AGENCY_SALES, Roles.USER] as const;
         if (!(agencyRoles as readonly Roles[]).includes(role)) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               `Invalid role for agency user. Allowed roles: ${agencyRoles.join(", ")}`
            );
         }
      } else if (carrier_id) {
         // Validar que el carrier existe
         const carrier = await prisma.carrier.findUnique({
            where: { id: carrier_id },
         });

         if (!carrier) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, "Carrier not found");
         }

         // Validar permisos para crear usuario de carrier
         if (!canManageOwnResource(currentUser.role, currentUser.carrier_id, carrier_id, Permissions.CARRIER_MANAGE)) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to create users for this carrier");
         }

         // Validar roles permitidos para usuarios de carrier
         const carrierRoles = [
            Roles.CARRIER_OWNER,
            Roles.CARRIER_ADMIN,
            Roles.CARRIER_ISSUES_MANAGER,
            Roles.CARRIER_WAREHOUSE_WORKER,
            Roles.MESSENGER,
         ] as const;
         if (!(carrierRoles as readonly Roles[]).includes(role)) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               `Invalid role for carrier user. Allowed roles: ${carrierRoles.join(", ")}`
            );
         }

         // Validar que solo CARRIER_OWNER puede crear otros CARRIER_OWNER
         const canCreateUser = hasPermission(currentUser.role, Permissions.CARRIER_MANAGE);
         if (role === Roles.CARRIER_OWNER && currentUser.role !== Roles.CARRIER_OWNER && !canCreateUser) {
            throw new AppError(
               HttpStatusCodes.FORBIDDEN,
               "Only CARRIER_OWNER or administrators can create CARRIER_OWNER users"
            );
         }
      }

      // Crear usuario
      const userResponse = await auth.api.signUpEmail({
         body: {
            email,
            password,
            name,
         },
      });

      if (!userResponse.token) {
         throw new AppError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Failed to register user");
      }

      // Asociar usuario con agency o carrier
      const updateData: {
         agency_id?: number | null;
         carrier_id?: number | null;
         role: Roles;
         phone?: string | null;
      } = {
         role,
         phone: phone || null,
      };

      if (agency_id) {
         updateData.agency_id = agency_id;
         updateData.carrier_id = null; // Asegurar que no tenga carrier_id
      } else if (carrier_id) {
         updateData.carrier_id = carrier_id;
         updateData.agency_id = null; // Asegurar que no tenga agency_id
      }

      await prisma.user.update({
         where: { email },
         data: updateData,
      });

      const createdUser = await prisma.user.findUnique({
         where: { email },
         select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            agency_id: true,
            carrier_id: true,
            createdAt: true,
         },
      });

      res.status(201).json({
         user: createdUser,
         message: "User created successfully",
      });
   },
};

export default users;
