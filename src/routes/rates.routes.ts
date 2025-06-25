import { Router } from "express";
import prisma from "../config/prisma_db";

const rates_routes = Router();

rates_routes.get("/", async (req, res) => {
	const rates = await prisma.rates.findMany();
	res.status(200).json(rates);
});

rates_routes.get("/agency/:agency_id/service/:service_id", async (req, res) => {
	const { agency_id, service_id } = req.params;

	const rates = await prisma.rates.findMany({
		where: { agency_id: parseInt(agency_id), service_id: parseInt(service_id) },
		select: {
			id: true,
			service_id: true,
			agency_id: true,
			agency_rate: true,
			public_rate: true,
		},
	});
	res.status(200).json(rates);
});

rates_routes.post("/", async (req, res) => {
	const { agency_id, service_id, agency_rate, public_rate } = req.body;
	const rate = await prisma.rates.create({
		data: { agency_id, service_id, agency_rate, public_rate },
	});
	res.status(200).json(rate);
});

export default rates_routes;
