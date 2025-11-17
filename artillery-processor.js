/**
 * Artillery processor for order creation stress testing
 * Fetches real data from database to avoid foreign key errors
 */

const { faker } = require("@faker-js/faker");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Real production data pools - populated by initializeData()
const sampleAgencies = [1, 2]; // Both agencies for testing

// Data arrays to be populated from database
let sampleCustomers = [];
let sampleReceivers = [];
let sampleUsers = [];
let usersByAgency = { 1: [], 2: [] };
const sampleServices = [1]; // Available services

// Data initialization flag
let dataInitialized = false;

// Simple tracking variables
let requestCount = 0;
let agency1Count = 0;
let agency2Count = 0;
let testStartTime = Date.now();

/**
 * Initialize data from database
 * This function fetches real customers, receivers, and users to avoid foreign key errors
 */
async function initializeData(context, events, done) {
	// Only initialize once
	if (dataInitialized) {
		return done();
	}

	try {
		console.log("🔄 Initializing Artillery data from database...");

		// Fetch real customers
		const customers = await prisma.customer.findMany({
			take: 50,
			orderBy: { id: "asc" },
		});

		// Fetch real receivers
		const receivers = await prisma.receiver.findMany({
			take: 50,
			orderBy: { id: "asc" },
		});

		// Fetch real users from both agencies
		const users = await prisma.user.findMany({
			where: {
				agency_id: { in: [1, 2] },
			},
			take: 20,
		});

		// Populate data arrays
		sampleCustomers = customers.map((c) => c.id);
		sampleReceivers = receivers.map((r) => r.id);
		sampleUsers = users.map((u) => u.id);

		// Organize users by agency
		users.forEach((user) => {
			if (user.agency_id === 1) {
				usersByAgency[1].push(user.id);
			} else if (user.agency_id === 2) {
				usersByAgency[2].push(user.id);
			}
		});

		console.log("✅ Artillery data initialized:");
		console.log(`   - Customers: ${sampleCustomers.length}`);
		console.log(`   - Receivers: ${sampleReceivers.length}`);
		console.log(`   - Users: ${sampleUsers.length}`);
		console.log(`   - Agency 1 Users: ${usersByAgency[1].length}`);
		console.log(`   - Agency 2 Users: ${usersByAgency[2].length}`);

		// Validate we have data
		if (sampleCustomers.length === 0) {
			throw new Error("No customers found in database. Please seed customer data first.");
		}
		if (sampleReceivers.length === 0) {
			throw new Error("No receivers found in database. Please seed receiver data first.");
		}
		if (sampleUsers.length === 0) {
			throw new Error("No users found in database for agencies 1 or 2.");
		}

		dataInitialized = true;
		await prisma.$disconnect();
		return done();
	} catch (error) {
		console.error("❌ Failed to initialize Artillery data:", error);
		await prisma.$disconnect();
		throw error;
	}
}

/**
 * Generate a single item for an order
 */
function generateItem() {
	return {
		description: faker.commerce.productName(),
		price_in_cents: faker.number.int({ min: 100, max: 5000 }), // $1 - $50
		rate_id: 1, // Use rate_id = 1 which we know exists
		charge_fee_in_cents: 0,
		insurance_fee_in_cents: faker.number.int({ min: 0, max: 500 }), // $0 - $5
		customs_fee_in_cents: 0, // Set to 0 like in real example
		delivery_fee_in_cents: 0,
		weight: faker.number.int({ min: 1, max: 20 }), // Integer weight
	};
}

/**
 * Generate standard order data (3-10 items)
 */
function generateOrderData(context, events, done) {
	const itemCount = faker.number.int({ min: 3, max: 10 });
	const items = Array.from({ length: itemCount }, () => generateItem());

	// Calculate total from items
	const total_in_cents = items.reduce((total, item) => {
		return total + item.price_in_cents + item.insurance_fee_in_cents + item.customs_fee_in_cents;
	}, 0);

	// Select agency and corresponding user
	const agency_id = faker.helpers.arrayElement(sampleAgencies);
	const agencyUsers = usersByAgency[agency_id];
	const user_id =
		agencyUsers && agencyUsers.length > 0
			? faker.helpers.arrayElement(agencyUsers)
			: faker.helpers.arrayElement(sampleUsers);

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
 * Generate complex order data (8-20 items)
 */
function generateComplexOrderData(context, events, done) {
	const itemCount = faker.number.int({ min: 8, max: 20 });
	const items = Array.from({ length: itemCount }, () => generateItem());

	// Calculate total from items
	const total_in_cents = items.reduce((total, item) => {
		return total + item.price_in_cents + item.insurance_fee_in_cents + item.customs_fee_in_cents;
	}, 0);

	// Select agency and corresponding user
	const agency_id = faker.helpers.arrayElement(sampleAgencies);
	const agencyUsers = usersByAgency[agency_id];
	const user_id =
		agencyUsers && agencyUsers.length > 0
			? faker.helpers.arrayElement(agencyUsers)
			: faker.helpers.arrayElement(sampleUsers);

	// Track agency distribution for complex orders
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
	initializeData,
	generateOrderData,
	generateComplexOrderData,
};
