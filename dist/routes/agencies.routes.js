"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = __importDefault(require("../controllers"));
const upload_middleware_1 = require("../middlewares/upload.middleware");
const zod_1 = require("zod");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const client_1 = require("@prisma/client");
const types_1 = require("../types/types");
//Schemas
const create_agency_schema = zod_1.z.object({
    agency: types_1.agencySchema.extend({
        // Derived in controller from parent agency; don't require from client on create.
        forwarder_id: zod_1.z.number().min(1).optional(),
        parent_agency_id: zod_1.z.number().nullable().optional().default(null),
    }),
    user: zod_1.z.object({
        name: zod_1.z.string().min(1),
        email: zod_1.z.string().email(),
        phone: zod_1.z.string().min(10),
        password: zod_1.z.string().min(8),
        role: zod_1.z.nativeEnum(client_1.Roles),
    }),
});
const agencyUpdateSchema = types_1.agencySchema.partial();
const agencies_routes = (0, express_1.Router)();
agencies_routes.get("/", controllers_1.default.agencies.getAll);
agencies_routes.get("/:id", controllers_1.default.agencies.getById);
agencies_routes.get("/:id/users", controllers_1.default.agencies.getUsers);
agencies_routes.post("/", (0, validate_middleware_1.validate)({ body: create_agency_schema }), controllers_1.default.agencies.create);
agencies_routes.put("/:id", (0, validate_middleware_1.validate)({ body: agencyUpdateSchema }), controllers_1.default.agencies.update);
agencies_routes.delete("/:id", controllers_1.default.agencies.remove);
agencies_routes.get("/:id/childrens", controllers_1.default.agencies.getChildren);
agencies_routes.get("/:id/parent", controllers_1.default.agencies.getParent);
agencies_routes.get("/:id/services-with-rates", controllers_1.default.agencies.getServicesWithRates);
agencies_routes.get("/:id/active-services-with-rates", controllers_1.default.agencies.getActiveServicesWithRates);
agencies_routes.get("/:id/parcels", controllers_1.default.agencies.getParcelsInAgency);
// Logo upload routes
agencies_routes.post("/:id/logo", upload_middleware_1.uploadLogo, controllers_1.default.agencies.uploadLogo);
agencies_routes.delete("/:id/logo", controllers_1.default.agencies.deleteLogo);
exports.default = agencies_routes;
