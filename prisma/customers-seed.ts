import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

interface CustomerSeedData {
   first_name: string;
   second_name: string;
   last_name: string;
   second_last_name: string;
   identity_document: string;
   email: string;
   mobile: string;
   address: string;
}

const generateUniqueIdentityDocument = (): string => {
   // Generate a random 8-11 digit identity document
   return faker.string.numeric({ length: { min: 8, max: 11 } });
};

const generateCustomer = (): CustomerSeedData => {
   const firstName = faker.person.firstName();
   const secondName = faker.person.firstName();
   const lastName = faker.person.lastName();
   const secondLastName = faker.person.lastName();

   return {
      first_name: firstName,
      second_name: secondName,
      last_name: lastName,
      second_last_name: secondLastName,
      identity_document: generateUniqueIdentityDocument(),
      email: faker.internet.email({
         firstName: firstName.toLowerCase(),
         lastName: lastName.toLowerCase(),
      }),
      mobile: faker.phone.number(),
      address: faker.location.streetAddress({ useFullAddress: true }),
   };
};

const seedCustomers = async (count: number): Promise<void> => {
   console.log(`🌱 Seeding ${count} customers...`);

   const customers: CustomerSeedData[] = [];
   const usedEmails = new Set<string>();
   const usedIdentityDocs = new Set<string>();
   const usedPhones = new Set<string>();

   // Generate unique customers
   while (customers.length < count) {
      const customer = generateCustomer();

      // Ensure uniqueness
      if (
         !usedEmails.has(customer.email) &&
         !usedIdentityDocs.has(customer.identity_document) &&
         !usedPhones.has(customer.mobile)
      ) {
         customers.push(customer);
         usedEmails.add(customer.email);
         usedIdentityDocs.add(customer.identity_document);
         usedPhones.add(customer.mobile);
      }
   }

   // Insert customers in batches for better performance
   const batchSize = 100;
   let inserted = 0;

   for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);

      try {
         await prisma.customer.createMany({
            data: batch,
            skipDuplicates: true,
         });

         inserted += batch.length;
         console.log(`✅ Inserted batch ${Math.ceil((i + 1) / batchSize)} - Total: ${inserted}/${count}`);
      } catch (error) {
         console.error(`❌ Error inserting batch ${Math.ceil((i + 1) / batchSize)}:`, error);
      }
   }

   console.log(`🎉 Successfully seeded ${inserted} customers`);
};

async function main() {
   /* 	const cuba = await prisma.country.upsert({
		where: { code: "CU" },
		update: {},
		create: { name: "Cuba", code: "CU" },
	}); */

   /* for (const chapterData of chapters) {
		for (const category of chapterData.categories) {
			const itemCategory = await prisma.itemCategory.upsert({
				where: { name: category.name },
				update: {},
				create: { name: category.name },
			});

			await prisma.customsTariff.upsert({
				where: {
					country_id: {
						country_id: cuba.id,
						category_id: itemCategory.id,
					},
				},
				update: {},
				create: {
					country_id: cuba.id,
					chapter: chapterData.chapter,
					fee_type: category.fee_type as FeeType,
					fixed_fee: category.fee,
					max_quantity: category.max_quantity ?? null,
				},
			});
		}
	} */

   console.log("Seed completo con capítulos 1 a 11 cargado.");

   try {
      // Clean existing customers (optional)
      console.log("🧹 Cleaning existing customers...");
      await seedCustomers(1000);
   } catch (error) {
      console.error("❌ Error during seeding:", error);
      process.exit(1);
   } finally {
      await prisma.$disconnect();
   }
}

main();
