import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Debug test to check what data exists in the database
 */
describe("Database Data Check", () => {
	afterAll(async () => {
		await prisma.$disconnect();
	});

	test("Should check available data in database", async () => {
		console.log("\n🔍 === DATABASE DATA ANALYSIS ===");

		// Check agencies
		const agencies = await prisma.agency.findMany({ take: 5 });
		console.log(
			"📊 Agencies:",
			agencies.map((a) => ({ id: a.id, name: a.name })),
		);

		// Check services
		const services = await prisma.service.findMany({ take: 5 });
		console.log(
			"🚚 Services:",
			services.map((s) => ({ id: s.id, name: s.name })),
		);

		// Check customs rates (these are used as rate_id)
		const customsRates = await prisma.customsRates.findMany({
			take: 10,
			select: { id: true, name: true, fee_in_cents: true },
		});
		console.log("💰 First 10 Customs Rates:", customsRates);

		// Check customers count
		const customerCount = await prisma.customer.count();
		console.log("👥 Total Customers:", customerCount);

		// Check receivers count
		const receiverCount = await prisma.receiver.count();
		console.log("📦 Total Receivers:", receiverCount);

		// Check users
		const users = await prisma.user.findMany({
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
	});

	test("Should test creating invoice with first available rate_id", async () => {
		// Get the first available customs rate
		const firstCustomsRate = await prisma.customsRates.findFirst({
			select: { id: true, name: true, fee_in_cents: true },
		});

		// Get first available customer and receiver
		const firstCustomer = await prisma.customer.findFirst();
		const firstReceiver = await prisma.receiver.findFirst();

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
	});
});
