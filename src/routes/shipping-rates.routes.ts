import { Router } from "express";
import prisma from "../config/prisma_db";
import { AgencyType, RateType } from "@prisma/client";

const shipping_rates_routes = Router();

shipping_rates_routes.get("/", async (req, res) => {
	const rates = await prisma.shippingRate.findMany();
	res.status(200).json(rates);
});

shipping_rates_routes.get("/agency/:agency_id", async (req, res) => {
	const { agency_id } = req.params;

	const rates = await prisma.shippingRate.findMany({
		where: { agency_id: parseInt(agency_id) },
		select: {
			id: true,
			name: true,
			service_id: true,
			service: {
				select: {
					id: true,
					service_type: true,
					provider: {
						select: { id: true, name: true },
					},
				},
			},
			agency_id: true,
			cost_in_cents: true,
			rate_in_cents: true,
		},
		orderBy: {
			service_id: "asc",
		},
	});

	res.status(200).json(rates);
});

shipping_rates_routes.get("/agency/:agency_id/service/:service_id", async (req, res) => {
	const { agency_id, service_id } = req.params;
	const rate = await prisma.shippingRate.findMany({
		select: {
			id: true,
			rate_in_cents: true,
			rate_type: true,
			min_weight: true,
			max_weight: true,
			
			forwarder: {
				select: {
					id: true,
					name: true,
				},
			},
		},
		where: {
			agency_id: parseInt(agency_id),
			service_id: parseInt(service_id),
			is_active: true,
		},
	});
	res.status(200).json(rate);
});
shipping_rates_routes.get("/agency/:agency_id/service/:service_id/fixed", async (req, res) => {
	const { agency_id, service_id } = req.params;
	const rates = await prisma.shippingRate.findMany({
		where: {
			agency_id: parseInt(agency_id),
			service_id: parseInt(service_id),
			is_active: true,
			rate_type: RateType.FIXED,
		},
	});
	res.status(200).json(rates);
});

shipping_rates_routes.post("/", async (req, res) => {

	//only if the agency is forwarder can create a rate, if the agency is not forwarder, return 403
	const agency = await prisma.agency.findUnique({
		where: { id: parseInt(agency_id) },
	});
	if (agency?.agency_type !== AgencyType.FORWARDER) {
		return res.status(403).json({ message: "Only forwarders can create rates" });
	}
	//if agency if forwarder create the rates for him and all his childrens and all his childrens childrens and so on
	if (agency?.agency_type === AgencyType.FORWARDER) {
		const childrens = await prisma.agency.findMany({
			where: { parent_agency_id: agency.id },
		});
		
		
	}
	const { agency_id, name, service_id, cost_in_cents, rate_in_cents, rate_type, is_base_rate } =
		req.body;
	//convert to cents

	const rate = await prisma.shippingRate.create({
		data: {
			agency_id,
			name,
			service_id,
			is_base_rate: is_base_rate,
			cost_in_cents: cost_in_cents,
			rate_in_cents: rate_in_cents,
			rate_type: rate_type,
		},
	});
	res.status(200).json(rate);
});

shipping_rates_routes.put("/:id", async (req, res) => {
	const { id } = req.params;

	const { name, cost_in_cents, rate_in_cents, is_base_rate } = req.body;
	//convert to cents

	const rate = await prisma.shippingRate.update({
		where: { id: parseInt(id) },
		data: {
			name,
			cost_in_cents: cost_in_cents,
			rate_in_cents: rate_in_cents,
			is_base_rate: is_base_rate,
		},
	});
	res.status(200).json(rate);
});
shipping_rates_routes.delete("/:id", async (req, res) => {
	const { id } = req.params;
	await prisma.shippingRate.delete({ where: { id: parseInt(id) } });
	res.status(200).json({ message: "Rate deleted successfully" });
});

export default shipping_rates_routes;
