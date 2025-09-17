import request from "supertest";
import { app } from "../../app";

/**
 * Simple test to verify route configuration
 */
describe("Route Configuration Test", () => {
	test("Should respond to API root endpoint", async () => {
		const response = await request(app).get("/api/v1/").expect(200);

		expect(response.text).toBe("Welcome to CTEnvios API V1");
	});

	test("Should return 404 for non-existent routes", async () => {
		await request(app).get("/api/nonexistent").expect(404);
	});

	test("Invoice route should exist (POST)", async () => {
		// This should return validation error, not 404
		const response = await request(app)
			.post("/api/v1/invoices")
			.send({})
			.expect((res) => {
				// Should not be 404 - route exists
				expect(res.status).not.toBe(404);
			});
	});
});
