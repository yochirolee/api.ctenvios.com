import request from "supertest";
import { app } from "../../app";

/**
 * Simple test to verify invoice creation works with known IDs
 */
describe("Simple Invoice Creation Test", () => {
	test("Should create invoice with fixed IDs that we know exist", async () => {
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

		const response = await request(app)
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
			console.log(
				"🔢 HBL codes:",
				response.body.items?.map((item: any) => item.hbl),
			);
		}
	});
});
