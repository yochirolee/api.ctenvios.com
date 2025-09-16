import { Router } from "express";
import prisma from "../config/prisma_db";

const router = Router();

router.get("/", async (req, res) => {
	const products = await prisma.product.findMany();
	res.status(200).json(products);
});

router.post("/", async (req, res) => {
	const { name, agency_id } = req.body;
	const product = await prisma.product.create({
		data: { name, agency_id },
	});
	res.status(200).json(product);
});

router.get("/owned-by/:agency_id", async (req, res) => {
	const { agency_id } = req.params;
	const products = await prisma.product.findMany({
		where: { agency_id: parseInt(agency_id) },
	});
	res.status(200).json(products);
});

router.get("/shipping_rates/agency/:agency_id/service/:service_id", async (req, res) => {
	const { agency_id, service_id } = req.params;
	const products = await prisma.product.findMany({
		select: {
			id: true,
			name: true,
			shipping_rate: {
				select: {
					id: true,
					name: true,
					cost_in_cents: true,
					rate_in_cents: true,
					rate_type: true,
					min_weight: true,
					max_weight: true,
					service_id: true,
				},
				where: {
					service_id: parseInt(service_id),
					agency_id: parseInt(agency_id),
					is_active: true,
					
				},
			},
		},
	});
	res.status(200).json(products);
});

export default router;
