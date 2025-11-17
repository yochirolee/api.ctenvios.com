import { AgencyType, PrismaClient, Roles, CityType, ServiceType } from "@prisma/client";
import { auth } from "../src/lib/auth";
import { customsRates, provincesWithCities } from "./seed.data";

const prisma = new PrismaClient();

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
   const basicEntitiesTime = ((performance.now() - sectionStartTime) / 1000).toFixed(2);
   console.log(`⏱️  Basic entities (forwarder, country, provider) completed in ${basicEntitiesTime}s`);

   sectionStartTime = performance.now();
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

   // console.log(`✅ Maritime service created: ${maritimeService.name}`);

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
      },

      update: {},
   });
   console.log(`✅ Agency created: ${CTEnvios.name}`);

   console.log(`✅ Services connected to CTEnvios`);
   const servicesTime = ((performance.now() - sectionStartTime) / 1000).toFixed(2);
   console.log(`⏱️  Services and agency completed in ${servicesTime}s`);

   sectionStartTime = performance.now();
   console.log("🏝️ Creating provinces and cities...");

   // Step 1: Upsert all provinces first
   const provincePromises = provincesWithCities.map((provincia) =>
      prisma.province.upsert({
         where: { id: provincia.id },
         update: {
            name: provincia.name,
         },
         create: {
            name: provincia.name,
         },
      })
   );
   const createdProvinces = await Promise.all(provincePromises);
   const provinceMap = new Map(createdProvinces.map((p) => [p.id, p]));

   // Step 2: Fetch all existing cities in bulk to check what exists
   const allProvinceIds = createdProvinces.map((p) => p.id);
   const allExistingCities = await prisma.city.findMany({
      where: {
         province_id: { in: allProvinceIds },
      },
      select: {
         id: true,
         name: true,
         province_id: true,
         city_type: true,
      },
   });

   // Create a map for fast lookup: key = "province_id:city_name"
   const existingCityMap = new Map<string, (typeof allExistingCities)[0]>();
   for (const city of allExistingCities) {
      const key = `${city.province_id}:${city.name}`;
      existingCityMap.set(key, city);
   }

   // Step 3: Prepare cities for bulk operations
   const citiesToCreate: Array<{ name: string; province_id: number; city_type: CityType }> = [];
   const citiesToUpdate: Array<{ id: number; city_type: CityType }> = [];

   for (const provincia of provincesWithCities) {
      const province = provinceMap.get(provincia.id);
      if (!province) continue;

      for (const city of provincia.cities) {
         const key = `${province.id}:${city.name}`;
         const existingCity = existingCityMap.get(key);

         if (existingCity) {
            // Only update if city_type has changed
            if (existingCity.city_type !== city.city_type) {
               citiesToUpdate.push({
                  id: existingCity.id,
                  city_type: city.city_type,
               });
            }
         } else {
            // City doesn't exist, add to create batch
            citiesToCreate.push({
               name: city.name,
               province_id: province.id,
               city_type: city.city_type,
            });
         }
      }
   }

   // Step 4: Execute bulk operations
   // Use transaction for better performance and consistency
   await prisma.$transaction(async (tx) => {
      // Batch create new cities (Prisma createMany has limits, so batch in chunks of 1000)
      if (citiesToCreate.length > 0) {
         const batchSize = 1000;
         for (let i = 0; i < citiesToCreate.length; i += batchSize) {
            const batch = citiesToCreate.slice(i, i + batchSize);
            await tx.city.createMany({
               data: batch,
               skipDuplicates: true,
            });
         }
      }

      // Batch update existing cities
      if (citiesToUpdate.length > 0) {
         // Prisma doesn't support bulk update with different values per row
         // So we group by city_type and use updateMany where possible
         const updatesByType = new Map<CityType, number[]>();
         for (const city of citiesToUpdate) {
            const ids = updatesByType.get(city.city_type) || [];
            ids.push(city.id);
            updatesByType.set(city.city_type, ids);
         }

         // Execute grouped updates
         const updatePromises = Array.from(updatesByType.entries()).map(([cityType, ids]) =>
            tx.city.updateMany({
               where: { id: { in: ids } },
               data: { city_type: cityType },
            })
         );
         await Promise.all(updatePromises);
      }
   });

   // Log summary
   for (const provincia of provincesWithCities) {
      console.log(`✅ Province created: ${provincia.name} (${provincia.cities.length} cities)`);
   }
   const provincesTime = ((performance.now() - sectionStartTime) / 1000).toFixed(2);
   console.log(`⏱️  Provinces and cities completed in ${provincesTime}s`);

   sectionStartTime = performance.now();
   console.log("🏳️ Creating customs rates...");

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
         name: "Transcargo Carrier",
         forwarder_id: forwarder.id,
      },
   });
   console.log(`✅ Carrier created: ${carrier.name}`);

   // Update maritime service with carrier
   /*  await prisma.service.update({
      where: { id: maritimeService.id },
      data: {
         carrier_id: carrier.id,
      },
   });
   console.log(`✅ Maritime service updated with carrier`);
   const carrierTime = ((performance.now() - sectionStartTime) / 1000).toFixed(2);
   console.log(`⏱️  Carrier setup completed in ${carrierTime}s`);

   sectionStartTime = performance.now(); */

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
      console.log(response);
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
