import { AgencyType, PrismaClient, Roles, CityType } from "@prisma/client";
import { auth } from "../src/lib/auth.lib";
import { customsRates, provincesWithCities } from "./seed.data";

const prisma = new PrismaClient();

async function main(): Promise<void> {
   console.log("🚀 Starting database seed...");

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

   // Create services
   const maritimeService = await prisma.service.upsert({
      where: { id: 1 },
      update: {},
      create: {
         name: "Maritimo",
         service_type: "MARITIME",
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
         services: { connect: { id: maritimeService.id } },
      },

      update: {},
   });
   console.log(`✅ Agency created: ${CTEnvios.name}`);

   console.log(`✅ Services connected to CTEnvios`);

   console.log("🏝️ Creating provinces and cities...");
   for (const provincia of provincesWithCities) {
      // First, upsert the province
      const createdProvince = await prisma.province.upsert({
         where: { id: provincia.id },
         update: {
            name: provincia.name,
         },
         create: {
            name: provincia.name,
         },
      });

      // Then, create or update cities for this province
      for (const city of provincia.cities) {
         const existingCity = await prisma.city.findFirst({
            where: {
               name: city.name,
               province_id: createdProvince.id,
            },
         });

         if (existingCity) {
            // Update existing city with city_type
            await prisma.city.update({
               where: { id: existingCity.id },
               data: {
                  city_type: city.city_type,
               },
            });
         } else {
            // Create new city with city_type
            await prisma.city.create({
               data: {
                  name: city.name,
                  province_id: createdProvince.id,
                  city_type: city.city_type,
               },
            });
         }
      }

      console.log(`✅ Province created: ${createdProvince.name} (${provincia.cities.length} cities)`);
   }

   console.log("🏳️ Creating customs rates...");
   const customsRatesPromises = customsRates.map(async (rate, index) => {
      // Log progress every 100 items
      if (index % 100 === 0 && index > 0) {
         console.log(`   Progress: ${index}/${customsRates.length} customs rates processed`);
      }

      const existing = await prisma.customsRates.findFirst({
         where: { name: rate.name },
      });

      if (existing) {
         return prisma.customsRates.update({
            where: { id: existing.id },
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

      return prisma.customsRates.create({ data: rate });
   });

   await Promise.all(customsRatesPromises);
   console.log(`✅ Customs rates created: ${customsRates.length} total`);

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
   await prisma.service.update({
      where: { id: maritimeService.id },
      data: {
         carrier_id: carrier.id,
      },
   });
   console.log(`✅ Maritime service updated with carrier`);

   // Create base delivery rates for carrier
   console.log("📦 Creating delivery rates...");
   const deliveryRates = [
      {
         name: "Delivery - Special Zone",
         description: "Havana, Artemisa, Mayabeque",
         forwarder_id: forwarder.id,
         carrier_id: carrier.id,
         city_type: CityType.SPECIAL,
         cost_in_cents: 500, // $5 USD
         rate_in_cents: 500, // $5 USD
         is_base_rate: true,
      },
      {
         name: "Delivery - Provincial Capital",
         description: "Provincial capitals",
         forwarder_id: forwarder.id,
         carrier_id: carrier.id,
         city_type: CityType.CAPITAL,
         cost_in_cents: 1000, // $10 USD
         rate_in_cents: 1000, // $10 USD
         is_base_rate: true,
      },
      {
         name: "Delivery - Other Cities",
         description: "All other cities",
         forwarder_id: forwarder.id,
         carrier_id: carrier.id,
         city_type: CityType.CITY,
         cost_in_cents: 1500, // $15 USD
         rate_in_cents: 1500, // $15 USD
         is_base_rate: true,
      },
   ];

   for (const rate of deliveryRates) {
      // Check if delivery rate exists
      const existingRate = await prisma.deliveryRate.findFirst({
         where: {
            forwarder_id: rate.forwarder_id,
            carrier_id: rate.carrier_id,
            city_type: rate.city_type,
            is_base_rate: true,
            agency_id: null,
         },
      });

      if (existingRate) {
         await prisma.deliveryRate.update({
            where: { id: existingRate.id },
            data: {
               cost_in_cents: rate.cost_in_cents,
               rate_in_cents: rate.rate_in_cents,
            },
         });
      } else {
         await prisma.deliveryRate.create({
            data: rate,
         });
      }
   }
   console.log(`✅ Delivery rates created: ${deliveryRates.length} total`);

   const session = await auth.api.signUpEmail({
      body: {
         email: "yleecruz@gmail.com",
         password: "Audioslave*84",
         name: "Yochiro Lee Cruz",
      },
   });
   console.log(session);

   console.log(`✅ User created:  with ROOT role`);
   console.log("🎉 Database seed completed successfully!");
}

main()
   .catch((e) => {
      console.error("❌ Error seeding database:", e);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
