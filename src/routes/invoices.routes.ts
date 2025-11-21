import { Router } from "express";
import prisma from "../lib/prisma.client";
import { generateInvoicePDF } from "../utils/generate-invoice-pdf";
import { generateOrderPDF } from "../utils/generate-order-pdf";
import { generateCTEnviosLabels } from "../utils/generate-labels-pdf";
import { AppError } from "../common/app-errors";
import repository from "../repositories";
import { generateHblPdf } from "../utils/generate-hbl-pdf";
import { orderWithRelationsInclude } from "../types/order-with-relations";
import HttpStatusCodes from "../common/https-status-codes";

const router = Router();

// Generate PDF endpoint
router.get("/:id/order-pdf", async (req, res) => {
   try {
      const { id } = req.params;
      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid invoice ID");
      }

      // Fetch invoice with all required relations
      const invoice = await prisma.order.findUnique({
         where: { id: parseInt(id) },
         include: {
            customer: true,
            receiver: {
               include: {
                  province: true,
                  city: true,
               },
            },
            agency: true,
            service: true,
            order_items: true,
         },
      });

      if (!invoice) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Invoice not found");
      }

      // Add charge_in_cents (calculated from payments or default to 0)
      const invoiceWithCharge = {
         ...invoice,
         charge_in_cents: 0,
      };

      // Generate PDF
      const doc = await generateInvoicePDF(invoiceWithCharge);

      // Set response headers for PDF
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.id}.pdf"`);

      // Pipe the PDF to response
      doc.pipe(res);
      doc.end();
   } catch (error) {
      console.error("PDF generation error:", error);

      if (error instanceof AppError) {
         res.status(error.status).json({
            status: "error",
            message: error.message,
         });
      }
   }
});

// Generate modern order PDF endpoint
router.get("/:id/pdf", async (req, res) => {
   try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid order ID");
      }

      // Fetch order with all required relations
      const order = await repository.orders.getByIdWithDetails(parseInt(id));
      if (!order) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Order not found");
      }

      // Generate modern order PDF
      const doc = await generateOrderPDF(order);

      // Set response headers for PDF
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="order-${order.id}.pdf"`);

      // Pipe the PDF to response
      doc.pipe(res);
      doc.end();
   } catch (error) {
      console.error("Modern order PDF generation error:", error);

      if (error instanceof AppError) {
         res.status(error.status).json({
            status: "error",
            message: error.message,
         });
      } else {
         res.status(500).json({
            status: "error",
            message: "Error generating modern order PDF",
            error: process.env.NODE_ENV === "development" ? error : undefined,
         });
      }
   }
});

router.get("/:id/labels", async (req, res) => {
   try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid invoice ID");
      }

      // Fetch invoice with all required relations
      const invoice = await prisma.order.findUnique({
         where: { id: parseInt(id) },
         include: orderWithRelationsInclude,
      });

      if (!invoice) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Invoice not found");
      }
      if (!invoice.order_items || invoice.order_items.length === 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "No order items found for this invoice");
      }

      // Generate CTEnvios labels
      const doc = await generateCTEnviosLabels(invoice);

      // Set response headers for PDF to open in browser (inline)
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="ctenvios-labels-${invoice.id}.pdf"`);

      // Pipe the PDF to response
      doc.pipe(res);
      doc.end();
   } catch (error) {
      console.error("label generation error:", error);

      if (error instanceof AppError) {
         res.status(error.status).json({
            status: "error",
            message: error.message,
         });
      } else {
         res.status(500).json({
            status: "error",
            message: "Error generating labels",
            error: process.env.NODE_ENV === "development" ? error : undefined,
         });
      }
   }
});

router.get("/:id/hbl-pdf", async (req, res) => {
   try {
      const { id } = req.params;
      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid invoice ID");
      }

      // Fetch invoice with all required relations
      const order = await repository.orders.getByIdWithDetails(parseInt(id));

      if (!order) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Order not found");
      }

      // Generate HBL PDF
      const doc = await generateHblPdf(order);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="hbl-${order.id}.pdf"`);
      doc.pipe(res);
      doc.end();
   } catch (error) {
      console.error("HBL PDF generation error:", error);
      if (error instanceof AppError) {
         res.status(error.status).json({
            status: "error",
            message: error.message,
         });
      } else {
         res.status(500).json({
            status: "error",
            message: "Error generating HBL PDF",
            error: process.env.NODE_ENV === "development" ? error : undefined,
         });
      }
   }
});
export default router;
