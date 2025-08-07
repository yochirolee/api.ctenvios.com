import prisma from "../config/prisma_db";
import { generarTracking } from "../utils/generate_hbl";

describe("Concurrent Invoice Creation with Real Data", () => {
	// Test data based on your actual invoice structure
	const baseInvoiceData = {
		customer_id: 3042,
		receiver_id: 31558,
		agency_id: 1,
		user_id: "BhKFci6yZKkvChJgE4MnpF43geCmr8Ho",
		service_id: 1,
		items: [
			{
				description: "Plancha Electrica",
				weight: 90,
				customs_fee: 0.3,
				delivery_fee: 0,
				insurance_fee: 0,
				rate: 1.99,
				subtotal: 179.4,
			},
			{
				description: "Alimento/Aseo/Medicinas",
				weight: 9,
				customs_fee: 1,
				delivery_fee: 0,
				insurance_fee: 0,
				rate: 1.99,
				subtotal: 18.91,
			},
			{
				description: "Alimento/Aseo/Medicinas",
				weight: 8,
				customs_fee: 1,
				delivery_fee: 0,
				insurance_fee: 0,
				rate: 1.99,
				subtotal: 16.92,
			},
		],
		total_amount: 215.23,
		total_weight: 107,
		payment_status: false,
	};

	beforeEach(async () => {
		// Clean up any existing test invoices
		await prisma.item.deleteMany({
			where: {
				invoice: {
					customer_id: baseInvoiceData.customer_id,
				},
			},
		});
		await prisma.invoice.deleteMany({
			where: {
				customer_id: baseInvoiceData.customer_id,
			},
		});
	});

	afterAll(async () => {
		// Clean up test data
		await prisma.item.deleteMany({
			where: {
				invoice: {
					customer_id: baseInvoiceData.customer_id,
				},
			},
		});
		await prisma.invoice.deleteMany({
			where: {
				customer_id: baseInvoiceData.customer_id,
			},
		});
		await prisma.$disconnect();
	});

	test("should create multiple invoices concurrently with unique HBL codes", async () => {
		const concurrentInvoices = 10; // Number of simultaneous invoice creations
		const expectedTotalItems = concurrentInvoices * baseInvoiceData.items.length;

		console.log(`Testing ${concurrentInvoices} concurrent invoice creations`);
		console.log(`Expected total items: ${expectedTotalItems}`);

		const startTime = Date.now();

		// Create concurrent invoice creation promises
		const promises = Array.from({ length: concurrentInvoices }, async (_, invoiceIndex) => {
			try {
				// Modify customer_id slightly to avoid conflicts but keep similar structure
				const invoiceData = {
					...baseInvoiceData,
					customer_id: baseInvoiceData.customer_id + invoiceIndex,
				};

				// Generate HBL codes for all items (each item gets 1 HBL)
				const totalQuantity = invoiceData.items.length;
				const allHblCodes = await generarTracking(
					invoiceData.agency_id,
					invoiceData.service_id,
					totalQuantity,
				);

				// Map items with their respective HBL codes
				const items_hbl = invoiceData.items.map((item, itemIndex) => ({
					hbl: allHblCodes[itemIndex],
					description: item.description,
					rate: Math.round(item.rate * 100), // Convert to cents
					customs_fee: item.customs_fee,
					delivery_fee: item.delivery_fee,
					insurance_fee: item.insurance_fee,
					quantity: 1,
					weight: item.weight,
					service_id: invoiceData.service_id,
					agency_id: invoiceData.agency_id,
				}));

				console.log(`Invoice ${invoiceIndex + 1} HBL codes:`, allHblCodes);

				// Create invoice with transaction (simulating the actual invoice creation)
				const invoice = await prisma.$transaction(
					async (tx) => {
						const createdInvoice = await tx.invoice.create({
							data: {
								user_id: invoiceData.user_id,
								agency_id: invoiceData.agency_id,
								customer_id: invoiceData.customer_id,
								receiver_id: invoiceData.receiver_id,
								service_id: invoiceData.service_id,
								total_amount: Math.round(invoiceData.total_amount * 100), // Convert to cents
								rate: 0,
								status: "CREATED",
								items: {
									create: items_hbl,
								},
							},
							include: {
								items: {
									select: {
										hbl: true,
										description: true,
									},
									orderBy: { hbl: "asc" },
								},
							},
						});

						return createdInvoice;
					},
					{
						timeout: 30000,
					},
				);

				return {
					invoiceIndex: invoiceIndex + 1,
					success: true,
					invoiceId: invoice.id,
					hbl_codes: invoice.items.map((item) => item.hbl),
					itemCount: invoice.items.length,
				};
			} catch (error: any) {
				console.error(`Invoice ${invoiceIndex + 1} failed:`, error.message);
				return {
					invoiceIndex: invoiceIndex + 1,
					success: false,
					error: error.message,
				};
			}
		});

		const results = await Promise.all(promises);
		const endTime = Date.now();

		// Analyze results
		const successful = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success);
		const allHblCodes = successful.flatMap((r) => r.hbl_codes || []);
		const uniqueHblCodes = [...new Set(allHblCodes)];

		console.log(`\n=== Test Results ===`);
		console.log(`Test completed in ${endTime - startTime}ms`);
		console.log(`Successful invoices: ${successful.length}/${concurrentInvoices}`);
		console.log(`Failed invoices: ${failed.length}`);
		console.log(`Total HBL codes generated: ${allHblCodes.length}`);
		console.log(`Unique HBL codes: ${uniqueHblCodes.length}`);

		if (failed.length > 0) {
			console.log(`\nFailure details:`);
			failed.forEach((f) => {
				console.log(`- Invoice ${f.invoiceIndex}: ${f.error}`);
			});
		}

		// Assertions
		expect(failed.length).toBe(0); // All requests should succeed
		expect(successful.length).toBe(concurrentInvoices);
		expect(allHblCodes.length).toBe(expectedTotalItems);
		expect(uniqueHblCodes.length).toBe(allHblCodes.length); // All HBL codes should be unique

		// Verify that all HBL codes follow the expected format
		allHblCodes.forEach((hbl) => {
			expect(hbl).toMatch(/^CTE\d{6}1\d{2}\d{4}$/); // Format: CTE + YYMMDD + service(1) + agency + sequence
		});

		// Verify no duplicate HBL codes exist in database
		const dbHblCodes = await prisma.item.findMany({
			where: {
				hbl: {
					in: allHblCodes,
				},
			},
			select: {
				hbl: true,
			},
		});

		expect(dbHblCodes.length).toBe(allHblCodes.length);
		const dbHblSet = new Set(dbHblCodes.map((item) => item.hbl));
		expect(dbHblSet.size).toBe(allHblCodes.length);
	});

	test("should handle high concurrency stress test", async () => {
		const concurrentInvoices = 25;
		const startTime = Date.now();

		console.log(`\n=== High Concurrency Stress Test ===`);
		console.log(`Testing ${concurrentInvoices} concurrent invoice creations`);

		const promises = Array.from({ length: concurrentInvoices }, async (_, invoiceIndex) => {
			try {
				const invoiceData = {
					...baseInvoiceData,
					customer_id: baseInvoiceData.customer_id + invoiceIndex + 1000, // Ensure unique customer IDs
				};

				// Generate HBL codes
				const totalQuantity = invoiceData.items.length;
				const allHblCodes = await generarTracking(
					invoiceData.agency_id,
					invoiceData.service_id,
					totalQuantity,
				);

				// Simulate the actual invoice creation process
				const items_hbl = invoiceData.items.map((item, itemIndex) => ({
					hbl: allHblCodes[itemIndex],
					description: item.description,
					rate: Math.round(item.rate * 100),
					customs_fee: item.customs_fee,
					delivery_fee: item.delivery_fee,
					insurance_fee: item.insurance_fee,
					quantity: 1,
					weight: item.weight,
					service_id: invoiceData.service_id,
					agency_id: invoiceData.agency_id,
				}));

				const invoice = await prisma.$transaction(
					async (tx) => {
						return await tx.invoice.create({
							data: {
								user_id: invoiceData.user_id,
								agency_id: invoiceData.agency_id,
								customer_id: invoiceData.customer_id,
								receiver_id: invoiceData.receiver_id,
								service_id: invoiceData.service_id,
								total_amount: Math.round(invoiceData.total_amount * 100),
								rate: 0,
								status: "CREATED",
								items: {
									create: items_hbl,
								},
							},
							include: {
								items: {
									select: { hbl: true },
								},
							},
						});
					},
					{
						timeout: 45000, // Longer timeout for stress test
					},
				);

				return {
					success: true,
					hblCodes: invoice.items.map((item) => item.hbl),
				};
			} catch (error: any) {
				return {
					success: false,
					error: error.message,
				};
			}
		});

		const results = await Promise.allSettled(promises);
		const endTime = Date.now();

		const successful = results.filter(
			(r): r is PromiseFulfilledResult<{ success: true; hblCodes: string[] }> =>
				r.status === "fulfilled" && r.value.success,
		);

		const failed = results.filter(
			(r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success),
		);

		const allHblCodes = successful.flatMap((r) => r.value.hblCodes);
		const uniqueHblCodes = [...new Set(allHblCodes)];

		console.log(`Stress test completed in ${endTime - startTime}ms`);
		console.log(`Successful: ${successful.length}/${concurrentInvoices}`);
		console.log(`Failed: ${failed.length}`);
		console.log(`Total HBL codes: ${allHblCodes.length}`);
		console.log(`Unique HBL codes: ${uniqueHblCodes.length}`);

		// Allow for some failures under extreme stress, but most should succeed
		expect(successful.length).toBeGreaterThan(concurrentInvoices * 0.8); // At least 80% success rate
		expect(uniqueHblCodes.length).toBe(allHblCodes.length); // All successful HBLs should be unique
	});

	test("should maintain HBL sequence integrity across concurrent operations", async () => {
		const concurrentInvoices = 5;
		const itemsPerInvoice = 2; // Reduced for easier sequence tracking

		console.log(`\n=== HBL Sequence Integrity Test ===`);

		const promises = Array.from({ length: concurrentInvoices }, async (_, invoiceIndex) => {
			const invoiceData = {
				...baseInvoiceData,
				customer_id: baseInvoiceData.customer_id + invoiceIndex + 2000,
				items: baseInvoiceData.items.slice(0, itemsPerInvoice), // Take only first N items
			};

			const totalQuantity = invoiceData.items.length;
			const allHblCodes = await generarTracking(
				invoiceData.agency_id,
				invoiceData.service_id,
				totalQuantity,
			);

			const items_hbl = invoiceData.items.map((item, itemIndex) => ({
				hbl: allHblCodes[itemIndex],
				description: item.description,
				rate: Math.round(item.rate * 100),
				customs_fee: item.customs_fee,
				delivery_fee: item.delivery_fee,
				insurance_fee: item.insurance_fee,
				quantity: 1,
				weight: item.weight,
				service_id: invoiceData.service_id,
				agency_id: invoiceData.agency_id,
			}));

			await prisma.$transaction(async (tx) => {
				await tx.invoice.create({
					data: {
						user_id: invoiceData.user_id,
						agency_id: invoiceData.agency_id,
						customer_id: invoiceData.customer_id,
						receiver_id: invoiceData.receiver_id,
						service_id: invoiceData.service_id,
						total_amount: Math.round(invoiceData.total_amount * 100),
						rate: 0,
						status: "CREATED",
						items: {
							create: items_hbl,
						},
					},
				});
			});

			return allHblCodes;
		});

		const results = await Promise.all(promises);
		const allHblCodes = results.flat().sort();

		console.log(`Generated HBL codes:`, allHblCodes);

		// Verify all codes are unique
		const uniqueCodes = [...new Set(allHblCodes)];
		expect(allHblCodes.length).toBe(uniqueCodes.length);

		// Verify sequential numbering (extract sequence numbers)
		const sequenceNumbers = allHblCodes.map((hbl) => parseInt(hbl.slice(-4)));
		sequenceNumbers.sort((a, b) => a - b);

		console.log(`Sequence numbers:`, sequenceNumbers);

		// Verify sequences are consecutive (no gaps)
		for (let i = 1; i < sequenceNumbers.length; i++) {
			expect(sequenceNumbers[i]).toBe(sequenceNumbers[i - 1] + 1);
		}
	});
});
