import { Router } from "express";
import controllers from "../controllers";

const services_routes = Router();

services_routes.post("/", controllers.services.create);
services_routes.get("/", controllers.services.getAll);
services_routes.get("/:id", controllers.services.getById);
services_routes.get("/agency/:agency_id", controllers.services.getByAgencyId);
services_routes.put("/:id", controllers.services.update);
services_routes.delete("/:id", controllers.services.delete);

export default services_routes;
