/**
 * Artillery processor for order creation stress testing
 * Fetches real data from database to avoid foreign key errors
 */

require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { faker } = require("@faker-js/faker");

// Create Prisma client directly (since we can't import TypeScript files)
// Match production setup for consistency
let pool;
try {
   const url = new URL(process.env.DATABASE_URL);
   if (!url.protocol.startsWith("postgres")) {
      throw new Error(`Invalid DATABASE_URL protocol: ${url.protocol}. Expected postgresql:// or postgres://`);
   }

   // Parse connection string and use explicit parameters for better reliability
   pool = new Pool({
      host: url.hostname,
      port: parseInt(url.port || "5432", 10),
      database: url.pathname.slice(1), // Remove leading slash
      user: url.username || undefined,
      password: url.password || undefined,
      // Additional pool configuration for better connection handling
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
   });
} catch (error) {
   // Fallback to connectionString if URL parsing fails
   pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
   });
}

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
   adapter,
   errorFormat: "pretty",
});

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
async function initializeData(context, events) {
	// Only initialize once
	if (dataInitialized) {
		return;
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
		price_in_cents: 199, // Fixed price for testing
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
	context.vars.order_items = items;
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
	context.vars.order_items = items;
	context.vars.paid_in_cents = 0;
	context.vars.total_in_cents = total_in_cents;

	return done();
}

// Export functions for Artillery (CommonJS)
module.exports = {
	initializeData,
	generateOrderData,
	generateComplexOrderData,
};
