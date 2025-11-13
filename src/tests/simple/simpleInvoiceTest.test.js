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
 * Simple test to verify invoice creation works with known IDs
 */
describe("Simple Invoice Creation Test", () => {
    test("Should create invoice with fixed IDs that we know exist", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const testInvoiceData = {
            agency_id: 1,
            user_id: "R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q",
            customer_id: 1, // Use customer ID 1 (should exist)
            receiver_id: 1, // Use receiver ID 1 (should exist)
            service_id: 1,
            items: [
                {
                    description: "Test Product",
                    rate_in_cents: 190,
                    rate_id: 1, // Use rate_id = 1 which we know exists
                    customs_id: 1, // Same as rate_id
                    insurance_fee_in_cents: 0,
                    customs_fee_in_cents: 0,
                    weight: 5,
                },
            ],
            paid_in_cents: 0,
            total_in_cents: 0,
        };
        console.log("🚀 Testing with data:", JSON.stringify(testInvoiceData, null, 2));
        const response = yield (0, supertest_1.default)(app_1.app)
            .post("/api/v1/invoices")
            .send(testInvoiceData)
            .expect((res) => {
            console.log("📊 Response status:", res.status);
            console.log("📋 Response body:", JSON.stringify(res.body, null, 2));
            if (res.status === 500) {
                console.log("❌ Error details:", res.body);
            }
            // Should be successful now
            expect([200, 201]).toContain(res.status);
        });
        if (response.status === 200 || response.status === 201) {
            console.log("✅ Invoice created successfully!");
            console.log("📄 Invoice ID:", response.body.id);
            console.log("🔢 HBL codes:", (_a = response.body.items) === null || _a === void 0 ? void 0 : _a.map((item) => item.hbl));
        }
    }));
});
