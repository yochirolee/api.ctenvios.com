import prisma from "../config/prisma_db";
import { generarTracking } from "../utils/generate_hbl";

interface TestResult {
	invoiceIndex: number;
	success: boolean;
	hbl_codes?: string[];
	error?: string;
}

// Simple test function without Jest dependencies
async function testConcurrentHBLGeneration(): Promise<void> {
	console.log("🚀 Starting Concurrent HBL Generation Test...\n");

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

	const concurrentInvoices = 10;
	const expectedTotalItems = concurrentInvoices * baseInvoiceData.items.length;

	console.log(`Testing ${concurrentInvoices} concurrent invoice creations`);
	console.log(`Expected total items: ${expectedTotalItems}\n`);

	// Clean up any existing test data
	try {
		await prisma.item.deleteMany({
			where: {
				invoice: {
					customer_id: {
						gte: baseInvoiceData.customer_id,
						lte: baseInvoiceData.customer_id + concurrentInvoices,
					},
				},
			},
		});
		await prisma.invoice.deleteMany({
			where: {
				customer_id: {
					gte: baseInvoiceData.customer_id,
					lte: baseInvoiceData.customer_id + concurrentInvoices,
				},
			},
		});
		console.log("✅ Cleaned up existing test data");
	} catch (error) {
		console.log("⚠️  Warning during cleanup:", error);
	}

	const startTime = Date.now();

	// Create concurrent invoice creation promises
	const promises = Array.from(
		{ length: concurrentInvoices },
		async (_, invoiceIndex): Promise<TestResult> => {
			try {
				// Modify customer_id slightly to avoid conflicts
				const invoiceData = {
					...baseInvoiceData,
					customer_id: baseInvoiceData.customer_id + invoiceIndex,
				};

				// Generate HBL codes for all items
				const totalQuantity = invoiceData.items.length;
				const allHblCodes = await generarTracking(
					invoiceData.agency_id,
					invoiceData.service_id,
					totalQuantity,
				);

				console.log(`📦 Invoice ${invoiceIndex + 1} HBL codes: [${allHblCodes.join(", ")}]`);

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

				// Create invoice with transaction
				const invoice = await prisma.$transaction(
					async (tx) => {
						const createdInvoice = await tx.invoice.create({
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
					hbl_codes: invoice.items.map((item) => item.hbl),
				};
			} catch (error: any) {
				console.error(`❌ Invoice ${invoiceIndex + 1} failed: ${error.message}`);
				return {
					invoiceIndex: invoiceIndex + 1,
					success: false,
					error: error.message,
				};
			}
		},
	);

	const results = await Promise.all(promises);
	const endTime = Date.now();

	// Analyze results
	const successful = results.filter((r) => r.success);
	const failed = results.filter((r) => !r.success);
	const allHblCodes = successful.flatMap((r) => r.hbl_codes || []);
	const uniqueHblCodes = [...new Set(allHblCodes)];

	console.log(`\n=== Test Results ===`);
	console.log(`⏱️  Test completed in ${endTime - startTime}ms`);
	console.log(`✅ Successful invoices: ${successful.length}/${concurrentInvoices}`);
	console.log(`❌ Failed invoices: ${failed.length}`);
	console.log(`📋 Total HBL codes generated: ${allHblCodes.length}`);
	console.log(`🎯 Unique HBL codes: ${uniqueHblCodes.length}`);

	if (failed.length > 0) {
		console.log(`\n💥 Failure details:`);
		failed.forEach((f) => {
			console.log(`   - Invoice ${f.invoiceIndex}: ${f.error}`);
		});
	}

	// Validate results
	let testsPassed = 0;
	let totalTests = 0;

	// Test 1: All requests should succeed
	totalTests++;
	if (failed.length === 0) {
		console.log(`✅ Test 1 PASSED: All requests succeeded`);
		testsPassed++;
	} else {
		console.log(`❌ Test 1 FAILED: ${failed.length} requests failed`);
	}

	// Test 2: Correct number of successful invoices
	totalTests++;
	if (successful.length === concurrentInvoices) {
		console.log(`✅ Test 2 PASSED: Expected ${concurrentInvoices} successful invoices`);
		testsPassed++;
	} else {
		console.log(`❌ Test 2 FAILED: Expected ${concurrentInvoices}, got ${successful.length}`);
	}

	// Test 3: Correct number of HBL codes
	totalTests++;
	if (allHblCodes.length === expectedTotalItems) {
		console.log(`✅ Test 3 PASSED: Expected ${expectedTotalItems} HBL codes`);
		testsPassed++;
	} else {
		console.log(`❌ Test 3 FAILED: Expected ${expectedTotalItems}, got ${allHblCodes.length}`);
	}

	// Test 4: All HBL codes should be unique
	totalTests++;
	if (uniqueHblCodes.length === allHblCodes.length) {
		console.log(`✅ Test 4 PASSED: All HBL codes are unique`);
		testsPassed++;
	} else {
		console.log(`❌ Test 4 FAILED: Found duplicate HBL codes`);
		const duplicates = allHblCodes.filter((code, index) => allHblCodes.indexOf(code) !== index);
		console.log(`   Duplicates: ${[...new Set(duplicates)].join(", ")}`);
	}

	// Test 5: HBL format validation
	totalTests++;
	const formatRegex = /^CTE\d{6}1\d{2}\d{4}$/;
	const invalidFormats = allHblCodes.filter((hbl) => !formatRegex.test(hbl));
	if (invalidFormats.length === 0) {
		console.log(`✅ Test 5 PASSED: All HBL codes follow correct format`);
		testsPassed++;
	} else {
		console.log(`❌ Test 5 FAILED: ${invalidFormats.length} HBL codes have invalid format`);
		console.log(`   Invalid: ${invalidFormats.join(", ")}`);
	}

	// Test 6: Verify no duplicate HBL codes exist in database
	totalTests++;
	try {
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

		const dbHblSet = new Set(dbHblCodes.map((item) => item.hbl));
		if (dbHblCodes.length === allHblCodes.length && dbHblSet.size === allHblCodes.length) {
			console.log(`✅ Test 6 PASSED: No duplicate HBL codes in database`);
			testsPassed++;
		} else {
			console.log(`❌ Test 6 FAILED: Database contains duplicate or missing HBL codes`);
		}
	} catch (error) {
		console.log(`❌ Test 6 FAILED: Database verification error: ${error}`);
	}

	console.log(`\n🏆 Final Results: ${testsPassed}/${totalTests} tests passed`);

	if (testsPassed === totalTests) {
		console.log(
			`\n🎉 ALL TESTS PASSED! The unique HBL generation system is working correctly under concurrent load.`,
		);
	} else {
		console.log(`\n⚠️  Some tests failed. The HBL generation system needs improvement.`);
	}

	// Clean up test data
	try {
		await prisma.item.deleteMany({
			where: {
				invoice: {
					customer_id: {
						gte: baseInvoiceData.customer_id,
						lte: baseInvoiceData.customer_id + concurrentInvoices,
					},
				},
			},
		});
		await prisma.invoice.deleteMany({
			where: {
				customer_id: {
					gte: baseInvoiceData.customer_id,
					lte: baseInvoiceData.customer_id + concurrentInvoices,
				},
			},
		});
		console.log(`\n🧹 Cleaned up test data`);
	} catch (error) {
		console.log(`⚠️  Warning during cleanup: ${error}`);
	}

	await prisma.$disconnect();
}

// Run the test
if (require.main === module) {
	testConcurrentHBLGeneration()
		.then(() => {
			console.log("\n✨ Test execution completed");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n💥 Test execution failed:", error);
			process.exit(1);
		});
}

export { testConcurrentHBLGeneration };
