import request from "supertest";
import { app } from "../../app";
import { TestDataGenerator, TestInvoiceData } from "../helpers/testDataGenerator";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Realistic stress test using your actual production data
 * Agency ID: 1, User ID: R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q
 * Tests with real customers and receivers from your database
 */
describe("Realistic Invoice Creation Stress Tests", () => {
	let performanceMetrics: {
		totalRequests: number;
		successfulRequests: number;
		failedRequests: number;
		averageResponseTime: number;
		minResponseTime: number;
		maxResponseTime: number;
		responseTimes: number[];
		hblCodesGenerated: string[];
		duplicateHblErrors: number;
		startTime: number;
		endTime: number;
	};

	beforeAll(async () => {
		console.log("🚀 Starting Realistic Stress Tests with Production Data");
		console.log("📊 Agency ID: 1");
		console.log("👤 User ID: R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q");

		// Initialize with your real data
		await TestDataGenerator.initialize();

		// Initialize performance metrics
		performanceMetrics = {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			averageResponseTime: 0,
			minResponseTime: Infinity,
			maxResponseTime: 0,
			responseTimes: [],
			hblCodesGenerated: [],
			duplicateHblErrors: 0,
			startTime: 0,
			endTime: 0,
		};
	});

	afterAll(async () => {
		await TestDataGenerator.cleanup();
		await prisma.$disconnect();

		// Log comprehensive performance metrics
		console.log("\n🎯 === REALISTIC STRESS TEST RESULTS ===");
		console.log(`📈 Total Requests: ${performanceMetrics.totalRequests}`);
		console.log(`✅ Successful Requests: ${performanceMetrics.successfulRequests}`);
		console.log(`❌ Failed Requests: ${performanceMetrics.failedRequests}`);
		console.log(
			`📊 Success Rate: ${(
				(performanceMetrics.successfulRequests / performanceMetrics.totalRequests) *
				100
			).toFixed(2)}%`,
		);
		console.log(
			`⏱️  Average Response Time: ${performanceMetrics.averageResponseTime.toFixed(2)}ms`,
		);
		console.log(`🚀 Min Response Time: ${performanceMetrics.minResponseTime}ms`);
		console.log(`🐌 Max Response Time: ${performanceMetrics.maxResponseTime}ms`);
		console.log(`🔢 HBL Codes Generated: ${performanceMetrics.hblCodesGenerated.length}`);
		console.log(`⚠️  Duplicate HBL Errors: ${performanceMetrics.duplicateHblErrors}`);
		console.log(
			`⏰ Total Test Duration: ${performanceMetrics.endTime - performanceMetrics.startTime}ms`,
		);
		console.log(
			`🔥 Requests per Second: ${(
				performanceMetrics.totalRequests /
				((performanceMetrics.endTime - performanceMetrics.startTime) / 1000)
			).toFixed(2)}`,
		);
		console.log("==========================================\n");
	});

	/**
	 * Helper function to create invoice with comprehensive metrics tracking
	 */
	const createInvoiceWithMetrics = async (
		invoiceData: TestInvoiceData,
	): Promise<{ success: boolean; responseTime: number; error?: any; hblCodes?: string[] }> => {
		const startTime = Date.now();

		try {
			const response = await request(app)
				.post("/api/v1/invoices")
				.send(invoiceData)
				.expect((res) => {
					if (res.status !== 200 && res.status !== 201) {
						throw new Error(`Expected 200 or 201, got ${res.status}`);
					}
				});

			const responseTime = Date.now() - startTime;

			// Extract HBL codes from response
			const hblCodes = response.body.items?.map((item: any) => item.hbl) || [];

			// Update metrics
			performanceMetrics.successfulRequests++;
			performanceMetrics.responseTimes.push(responseTime);
			performanceMetrics.hblCodesGenerated.push(...hblCodes);
			performanceMetrics.minResponseTime = Math.min(
				performanceMetrics.minResponseTime,
				responseTime,
			);
			performanceMetrics.maxResponseTime = Math.max(
				performanceMetrics.maxResponseTime,
				responseTime,
			);

			return { success: true, responseTime, hblCodes };
		} catch (error: any) {
			const responseTime = Date.now() - startTime;
			performanceMetrics.failedRequests++;

			// Track duplicate HBL errors specifically
			if (error.message?.includes("duplicate") || error.message?.includes("HBL")) {
				performanceMetrics.duplicateHblErrors++;
			}

			return { success: false, responseTime, error };
		} finally {
			performanceMetrics.totalRequests++;
		}
	};

	/**
	 * Test 1: Realistic Sequential Load - Your Production Environment
	 */
	test("Production Sequential Load - 100 invoices with real data", async () => {
		console.log("\n🔄 Starting Production Sequential Load Test");

		const invoiceCount = 100;
		const testData = TestDataGenerator.generateMultipleInvoiceData(invoiceCount);

		performanceMetrics.startTime = Date.now();

		for (let i = 0; i < testData.length; i++) {
			const result = await createInvoiceWithMetrics(testData[i]);

			if (i % 20 === 0) {
				console.log(
					`📈 Progress: ${i + 1}/${invoiceCount} invoices created (${(
						((i + 1) / invoiceCount) *
						100
					).toFixed(1)}%)`,
				);
			}

			// Small delay to simulate realistic usage
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		performanceMetrics.endTime = Date.now();
		performanceMetrics.averageResponseTime =
			performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) /
			performanceMetrics.responseTimes.length;

		console.log(
			`✅ Sequential test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`,
		);

		// Expect very high success rate for sequential operations
		const successRate =
			(performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
		expect(successRate).toBeGreaterThanOrEqual(95);

		// Reset for next test
		performanceMetrics = {
			...performanceMetrics,
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			responseTimes: [],
			minResponseTime: Infinity,
			maxResponseTime: 0,
		};
	});

	/**
	 * Test 2: Realistic Concurrent Load - Simulating Multiple Users
	 */
	test("Production Concurrent Load - 150 invoices, 15 concurrent users", async () => {
		console.log("\n🚀 Starting Production Concurrent Load Test");

		const invoiceCount = 150;
		const concurrency = 15;
		const testData = TestDataGenerator.generateMultipleInvoiceData(invoiceCount);

		performanceMetrics.startTime = Date.now();

		// Process in concurrent batches
		const batches: TestInvoiceData[][] = [];
		for (let i = 0; i < testData.length; i += concurrency) {
			batches.push(testData.slice(i, i + concurrency));
		}

		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];
			console.log(
				`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${
					batch.length
				} concurrent requests)`,
			);

			// Execute batch concurrently
			const promises = batch.map((invoiceData) => createInvoiceWithMetrics(invoiceData));
			const results = await Promise.all(promises);

			// Log any errors in this batch
			const batchErrors = results.filter((r) => !r.success);
			if (batchErrors.length > 0) {
				console.log(`⚠️  Batch ${batchIndex + 1} had ${batchErrors.length} errors`);
			}

			// Realistic delay between batches
			if (batchIndex < batches.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 200));
			}
		}

		performanceMetrics.endTime = Date.now();
		performanceMetrics.averageResponseTime =
			performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) /
			performanceMetrics.responseTimes.length;

		console.log(
			`✅ Concurrent test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`,
		);

		// Expect good success rate for concurrent operations with your real data
		const successRate =
			(performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
		expect(successRate).toBeGreaterThanOrEqual(85);

		// Check for HBL uniqueness
		const uniqueHbls = new Set(performanceMetrics.hblCodesGenerated);
		const duplicateRate =
			((performanceMetrics.hblCodesGenerated.length - uniqueHbls.size) /
				performanceMetrics.hblCodesGenerated.length) *
			100;
		console.log(`🔢 HBL Duplicate Rate: ${duplicateRate.toFixed(2)}%`);
		expect(duplicateRate).toBeLessThan(5); // Less than 5% duplicates acceptable

		// Reset for next test
		performanceMetrics = {
			...performanceMetrics,
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			responseTimes: [],
			minResponseTime: Infinity,
			maxResponseTime: 0,
			hblCodesGenerated: [],
		};
	});

	/**
	 * Test 3: Peak Load Simulation - Maximum realistic concurrent load
	 */
	test("Production Peak Load - 300 invoices, 25 concurrent users", async () => {
		console.log("\n🔥 Starting Production Peak Load Test");

		const invoiceCount = 300;
		const concurrency = 25;
		const testData = TestDataGenerator.generateMultipleInvoiceData(invoiceCount);

		performanceMetrics.startTime = Date.now();

		// Process in concurrent batches with timeout protection
		const batches: TestInvoiceData[][] = [];
		for (let i = 0; i < testData.length; i += concurrency) {
			batches.push(testData.slice(i, i + concurrency));
		}

		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];
			console.log(
				`🔥 Processing peak batch ${batchIndex + 1}/${batches.length} (${
					batch.length
				} concurrent requests)`,
			);

			// Execute with timeout protection
			const promises = batch.map((invoiceData) =>
				Promise.race([
					createInvoiceWithMetrics(invoiceData),
					new Promise<{ success: boolean; responseTime: number; error: any }>((_, reject) =>
						setTimeout(() => reject(new Error("Request timeout (45s)")), 45000),
					),
				]).catch((error) => ({ success: false, responseTime: 45000, error })),
			);

			const results = await Promise.all(promises);

			// Log batch performance
			const batchSuccessRate = (results.filter((r) => r.success).length / results.length) * 100;
			console.log(`📊 Batch ${batchIndex + 1} success rate: ${batchSuccessRate.toFixed(1)}%`);

			// Longer delay for peak load to prevent database overwhelming
			if (batchIndex < batches.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		performanceMetrics.endTime = Date.now();
		performanceMetrics.averageResponseTime =
			performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) /
			performanceMetrics.responseTimes.length;

		console.log(
			`🔥 Peak load test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`,
		);

		// More lenient success rate for peak load
		const successRate =
			(performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
		expect(successRate).toBeGreaterThanOrEqual(75);

		// Performance benchmarks for your system
		expect(performanceMetrics.averageResponseTime).toBeLessThan(10000); // Less than 10 seconds average

		console.log(
			`🎯 Peak load performance: ${successRate.toFixed(
				1,
			)}% success, ${performanceMetrics.averageResponseTime.toFixed(0)}ms avg response`,
		);
	});

	/**
	 * Test 4: Real-world usage pattern simulation
	 */
	test("Production Usage Pattern - Mixed complexity invoices", async () => {
		console.log("\n📊 Starting Real-world Usage Pattern Test");

		// Simulate real usage: 70% simple, 25% medium, 5% complex
		const simpleCount = 70;
		const mediumCount = 25;
		const complexCount = 5;
		const concurrency = 12;

		const simpleData = Array.from({ length: simpleCount }, () =>
			TestDataGenerator.generateComplexInvoiceData("simple"),
		);
		const mediumData = Array.from({ length: mediumCount }, () =>
			TestDataGenerator.generateComplexInvoiceData("medium"),
		);
		const complexData = Array.from({ length: complexCount }, () =>
			TestDataGenerator.generateComplexInvoiceData("complex"),
		);

		const testData = [...simpleData, ...mediumData, ...complexData];
		// Shuffle to simulate random order
		testData.sort(() => Math.random() - 0.5);

		performanceMetrics.startTime = Date.now();

		const batches: TestInvoiceData[][] = [];
		for (let i = 0; i < testData.length; i += concurrency) {
			batches.push(testData.slice(i, i + concurrency));
		}

		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];
			console.log(`📊 Processing usage batch ${batchIndex + 1}/${batches.length}`);

			const promises = batch.map((invoiceData) => createInvoiceWithMetrics(invoiceData));
			await Promise.all(promises);

			// Variable delays to simulate real usage patterns
			const delay = Math.floor(Math.random() * 300) + 100; // 100-400ms
			await new Promise((resolve) => setTimeout(resolve, delay));
		}

		performanceMetrics.endTime = Date.now();
		performanceMetrics.averageResponseTime =
			performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) /
			performanceMetrics.responseTimes.length;

		console.log(
			`📊 Usage pattern test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`,
		);

		const successRate =
			(performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
		expect(successRate).toBeGreaterThanOrEqual(90);

		console.log(`🎯 Real-world pattern: ${successRate.toFixed(1)}% success rate`);
	});
});
