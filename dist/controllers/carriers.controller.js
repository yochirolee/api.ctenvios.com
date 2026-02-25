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
const app_errors_1 = require("../common/app-errors");
const repositories_1 = __importDefault(require("../repositories"));
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const permissions_1 = require("../utils/permissions");
// Nota: Los permisos ahora están centralizados en src/utils/permissions.ts
// Schema para crear carrier
const createCarrierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required").max(255),
    forwarder_id: zod_1.z.number().int().positive("Forwarder ID must be a positive integer"),
});
// Schema para actualizar carrier
const updateCarrierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    forwarder_id: zod_1.z.number().int().positive().optional(),
});
// Nota: La creación de usuarios ahora se maneja en users.controller.ts
const carriers = {
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { user } = req;
        // Verificar si puede ver todos los carriers
        const canViewAll = (0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.CARRIER_VIEW_ALL);
        if (!canViewAll) {
            // Si es usuario de carrier, solo puede ver su propio carrier
            if (user.carrier_id) {
                const carrier = yield repositories_1.default.carriers.getById(user.carrier_id);
                if (!carrier) {
                    throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Carrier not found");
                }
                res.status(200).json([carrier]);
                return;
            }
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to view carriers");
        }
        const carriers = yield repositories_1.default.carriers.getAll();
        res.status(200).json(carriers);
    }),
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { user } = req;
        const carrierId = Number(id);
        if (isNaN(carrierId) || carrierId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid carrier ID");
        }
        const carrier = yield repositories_1.default.carriers.getById(carrierId);
        if (!carrier) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Carrier not found");
        }
        // Validar que el usuario tenga permiso para ver este carrier
        if (!(0, permissions_1.canViewOwnResource)(user.role, user.carrier_id, carrierId, permissions_1.Permissions.CARRIER_VIEW_ALL)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to view this carrier");
        }
        res.status(200).json(carrier);
    }),
    getUsers: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { user } = req;
        const carrierId = Number(id);
        if (isNaN(carrierId) || carrierId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid carrier ID");
        }
        // Validar que el carrier existe
        const carrier = yield repositories_1.default.carriers.getById(carrierId);
        if (!carrier) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Carrier not found");
        }
        // Validar permisos
        if (!(0, permissions_1.canViewOwnResource)(user.role, user.carrier_id, carrierId, permissions_1.Permissions.CARRIER_VIEW_ALL)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to view users of this carrier");
        }
        const users = yield repositories_1.default.carriers.getUsers(carrierId);
        res.status(200).json(users);
    }),
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { user: currentUser } = req;
        // Authorization check
        if (!(0, permissions_1.hasPermission)(currentUser.role, permissions_1.Permissions.CARRIER_CREATE)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to create carriers");
        }
        // Validate request body
        const result = createCarrierSchema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid carrier data: ${errors}`);
        }
        const { name, forwarder_id } = result.data;
        // Validar que el forwarder existe
        const forwarder = yield prisma_client_1.default.forwarder.findUnique({
            where: { id: forwarder_id },
        });
        if (!forwarder) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Forwarder not found");
        }
        // Validar que no existe otro carrier con el mismo nombre
        const existingCarrier = yield prisma_client_1.default.carrier.findUnique({
            where: { name },
        });
        if (existingCarrier) {
            throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, "A carrier with this name already exists");
        }
        // Crear carrier
        const carrier = yield repositories_1.default.carriers.create({
            name,
            forwarder: {
                connect: { id: forwarder_id },
            },
        });
        res.status(201).json({
            carrier,
            message: "Carrier created successfully",
        });
    }),
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { user: currentUser } = req;
        const carrierId = Number(id);
        if (isNaN(carrierId) || carrierId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid carrier ID");
        }
        // Validar que el carrier existe
        const existingCarrier = yield repositories_1.default.carriers.getById(carrierId);
        if (!existingCarrier) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Carrier not found");
        }
        // Validar permisos: solo ROOT, ADMINISTRATOR, FORWARDER_ADMIN, CARRIER_OWNER o CARRIER_ADMIN de ese carrier
        if (!(0, permissions_1.canManageOwnResource)(currentUser.role, currentUser.carrier_id, carrierId, permissions_1.Permissions.CARRIER_MANAGE)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to update this carrier");
        }
        // Validate request body
        const result = updateCarrierSchema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid carrier data: ${errors}`);
        }
        const updateData = result.data;
        // Si se actualiza el nombre, validar que no existe otro carrier con ese nombre
        if (updateData.name && updateData.name !== existingCarrier.name) {
            const nameExists = yield prisma_client_1.default.carrier.findUnique({
                where: { name: updateData.name },
            });
            if (nameExists) {
                throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, "A carrier with this name already exists");
            }
        }
        // Preparar datos para actualización
        const prismaUpdateData = {};
        if (updateData.name) {
            prismaUpdateData.name = updateData.name;
        }
        // Si se actualiza el forwarder_id, validar que existe
        if (updateData.forwarder_id) {
            const forwarder = yield prisma_client_1.default.forwarder.findUnique({
                where: { id: updateData.forwarder_id },
            });
            if (!forwarder) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Forwarder not found");
            }
            prismaUpdateData.forwarder = {
                connect: { id: updateData.forwarder_id },
            };
        }
        const updatedCarrier = yield repositories_1.default.carriers.update(carrierId, prismaUpdateData);
        res.status(200).json({
            carrier: updatedCarrier,
            message: "Carrier updated successfully",
        });
    }),
    remove: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { user: currentUser } = req;
        const carrierId = Number(id);
        if (isNaN(carrierId) || carrierId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid carrier ID");
        }
        // Validar que el carrier existe
        const carrier = yield repositories_1.default.carriers.getById(carrierId);
        if (!carrier) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Carrier not found");
        }
        // Solo ROOT y ADMINISTRATOR pueden eliminar carriers
        if (!(0, permissions_1.hasPermission)(currentUser.role, permissions_1.Permissions.CARRIER_DELETE)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "Only administrators can delete carriers");
        }
        // Validar que no tenga servicios asociados
        if (carrier.services && carrier.services.length > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot delete carrier with associated services. Please remove services first.");
        }
        // Validar que no tenga usuarios asociados
        const usersCount = yield prisma_client_1.default.user.count({
            where: { carrier_id: carrierId },
        });
        if (usersCount > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot delete carrier with associated users. Please remove users first.");
        }
        yield repositories_1.default.carriers.delete(carrierId);
        res.status(200).json({
            message: "Carrier deleted successfully",
        });
    }),
};
exports.default = carriers;
