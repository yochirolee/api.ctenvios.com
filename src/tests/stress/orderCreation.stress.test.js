"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../../app");
const testDataGenerator_1 = require("../helpers/testDataGenerator");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Comprehensive stress test for order creation endpoint
 * Following TypeScript strict typing and performance monitoring patterns
 */
describe("Order Creation Stress Tests", () => {
    let testData;
    let performanceMetrics;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Initialize test data generator with existing database entities
        yield testDataGenerator_1.TestDataGenerator.initialize();
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
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield testDataGenerator_1.TestDataGenerator.cleanup();
        yield prisma.$disconnect();
        // Log final performance metrics
        console.log("\n=== STRESS TEST PERFORMANCE METRICS ===");
        console.log(`Total Requests: ${performanceMetrics.totalRequests}`);
        console.log(`Successful Requests: ${performanceMetrics.successfulRequests}`);
        console.log(`Failed Requests: ${performanceMetrics.failedRequests}`);
        console.log(`Success Rate: ${((performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100).toFixed(2)}%`);
        console.log(`Average Response Time: ${performanceMetrics.averageResponseTime.toFixed(2)}ms`);
        console.log(`Min Response Time: ${performanceMetrics.minResponseTime}ms`);
        console.log(`Max Response Time: ${performanceMetrics.maxResponseTime}ms`);
        console.log(`Total Test Duration: ${performanceMetrics.endTime - performanceMetrics.startTime}ms`);
        console.log(`Requests per Second: ${(performanceMetrics.totalRequests /
            ((performanceMetrics.endTime - performanceMetrics.startTime) / 1000)).toFixed(2)}`);
        console.log("=======================================\n");
    }));
    /**
     * Helper function to create order and track performance
     */
    const createOrderWithMetrics = (orderData) => __awaiter(void 0, void 0, void 0, function* () {
        const startTime = Date.now();
        try {
            const response = yield (0, supertest_1.default)(app_1.app)
                .post("/api/v1/orders")
                .send(orderData)
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
            performanceMetrics.minResponseTime = Math.min(performanceMetrics.minResponseTime, responseTime);
            performanceMetrics.maxResponseTime = Math.max(performanceMetrics.maxResponseTime, responseTime);
            return { success: true, responseTime };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            performanceMetrics.failedRequests++;
            return { success: false, responseTime, error };
        }
        finally {
            performanceMetrics.totalRequests++;
        }
    });
    /**
     * Test 1: Sequential order creation (baseline performance)
     */
    test("Sequential Order Creation - Baseline Performance (50 orders)", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n--- Starting Sequential Creation Test ---");
        const orderCount = 50;
        testData = testDataGenerator_1.TestDataGenerator.generateMultipleOrderData(orderCount);
        performanceMetrics.startTime = Date.now();
        for (let i = 0; i < testData.length; i++) {
            const result = yield createOrderWithMetrics(testData[i]);
            if (i % 10 === 0) {
                console.log(`Progress: ${i + 1}/${orderCount} orders created`);
            }
            // Small delay to prevent overwhelming the database
            yield new Promise((resolve) => setTimeout(resolve, 10));
        }
        performanceMetrics.endTime = Date.now();
        performanceMetrics.averageResponseTime =
            performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;
        console.log(`Sequential test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`);
        // Reset metrics for next test
        performanceMetrics = Object.assign(Object.assign({}, performanceMetrics), { totalRequests: 0, successfulRequests: 0, failedRequests: 0, responseTimes: [], minResponseTime: Infinity, maxResponseTime: 0 });
    }));
    /**
     * Test 2: Concurrent order creation (stress test)
     */
    test("Concurrent Order Creation - Stress Test (100 orders, 10 concurrent)", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n--- Starting Concurrent Creation Test ---");
        const orderCount = 100;
        const concurrency = 10;
        testData = testDataGenerator_1.TestDataGenerator.generateMultipleOrderData(orderCount);
        performanceMetrics.concurrentUsers = concurrency;
        performanceMetrics.startTime = Date.now();
        // Process orders in batches of concurrent requests
        const batches = [];
        for (let i = 0; i < testData.length; i += concurrency) {
            batches.push(testData.slice(i, i + concurrency));
        }
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} requests)`);
            // Execute batch concurrently
            const promises = batch.map((orderData) => createOrderWithMetrics(orderData));
            yield Promise.all(promises);
            // Small delay between batches to prevent database overload
            if (batchIndex < batches.length - 1) {
                yield new Promise((resolve) => setTimeout(resolve, 100));
            }
        }
        performanceMetrics.endTime = Date.now();
        performanceMetrics.averageResponseTime =
            performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;
        console.log(`Concurrent test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`);
        // Expect at least 90% success rate for concurrent operations
        const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
        expect(successRate).toBeGreaterThanOrEqual(90);
        // Reset metrics for next test
        performanceMetrics = Object.assign(Object.assign({}, performanceMetrics), { totalRequests: 0, successfulRequests: 0, failedRequests: 0, responseTimes: [], minResponseTime: Infinity, maxResponseTime: 0 });
    }));
    /**
     * Test 3: High-load concurrent creation (maximum stress)
     */
    test("High-Load Concurrent Creation - Maximum Stress (200 orders, 20 concurrent)", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n--- Starting High-Load Concurrent Test ---");
        const orderCount = 200;
        const concurrency = 20;
        testData = testDataGenerator_1.TestDataGenerator.generateMultipleOrderData(orderCount);
        performanceMetrics.concurrentUsers = concurrency;
        performanceMetrics.startTime = Date.now();
        // Process orders in batches
        const batches = [];
        for (let i = 0; i < testData.length; i += concurrency) {
            batches.push(testData.slice(i, i + concurrency));
        }
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`Processing high-load batch ${batchIndex + 1}/${batches.length} (${batch.length} requests)`);
            // Execute batch concurrently with timeout protection
            const promises = batch.map((orderData) => Promise.race([
                createOrderWithMetrics(orderData),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), 30000)),
            ]).catch((error) => ({ success: false, responseTime: 30000, error })));
            yield Promise.all(promises);
            // Longer delay for high-load test to prevent database overload
            if (batchIndex < batches.length - 1) {
                yield new Promise((resolve) => setTimeout(resolve, 200));
            }
        }
        performanceMetrics.endTime = Date.now();
        performanceMetrics.averageResponseTime =
            performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;
        console.log(`High-load test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`);
        // For high-load test, expect at least 80% success rate (more lenient due to higher stress)
        const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
        expect(successRate).toBeGreaterThanOrEqual(80);
        // Reset metrics for next test
        performanceMetrics = Object.assign(Object.assign({}, performanceMetrics), { totalRequests: 0, successfulRequests: 0, failedRequests: 0, responseTimes: [], minResponseTime: Infinity, maxResponseTime: 0 });
    }));
    /**
     * Test 4: Complex order creation stress test
     */
    test("Complex Order Creation - Stress Test with varying complexity", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n--- Starting Complex Order Creation Test ---");
        const simpleOrders = 30;
        const mediumOrders = 20;
        const complexOrders = 10;
        const concurrency = 8;
        // Generate different complexity levels
        const simpleData = Array.from({ length: simpleOrders }, () => testDataGenerator_1.TestDataGenerator.generateComplexOrderData("simple"));
        const mediumData = Array.from({ length: mediumOrders }, () => testDataGenerator_1.TestDataGenerator.generateComplexOrderData("medium"));
        const complexData = Array.from({ length: complexOrders }, () => testDataGenerator_1.TestDataGenerator.generateComplexOrderData("complex"));
        testData = [...simpleData, ...mediumData, ...complexData];
        // Shuffle to mix complexity levels
        testData = testData.sort(() => Math.random() - 0.5);
        performanceMetrics.concurrentUsers = concurrency;
        performanceMetrics.startTime = Date.now();
        // Process in batches
        const batches = [];
        for (let i = 0; i < testData.length; i += concurrency) {
            batches.push(testData.slice(i, i + concurrency));
        }
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`Processing complexity batch ${batchIndex + 1}/${batches.length} (${batch.length} requests)`);
            const promises = batch.map((orderData) => createOrderWithMetrics(orderData));
            yield Promise.all(promises);
            yield new Promise((resolve) => setTimeout(resolve, 150));
        }
        performanceMetrics.endTime = Date.now();
        performanceMetrics.averageResponseTime =
            performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;
        console.log(`Complex order test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`);
        const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
        expect(successRate).toBeGreaterThanOrEqual(85);
    }));
    /**
     * Test 5: Agency-specific load distribution
     */
    test("Agency-Specific Load Distribution - Test agency isolation", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n--- Starting Agency-Specific Load Test ---");
        // Get first agency for focused testing
        const agencies = yield prisma.agency.findMany({ take: 3 });
        if (agencies.length === 0) {
            throw new Error("No agencies found for testing");
        }
        const ordersPerAgency = 25;
        const concurrency = 5;
        performanceMetrics.startTime = Date.now();
        // Test each agency concurrently
        const agencyPromises = agencies.map((agency) => __awaiter(void 0, void 0, void 0, function* () {
            const agencyData = Array.from({ length: ordersPerAgency }, () => testDataGenerator_1.TestDataGenerator.generateOrderDataForAgency(agency.id));
            const batches = [];
            for (let i = 0; i < agencyData.length; i += concurrency) {
                batches.push(agencyData.slice(i, i + concurrency));
            }
            for (const batch of batches) {
                const promises = batch.map((orderData) => createOrderWithMetrics(orderData));
                yield Promise.all(promises);
                yield new Promise((resolve) => setTimeout(resolve, 100));
            }
            console.log(`Agency ${agency.id} (${agency.name}) completed`);
        }));
        yield Promise.all(agencyPromises);
        performanceMetrics.endTime = Date.now();
        performanceMetrics.averageResponseTime =
            performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;
        console.log(`Agency-specific test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`);
        const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
        expect(successRate).toBeGreaterThanOrEqual(90);
    }));
});
