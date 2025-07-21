import mysql from "mysql2/promise";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Convert snake_case to camelCase
function toCamelCase(str: string): string {
	return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert address components to proper title case
function toTitleCase(str: string): string {
	if (!str) return str;

	// Words that should remain lowercase (prepositions, articles, etc.)
	const lowercaseWords = ["de", "del", "la", "el", "y", "entre", "por", "con", "en", "a", "al"];

	return str
		.toLowerCase()
		.split(/\s+/)
		.map((word, index) => {
			// First word is always capitalized
			if (index === 0) {
				return word.charAt(0).toUpperCase() + word.slice(1);
			}
			// Keep lowercase words lowercase unless they're the first word
			if (lowercaseWords.includes(word)) {
				return word;
			}
			// Capitalize other words
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(" ");
}

function keysToCamelCase<T extends Record<string, any>>(row: T): T {
	const newRow: Record<string, any> = {};
	for (const key in row) {
		newRow[toCamelCase(key)] = row[key];
	}
	return newRow as T;
}

// Split full name into parts
function splitFullName(fullName: string): {
	first_name: string;
	middle_name: string | null;
	last_name: string;
	second_last_name: string | null;
} {
	const parts = fullName
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1));

	return {
		first_name: parts[0] ?? "",
		middle_name: parts.length === 4 ? parts[1] : null,
		last_name: parts.length >= 3 ? parts[parts.length - 2] : parts[1] ?? "",
		second_last_name: parts.length === 4 ? parts[3] : parts[2] ?? null,
	};
}

function normalizeMobile(mobile?: string | null): string | null {
	if (!mobile) return null;
	const m = mobile.trim();
	return m.length === 8 ? "53" + m : m;
}

// Number to word conversions for Cuban locations
const numberToWordMap: Record<string, string> = {
	"1": "uno",
	"2": "dos",
	"3": "tres",
	"4": "cuatro",
	"5": "cinco",
	"6": "seis",
	"7": "siete",
	"8": "ocho",
	"9": "nueve",
	"10": "diez",
	"11": "once",
	"12": "doce",
	"13": "trece",
	"14": "catorce",
	"15": "quince",
	"16": "dieciseis",
	"17": "diecisiete",
	"18": "dieciocho",
	"19": "diecinueve",
	"20": "veinte",
	"21": "veintiuno",
	"22": "veintidos",
	"23": "veintitres",
	"24": "veinticuatro",
	"25": "veinticinco",
	"26": "veintiseis",
	"27": "veintisiete",
	"28": "veintiocho",
	"29": "veintinueve",
	"30": "treinta",
};

// Character replacements for common encoding issues in Cuban locations
const characterReplacements: Record<string, string> = {
	"?": "u", // Common corruption of ü in "Güira"
	ü: "u", // German umlaut to regular u
	ñ: "n", // Spanish ñ to n (handled by NFD but backup)
	"–": "-", // En dash to hyphen
	"—": "-", // Em dash to hyphen
};

// Known Cuban location name variations and corrections
const cubanLocationMappings: Record<string, string> = {
	"rafael freire": "rafael freyre",
	freire: "freyre",
	varadero: "cardenas",
	// Add more Cuban location variations as needed
};

// Normalize text for fuzzy matching (remove accents, extra spaces, handle numbers, fix encoding)
function normalizeText(text: string): string {
	let normalized = text
		.toLowerCase()
		.normalize("NFD") // Decompose accented characters
		.replace(/[\u0300-\u036f]/g, "") // Remove accent marks
		.replace(/\s+/g, " ") // Replace multiple spaces with single space
		.trim();

	// Fix common character encoding issues
	for (const [corrupted, correct] of Object.entries(characterReplacements)) {
		// Escape special regex characters
		const escapedCorrupted = corrupted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		normalized = normalized.replace(new RegExp(escapedCorrupted, "g"), correct);
	}

	// Apply Cuban location name corrections
	for (const [incorrect, correct] of Object.entries(cubanLocationMappings)) {
		normalized = normalized.replace(new RegExp(`\\b${incorrect}\\b`, "g"), correct);
	}

	// Convert numbers to words for Cuban locations
	for (const [number, word] of Object.entries(numberToWordMap)) {
		// Replace standalone numbers (with word boundaries)
		const regex = new RegExp(`\\b${number}\\b`, "g");
		normalized = normalized.replace(regex, word);
	}

	return normalized;
}

// Enhanced province/city matching with fuzzy logic
function findLocationMatch(
	searchName: string,
	locationMap: Map<string, { id: number; name: string }>,
): { id: number; name: string } | null {
	if (!searchName) return null;

	const normalizedSearch = normalizeText(searchName);

	// Try exact match first (normalized)
	const exactMatch = locationMap.get(normalizedSearch);
	if (exactMatch) return exactMatch;

	// Try reverse number conversion (word to number) for additional matching
	let reverseSearch = normalizedSearch;
	for (const [number, word] of Object.entries(numberToWordMap)) {
		const regex = new RegExp(`\\b${word}\\b`, "g");
		reverseSearch = reverseSearch.replace(regex, number);
	}

	if (reverseSearch !== normalizedSearch) {
		const reverseMatch = locationMap.get(reverseSearch);
		if (reverseMatch) return reverseMatch;
	}

	// Try partial matching for common variations
	for (const [normalizedName, location] of locationMap) {
		// Check if names are similar (handle common variations)
		if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName)) {
			return location;
		}

		// Handle "del" vs "de" variations (e.g., "Pinar del Rio" vs "Pinar de Rio")
		const searchVariant = normalizedSearch.replace(/ de /g, " del ").replace(/ del /g, " de ");
		if (normalizedName === searchVariant) {
			return location;
		}

		// Try reverse number matching
		if (normalizedName.includes(reverseSearch) || reverseSearch.includes(normalizedName)) {
			return location;
		}
	}

	return null;
}

interface ProcessedReceipt {
	ci: string;
	first_name: string;
	middle_name: string | null;
	last_name: string;
	second_last_name: string;
	mobile: string | null;
	address: string;
	provinceId: number;
	cityId: number;
}

// Debug function to find similar location names
function findSimilarLocations(
	searchName: string,
	locationMap: Map<string, { id: number; name: string }>,
	maxSuggestions: number = 3,
): string[] {
	if (!searchName) return [];

	const normalizedSearch = normalizeText(searchName);
	const suggestions: string[] = [];

	for (const [normalizedName, location] of locationMap) {
		// Calculate similarity score (simple approach)
		const similarity = calculateSimilarity(normalizedSearch, normalizedName);
		if (similarity > 0.6) {
			// 60% similarity threshold
			suggestions.push(location.name);
		}

		if (suggestions.length >= maxSuggestions) break;
	}

	return suggestions;
}

// Simple similarity calculation
function calculateSimilarity(str1: string, str2: string): number {
	const longer = str1.length > str2.length ? str1 : str2;
	const shorter = str1.length > str2.length ? str2 : str1;

	if (longer.length === 0) return 1.0;

	const matches = longer.split("").filter((char) => shorter.includes(char)).length;
	return matches / longer.length;
}

// Normalize entre field - handle existing "entre" or "e/" and standardize
function normalizeEntreField(entreCll: string | null): string | null {
	if (!entreCll) return null;

	const text = entreCll.trim();
	if (!text) return null;

	// Check if text already contains "entre" or "e/"
	const lowerText = text.toLowerCase();

	let result: string;
	if (lowerText.includes("entre") || lowerText.includes("e/")) {
		// Replace existing "entre" or "e/" with standardized "entre"
		result = text
			.replace(/\b(entre|e\/)\b/gi, "entre")
			.replace(/\s+/g, " ")
			.trim();
	} else {
		// Add "entre" prefix if not present
		result = `entre ${text}`;
	}

	// Apply title case formatting
	return toTitleCase(result);
}

// Data validation and sanitization
function validateAndSanitizeReceipt(receipt: ProcessedReceipt): ProcessedReceipt | null {
	// Check for required fields
	if (!receipt.ci || !receipt.first_name || !receipt.last_name) {
		console.warn(`⚠️ Missing required fields, skipping receipt: ${receipt.ci}`);
		return null;
	}

	// Validate and truncate CI to 11 characters (database constraint)
	const sanitizedCi = receipt.ci.trim().slice(0, 11);
	if (sanitizedCi.length < 8) {
		console.warn(`⚠️ CI too short (${sanitizedCi.length} chars), skipping: ${sanitizedCi}`);
		return null;
	}

	// Sanitize string fields with reasonable length limits
	const sanitizeString = (str: string | null, maxLength: number): string | null => {
		if (!str) return null;
		const trimmed = str.trim();
		if (trimmed.length === 0) return null;
		return trimmed.slice(0, maxLength);
	};

	// Validate mobile format
	let sanitizedMobile = receipt.mobile;
	if (sanitizedMobile) {
		sanitizedMobile = sanitizedMobile.replace(/\D/g, ""); // Remove non-digits
		if (sanitizedMobile.length < 10 || sanitizedMobile.length > 15) {
			console.warn(
				`⚠️ Invalid mobile format for CI ${sanitizedCi}, removing mobile: ${sanitizedMobile}`,
			);
			sanitizedMobile = null;
		}
	}

	return {
		ci: sanitizedCi,
		first_name: sanitizeString(receipt.first_name, 50) || "Unknown",
		middle_name: sanitizeString(receipt.middle_name, 50),
		last_name: sanitizeString(receipt.last_name, 50) || "Unknown",
		second_last_name: sanitizeString(receipt.second_last_name, 50) || "",
		mobile: sanitizedMobile,
		address: sanitizeString(receipt.address, 500) || "",
		provinceId: receipt.provinceId,
		cityId: receipt.cityId,
	};
}

// Process raw row data into receipt format
function processReceiptRow(
	row: any,
	provinceMap: Map<string, { id: number; name: string }>,
	cityMap: Map<string, { id: number; name: string }>,
): ProcessedReceipt | null {
	const ci = row.receiverCi?.trim();
	if (!ci) return null;

	let mobile = normalizeMobile(row.receiverMobile);

	// If mobile exists, validate length and only keep digits
	if (mobile) {
		mobile = mobile.replace(/\D/g, ""); // remove non-digits
		if (mobile.length < 10) {
			console.warn(`⚠️ Mobile too short for ${ci}, skipping mobile: ${mobile}`);
			mobile = null;
		}
	}

	const { first_name, middle_name, last_name, second_last_name } = splitFullName(row.receiver);

	const address = [
		row.cll,
		normalizeEntreField(row.entreCll),
		row.no ? `No ${row.no}` : null,
		row.apto ? `Apto ${row.apto}` : null,
		row.reparto ? `Reparto ${row.reparto}` : null,
	]
		.filter(Boolean)
		.map((s) => (s?.trim().length > 2 ? toTitleCase(s?.trim()) : s?.trim()))
		.join(" ");

	const province = findLocationMatch(row.province?.trim() ?? "", provinceMap);
	const city = findLocationMatch(row.city?.trim() ?? "", cityMap);

	if (!province || !city) {
		let warningMessage = `⛔ Skipping ${ci}: Location not found.`;

		if (!province) {
			const provinceSuggestions = findSimilarLocations(row.province?.trim() ?? "", provinceMap);
			warningMessage += `\n   Province: "${row.province}" not found.`;
			if (provinceSuggestions.length > 0) {
				warningMessage += ` Similar: [${provinceSuggestions.join(", ")}]`;
			}
		}

		if (!city) {
			const citySuggestions = findSimilarLocations(row.city?.trim() ?? "", cityMap);
			warningMessage += `\n   City: "${row.city}" not found.`;
			if (citySuggestions.length > 0) {
				warningMessage += ` Similar: [${citySuggestions.join(", ")}]`;
			}
		}

		console.warn(warningMessage);
		return null;
	}

	return {
		ci,
		first_name,
		middle_name,
		last_name,
		second_last_name: second_last_name ?? "",
		mobile,
		address,
		provinceId: province.id,
		cityId: city.id,
	};
}

// Chunk array into smaller batches
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}
	return chunks;
}

// Optimized batch upsert using updateMany and createMany
async function batchUpsertReceipts(receipts: ProcessedReceipt[]): Promise<void> {
	const BATCH_SIZE = 100; // Increased batch size for better performance
	const chunks = chunkArray(receipts, BATCH_SIZE);

	console.log(
		`📦 Processing ${receipts.length} receipts in ${chunks.length} batches of ${BATCH_SIZE}`,
	);

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		console.log(`🔄 Processing batch ${i + 1}/${chunks.length} (${chunk.length} receipts)`);

		try {
			await prisma.$transaction(
				async (tx) => {
					// Get all CIs in this chunk
					const chunkCIs = chunk.map((r) => r.ci);

					// Find existing receipts
					const existingReceipts = await tx.receipt.findMany({
						where: { ci: { in: chunkCIs } },
						select: { ci: true },
					});

					const existingCIs = new Set(existingReceipts.map((r) => r.ci));

					// Separate new and existing receipts
					const newReceipts = chunk.filter((r) => !existingCIs.has(r.ci));
					const existingReceiptsToUpdate = chunk.filter((r) => existingCIs.has(r.ci));

					// Insert new receipts using createMany
					if (newReceipts.length > 0) {
						await tx.receipt.createMany({
							data: newReceipts.map((receipt) => ({
								first_name: receipt.first_name,
								middle_name: receipt.middle_name,
								last_name: receipt.last_name,
								second_last_name: receipt.second_last_name,
								mobile: receipt.mobile,
								ci: receipt.ci,
								address: receipt.address,
								province_id: receipt.provinceId,
								city_id: receipt.cityId,
							})),
							skipDuplicates: true,
						});
						console.log(`   ✅ Created ${newReceipts.length} new receipts`);
					}

					// Update existing receipts - unfortunately, we need to do this individually
					// since updateMany doesn't support different data per record
					if (existingReceiptsToUpdate.length > 0) {
						for (const receipt of existingReceiptsToUpdate) {
							await tx.receipt.update({
								where: { ci: receipt.ci },
								data: {
									first_name: receipt.first_name,
									middle_name: receipt.middle_name,
									last_name: receipt.last_name,
									second_last_name: receipt.second_last_name,
									mobile: receipt.mobile,
									address: receipt.address,
									province_id: receipt.provinceId,
									city_id: receipt.cityId,
								},
							});
						}
						console.log(`   ✅ Updated ${existingReceiptsToUpdate.length} existing receipts`);
					}
				},
				{
					timeout: 60000, // 60 seconds timeout
				},
			);

			console.log(`✅ Batch ${i + 1} completed successfully`);
		} catch (error: any) {
			console.error(`❌ Error in batch ${i + 1}:`, error.message);

			// If it's a data validation error, try to process records individually
			if (error.code === "P2000") {
				console.log(`🔍 Processing batch ${i + 1} individually to identify problematic records...`);
				for (const receipt of chunk) {
					try {
						await prisma.receipt.upsert({
							where: { ci: receipt.ci },
							create: {
								first_name: receipt.first_name,
								middle_name: receipt.middle_name,
								last_name: receipt.last_name,
								second_last_name: receipt.second_last_name,
								mobile: receipt.mobile,
								ci: receipt.ci,
								address: receipt.address,
								province: { connect: { id: receipt.provinceId } },
								city: { connect: { id: receipt.cityId } },
							},
							update: {
								first_name: receipt.first_name,
								middle_name: receipt.middle_name,
								last_name: receipt.last_name,
								second_last_name: receipt.second_last_name,
								mobile: receipt.mobile,
								address: receipt.address,
								province: { connect: { id: receipt.provinceId } },
								city: { connect: { id: receipt.cityId } },
							},
						});
					} catch (individualError: any) {
						console.error(`❌ Failed to process receipt ${receipt.ci}:`, individualError.message);
					}
				}
			}
		}
	}
}

// Alternative: Faster batch processing using optimized createMany + updateMany approach
async function batchUpsertReceiptsFast(receipts: ProcessedReceipt[]): Promise<void> {
	const BATCH_SIZE = 200; // Larger batches for better performance
	const chunks = chunkArray(receipts, BATCH_SIZE);

	console.log(
		`🚀 Using fast batch processing: ${receipts.length} receipts in ${chunks.length} batches`,
	);

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		console.log(`🔄 Processing batch ${i + 1}/${chunks.length} (${chunk.length} receipts)`);

		try {
			await prisma.$transaction(
				async (tx) => {
					// Step 1: Check which records already exist
					const chunkCIs = chunk.map((r) => r.ci);
					const existingReceipts = await tx.receipt.findMany({
						where: { ci: { in: chunkCIs } },
						select: { ci: true },
					});

					const existingCIs = new Set(existingReceipts.map((r) => r.ci));

					// Step 2: Separate new and existing receipts
					const newReceipts = chunk.filter((r) => !existingCIs.has(r.ci));
					const existingReceiptsToUpdate = chunk.filter((r) => existingCIs.has(r.ci));

					// Step 3: Insert new records using createMany
					if (newReceipts.length > 0) {
						await tx.receipt.createMany({
							data: newReceipts.map((receipt) => ({
								first_name: receipt.first_name,
								middle_name: receipt.middle_name,
								last_name: receipt.last_name,
								second_last_name: receipt.second_last_name,
								mobile: receipt.mobile,
								ci: receipt.ci,
								address: receipt.address,
								province_id: receipt.provinceId,
								city_id: receipt.cityId,
							})),
							skipDuplicates: true,
						});
					}

					// Step 4: Update existing records
					// Group by common field values for potential updateMany usage
					if (existingReceiptsToUpdate.length > 0) {
						// For now, update individually since each record has different data
						// In the future, we could group by common patterns for updateMany
						for (const receipt of existingReceiptsToUpdate) {
							await tx.receipt.update({
								where: { ci: receipt.ci },
								data: {
									first_name: receipt.first_name,
									middle_name: receipt.middle_name,
									last_name: receipt.last_name,
									second_last_name: receipt.second_last_name,
									mobile: receipt.mobile,
									address: receipt.address,
									province_id: receipt.provinceId,
									city_id: receipt.cityId,
								},
							});
						}
					}

					console.log(
						`   ✅ Batch ${i + 1}: ${newReceipts.length} created, ${
							existingReceiptsToUpdate.length
						} updated`,
					);
				},
				{ timeout: 120000 }, // 2 minutes timeout for large batches
			);

			console.log(`✅ Batch ${i + 1} completed successfully`);
		} catch (error: any) {
			console.error(`❌ Error in batch ${i + 1}:`, error.message);

			// If it's a data validation error, try to process records individually
			if (error.code === "P2000") {
				console.log(`🔍 Processing batch ${i + 1} individually to identify problematic records...`);
				for (const receipt of chunk) {
					try {
						await prisma.receipt.upsert({
							where: { ci: receipt.ci },
							create: {
								first_name: receipt.first_name,
								middle_name: receipt.middle_name,
								last_name: receipt.last_name,
								second_last_name: receipt.second_last_name,
								mobile: receipt.mobile,
								ci: receipt.ci,
								address: receipt.address,
								province_id: receipt.provinceId,
								city_id: receipt.cityId,
							},
							update: {
								first_name: receipt.first_name,
								middle_name: receipt.middle_name,
								last_name: receipt.last_name,
								second_last_name: receipt.second_last_name,
								mobile: receipt.mobile,
								address: receipt.address,
								province_id: receipt.provinceId,
								city_id: receipt.cityId,
							},
						});
					} catch (individualError: any) {
						console.error(`❌ Failed to process receipt ${receipt.ci}:`, individualError.message);
					}
				}
			}
		}
	}
}

async function main(): Promise<void> {
	console.log("🚀 Starting receipt import process...");

	const oldDb = await mysql.createConnection({
		host: "srv827.hstgr.io",
		user: "u373067935_caeenvio_mysgc",
		password: "CaribeAgencia*2022",
		database: "u373067935_cte",
	});

	try {
		// Step 1: Load all reference data
		console.log("📋 Loading provinces and cities...");
		const provinces = await prisma.province.findMany();
		const cities = await prisma.city.findMany();

		// Create lookup maps with normalized keys for fuzzy matching
		const provinceMap = new Map(provinces.map((p) => [normalizeText(p.name), p]));
		const cityMap = new Map(cities.map((c) => [normalizeText(c.name), c]));

		// Step 2: Load all receipt data from MySQL
		console.log("📊 Loading all receipt data from MySQL...");
		const [rows] = await oldDb.execute<any[]>(`
			SELECT DISTINCT 
				receiver, receiverMobile, receiverCi,
				cll, entre_cll, no, apto, reparto,
				province, city
			FROM parcels
			WHERE receiver IS NOT NULL AND receiverCi IS NOT NULL
		`);

		console.log(`📦 Found ${rows.length} raw receipt records`);

		// Step 3: Process all data in memory
		console.log("🔄 Processing receipt data...");
		const processedReceipts: ProcessedReceipt[] = [];
		let validationErrors = 0;
		let locationMatchingErrors = 0;

		for (const rawRow of rows) {
			const row = keysToCamelCase(rawRow);
			const processedReceipt = processReceiptRow(row, provinceMap, cityMap);

			if (processedReceipt) {
				// Apply data validation and sanitization
				const sanitizedReceipt = validateAndSanitizeReceipt(processedReceipt);
				if (sanitizedReceipt) {
					processedReceipts.push(sanitizedReceipt);
				} else {
					validationErrors++;
				}
			} else {
				locationMatchingErrors++;
			}
		}

		console.log(`✅ Successfully processed ${processedReceipts.length} receipts`);

		// Show processing statistics
		console.log("📊 Processing summary:");
		console.log(`   Total raw records: ${rows.length}`);
		console.log(`   Successfully processed: ${processedReceipts.length}`);
		if (validationErrors > 0) {
			console.warn(`   ⚠️ Validation errors: ${validationErrors}`);
		}
		if (locationMatchingErrors > 0) {
			console.warn(`   ⚠️ Location matching errors: ${locationMatchingErrors}`);
		}

		// Step 4: Batch upsert all receipts
		if (processedReceipts.length > 0) {
			// Use faster method for large datasets (>1000 records)
			if (processedReceipts.length > 1000) {
				console.log("🚀 Using fast batch processing for large dataset");
				await batchUpsertReceiptsFast(processedReceipts);
			} else {
				console.log("🔄 Using standard batch processing");
				await batchUpsertReceipts(processedReceipts);
			}
		}

		console.log("✅ Receipt import completed successfully");
	} finally {
		await oldDb.end();
	}
}

main()
	.catch((e) => {
		console.error("❌ Error seeding receipts:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
