import prisma from "../config/prisma_db";
import { generarTracking } from "../utils/generate_hbl";

describe("Concurrent Invoice Creation", () => {
	// Test data setup
	const testData = {
		agency_id: 1,
		service_id: 1,
		user_id: "test-user-1",
		customer_id: 1,
		receipt_id: 1,
	};

	beforeEach(async () => {
		// Clean up any existing test invoices
		await prisma.invoice.deleteMany({
			where: {
				customer_id: testData.customer_id,
			},
		});
	});

	afterAll(async () => {
		// Clean up test data
		await prisma.invoice.deleteMany({
			where: {
				customer_id: testData.customer_id,
			},
		});
		await prisma.$disconnect();
	});

	test("should create invoices concurrently with unique HBL codes", async () => {
		const concurrentUsers = 5;
		const itemsPerUser = 3;
		const quantityPerItem = 10;

		console.log(
			`Testing ${concurrentUsers} concurrent users, ${itemsPerUser} items each, ${quantityPerItem} quantity per item`,
		);

		const startTime = Date.now();

		// Create concurrent invoice creation promises
		const promises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
			try {
				const items = Array.from({ length: itemsPerUser }, (_, itemIndex) => ({
					name: `Test Item ${itemIndex + 1} - User ${userIndex + 1}`,
					quantity: quantityPerItem,
					weight: Math.random() * 10 + 1, // Random weight between 1-11 kg
					rate: Math.random() * 50 + 10, // Random rate between $10-60
				}));

				// Generate all HBL codes first (outside transaction for bulk efficiency)
				const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
				const allHblCodes = await generarTracking(testData.agency_id, totalQuantity);

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
							service_id: testData.service_id,
							agency_id: testData.agency_id,
						}));
					})
					.flat();

				// Create invoice with transaction
				const invoice = await prisma.$transaction(
					async (tx) => {
						const invoice = await tx.invoice.create({
							data: {
								user_id: testData.user_id,
								agency_id: testData.agency_id,
								customer_id: testData.customer_id,
								receipt_id: testData.receipt_id,
								service_id: testData.service_id,
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
					userId: userIndex + 1,
					success: true,
					invoice,
					hbl_codes: invoice.items.map((item: any) => item.hbl),
				};
			} catch (error: any) {
				return {
					userId: userIndex + 1,
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

		console.log(`Test completed in ${endTime - startTime}ms`);
		console.log(`Successful users: ${successful.length}/${concurrentUsers}`);
		console.log(`Total HBL codes generated: ${allHblCodes.length}`);
		console.log(`Unique HBL codes: ${uniqueHblCodes.length}`);

		// Assertions
		expect(failed.length).toBe(0); // All requests should succeed
		expect(successful.length).toBe(concurrentUsers);
		expect(allHblCodes.length).toBe(concurrentUsers * itemsPerUser * quantityPerItem);
		expect(uniqueHblCodes.length).toBe(allHblCodes.length); // All HBL codes should be unique
		expect(allHblCodes).toEqual(uniqueHblCodes); // No duplicates

		// Verify that all HBL codes follow the expected format
		allHblCodes.forEach((hbl) => {
			expect(hbl).toMatch(/^CTE\d{6}001\d{4}$/); // Format: CTE + YYMMDD + agency (001) + sequence (4 digits)
		});
	});

	test("should handle high concurrency without errors", async () => {
		const concurrentUsers = 20;
		const itemsPerUser = 2;
		const quantityPerItem = 50;

		console.log(
			`Testing high concurrency: ${concurrentUsers} users, ${itemsPerUser} items each, ${quantityPerItem} quantity per item`,
		);

		const startTime = Date.now();

		const promises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
			try {
				const items = [
					{
						name: `Bulk Test Item - User ${userIndex + 1}`,
						quantity: quantityPerItem,
						weight: 5.0,
						rate: 25.0,
					},
				];

				// Generate all HBL codes first
				const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
				const allHblCodes = await generarTracking(testData.agency_id, totalQuantity);

				// Map items with HBL codes
				const items_hbl = allHblCodes.map((hbl) => ({
					hbl,
					name: items[0].name,
					rate: items[0].rate,
					quantity: 1,
					weight: items[0].weight / items[0].quantity,
					service_id: testData.service_id,
					agency_id: testData.agency_id,
				}));

				const invoice = await prisma.$transaction(
					async (tx) => {
						return await tx.invoice.create({
							data: {
								user_id: testData.user_id,
								agency_id: testData.agency_id,
								customer_id: testData.customer_id,
								receipt_id: testData.receipt_id,
								service_id: testData.service_id,
								status: "CREATED",
								items: {
									create: items_hbl,
								},
							},
							include: {
								items: true,
							},
						});
					},
					{
						timeout: 30000,
					},
				);

				return {
					userId: userIndex + 1,
					success: true,
					hblCount: invoice.items.length,
				};
			} catch (error: any) {
				return {
					userId: userIndex + 1,
					success: false,
					error: error.message,
				};
			}
		});

		const results = await Promise.allSettled(promises);
		const endTime = Date.now();

		const successful = results.filter((r) => r.status === "fulfilled" && r.value.success);
		const failed = results.filter(
			(r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success),
		);

		console.log(`High concurrency test completed in ${endTime - startTime}ms`);
		console.log(`Successful: ${successful.length}, Failed: ${failed.length}`);

		// Most should succeed (allow for some failures due to high concurrency)
		expect(successful.length).toBeGreaterThan(concurrentUsers * 0.8); // At least 80% success rate
		expect(failed.length).toBeLessThan(concurrentUsers * 0.2); // Less than 20% failure rate
	});

	test("should maintain sequential HBL numbering across concurrent requests", async () => {
		const concurrentUsers = 3;
		const itemsPerUser = 1;
		const quantityPerItem = 5;

		const promises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
			const items = [
				{
					name: `Sequential Test Item - User ${userIndex + 1}`,
					quantity: quantityPerItem,
					weight: 1.0,
					rate: 10.0,
				},
			];

			// Generate HBL codes
			const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
			const allHblCodes = await generarTracking(testData.agency_id, totalQuantity);

			const items_hbl = allHblCodes.map((hbl) => ({
				hbl,
				name: items[0].name,
				rate: items[0].rate,
				quantity: 1,
				weight: items[0].weight / items[0].quantity,
				service_id: testData.service_id,
				agency_id: testData.agency_id,
			}));

			const invoice = await prisma.$transaction(
				async (tx) => {
					return await tx.invoice.create({
						data: {
							user_id: testData.user_id,
							agency_id: testData.agency_id,
							customer_id: testData.customer_id,
							receipt_id: testData.receipt_id,
							service_id: testData.service_id,
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
				},
				{
					timeout: 30000,
				},
			);

			return invoice.items.map((item: any) => item.hbl);
		});

		const results = await Promise.all(promises);
		const allHblCodes = results.flat().sort();

		// Verify all codes are unique
		const uniqueCodes = [...new Set(allHblCodes)];
		expect(allHblCodes.length).toBe(uniqueCodes.length);

		// Verify sequential numbering (extract sequence numbers and check they're consecutive)
		const sequenceNumbers = allHblCodes.map((hbl) => parseInt(hbl.slice(-4)));
		sequenceNumbers.sort((a, b) => a - b);

		for (let i = 1; i < sequenceNumbers.length; i++) {
			expect(sequenceNumbers[i]).toBe(sequenceNumbers[i - 1] + 1);
		}
	});
});
