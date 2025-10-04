import { Router, Request, Response } from "express";
import prisma from "../config/prisma_db";
import receivers_db from "../repository/receivers.repository";
import { generarTracking } from "../utils/generate_hbl";
import { generateInvoicePDF } from "../utils/generate-invoice-pdf";
import { RateType, Roles, PaymentStatus, InvoiceStatus, InvoiceEventType } from "@prisma/client";
// Removed unused imports for shipping labels
import { generateCTEnviosLabels, generateBulkCTEnviosLabels } from "../utils/generate-shipping-labels-ctenvios";
import { z } from "zod";
import AppError from "../utils/app.error";
import { createInvoiceHistoryExtension } from "../middlewares/invoice-middleware";
import { authMiddleware } from "../middlewares/auth-midleware";
import { buildInvoiceTimeline } from "../utils/build-invoice-timeline";
import { calculatePaymentStatus } from "../utils/rename-invoice-changes";
import { calculate_row_subtotal } from "../utils/utils";

// Define un esquema de validacion para los query params
const searchSchema = z.object({
   page: z.string().optional().default("1"),
   limit: z.string().optional().default("25"),
   search: z.string().optional().default(""),
   startDate: z.string().optional(),
   endDate: z.string().optional(),
});

const invoiceItemSchema = z.object({
   description: z.string().min(1),
   rate_id: z.number().positive().optional(),
   customs_id: z.number().optional(),
   product_id: z.number().positive().optional(),
   cost_in_cents: z.number().min(0).optional().default(0),
   charge_fee_in_cents: z.number().min(0).optional().default(0),
   delivery_fee_in_cents: z.number().min(0).optional().default(0),
   weight: z.number().positive(),
   rate_in_cents: z.number().min(0),
   customs_fee_in_cents: z.number().min(0).optional().default(0),
   insurance_fee_in_cents: z.number().min(0).optional().default(0),
   rate_type: z.nativeEnum(RateType).optional(),
});

const newInvoiceSchema = z.object({
   user_id: z.string().min(1),
   agency_id: z.number().positive(),
   customer_id: z.number().positive(),
   receiver_id: z.number().positive(),
   service_id: z.number().positive(),
   items: z.array(invoiceItemSchema).min(1),
   total_in_cents: z.number().min(0).optional(), // 🚀 Frontend puede calcular esto
});

const updateInvoiceSchema = z.object({
   user_id: z.string().min(1),
   agency_id: z.number().positive(),
   customer_id: z.number().positive(),
   receiver_id: z.number().positive(),
   service_id: z.number().positive(),
   items: z.array(invoiceItemSchema).min(1, "Invoice must have at least one item"),
});

const bulkLabelsSchema = z.object({
   invoiceIds: z
      .array(
         z.union([
            z.number().int().positive(),
            z.string().transform((val) => {
               const parsed = parseInt(val);
               if (isNaN(parsed) || parsed <= 0) {
                  throw new Error("Invalid invoice ID");
               }
               return parsed;
            }),
         ]),
         {
            required_error: "Invoice IDs array is required",
            invalid_type_error: "Invoice IDs must be an array of numbers",
         }
      )
      .min(1, "At least one invoice ID is required"),
});

const router = Router();

router.get("/", async (req, res) => {
   const { page, limit } = req.query;
   console.log(req.query, "req.query");
   const total = await prisma.invoice.count();

   const rows = await prisma.invoice.findMany({
      include: {
         service: {
            select: {
               id: true,
               name: true,
            },
         },
         agency: {
            select: {
               id: true,
               name: true,
            },
         },
         customer: {
            select: {
               id: true,
               first_name: true,
               middle_name: true,
               last_name: true,
               second_last_name: true,
               mobile: true,
            },
         },
         receiver: {
            select: {
               id: true,
               first_name: true,
               middle_name: true,
               last_name: true,
               second_last_name: true,
               mobile: true,
            },
         },
         user: {
            select: {
               id: true,
               name: true,
            },
         },
         _count: {
            select: {
               items: true,
            },
         },
      },
      orderBy: {
         created_at: "desc",
      },

      take: limit ? parseInt(limit as string) : 25,
      skip: page ? (parseInt(page as string) - 1) * (limit ? parseInt(limit as string) : 25) : 0,
   });

   res.status(200).json({ rows, total });
});

function parseDateFlexible(dateStr: string): Date | null {
   if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
   }
   if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split("/");
      const d = new Date(`${year}-${month}-${day}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
   }
   return null;
}

function buildNameSearchFilter(words: string[]) {
   return {
      AND: words.map((w) => ({
         OR: [
            { first_name: { contains: w, mode: "insensitive" } },
            { middle_name: { contains: w, mode: "insensitive" } },
            { last_name: { contains: w, mode: "insensitive" } },
            { second_last_name: { contains: w, mode: "insensitive" } },
         ],
      })),
   };
}
router.get("/search", authMiddleware, async (req: any, res) => {
   try {
      const user = req.user;

      // 1. Validacion de entradas con Zod
      const validation = searchSchema.safeParse(req.query);
      if (!validation.success) {
         return res.status(400).json({ message: "Parametros de consulta invalidos", errors: validation.error.issues });
      }
      const { page, limit, search, startDate, endDate } = validation.data;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      const searchTerm = search.trim().toLowerCase();
      const words = searchTerm.split(/\s+/).filter(Boolean);
      const isNumeric = /^\d+$/.test(searchTerm);

      // 2. Construccion de Clausula WHERE unificada
      let whereClause: any = {};
      const filters: any[] = [];

      // Filtro de fecha
      if (startDate || endDate) {
         const dateFilter: any = { created_at: {} };
         if (startDate) {
            const start = parseDateFlexible(startDate);
            if (!start) return res.status(400).json({ message: "startDate invalida" });
            dateFilter.created_at.gte = start;
         }
         if (endDate) {
            const end = parseDateFlexible(endDate);
            if (!end) return res.status(400).json({ message: "endDate invalida" });
            end.setHours(23, 59, 59, 999);
            dateFilter.created_at.lte = end;
         }
         filters.push(dateFilter);
      }

      // Filtro principal de busqueda
      if (searchTerm) {
         if (isNumeric) {
            // Logica numerica combinada con OR para evitar el fallback
            const numericConditions = [];
            if (searchTerm.length <= 5) {
               numericConditions.push({ id: parseInt(searchTerm) });
            }
            if (searchTerm.length === 10) {
               numericConditions.push({ customer: { mobile: { contains: searchTerm } } });
               numericConditions.push({ receiver: { mobile: { contains: searchTerm } } }); // fallback incluido aqui
            }
            if (searchTerm.length === 11) {
               numericConditions.push({ receiver: { ci: { contains: searchTerm } } });
            }

            if (numericConditions.length > 0) {
               filters.push({ OR: numericConditions });
            } else {
               // Si es numerico pero no cumple ninguna longitud, no devolver nada.
               // Esto evita que una busqueda de 6 digitos devuelva todos los resultados.
               filters.push({ id: -1 }); // Condicion para no encontrar resultados
            }
         } else {
            // Logica de busqueda por nombre
            const nameFilters = buildNameSearchFilter(words);
            filters.push({ OR: [{ customer: nameFilters }, { receiver: nameFilters }] });
         }
      }

      // Filtro de Rol (RBAC)
      const allowedRoles = [Roles.ROOT, Roles.ADMINISTRATOR];
      if (!allowedRoles.includes(user.role)) {
         filters.push({ agency_id: user.agency_id });
      }

      // Combinar todos los filtros con AND
      if (filters.length > 0) {
         whereClause.AND = filters;
      }

      // 3. Ejecutar consultas en una sola transaccion
      const [count, rows] = await prisma.$transaction([
         prisma.invoice.count({ where: whereClause }),
         prisma.invoice.findMany({
            include: {
               service: { select: { id: true, name: true } },
               agency: { select: { id: true, name: true } },
               customer: {
                  select: {
                     id: true,
                     first_name: true,
                     last_name: true,
                     second_last_name: true,
                     mobile: true,
                  },
               }, // Traer solo lo necesario
               receiver: {
                  select: {
                     id: true,
                     first_name: true,
                     last_name: true,
                     second_last_name: true,
                     mobile: true,
                     province: { select: { name: true } },
                     city: { select: { name: true } },
                  },
               },
               user: { select: { id: true, name: true } },
               _count: { select: { items: true } },
            },
            where: whereClause,
            orderBy: { created_at: "desc" },
            take: limitNum,
            skip: (pageNum - 1) * limitNum,
         }),
      ]);

      res.status(200).json({ rows, total: count });
   } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: "Error searching invoices", error });
   }
});

function calculate_subtotal(items: any[]): number {
   let total = 0;
   items.forEach((item) => {
      const itemSubtotal = calculate_row_subtotal(
         item.rate_in_cents || 0,
         item.weight || 0,
         item.customs_fee_in_cents || 0,
         item.rate_type || "WEIGHT",
         item.charge_fee_in_cents || 0
      );
      // Add additional fees that aren't handled by calculate_row_subtotal
      const additionalFees = (item.insurance_fee_in_cents || 0) + (item.delivery_fee_in_cents || 0);
      total += itemSubtotal + additionalFees;
   });
   return total;
}
// 🚀 OPTIMIZACIÓN 3: Generacion HBL optimizada (sin retries innecesarios)
async function generateHBLFast(agencyId: number, serviceId: number, cantidad: number): Promise<string[]> {
   const today = new Date();
   const todayOnlyDate = today.toISOString().slice(2, 10).replace(/-/g, "");

   // Una sola transaccion, sin retries
   const result = await prisma.$transaction(
      async (tx) => {
         const updatedCounter = await tx.counter.upsert({
            where: {
               date_agency_id: {
                  agency_id: agencyId,
                  date: todayOnlyDate,
               },
            },
            create: {
               agency_id: agencyId,
               date: todayOnlyDate,
               counter: cantidad,
            },
            update: {
               counter: { increment: cantidad },
            },
            select: { counter: true },
         });

         const newSequence = updatedCounter.counter;
         const start = newSequence - cantidad + 1;
         const fecha = todayOnlyDate;
         const agencia = agencyId.toString().padStart(2, "0");
         const servicio = serviceId.toString().padStart(1, "0");

         // Generacion inline (mas rapida que Array.from)
         const codigos: string[] = [];
         for (let i = 0; i < cantidad; i++) {
            const secuencia = (start + i).toString().padStart(4, "0");
            codigos.push(`CTE${fecha}${servicio}${agencia}${secuencia}`);
         }

         return codigos;
      },
      { timeout: 10000 }
   ); // Timeout mas corto

   return result;
}

// 🚀 OPTIMIZACIÓN 4: Endpoint principal optimizado
router.post("/", async (req, res) => {
   try {
      // Validacion rapida
      const { agency_id, user_id, customer_id, receiver_id, service_id, items, total_in_cents } =
         newInvoiceSchema.parse(req.body);

      /* 	//search rate for each item (get unique rate_ids to avoid duplicate queries)
		const uniqueRateIds = [...new Set(items.map((item: any) => item.rate_id))];
		const rates = await prisma.shippingRate.findMany({
			select: { id: true, cost_in_cents: true, rate_type: true, is_base_rate: true },
			where: {
				id: { in: uniqueRateIds },
			},
		});

		//map rates to items
		const items_with_rates = items.map((item: any) => {
			const rate = rates.find((rate: any) => rate.id === item.rate_id);
			return { ...item, rate };
		}); */

      // 🚀 Usar total del frontend si existe, sino calcular rapido
      const finalTotal = total_in_cents || calculate_subtotal(items);

      // 🚀 Generacion HBL optimizada
      const totalItems = items.length; // Cada item = 1 HBL (simplificado)
      const allHblCodes = await generateHBLFast(agency_id, service_id, totalItems);

      // 🚀 Mapeo optimizado (sin .flat(), sin reduce)
      const items_hbl: any[] = [];
      for (let i = 0; i < items.length; i++) {
         const item = items[i];
         items_hbl.push({
            hbl: allHblCodes[i],
            description: item.description,
            base_rate_in_cents: item.rate_in_cents || 0,
            rate_in_cents: item.rate_in_cents || 0,
            cost_in_cents: item.cost_in_cents,
            charge_fee_in_cents: item.charge_fee_in_cents || 0,
            delivery_fee_in_cents: item.delivery_fee_in_cents || 0,
            rate_id: item.rate_id,
            insurance_fee_in_cents: item.insurance_fee_in_cents || 0,
            customs_fee_in_cents: item.customs_fee_in_cents || 0,
            quantity: 1,
            weight: item.weight,
            service_id,
            agency_id,
         });
      }

      // 🚀 Transaccion optimizada (sin timeout largo)
      const transaction = await prisma.$transaction(
         async (tx) => {
            const invoice = await tx.invoice.create({
               data: {
                  user_id,
                  agency_id,
                  customer_id,
                  receiver_id,
                  service_id,
                  status: InvoiceStatus.CREATED,
                  payment_status: PaymentStatus.PENDING,
                  total_in_cents: finalTotal,
                  items: {
                     create: items_hbl,
                  },
               },
               include: {
                  items: {
                     orderBy: { hbl: "asc" },
                  },
               },
            });

            await tx.invoiceHistory.create({
               data: {
                  invoice_id: invoice.id,
                  user_id,
                  status: InvoiceStatus.CREATED,
                  type: InvoiceEventType.PUBLIC,
                  changed_fields: {
                     status: {
                        field: "status",
                        from: InvoiceStatus.DRAFT,
                        to: InvoiceStatus.CREATED,
                     },
                  },
                  comment: "Invoice created",
               },
               include: {
                  invoice: true,
               },
            });

            return invoice;
         },
         { timeout: 15000 }
      ); // Timeout reducido

      // 🚀 Receiver connection FUERA de la transaccion (async)
      receivers_db
         .connect(receiver_id, customer_id)
         .catch((err) => console.error("Receiver connection failed (non-critical):", err));
      res.status(200).json(transaction);
   } catch (error: any) {
      console.error("Fast invoice creation error:", error);

      if (error instanceof z.ZodError) {
         return res.status(400).json({
            message: "Validation failed",
            errors: error.issues.map((issue) => ({
               path: issue.path.join("."),
               message: issue.message,
            })),
         });
      }

      res.status(500).json({
         message: "Error creating invoice",
         error: error.message || error,
      });
   }
});

router.get("/:id", authMiddleware, async (req: any, res) => {
   const { id } = req.params;
   const rows = await prisma.invoice.findUnique({
      where: { id: parseInt(id) },
      include: {
         customer: true,
         receiver: true,
         agency: {
            select: {
               name: true,
               address: true,
               phone: true,
               email: true,

               logo: true,
            },
         },

         service: {
            select: {
               id: true,
               name: true,
               service_type: true,
               provider: {
                  select: {
                     name: true,
                  },
               },
            },
         },

         items: {
            include: {
               rate: {
                  select: {
                     rate_type: true,
                  },
               },
               customs_rates: true,
            },
         },
         user: {
            select: { name: true },
         },
      },
   });
   res.status(200).json({ rows: rows ? [rows] : [], total: rows ? 1 : 0 });
});

router.get("/:id/history", authMiddleware, async (req, res) => {
   const { id } = req.params;
   if (!id)
      res.status(401).send({
         message: "The id is required",
      });
   const history = await prisma.invoiceHistory.findMany({
      select: {
         id: true,
         invoice_id: true,
         user_id: true,
         status: true,
         type: true,
         comment: true,
         created_at: true,
         user: {
            select: { name: true, email: true },
         },
      },

      where: {
         invoice_id: parseInt(id),
      },
      orderBy: {
         created_at: "desc",
      },
   });

   res.status(200).json(history);
});
router.delete("/:id", async (req, res) => {
   const { id } = req.params;
   const invoice = await prisma.invoice.delete({
      where: { id: parseInt(id) },
   });
   res.status(200).json(invoice);
});

router.put("/:id", async (req, res) => {
   const { id } = req.params;

   // Validate request body using schema
   try {
      const { user_id, agency_id, customer_id, receiver_id, service_id, items } = updateInvoiceSchema.parse(req.body);

      console.log(items, "items");

      // Generate new HBL codes for items that might be created
      const newItemsCount = items.filter((item: any) => !item.hbl).length;
      const newHblCodes = newItemsCount > 0 ? await generateHBLFast(agency_id, service_id, newItemsCount) : [];
      let hblIndex = 0;

      // Get base rate for items that don't have rate_id
      const baseRate = await prisma.shippingRate.findFirst({
         select: { id: true },
         where: {
            agency_id: agency_id,
            service_id: service_id,
            is_base_rate: true,
            is_active: true,
         },
      });

      if (!baseRate) {
         return res.status(400).json({
            error: "No base rate found for this agency and service combination",
         });
      }

      const extendedPrisma = prisma.$extends(createInvoiceHistoryExtension(user_id, prisma));

      // Get current invoice with payment information
      const currentInvoice = await prisma.invoice.findUnique({
         where: { id: parseInt(id) },
         select: {
            customer_id: true,
            receiver_id: true,
            total_in_cents: true,
            paid_in_cents: true,
            payment_status: true,
		    status:true,
            items: { select: { hbl: true } },
         },
      });

      if (!currentInvoice) {
         return res.status(404).json({ error: "Invoice not found" });
      }

      // Get HBLs from the request (existing items with HBL and new items that will get HBL)
      const requestHbls = new Set(
         items.map((item: any) => item.hbl).filter((hbl: string) => hbl) // Only existing HBLs
      );

      // Find items to delete (current items not in the request)
      const itemsToDelete = currentInvoice.items.map((item) => item.hbl).filter((hbl) => !requestHbls.has(hbl));

      // Validate that we won't end up with zero items after the update
      const currentItemCount = currentInvoice.items.length;
      const itemsToDeleteCount = itemsToDelete.length;
      const existingItemsToKeep = items.filter((item: any) => item.hbl && requestHbls.has(item.hbl)).length;

      const finalItemCount = currentItemCount - itemsToDeleteCount + newItemsCount;

      if (finalItemCount === 0) {
         return res.status(400).json({
            error: "Validation Error",
            message: "Cannot update invoice to have zero items. Invoice must have at least one item.",
            details: {
               field: "items",
               constraint: "minimum 1 item required",
               currentItems: currentItemCount,
               itemsToDelete: itemsToDeleteCount,
               newItems: newItemsCount,
               finalCount: finalItemCount,
            },
         });
      }

      // Get rate information for proper calculation
      const uniqueRateIds = [...new Set(items.map((item: any) => item.rate_id || baseRate.id))] as number[];
      const rates = await prisma.shippingRate.findMany({
         select: { id: true, rate_type: true },
         where: {
            id: { in: uniqueRateIds },
         },
      });

      // Map rate_type to items for proper calculation
      const itemsWithRateType = items.map((item: any) => {
         const rateId = item.rate_id || baseRate.id;
         const rate = rates.find((r: any) => r.id === rateId);
         return {
            ...item,
            rate_type: rate?.rate_type || "WEIGHT", // Default to WEIGHT if not found
         };
      });

      // Calculate new total and determine payment status
      const newTotalInCents = calculate_subtotal(itemsWithRateType);
      const currentPaidInCents = currentInvoice.paid_in_cents;

      // Use utility function to calculate payment status and warnings
      const paymentResult = calculatePaymentStatus(currentPaidInCents, newTotalInCents);
      const newPaymentStatus = paymentResult.paymentStatus;
      const paymentWarnings = paymentResult.warnings;
	  

      // Check if sender (customer) or receiver changed
      const senderChanged = currentInvoice.customer_id !== customer_id;
      const receiverChanged = currentInvoice.receiver_id !== receiver_id;
      const totalChanged = currentInvoice.total_in_cents !== newTotalInCents;

      // Log changes for debugging/monitoring
      if (senderChanged) {
         console.log(`Invoice ${id}: Sender changed from ${currentInvoice.customer_id} to ${customer_id}`);
      }
      if (receiverChanged) {
         console.log(`Invoice ${id}: Receiver changed from ${currentInvoice.receiver_id} to ${receiver_id}`);
      }
      if (totalChanged) {
         console.log(
            `Invoice ${id}: Total changed from $${(currentInvoice.total_in_cents / 100).toFixed(2)} to $${(
               newTotalInCents / 100
            ).toFixed(2)}`
         );
         console.log(
            `Invoice ${id}: Payment status updated from ${currentInvoice.payment_status} to ${newPaymentStatus}`
         );
      }

      try {
         const invoice = await extendedPrisma.invoice.update({
            where: { id: parseInt(id) },
            data: {
               user_id: user_id,
               agency_id: agency_id,
               customer_id: customer_id,
               receiver_id: receiver_id,
               service_id: service_id,
               total_in_cents: newTotalInCents,
               payment_status: newPaymentStatus,
               items: {
                  // Delete items not present in the request
                  deleteMany:
                     itemsToDelete.length > 0
                        ? {
                             hbl: { in: itemsToDelete },
                          }
                        : undefined,
                  // Upsert items from the request
                  upsert: items.map((item: any) => ({
                     where: { hbl: item.hbl || "non-existent-hbl" },
                     update: {
                        ...item,
                        service_id,
                        agency_id,
                        rate_id: item.rate_id || baseRate.id, // Use base rate as fallback
                     },
                     create: {
                        ...item,
                        service_id,
                        agency_id,
                        hbl: item.hbl || newHblCodes[hblIndex++],
                        rate_id: item.rate_id || baseRate.id, // Use base rate as fallback
                     },
                  })),
               },
            },
            include: {
               items: true,
               service: {
                  select: {
                     id: true,
                     name: true,
                  },
               },
            },
         });

         // Include payment warnings in response if any exist
         const response: any = {
            ...invoice,
            payment_warnings: paymentWarnings.length > 0 ? paymentWarnings : undefined,
         };

         res.status(200).json(response);
      } catch (error: any) {
         console.error("Error updating invoice:", error);

         // Handle Prisma unique constraint violations
         if (error.code === "P2002" && error.meta?.target?.includes("hbl")) {
            return res.status(409).json({
               error: "HBL Conflict",
               message: "One or more HBL codes are already in use. Each HBL must be unique across all items.",
               details: {
                  field: "hbl",
                  duplicateValues: error.meta?.target || ["hbl"],
                  suggestion:
                     "Please check the HBL codes and ensure they are unique, or remove the HBL to auto-generate a new one.",
               },
            });
         }

         // Handle other Prisma unique constraint violations
         if (error.code === "P2002") {
            const field = error.meta?.target?.[0] || "unknown field";
            return res.status(409).json({
               error: "Unique Constraint Violation",
               message: `The value for ${field} already exists and must be unique.`,
               details: {
                  field: field,
                  constraintName: error.meta?.target,
               },
            });
         }

         // Handle other Prisma errors
         if (error.name === "PrismaClientKnownRequestError") {
            return res.status(400).json({
               error: "Database Operation Failed",
               message: "Unable to update invoice due to data constraints.",
               details: {
                  code: error.code,
                  message: error.message,
               },
            });
         }

         // Handle generic errors
         return res.status(500).json({
            error: "Internal Server Error",
            message: "An unexpected error occurred while updating the invoice.",
         });
      }
   } catch (validationError: any) {
      // Handle Zod validation errors
      if (validationError instanceof z.ZodError) {
         return res.status(400).json({
            error: "Validation Error",
            message: "Invalid request data",
            details: validationError.issues.map((issue) => ({
               path: issue.path.join("."),
               message: issue.message,
               code: issue.code,
            })),
         });
      }

      // Handle other validation errors
      return res.status(500).json({
         error: "Internal Server Error",
         message: "An unexpected error occurred while validating the request.",
      });
   }
});

// Get invoice change history - useful for checking sender/receiver changes
router.get("/:id/history", async (req, res) => {
   const { id } = req.params;

   try {
      const history = await prisma.invoiceHistory.findMany({
         where: { invoice_id: parseInt(id) },
         include: {
            user: {
               select: {
                  name: true,
                  email: true,
               },
            },
         },
         orderBy: { created_at: "desc" },
      });

      // Parse and format the history for easier consumption
      const formattedHistory = history.map((record) => {
         const changes = record.changed_fields as any;

         // Check if sender (customer) changed
         const senderChanged = changes.customer_id
            ? {
                 from: changes.customer_id.from,
                 to: changes.customer_id.to,
              }
            : null;

         // Check if receiver changed
         const receiverChanged = changes.receiver_id
            ? {
                 from: changes.receiver_id.from,
                 to: changes.receiver_id.to,
              }
            : null;

         return {
            id: record.id,
            timestamp: record.created_at,
            user: record.user,
            comment: record.comment,
            senderChanged,
            receiverChanged,
            allChanges: changes,
         };
      });

      res.status(200).json(formattedHistory);
   } catch (error) {
      console.error("Error fetching invoice history:", error);
      res.status(500).json({ error: "Failed to fetch invoice history" });
   }
});

// Generate PDF endpoint
router.get("/:id/pdf", async (req, res) => {
   try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError("Invalid invoice ID", 400);
      }

      // Fetch invoice with all required relations
      const invoice = await prisma.invoice.findUnique({
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
            items: {
               include: {
                  rate: {
                     select: {
                        rate_type: true,
                     },
                  },
               },
               orderBy: { hbl: "asc" },
            },
         },
      });

      if (!invoice) {
         throw new AppError("Invoice not found", 404);
      }

      // Convert Decimal fields to numbers for PDF generation
      const invoiceForPDF = {
         ...invoice,
      };

      // Generate PDF
      const doc = await generateInvoicePDF(invoiceForPDF);

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

router.get("/:id/labels/", async (req, res) => {
   try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError("Invalid invoice ID", 400);
      }

      // Fetch invoice with all required relations
      const invoice = await prisma.invoice.findUnique({
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

// Bulk labels endpoint - POST method for better handling of multiple IDs
router.post("/labels/bulk", async (req: Request, res: Response) => {
   try {
      const { invoiceIds } = bulkLabelsSchema.parse(req.body);

      // invoiceIds are already validated and converted to numbers by the schema
      const ids = invoiceIds;

      // Fetch all invoices with required relations
      const invoices = await prisma.invoice.findMany({
         where: {
            id: {
               in: ids,
            },
         },
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

      if (invoices.length === 0) {
         throw new AppError("No invoices found", 404);
      }

      // Check if any invoices have no items
      const invoicesWithoutItems = invoices.filter((invoice) => !invoice.items || invoice.items.length === 0);
      if (invoicesWithoutItems.length > 0) {
         throw new AppError(
            `Some invoices have no items: ${invoicesWithoutItems.map((inv) => inv.id).join(", ")}`,
            400
         );
      }

      // Use the bulk function that reuses the same internal logic as generateCTEnviosLabels
      const doc = await generateBulkCTEnviosLabels(invoices);

      // Set response headers for PDF
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="bulk-ctenvios-labels-${Date.now()}.pdf"`);

      // Pipe the PDF to response
      doc.pipe(res);
      doc.end();
   } catch (error) {
      console.error("Bulk label generation error:", error);

      // Handle Zod validation errors specifically
      if (error instanceof z.ZodError) {
         return res.status(400).json({
            message: "Validation failed",
            errors: error.issues.map((issue) => ({
               path: issue.path.join("."),
               message: issue.message,
               code: issue.code,
            })),
         });
      }

      if (error instanceof AppError) {
         res.status(error.statusCode).json({
            status: "error",
            message: error.message,
         });
      } else {
         res.status(500).json({
            status: "error",
            message: "Error generating bulk labels",
            error: process.env.NODE_ENV === "development" ? error : undefined,
         });
      }
   }
});
export default router;
