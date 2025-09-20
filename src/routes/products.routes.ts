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

router.get("/agency/:agency_id", async (req, res) => {
	const { agency_id } = req.params;
	const products = await prisma.product.findMany({
		where: { agency_id: parseInt(agency_id) },
	});
	res.status(200).json(products);
});

router.get("/shipping_rates/agency/:agency_id/service/:service_id", async (req, res) => {
	const { agency_id, service_id } = req.params;
	if (!agency_id || !service_id) {
		return res.status(400).json({ error: "Agency and service IDs are required" });
	}
	const products = await prisma.product.findMany({
		where: {
			agency_id: parseInt(agency_id),
			shipping_rates: {
				some: {
					agency_id: parseInt(agency_id),
					service_id: parseInt(service_id),
				},
			},
		},
		select: {
			id: true,
			name: true,
			customs_rates_id: true,
			weight: true,
			customs_rates: {
				select: {
					id: true,
					fee_in_cents: true,
				},
			},
			shipping_rates: {
				where: {
					agency_id: parseInt(agency_id),
					service_id: parseInt(service_id),
				},
				select: {
					id: true,
					rate_in_cents: true,
					rate_type: true,
				},
			},
		},
	});

	// Aplanar la estructura de respuesta
	const flattenedProducts = products.map((product) => ({
		id: product.id,
		name: product.name,
		weight: product.weight,
		customs_id: product.customs_rates?.id,
		customs_fee_in_cents: product.customs_rates?.fee_in_cents || 0,
		rate_id: product.shipping_rates[0]?.id || null,
		rate_in_cents: product.shipping_rates[0]?.rate_in_cents || 0,
		rate_type: product.shipping_rates[0]?.rate_type || "FIXED",
	}));

	res.status(200).json(flattenedProducts);
});

export default router;
