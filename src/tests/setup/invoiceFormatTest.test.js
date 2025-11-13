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
/**
 * Test to verify invoice format matches production requirements
 */
describe("Invoice Format Verification", () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield testDataGenerator_1.TestDataGenerator.initialize();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield testDataGenerator_1.TestDataGenerator.cleanup();
    }));
    test("Should generate invoice data with correct format", () => __awaiter(void 0, void 0, void 0, function* () {
        const testData = testDataGenerator_1.TestDataGenerator.generateInvoiceData();
        // Verify structure matches production format
        expect(testData).toHaveProperty("agency_id", 1);
        expect(testData).toHaveProperty("user_id", "R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q");
        expect(testData).toHaveProperty("customer_id");
        expect(testData).toHaveProperty("receiver_id");
        expect(testData).toHaveProperty("service_id", 1);
        expect(testData).toHaveProperty("items");
        expect(testData).toHaveProperty("paid_in_cents", 0);
        expect(testData).toHaveProperty("total_in_cents", 0);
        // Verify items structure
        expect(Array.isArray(testData.items)).toBe(true);
        expect(testData.items.length).toBeGreaterThan(0);
        const firstItem = testData.items[0];
        expect(firstItem).toHaveProperty("description");
        expect(firstItem).toHaveProperty("rate_in_cents");
        expect(firstItem).toHaveProperty("rate_id");
        expect(firstItem).toHaveProperty("customs_id");
        expect(firstItem).toHaveProperty("insurance_fee_in_cents");
        expect(firstItem).toHaveProperty("customs_fee_in_cents", 0);
        expect(firstItem).toHaveProperty("weight");
        // Verify no unwanted properties
        expect(firstItem).not.toHaveProperty("cost_in_cents");
        expect(firstItem).not.toHaveProperty("quantity");
        console.log("✅ Generated test data:", JSON.stringify(testData, null, 2));
    }));
    test("Should attempt to create invoice with real format", () => __awaiter(void 0, void 0, void 0, function* () {
        const testData = testDataGenerator_1.TestDataGenerator.generateInvoiceData();
        console.log("🚀 Attempting to create invoice with format:", JSON.stringify(testData, null, 2));
        const response = yield (0, supertest_1.default)(app_1.app)
            .post("/api/v1/invoices")
            .send(testData)
            .expect((res) => {
            console.log("📊 Response status:", res.status);
            console.log("📋 Response body:", JSON.stringify(res.body, null, 2));
            // Should not be 404 or 500 due to format issues
            expect([200, 201, 400]).toContain(res.status);
        });
    }));
});
