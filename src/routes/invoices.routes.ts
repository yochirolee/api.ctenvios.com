import { Router, Request, Response } from "express";
import prisma from "../config/prisma_db";
import receivers_db from "../repository/receivers.repository";
import { generarTracking } from "../utils/generate_hbl";
import { generateInvoicePDF } from "../utils/generate-invoice-pdf";
import { PaymentMethod, PaymentStatus, Roles } from "@prisma/client";
// Removed unused imports for shipping labels
import {
	generateCTEnviosLabels,
	generateBulkCTEnviosLabels,
} from "../utils/generate-shipping-labels-ctenvios";
import { z } from "zod";
import AppError from "../utils/app.error";
import { invoiceHistoryMiddleware } from "../middlewares/invoice-middleware";
import { authMiddleware } from "../middlewares/auth-midleware";
import { buildInvoiceTimeline } from "../utils/build-invoice-timeline";

const invoiceItemSchema = z.object({
	description: z.string().min(1, "Description is required"),
	rate: z.number().min(1, "Rate is required"),
	weight: z.number().min(0, "Weight is required"),
	customs_fee: z.number().min(0, "Fees is required"),
	delivery_fee: z.number().optional(),
	insurance_fee: z.number().optional(),
	quantity: z.number().optional(),
});

const newInvoiceSchema = z.object({
	user_id: z.string().min(1, "User ID is required"),
	agency_id: z.number().min(1, "Agency ID is required"),
	customer_id: z.number().min(1, "Customer ID is required"),
	receiver_id: z.number().min(1, "Receiver ID is required"),
	service_id: z.number().min(1, "Service ID is required"),
	items: z.array(invoiceItemSchema),
	total_amount: z.number().min(1, "Total amount is required"),
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
			},
		)
		.min(1, "At least one invoice ID is required"),
});

const paymentSchema = z.object({
	amount: z.number().min(0, "Amount is required"),
	payment_method: z.nativeEnum(PaymentMethod),
	payment_reference: z.string().optional(),
	notes: z.string().optional(),
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
		const { page, limit, search, startDate, endDate } = req.query;

		const searchTerm = (search?.toString().trim() || "").toLowerCase();
		const words = searchTerm.split(/\s+/).filter(Boolean);
		const isNumeric = /^\d+$/.test(searchTerm);

		let dateFilter: any = {};
		if (startDate || endDate) {
			dateFilter.created_at = {};
			if (startDate) {
				const start = parseDateFlexible(startDate as string);
				if (start) dateFilter.created_at.gte = start;
				else return res.status(400).json({ message: "startDate inválida" });
			}
			if (endDate) {
				const end = parseDateFlexible(endDate as string);
				if (end) {
					end.setHours(23, 59, 59, 999);
					dateFilter.created_at.lte = end;
				} else return res.status(400).json({ message: "endDate inválida" });
			}
		}

		let whereClause: any = { ...dateFilter };
		let fallbackClause: any = null;

		if (searchTerm && isNumeric) {
			if (searchTerm.length <= 5) {
				whereClause.id = parseInt(searchTerm);
			} else if (searchTerm.length === 10) {
				whereClause.customer = {
					mobile: { contains: searchTerm, mode: "insensitive" },
				};
				fallbackClause = {
					...dateFilter,
					receiver: {
						mobile: { contains: searchTerm, mode: "insensitive" },
					},
				};
			} else if (searchTerm.length === 11) {
				whereClause.receiver = {
					ci: { contains: searchTerm, mode: "insensitive" },
				};
			} else {
				return res.status(400).json({ message: "Formato de búsqueda inválido" });
			}
		} else if (searchTerm) {
			const nameFilters = buildNameSearchFilter(words);
			whereClause.OR = [{ customer: nameFilters }, { receiver: nameFilters }];
		}

		// ⛔ Si NO es ROOT ni ADMINISTRATOR, filtrar por agencia
		const allowedRoles = [Roles.ROOT, Roles.ADMINISTRATOR];
		if (!allowedRoles.includes(user.role)) {
			whereClause.agency_id = user.agency_id;
			if (fallbackClause) {
				fallbackClause.agency_id = user.agency_id;
			}
		}

		let [count, rows] = await Promise.all([
			prisma.invoice.count({ where: whereClause }),
			prisma.invoice.findMany({
				include: {
					service: { select: { id: true, name: true } },
					agency: { select: { id: true, name: true } },
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
							ci: true,
						},
					},
					items: true,
					user: {
						select: {
							id: true,
							name: true,
						},
					},
					_count: { select: { items: true } },
				},
				where: whereClause,
				orderBy: { created_at: "desc" },
				take: limit ? parseInt(limit as string) : 25,
				skip: page ? (parseInt(page as string) - 1) * (limit ? parseInt(limit as string) : 25) : 0,
			}),
		]);

		if (rows.length === 0 && fallbackClause) {
			[count, rows] = await Promise.all([
				prisma.invoice.count({ where: fallbackClause }),
				prisma.invoice.findMany({
					include: {
						service: { select: { id: true, name: true } },
						agency: { select: { id: true, name: true } },
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
								ci: true,
							},
						},
						items: true,
						user: {
							select: {
								id: true,
								name: true,
							},
						},
						_count: { select: { items: true } },
					},
					where: fallbackClause,
					orderBy: { created_at: "desc" },
					take: limit ? parseInt(limit as string) : 25,
					skip: page
						? (parseInt(page as string) - 1) * (limit ? parseInt(limit as string) : 25)
						: 0,
				}),
			]);
		}

		res.status(200).json({ rows, total: count });
	} catch (error) {
		console.error("Search error:", error);
		res.status(500).json({ message: "Error searching invoices", error });
	}
});

router.post("/", async (req, res) => {
	try {
		console.log(req.body, "req.body");
		const { agency_id, user_id, customer_id, receiver_id, total_amount, service_id, items } =
			newInvoiceSchema.parse(req.body);

		// Generate all HBL codes first (outside transaction for bulk efficiency)
		const totalQuantity = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
		const allHblCodes = await generarTracking(agency_id, service_id, totalQuantity);

		// Map items with their respective HBL codes
		let hblIndex = 0;
		const items_hbl = items
			.map((item: any) => {
				const itemHbls = allHblCodes.slice(hblIndex, hblIndex + 1);
				hblIndex += 1;

				return itemHbls.map((hbl) => ({
					hbl,
					description: item.description,
					rate: Math.round(item.rate * 100),
					customs_fee: item.customs_fee || 0,
					delivery_fee: item.delivery_fee || 0,
					insurance_fee: item.insurance_fee || 0,
					quantity: item.quantity || 1,
					// Each HBL represents 1 unit
					weight: item.weight || 0, // Distribute weight evenly
					service_id,
					agency_id,
				}));
			})
			.flat();

		console.log(items_hbl, "items_hbl");

		const transaction = await prisma.$transaction(
			async (tx) => {
				const invoice = await tx.invoice.create({
					data: {
						user_id: user_id,
						agency_id: agency_id,
						customer_id: customer_id,
						receiver_id: receiver_id,
						service_id: service_id,
						total_amount: Math.round(Number(total_amount) * 100),
						rate: 0,
						status: "CREATED",
						items: {
							create: [...items_hbl],
						},
					},
					include: {
						items: {
							orderBy: { hbl: "asc" },
						},
					},
				});
				await receivers_db.connect(receiver_id, customer_id);
				return invoice;
			},
			{
				timeout: 30000, // Increased timeout to 30 seconds
			},
		);
		res.status(200).json(transaction);
	} catch (error) {
		console.log(error, "error");

		// Handle Zod validation errors specifically
		if (error instanceof z.ZodError) {
			console.log("Validation errors with paths:");
			error.issues.forEach((issue, index) => {
				console.log(`Error ${index + 1}:`);
				console.log(`  Path: ${issue.path.join(".")}`);
				console.log(`  Message: ${issue.message}`);
				console.log(`  Code: ${issue.code}`);

				// Only log expected/received for invalid_type errors
				if (issue.code === "invalid_type") {
					console.log(`  Expected: ${issue.expected}`);
					console.log(`  Received: ${issue.received}`);
				}
			});

			// Return structured validation error response
			return res.status(400).json({
				message: "Validation failed",
				errors: error.issues.map((issue) => ({
					path: issue.path.join("."),
					message: issue.message,
					code: issue.code,
					...(issue.code === "invalid_type"
						? {
								expected: issue.expected,
								received: issue.received,
						  }
						: {}),
				})),
			});
		}

		res.status(500).json({ message: "Error creating invoice", error: error });
	}
});

router.get("/:id", authMiddleware, async (req: any, res) => {
	const { id } = req.params;
	const user = req.user;
	console.log(user, "user");
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
			items: true,
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
	const invoice = await prisma.invoice.findFirst({
		where: {
			id: parseInt(id),
		},
		include: {
			payments: {
				orderBy: {
					created_at: "desc",
				},
			},
			invoice_history: {
				orderBy: {
					created_at: "desc",
				},
			},
		},
	});
	const timeline = buildInvoiceTimeline(invoice as any);
	res.status(200).json(timeline);
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
	const { user_id, agency_id, customer_id, receiver_id, service_id, total_amount, items } =
		req.body;

	// Generate new HBL codes for items that might be created
	const newItemsCount = items.filter((item: any) => !item.hbl).length;
	const newHblCodes = newItemsCount > 0 ? await generarTracking(agency_id, newItemsCount) : [];
	let hblIndex = 0;

	const extendedPrisma = prisma.$extends({
		query: {
			invoice: {
				async update({ args, query }) {
					return invoiceHistoryMiddleware(user_id, prisma)(
						{ model: "Invoice", action: "update", args } as any,
						async () => query(args),
					);
				},
			},
		},
	});
	const invoice = await extendedPrisma.invoice.update({
		where: { id: parseInt(id) },
		data: {
			user_id: user_id,
			agency_id: agency_id,
			customer_id: customer_id,
			receiver_id: receiver_id,
			service_id: service_id,
			total_amount: total_amount,
			items: {
				upsert: items.map((item: any) => ({
					where: { hbl: item.hbl || "non-existent-hbl" },
					update: { ...item, service_id, agency_id },
					create: {
						...item,
						service_id,
						agency_id,
						hbl: item.hbl || newHblCodes[hblIndex++],
					},
				})),
			},
		},
		include: {
			items: true,
		},
	});
	res.status(200).json(invoice);
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
			total: Number(invoice.total_amount),
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
		const invoicesWithoutItems = invoices.filter(
			(invoice) => !invoice.items || invoice.items.length === 0,
		);
		if (invoicesWithoutItems.length > 0) {
			throw new AppError(
				`Some invoices have no items: ${invoicesWithoutItems.map((inv) => inv.id).join(", ")}`,
				400,
			);
		}

		// Use the bulk function that reuses the same internal logic as generateCTEnviosLabels
		const doc = await generateBulkCTEnviosLabels(invoices);

		// Set response headers for PDF
		res.setHeader("Content-Type", "application/pdf");
		res.setHeader(
			"Content-Disposition",
			`inline; filename="bulk-ctenvios-labels-${Date.now()}.pdf"`,
		);

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
