import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Debug test to verify what customer and receiver IDs actually exist
 */
describe("Verify Real Database IDs", () => {
	afterAll(async () => {
		await prisma.$disconnect();
	});

	test("Check what customer and receiver IDs exist", async () => {
		console.log("\n🔍 === CHECKING REAL DATABASE IDs ===");

		// Check customers
		console.log("\n📊 CUSTOMERS:");
		const customers = await prisma.customer.findMany({
			select: { id: true, name: true },
			take: 10,
			orderBy: { id: "asc" },
		});

		console.log(`Found ${customers.length} customers:`);
		customers.forEach((c, i) => {
			console.log(`  ${i + 1}. ID: ${c.id}, Name: ${c.name}`);
		});

		// Check receivers
		console.log("\n📊 RECEIVERS:");
		const receivers = await prisma.receiver.findMany({
			select: { id: true, name: true },
			take: 10,
			orderBy: { id: "asc" },
		});

		console.log(`Found ${receivers.length} receivers:`);
		receivers.forEach((r, i) => {
			console.log(`  ${i + 1}. ID: ${r.id}, Name: ${r.name}`);
		});

		// Check services
		console.log("\n📊 SERVICES:");
		const services = await prisma.service.findMany({
			select: { id: true, name: true },
			take: 5,
		});

		console.log(`Found ${services.length} services:`);
		services.forEach((s, i) => {
			console.log(`  ${i + 1}. ID: ${s.id}, Name: ${s.name}`);
		});

		// Check agencies
		console.log("\n📊 AGENCIES:");
		const agencies = await prisma.agency.findMany({
			select: { id: true, name: true },
			take: 5,
		});

		console.log(`Found ${agencies.length} agencies:`);
		agencies.forEach((a, i) => {
			console.log(`  ${i + 1}. ID: ${a.id}, Name: ${a.name}`);
		});

		// Check users
		console.log("\n📊 USERS:");
		const users = await prisma.user.findMany({
			select: { id: true, name: true },
			take: 5,
		});

		console.log(`Found ${users.length} users:`);
		users.forEach((u, i) => {
			console.log(`  ${i + 1}. ID: ${u.id}, Name: ${u.name}`);
		});

		// Check if your specific user exists
		console.log("\n🔍 CHECKING YOUR SPECIFIC USER:");
		const yourUser = await prisma.user.findUnique({
			where: { id: "R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q" },
			select: { id: true, name: true, agency_id: true },
		});

		if (yourUser) {
			console.log(`✅ Your user exists: ${yourUser.name} (Agency: ${yourUser.agency_id})`);
		} else {
			console.log(`❌ Your user ID 'R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q' NOT FOUND!`);
		}

		// Check rates
		console.log("\n📊 RATES:");
		const rates = await prisma.rate.findMany({
			select: { id: true, name: true },
			take: 5,
		});

		console.log(`Found ${rates.length} rates:`);
		rates.forEach((r, i) => {
			console.log(`  ${i + 1}. ID: ${r.id}, Name: ${r.name}`);
		});

		// Summary
		console.log("\n📋 === SUMMARY ===");
		console.log(`Customers: ${customers.length > 0 ? "✅" : "❌"} (${customers.length} found)`);
		console.log(`Receivers: ${receivers.length > 0 ? "✅" : "❌"} (${receivers.length} found)`);
		console.log(`Services: ${services.length > 0 ? "✅" : "❌"} (${services.length} found)`);
		console.log(`Agencies: ${agencies.length > 0 ? "✅" : "❌"} (${agencies.length} found)`);
		console.log(`Users: ${users.length > 0 ? "✅" : "❌"} (${users.length} found)`);
		console.log(`Your User: ${yourUser ? "✅" : "❌"}`);
		console.log(`Rates: ${rates.length > 0 ? "✅" : "❌"} (${rates.length} found)`);

		// If we have data, let's try to create a simple invoice with the first available IDs
		if (
			customers.length > 0 &&
			receivers.length > 0 &&
			services.length > 0 &&
			agencies.length > 0
		) {
			console.log("\n🧪 === TESTING SIMPLE INVOICE CREATION ===");

			const testData = {
				agency_id: agencies[0].id,
				user_id: yourUser ? yourUser.id : users[0]?.id,
				customer_id: customers[0].id,
				receiver_id: receivers[0].id,
				service_id: services[0].id,
				items: [
					{
						description: "Test Product",
						rate_in_cents: 190,
						rate_id: rates[0]?.id || 1,
						customs_id: 1,
						insurance_fee_in_cents: 0,
						customs_fee_in_cents: 0,
						weight: 5,
					},
				],
				paid_in_cents: 0,
				total_in_cents: 0,
			};

			console.log("📋 Test data to be used:");
			console.log(JSON.stringify(testData, null, 2));
		}

		expect(true).toBe(true); // Just to make the test pass
	});
});
