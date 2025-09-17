import { faker } from "@faker-js/faker";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface TestInvoiceData {
	agency_id: number;
	user_id: string;
	customer_id: number;
	receiver_id: number;
	service_id: number;
	items: TestItemData[];
	paid_in_cents: number;
	total_in_cents: number;
}

export interface TestItemData {
	description: string;
	rate_in_cents: number;
	rate_id: number;
	customs_id: number;
	insurance_fee_in_cents: number;
	customs_fee_in_cents: number;
	weight: number;
}

/**
 * Generate realistic test data for invoice creation
 * Following TypeScript strict typing and Repository pattern
 */
export class TestDataGenerator {
	private static agencies: any[] = [];
	private static customers: any[] = [];
	private static receivers: any[] = [];
	private static services: any[] = [];
	private static customsRates: any[] = [];
	private static users: any[] = [];

	/**
	 * Initialize test data by fetching existing entities from database
	 * Using real production data for more accurate stress testing
	 */
	static async initialize(): Promise<void> {
		try {
			console.log("🔄 Initializing test data from database...");

			// Use smaller batches and simpler queries to avoid timeouts
			const agencies = await prisma.agency.findMany({
				where: { id: 1 },
				take: 1,
			});

			const customers = await prisma.customer.findMany({
				take: 50, // Reduced from 200 to avoid timeout
				orderBy: { id: "asc" },
			});

			const receivers = await prisma.receiver.findMany({
				take: 50, // Reduced from 200 to avoid timeout
				orderBy: { id: "asc" },
			});

			const services = await prisma.service.findMany({
				where: { id: 1 }, // Only get service ID 1 which we know exists
				take: 1,
			});

			const users = await prisma.user.findMany({
				where: {
					OR: [{ id: "R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q" }, { agency_id: 1 }],
				},
				take: 5,
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
				throw new Error("Agency with ID 1 not found in database. Please check your data.");
			}

			if (this.customers.length === 0) {
				throw new Error("No customers found in database. Please seed customer data first.");
			}

			if (this.receivers.length === 0) {
				throw new Error("No receivers found in database. Please seed receiver data first.");
			}

			// Verify your specific user exists
			const yourUser = this.users.find((u) => u.id === "R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q");
			if (yourUser) {
				console.log(`✅ Found your user: ${yourUser.name || yourUser.id}`);
			} else {
				console.log(`⚠️  Your specific user ID not found, using available users`);
			}
		} catch (error) {
			console.error("❌ Failed to initialize test data:", error);
			throw error;
		}
	}

	/**
	 * Generate a single realistic invoice test data
	 * Uses your real production data for maximum accuracy
	 */
	static generateInvoiceData(): TestInvoiceData {
		if (this.agencies.length === 0) {
			throw new Error("Test data not initialized. Call TestDataGenerator.initialize() first.");
		}

		// Always use agency ID 1 (your main agency)
		const agency = this.agencies[0]; // Agency ID 1
		const customer = faker.helpers.arrayElement(this.customers);
		const receiver = faker.helpers.arrayElement(this.receivers);
		// Use service ID 1 which we know exists
		const service = this.services.find((s) => s.id === 1) || this.services[0];

		// Prefer your specific user ID, fallback to others if needed
		const yourUser = this.users.find((u) => u.id === "R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q");
		const user = yourUser || faker.helpers.arrayElement(this.users);

		const itemCount = faker.number.int({ min: 3, max: 10 });
		const items: TestItemData[] = [];

		for (let i = 0; i < itemCount; i++) {
			items.push({
				description: faker.commerce.productName(),
				rate_in_cents: faker.number.int({ min: 100, max: 5000 }), // $1 - $50 (more realistic)
				rate_id: 1, // Use rate_id = 1 which we know exists
				customs_id: 1, // Same as rate_id
				insurance_fee_in_cents: faker.number.int({ min: 0, max: 500 }), // $0 - $5
				customs_fee_in_cents: 0, // Set to 0 like in your example
				weight: faker.number.int({ min: 1, max: 20 }), // Integer weight like your example
			});
		}

		// Set total_in_cents to 0 like in your example (backend calculates it)
		const total_in_cents = 0;

		return {
			agency_id: agency.id, // Always 1
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
	 * Generate multiple invoice test data
	 */
	static generateMultipleInvoiceData(count: number): TestInvoiceData[] {
		const invoices: TestInvoiceData[] = [];

		for (let i = 0; i < count; i++) {
			invoices.push(this.generateInvoiceData());
		}

		return invoices;
	}

	/**
	 * Generate test data with specific agency to test agency-specific load
	 */
	static generateInvoiceDataForAgency(agencyId: number): TestInvoiceData {
		const baseData = this.generateInvoiceData();
		return {
			...baseData,
			agency_id: agencyId,
		};
	}

	/**
	 * Generate test data with varying complexity (different item counts)
	 */
	static generateComplexInvoiceData(complexity: "simple" | "medium" | "complex"): TestInvoiceData {
		const baseData = this.generateInvoiceData();

		let itemCount: number;
		switch (complexity) {
			case "simple":
				itemCount = 1;
				break;
			case "medium":
				itemCount = faker.number.int({ min: 2, max: 5 });
				break;
			case "complex":
				itemCount = faker.number.int({ min: 6, max: 15 });
				break;
		}

		const items: TestItemData[] = [];
		for (let i = 0; i < itemCount; i++) {
			items.push({
				description: faker.commerce.productName(),
				rate_in_cents: faker.number.int({ min: 100, max: 5000 }),
				rate_id: 1, // Use rate_id = 1 which we know exists
				customs_id: 1, // Same as rate_id
				insurance_fee_in_cents: faker.number.int({ min: 0, max: 500 }),
				customs_fee_in_cents: 0,
				weight: faker.number.int({ min: 1, max: 20 }),
			});
		}

		// Set total_in_cents to 0 (backend calculates it)
		const total_in_cents = 0;

		return {
			...baseData,
			items,
			paid_in_cents: 0,
			total_in_cents: total_in_cents,
		};
	}

	/**
	 * Clean up database connections
	 */
	static async cleanup(): Promise<void> {
		await prisma.$disconnect();
	}
}
