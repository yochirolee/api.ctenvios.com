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
/**
 * Basic stress test with minimal database queries
 * Uses hardcoded IDs that we know exist
 */
describe("Basic Stress Test - Minimal DB Queries", () => {
    const createInvoice = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (customerOffset = 0, receiverOffset = 0) {
        var _a;
        const testInvoiceData = {
            agency_id: 1,
            user_id: "R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q",
            customer_id: 1 + customerOffset, // Vary customer IDs slightly
            receiver_id: 1 + receiverOffset, // Vary receiver IDs slightly
            service_id: 1,
            items: [
                {
                    description: `Test Product ${Date.now()}`,
                    rate_in_cents: 190,
                    rate_id: 1,
                    customs_id: 1,
                    insurance_fee_in_cents: 0,
                    customs_fee_in_cents: 0,
                    weight: 5,
                },
            ],
            paid_in_cents: 0,
            total_in_cents: 0,
        };
        const startTime = Date.now();
        try {
            const response = yield (0, supertest_1.default)(app_1.app).post("/api/v1/invoices").send(testInvoiceData);
            const responseTime = Date.now() - startTime;
            return {
                success: response.status === 200 || response.status === 201,
                status: response.status,
                responseTime,
                invoiceId: (_a = response.body) === null || _a === void 0 ? void 0 : _a.id,
                error: response.status >= 400 ? response.body : null,
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                success: false,
                status: 500,
                responseTime,
                error: error.message,
            };
        }
    });
    test("Sequential Invoice Creation - 20 invoices", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n🔄 Starting Sequential Creation Test (20 invoices)");
        const results = [];
        const startTime = Date.now();
        for (let i = 0; i < 20; i++) {
            const result = yield createInvoice(i % 10, i % 5); // Vary IDs slightly
            results.push(result);
            if (i % 5 === 0) {
                console.log(`📈 Progress: ${i + 1}/20 invoices`);
            }
            // Small delay to avoid overwhelming DB
            yield new Promise((resolve) => setTimeout(resolve, 100));
        }
        const endTime = Date.now();
        const successCount = results.filter((r) => r.success).length;
        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
        console.log(`✅ Sequential test completed: ${successCount}/20 successful`);
        console.log(`⏱️  Average response time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`⏰ Total duration: ${endTime - startTime}ms`);
        console.log(`🔥 Throughput: ${(20 / ((endTime - startTime) / 1000)).toFixed(2)} req/sec`);
        // Log any errors
        const errors = results.filter((r) => !r.success);
        if (errors.length > 0) {
            console.log("❌ Errors:", errors.map((e) => ({ status: e.status, error: e.error })));
        }
        // Expect at least 80% success rate
        expect(successCount / 20).toBeGreaterThanOrEqual(0.8);
    }));
    test("Concurrent Invoice Creation - 30 invoices, 5 concurrent", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n🚀 Starting Concurrent Creation Test (30 invoices, 5 concurrent)");
        const concurrency = 5;
        const totalInvoices = 30;
        const results = [];
        const startTime = Date.now();
        // Process in batches
        for (let batch = 0; batch < totalInvoices / concurrency; batch++) {
            console.log(`🔄 Processing batch ${batch + 1}/${totalInvoices / concurrency}`);
            const batchPromises = [];
            for (let i = 0; i < concurrency; i++) {
                const invoiceIndex = batch * concurrency + i;
                batchPromises.push(createInvoice(invoiceIndex % 20, invoiceIndex % 10));
            }
            const batchResults = yield Promise.all(batchPromises);
            results.push(...batchResults);
            // Delay between batches to prevent DB overload
            if (batch < totalInvoices / concurrency - 1) {
                yield new Promise((resolve) => setTimeout(resolve, 200));
            }
        }
        const endTime = Date.now();
        const successCount = results.filter((r) => r.success).length;
        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
        console.log(`✅ Concurrent test completed: ${successCount}/${totalInvoices} successful`);
        console.log(`⏱️  Average response time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`⏰ Total duration: ${endTime - startTime}ms`);
        console.log(`🔥 Throughput: ${(totalInvoices / ((endTime - startTime) / 1000)).toFixed(2)} req/sec`);
        // Log any errors
        const errors = results.filter((r) => !r.success);
        if (errors.length > 0) {
            console.log("❌ Errors:", errors.slice(0, 3).map((e) => ({ status: e.status, error: e.error })));
            if (errors.length > 3) {
                console.log(`... and ${errors.length - 3} more errors`);
            }
        }
        // Expect at least 70% success rate for concurrent operations
        const successRate = successCount / totalInvoices;
        console.log(`📊 Success rate: ${(successRate * 100).toFixed(1)}%`);
        expect(successRate).toBeGreaterThanOrEqual(0.7);
    }));
});
