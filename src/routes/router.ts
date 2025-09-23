import { Router, Request, Response } from "express";
import { authMiddleware } from "../middlewares/auth-midleware";
import providers_routes from "./providers.routes";
import agencies_routes from "./agencies.routes";
import services_routes from "./services.routes";
import forwarders_routes from "./forwarders.routes";
import customers_routes from "./customers.routes";
import provinces_routes from "./provinces.routes";
import receivers_routes from "./receivers.routes";
import invoices_routes from "./invoices.routes";
import users_routes from "./users.routes";
import customs_rates_routes from "./customs.rates.routes";
import roles_routes from "./roles.routes";
import payments_routes from "./payments.routes";
import analytics_routes from "./analytics.routes";
import products_routes from "./products.routes";
import shipping_rates_routes from "./shipping-rates.routes";

const router = Router();

router.get("/", (req: Request, res: Response) => {
	res.send("Welcome to CTEnvios API V1");
});

router.use("/providers", authMiddleware, providers_routes);
router.use("/forwarders", forwarders_routes);
router.use("/agencies", agencies_routes);
router.use("/services", services_routes);
router.use("/shipping-rates", shipping_rates_routes);
router.use("/shipping_rates", shipping_rates_routes); // Backward compatibility alias
router.use("/customs-rates", customs_rates_routes);

router.use("/users", users_routes);
router.use("/customers", customers_routes);
router.use("/receivers", receivers_routes);
router.use("/provinces", provinces_routes);
router.use("/invoices", invoices_routes);
router.use("/roles", roles_routes);
router.use("/payments", payments_routes);
router.use("/analytics", analytics_routes);
router.use("/products", products_routes);

export default router;
