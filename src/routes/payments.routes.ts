import { Router } from "express";
import { z } from "zod";
import prisma from "../config/prisma_db";
import { authMiddleware } from "../middlewares/auth-midleware";
import { Invoice, PaymentMethod, PaymentStatus, PrismaClient, InvoiceStatus } from "@prisma/client";
import { registerInvoiceChange } from "../utils/rename-invoice-changes";
import { paymentSchema } from "../types/types";

const router = Router();

router.post("/invoice/:id", authMiddleware, async (req: any, res) => {
   try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ message: "Invoice ID is required" });
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { amount_in_cents, method, reference, notes } = paymentSchema.parse(req.body);
      const invoice = await prisma.invoice.findUnique({
         where: { id: parseInt(id) },
      });
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });

      let amount_to_pay_in_cents = amount_in_cents;
      let charge_amount = 0;

      if (method === PaymentMethod.CREDIT_CARD || method === PaymentMethod.DEBIT_CARD) {
         charge_amount = Math.round(amount_in_cents * 0.03 * 100); //in cents
      }

      const pending = invoice.total_in_cents + charge_amount - invoice.paid_in_cents;

      if (amount_to_pay_in_cents > pending) {
         return res.status(400).json({
            message: `Payment exceeds pending amount. Pending: $${(pending / 100).toFixed(2)}`,
         });
      }

      const payment_status = amount_to_pay_in_cents === pending ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;
      const invoice_status = payment_status === PaymentStatus.PAID ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

      // Debug logging
      console.log("Payment processing:", {
         amount_to_pay_in_cents,
         pending,
         charge_amount,
         payment_status,
         invoice_status,
         current_status: invoice.status,
         current_payment_status: invoice.payment_status,
      });

      const result = await prisma.$transaction(async (tx) => {
         const updatedInvoice = await tx.invoice.update({
            where: { id: parseInt(id) },
            data: {
               paid_in_cents: { increment: amount_to_pay_in_cents },
               charge_in_cents: { increment: charge_amount },
               payment_status: payment_status,
               status: invoice_status,
            },
         });

         console.log("After update:", {
            status: updatedInvoice.status,
            payment_status: updatedInvoice.payment_status,
         });

         await tx.payment.create({
            data: {
               invoice_id: parseInt(id),
               amount_in_cents: amount_to_pay_in_cents,
               charge_in_cents: charge_amount,
               method: method,
               reference: reference || "",
               date: new Date(),
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
            invoice_status,
            `Payment of $${(amount_in_cents / 100).toFixed(2)} ${method} added to invoice ${id}`
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
         data: { paid_in_cents: { decrement: payment_to_delete.amount_in_cents }, status: InvoiceStatus.PAID },
      });
      await tx.payment.delete({ where: { id: parseInt(id) } });
   });
   res.status(200).json({ message: "Payment deleted successfully" });
});

// Puedes agregar mas rutas como:
// GET /payments/:id
// DELETE /payments/:id
// GET /payments?invoice_id=123
// GET /payments/reports?from=...&to=...

export default router;
