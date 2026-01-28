import { Router } from "express";
import controllers from "../controllers";
import { uploadLogo } from "../middlewares/upload.middleware";

const agencies_routes = Router();

agencies_routes.get("/", controllers.agencies.getAll);
agencies_routes.get("/:id", controllers.agencies.getById);
agencies_routes.get("/:id/users", controllers.agencies.getUsers);
agencies_routes.post("/", controllers.agencies.create);
agencies_routes.put("/:id", controllers.agencies.update);
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
