import { Router, Request, Response } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
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
import analytics_routes from "./analytics.routes";
import partners_routes from "./partners.routes";
import orders_routes from "./orders.routes";
import products_routes from "./products.routes";
import shippingRatesRoutes from "./shipping.rates.routes";

const router = Router();

router.get("/", (req: Request, res: Response) => {
   res.send("Welcome to CTEnvios API V1");
});
//private routes

//public routes
router.use("/providers", authMiddleware, providers_routes);
router.use("/forwarders", authMiddleware, forwarders_routes);
router.use("/agencies", authMiddleware, agencies_routes);
router.use("/services", authMiddleware, services_routes);
router.use("/customs-rates", authMiddleware, customs_rates_routes);
router.use("/users", users_routes);
router.use("/customers", authMiddleware, customers_routes);
router.use("/receivers", authMiddleware, receivers_routes);
router.use("/provinces", authMiddleware, provinces_routes);
router.use("/invoices", invoices_routes);
router.use("/roles", authMiddleware, roles_routes);
router.use("/analytics", authMiddleware, analytics_routes);
router.use("/partners", partners_routes);
router.use("/orders", authMiddleware, orders_routes);
router.use("/products", authMiddleware, products_routes);
router.use("/shipping-rates", authMiddleware, shippingRatesRoutes);
export default router;
