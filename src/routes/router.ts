import { Router, Request, Response } from "express";
import providers_routes from "./providers.routes";
import agencies_routes from "./agencies.routes";
import services_routes from "./services.routes";
import rates_routes from "./rates.routes";
import forwarders_routes from "./forwarders.routes";
import customers_routes from "./customers.routes";
import provinces_routes from "./provinces.routes";
import receivers_routes from "./receivers.routes";
import invoices_routes from "./invoices.routes";
import users_routes from "./users.routes";
import customs_rates_routes from "./customs.rates.routes";
import { authMiddleware } from "../middlewares/auth-midleware";
import roles_routes from "./roles.routes";
const router = Router();

router.get("/", (req: Request, res: Response) => {
	res.send("Welcome to CTEnvios API V1");
});

router.use("/providers", authMiddleware, providers_routes);
router.use("/forwarders", forwarders_routes);
router.use("/agencies", agencies_routes);
router.use("/services", services_routes);
router.use("/rates", rates_routes);
router.use("/customs-rates", customs_rates_routes);

router.use("/users", users_routes);
router.use("/customers", customers_routes);
router.use("/receivers", receivers_routes);
router.use("/provinces", provinces_routes);
router.use("/invoices", invoices_routes);
router.use("/roles", roles_routes);

export default router;
