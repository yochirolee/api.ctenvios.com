import request from "supertest";
import { app } from "../../app";
import { TestDataGenerator } from "../helpers/testDataGenerator";

/**
 * Test to verify invoice format matches production requirements
 */
describe("Invoice Format Verification", () => {
	beforeAll(async () => {
		await TestDataGenerator.initialize();
	});

	afterAll(async () => {
		await TestDataGenerator.cleanup();
	});

	test("Should generate invoice data with correct format", async () => {
		const testData = TestDataGenerator.generateInvoiceData();

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
	});

	test("Should attempt to create invoice with real format", async () => {
		const testData = TestDataGenerator.generateInvoiceData();

		console.log("🚀 Attempting to create invoice with format:", JSON.stringify(testData, null, 2));

		const response = await request(app)
			.post("/api/v1/invoices")
			.send(testData)
			.expect((res) => {
				console.log("📊 Response status:", res.status);
				console.log("📋 Response body:", JSON.stringify(res.body, null, 2));

				// Should not be 404 or 500 due to format issues
				expect([200, 201, 400]).toContain(res.status);
			});
	});
});
