const { exec } = require("child_process");

console.log("🚀 Starting 100 Concurrent Invoices Stress Test...\n");

// Display test information
console.log("📋 TEST DETAILS:");
console.log("   🎯 Target: 100 concurrent invoice creations");
console.log("   📦 Items per invoice: 3");
console.log("   🔢 Total expected HBL codes: 300");
console.log("   ⚡ Testing HBL uniqueness under extreme load");
console.log("   🕒 Estimated duration: 30-60 seconds\n");

console.log("⚠️  WARNING: This is a stress test that will:");
console.log("   - Create 100 invoices simultaneously");
console.log("   - Generate 300 HBL codes");
console.log("   - Test database performance under load");
console.log("   - Clean up all test data afterwards\n");

// Ask for confirmation (simulated - in real scenario you might want user input)
console.log("🚦 Starting stress test in 3 seconds...\n");

setTimeout(() => {
	// Run the stress test
	const testCommand = "npx tsx src/tests/stress-test-100-invoices.ts";

	console.log("🏁 Executing stress test...\n");

	const startTime = Date.now();

	exec(testCommand, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
		const endTime = Date.now();
		const totalTime = endTime - startTime;

		if (error) {
			console.error(`❌ Stress test execution error: ${error}`);
			console.log("\n🔍 TROUBLESHOOTING:");
			console.log("   1. Check database connection");
			console.log("   2. Ensure Prisma is properly configured");
			console.log("   3. Verify sufficient system resources");
			console.log("   4. Check for any database locks or constraints");
			return;
		}

		if (stderr) {
			console.error(`⚠️  Test warnings: ${stderr}`);
		}

		console.log(stdout);

		// Analyze results from stdout
		if (stdout.includes("STRESS TEST PASSED")) {
			console.log(
				"\n🎉 SUCCESS! Your HBL generation system handles 100 concurrent invoices perfectly!",
			);
			console.log("✅ All HBL codes were unique");
			console.log("✅ System performance is excellent");
			console.log("🚀 Ready for production high-load scenarios");
		} else if (stdout.includes("STRESS TEST REVEALED ISSUES")) {
			console.log("\n⚠️  ISSUES DETECTED during stress test:");

			if (stdout.includes("Fix HBL uniqueness system")) {
				console.log("❌ CRITICAL: HBL codes are not unique under high load");
				console.log("🔧 Action needed: Review HBL generation logic");
			}

			if (stdout.includes("Improve success rate")) {
				console.log("⚡ WARNING: Some invoices failed to create");
				console.log("🔧 Action needed: Check database performance and timeouts");
			}

			if (stdout.includes("Optimize performance")) {
				console.log("🐌 INFO: System is slow under high load");
				console.log("🔧 Action needed: Consider performance optimizations");
			}
		} else if (stdout.includes("Stress test failed")) {
			console.log("\n💥 FAILURE: Stress test encountered critical errors");
			console.log("🔧 Action needed: Check logs above for specific issues");
		}

		console.log(
			`\n⏱️  Total test execution time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`,
		);

		// Performance assessment
		if (totalTime < 30000) {
			console.log("⚡ Performance: EXCELLENT (< 30s)");
		} else if (totalTime < 60000) {
			console.log("✅ Performance: GOOD (< 60s)");
		} else {
			console.log("⚠️  Performance: NEEDS OPTIMIZATION (> 60s)");
		}
	});
}, 3000);

// Also provide manual execution commands
console.log("📋 MANUAL EXECUTION OPTIONS:");
console.log("1. Run stress test directly:");
console.log("   npx tsx src/tests/stress-test-100-invoices.ts");
console.log("");
console.log("2. Run with Node.js:");
console.log("   node -r ts-node/register src/tests/stress-test-100-invoices.ts");
console.log("");
console.log("3. Monitor system resources during test:");
console.log("   # In another terminal:");
console.log("   # Windows: tasklist | findstr node");
console.log("   # Linux/Mac: top | grep node");
console.log("");

// Performance tips
console.log("💡 PERFORMANCE TIPS:");
console.log("   - Close unnecessary applications during test");
console.log("   - Ensure database has sufficient connections available");
console.log("   - Monitor CPU and memory usage");
console.log("   - Test on production-like hardware for realistic results");
console.log("");
