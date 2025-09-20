import { Router } from "express";
import prisma from "../config/prisma_db";

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

shipping_rates_routes.get("/base_rate/agency/:agency_id/service/:service_id", async (req, res) => {
	const { agency_id, service_id } = req.params;
	const rate = await prisma.shippingRate.findFirst({
		select: {
			id: true,
			rate_in_cents: true,
			rate_type: true,
			min_weight: true,
			max_weight: true,
		},
		where: {
			agency_id: parseInt(agency_id),
			service_id: parseInt(service_id),
			is_base_rate: true,
			is_active: true,
		},
	});
	res.status(200).json(rate);
});

shipping_rates_routes.get("/agency/:agency_id/service/:service_id", async (req, res) => {
	const { agency_id, service_id } = req.params;
	const rates = await prisma.shippingRate.findMany({
		select: {
			id: true,
			rate_in_cents: true,
			rate_type: true,
			min_weight: true,
			max_weight: true,
			service_id: true,
			is_base_rate: true,
			
			
			

			

					},
		where: { agency_id: parseInt(agency_id), service_id: parseInt(service_id), is_active: true },
		orderBy: {
			id: "asc",
		},
	});
	res.status(200).json(rates);
});

shipping_rates_routes.get("/agency/:agency_id/service/:service_id/products-rates", async (req, res) => {
	const { agency_id, service_id } = req.params;

	const products = await prisma.shippingRate.findMany({
		select: {
			id: true,
			rate_in_cents: true,
			rate_type: true,
			
			
		},	
		where: { agency_id: parseInt(agency_id), is_active: true },
	});
	



	res.status(200).json(products);
});

shipping_rates_routes.post("/", async (req, res) => {
	const { agency_id, name, service_id, cost_in_cents, rate_in_cents, rate_type } = req.body;
	//convert to cents

	const rate = await prisma.shippingRate.create({
		data: {
			agency_id,
			name,
			service_id,
			cost_in_cents: cost_in_cents,
			rate_in_cents: rate_in_cents,
			rate_type: rate_type,
		},
	});
	res.status(200).json(rate);
});

shipping_rates_routes.put("/:id", async (req, res) => {
	const { id } = req.params;

	const { name, cost_in_cents, rate_in_cents } = req.body;
	//convert to cents

	const rate = await prisma.shippingRate.update({
		where: { id: parseInt(id) },
		data: { name, cost_in_cents: cost_in_cents, rate_in_cents: rate_in_cents },
	});
	res.status(200).json(rate);
});
shipping_rates_routes.delete("/:id", async (req, res) => {
	const { id } = req.params;
	await prisma.shippingRate.delete({ where: { id: parseInt(id) } });
	res.status(200).json({ message: "Rate deleted successfully" });
});

export default shipping_rates_routes;
