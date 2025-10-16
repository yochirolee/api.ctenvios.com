import { Router } from "express";
import controllers from "../controllers";
const agencies_routes = Router();

agencies_routes.get("/", controllers.agencies.getAll);
agencies_routes.get("/:id", controllers.agencies.getById);
agencies_routes.get("/:id/users", controllers.agencies.getUsers);
agencies_routes.post("/", controllers.agencies.create);
agencies_routes.put("/:id", controllers.agencies.update);
agencies_routes.delete("/:id", controllers.agencies.remove);
agencies_routes.get("/:id/childrens", controllers.agencies.getChildren);
agencies_routes.get("/:id/parent", controllers.agencies.getParent);
agencies_routes.get("/:id/actives-services-rates", controllers.agencies.getActivesServicesRates);
//por ahora no se usa pero se deja para futuras implementaciones
agencies_routes.get("/:id/services/:service_id/actives-shipping-rates", controllers.agencies.getActivesShippingRates);

export default agencies_routes;
