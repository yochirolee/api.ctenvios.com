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
 * Light stress test - Very conservative to avoid DB overload
 * Only creates invoices, uses existing customer/receiver IDs
 */
describe("Light Stress Test - Conservative Load", () => {
    const createSingleInvoice = (testId) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        const testInvoiceData = {
            agency_id: 1,
            user_id: "R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q",
            customer_id: Math.max(1, (testId % 100) + 1), // Use customer IDs 1-100
            receiver_id: Math.max(1, (testId % 50) + 1), // Use receiver IDs 1-50
            service_id: 1,
            items: [
                {
                    description: `Test Product ${testId}`,
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
                hblCodes: ((_c = (_b = response.body) === null || _b === void 0 ? void 0 : _b.items) === null || _c === void 0 ? void 0 : _c.map((item) => item.hbl)) || [],
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
    test("Very Light Load - 5 invoices sequentially", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n🔄 Starting Very Light Load Test (5 invoices)");
        console.log("📝 Note: Only creating invoices, using existing customer/receiver IDs");
        const results = [];
        const startTime = Date.now();
        for (let i = 0; i < 5; i++) {
            console.log(`📈 Creating invoice ${i + 1}/5...`);
            const result = yield createSingleInvoice(i);
            results.push(result);
            if (result.success) {
                console.log(`✅ Invoice ${result.invoiceId} created with HBL: ${result.hblCodes.join(", ")}`);
            }
            else {
                console.log(`❌ Failed: Status ${result.status}, Error:`, result.error);
            }
            // Long delay to be very conservative
            yield new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
        }
        const endTime = Date.now();
        const successCount = results.filter((r) => r.success).length;
        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
        console.log(`\n📊 === LIGHT STRESS TEST RESULTS ===`);
        console.log(`✅ Successful: ${successCount}/5 invoices`);
        console.log(`⏱️  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`⏰ Total Duration: ${endTime - startTime}ms`);
        console.log(`🔥 Throughput: ${(5 / ((endTime - startTime) / 1000)).toFixed(2)} req/sec`);
        const errors = results.filter((r) => !r.success);
        if (errors.length > 0) {
            console.log(`❌ Errors:`, errors.map((e) => ({ status: e.status, error: e.error })));
        }
        // Should succeed with very light load
        expect(successCount).toBeGreaterThanOrEqual(4); // At least 4/5 should work
    }));
    test("Moderate Load - 10 invoices with longer delays", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n🚀 Starting Moderate Load Test (10 invoices)");
        const results = [];
        const startTime = Date.now();
        for (let i = 0; i < 10; i++) {
            const result = yield createSingleInvoice(i + 10); // Different customer/receiver IDs
            results.push(result);
            if (i % 3 === 0) {
                console.log(`📈 Progress: ${i + 1}/10 invoices`);
            }
            // Conservative delay
            yield new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5 second delay
        }
        const endTime = Date.now();
        const successCount = results.filter((r) => r.success).length;
        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
        console.log(`\n📊 === MODERATE LOAD TEST RESULTS ===`);
        console.log(`✅ Successful: ${successCount}/10 invoices`);
        console.log(`⏱️  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`⏰ Total Duration: ${endTime - startTime}ms`);
        console.log(`🔥 Throughput: ${(10 / ((endTime - startTime) / 1000)).toFixed(2)} req/sec`);
        const successRate = successCount / 10;
        console.log(`📊 Success Rate: ${(successRate * 100).toFixed(1)}%`);
        // Should have good success rate with moderate load
        expect(successRate).toBeGreaterThanOrEqual(0.8); // 80% success rate
    }));
});
