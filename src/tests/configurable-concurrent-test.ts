import prisma from "../config/prisma_db";
import { generarTracking } from "../utils/generate_hbl";

interface TestConfig {
	concurrentInvoices: number;
	itemsPerInvoice: number;
	baseCustomerId: number;
	testName: string;
	cleanupAfter: boolean;
	showProgress: boolean;
	timeoutMs: number;
}

interface TestResult {
	invoiceIndex: number;
	success: boolean;
	hbl_codes?: string[];
	error?: string;
	executionTime?: number;
}

interface TestStats {
	config: TestConfig;
	totalInvoices: number;
	successfulInvoices: number;
	failedInvoices: number;
	totalHblCodes: number;
	uniqueHblCodes: number;
	averageExecutionTime: number;
	totalExecutionTime: number;
	duplicateHbls: string[];
	successRate: number;
	throughput: number;
}

// Configurable concurrent invoice test
async function runConfigurableConcurrentTest(config: TestConfig): Promise<TestStats> {
	console.log(`🚀 Starting ${config.testName}...\n`);

	// Test data template
	const baseInvoiceData = {
		customer_id: config.baseCustomerId,
		receiver_id: 31558,
		agency_id: 1,
		user_id: `ConfigTest-${config.concurrentInvoices}`,
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
		].slice(0, config.itemsPerInvoice), // Take only the requested number of items
		total_amount: 215.23,
		total_weight: 107,
		payment_status: false,
	};

	const expectedTotalItems = config.concurrentInvoices * config.itemsPerInvoice;

	console.log(`🎯 Configuration:`);
	console.log(`   - Concurrent invoices: ${config.concurrentInvoices}`);
	console.log(`   - Items per invoice: ${config.itemsPerInvoice}`);
	console.log(`   - Expected total HBL codes: ${expectedTotalItems}`);
	console.log(`   - Timeout per invoice: ${config.timeoutMs}ms`);
	console.log(`   - Base customer ID: ${config.baseCustomerId}\n`);

	// Clean up existing test data
	if (config.showProgress) {
		console.log("🧹 Cleaning up existing test data...");
	}

	try {
		const deletedItems = await prisma.item.deleteMany({
			where: {
				invoice: {
					customer_id: {
						gte: config.baseCustomerId,
						lte: config.baseCustomerId + config.concurrentInvoices,
					},
				},
			},
		});

		const deletedInvoices = await prisma.invoice.deleteMany({
			where: {
				customer_id: {
					gte: config.baseCustomerId,
					lte: config.baseCustomerId + config.concurrentInvoices,
				},
			},
		});

		if (config.showProgress) {
			console.log(
				`✅ Cleaned up ${deletedItems.count} items and ${deletedInvoices.count} invoices\n`,
			);
		}
	} catch (error) {
		console.log("⚠️  Warning during cleanup:", error);
	}

	const overallStartTime = Date.now();

	// Create concurrent invoice creation promises
	if (config.showProgress) {
		console.log(`🚦 Starting ${config.concurrentInvoices} concurrent invoice creations...`);
	}

	const promises = Array.from(
		{ length: config.concurrentInvoices },
		async (_, invoiceIndex): Promise<TestResult> => {
			const invoiceStartTime = Date.now();

			try {
				const invoiceData = {
					...baseInvoiceData,
					customer_id: config.baseCustomerId + invoiceIndex,
				};

				// Generate HBL codes
				const allHblCodes = await generarTracking(
					invoiceData.agency_id,
					invoiceData.service_id,
					config.itemsPerInvoice,
				);

				// Progress indicator
				if (
					config.showProgress &&
					(invoiceIndex + 1) % Math.max(1, Math.floor(config.concurrentInvoices / 10)) === 0
				) {
					console.log(
						`📈 Progress: ${invoiceIndex + 1}/${config.concurrentInvoices} invoices started...`,
					);
				}

				// Map items with HBL codes
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

				// Create invoice
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
									select: {
										hbl: true,
									},
									orderBy: { hbl: "asc" },
								},
							},
						});
					},
					{
						timeout: config.timeoutMs,
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

				if (config.showProgress) {
					console.error(
						`❌ Invoice ${invoiceIndex + 1} failed after ${executionTime}ms: ${error.message}`,
					);
				}

				return {
					invoiceIndex: invoiceIndex + 1,
					success: false,
					error: error.message,
					executionTime,
				};
			}
		},
	);

	if (config.showProgress) {
		console.log("⏳ Waiting for all invoices to complete...\n");
	}

	const results = await Promise.all(promises);
	const overallEndTime = Date.now();

	// Calculate statistics
	const successful = results.filter((r) => r.success);
	const failed = results.filter((r) => !r.success);
	const allHblCodes = successful.flatMap((r) => r.hbl_codes || []);
	const uniqueHblCodes = [...new Set(allHblCodes)];
	const duplicateHbls = allHblCodes.filter((code, index) => allHblCodes.indexOf(code) !== index);
	const uniqueDuplicates = [...new Set(duplicateHbls)];

	const executionTimes = results.filter((r) => r.executionTime).map((r) => r.executionTime!);
	const averageExecutionTime =
		executionTimes.length > 0
			? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
			: 0;

	const totalExecutionTime = overallEndTime - overallStartTime;
	const successRate = (successful.length / config.concurrentInvoices) * 100;
	const throughput = successful.length / (totalExecutionTime / 1000);

	const stats: TestStats = {
		config,
		totalInvoices: config.concurrentInvoices,
		successfulInvoices: successful.length,
		failedInvoices: failed.length,
		totalHblCodes: allHblCodes.length,
		uniqueHblCodes: uniqueHblCodes.length,
		averageExecutionTime: Math.round(averageExecutionTime),
		totalExecutionTime,
		duplicateHbls: uniqueDuplicates,
		successRate,
		throughput,
	};

	// Display results
	console.log("=".repeat(50));
	console.log(`📊 ${config.testName.toUpperCase()} RESULTS`);
	console.log("=".repeat(50));

	console.log(
		`⏱️  Total time: ${stats.totalExecutionTime}ms (${(stats.totalExecutionTime / 1000).toFixed(
			2,
		)}s)`,
	);
	console.log(`📈 Success rate: ${stats.successRate.toFixed(1)}%`);
	console.log(`✅ Successful: ${stats.successfulInvoices}/${stats.totalInvoices}`);
	console.log(`❌ Failed: ${stats.failedInvoices}`);
	console.log(`📋 HBL codes: ${stats.totalHblCodes} total, ${stats.uniqueHblCodes} unique`);
	console.log(`⚡ Avg time per invoice: ${stats.averageExecutionTime}ms`);
	console.log(`🔄 Throughput: ${stats.throughput.toFixed(2)} invoices/second`);

	// HBL uniqueness check
	if (stats.duplicateHbls.length === 0) {
		console.log(`🎯 HBL Uniqueness: ✅ PERFECT - All codes unique`);
	} else {
		console.log(`🎯 HBL Uniqueness: ❌ FAILED - ${stats.duplicateHbls.length} duplicates found`);
		console.log(`   Duplicates: ${stats.duplicateHbls.join(", ")}`);
	}

	// Performance assessment
	let performanceGrade = "EXCELLENT";
	if (stats.averageExecutionTime > 3000) performanceGrade = "GOOD";
	if (stats.averageExecutionTime > 5000) performanceGrade = "NEEDS IMPROVEMENT";
	if (stats.successRate < 90) performanceGrade = "POOR";

	console.log(`🏆 Overall Grade: ${performanceGrade}`);

	// Error analysis
	if (failed.length > 0) {
		console.log(`\n💥 Error Analysis:`);
		const errorTypes = failed.reduce((acc, f) => {
			const errorType = f.error?.split(":")[0] || "Unknown";
			acc[errorType] = (acc[errorType] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);

		Object.entries(errorTypes).forEach(([errorType, count]) => {
			console.log(`   - ${errorType}: ${count} occurrences`);
		});
	}

	// Cleanup
	if (config.cleanupAfter) {
		try {
			await prisma.item.deleteMany({
				where: {
					invoice: {
						customer_id: {
							gte: config.baseCustomerId,
							lte: config.baseCustomerId + config.concurrentInvoices,
						},
					},
				},
			});

			await prisma.invoice.deleteMany({
				where: {
					customer_id: {
						gte: config.baseCustomerId,
						lte: config.baseCustomerId + config.concurrentInvoices,
					},
				},
			});

			console.log(`\n🧹 Cleanup: Test data removed`);
		} catch (error) {
			console.log(`⚠️  Cleanup warning: ${error}`);
		}
	}

	return stats;
}

// Preset configurations
const presetConfigs = {
	light: {
		concurrentInvoices: 10,
		itemsPerInvoice: 3,
		baseCustomerId: 6000,
		testName: "Light Load Test (10 concurrent)",
		cleanupAfter: true,
		showProgress: true,
		timeoutMs: 30000,
	},
	medium: {
		concurrentInvoices: 50,
		itemsPerInvoice: 3,
		baseCustomerId: 7000,
		testName: "Medium Load Test (50 concurrent)",
		cleanupAfter: true,
		showProgress: true,
		timeoutMs: 45000,
	},
	heavy: {
		concurrentInvoices: 100,
		itemsPerInvoice: 3,
		baseCustomerId: 8000,
		testName: "Heavy Load Test (100 concurrent)",
		cleanupAfter: true,
		showProgress: true,
		timeoutMs: 60000,
	},
	extreme: {
		concurrentInvoices: 200,
		itemsPerInvoice: 3,
		baseCustomerId: 9000,
		testName: "Extreme Load Test (200 concurrent)",
		cleanupAfter: true,
		showProgress: true,
		timeoutMs: 90000,
	},
};

// Run multiple test configurations
async function runAllPresetTests(): Promise<void> {
	console.log("🎯 Running all preset load tests...\n");

	const results: TestStats[] = [];

	for (const [testType, config] of Object.entries(presetConfigs)) {
		console.log(`\n${"=".repeat(60)}`);
		console.log(`🚀 Starting ${testType.toUpperCase()} test...`);
		console.log(`${"=".repeat(60)}`);

		try {
			const stats = await runConfigurableConcurrentTest(config);
			results.push(stats);

			// Short break between tests
			console.log(`\n⏸️  Waiting 5 seconds before next test...`);
			await new Promise((resolve) => setTimeout(resolve, 5000));
		} catch (error) {
			console.error(`❌ ${testType.toUpperCase()} test failed:`, error);
		}
	}

	// Summary of all tests
	console.log(`\n${"=".repeat(60)}`);
	console.log("📊 COMPREHENSIVE TEST SUMMARY");
	console.log(`${"=".repeat(60)}`);

	results.forEach((stats) => {
		const grade =
			stats.duplicateHbls.length === 0 && stats.successRate >= 90 ? "✅ PASS" : "❌ FAIL";
		console.log(`${grade} ${stats.config.testName}:`);
		console.log(
			`   Success: ${stats.successRate.toFixed(1)}%, HBL Unique: ${
				stats.duplicateHbls.length === 0 ? "Yes" : "No"
			}`,
		);
	});

	await prisma.$disconnect();
}

export { runConfigurableConcurrentTest, presetConfigs, runAllPresetTests };

// CLI execution
if (require.main === module) {
	const args = process.argv.slice(2);
	const testType = args[0] || "heavy";

	if (testType === "all") {
		runAllPresetTests()
			.then(() => process.exit(0))
			.catch((error) => {
				console.error("Test suite failed:", error);
				process.exit(1);
			});
	} else if (presetConfigs[testType as keyof typeof presetConfigs]) {
		runConfigurableConcurrentTest(presetConfigs[testType as keyof typeof presetConfigs])
			.then(() => process.exit(0))
			.catch((error) => {
				console.error(`${testType} test failed:`, error);
				process.exit(1);
			});
	} else {
		console.log("Usage: npx tsx configurable-concurrent-test.ts [light|medium|heavy|extreme|all]");
		console.log("Default: heavy");
		process.exit(1);
	}
}
