import { Router } from "express";
import { generarTracking } from "../utils/generate_hbl";
import prisma from "../config/prisma_db";

const router = Router();

interface ConcurrentTestRequest {
	agency_id: number;
	concurrent_users: number;
	codes_per_user: number;
}

interface ConcurrentInvoiceTestRequest {
	agency_id: number;
	service_id: number;
	user_id: number;
	customer_id: number;
	receipt_id: number;
	concurrent_users: number;
	items_per_user: number;
	quantity_per_item: number;
}

interface InvoiceTestResult {
	userId: number;
	success: boolean;
	invoice?: any;
	hbl_codes?: string[];
	error?: string;
}

interface TrackingTestResult {
	userId: number;
	success: boolean;
	codes?: string[];
	error?: string;
}

router.post("/concurrent-invoices", async (req, res) => {
	try {
		const {
			agency_id,
			service_id,
			user_id,
			customer_id,
			receipt_id,
			concurrent_users = 10,
			items_per_user = 5,
			quantity_per_item = 100,
		}: ConcurrentInvoiceTestRequest = req.body;

		// Validate required fields
		if (!agency_id || !service_id || !user_id || !customer_id || !receipt_id) {
			return res.status(400).json({
				error: "Missing required fields: agency_id, service_id, user_id, customer_id, receipt_id",
			});
		}

		console.log(
			`Starting concurrent invoice test: ${concurrent_users} users, ${items_per_user} items each, ${quantity_per_item} quantity per item`,
		);

		const startTime = Date.now();

		// Create concurrent invoice creation promises using direct database calls
		const promises = Array.from(
			{ length: concurrent_users },
			async (_, index): Promise<InvoiceTestResult> => {
				try {
					const items = Array.from({ length: items_per_user }, (_, itemIndex) => ({
						name: `Test Item ${itemIndex + 1} - User ${index + 1}`,
						quantity: quantity_per_item,
						weight: Math.random() * 10 + 1, // Random weight between 1-11 kg
						rate: Math.random() * 50 + 10, // Random rate between $10-60
					}));

					// Generate all HBL codes first (outside transaction for bulk efficiency)
					const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
					const allHblCodes = await generarTracking(agency_id, totalQuantity);

					// Map items with their respective HBL codes
					let hblIndex = 0;
					const items_hbl = items
						.map((item) => {
							const quantity = item.quantity;
							const itemHbls = allHblCodes.slice(hblIndex, hblIndex + quantity);
							hblIndex += quantity;

							return itemHbls.map((hbl) => ({
								hbl,
								name: item.name,
								rate: item.rate,
								quantity: 1, // Each HBL represents 1 unit
								weight: item.weight / quantity, // Distribute weight evenly
								service_id,
								agency_id: agency_id,
							}));
						})
						.flat();

					// Create invoice with transaction
					const invoice = await prisma.$transaction(
						async (tx) => {
							const invoice = await tx.invoice.create({
								data: {
									user_id,
									agency_id,
									customer_id,
									receipt_id,
									service_id,
									status: "CREATED",
									items: {
										create: items_hbl,
									},
								},
								include: {
									items: {
										select: {
											hbl: true,
										},
										orderBy: {
											hbl: "asc",
										},
									},
								},
							});
							return invoice;
						},
						{
							timeout: 30000,
						},
					);

					return {
						userId: index + 1,
						success: true,
						invoice,
						hbl_codes: invoice.items.map((item: any) => item.hbl),
					};
				} catch (error: any) {
					return {
						userId: index + 1,
						success: false,
						error: error.message,
					};
				}
			},
		);

		const results = await Promise.all(promises);
		const endTime = Date.now();

		// Analyze results
		const successful = results.filter((r): r is InvoiceTestResult & { success: true } => r.success);
		const failed = results.filter((r): r is InvoiceTestResult & { success: false } => !r.success);
		const allHblCodes = successful.flatMap((r) => r.hbl_codes || []);
		const uniqueHblCodes = [...new Set(allHblCodes)];

		// Calculate expected totals
		const expectedHblCodes = concurrent_users * items_per_user * quantity_per_item;

		const response = {
			test_summary: {
				concurrent_users,
				items_per_user,
				quantity_per_item,
				execution_time_ms: endTime - startTime,
				successful_users: successful.length,
				failed_users: failed.length,
				success_rate: `${((successful.length / concurrent_users) * 100).toFixed(2)}%`,
			},
			hbl_analysis: {
				expected_hbl_codes: expectedHblCodes,
				total_hbl_codes_generated: allHblCodes.length,
				unique_hbl_codes: uniqueHblCodes.length,
				duplicates_found: allHblCodes.length !== uniqueHblCodes.length,
				duplicate_codes:
					allHblCodes.length !== uniqueHblCodes.length
						? allHblCodes.filter((code, index) => allHblCodes.indexOf(code) !== index)
						: [],
			},
			performance: {
				avg_response_time_ms: (endTime - startTime) / concurrent_users,
				hbl_codes_per_second: Math.round(allHblCodes.length / ((endTime - startTime) / 1000)),
				invoices_per_second: Math.round(successful.length / ((endTime - startTime) / 1000)),
			},
			failed_requests: failed.map((f) => ({
				userId: f.userId,
				error: f.error,
			})),
		};

		res.json(response);
	} catch (error) {
		console.error("Concurrent invoice test error:", error);
		res.status(500).json({ error: "Test execution failed", details: error });
	}
});

router.post("/concurrent-tracking", async (req, res) => {
	try {
		const {
			agency_id,
			concurrent_users = 150,
			codes_per_user = 1000,
		}: ConcurrentTestRequest = req.body;

		if (!agency_id) {
			return res.status(400).json({ error: "agency_id is required" });
		}

		console.log(
			`Starting concurrent test: ${concurrent_users} users, ${codes_per_user} codes each`,
		);

		const startTime = Date.now();

		// Create concurrent promises
		const promises = Array.from(
			{ length: concurrent_users },
			(_, index): Promise<TrackingTestResult> =>
				generarTracking(agency_id, codes_per_user)
					.then((codes) => ({ userId: index + 1, codes, success: true }))
					.catch((error) => ({ userId: index + 1, error: error.message, success: false })),
		);

		const results = await Promise.all(promises);
		const endTime = Date.now();

		// Analyze results
		const successful = results.filter(
			(r): r is TrackingTestResult & { success: true } => r.success,
		);
		const failed = results.filter((r): r is TrackingTestResult & { success: false } => !r.success);
		const allCodes = successful.flatMap((r) => r.codes || []);
		const uniqueCodes = [...new Set(allCodes)];

		const response = {
			test_summary: {
				total_users: concurrent_users,
				codes_per_user,
				execution_time_ms: endTime - startTime,
				successful_users: successful.length,
				failed_users: failed.length,
			},
			code_analysis: {
				total_codes_generated: allCodes.length,
				unique_codes: uniqueCodes.length,
				duplicates_found: allCodes.length !== uniqueCodes.length,
				duplicate_codes:
					allCodes.length !== uniqueCodes.length
						? allCodes.filter((code, index) => allCodes.indexOf(code) !== index)
						: [],
			},
			detailed_results: results,
		};

		res.json(response);
	} catch (error) {
		console.error("Concurrent test error:", error);
		res.status(500).json({ error: "Test execution failed" });
	}
});

export default router;
