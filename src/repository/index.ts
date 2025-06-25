import agencies from "./agencies.repository";
import providers from "./providers.repository";
import forwarders from "./forwarders.repository";
import services from "./services.repository";
import customers from "./customers.repository";
import provinces from "./provinces.repository";
import receipts from "./receipts.repository";
import customsRates from "./customs.rates.repository";

export const repository = {
	agencies,
	providers,
	forwarders,
	services,
	customers,
	provinces,
	receipts,
	customsRates,
};

export default repository;
