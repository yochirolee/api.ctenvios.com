import agencies from "./agencies.repository";
import providers from "./providers.repository";
import forwarders from "./forwarders.repository";
import services from "./services.repository";
import customers from "./customers.repository";
import provinces from "./provinces.repository";
import receivers from "./receivers.repository";
import customsRates from "./customs.rates.repository";
import { analytics } from "./analytics.repository";
import partners from "./partners.repository";
import orders from "./orders.repository";
import payments from "./payments.repository";
import products from "./products.repository";
import shippingRates from "./shipping.rates.repository";

export const repository = {
   agencies,
   providers,
   forwarders,
   services,
   customers,
   provinces,
   receivers,
   customsRates,
   analytics,
   partners,
   orders,
   payments,
   products,
   shippingRates,
};

export default repository;
