import prisma from "../config/prisma_db";
import { generarTracking } from "../utils/generate_hbl";

interface TestResult {
	invoiceIndex: number;
	success: boolean;
	hbl_codes?: string[];
	error?: string;
	executionTime?: number;
}

interface StressTestStats {
	totalInvoices: number;
	successfulInvoices: number;
	failedInvoices: number;
	totalHblCodes: number;
	uniqueHblCodes: number;
	averageExecutionTime: number;
	totalExecutionTime: number;
	duplicateHbls: string[];
}

// Stress test with 100 concurrent invoices
async function stressTest100ConcurrentInvoices(): Promise<void> {
	console.log("🚀 Starting 100 Concurrent Invoices Stress Test...\n");

	// Test data based on your actual invoice structure
	const baseInvoiceData = {
		customer_id:1000, // Starting from a higher number to avoid conflicts
		receiver_id: 1000,
		agency_id: 1,
		user_id: "BhKFci6yZKkvChJgE4MnpF43geCmr8Ho",
		service_id: 1,
		items: [
		
			{
				description: "Alimento/Aseo/Medicinas",
				weight: 8,
				customs_fee: 1,
				delivery_fee: 0,
				insurance_fee: 0,
				rate: 1.99,
				subtotal: 16.92,
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
			{
				description: "Alimento/Aseo/Medicinas",
				weight: 8,
				customs_fee: 1,
				delivery_fee: 0,
				insurance_fee: 0,
				rate: 1.99,
				subtotal: 16.92,
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

	const concurrentInvoices = 100;
	const expectedTotalItems = concurrentInvoices * baseInvoiceData.items.length;

	console.log(`🎯 Target: ${concurrentInvoices} concurrent invoice creations`);
	console.log(`📦 Expected total items: ${expectedTotalItems}`);
	console.log(`⚡ Items per invoice: ${baseInvoiceData.items.length}\n`);

	// Clean up any existing test data
	console.log("🧹 Cleaning up existing test data...");
	/* 	try {
		const deletedItems = await prisma.item.deleteMany({
			where: {
				invoice: {
					customer_id: {
						gte: baseInvoiceData.customer_id,
						lte: baseInvoiceData.customer_id + concurrentInvoices,
					},
				},
			},
		});

		const deletedInvoices = await prisma.invoice.deleteMany({
			where: {
				customer_id: {
					gte: baseInvoiceData.customer_id,
					lte: baseInvoiceData.customer_id + concurrentInvoices,
				},
			},
		});

		console.log(
			`✅ Cleaned up ${deletedItems.count} items and ${deletedInvoices.count} invoices\n`,
		);
	} catch (error) {
		console.log("⚠️  Warning during cleanup:", error);
	} */

	const overallStartTime = Date.now();

	// Create concurrent invoice creation promises
	console.log("🚦 Starting concurrent invoice creation...");
	const promises = Array.from(
		{ length: concurrentInvoices },
		async (_, invoiceIndex): Promise<TestResult> => {
			const invoiceStartTime = Date.now();

			try {
				// Modify customer_id to avoid conflicts
				const invoiceData = {
					...baseInvoiceData,
					customer_id: baseInvoiceData.customer_id + invoiceIndex,
					receiver_id: baseInvoiceData.receiver_id + invoiceIndex,
				};

				// Generate HBL codes for all items
				const totalQuantity = invoiceData.items.length;
				const allHblCodes = await generarTracking(
					invoiceData.agency_id,
					invoiceData.service_id,
					totalQuantity,
				);

				// Progress indicator every 10 invoices
				if ((invoiceIndex + 1) % 10 === 0) {
					console.log(`📈 Progress: ${invoiceIndex + 1}/${concurrentInvoices} invoices started...`);
				}

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
						timeout: 60000, // Increased timeout for high load
					},
				);

				const executionTime = Date.now() - invoiceStartTime;

				return {
					invoiceIndex: invoiceIndex + 1,
					success: true,
					hbl_codes: invoice.items.map((item) => item.hbl),
					executionTime,
				};
			} catch (error: any) {
				const executionTime = Date.now() - invoiceStartTime;
				console.error(
					`❌ Invoice ${invoiceIndex + 1} failed after ${executionTime}ms: ${error.message}`,
				);

				return {
					invoiceIndex: invoiceIndex + 1,
					success: false,
					error: error.message,
					executionTime,
				};
			}
		},
	);

	console.log("⏳ Waiting for all invoices to complete...\n");
	const results = await Promise.all(promises);
	const overallEndTime = Date.now();

	// Analyze results
	const successful = results.filter((r) => r.success);
	const failed = results.filter((r) => !r.success);
	const allHblCodes = successful.flatMap((r) => r.hbl_codes || []);
	const uniqueHblCodes = [...new Set(allHblCodes)];
	const duplicateHbls = allHblCodes.filter((code, index) => allHblCodes.indexOf(code) !== index);
	const uniqueDuplicates = [...new Set(duplicateHbls)];

	// Calculate execution time statistics
	const executionTimes = results.filter((r) => r.executionTime).map((r) => r.executionTime!);
	const averageExecutionTime =
		executionTimes.length > 0
			? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
			: 0;

	const stats: StressTestStats = {
		totalInvoices: concurrentInvoices,
		successfulInvoices: successful.length,
		failedInvoices: failed.length,
		totalHblCodes: allHblCodes.length,
		uniqueHblCodes: uniqueHblCodes.length,
		averageExecutionTime: Math.round(averageExecutionTime),
		totalExecutionTime: overallEndTime - overallStartTime,
		duplicateHbls: uniqueDuplicates,
	};

	// Display comprehensive results
	console.log("=".repeat(60));
	console.log("🏆 STRESS TEST RESULTS - 100 CONCURRENT INVOICES");
	console.log("=".repeat(60));

	console.log(
		`⏱️  Total execution time: ${stats.totalExecutionTime}ms (${(
			stats.totalExecutionTime / 1000
		).toFixed(2)}s)`,
	);
	console.log(
		`📊 Success rate: ${((stats.successfulInvoices / stats.totalInvoices) * 100).toFixed(1)}%`,
	);
	console.log(`✅ Successful invoices: ${stats.successfulInvoices}/${stats.totalInvoices}`);
	console.log(`❌ Failed invoices: ${stats.failedInvoices}`);
	console.log(`📋 Total HBL codes generated: ${stats.totalHblCodes}`);
	console.log(`🎯 Unique HBL codes: ${stats.uniqueHblCodes}`);
	console.log(`⚡ Average invoice creation time: ${stats.averageExecutionTime}ms`);
	console.log(
		`🔄 Throughput: ${(stats.successfulInvoices / (stats.totalExecutionTime / 1000)).toFixed(
			2,
		)} invoices/second`,
	);

	if (stats.duplicateHbls.length > 0) {
		console.log(`\n⚠️  DUPLICATE HBL CODES FOUND:`);
		console.log(`   Count: ${stats.duplicateHbls.length}`);
		console.log(`   Codes: ${stats.duplicateHbls.join(", ")}`);
	}

	if (failed.length > 0) {
		console.log(`\n💥 FAILURE ANALYSIS:`);
		const errorTypes = failed.reduce((acc, f) => {
			const errorType = f.error?.split(":")[0] || "Unknown";
			acc[errorType] = (acc[errorType] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);

		Object.entries(errorTypes).forEach(([errorType, count]) => {
			console.log(`   - ${errorType}: ${count} occurrences`);
		});

		// Show first 5 detailed errors
		console.log(`\n   First 5 detailed errors:`);
		failed.slice(0, 5).forEach((f, index) => {
			console.log(`   ${index + 1}. Invoice ${f.invoiceIndex}: ${f.error}`);
		});
	}

	// Performance benchmarks
	console.log(`\n📈 PERFORMANCE BENCHMARKS:`);
	if (stats.averageExecutionTime < 1000) {
		console.log(`   ✅ Average response time: EXCELLENT (< 1s)`);
	} else if (stats.averageExecutionTime < 3000) {
		console.log(`   ⚡ Average response time: GOOD (< 3s)`);
	} else {
		console.log(`   ⚠️  Average response time: NEEDS OPTIMIZATION (> 3s)`);
	}

	if (stats.successfulInvoices / stats.totalInvoices >= 0.95) {
		console.log(`   ✅ Success rate: EXCELLENT (≥ 95%)`);
	} else if (stats.successfulInvoices / stats.totalInvoices >= 0.9) {
		console.log(`   ⚡ Success rate: GOOD (≥ 90%)`);
	} else {
		console.log(`   ⚠️  Success rate: NEEDS IMPROVEMENT (< 90%)`);
	}

	// Validate HBL uniqueness
	console.log(`\n🔍 HBL UNIQUENESS VALIDATION:`);
	if (stats.duplicateHbls.length === 0) {
		console.log(`   ✅ ALL HBL CODES ARE UNIQUE - PERFECT!`);
	} else {
		console.log(
			`   ❌ FOUND ${stats.duplicateHbls.length} DUPLICATE HBL CODES - SYSTEM NEEDS FIX!`,
		);
	}

	// Database verification
	console.log(`\n🗄️  DATABASE VERIFICATION:`);
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
			console.log(`   ✅ Database consistency: PERFECT`);
			console.log(`   📊 All ${allHblCodes.length} HBL codes properly stored`);
		} else {
			console.log(`   ❌ Database inconsistency detected`);
			console.log(
				`   Expected: ${allHblCodes.length}, Found: ${dbHblCodes.length}, Unique: ${dbHblSet.size}`,
			);
		}
	} catch (error) {
		console.log(`   ❌ Database verification failed: ${error}`);
	}

	// Final assessment
	console.log(`\n🏁 FINAL ASSESSMENT:`);
	const isSuccess =
		stats.duplicateHbls.length === 0 &&
		stats.successfulInvoices / stats.totalInvoices >= 0.9 &&
		stats.averageExecutionTime < 5000;

	if (isSuccess) {
		console.log(`   🎉 STRESS TEST PASSED!`);
		console.log(`   🚀 System can handle 100 concurrent invoices with unique HBL generation`);
	} else {
		console.log(`   ⚠️  STRESS TEST REVEALED ISSUES`);
		if (stats.duplicateHbls.length > 0) {
			console.log(`   🔧 Priority: Fix HBL uniqueness system`);
		}
		if (stats.successfulInvoices / stats.totalInvoices < 0.9) {
			console.log(`   🔧 Priority: Improve success rate`);
		}
		if (stats.averageExecutionTime >= 5000) {
			console.log(`   🔧 Priority: Optimize performance`);
		}
	}

	// Clean up test data
	console.log(`\n🧹 CLEANUP:`);
	/* try {
		const deletedItems = await prisma.item.deleteMany({
			where: {
				invoice: {
					customer_id: {
						gte: baseInvoiceData.customer_id,
						lte: baseInvoiceData.customer_id + concurrentInvoices,
					},
				},
			},
		}); */
	/* 
		const deletedInvoices = await prisma.invoice.deleteMany({
			where: {
				customer_id: {
					gte: baseInvoiceData.customer_id,
					lte: baseInvoiceData.customer_id + concurrentInvoices,
				},
			},
		}); */

	/* console.log(
			`   ✅ Cleaned up ${deletedItems.count} items and ${deletedInvoices.count} invoices`,
		); 
	} catch (error) {
		console.log(`   ⚠️  Warning during cleanup: ${error}`);
	}
*/
	await prisma.$disconnect();
	console.log(`\n✨ Stress test completed successfully!`);
}

// Export function for external use
export { stressTest100ConcurrentInvoices };

// Run the test if called directly
if (require.main === module) {
	stressTest100ConcurrentInvoices()
		.then(() => {
			console.log("\n🎯 100 Concurrent Invoices Stress Test completed");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n💥 Stress test failed:", error);
			process.exit(1);
		});
}
