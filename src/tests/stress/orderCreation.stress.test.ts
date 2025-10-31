import request from "supertest";
import { app } from "../../app";
import { TestDataGenerator, TestOrderData } from "../helpers/testDataGenerator";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Comprehensive stress test for order creation endpoint
 * Following TypeScript strict typing and performance monitoring patterns
 */
describe("Order Creation Stress Tests", () => {
   let testData: TestOrderData[];
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
         `Success Rate: ${((performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100).toFixed(
            2
         )}%`
      );
      console.log(`Average Response Time: ${performanceMetrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`Min Response Time: ${performanceMetrics.minResponseTime}ms`);
      console.log(`Max Response Time: ${performanceMetrics.maxResponseTime}ms`);
      console.log(`Total Test Duration: ${performanceMetrics.endTime - performanceMetrics.startTime}ms`);
      console.log(
         `Requests per Second: ${(
            performanceMetrics.totalRequests /
            ((performanceMetrics.endTime - performanceMetrics.startTime) / 1000)
         ).toFixed(2)}`
      );
      console.log("=======================================\n");
   });

   /**
    * Helper function to create order and track performance
    */
   const createOrderWithMetrics = async (
      orderData: TestOrderData
   ): Promise<{ success: boolean; responseTime: number; error?: any }> => {
      const startTime = Date.now();

      try {
         const response = await request(app)
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
      } catch (error) {
         const responseTime = Date.now() - startTime;
         performanceMetrics.failedRequests++;
         return { success: false, responseTime, error };
      } finally {
         performanceMetrics.totalRequests++;
      }
   };

   /**
    * Test 1: Sequential order creation (baseline performance)
    */
   test("Sequential Order Creation - Baseline Performance (50 orders)", async () => {
      console.log("\n--- Starting Sequential Creation Test ---");

      const orderCount = 50;
      testData = TestDataGenerator.generateMultipleOrderData(orderCount);

      performanceMetrics.startTime = Date.now();

      for (let i = 0; i < testData.length; i++) {
         const result = await createOrderWithMetrics(testData[i]);

         if (i % 10 === 0) {
            console.log(`Progress: ${i + 1}/${orderCount} orders created`);
         }

         // Small delay to prevent overwhelming the database
         await new Promise((resolve) => setTimeout(resolve, 10));
      }

      performanceMetrics.endTime = Date.now();
      performanceMetrics.averageResponseTime =
         performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;

      console.log(
         `Sequential test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`
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
    * Test 2: Concurrent order creation (stress test)
    */
   test("Concurrent Order Creation - Stress Test (100 orders, 10 concurrent)", async () => {
      console.log("\n--- Starting Concurrent Creation Test ---");

      const orderCount = 100;
      const concurrency = 10;
      testData = TestDataGenerator.generateMultipleOrderData(orderCount);

      performanceMetrics.concurrentUsers = concurrency;
      performanceMetrics.startTime = Date.now();

      // Process orders in batches of concurrent requests
      const batches: TestOrderData[][] = [];
      for (let i = 0; i < testData.length; i += concurrency) {
         batches.push(testData.slice(i, i + concurrency));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
         const batch = batches[batchIndex];
         console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} requests)`);

         // Execute batch concurrently
         const promises = batch.map((orderData) => createOrderWithMetrics(orderData));
         await Promise.all(promises);

         // Small delay between batches to prevent database overload
         if (batchIndex < batches.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
         }
      }

      performanceMetrics.endTime = Date.now();
      performanceMetrics.averageResponseTime =
         performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;

      console.log(
         `Concurrent test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`
      );

      // Expect at least 90% success rate for concurrent operations
      const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
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
   test("High-Load Concurrent Creation - Maximum Stress (200 orders, 20 concurrent)", async () => {
      console.log("\n--- Starting High-Load Concurrent Test ---");

      const orderCount = 200;
      const concurrency = 20;
      testData = TestDataGenerator.generateMultipleOrderData(orderCount);

      performanceMetrics.concurrentUsers = concurrency;
      performanceMetrics.startTime = Date.now();

      // Process orders in batches
      const batches: TestOrderData[][] = [];
      for (let i = 0; i < testData.length; i += concurrency) {
         batches.push(testData.slice(i, i + concurrency));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
         const batch = batches[batchIndex];
         console.log(`Processing high-load batch ${batchIndex + 1}/${batches.length} (${batch.length} requests)`);

         // Execute batch concurrently with timeout protection
         const promises = batch.map((orderData) =>
            Promise.race([
               createOrderWithMetrics(orderData),
               new Promise<{ success: boolean; responseTime: number; error: any }>((_, reject) =>
                  setTimeout(() => reject(new Error("Request timeout")), 30000)
               ),
            ]).catch((error) => ({ success: false, responseTime: 30000, error }))
         );

         await Promise.all(promises);

         // Longer delay for high-load test to prevent database overload
         if (batchIndex < batches.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 200));
         }
      }

      performanceMetrics.endTime = Date.now();
      performanceMetrics.averageResponseTime =
         performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;

      console.log(
         `High-load test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`
      );

      // For high-load test, expect at least 80% success rate (more lenient due to higher stress)
      const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
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
    * Test 4: Complex order creation stress test
    */
   test("Complex Order Creation - Stress Test with varying complexity", async () => {
      console.log("\n--- Starting Complex Order Creation Test ---");

      const simpleOrders = 30;
      const mediumOrders = 20;
      const complexOrders = 10;
      const concurrency = 8;

      // Generate different complexity levels
      const simpleData = Array.from({ length: simpleOrders }, () =>
         TestDataGenerator.generateComplexOrderData("simple")
      );
      const mediumData = Array.from({ length: mediumOrders }, () =>
         TestDataGenerator.generateComplexOrderData("medium")
      );
      const complexData = Array.from({ length: complexOrders }, () =>
         TestDataGenerator.generateComplexOrderData("complex")
      );

      testData = [...simpleData, ...mediumData, ...complexData];

      // Shuffle to mix complexity levels
      testData = testData.sort(() => Math.random() - 0.5);

      performanceMetrics.concurrentUsers = concurrency;
      performanceMetrics.startTime = Date.now();

      // Process in batches
      const batches: TestOrderData[][] = [];
      for (let i = 0; i < testData.length; i += concurrency) {
         batches.push(testData.slice(i, i + concurrency));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
         const batch = batches[batchIndex];
         console.log(`Processing complexity batch ${batchIndex + 1}/${batches.length} (${batch.length} requests)`);

         const promises = batch.map((orderData) => createOrderWithMetrics(orderData));
         await Promise.all(promises);

         await new Promise((resolve) => setTimeout(resolve, 150));
      }

      performanceMetrics.endTime = Date.now();
      performanceMetrics.averageResponseTime =
         performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;

      console.log(
         `Complex order test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`
      );

      const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
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

      const ordersPerAgency = 25;
      const concurrency = 5;

      performanceMetrics.startTime = Date.now();

      // Test each agency concurrently
      const agencyPromises = agencies.map(async (agency) => {
         const agencyData = Array.from({ length: ordersPerAgency }, () =>
            TestDataGenerator.generateOrderDataForAgency(agency.id)
         );

         const batches: TestOrderData[][] = [];
         for (let i = 0; i < agencyData.length; i += concurrency) {
            batches.push(agencyData.slice(i, i + concurrency));
         }

         for (const batch of batches) {
            const promises = batch.map((orderData) => createOrderWithMetrics(orderData));
            await Promise.all(promises);
            await new Promise((resolve) => setTimeout(resolve, 100));
         }

         console.log(`Agency ${agency.id} (${agency.name}) completed`);
      });

      await Promise.all(agencyPromises);

      performanceMetrics.endTime = Date.now();
      performanceMetrics.averageResponseTime =
         performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;

      console.log(
         `Agency-specific test completed: ${performanceMetrics.successfulRequests}/${performanceMetrics.totalRequests} successful`
      );

      const successRate = (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100;
      expect(successRate).toBeGreaterThanOrEqual(90);
   });
});
