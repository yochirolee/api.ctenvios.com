import { ordersService as orders } from "./orders.service";
import { resolvers } from "./resolvers.service";
import { pricingService as pricing } from "./pricing.service";
import upload from "./upload.service";

export const services = {
   orders,
   resolvers,
   pricing,
   upload,
};

export default services;
