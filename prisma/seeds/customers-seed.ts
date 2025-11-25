import mysql from "mysql2/promise";
import prisma from "../../src/lib/prisma.client";

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

// Normalize mobile phone number
function normalizeMobile(mobile?: string | null, tel?: string | null): string | null {
   // Prefer cel (cell phone) over tel (landline)
   const primaryPhone = mobile || tel;
   if (!primaryPhone) return null;

   const cleaned = primaryPhone.trim().replace(/\D/g, ""); // Remove non-digits

   // Cuban mobile numbers are 8 digits, add country code 53 if missing
   if (cleaned.length === 8) {
      return "53" + cleaned;
   }

   // If already has country code or is longer, return as is
   if (cleaned.length >= 10 && cleaned.length <= 15) {
      return cleaned;
   }

   return null;
}

// Normalize email address
function normalizeEmail(email?: string | null): string | null {
   if (!email) return null;
   const trimmed = email.trim().toLowerCase();

   // Basic email validation
   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
   if (!emailRegex.test(trimmed)) {
      return null;
   }

   return trimmed;
}

// Normalize identity document
function normalizeIdentityDocument(documento?: string | null): string | null {
   if (!documento) return null;
   const trimmed = documento.trim();

   // Skip if too short or empty
   if (trimmed.length < 8) return null;

   // Truncate to max 20 characters (database constraint)
   return trimmed.slice(0, 20);
}

interface ProcessedCustomer {
   first_name: string;
   middle_name: string | null;
   last_name: string;
   second_last_name: string | null;
   identity_document: string | null;
   email: string | null;
   mobile: string;
   address: string | null;
}

// Data validation and sanitization
function validateAndSanitizeCustomer(customer: ProcessedCustomer): ProcessedCustomer | null {
   // Check for required fields (first_name, last_name, mobile)
   if (!customer.first_name || !customer.last_name || !customer.mobile) {
      console.warn(`⚠️ Missing required fields, skipping customer`);
      return null;
   }

   // Validate mobile format
   const mobileDigits = customer.mobile.replace(/\D/g, "");
   if (mobileDigits.length < 10 || mobileDigits.length > 15) {
      console.warn(`⚠️ Invalid mobile format, skipping: ${customer.mobile}`);
      return null;
   }

   // Sanitize string fields with reasonable length limits
   const sanitizeString = (str: string | null, maxLength: number): string | null => {
      if (!str) return null;
      const trimmed = str.trim();
      if (trimmed.length === 0) return null;
      return trimmed.slice(0, maxLength);
   };

   const sanitizedFirstName = sanitizeString(customer.first_name, 50) || "Unknown";
   const sanitizedMiddleName = sanitizeString(customer.middle_name, 50);
   const sanitizedLastName = sanitizeString(customer.last_name, 50) || "Unknown";
   const sanitizedSecondLastName = sanitizeString(customer.second_last_name, 50);
   const sanitizedAddress = sanitizeString(customer.address, 500);

   return {
      first_name: toTitleCase(sanitizedFirstName),
      middle_name: sanitizedMiddleName ? toTitleCase(sanitizedMiddleName) : null,
      last_name: toTitleCase(sanitizedLastName),
      second_last_name: sanitizedSecondLastName ? toTitleCase(sanitizedSecondLastName) : null,
      identity_document: sanitizeString(customer.identity_document, 20),
      email: sanitizeString(customer.email, 100),
      mobile: customer.mobile,
      address: sanitizedAddress ? toTitleCase(sanitizedAddress) : null,
   };
}

// Process raw row data into customer format
function processCustomerRow(row: any): ProcessedCustomer | null {
   // Normalize mobile (prefer cel over tel)
   const mobile = normalizeMobile(row.cel, row.tel);
   if (!mobile) {
      console.warn(`⚠️ No valid mobile found for customer: ${row.nombre} ${row.apellido}`);
      return null;
   }

   // Build address from dir, reparto, and cp
   const addressParts = [row.dir, row.reparto ? `Reparto ${row.reparto}` : null, row.cp ? `CP ${row.cp}` : null].filter(
      Boolean
   );

   const address = addressParts.length > 0 ? addressParts.join(", ") : null;

   return {
      first_name: row.nombre?.trim() || "",
      middle_name: row.nombre2?.trim() || null,
      last_name: row.apellido?.trim() || "",
      second_last_name: row.apellido2?.trim() || null,
      identity_document: normalizeIdentityDocument(row.identification),
      email: normalizeEmail(row.email),
      mobile,
      address,
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

// Batch upsert customers using optimized approach
async function batchUpsertCustomers(customers: ProcessedCustomer[]): Promise<void> {
   const BATCH_SIZE = 100;
   const chunks = chunkArray(customers, BATCH_SIZE);

   console.log(`📦 Processing ${customers.length} customers in ${chunks.length} batches of ${BATCH_SIZE}`);

   for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🔄 Processing batch ${i + 1}/${chunks.length} (${chunk.length} customers)`);

      try {
         await prisma.$transaction(
            async (tx) => {
               // Create a unique key for each customer (mobile + first_name + last_name)
               const chunkKeys = chunk.map((c) => ({
                  mobile: c.mobile,
                  first_name: c.first_name,
                  last_name: c.last_name,
               }));

               // Find existing customers by unique constraint
               const existingCustomers = await tx.customer.findMany({
                  where: {
                     OR: chunkKeys,
                  },
                  select: { mobile: true, first_name: true, last_name: true },
               });

               // Create a Set of existing customer keys
               const existingKeys = new Set(existingCustomers.map((c) => `${c.mobile}|${c.first_name}|${c.last_name}`));

               // Separate new and existing customers
               const newCustomers = chunk.filter(
                  (c) => !existingKeys.has(`${c.mobile}|${c.first_name}|${c.last_name}`)
               );
               const existingCustomersToUpdate = chunk.filter((c) =>
                  existingKeys.has(`${c.mobile}|${c.first_name}|${c.last_name}`)
               );

               // Insert new customers using createMany
               if (newCustomers.length > 0) {
                  await tx.customer.createMany({
                     data: newCustomers,
                     skipDuplicates: true,
                  });
                  console.log(`   ✅ Created ${newCustomers.length} new customers`);
               }

               // Update existing customers individually
               if (existingCustomersToUpdate.length > 0) {
                  for (const customer of existingCustomersToUpdate) {
                     await tx.customer.updateMany({
                        where: {
                           mobile: customer.mobile,
                           first_name: customer.first_name,
                           last_name: customer.last_name,
                        },
                        data: {
                           middle_name: customer.middle_name,
                           second_last_name: customer.second_last_name,
                           identity_document: customer.identity_document,
                           email: customer.email,
                           address: customer.address,
                        },
                     });
                  }
                  console.log(`   ✅ Updated ${existingCustomersToUpdate.length} existing customers`);
               }
            },
            {
               timeout: 60000, // 60 seconds timeout
            }
         );

         console.log(`✅ Batch ${i + 1} completed successfully`);
      } catch (error: any) {
         console.error(`❌ Error in batch ${i + 1}:`, error.message);

         // Try to process records individually to identify problematic records
         console.log(`🔍 Processing batch ${i + 1} individually to identify problematic records...`);
         for (const customer of chunk) {
            try {
               await prisma.customer.upsert({
                  where: {
                     mobile_first_name_last_name: {
                        mobile: customer.mobile,
                        first_name: customer.first_name,
                        last_name: customer.last_name,
                     },
                  },
                  create: customer,
                  update: {
                     middle_name: customer.middle_name,
                     second_last_name: customer.second_last_name,
                     identity_document: customer.identity_document,
                     email: customer.email,
                     address: customer.address,
                  },
               });
            } catch (individualError: any) {
               console.error(
                  `❌ Failed to process customer ${customer.first_name} ${customer.last_name} (${customer.mobile}):`,
                  individualError.message
               );
            }
         }
      }
   }
}

async function main(): Promise<void> {
   console.log("🚀 Starting customer import process...");

   const oldDb = await mysql.createConnection({
      host: "auth-db1444.hstgr.io",
      user: "u373067935_caeenvio_mysgc",
      password: "CaribeAgencia*2022",
      database: "u373067935_cte",
   });

   try {
      // Load all customer data from MySQL
      console.log("📊 Loading all customer data from MySQL...");
      const [rows] = await oldDb.execute<any[]>(`
			SELECT 
				nombre,
				nombre2,
				apellido,
				apellido2,
				email,
				tel,
				cel,
				dir,
				reparto,
				cp,
				documento as identification
			FROM u373067935_cte.clientes
			WHERE nombre IS NOT NULL AND apellido IS NOT NULL
		`);

      console.log(`📦 Found ${rows.length} raw customer records`);

      // Process all data in memory
      console.log("🔄 Processing customer data...");
      const processedCustomers: ProcessedCustomer[] = [];
      let validationErrors = 0;
      let processingErrors = 0;

      for (const rawRow of rows) {
         const row = keysToCamelCase(rawRow);
         const processedCustomer = processCustomerRow(row);

         if (processedCustomer) {
            // Apply data validation and sanitization
            const sanitizedCustomer = validateAndSanitizeCustomer(processedCustomer);
            if (sanitizedCustomer) {
               processedCustomers.push(sanitizedCustomer);
            } else {
               validationErrors++;
            }
         } else {
            processingErrors++;
         }
      }

      console.log(`✅ Successfully processed ${processedCustomers.length} customers`);

      // Show processing statistics
      console.log("📊 Processing summary:");
      console.log(`   Total raw records: ${rows.length}`);
      console.log(`   Successfully processed: ${processedCustomers.length}`);
      if (validationErrors > 0) {
         console.warn(`   ⚠️ Validation errors: ${validationErrors}`);
      }
      if (processingErrors > 0) {
         console.warn(`   ⚠️ Processing errors: ${processingErrors}`);
      }

      // Batch upsert all customers
      if (processedCustomers.length > 0) {
         await batchUpsertCustomers(processedCustomers);
      }

      console.log("✅ Customer import completed successfully");
   } finally {
      await oldDb.end();
   }
}

main()
   .catch((e) => {
      console.error("❌ Error seeding customers:", e);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
