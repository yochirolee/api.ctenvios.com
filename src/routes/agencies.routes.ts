import { Router } from "express";
import controllers from "../controllers";
import { uploadLogo } from "../middlewares/upload.middleware";
import { z } from "zod";
import { validate } from "../middlewares/validate.middleware";
import { Roles } from "@prisma/client";
import { agencySchema } from "../types/types";

//Schemas
const create_agency_schema = z.object({
   agency: agencySchema.extend({
      // Derived in controller from parent agency; don't require from client on create.
      forwarder_id: z.number().min(1).optional(),
      parent_agency_id: z.number().nullable().optional().default(null),
   }),
   user: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(10),
      password: z.string().min(8),
      role: z.nativeEnum(Roles),
   }),
});

const agencyUpdateSchema = agencySchema.partial();

const agencies_routes = Router();

agencies_routes.get("/", controllers.agencies.getAll);
agencies_routes.get("/:id", controllers.agencies.getById);
agencies_routes.get("/:id/users", controllers.agencies.getUsers);
agencies_routes.post("/", validate({ body: create_agency_schema }), controllers.agencies.create);
agencies_routes.put("/:id", validate({ body: agencyUpdateSchema }), controllers.agencies.update);
agencies_routes.delete("/:id", controllers.agencies.remove);
agencies_routes.get("/:id/childrens", controllers.agencies.getChildren);
agencies_routes.get("/:id/parent", controllers.agencies.getParent);
agencies_routes.get("/:id/services-with-rates", controllers.agencies.getServicesWithRates);
agencies_routes.get("/:id/active-services-with-rates", controllers.agencies.getActiveServicesWithRates);
agencies_routes.get("/:id/parcels", controllers.agencies.getParcelsInAgency);

// Logo upload routes
agencies_routes.post("/:id/logo", uploadLogo, controllers.agencies.uploadLogo);
agencies_routes.delete("/:id/logo", controllers.agencies.deleteLogo);

export default agencies_routes;
