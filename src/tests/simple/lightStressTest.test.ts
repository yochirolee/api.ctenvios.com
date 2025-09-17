import request from "supertest";
import { app } from "../../app";

/**
 * Light stress test - Very conservative to avoid DB overload
 * Only creates invoices, uses existing customer/receiver IDs
 */
describe("Light Stress Test - Conservative Load", () => {
	const createSingleInvoice = async (testId: number) => {
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
			const response = await request(app).post("/api/v1/invoices").send(testInvoiceData);

			const responseTime = Date.now() - startTime;

			return {
				success: response.status === 200 || response.status === 201,
				status: response.status,
				responseTime,
				invoiceId: response.body?.id,
				hblCodes: response.body?.items?.map((item: any) => item.hbl) || [],
				error: response.status >= 400 ? response.body : null,
			};
		} catch (error: any) {
			const responseTime = Date.now() - startTime;
			return {
				success: false,
				status: 500,
				responseTime,
				error: error.message,
			};
		}
	};

	test("Very Light Load - 5 invoices sequentially", async () => {
		console.log("\n🔄 Starting Very Light Load Test (5 invoices)");
		console.log("📝 Note: Only creating invoices, using existing customer/receiver IDs");

		const results = [];
		const startTime = Date.now();

		for (let i = 0; i < 5; i++) {
			console.log(`📈 Creating invoice ${i + 1}/5...`);

			const result = await createSingleInvoice(i);
			results.push(result);

			if (result.success) {
				console.log(
					`✅ Invoice ${result.invoiceId} created with HBL: ${result.hblCodes.join(", ")}`,
				);
			} else {
				console.log(`❌ Failed: Status ${result.status}, Error:`, result.error);
			}

			// Long delay to be very conservative
			await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
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
			console.log(
				`❌ Errors:`,
				errors.map((e) => ({ status: e.status, error: e.error })),
			);
		}

		// Should succeed with very light load
		expect(successCount).toBeGreaterThanOrEqual(4); // At least 4/5 should work
	});

	test("Moderate Load - 10 invoices with longer delays", async () => {
		console.log("\n🚀 Starting Moderate Load Test (10 invoices)");

		const results = [];
		const startTime = Date.now();

		for (let i = 0; i < 10; i++) {
			const result = await createSingleInvoice(i + 10); // Different customer/receiver IDs
			results.push(result);

			if (i % 3 === 0) {
				console.log(`📈 Progress: ${i + 1}/10 invoices`);
			}

			// Conservative delay
			await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5 second delay
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
	});
});
