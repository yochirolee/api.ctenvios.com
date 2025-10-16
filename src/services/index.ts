import { ordersService as orders } from "./orders.service";
import { resolvers } from "./resolvers.service";
import { shippingRatesService as shippingRates } from "./shipping.rates.service";

export const services = {
   orders,
   resolvers,
   shippingRates,
};

export default services;
