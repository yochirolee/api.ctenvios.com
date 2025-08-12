import { Router } from "express";
import { z } from "zod";
import prisma from "../config/prisma_db";
import { authMiddleware } from "../middlewares/auth-midleware";
import { Invoice, PaymentMethod, PaymentStatus, PrismaClient } from "@prisma/client";
import { registerInvoiceChange } from "../utils/rename-invoice-changes";

const router = Router();

const paymentSchema = z.object({
	amount: z.number().min(0.01),
	payment_method: z.nativeEnum(PaymentMethod),
	payment_reference: z.string().optional(),
	notes: z.string().optional(),
});

router.post("/invoice/:id", authMiddleware, async (req: any, res) => {
	try {
		const { id } = req.params;

		if (!id) return res.status(400).json({ message: "Invoice ID is required" });
		const { amount, payment_method, payment_reference, notes } = paymentSchema.parse(req.body);
		const user = req.user;
		const invoice = await prisma.invoice.findUnique({
			where: { id: parseInt(id) },
		});
		if (!invoice) return res.status(404).json({ message: "Invoice not found" });

		const paymentCents = Math.round(amount * 100);
		const pending = invoice.total_amount - invoice.paid_amount;

		if (paymentCents > pending) {
			return res.status(400).json({
				message: `Payment exceeds pending amount. Pending: $${(pending / 100).toFixed(2)}`,
			});
		}

		const payment_status =
			paymentCents === pending ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

		const result = await prisma.$transaction(async (tx) => {
			const updatedInvoice = await tx.invoice.update({
				where: { id: parseInt(id) },
				data: {
					paid_amount: { increment: paymentCents },
					payment_status,
				},
			});

			await tx.payment.create({
				data: {
					invoice_id: parseInt(id),
					amount: paymentCents,
					payment_method,
					payment_reference,
					payment_date: new Date(),
					notes,
					status: payment_status,
					user_id: user.id,
				},
			});
			await registerInvoiceChange(
				tx as PrismaClient,
				invoice as Invoice,
				updatedInvoice as Invoice,
				user.id,
				`Payment of $${(amount / 100).toFixed(2)} added to invoice ${id}`,
			);

			return updatedInvoice;
		});

		res.json(result);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Payment error", error });
	}
});

router.get("/invoice/:id", authMiddleware, async (req: any, res) => {
	const { id } = req.params;
	const payments = await prisma.payment.findMany({
		where: { invoice_id: parseInt(id) },
		include: {
			user: {
				select: {
					name: true,
				},
			},
		},
	});
	res.status(200).json(payments);
});
router.delete("/:id", authMiddleware, async (req: any, res) => {
	const { id } = req.params;
	const payment_to_delete = await prisma.payment.findUnique({
		where: { id: parseInt(id) },
	});
	if (!payment_to_delete) return res.status(404).json({ message: "Payment not found" });
	//find invoice and update paid_amount
	const invoice = await prisma.invoice.findUnique({
		where: { id: payment_to_delete.invoice_id },
	});
	if (!invoice) return res.status(404).json({ message: "Invoice not found" });

	//transaction to update invoice and delete payment
	await prisma.$transaction(async (tx) => {
		await tx.invoice.update({
			where: { id: invoice.id },
			data: { paid_amount: { decrement: payment_to_delete.amount } },
		});
		await tx.payment.delete({ where: { id: parseInt(id) } });
	});
	res.status(200).json({ message: "Payment deleted successfully" });
});

// Puedes agregar más rutas como:
// GET /payments/:id
// DELETE /payments/:id
// GET /payments?invoice_id=123
// GET /payments/reports?from=...&to=...

export default router;
