import request from "supertest";
import { app } from "../../app";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Stress test using REAL customer and receiver IDs from your database
 * This ensures we only use IDs that actually exist
 */
describe("Real Data Stress Test", () => {
	let realCustomerIds: number[] = [];
	let realReceiverIds: number[] = [];

	beforeAll(async () => {
		console.log("🔍 Fetching real customer and receiver IDs from database...");

		// Get real customer IDs that exist in your database
		const customers = await prisma.customer.findMany({
			select: { id: true },
			take: 20, // Get 20 real customer IDs
			orderBy: { id: "asc" },
		});

		// Get real receiver IDs that exist in your database
		const receivers = await prisma.receiver.findMany({
			select: { id: true },
			take: 20, // Get 20 real receiver IDs
			orderBy: { id: "asc" },
		});

		realCustomerIds = customers.map((c) => c.id);
		realReceiverIds = receivers.map((r) => r.id);

		console.log(
			`✅ Found ${realCustomerIds.length} real customer IDs:`,
			realCustomerIds.slice(0, 5),
			"...",
		);
		console.log(
			`✅ Found ${realReceiverIds.length} real receiver IDs:`,
			realReceiverIds.slice(0, 5),
			"...",
		);

		if (realCustomerIds.length === 0 || realReceiverIds.length === 0) {
			throw new Error("No customers or receivers found in database!");
		}
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	const createInvoiceWithRealIds = async (testIndex: number) => {
		// Use real IDs that exist in your database
		const customerId = realCustomerIds[testIndex % realCustomerIds.length];
		const receiverId = realReceiverIds[testIndex % realReceiverIds.length];

		const testInvoiceData = {
			agency_id: 1,
			user_id: "R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q",
			customer_id: customerId, // REAL customer ID
			receiver_id: receiverId, // REAL receiver ID
			service_id: 1,
			items: Array.from({ length: Math.floor(Math.random() * 8) + 3 }, (_, i) => ({
				description: `Test Product ${testIndex}-${i + 1}`,
				rate_in_cents: Math.floor(Math.random() * 4900) + 100, // $1-$50
				rate_id: 1,
				customs_id: 1,
				insurance_fee_in_cents: Math.floor(Math.random() * 500), // $0-$5
				customs_fee_in_cents: 0,
				weight: Math.floor(Math.random() * 20) + 1, // 1-20 kg
			})),
			paid_in_cents: 0,
			total_in_cents: 0,
		};

		console.log(`📋 Using customer_id: ${customerId}, receiver_id: ${receiverId}`);

		const startTime = Date.now();

		try {
			const response = await request(app).post("/api/v1/invoices").send(testInvoiceData);

			const responseTime = Date.now() - startTime;

			return {
				success: response.status === 200 || response.status === 201,
				status: response.status,
				responseTime,
				invoiceId: response.body?.id,
				hblCodes: response.body?.items?.map((item: any) => item.hbl) || [],
				customerId,
				receiverId,
				error: response.status >= 400 ? response.body : null,
			};
		} catch (error: any) {
			const responseTime = Date.now() - startTime;
			return {
				success: false,
				status: 500,
				responseTime,
				customerId,
				receiverId,
				error: error.message,
			};
		}
	};

	test("Real IDs Test - 3 invoices with real customer/receiver IDs", async () => {
		console.log("\n🎯 Starting Real IDs Test (3 invoices)");
		console.log("📝 Using REAL customer and receiver IDs from your database");

		const results = [];
		const startTime = Date.now();

		for (let i = 0; i < 3; i++) {
			console.log(`\n📈 Creating invoice ${i + 1}/3...`);

			const result = await createInvoiceWithRealIds(i);
			results.push(result);

			if (result.success) {
				console.log(`✅ SUCCESS! Invoice ${result.invoiceId} created`);
				console.log(`   📦 Customer: ${result.customerId}, Receiver: ${result.receiverId}`);
				console.log(`   🔢 HBL codes: ${result.hblCodes.join(", ")}`);
				console.log(`   ⏱️  Response time: ${result.responseTime}ms`);
			} else {
				console.log(`❌ FAILED! Status: ${result.status}`);
				console.log(`   📦 Customer: ${result.customerId}, Receiver: ${result.receiverId}`);
				console.log(`   ❌ Error:`, result.error);
			}

			// Conservative delay
			await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 second delay
		}

		const endTime = Date.now();
		const successCount = results.filter((r) => r.success).length;
		const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

		console.log(`\n🎯 === REAL IDS TEST RESULTS ===`);
		console.log(`✅ Successful: ${successCount}/3 invoices`);
		console.log(`⏱️  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
		console.log(`⏰ Total Duration: ${endTime - startTime}ms`);
		console.log(`🔥 Throughput: ${(3 / ((endTime - startTime) / 1000)).toFixed(2)} req/sec`);

		const errors = results.filter((r) => !r.success);
		if (errors.length > 0) {
			console.log(
				`❌ Errors:`,
				errors.map((e) => ({
					status: e.status,
					customerId: e.customerId,
					receiverId: e.receiverId,
					error: e.error,
				})),
			);
		}

		// With real IDs, we should have high success rate
		expect(successCount).toBeGreaterThanOrEqual(2); // At least 2/3 should work
	});

	test("Real IDs Sequential - 5 invoices with real data", async () => {
		console.log("\n🚀 Starting Real IDs Sequential Test (5 invoices)");

		const results = [];
		const startTime = Date.now();

		for (let i = 0; i < 5; i++) {
			const result = await createInvoiceWithRealIds(i);
			results.push(result);

			if (i % 2 === 0) {
				console.log(`📈 Progress: ${i + 1}/5 invoices`);
			}

			// Moderate delay
			await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
		}

		const endTime = Date.now();
		const successCount = results.filter((r) => r.success).length;
		const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

		console.log(`\n🚀 === SEQUENTIAL REAL IDS RESULTS ===`);
		console.log(`✅ Successful: ${successCount}/5 invoices`);
		console.log(`⏱️  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
		console.log(`⏰ Total Duration: ${endTime - startTime}ms`);
		console.log(`🔥 Throughput: ${(5 / ((endTime - startTime) / 1000)).toFixed(2)} req/sec`);

		const successRate = successCount / 5;
		console.log(`📊 Success Rate: ${(successRate * 100).toFixed(1)}%`);

		// Log successful invoices
		const successful = results.filter((r) => r.success);
		if (successful.length > 0) {
			console.log(
				`🎉 Successfully created invoices:`,
				successful.map((s) => ({
					invoiceId: s.invoiceId,
					hblCodes: s.hblCodes,
					responseTime: s.responseTime + "ms",
				})),
			);
		}

		// With real data, should have excellent success rate
		expect(successRate).toBeGreaterThanOrEqual(0.8); // 80% success rate
	});
});
