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
 * Realistic stress test using your actual production data
 * Agency ID: 1, User ID: R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q
 * Tests with real customers and receivers from your database
 */
describe("Realistic Order Creation Stress Tests", () => {
    let performanceMetrics;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        console.log("🚀 Starting Realistic Stress Tests with Production Data");
        console.log("📊 Agency ID: 1");
        console.log("👤 User ID: R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q");
        // Initialize with your real data
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
            hblCodesGenerated: [],
            duplicateHblErrors: 0,
            startTime: 0,
            endTime: 0,
        };
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield testDataGenerator_1.TestDataGenerator.cleanup();
        yield prisma.$disconnect();
        // Log comprehensive performance metrics
        console.log("\n🎯 === REALISTIC STRESS TEST RESULTS ===");
        console.log(`📈 Total Requests: ${performanceMetrics.totalRequests}`);
        console.log(`✅ Successful Requests: ${performanceMetrics.successfulRequests}`);
        console.log(`❌ Failed Requests: ${performanceMetrics.failedRequests}`);
        console.log(`📊 Success Rate: ${((performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100).toFixed(2)}%`);
        console.log(`⏱️  Average Response Time: ${performanceMetrics.averageResponseTime.toFixed(2)}ms`);
        console.log(`🚀 Min Response Time: ${performanceMetrics.minResponseTime}ms`);
        console.log(`🐌 Max Response Time: ${performanceMetrics.maxResponseTime}ms`);
        console.log(`🔢 HBL Codes Generated: ${performanceMetrics.hblCodesGenerated.length}`);
        console.log(`⚠️  Duplicate HBL Errors: ${performanceMetrics.duplicateHblErrors}`);
        console.log(`⏰ Total Test Duration: ${performanceMetrics.endTime - performanceMetrics.startTime}ms`);
        console.log(`🔥 Requests per Second: ${(performanceMetrics.totalRequests /
            ((performanceMetrics.endTime - performanceMetrics.startTime) / 1000)).toFixed(2)}`);
        console.log("==========================================\n");
    }));
    /**
     * Helper function to create order with comprehensive metrics tracking
     */
    const createOrderWithMetrics = (orderData) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        const startTime = Date.now();
        try {
            const response = yield (0, supertest_1.default)(app_1.app)
                .post("/api/v1/orders")
                .send(orderData)
                .expect((res) => {
                if (res.status !== 200 && res.status !== 201) {
                    throw new Error(`Expected 200 or 201, got ${res.status}`);
                }
            });
            const responseTime = Date.now() - startTime;
            // Extract HBL codes from response
            const hblCodes = ((_a = response.body.items) === null || _a === void 0 ? void 0 : _a.map((item) => item.hbl)) || [];
            // Update metrics
            performanceMetrics.successfulRequests++;
            performanceMetrics.responseTimes.push(responseTime);
            performanceMetrics.hblCodesGenerated.push(...hblCodes);
            performanceMetrics.minResponseTime = Math.min(performanceMetrics.minResponseTime, responseTime);
            performanceMetrics.maxResponseTime = Math.max(performanceMetrics.maxResponseTime, responseTime);
            return { success: true, responseTime, hblCodes };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            performanceMetrics.failedRequests++;
            // Track duplicate HBL errors specifically
            if (((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("duplicate")) || ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("HBL"))) {
                performanceMetrics.duplicateHblErrors++;
            }
            return { success: false, responseTime, error };
        }
        finally {
            performanceMetrics.totalRequests++;
        }
    });
    /**
     * Test 1: Realistic Sequential Load - Your Production Environment
     */
    test("Production Sequential Load - 100 orders with real data", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n🔄 Starting Production Sequential Load Test");
        const orderCount = 100;
        const testData = testDataGenerator_1.TestDataGenerator.generateMultipleOrderData(orderCount);
        performanceMetrics.startTime = Date.now();
        for (let i = 0; i < testData.length; i++) {
            const result = yield createOrderWithMetrics(testData[i]);
            if (i % 20 === 0) {
                console.log(`📈 Progress: ${i + 1}/${orderCount} orders created (${(((i + 1) / orderCount) * 100).toFixed(1)}%)`);
            }
            // Small delay to simulate realistic usage
            yield new Promise((resolve) => setTimeout(resolve, 50));
        }
        performanceMetrics.endTime = Date.now();
        performanceMetrics.averageResponseTime =
            performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;
        console.log(`✅ Sequential test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`);
        // Expect very high success rate for sequential operations
        const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
        expect(successRate).toBeGreaterThanOrEqual(95);
        // Reset for next test
        performanceMetrics = Object.assign(Object.assign({}, performanceMetrics), { totalRequests: 0, successfulRequests: 0, failedRequests: 0, responseTimes: [], minResponseTime: Infinity, maxResponseTime: 0 });
    }));
    /**
     * Test 2: Realistic Concurrent Load - Simulating Multiple Users
     */
    test("Production Concurrent Load - 150 orders, 15 concurrent users", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n🚀 Starting Production Concurrent Load Test");
        const orderCount = 150;
        const concurrency = 15;
        const testData = testDataGenerator_1.TestDataGenerator.generateMultipleOrderData(orderCount);
        performanceMetrics.startTime = Date.now();
        // Process in concurrent batches
        const batches = [];
        for (let i = 0; i < testData.length; i += concurrency) {
            batches.push(testData.slice(i, i + concurrency));
        }
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} concurrent requests)`);
            // Execute batch concurrently
            const promises = batch.map((orderData) => createOrderWithMetrics(orderData));
            const results = yield Promise.all(promises);
            // Log any errors in this batch
            const batchErrors = results.filter((r) => !r.success);
            if (batchErrors.length > 0) {
                console.log(`⚠️  Batch ${batchIndex + 1} had ${batchErrors.length} errors`);
            }
            // Realistic delay between batches
            if (batchIndex < batches.length - 1) {
                yield new Promise((resolve) => setTimeout(resolve, 200));
            }
        }
        performanceMetrics.endTime = Date.now();
        performanceMetrics.averageResponseTime =
            performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;
        console.log(`✅ Concurrent test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`);
        // Expect good success rate for concurrent operations with your real data
        const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
        expect(successRate).toBeGreaterThanOrEqual(85);
        // Check for HBL uniqueness
        const uniqueHbls = new Set(performanceMetrics.hblCodesGenerated);
        const duplicateRate = ((performanceMetrics.hblCodesGenerated.length - uniqueHbls.size) /
            performanceMetrics.hblCodesGenerated.length) *
            100;
        console.log(`🔢 HBL Duplicate Rate: ${duplicateRate.toFixed(2)}%`);
        expect(duplicateRate).toBeLessThan(5); // Less than 5% duplicates acceptable
        // Reset for next test
        performanceMetrics = Object.assign(Object.assign({}, performanceMetrics), { totalRequests: 0, successfulRequests: 0, failedRequests: 0, responseTimes: [], minResponseTime: Infinity, maxResponseTime: 0, hblCodesGenerated: [] });
    }));
    /**
     * Test 3: Peak Load Simulation - Maximum realistic concurrent load
     */
    test("Production Peak Load - 300 orders, 25 concurrent users", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n🔥 Starting Production Peak Load Test");
        const orderCount = 300;
        const concurrency = 25;
        const testData = testDataGenerator_1.TestDataGenerator.generateMultipleOrderData(orderCount);
        performanceMetrics.startTime = Date.now();
        // Process in concurrent batches with timeout protection
        const batches = [];
        for (let i = 0; i < testData.length; i += concurrency) {
            batches.push(testData.slice(i, i + concurrency));
        }
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`🔥 Processing peak batch ${batchIndex + 1}/${batches.length} (${batch.length} concurrent requests)`);
            // Execute with timeout protection
            const promises = batch.map((orderData) => Promise.race([
                createOrderWithMetrics(orderData),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout (45s)")), 45000)),
            ]).catch((error) => ({ success: false, responseTime: 45000, error })));
            const results = yield Promise.all(promises);
            // Log batch performance
            const batchSuccessRate = (results.filter((r) => r.success).length / results.length) * 100;
            console.log(`📊 Batch ${batchIndex + 1} success rate: ${batchSuccessRate.toFixed(1)}%`);
            // Longer delay for peak load to prevent database overwhelming
            if (batchIndex < batches.length - 1) {
                yield new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
        performanceMetrics.endTime = Date.now();
        performanceMetrics.averageResponseTime =
            performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;
        console.log(`🔥 Peak load test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`);
        // More lenient success rate for peak load
        const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
        expect(successRate).toBeGreaterThanOrEqual(75);
        // Performance benchmarks for your system
        expect(performanceMetrics.averageResponseTime).toBeLessThan(10000); // Less than 10 seconds average
        console.log(`🎯 Peak load performance: ${successRate.toFixed(1)}% success, ${performanceMetrics.averageResponseTime.toFixed(0)}ms avg response`);
    }));
    /**
     * Test 4: Real-world usage pattern simulation
     */
    test("Production Usage Pattern - Mixed complexity orders", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n📊 Starting Real-world Usage Pattern Test");
        // Simulate real usage: 70% simple, 25% medium, 5% complex
        const simpleCount = 70;
        const mediumCount = 25;
        const complexCount = 5;
        const concurrency = 12;
        const simpleData = Array.from({ length: simpleCount }, () => testDataGenerator_1.TestDataGenerator.generateComplexOrderData("simple"));
        const mediumData = Array.from({ length: mediumCount }, () => testDataGenerator_1.TestDataGenerator.generateComplexOrderData("medium"));
        const complexData = Array.from({ length: complexCount }, () => testDataGenerator_1.TestDataGenerator.generateComplexOrderData("complex"));
        const testData = [...simpleData, ...mediumData, ...complexData];
        // Shuffle to simulate random order
        testData.sort(() => Math.random() - 0.5);
        performanceMetrics.startTime = Date.now();
        const batches = [];
        for (let i = 0; i < testData.length; i += concurrency) {
            batches.push(testData.slice(i, i + concurrency));
        }
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`📊 Processing usage batch ${batchIndex + 1}/${batches.length}`);
            const promises = batch.map((orderData) => createOrderWithMetrics(orderData));
            yield Promise.all(promises);
            // Variable delays to simulate real usage patterns
            const delay = Math.floor(Math.random() * 300) + 100; // 100-400ms
            yield new Promise((resolve) => setTimeout(resolve, delay));
        }
        performanceMetrics.endTime = Date.now();
        performanceMetrics.averageResponseTime =
            performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;
        console.log(`📊 Usage pattern test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`);
        const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
        expect(successRate).toBeGreaterThanOrEqual(90);
        console.log(`🎯 Real-world pattern: ${successRate.toFixed(1)}% success rate`);
    }));
});
