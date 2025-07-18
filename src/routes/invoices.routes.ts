import { Router, Request, Response } from "express";
import prisma from "../config/prisma_db";
import receipts_db from "../repository/receipts.repository";
import { generarTracking } from "../utils/generate_hbl";
import { generateInvoicePDF } from "../utils/generate-invoice-pdf";
// Removed unused imports for shipping labels
import {
	generateCTEnviosLabels,
	generateBulkCTEnviosLabels,
} from "../utils/generate-shipping-labels-ctenvios";
import { z } from "zod";
import AppError from "../utils/app.error";
import { triggerAsyncId } from "async_hooks";
import { invoiceHistoryMiddleware } from "../middlewares/invoice-middleware";

const invoiceItemSchema = z.object({
	description: z.string().min(1, "Description is required"),
	rate: z.number().min(1, "Rate is required"),
	weight: z.number().min(0, "Weight is required"),
	fee: z.number().min(0, "Fees is required"),
});

const newInvoiceSchema = z.object({
	user_id: z.string().min(1, "User ID is required"),
	agency_id: z.number().min(1, "Agency ID is required"),
	customer_id: z.number().min(1, "Customer ID is required"),
	receipt_id: z.number().min(1, "Receipt ID is required"),
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

const router = Router();

// Simple test endpoint to check database connection
router.get("/test", async (req, res) => {
	try {
		const count = await prisma.invoice.count();
		const first5 = await prisma.invoice.findMany({
			take: 5,
			select: { id: true, agency_id: true, created_at: true },
		});
		res.json({
			totalInvoices: count,
			sampleInvoices: first5,
			message: "Database connection working",
		});
	} catch (error) {
		res.status(500).json({ error: "Database connection failed", details: error });
	}
});

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
			receipt: {
				select: {
					id: true,
					first_name: true,
					middle_name: true,
					last_name: true,
					second_last_name: true,
					mobile: true,
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

router.get("/agency/:agency_id", async (req, res) => {
	const { page, limit } = req.query;
	const { agency_id } = req.params;
	const total = await prisma.invoice.count({
		where: { agency_id: parseInt(agency_id as string) },
	});
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
			receipt: {
				select: {
					id: true,
					first_name: true,
					middle_name: true,
					last_name: true,
					second_last_name: true,
					mobile: true,
				},
			},
			_count: {
				select: {
					items: true,
				},
			},
		},
		where: { agency_id: parseInt(agency_id as string) },
		orderBy: {
			created_at: "desc",
		},
		take: limit ? parseInt(limit as string) : 25,
		skip: page ? (parseInt(page as string) - 1) * (limit ? parseInt(limit as string) : 25) : 0,
	});
	res.status(200).json({ rows, total });
});

router.get("/search", async (req, res) => {
	try {
		const { page, limit } = req.query;
		const { search } = req.query;
		const searchTerm = search?.toString().toLowerCase() || "";

		const rows = await prisma.invoice.findMany({
			include: {
				service: {
					select: { id: true, name: true },
				},
				agency: {
					select: { id: true, name: true },
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
				receipt: {
					select: {
						id: true,
						first_name: true,
						middle_name: true,
						last_name: true,
						second_last_name: true,
						mobile: true,
					},
				},
				_count: {
					select: {
						items: true,
					},
				},
			},
			where: {
				OR: [
					{
						customer: {
							OR: [
								{ first_name: { contains: searchTerm, mode: "insensitive" } },
								{ second_last_name: { contains: searchTerm, mode: "insensitive" } },
								{ middle_name: { contains: searchTerm, mode: "insensitive" } },
								{ last_name: { contains: searchTerm, mode: "insensitive" } },
								{ mobile: { contains: searchTerm, mode: "insensitive" } },
								{
									AND: [
										{
											OR: searchTerm.split(" ").map((term: string, index: number) => {
												if (index === 0) {
													return {
														OR: [
															{ first_name: { contains: term, mode: "insensitive" } },
															{ middle_name: { contains: term, mode: "insensitive" } },
														],
													};
												} else {
													return {
														OR: [
															{ middle_name: { contains: term, mode: "insensitive" } },
															{ last_name: { contains: term, mode: "insensitive" } },
															{ second_last_name: { contains: term, mode: "insensitive" } },
														],
													};
												}
											}),
										},
									],
								},
							],
						},
					},
					{
						receipt: {
							OR: [
								{ first_name: { contains: searchTerm, mode: "insensitive" } },
								{ second_last_name: { contains: searchTerm, mode: "insensitive" } },
								{ middle_name: { contains: searchTerm, mode: "insensitive" } },
								{ last_name: { contains: searchTerm, mode: "insensitive" } },
								{ mobile: { contains: searchTerm, mode: "insensitive" } },
							],
						},
					},
				],
			},
			orderBy: {
				created_at: "desc",
			},
			take: limit ? parseInt(limit as string) : 25,
			skip: page ? (parseInt(page as string) - 1) * (limit ? parseInt(limit as string) : 25) : 0,
		});

		res.status(200).json({ rows, total: rows.length });
	} catch (error) {
		console.error("Search error:", error);
		res.status(500).json({ message: "Error searching invoices", error });
	}
});

router.post("/", async (req, res) => {
	try {
		const { agency_id, user_id, customer_id, receipt_id, total_amount, service_id, items } =
			newInvoiceSchema.parse(req.body);

		// Generate all HBL codes first (outside transaction for bulk efficiency)
		console.log(req.body, "req.body");
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
					rate: item.rate,
					customs_fee: item.fee,

					// Each HBL represents 1 unit
					weight: item.weight || 0, // Distribute weight evenly
					service_id,
					agency_id,
				}));
			})
			.flat();

		const transaction = await prisma.$transaction(
			async (tx) => {
				const invoice = await tx.invoice.create({
					data: {
						user_id: user_id,
						agency_id: agency_id,
						customer_id: customer_id,
						receipt_id: receipt_id,
						service_id: service_id,
						total_amount: total_amount,
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
				await receipts_db.connect(receipt_id, customer_id);
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
router.get("/:id", async (req, res) => {
	const { id } = req.params;
	const rows = await prisma.invoice.findUnique({
		where: { id: parseInt(id) },
		include: {
			customer: true,
			receipt: true,
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
router.delete("/:id", async (req, res) => {
	const { id } = req.params;
	const invoice = await prisma.invoice.delete({
		where: { id: parseInt(id) },
	});
	res.status(200).json(invoice);
});

router.put("/:id", async (req, res) => {
	const { id } = req.params;
	const { user_id, agency_id, customer_id, receipt_id, service_id, total_amount, items } = req.body;

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
			receipt_id: receipt_id,
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
				receipt: {
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
			total: Number(invoice.total),
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
				receipt: {
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
				receipt: {
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
