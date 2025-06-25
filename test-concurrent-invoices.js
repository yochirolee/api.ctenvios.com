import fetch from "node-fetch";

async function testConcurrentInvoices() {
	const baseUrl = "http://localhost:3000/api";

	// Test configuration
	const testConfig = {
		agency_id: 1,
		service_id: 1,
		user_id: "test-user-1",
		customer_id: 1,
		receipt_id: 1,
		concurrent_users: 5,
		items_per_user: 3,
		quantity_per_item: 100,
	};

	console.log("🧪 Starting Concurrent Invoice Creation Test...\n");
	console.log(`Configuration:
- Concurrent Users: ${testConfig.concurrent_users}
- Items per User: ${testConfig.items_per_user}
- Quantity per Item: ${testConfig.quantity_per_item}
- Expected Total HBL Codes: ${
		testConfig.concurrent_users * testConfig.items_per_user * testConfig.quantity_per_item
	}
`);

	const startTime = Date.now();

	// Create concurrent invoice creation requests
	const promises = Array.from({ length: testConfig.concurrent_users }, (_, userIndex) => {
		const invoiceData = {
			user_id: testConfig.user_id,
			agency_id: testConfig.agency_id,
			customer_id: testConfig.customer_id,
			receipt_id: testConfig.receipt_id,
			service_id: testConfig.service_id,
			items: Array.from({ length: testConfig.items_per_user }, (_, itemIndex) => ({
				name: `Test Item ${itemIndex + 1} - User ${userIndex + 1}`,
				quantity: testConfig.quantity_per_item,
				weight: Math.random() * 10 + 1, // Random weight between 1-11 kg
				rate: Math.random() * 50 + 10, // Random rate between $10-60
			})),
		};

		return fetch(`${baseUrl}/invoices`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(invoiceData),
		})
			.then(async (response) => {
				const data = await response.json();
				if (!response.ok) {
					throw new Error(data.message || `HTTP ${response.status}`);
				}
				return {
					userId: userIndex + 1,
					success: true,
					invoice: data,
					hbl_codes: data.items?.map((item) => item.hbl) || [],
				};
			})
			.catch((error) => ({
				userId: userIndex + 1,
				success: false,
				error: error.message,
			}));
	});

	try {
		const results = await Promise.all(promises);
		const endTime = Date.now();

		// Analyze results
		const successful = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success);
		const allHblCodes = successful.flatMap((r) => r.hbl_codes || []);
		const uniqueHblCodes = [...new Set(allHblCodes)];

		console.log("📊 Test Results:");
		console.log(`⏱️  Execution Time: ${endTime - startTime}ms`);
		console.log(`✅ Successful Requests: ${successful.length}/${testConfig.concurrent_users}`);
		console.log(`❌ Failed Requests: ${failed.length}`);
		console.log(`📦 Total HBL Codes Generated: ${allHblCodes.length}`);
		console.log(`🔢 Unique HBL Codes: ${uniqueHblCodes.length}`);
		console.log(
			`🎯 Success Rate: ${((successful.length / testConfig.concurrent_users) * 100).toFixed(2)}%`,
		);

		// Performance metrics
		const avgResponseTime = (endTime - startTime) / testConfig.concurrent_users;
		const hblCodesPerSecond = Math.round(allHblCodes.length / ((endTime - startTime) / 1000));
		const invoicesPerSecond = Math.round(successful.length / ((endTime - startTime) / 1000));

		console.log("\n⚡ Performance Metrics:");
		console.log(`📈 Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
		console.log(`🏃 HBL Codes/Second: ${hblCodesPerSecond}`);
		console.log(`📋 Invoices/Second: ${invoicesPerSecond}`);

		// Check for duplicates
		const hasDuplicates = allHblCodes.length !== uniqueHblCodes.length;
		console.log(`\n🔍 HBL Code Analysis:`);
		console.log(`Duplicates Found: ${hasDuplicates ? "❌ YES" : "✅ NO"}`);

		if (hasDuplicates) {
			const duplicates = allHblCodes.filter((code, index) => allHblCodes.indexOf(code) !== index);
			console.log(`Duplicate Codes:`, [...new Set(duplicates)]);
		}

		// Show failed requests if any
		if (failed.length > 0) {
			console.log("\n❌ Failed Requests:");
			failed.forEach((f) => {
				console.log(`User ${f.userId}: ${f.error}`);
			});
		}

		// Show sample HBL codes
		if (allHblCodes.length > 0) {
			console.log("\n📋 Sample HBL Codes:");
			const sampleCodes = allHblCodes.slice(0, 10);
			sampleCodes.forEach((code) => console.log(`  ${code}`));
			if (allHblCodes.length > 10) {
				console.log(`  ... and ${allHblCodes.length - 10} more`);
			}
		}

		// Overall test result
		console.log("\n🏆 Test Result:");
		if (failed.length === 0 && !hasDuplicates) {
			console.log("🎉 ALL TESTS PASSED! ✅");
			console.log("✓ All requests succeeded");
			console.log("✓ All HBL codes are unique");
			console.log("✓ No duplicates found");
		} else {
			console.log("⚠️  TEST ISSUES DETECTED ❌");
			if (failed.length > 0) console.log(`- ${failed.length} requests failed`);
			if (hasDuplicates) console.log("- Duplicate HBL codes found");
		}
	} catch (error) {
		console.error("💥 Test execution failed:", error);
	}
}

// Run the test
testConcurrentInvoices();
