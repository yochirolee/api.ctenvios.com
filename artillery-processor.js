/**
 * Artillery processor for invoice creation stress testing
 * Simplified version with clean progress tracking
 */

const { faker } = require("@faker-js/faker");

// Real production data pools for accurate stress testing
const sampleAgencies = [1, 2]; // Both agencies for testing

// Users by agency for realistic testing
const usersByAgency = {
	1: ["R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q"], // Add more users for agency 1 if available
	2: ["7mciYfrdmVDL7aUpfp92SdbJ1juvX2Cg"], // Add users for agency 2 here - you'll need to populate this with real user IDs
};

// Fallback users if no agency-specific users are available
const fallbackUsers = ["R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q"];

const sampleCustomers = Array.from({ length: 200 }, (_, i) => i + 1); // More customers for realistic load
const sampleReceivers = Array.from({ length: 200 }, (_, i) => i + 1); // More receivers for realistic load
const sampleServices = [1]; // Available services
const sampleRateIds = Array.from({ length: 200 }, (_, i) => i + 1); // More rate IDs

// Simple tracking variables
let requestCount = 0;
let agency1Count = 0;
let agency2Count = 0;
let testStartTime = Date.now();

/**
 * Generate a single item for an invoice
 */
function generateItem() {
	return {
		description: faker.commerce.productName(),
		rate_in_cents: faker.number.int({ min: 100, max: 5000 }), // $1 - $50
		rate_id: 1, // Use rate_id = 1 which we know exists
		customs_id: 1, // Same as rate_id
		insurance_fee_in_cents: faker.number.int({ min: 0, max: 500 }), // $0 - $5
		customs_fee_in_cents: 0, // Set to 0 like in real example
		weight: faker.number.int({ min: 1, max: 20 }), // Integer weight
	};
}

/**
 * Generate standard invoice data (3-10 items)
 */
function generateInvoiceData(context, events, done) {
	const itemCount = faker.number.int({ min: 3, max: 10 });
	const items = Array.from({ length: itemCount }, () => generateItem());

	// Calculate total from items
	const total_in_cents = items.reduce((total, item) => {
		return total + item.rate_in_cents + item.insurance_fee_in_cents + item.customs_fee_in_cents;
	}, 0);

	// Select agency and corresponding user
	const agency_id = faker.helpers.arrayElement(sampleAgencies);
	const agencyUsers = usersByAgency[agency_id];
	const user_id =
		agencyUsers && agencyUsers.length > 0
			? faker.helpers.arrayElement(agencyUsers)
			: faker.helpers.arrayElement(fallbackUsers);

	// Track agency distribution
	if (agency_id === 1) agency1Count++;
	if (agency_id === 2) agency2Count++;

	requestCount++;

	// Show progress every 50 requests
	if (requestCount % 50 === 0) {
		const elapsed = Math.floor((Date.now() - testStartTime) / 1000);
		console.log(
			`⚡ Progress: ${requestCount} requests | ${elapsed}s elapsed | A1:${agency1Count} A2:${agency2Count}`,
		);
	}

	// Set context variables for use in the request
	context.vars.agency_id = agency_id;
	context.vars.user_id = user_id;
	context.vars.customer_id = faker.helpers.arrayElement(sampleCustomers);
	context.vars.receiver_id = faker.helpers.arrayElement(sampleReceivers);
	context.vars.service_id = 1; // Use service ID 1 which we know exists
	context.vars.items = items;
	context.vars.paid_in_cents = 0;
	context.vars.total_in_cents = total_in_cents;

	return done();
}

/**
 * Generate complex invoice data (8-20 items)
 */
function generateComplexInvoiceData(context, events, done) {
	const itemCount = faker.number.int({ min: 8, max: 20 });
	const items = Array.from({ length: itemCount }, () => generateItem());

	// Calculate total from items
	const total_in_cents = items.reduce((total, item) => {
		return total + item.rate_in_cents + item.insurance_fee_in_cents + item.customs_fee_in_cents;
	}, 0);

	// Select agency and corresponding user
	const agency_id = faker.helpers.arrayElement(sampleAgencies);
	const agencyUsers = usersByAgency[agency_id];
	const user_id =
		agencyUsers && agencyUsers.length > 0
			? faker.helpers.arrayElement(agencyUsers)
			: faker.helpers.arrayElement(fallbackUsers);

	// Track agency distribution for complex invoices
	if (agency_id === 1) agency1Count++;
	if (agency_id === 2) agency2Count++;

	requestCount++;

	// Show progress every 50 requests
	if (requestCount % 50 === 0) {
		const elapsed = Math.floor((Date.now() - testStartTime) / 1000);
		console.log(
			`⚡ Progress: ${requestCount} requests | ${elapsed}s elapsed | A1:${agency1Count} A2:${agency2Count}`,
		);
	}

	// Set context variables for use in the request
	context.vars.agency_id = agency_id;
	context.vars.user_id = user_id;
	context.vars.customer_id = faker.helpers.arrayElement(sampleCustomers);
	context.vars.receiver_id = faker.helpers.arrayElement(sampleReceivers);
	context.vars.service_id = 1; // Use service ID 1 which we know exists
	context.vars.complex_items = items;
	context.vars.paid_in_cents = 0;
	context.vars.total_in_cents = total_in_cents;

	return done();
}

module.exports = {
	generateInvoiceData,
	generateComplexInvoiceData,
};
