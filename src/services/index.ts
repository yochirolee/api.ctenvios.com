import { ordersService as orders } from "./orders.service";
import { resolvers } from "./resolvers.service";
import { pricingService as pricing } from "./pricing.service";

export const services = {
   orders,
   resolvers,
   pricing,
};

export default services;
