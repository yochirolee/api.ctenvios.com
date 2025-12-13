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
const types_1 = require("../types/types");
const repositories_1 = __importDefault(require("../repositories"));
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const auth_1 = require("../lib/auth");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
// Create update schema by making all fields optional
const agencyUpdateSchema = types_1.agencySchema.partial();
// Roles allowed to create agencies
const AGENCY_CREATION_ROLES = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.AGENCY_ADMIN];
// Roles allowed to view all agencies
const AGENCY_VIEW_ALL_ROLES = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN];
const create_agency_schema = zod_1.z.object({
    agency: zod_1.z.object({
        name: zod_1.z.string().min(1),
        address: zod_1.z.string().min(1),
        contact: zod_1.z.string().min(1),
        phone: zod_1.z.string().min(10),
        email: zod_1.z.string().email(),
        website: zod_1.z.string().url().optional(),
        agency_type: zod_1.z.enum(["AGENCY", "RESELLER", "FORWARDER"]),
        parent_agency_id: zod_1.z.number().int().positive().optional(),
    }),
    user: zod_1.z.object({
        name: zod_1.z.string().min(1),
        email: zod_1.z.string().email(),
        phone: zod_1.z.string().min(10),
        password: zod_1.z.string().min(8),
        role: zod_1.z.literal("AGENCY_ADMIN"),
    }),
});
const agencies = {
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { user } = req;
        if (!user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
        }
        const user_agency = yield repositories_1.default.agencies.getById(user.agency_id);
        if (!user_agency) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Agency not found");
        }
        const canViewAll = user_agency.agency_type === client_1.AgencyType.FORWARDER &&
            AGENCY_VIEW_ALL_ROLES.includes(user.role);
        const agencies = canViewAll
            ? yield repositories_1.default.agencies.getAll()
            : [user_agency, ...(yield repositories_1.default.agencies.getChildren(user_agency.id))];
        res.status(200).json(agencies);
    }),
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const agencyId = Number(id);
        if (isNaN(agencyId) || agencyId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency ID");
        }
        const agency = yield repositories_1.default.agencies.getById(agencyId);
        if (!agency) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Agency not found");
        }
        res.status(200).json(agency);
    }),
    getUsers: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const agencyId = Number(id);
        if (isNaN(agencyId) || agencyId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency ID");
        }
        const users = yield repositories_1.default.agencies.getUsers(agencyId);
        res.status(200).json(users);
    }),
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { user: current_user } = req;
        // Authorization check
        if (!AGENCY_CREATION_ROLES.includes(current_user.role)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to create agencies");
        }
        if (!current_user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
        }
        // Validate parent agency
        const parent_agency = yield prisma_client_1.default.agency.findUnique({
            where: { id: current_user.agency_id },
        });
        if (!parent_agency) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Parent agency not found");
        }
        const canCreateChild = parent_agency.agency_type === client_1.AgencyType.FORWARDER || parent_agency.agency_type === client_1.AgencyType.RESELLER;
        if (!canCreateChild) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "Only FORWARDER and RESELLER agencies can create child agencies");
        }
        // Validate request body
        const result = create_agency_schema.safeParse(req.body);
        if (!result.success) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency data");
        }
        const { agency: child_agency, user } = result.data;
        if (child_agency.agency_type === client_1.AgencyType.FORWARDER) {
            child_agency.parent_agency_id = undefined;
        }
        // Find all services from parent agency with shipping_rates and pricing_agreements
        const parent_services = yield repositories_1.default.services.getByAgencyId(parent_agency.id);
        const uniqueParentsServicesId = parent_services
            .map((service) => service.id)
            .filter((id) => id !== null);
        // Create agency and connect services
        const created_agency = yield prisma_client_1.default.agency.create({
            data: Object.assign(Object.assign({}, child_agency), { parent_agency_id: parent_agency.id, forwarder_id: parent_agency.forwarder_id, services: {
                    connect: uniqueParentsServicesId.map((service_id) => ({ id: service_id })),
                } }),
        });
        // Create agency admin user
        const user_response = yield auth_1.auth.api.signUpEmail({
            body: {
                email: user.email,
                password: user.password,
                name: user.name,
            },
        });
        if (!user_response.token) {
            throw new app_errors_1.AppError(https_status_codes_1.default.INTERNAL_SERVER_ERROR, "Failed to register agency admin user");
        }
        // Associate user with agency
        yield prisma_client_1.default.user.update({
            where: { email: user.email },
            data: {
                agency_id: created_agency.id,
                role: user.role,
            },
        });
        // Create pricing agreements and rates for child agency
        /*  const rateCreationPromises = parent_services.flatMap((service) =>
           service.shipping_rates.map((shipping_rate) =>
              pricingService.createPricingWithRate({
                 product_id: shipping_rate.pricing_agreement.product.id,
                 service_id: service.id,
                 seller_agency_id: parent_agency.id,
                 buyer_agency_id: created_agency.id,
                 cost_in_cents: shipping_rate.pricing_agreement.price_in_cents,
                 price_in_cents: shipping_rate.price_in_cents,
                 name: shipping_rate.pricing_agreement.product.name,
                 is_active: shipping_rate.is_active,
              })
           )
        ); */
        // const rates_created = await Promise.all(rateCreationPromises);
        res.status(201).json({
            agency: created_agency,
            // rates_created_count: rates_created.length,
            message: "Agency and pricing agreements created successfully",
        });
    }),
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const agencyId = Number(id);
        if (isNaN(agencyId) || agencyId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency ID");
        }
        const result = agencyUpdateSchema.safeParse(req.body);
        if (!result.success) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency data");
        }
        const agency = yield repositories_1.default.agencies.update(agencyId, result.data);
        res.status(200).json({ agency });
    }),
    remove: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const agencyId = Number(id);
        if (isNaN(agencyId) || agencyId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency ID");
        }
        const agency = yield repositories_1.default.agencies.delete(agencyId);
        res.status(200).json({ agency });
    }),
    getChildren: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const agencyId = Number(id);
        if (isNaN(agencyId) || agencyId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency ID");
        }
        const children = yield repositories_1.default.agencies.getChildren(agencyId);
        res.status(200).json(children);
    }),
    getParent: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const agencyId = Number(id);
        if (isNaN(agencyId) || agencyId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency ID");
        }
        const parent = yield repositories_1.default.agencies.getParent(agencyId);
        res.status(200).json(parent);
    }),
    getServicesWithRates: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const agencyId = Number(id);
        if (isNaN(agencyId) || agencyId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency ID");
        }
        const services_with_rates = yield repositories_1.default.services.getServicesWithRates(agencyId);
        if (!services_with_rates) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "No services found");
        }
        const formatted_services_with_rates = services_with_rates.map((service) => {
            return Object.assign(Object.assign({}, service), { shipping_rates: service.shipping_rates.map((rate) => {
                    return {
                        id: rate.id,
                        name: rate.product.name,
                        description: rate.product.description,
                        unit: rate.product.unit,
                        price_in_cents: rate.price_in_cents,
                        cost_in_cents: rate.pricing_agreement.price_in_cents,
                        is_active: rate.is_active,
                    };
                }) || [] });
        });
        res.status(200).json(formatted_services_with_rates);
    }),
    getActiveServicesWithRates: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const agencyId = Number(id);
        if (isNaN(agencyId) || agencyId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency ID");
        }
        const services_with_rates = yield repositories_1.default.services.getActiveServicesWithRates(agencyId);
        if (!services_with_rates) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "No services found");
        }
        const formatted_services_with_rates = services_with_rates.map((service) => {
            return Object.assign(Object.assign({}, service), { shipping_rates: service.shipping_rates.map((rate) => {
                    return {
                        id: rate.id,
                        name: rate.product.name,
                        description: rate.product.description,
                        unit: rate.product.unit,
                        price_in_cents: rate.price_in_cents,
                        cost_in_cents: rate.pricing_agreement.price_in_cents,
                        is_active: rate.is_active,
                    };
                }) || [] });
        });
        res.status(200).json(formatted_services_with_rates);
    }),
    getParcelsInAgency: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { page, limit } = req.query;
        const agencyId = Number(id);
        const pageNumber = Number(page) || 1;
        const limitNumber = Number(limit) || 10;
        if (isNaN(agencyId) || agencyId <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency ID");
        }
        const { parcels: parcels_data, total } = yield repositories_1.default.parcels.getInAgency(agencyId, pageNumber, limitNumber);
        res.status(200).json({ rows: parcels_data, total: total });
    }),
};
exports.default = agencies;
