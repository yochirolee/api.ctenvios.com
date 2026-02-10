"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const auth_1 = require("../lib/auth");
const permissions_1 = require("../utils/permissions");
// Schema para crear usuario (acepta agency_id o carrier_id, pero no ambos)
const createUserSchema = zod_1.z
    .object({
    email: zod_1.z.string().email("Invalid email format"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
    name: zod_1.z.string().min(1, "Name is required"),
    phone: zod_1.z.string().min(10, "Phone must be at least 10 characters").optional(),
    role: zod_1.z.nativeEnum(client_1.Roles),
    agency_id: zod_1.z.number().int().positive().optional(),
    carrier_id: zod_1.z.number().int().positive().optional(),
})
    .refine((data) => !data.agency_id || !data.carrier_id, {
    message: "Cannot specify both agency_id and carrier_id. User must belong to either an agency or a carrier.",
})
    .refine((data) => data.agency_id || data.carrier_id, {
    message: "Must specify either agency_id or carrier_id.",
});
const users = {
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { user: currentUser } = req;
        // Validate request body
        const result = createUserSchema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid user data: ${errors}`);
        }
        const { email, password, name, phone, role, agency_id, carrier_id } = result.data;
        // Validar que el email no existe
        const existingUser = yield prisma_client_1.default.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, "A user with this email already exists");
        }
        // Validar permisos según el tipo de organización
        if (agency_id) {
            // Validar que la agencia existe
            const agency = yield prisma_client_1.default.agency.findUnique({
                where: { id: agency_id },
            });
            if (!agency) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Agency not found");
            }
            // Validar permisos para crear usuario de agencia
            // Solo ROOT, ADMINISTRATOR, FORWARDER_ADMIN o AGENCY_ADMIN de esa agencia pueden crear usuarios
            const adminRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN];
            const canCreateAgencyUser = (0, permissions_1.hasPermission)(currentUser.role, adminRoles);
            const isAgencyAdmin = currentUser.agency_id === agency_id && currentUser.role === client_1.Roles.AGENCY_ADMIN;
            if (!canCreateAgencyUser && !isAgencyAdmin) {
                throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to create users for this agency");
            }
            // Validar roles permitidos para usuarios de agencia
            const agencyRoles = [client_1.Roles.AGENCY_ADMIN, client_1.Roles.AGENCY_SUPERVISOR, client_1.Roles.AGENCY_SALES, client_1.Roles.USER];
            if (!agencyRoles.includes(role)) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid role for agency user. Allowed roles: ${agencyRoles.join(", ")}`);
            }
        }
        else if (carrier_id) {
            // Validar que el carrier existe
            const carrier = yield prisma_client_1.default.carrier.findUnique({
                where: { id: carrier_id },
            });
            if (!carrier) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Carrier not found");
            }
            // Validar permisos para crear usuario de carrier
            if (!(0, permissions_1.canManageOwnResource)(currentUser.role, currentUser.carrier_id, carrier_id, permissions_1.Permissions.CARRIER_MANAGE)) {
                throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to create users for this carrier");
            }
            // Validar roles permitidos para usuarios de carrier
            const carrierRoles = [
                client_1.Roles.CARRIER_OWNER,
                client_1.Roles.CARRIER_ADMIN,
                client_1.Roles.CARRIER_ISSUES_MANAGER,
                client_1.Roles.CARRIER_WAREHOUSE_WORKER,
                client_1.Roles.MESSENGER,
            ];
            if (!carrierRoles.includes(role)) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid role for carrier user. Allowed roles: ${carrierRoles.join(", ")}`);
            }
            // Validar que solo CARRIER_OWNER puede crear otros CARRIER_OWNER
            const canCreateUser = (0, permissions_1.hasPermission)(currentUser.role, permissions_1.Permissions.CARRIER_MANAGE);
            if (role === client_1.Roles.CARRIER_OWNER && currentUser.role !== client_1.Roles.CARRIER_OWNER && !canCreateUser) {
                throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "Only CARRIER_OWNER or administrators can create CARRIER_OWNER users");
            }
        }
        // Crear usuario
        const userResponse = yield auth_1.auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
            },
        });
        if (!userResponse.token) {
            throw new app_errors_1.AppError(https_status_codes_1.default.INTERNAL_SERVER_ERROR, "Failed to register user");
        }
        // Asociar usuario con agency o carrier
        const updateData = {
            role,
            phone: phone || null,
        };
        if (agency_id) {
            updateData.agency_id = agency_id;
            updateData.carrier_id = null; // Asegurar que no tenga carrier_id
        }
        else if (carrier_id) {
            updateData.carrier_id = carrier_id;
            updateData.agency_id = null; // Asegurar que no tenga agency_id
        }
        yield prisma_client_1.default.user.update({
            where: { email },
            data: updateData,
        });
        const createdUser = yield prisma_client_1.default.user.findUnique({
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
    }),
};
exports.default = users;
