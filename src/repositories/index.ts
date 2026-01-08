import agencies from "./agencies.repository";
import providers from "./providers.repository";
import forwarders from "./forwarders.repository";
import carriers from "./carriers.repository";
import services from "./services.repository";
import customers from "./customers.repository";
import provinces from "./provinces.repository";
import receivers from "./receivers.repository";
import customsRates from "./customs.rates.repository";
import analytics from "./analytics.repository";
import partners from "./partners.repository";
import orders from "./orders.repository";
import payments from "./payments.repository";
import products from "./products.repository";
import shippingRates from "./shipping.rates.repository";
import dispatch from "./dispatch.repository";
import parcels from "./parcels.repository";
import appLogs from "./app-logs.repository";
import issues from "./issues.repository";
import legacyIssues from "./legacy-issues.repository";
import interAgencyDebts from "./inter-agency-debts.repository";
import containers from "./containers.repository";
import flights from "./flights.repository";

export const repository = {
   agencies,
   providers,
   forwarders,
   carriers,
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
   dispatch,
   parcels,
   appLogs,
   issues,
   legacyIssues,
   interAgencyDebts,
   containers,
   flights,
};

export default repository;
