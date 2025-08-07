const { exec } = require("child_process");

console.log("🚀 Starting Concurrent Invoice HBL Generation Tests...\n");

// Test the new concurrent invoice creation with unique HBL generation
// Using the simple TypeScript test that doesn't require Jest configuration
const testCommand = "npx tsx src/tests/simple-concurrent-hbl-test.ts";

console.log("Running simple concurrent HBL test...\n");

exec(testCommand, (error, stdout, stderr) => {
	if (error) {
		console.error(`❌ Test execution error: ${error}`);
		return;
	}

	if (stderr) {
		console.error(`⚠️  Test warnings: ${stderr}`);
	}

	console.log(stdout);

	// Check if tests passed
	if (stdout.includes("ALL TESTS PASSED")) {
		console.log(
			"\n🎉 The unique HBL generation system is working correctly under concurrent load!",
		);
	} else if (stdout.includes("Some tests failed")) {
		console.log("\n⚠️  Some tests failed. Check the output above for details.");
	}
});

// Also provide individual test commands
console.log("📋 Available test commands:");
console.log("1. Run the simple concurrent HBL test:");
console.log("   npx tsx src/tests/simple-concurrent-hbl-test.ts");
console.log("");
console.log("2. Run with Node.js directly:");
console.log("   node -r ts-node/register src/tests/simple-concurrent-hbl-test.ts");
console.log("");
console.log("3. If Jest is configured, run Jest tests:");
console.log("   npx jest src/tests/concurrent-invoice-creation.test.ts --verbose");
console.log("");
console.log("4. Run all existing concurrent tests:");
console.log("   npx jest src/tests/concurrent-*.test.ts --verbose");
console.log("");
