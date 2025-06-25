import { generarTracking } from "../utils/generate_hbl";

describe("Concurrent Tracking Generation", () => {
	beforeEach(() => {
		// Reset any database state if needed
	});

	test("should generate unique tracking codes under concurrent load", async () => {
		const agencyId = 1;
		const concurrentUsers = 15;
		const codesPerUser = 2;

		// Create concurrent promises
		const promises = Array.from({ length: concurrentUsers }, () =>
			generarTracking(agencyId, codesPerUser),
		);

		const results = await Promise.all(promises);

		// Flatten all codes
		const allCodes = results.flat();

		// Check for uniqueness
		const uniqueCodes = [...new Set(allCodes)];

		expect(allCodes.length).toBe(concurrentUsers * codesPerUser);
		expect(uniqueCodes.length).toBe(allCodes.length);
		expect(allCodes).toEqual(uniqueCodes);
	});

	test("should handle high concurrency without errors", async () => {
		const agencyId = 1;
		const concurrentUsers = 50;

		const promises = Array.from({ length: concurrentUsers }, () => generarTracking(agencyId, 1));

		const results = await Promise.allSettled(promises);

		const successful = results.filter((r) => r.status === "fulfilled");
		const failed = results.filter((r) => r.status === "rejected");

		console.log(`Successful: ${successful.length}, Failed: ${failed.length}`);

		// All should succeed
		expect(failed.length).toBe(0);
		expect(successful.length).toBe(concurrentUsers);
	});

	test("should maintain counter consistency across agencies", async () => {
		const agency1 = 1;
		const agency2 = 2;
		const concurrentUsers = 10;

		const agency1Promises = Array.from({ length: concurrentUsers }, () =>
			generarTracking(agency1, 1),
		);

		const agency2Promises = Array.from({ length: concurrentUsers }, () =>
			generarTracking(agency2, 1),
		);

		// Run both agencies concurrently
		const [agency1Results, agency2Results] = await Promise.all([
			Promise.all(agency1Promises),
			Promise.all(agency2Promises),
		]);

		const agency1Codes = agency1Results.flat();
		const agency2Codes = agency2Results.flat();

		// Codes should be unique within each agency
		expect(agency1Codes.length).toBe(new Set(agency1Codes).size);
		expect(agency2Codes.length).toBe(new Set(agency2Codes).size);

		// Codes should be different between agencies (different agency prefix)
		const intersection = agency1Codes.filter((code) => agency2Codes.includes(code));
		expect(intersection.length).toBe(0);
	});
});
