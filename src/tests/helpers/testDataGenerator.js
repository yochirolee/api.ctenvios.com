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
exports.TestDataGenerator = void 0;
const faker_1 = require("@faker-js/faker");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Generate realistic test data for order creation
 * Following TypeScript strict typing and Repository pattern
 */
class TestDataGenerator {
    /**
     * Initialize test data by fetching existing entities from database
     * Using real production data for more accurate stress testing
     */
    static initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("🔄 Initializing test data from database...");
                // Use smaller batches and simpler queries to avoid timeouts
                // Get both agencies (ID 1 and 2) for random selection in tests
                const agencies = yield prisma.agency.findMany({
                    where: { id: { in: [1, 2] } },
                    take: 2,
                });
                const customers = yield prisma.customer.findMany({
                    take: 50, // Reduced from 200 to avoid timeout
                    orderBy: { id: "asc" },
                });
                const receivers = yield prisma.receiver.findMany({
                    take: 50, // Reduced from 200 to avoid timeout
                    orderBy: { id: "asc" },
                });
                const services = yield prisma.service.findMany({
                    where: { id: 1 }, // Only get service ID 1 which we know exists
                    take: 1,
                });
                // Get users from both agencies for variety in tests
                const users = yield prisma.user.findMany({
                    where: {
                        agency_id: { in: [1, 2] },
                    },
                    take: 20, // Get more users from both agencies for variety
                });
                // We don't need customsRates since we're using fixed rate_id = 1
                const customsRates = [{ id: 1, name: "Fixed Rate", fee_in_cents: 0 }];
                this.agencies = agencies;
                this.customers = customers;
                this.receivers = receivers;
                this.services = services;
                this.customsRates = customsRates;
                this.users = users;
                console.log(`✅ Test data initialized:`);
                console.log(`   - Agencies: ${this.agencies.length}`);
                console.log(`   - Customers: ${this.customers.length}`);
                console.log(`   - Receivers: ${this.receivers.length}`);
                console.log(`   - Services: ${this.services.length}`);
                console.log(`   - Customs Rates: ${this.customsRates.length}`);
                console.log(`   - Users: ${this.users.length}`);
                if (this.agencies.length === 0) {
                    throw new Error("Agencies with ID 1 or 2 not found in database. Please check your data.");
                }
                if (this.customers.length === 0) {
                    throw new Error("No customers found in database. Please seed customer data first.");
                }
                if (this.receivers.length === 0) {
                    throw new Error("No receivers found in database. Please seed receiver data first.");
                }
                // Show distribution of users by agency
                const agency1Users = this.users.filter((u) => u.agency_id === 1);
                const agency2Users = this.users.filter((u) => u.agency_id === 2);
                console.log(`✅ Found users - Agency 1: ${agency1Users.length}, Agency 2: ${agency2Users.length}`);
                if (this.users.length === 0) {
                    throw new Error("No users found from agencies 1 or 2. Please check users exist in database.");
                }
            }
            catch (error) {
                console.error("❌ Failed to initialize test data:", error);
                throw error;
            }
        });
    }
    /**
     * Generate a single realistic order test data
     * Uses your real production data for maximum accuracy
     */
    static generateOrderData() {
        if (this.agencies.length === 0) {
            throw new Error("Test data not initialized. Call TestDataGenerator.initialize() first.");
        }
        // Randomly select between agency ID 1 or 2
        const agency = faker_1.faker.helpers.arrayElement(this.agencies);
        const customer = faker_1.faker.helpers.arrayElement(this.customers);
        const receiver = faker_1.faker.helpers.arrayElement(this.receivers);
        // Use service ID 1 which we know exists
        const service = this.services.find((s) => s.id === 1) || this.services[0];
        // Select a user that belongs to the same agency as selected
        const agencyUsers = this.users.filter((u) => u.agency_id === agency.id);
        // If no users from this agency, select randomly from all available users
        const user = agencyUsers.length > 0 ? faker_1.faker.helpers.arrayElement(agencyUsers) : faker_1.faker.helpers.arrayElement(this.users);
        // Debug logging to see which agency is being selected
        console.log(`🔍 Generated order for Agency ID: ${agency.id}, User ID: ${user.id}`);
        const itemCount = faker_1.faker.number.int({ min: 3, max: 10 });
        const items = [];
        for (let i = 0; i < itemCount; i++) {
            items.push({
                description: faker_1.faker.commerce.productName(),
                price_in_cents: faker_1.faker.number.int({ min: 100, max: 5000 }), // $1 - $50 (more realistic)
                rate_id: 1, // Use rate_id = 1 which we know exists
                charge_fee_in_cents: 0,
                insurance_fee_in_cents: faker_1.faker.number.int({ min: 0, max: 500 }), // $0 - $5
                customs_fee_in_cents: 0, // Set to 0 like in your example
                delivery_fee_in_cents: 0,
                weight: faker_1.faker.number.int({ min: 1, max: 20 }), // Integer weight like your example
            });
        }
        // Set total_in_cents to 0 like in your example (backend calculates it)
        const total_in_cents = 0;
        return {
            agency_id: agency.id, // Randomly 1 or 2
            user_id: user.id, // Your user ID preferentially
            customer_id: customer.id, // Real customer from your DB
            receiver_id: receiver.id, // Real receiver from your DB
            service_id: service.id, // Real service from your DB
            items,
            paid_in_cents: 0, // Default to unpaid
            total_in_cents: total_in_cents,
        };
    }
    /**
     * Generate multiple order test data
     */
    static generateMultipleOrderData(count) {
        const orders = [];
        for (let i = 0; i < count; i++) {
            orders.push(this.generateOrderData());
        }
        return orders;
    }
    /**
     * Generate balanced test data across both agencies (ID 1 and 2)
     * Useful for testing load distribution between agencies
     */
    static generateBalancedOrderData(count) {
        const orders = [];
        console.log(`🎯 Generating ${count} balanced orders across both agencies...`);
        for (let i = 0; i < count; i++) {
            // Alternate between agency 1 and 2 for balanced distribution
            const agencyId = (i % 2) + 1;
            console.log(`📋 Order ${i + 1}: Using Agency ${agencyId}`);
            orders.push(this.generateOrderDataForAgency(agencyId));
        }
        // Count distribution for verification
        const agency1Count = orders.filter((ord) => ord.agency_id === 1).length;
        const agency2Count = orders.filter((ord) => ord.agency_id === 2).length;
        console.log(`✅ Final distribution - Agency 1: ${agency1Count}, Agency 2: ${agency2Count}`);
        return orders;
    }
    /**
     * Generate test data specifically for Agency 2 to ensure it gets tested
     */
    static generateAgency2OrderData(count) {
        const orders = [];
        console.log(`🏢 Generating ${count} orders specifically for Agency 2...`);
        for (let i = 0; i < count; i++) {
            orders.push(this.generateOrderDataForAgency(2));
        }
        console.log(`✅ Generated ${orders.length} orders for Agency 2`);
        return orders;
    }
    /**
     * Generate test data with specific agency to test agency-specific load
     * Supports agency IDs 1 and 2
     */
    static generateOrderDataForAgency(agencyId) {
        if (![1, 2].includes(agencyId)) {
            throw new Error(`Invalid agency ID: ${agencyId}. Only agencies 1 and 2 are supported.`);
        }
        if (this.agencies.length === 0) {
            throw new Error("Test data not initialized. Call TestDataGenerator.initialize() first.");
        }
        // Find the specific agency
        const agency = this.agencies.find((a) => a.id === agencyId);
        if (!agency) {
            throw new Error(`Agency with ID ${agencyId} not found in initialized data.`);
        }
        const customer = faker_1.faker.helpers.arrayElement(this.customers);
        const receiver = faker_1.faker.helpers.arrayElement(this.receivers);
        const service = this.services.find((s) => s.id === 1) || this.services[0];
        // Select a user that belongs to the specified agency
        const agencyUsers = this.users.filter((u) => u.agency_id === agencyId);
        const user = agencyUsers.length > 0 ? faker_1.faker.helpers.arrayElement(agencyUsers) : faker_1.faker.helpers.arrayElement(this.users);
        const itemCount = faker_1.faker.number.int({ min: 3, max: 10 });
        const items = [];
        for (let i = 0; i < itemCount; i++) {
            items.push({
                description: faker_1.faker.commerce.productName(),
                price_in_cents: faker_1.faker.number.int({ min: 100, max: 5000 }),
                rate_id: 1,
                charge_fee_in_cents: 0,
                insurance_fee_in_cents: faker_1.faker.number.int({ min: 0, max: 500 }),
                customs_fee_in_cents: 0,
                delivery_fee_in_cents: 0,
                weight: faker_1.faker.number.int({ min: 1, max: 20 }),
            });
        }
        const total_in_cents = 0;
        return {
            agency_id: agencyId,
            user_id: user.id,
            customer_id: customer.id,
            receiver_id: receiver.id,
            service_id: service.id,
            items,
            paid_in_cents: 0,
            total_in_cents: total_in_cents,
        };
    }
    /**
     * Generate test data with varying complexity (different item counts)
     */
    static generateComplexOrderData(complexity) {
        const baseData = this.generateOrderData();
        let itemCount;
        switch (complexity) {
            case "simple":
                itemCount = 1;
                break;
            case "medium":
                itemCount = faker_1.faker.number.int({ min: 2, max: 5 });
                break;
            case "complex":
                itemCount = faker_1.faker.number.int({ min: 6, max: 15 });
                break;
        }
        const items = [];
        for (let i = 0; i < itemCount; i++) {
            items.push({
                description: faker_1.faker.commerce.productName(),
                price_in_cents: faker_1.faker.number.int({ min: 100, max: 5000 }),
                rate_id: 1, // Use rate_id = 1 which we know exists
                charge_fee_in_cents: 0,
                insurance_fee_in_cents: faker_1.faker.number.int({ min: 0, max: 500 }),
                customs_fee_in_cents: 0,
                delivery_fee_in_cents: 0,
                weight: faker_1.faker.number.int({ min: 1, max: 20 }),
            });
        }
        // Set total_in_cents to 0 (backend calculates it)
        const total_in_cents = 0;
        return Object.assign(Object.assign({}, baseData), { items, paid_in_cents: 0, total_in_cents: total_in_cents });
    }
    /**
     * Clean up database connections
     */
    static cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma.$disconnect();
        });
    }
}
exports.TestDataGenerator = TestDataGenerator;
TestDataGenerator.agencies = [];
TestDataGenerator.customers = [];
TestDataGenerator.receivers = [];
TestDataGenerator.services = [];
TestDataGenerator.customsRates = [];
TestDataGenerator.users = [];
