import { AgencyType, PrismaClient, Roles, CityType, ServiceType, ProductType, Unit } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { auth } from "../../src/lib/auth";
import { customsRates, provincesWithCities } from "./seed.data";

// Prisma 7 requires adapter for PrismaClient
const pool = new Pool({
   connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
   adapter,
});

async function main(): Promise<void> {
   const startTime = performance.now();
   console.log("🚀 Starting database seed...");

   let sectionStartTime = performance.now();
   // Create forwarder
   const forwarder = await prisma.forwarder.upsert({
      where: { id: 1 },
      update: {},
      create: {
         name: "Caribe Travel Express and Services Inc",
         code: "CTE",
         address: "10230 NW 80th Ave, Miami, FL 33016",
         contact: "F Infanzon",
         phone: "3058513004",
         email: "gerente@ctenvios.com",
      },
   });

   console.log(`✅ Forwarder created: ${forwarder.name}`);

   const cuba = await prisma.country.upsert({
      where: { id: 1 },
      update: {},
      create: {
         name: "Cuba",
         code: "CU",
      },
   });
   console.log(`✅ Country created: ${cuba.name}`);

   const provider = await prisma.provider.upsert({
      where: { id: 1 },
      update: {},
      create: {
         name: "Transcargo",
         address: "Avenida del Puerto y Linea del Ferrocarril, Regla, La Habana.",
         contact: "Transcargo",
         phone: "5376980069",
         email: "atcliente2@transcargo.transnet.cu",
      },
   });

   console.log(`✅ Provider created: ${provider.name}`);

   // Create services
   const maritimeService = await prisma.service.upsert({
      where: { id: 1 },
      update: {},
      create: {
         name: "Maritimo",
         service_type: ServiceType.MARITIME,
         description: "Envios Maritimos",
         forwarder: { connect: { id: forwarder.id } },
         provider: { connect: { id: provider.id } },
      },
   });

   console.log(`✅ Maritime service created: ${maritimeService.name}`);

   // Create Agencia Habana (padre)
   const CTEnvios = await prisma.agency.upsert({
      where: { id: 1 },
      create: {
         name: "CTEnvios",
         address: "10230 NW 80th Ave, Miami, FL 33016",
         contact: "F Infanzon",
         phone: "3058513004",
         email: "gerente@ctenvios.com",
         forwarder_id: forwarder.id,
         agency_type: AgencyType.FORWARDER,
         is_active: true,
         services: {
            connect: {
               id: maritimeService.id,
            },
         },
      },

      update: {
         name: "CTEnvios",
         address: "10230 NW 80th Ave, Miami, FL 33016",
         contact: "F Infanzon",
         phone: "3058513004",
         email: "gerente@ctenvios.com",
         forwarder_id: forwarder.id,
         agency_type: AgencyType.FORWARDER,
         is_active: true,
         services: {
            connect: {
               id: maritimeService.id,
            },
         },
      },
   });
   console.log(`✅ Agency created: ${CTEnvios.name}`);

   const product = await prisma.product.upsert({
      where: { id: 1 },
      update: {},
      create: {
         name: "Regular",
         description: "ByWeight",
         provider_id: provider.id,
         type: ProductType.SHIPPING,
         unit: Unit.PER_LB,
         length: 10,
         width: 10,
         height: 10,
         is_active: true,
         services: {
            connect: {
               id: maritimeService.id,
            },
         },
      },
   });
   console.log(`✅ Product created: ${product.name}`);

   //create or update provinces and cities

   console.log("🏝️ Creating or updating provinces and cities...");

   // Temporarily drop unique constraints to allow code updates
   console.log("   Dropping temporary constraints...");
   await prisma.$executeRawUnsafe(
      `ALTER TABLE "City" DROP CONSTRAINT IF EXISTS "City_province_id_code_key"`
   );
   await prisma.$executeRawUnsafe(
      `ALTER TABLE "Province" DROP CONSTRAINT IF EXISTS "Province_code_key"`
   );

   // Step 1: Delete all cities without receivers to avoid code conflicts
   console.log("   Cleaning up cities without receivers...");
   await prisma.city.deleteMany({
      where: { receivers: { none: {} } },
   });

   // Step 2: Update all provinces
   for (const province of provincesWithCities) {
      await prisma.province.upsert({
         where: { id: province.id },
         update: {
            code: province.code,
            name: province.name,
         },
         create: {
            id: province.id,
            code: province.code,
            name: province.name,
         },
      });
   }

   // Step 3: Update existing cities (those with receivers) by name
   // Also handle cities that exist but are NOT in seed data by giving them unique codes
   for (const province of provincesWithCities) {
      const existingCities = await prisma.city.findMany({
         where: { province_id: province.id },
      });
      const existingCityMap = new Map(existingCities.map((c) => [c.name, c]));
      const seedCityNames = new Set(province.cities.map((c) => c.name));
      const usedCodes = new Set(province.cities.map((c) => c.code));

      // First, handle cities NOT in seed data - assign unique codes
      // Start from high numbers (80-99) that aren't typically used in DPA codes
      let orphanCode = 80;
      for (const existingCity of existingCities) {
         if (!seedCityNames.has(existingCity.name)) {
            // Find an unused code for this orphan city (max 99)
            while (usedCodes.has(String(orphanCode).padStart(2, "0")) && orphanCode < 100) {
               orphanCode++;
            }
            if (orphanCode >= 100) {
               console.warn(`   Warning: Too many orphan cities in province ${province.id}, skipping ${existingCity.name}`);
               continue;
            }
            const newCode = String(orphanCode).padStart(2, "0");
            usedCodes.add(newCode);
            await prisma.city.update({
               where: { id: existingCity.id },
               data: { code: newCode },
            });
            orphanCode++;
         }
      }

      // Then update cities that ARE in seed data
      for (const city of province.cities) {
         const existingCity = existingCityMap.get(city.name);
         if (existingCity) {
            await prisma.city.update({
               where: { id: existingCity.id },
               data: {
                  code: city.code,
                  name: city.name,
                  city_type: city.city_type,
               },
            });
         }
      }
   }

   // Step 4: Create new cities that don't exist
   for (const province of provincesWithCities) {
      const existingCities = await prisma.city.findMany({
         where: { province_id: province.id },
      });
      const existingCityNames = new Set(existingCities.map((c) => c.name));

      for (const city of province.cities) {
         if (!existingCityNames.has(city.name)) {
            await prisma.city.create({
               data: {
                  code: city.code,
                  name: city.name,
                  city_type: city.city_type,
                  province_id: province.id,
               },
            });
         }
      }
   }

   // Recreate the unique constraints only if they don't exist (idempotent).
   // PostgreSQL implements UNIQUE as an index; check pg_class (relation) since error is "relation already exists".
   console.log("   Recreating unique constraints...");
   await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'Province_code_key' AND n.nspname = 'public') THEN
            ALTER TABLE "Province" ADD CONSTRAINT "Province_code_key" UNIQUE (code);
         END IF;
      END $$`
   );
   await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'City_province_id_code_key' AND n.nspname = 'public') THEN
            ALTER TABLE "City" ADD CONSTRAINT "City_province_id_code_key" UNIQUE (province_id, code);
         END IF;
      END $$`
   );

   console.log(`✅ Provinces and cities created`);

   // Step 1: Fetch all existing customs rates by name in bulk
   const rateNames = customsRates.map((rate) => rate.name);
   const allExistingRates = await prisma.customsRates.findMany({
      where: {
         name: { in: rateNames },
      },
      select: {
         id: true,
         name: true,
         description: true,
         chapter: true,
         country_id: true,
         fee_type: true,
         fee_in_cents: true,
         custom_value: true,
      },
   });

   // Create a map for fast lookup by name
   const existingRateMap = new Map<string, (typeof allExistingRates)[0]>();
   for (const rate of allExistingRates) {
      existingRateMap.set(rate.name, rate);
   }

   // Step 2: Separate rates into create and update batches
   const ratesToCreate: Array<(typeof customsRates)[0]> = [];
   const ratesToUpdate: Array<{ id: number; data: Omit<(typeof customsRates)[0], "name"> }> = [];

   for (const rate of customsRates) {
      const existing = existingRateMap.get(rate.name);

      if (existing) {
         // Check if any field has changed (compare all fields)
         const hasChanged =
            existing.description !== rate.description ||
            existing.chapter !== rate.chapter ||
            existing.country_id !== rate.country_id ||
            existing.fee_type !== rate.fee_type ||
            existing.fee_in_cents !== rate.fee_in_cents ||
            existing.custom_value !== rate.custom_value;

         if (hasChanged) {
            ratesToUpdate.push({
               id: existing.id,
               data: {
                  description: rate.description,
                  chapter: rate.chapter,
                  country_id: rate.country_id,
                  fee_type: rate.fee_type,
                  fee_in_cents: rate.fee_in_cents,
                  custom_value: rate.custom_value,
               },
            });
         }
      } else {
         ratesToCreate.push(rate);
      }
   }

   // Step 3: Execute bulk operations in a transaction
   await prisma.$transaction(async (tx) => {
      // Batch create new rates (in chunks of 1000)
      if (ratesToCreate.length > 0) {
         const batchSize = 1000;
         for (let i = 0; i < ratesToCreate.length; i += batchSize) {
            const batch = ratesToCreate.slice(i, i + batchSize);
            await tx.customsRates.createMany({
               data: batch,
               skipDuplicates: true,
            });
         }
      }

      // Batch update existing rates
      // Note: Prisma doesn't support bulk update with different values per row
      // So we use Promise.all for parallel updates, which is still much faster
      // than sequential updates since we've already done the lookups
      if (ratesToUpdate.length > 0) {
         const updatePromises = ratesToUpdate.map((rate) =>
            tx.customsRates.update({
               where: { id: rate.id },
               data: rate.data,
            })
         );
         await Promise.all(updatePromises);
      }
   });

   console.log(`✅ Customs rates created: ${customsRates.length} total`);
   const customsRatesTime = ((performance.now() - sectionStartTime) / 1000).toFixed(2);
   console.log(`⏱️  Customs rates completed in ${customsRatesTime}s`);

   sectionStartTime = performance.now();
   // Create carrier for delivery services
   console.log("🚚 Creating carrier...");
   const carrier = await prisma.carrier.upsert({
      where: { id: 1 },
      update: {},
      create: {
         name: "HM Paquetes",
         forwarder_id: forwarder.id,
      },
   });
   console.log(`✅ Carrier created: ${carrier.name}`);

   // Update maritime service with carrier
   await prisma.service.update({
      where: { id: maritimeService.id },
      data: {
         carrier_id: carrier.id,
      },
   });
   console.log(`✅ Maritime service updated with carrier`);

   const user = await prisma.user.findFirst({
      where: {
         email: "yleecruz@gmail.com",
      },
   });

   if (!user) {
      const response = await auth.api.signUpEmail({
         body: {
            email: "yleecruz@gmail.com",
            password: "Audioslave*84",
            name: "Yochiro Lee Cruz",
         },
      });
      const loggedInUser = await auth.api.signInEmail({
         body: {
            email: "yleecruz@gmail.com",
            password: "Audioslave*84",
         },
      });
      const user = await prisma.user.update({
         where: { id: loggedInUser.user.id },
         data: {
            role: Roles.ROOT,
            agency_id: CTEnvios.id,
            forwarder_id: forwarder.id,
         },
      });
      console.log(user);
   } else {
      const updatedUser = await prisma.user.update({
         where: { id: user.id },
         data: {
            role: Roles.ROOT,
            agency_id: CTEnvios.id,
            forwarder_id: forwarder.id,
         },
      });
      console.log(updatedUser);
   }

   const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
   const totalTimeMs = performance.now() - startTime;

   console.log("\n" + "=".repeat(60));
   console.log("🎉 Database seed completed successfully!");
   console.log("=".repeat(60));
   console.log(`⏱️  Total execution time: ${totalTime}s (${Math.round(totalTimeMs)}ms)`);
   console.log("=".repeat(60) + "\n");
}

main()
   .catch((e) => {
      console.error("❌ Error seeding database:", e);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
