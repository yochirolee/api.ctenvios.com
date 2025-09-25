import { Router } from "express";
import controllers from "../controllers";
import { authMiddleware } from "../middlewares/auth-midleware";
const agencies_routes = Router();

agencies_routes.get("/", authMiddleware, controllers.agencies.getAll);
agencies_routes.get("/:id", controllers.agencies.getById);
agencies_routes.get("/:id/users", authMiddleware, controllers.agencies.getUsers);
agencies_routes.post("/", authMiddleware, controllers.agencies.create);
agencies_routes.put("/:id", controllers.agencies.update);
agencies_routes.delete("/:id", controllers.agencies.remove);
agencies_routes.get("/:id/childrens", controllers.agencies.getChildren);
agencies_routes.get("/:id/parent", controllers.agencies.getParent);
agencies_routes.get("/:id/services", controllers.agencies.getServices);
agencies_routes.get(
	"/:id/service/:service_id/shipping-rates",
	controllers.agencies.getServiceShippingRates,
);
agencies_routes.get("/:id/shipping-rates", controllers.agencies.getShippingRates);

export default agencies_routes;
