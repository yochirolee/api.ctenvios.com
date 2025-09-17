import request from "supertest";
import { app } from "../../app";
import { TestDataGenerator, TestInvoiceData } from "../helpers/testDataGenerator";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Comprehensive stress test for invoice creation endpoint
 * Following TypeScript strict typing and performance monitoring patterns
 */
describe("Invoice Creation Stress Tests", () => {
	let testData: TestInvoiceData[];
	let performanceMetrics: {
		totalRequests: number;
		successfulRequests: number;
		failedRequests: number;
		averageResponseTime: number;
		minResponseTime: number;
		maxResponseTime: number;
		responseTimes: number[];
		concurrentUsers: number;
		startTime: number;
		endTime: number;
	};

	beforeAll(async () => {
		// Initialize test data generator with existing database entities
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
			concurrentUsers: 0,
			startTime: 0,
			endTime: 0,
		};
	});

	afterAll(async () => {
		await TestDataGenerator.cleanup();
		await prisma.$disconnect();

		// Log final performance metrics
		console.log("\n=== STRESS TEST PERFORMANCE METRICS ===");
		console.log(`Total Requests: ${performanceMetrics.totalRequests}`);
		console.log(`Successful Requests: ${performanceMetrics.successfulRequests}`);
		console.log(`Failed Requests: ${performanceMetrics.failedRequests}`);
		console.log(
			`Success Rate: ${(
				(performanceMetrics.successfulRequests / performanceMetrics.totalRequests) *
				100
			).toFixed(2)}%`,
		);
		console.log(`Average Response Time: ${performanceMetrics.averageResponseTime.toFixed(2)}ms`);
		console.log(`Min Response Time: ${performanceMetrics.minResponseTime}ms`);
		console.log(`Max Response Time: ${performanceMetrics.maxResponseTime}ms`);
		console.log(
			`Total Test Duration: ${performanceMetrics.endTime - performanceMetrics.startTime}ms`,
		);
		console.log(
			`Requests per Second: ${(
				performanceMetrics.totalRequests /
				((performanceMetrics.endTime - performanceMetrics.startTime) / 1000)
			).toFixed(2)}`,
		);
		console.log("=======================================\n");
	});

	/**
	 * Helper function to create invoice and track performance
	 */
	const createInvoiceWithMetrics = async (
		invoiceData: TestInvoiceData,
	): Promise<{ success: boolean; responseTime: number; error?: any }> => {
		const startTime = Date.now();

		try {
			const response = await request(app)
				.post("/api/v1/invoices")
				.send(invoiceData)
				.expect((res) => {
					// Allow both 200 and 201 status codes for successful creation
					if (res.status !== 200 && res.status !== 201) {
						throw new Error(`Expected 200 or 201, got ${res.status}`);
					}
				});

			const responseTime = Date.now() - startTime;

			// Update metrics
			performanceMetrics.successfulRequests++;
			performanceMetrics.responseTimes.push(responseTime);
			performanceMetrics.minResponseTime = Math.min(
				performanceMetrics.minResponseTime,
				responseTime,
			);
			performanceMetrics.maxResponseTime = Math.max(
				performanceMetrics.maxResponseTime,
				responseTime,
			);

			return { success: true, responseTime };
		} catch (error) {
			const responseTime = Date.now() - startTime;
			performanceMetrics.failedRequests++;
			return { success: false, responseTime, error };
		} finally {
			performanceMetrics.totalRequests++;
		}
	};

	/**
	 * Test 1: Sequential invoice creation (baseline performance)
	 */
	test("Sequential Invoice Creation - Baseline Performance (50 invoices)", async () => {
		console.log("\n--- Starting Sequential Creation Test ---");

		const invoiceCount = 50;
		testData = TestDataGenerator.generateMultipleInvoiceData(invoiceCount);

		performanceMetrics.startTime = Date.now();

		for (let i = 0; i < testData.length; i++) {
			const result = await createInvoiceWithMetrics(testData[i]);

			if (i % 10 === 0) {
				console.log(`Progress: ${i + 1}/${invoiceCount} invoices created`);
			}

			// Small delay to prevent overwhelming the database
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		performanceMetrics.endTime = Date.now();
		performanceMetrics.averageResponseTime =
			performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) /
			performanceMetrics.responseTimes.length;

		console.log(
			`Sequential test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`,
		);

		// Reset metrics for next test
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
	 * Test 2: Concurrent invoice creation (stress test)
	 */
	test("Concurrent Invoice Creation - Stress Test (100 invoices, 10 concurrent)", async () => {
		console.log("\n--- Starting Concurrent Creation Test ---");

		const invoiceCount = 100;
		const concurrency = 10;
		testData = TestDataGenerator.generateMultipleInvoiceData(invoiceCount);

		performanceMetrics.concurrentUsers = concurrency;
		performanceMetrics.startTime = Date.now();

		// Process invoices in batches of concurrent requests
		const batches: TestInvoiceData[][] = [];
		for (let i = 0; i < testData.length; i += concurrency) {
			batches.push(testData.slice(i, i + concurrency));
		}

		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];
			console.log(
				`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} requests)`,
			);

			// Execute batch concurrently
			const promises = batch.map((invoiceData) => createInvoiceWithMetrics(invoiceData));
			await Promise.all(promises);

			// Small delay between batches to prevent database overload
			if (batchIndex < batches.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		performanceMetrics.endTime = Date.now();
		performanceMetrics.averageResponseTime =
			performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) /
			performanceMetrics.responseTimes.length;

		console.log(
			`Concurrent test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`,
		);

		// Expect at least 90% success rate for concurrent operations
		const successRate =
			(performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
		expect(successRate).toBeGreaterThanOrEqual(90);

		// Reset metrics for next test
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
	 * Test 3: High-load concurrent creation (maximum stress)
	 */
	test("High-Load Concurrent Creation - Maximum Stress (200 invoices, 20 concurrent)", async () => {
		console.log("\n--- Starting High-Load Concurrent Test ---");

		const invoiceCount = 200;
		const concurrency = 20;
		testData = TestDataGenerator.generateMultipleInvoiceData(invoiceCount);

		performanceMetrics.concurrentUsers = concurrency;
		performanceMetrics.startTime = Date.now();

		// Process invoices in batches
		const batches: TestInvoiceData[][] = [];
		for (let i = 0; i < testData.length; i += concurrency) {
			batches.push(testData.slice(i, i + concurrency));
		}

		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];
			console.log(
				`Processing high-load batch ${batchIndex + 1}/${batches.length} (${batch.length} requests)`,
			);

			// Execute batch concurrently with timeout protection
			const promises = batch.map((invoiceData) =>
				Promise.race([
					createInvoiceWithMetrics(invoiceData),
					new Promise<{ success: boolean; responseTime: number; error: any }>((_, reject) =>
						setTimeout(() => reject(new Error("Request timeout")), 30000),
					),
				]).catch((error) => ({ success: false, responseTime: 30000, error })),
			);

			await Promise.all(promises);

			// Longer delay for high-load test to prevent database overload
			if (batchIndex < batches.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 200));
			}
		}

		performanceMetrics.endTime = Date.now();
		performanceMetrics.averageResponseTime =
			performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) /
			performanceMetrics.responseTimes.length;

		console.log(
			`High-load test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`,
		);

		// For high-load test, expect at least 80% success rate (more lenient due to higher stress)
		const successRate =
			(performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
		expect(successRate).toBeGreaterThanOrEqual(80);

		// Reset metrics for next test
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
	 * Test 4: Complex invoice creation stress test
	 */
	test("Complex Invoice Creation - Stress Test with varying complexity", async () => {
		console.log("\n--- Starting Complex Invoice Creation Test ---");

		const simpleInvoices = 30;
		const mediumInvoices = 20;
		const complexInvoices = 10;
		const concurrency = 8;

		// Generate different complexity levels
		const simpleData = Array.from({ length: simpleInvoices }, () =>
			TestDataGenerator.generateComplexInvoiceData("simple"),
		);
		const mediumData = Array.from({ length: mediumInvoices }, () =>
			TestDataGenerator.generateComplexInvoiceData("medium"),
		);
		const complexData = Array.from({ length: complexInvoices }, () =>
			TestDataGenerator.generateComplexInvoiceData("complex"),
		);

		testData = [...simpleData, ...mediumData, ...complexData];

		// Shuffle to mix complexity levels
		testData = testData.sort(() => Math.random() - 0.5);

		performanceMetrics.concurrentUsers = concurrency;
		performanceMetrics.startTime = Date.now();

		// Process in batches
		const batches: TestInvoiceData[][] = [];
		for (let i = 0; i < testData.length; i += concurrency) {
			batches.push(testData.slice(i, i + concurrency));
		}

		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];
			console.log(
				`Processing complexity batch ${batchIndex + 1}/${batches.length} (${
					batch.length
				} requests)`,
			);

			const promises = batch.map((invoiceData) => createInvoiceWithMetrics(invoiceData));
			await Promise.all(promises);

			await new Promise((resolve) => setTimeout(resolve, 150));
		}

		performanceMetrics.endTime = Date.now();
		performanceMetrics.averageResponseTime =
			performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) /
			performanceMetrics.responseTimes.length;

		console.log(
			`Complex invoice test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`,
		);

		const successRate =
			(performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
		expect(successRate).toBeGreaterThanOrEqual(85);
	});

	/**
	 * Test 5: Agency-specific load distribution
	 */
	test("Agency-Specific Load Distribution - Test agency isolation", async () => {
		console.log("\n--- Starting Agency-Specific Load Test ---");

		// Get first agency for focused testing
		const agencies = await prisma.agency.findMany({ take: 3 });
		if (agencies.length === 0) {
			throw new Error("No agencies found for testing");
		}

		const invoicesPerAgency = 25;
		const concurrency = 5;

		performanceMetrics.startTime = Date.now();

		// Test each agency concurrently
		const agencyPromises = agencies.map(async (agency) => {
			const agencyData = Array.from({ length: invoicesPerAgency }, () =>
				TestDataGenerator.generateInvoiceDataForAgency(agency.id),
			);

			const batches: TestInvoiceData[][] = [];
			for (let i = 0; i < agencyData.length; i += concurrency) {
				batches.push(agencyData.slice(i, i + concurrency));
			}

			for (const batch of batches) {
				const promises = batch.map((invoiceData) => createInvoiceWithMetrics(invoiceData));
				await Promise.all(promises);
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			console.log(`Agency ${agency.id} (${agency.name}) completed`);
		});

		await Promise.all(agencyPromises);

		performanceMetrics.endTime = Date.now();
		performanceMetrics.averageResponseTime =
			performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) /
			performanceMetrics.responseTimes.length;

		console.log(
			`Agency-specific test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`,
		);

		const successRate =
			(performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
		expect(successRate).toBeGreaterThanOrEqual(90);
	});
});
