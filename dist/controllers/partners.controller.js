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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const app_errors_1 = require("../common/app-errors");
const repositories_1 = __importDefault(require("../repositories"));
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const services_1 = require("../services");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const partnerCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    email: zod_1.z.string().email("Valid email is required"),
    contact_name: zod_1.z.string().min(1, "Contact name is required"),
    phone: zod_1.z.string().min(10, "Valid phone number is required"),
    agency_id: zod_1.z.number().int().positive("Valid agency ID is required"),
    rate_limit: zod_1.z.number().int().positive().optional().default(1000),
    forwarder_id: zod_1.z.number().int().positive("Valid forwarder ID is required"),
});
const partnerUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    email: zod_1.z.string().email().optional(),
    contact_name: zod_1.z.string().min(1).optional(),
    phone: zod_1.z.string().min(10).optional(),
    rate_limit: zod_1.z.number().int().positive().optional(),
    forwarder_id: zod_1.z.number().int().positive().optional(),
    is_active: zod_1.z.boolean().optional(),
});
const partners = {
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        // Only ROOT, ADMINISTRATOR, and FORWARDER_ADMIN can see all partners
        const permittedRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN];
        if (!permittedRoles.includes(user.role)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to view partners");
        }
        const allPartners = yield repositories_1.default.partners.getAll();
        res.status(200).json(allPartners);
    }),
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const user = req.user;
        if (!id || isNaN(parseInt(id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid partner ID is required");
        }
        const partner = yield repositories_1.default.partners.getById(parseInt(id));
        if (!partner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Partner not found");
        }
        // Check authorization - only admins or users from the same agency can view
        const permittedRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN];
        if (!permittedRoles.includes(user.role) && user.agency_id !== partner.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to view this partner");
        }
        res.status(200).json(partner);
    }),
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        // Only specific roles can create partners
        const permittedRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR];
        if (!permittedRoles.includes(user.role)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to create partners");
        }
        // Validate request body
        const result = partnerCreateSchema.safeParse(req.body);
        if (!result.success) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid partner data");
        }
        const { name, email, contact_name, phone, agency_id, rate_limit, forwarder_id } = result.data;
        // Verify the agency exists
        const agency = yield prisma_client_1.default.agency.findUnique({
            where: { id: agency_id },
            select: { id: true },
        });
        if (!agency) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Agency not found");
        }
        /*  if (!agency.is_active) {
           throw new AppError(HttpStatusCodes.BAD_REQUEST, "Cannot create partner for inactive agency");
        } */
        // Check if user is authorized to create partner for this agency
        if (!permittedRoles.slice(0, 3).includes(user.role) && // Not ROOT, ADMIN, or FORWARDER_ADMIN
            user.agency_id !== agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You can only create partners for your own agency");
        }
        // Create the partner
        const partner = yield repositories_1.default.partners.create({
            name,
            email,
            contact_name,
            phone,
            rate_limit,
            agency: { connect: { id: agency_id } },
            forwarder: { connect: { id: forwarder_id } },
        });
        res.status(201).json({
            message: "Partner created successfully",
            partner,
        });
    }),
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const user = req.user;
        if (!id || isNaN(parseInt(id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid partner ID is required");
        }
        // Validate request body
        const result = partnerUpdateSchema.safeParse(req.body);
        if (!result.success) {
            const fieldErrors = result.error.flatten().fieldErrors;
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid partner data");
        }
        // Check if partner exists
        const existingPartner = yield repositories_1.default.partners.getById(parseInt(id));
        if (!existingPartner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Partner not found");
        }
        // Check authorization
        const permittedRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN];
        if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to update this partner");
        }
        const updatedPartner = yield repositories_1.default.partners.update(parseInt(id), result.data);
        res.status(200).json({
            message: "Partner updated successfully",
            partner: updatedPartner,
        });
    }),
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const user = req.user;
        if (!id || isNaN(parseInt(id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid partner ID is required");
        }
        // Check if partner exists
        const existingPartner = yield repositories_1.default.partners.getById(parseInt(id));
        if (!existingPartner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Partner not found");
        }
        // Only ROOT, ADMINISTRATOR, and FORWARDER_ADMIN can delete partners
        const permittedRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN];
        if (!permittedRoles.includes(user.role)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to delete partners");
        }
        yield repositories_1.default.partners.delete(parseInt(id));
        res.status(200).json({
            message: "Partner deleted successfully",
        });
    }),
    createApiKey: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const user = req.user;
        console.log(id, "id");
        console.log(user, "user");
        if (!id || isNaN(parseInt(id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid partner ID is required");
        }
        // Validate optional body parameters
        const { name, environment = "live", expires_in_days } = req.body;
        // Check if partner exists
        const existingPartner = yield repositories_1.default.partners.getById(parseInt(id));
        if (!existingPartner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Partner not found");
        }
        // Check authorization
        const permittedRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR];
        if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to create API keys for this partner");
        }
        // Calculate expiration date if provided
        let expiresAt;
        if (expires_in_days && expires_in_days > 0) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expires_in_days);
        }
        const apiKey = yield repositories_1.default.partners.createApiKey(parseInt(id), {
            name,
            environment,
            expiresAt,
        });
        res.status(201).json({
            message: "API key created successfully. Save this key securely - it will not be shown again.",
            api_key: {
                id: apiKey.id,
                key: apiKey.displayKey, // This is the only time the full key is shown!
                prefix: apiKey.prefix,
            },
            warning: "⚠️ Store this API key securely. You will not be able to see it again.",
        });
    }),
    getApiKeys: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const user = req.user;
        if (!id || isNaN(parseInt(id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid partner ID is required");
        }
        // Check if partner exists
        const existingPartner = yield repositories_1.default.partners.getById(parseInt(id));
        if (!existingPartner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Partner not found");
        }
        // Check authorization
        const permittedRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN];
        if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to view API keys for this partner");
        }
        const apiKeys = yield repositories_1.default.partners.getApiKeys(parseInt(id));
        res.status(200).json({
            api_keys: apiKeys.map((_a) => {
                var { key_plain } = _a, rest = __rest(_a, ["key_plain"]);
                return (Object.assign(Object.assign({}, rest), { key: key_plain }));
            }),
        });
    }),
    revokeApiKey: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id, keyId } = req.params;
        const user = req.user;
        if (!id || isNaN(parseInt(id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid partner ID is required");
        }
        if (!keyId) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid API key ID is required");
        }
        // Check if partner exists
        const existingPartner = yield repositories_1.default.partners.getById(parseInt(id));
        if (!existingPartner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Partner not found");
        }
        // Check authorization
        const permittedRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR];
        if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to revoke API keys for this partner");
        }
        yield repositories_1.default.partners.revokeApiKey(keyId);
        res.status(200).json({
            message: "API key revoked successfully",
        });
    }),
    deleteApiKey: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id, keyId } = req.params;
        const user = req.user;
        if (!id || isNaN(parseInt(id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid partner ID is required");
        }
        if (!keyId) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid API key ID is required");
        }
        // Check if partner exists
        const existingPartner = yield repositories_1.default.partners.getById(parseInt(id));
        if (!existingPartner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Partner not found");
        }
        // Check authorization - Only ROOT can permanently delete
        if (user.role !== client_1.Roles.ROOT) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "Only ROOT users can permanently delete API keys. Use revoke instead.");
        }
        yield repositories_1.default.partners.deleteApiKey(keyId);
        res.status(200).json({
            message: "API key permanently deleted",
        });
    }),
    getLogs: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { limit, offset } = req.query;
        const user = req.user;
        if (!id || isNaN(parseInt(id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid partner ID is required");
        }
        // Check if partner exists
        const existingPartner = yield repositories_1.default.partners.getById(parseInt(id));
        if (!existingPartner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Partner not found");
        }
        // Check authorization
        const permittedRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN];
        if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to view logs for this partner");
        }
        const logs = yield repositories_1.default.partners.getLogs(parseInt(id), limit ? parseInt(limit) : 100, offset ? parseInt(offset) : 0);
        res.status(200).json(logs);
    }),
    getStats: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const user = req.user;
        if (!id || isNaN(parseInt(id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid partner ID is required");
        }
        // Check if partner exists
        const existingPartner = yield repositories_1.default.partners.getById(parseInt(id));
        if (!existingPartner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Partner not found");
        }
        // Check authorization
        const permittedRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN];
        if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to view stats for this partner");
        }
        const stats = yield repositories_1.default.partners.getStats(parseInt(id));
        res.status(200).json(stats);
    }),
    //Order creation for partners
    createOrder: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { partner_order_id, customer_id, receiver_id, customer, receiver, service_id, order_items, total_delivery_fee_in_cents, requires_home_delivery, } = req.body;
        // Get agency user (needed for order creation)
        const agencyUser = yield prisma_client_1.default.user.findFirst({
            where: { agency_id: req.partner.agency_id },
            select: { id: true },
        });
        if (!agencyUser) {
            throw new app_errors_1.AppError(https_status_codes_1.default.INTERNAL_SERVER_ERROR, "No user found for partner's agency");
        }
        const partner = req.partner || null;
        const orderResult = yield services_1.services.orders.create({
            partner_order_id,
            customer_id,
            receiver_id,
            customer,
            receiver,
            service_id,
            order_items,
            user_id: agencyUser.id,
            agency_id: req.partner.agency_id,
            total_delivery_fee_in_cents,
            requires_home_delivery,
            partner_id: (partner === null || partner === void 0 ? void 0 : partner.id) || null,
        });
        //create pdf urls for the order
        const orderPdfUrl = `https://api.ctenvios.com/api/v1/orders/${orderResult.id}/pdf`;
        const orderLabelsPdfUrl = `https://api.ctenvios.com/api/v1/orders/${orderResult.id}/labels-pdf`;
        const orderHblPdfUrl = `https://api.ctenvios.com/api/v1/orders/${orderResult.id}/hbls-pdf`;
        orderResult.pdf_urls = {
            order: orderPdfUrl,
            labels: orderLabelsPdfUrl,
            hbls: orderHblPdfUrl,
        };
        const { parcels } = orderResult, orderResponse = __rest(orderResult, ["parcels"]);
        res.status(200).json({
            message: "Order created successfully",
            data: orderResponse,
        });
    }),
    getServices: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const agency_id = req.partner.agency_id;
        console.log(agency_id, "agency_id in partner middleware");
        if (!agency_id || isNaN(parseInt(agency_id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid agency ID is required");
        }
        const services_with_rates = yield repositories_1.default.services.getActiveServicesWithRates(agency_id);
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
    getCustomsRates: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const agency_id = req.partner.agency_id;
        if (!agency_id || isNaN(parseInt(agency_id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid agency ID is required");
        }
        const customsRates = yield repositories_1.default.customsRates.get(1, 500);
        if (!customsRates.rows) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "No customs rates found");
        }
        res.status(200).json(customsRates.rows);
    }),
};
exports.default = partners;
