import { Router } from "express";
import prisma from "../config/prisma_db";
import { generateInvoicePDF } from "../utils/generate-invoice-pdf";
import { generateOrderPDF } from "../utils/generate-order-pdf";
import { generateCTEnviosLabels } from "../utils/generate-labels-pdf";
import AppError from "../utils/app.error";

const router = Router();

// Generate PDF endpoint
router.get("/:id/order-pdf", async (req, res) => {
   try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError("Invalid invoice ID", 400);
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
            items: true,
         },
      });

      if (!invoice) {
         throw new AppError("Invoice not found", 404);
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
         res.status(error.statusCode).json({
            status: "error",
            message: error.message,
         });
      } else {
         res.status(500).json({
            status: "error",
            message: "Error generating PDF",
            error: process.env.NODE_ENV === "development" ? error : undefined,
         });
      }
   }
});

// Generate modern order PDF endpoint
router.get("/:id/pdf", async (req, res) => {
   try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError("Invalid order ID", 400);
      }

      // Fetch order with all required relations
      const order = await prisma.order.findUnique({
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
            items: true,
         },
      });

      if (!order) {
         throw new AppError("Order not found", 404);
      }

      // Add charge_in_cents (calculated from payments or default to 0)
      const orderWithCharge = {
         ...order,
         charge_in_cents: 0,
      };

      // Generate modern order PDF
      const doc = await generateOrderPDF(orderWithCharge);

      // Set response headers for PDF
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="order-${order.id}.pdf"`);

      // Pipe the PDF to response
      doc.pipe(res);
      doc.end();
   } catch (error) {
      console.error("Modern order PDF generation error:", error);

      if (error instanceof AppError) {
         res.status(error.statusCode).json({
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
         throw new AppError("Invalid invoice ID", 400);
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
            service: {
               include: {
                  provider: true,
                  forwarder: true,
               },
            },
            items: {
               orderBy: { hbl: "asc" },
            },
         },
      });

      if (!invoice) {
         throw new AppError("Invoice not found", 404);
      }

      if (!invoice.items || invoice.items.length === 0) {
         throw new AppError("No items found for this invoice", 400);
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
         res.status(error.statusCode).json({
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

export default router;
