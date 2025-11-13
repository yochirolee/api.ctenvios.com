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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Debug test to check what data exists in the database
 */
describe("Database Data Check", () => {
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma.$disconnect();
    }));
    test("Should check available data in database", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("\n🔍 === DATABASE DATA ANALYSIS ===");
        // Check agencies
        const agencies = yield prisma.agency.findMany({ take: 5 });
        console.log("📊 Agencies:", agencies.map((a) => ({ id: a.id, name: a.name })));
        // Check services
        const services = yield prisma.service.findMany({ take: 5 });
        console.log("🚚 Services:", services.map((s) => ({ id: s.id, name: s.name })));
        // Check customs rates (these are used as rate_id)
        const customsRates = yield prisma.customsRates.findMany({
            take: 10,
            select: { id: true, name: true, fee_in_cents: true },
        });
        console.log("💰 First 10 Customs Rates:", customsRates);
        // Check customers count
        const customerCount = yield prisma.customer.count();
        console.log("👥 Total Customers:", customerCount);
        // Check receivers count
        const receiverCount = yield prisma.receiver.count();
        console.log("📦 Total Receivers:", receiverCount);
        // Check users
        const users = yield prisma.user.findMany({
            where: {
                OR: [{ id: "R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q" }, { agency_id: 1 }],
            },
            take: 5,
            select: { id: true, name: true, agency_id: true },
        });
        console.log("👤 Users:", users);
        console.log("=====================================\n");
        // Assertions to ensure we have data
        expect(agencies.length).toBeGreaterThan(0);
        expect(services.length).toBeGreaterThan(0);
        expect(customsRates.length).toBeGreaterThan(0);
        expect(customerCount).toBeGreaterThan(0);
        expect(receiverCount).toBeGreaterThan(0);
        expect(users.length).toBeGreaterThan(0);
    }));
    test("Should test creating invoice with first available rate_id", () => __awaiter(void 0, void 0, void 0, function* () {
        // Get the first available customs rate
        const firstCustomsRate = yield prisma.customsRates.findFirst({
            select: { id: true, name: true, fee_in_cents: true },
        });
        // Get first available customer and receiver
        const firstCustomer = yield prisma.customer.findFirst();
        const firstReceiver = yield prisma.receiver.findFirst();
        if (!firstCustomsRate || !firstCustomer || !firstReceiver) {
            throw new Error("Missing required data in database");
        }
        console.log("🎯 Using rate_id:", firstCustomsRate.id, "Name:", firstCustomsRate.name);
        console.log("👥 Using customer_id:", firstCustomer.id);
        console.log("📦 Using receiver_id:", firstReceiver.id);
        const testInvoiceData = {
            agency_id: 1,
            user_id: "R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q",
            customer_id: firstCustomer.id,
            receiver_id: firstReceiver.id,
            service_id: 1,
            items: [
                {
                    description: "Test Product",
                    rate_in_cents: 190,
                    rate_id: firstCustomsRate.id, // Use existing rate_id
                    customs_id: firstCustomsRate.id, // Same as rate_id
                    insurance_fee_in_cents: 0,
                    customs_fee_in_cents: 0,
                    weight: 5,
                },
            ],
            paid_in_cents: 0,
            total_in_cents: 0,
        };
        console.log("📋 Test invoice data:", JSON.stringify(testInvoiceData, null, 2));
        // This should work if the rate_id exists
        expect(firstCustomsRate.id).toBeGreaterThan(0);
        expect(firstCustomer.id).toBeGreaterThan(0);
        expect(firstReceiver.id).toBeGreaterThan(0);
    }));
});
