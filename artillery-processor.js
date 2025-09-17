/**
 * Artillery processor for invoice creation stress testing
 * Generates realistic test data following TypeScript patterns
 */

const { faker } = require("@faker-js/faker");

// Real production data pools for accurate stress testing
const sampleAgencies = [1]; // Your main agency
const sampleUsers = ["R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q"]; // Your user ID
const sampleCustomers = Array.from({ length: 200 }, (_, i) => i + 1); // More customers for realistic load
const sampleReceivers = Array.from({ length: 200 }, (_, i) => i + 1); // More receivers for realistic load
const sampleServices = [1]; // Available services
const sampleRateIds = Array.from({ length: 200 }, (_, i) => i + 1); // More rate IDs

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

	// Set context variables for use in the request
	context.vars.agency_id = faker.helpers.arrayElement(sampleAgencies);
	context.vars.user_id = faker.helpers.arrayElement(sampleUsers);
	context.vars.customer_id = faker.helpers.arrayElement(sampleCustomers);
	context.vars.receiver_id = faker.helpers.arrayElement(sampleReceivers);
	context.vars.service_id = 1; // Use service ID 1 which we know exists
	context.vars.items = items;
	context.vars.paid_in_cents = 0;
	context.vars.total_in_cents = total_in_cents;

	return done();
}

/**
 * Generate complex invoice data (8-15 items)
 */
function generateComplexInvoiceData(context, events, done) {
	const itemCount = faker.number.int({ min: 8, max: 15 });
	const items = Array.from({ length: itemCount }, () => generateItem());

	// Calculate total from items
	const total_in_cents = items.reduce((total, item) => {
		return total + item.rate_in_cents + item.insurance_fee_in_cents + item.customs_fee_in_cents;
	}, 0);

	// Set context variables for use in the request
	context.vars.agency_id = faker.helpers.arrayElement(sampleAgencies);
	context.vars.user_id = faker.helpers.arrayElement(sampleUsers);
	context.vars.customer_id = faker.helpers.arrayElement(sampleCustomers);
	context.vars.receiver_id = faker.helpers.arrayElement(sampleReceivers);
	context.vars.service_id = 1; // Use service ID 1 which we know exists
	context.vars.complex_items = items;
	context.vars.paid_in_cents = 0;
	context.vars.total_in_cents = total_in_cents;

	return done();
}

/**
 * Custom metrics collection
 */
function collectMetrics(context, events, done) {
	// Log performance metrics
	events.on("response", (data) => {
		const responseTime = data.response.timings.phases.total;
		console.log(`Response time: ${responseTime}ms, Status: ${data.response.statusCode}`);
	});

	events.on("error", (error) => {
		console.error("Request error:", error.message);
	});

	return done();
}

module.exports = {
	generateInvoiceData,
	generateComplexInvoiceData,
	collectMetrics,
};
