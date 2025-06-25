import { generarTracking } from "./src/utils/generate_hbl.js";

async function testConcurrentTracking() {
	const agencyId = 1;
	const numberOfConcurrentUsers = 10;
	const trackingCodesPerUser = 2;

	console.log(
		`Testing ${numberOfConcurrentUsers} concurrent users, each generating ${trackingCodesPerUser} tracking codes...`,
	);

	// Create array of promises for concurrent execution
	const promises = Array.from({ length: numberOfConcurrentUsers }, (_, index) =>
		generarTracking(agencyId, trackingCodesPerUser)
			.then((codes) => ({ userId: index + 1, codes }))
			.catch((error) => ({ userId: index + 1, error: error.message })),
	);

	try {
		const startTime = Date.now();
		const results = await Promise.all(promises);
		const endTime = Date.now();

		console.log(`\nTest completed in ${endTime - startTime}ms`);
		console.log("\nResults:");

		const allCodes = [];
		results.forEach((result) => {
			if (result.codes) {
				console.log(`User ${result.userId}: ${result.codes.join(", ")}`);
				allCodes.push(...result.codes);
			} else {
				console.log(`User ${result.userId}: ERROR - ${result.error}`);
			}
		});

		// Check for duplicates
		const uniqueCodes = [...new Set(allCodes)];
		const hasDuplicates = allCodes.length !== uniqueCodes.length;

		console.log(`\nTotal codes generated: ${allCodes.length}`);
		console.log(`Unique codes: ${uniqueCodes.length}`);
		console.log(`Duplicates found: ${hasDuplicates ? "YES ❌" : "NO ✅"}`);

		if (hasDuplicates) {
			const duplicates = allCodes.filter((code, index) => allCodes.indexOf(code) !== index);
			console.log("Duplicate codes:", [...new Set(duplicates)]);
		}
	} catch (error) {
		console.error("Test failed:", error);
	}
}

// Run multiple test rounds
async function runMultipleTests() {
	console.log("🧪 Starting concurrent tracking code generation tests...\n");

	for (let round = 1; round <= 3; round++) {
		console.log(`\n=== Test Round ${round} ===`);
		await testConcurrentTracking();

		// Wait a bit between rounds
		if (round < 3) {
			console.log("\nWaiting 2 seconds before next round...");
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
}

runMultipleTests();
