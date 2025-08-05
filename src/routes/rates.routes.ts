import { Router } from "express";
import prisma from "../config/prisma_db";

const rates_routes = Router();

rates_routes.get("/", async (req, res) => {
	const rates = await prisma.rates.findMany();
	rates.forEach((rate) => {
		rate.public_rate = rate.public_rate / 100;
		rate.agency_rate = rate.agency_rate / 100;
	});
	res.status(200).json(rates);
});

rates_routes.get("/agency/:agency_id", async (req, res) => {
	const { agency_id } = req.params;

	const rates = await prisma.rates.findMany({
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
			public_rate: true,
		},
		orderBy: {
			service_id: "asc",
		},
	});

	rates.forEach((rate) => {
		rate.public_rate = rate.public_rate / 100;
	});

	res.status(200).json(rates);
});

rates_routes.post("/", async (req, res) => {
	const { agency_id, name, service_id, agency_rate, public_rate } = req.body;
	//convert to cents
	const agency_rate_cents = Math.round(agency_rate * 100);
	const public_rate_cents = Math.round(public_rate * 100);
	const rate = await prisma.rates.create({
		data: {
			agency_id,
			name,
			service_id,
			agency_rate: agency_rate_cents,
			public_rate: public_rate_cents,
		},
	});
	res.status(200).json(rate);
});

rates_routes.put("/:id", async (req, res) => {
	const { id } = req.params;

	const { name, agency_rate, public_rate } = req.body;
	//convert to cents
	const agency_rate_cents = Math.round(agency_rate * 100);
	const public_rate_cents = Math.round(public_rate * 100);
	const rate = await prisma.rates.update({
		where: { id: parseInt(id) },
		data: { name, agency_rate: agency_rate_cents, public_rate: public_rate_cents },
	});
	res.status(200).json(rate);
});
rates_routes.delete("/:id", async (req, res) => {
	const { id } = req.params;
	await prisma.rates.delete({ where: { id: parseInt(id) } });
	res.status(200).json({ message: "Rate deleted successfully" });
});

export default rates_routes;
