import { Customer, Receiver, Province, City, Prisma, } from "@prisma/client";
import prisma from "../config/prisma_db";
import AppError from "../utils/app.error";
import repository from "../repositories";
import { generateHBLFast } from "../utils/generate-hbl";

interface ReceiverWithLocationNames extends Omit<Receiver, "province_id" | "city_id"> {
   province?: string;
   city?: string;
   province_id?: number;
   city_id?: number;
}

export const resolvers = {
   /**
    * Resolves province name to province ID
    * @param provinceName - The name of the province
    * @returns Province ID
    */
   resolveProvinceId: async (provinceName: string): Promise<number> => {
      const province = await prisma.province.findFirst({
         where: {
            name: {
               equals: provinceName,
               mode: "insensitive",
            },
         },
      });

      if (!province) {
         throw new AppError(`Province '${provinceName}' not found`, 404);
      }

      return province.id;
   },

   /**
    * Resolves city name to city ID within a province
    * @param cityName - The name of the city
    * @param provinceId - The province ID to search within
    * @returns City ID
    */
   resolveCityId: async (cityName: string, provinceId: number): Promise<number> => {
      const city = await prisma.city.findFirst({
         where: {
            name: {
               equals: cityName,
               mode: "insensitive",
            },
            province_id: provinceId,
         },
      });

      if (!city) {
         throw new AppError(`City '${cityName}' not found in the specified province`, 404);
      }

      return city.id;
   },
   resolveReceiver: async ({
      receiver_id,
      receiver,
   }: {
      receiver_id?: number;
      receiver?: ReceiverWithLocationNames;
   }): Promise<Receiver & { province: Province; city: City }> => {
      // Scenario 1: Frontend provides receiver_id
      if (receiver_id) {
         const existingReceiver = await repository.receivers.getById(receiver_id);
         if (!existingReceiver) {
            throw new AppError(`Receiver with ID ${receiver_id} not found`, 404);
         }
         return existingReceiver;
      }

      // Scenario 2: Partners provide receiver data
      if (receiver?.ci) {
         // Check if receiver exists by CI
         const existingReceiver = await repository.receivers.getByCi(receiver.ci);
         if (existingReceiver) {
            return existingReceiver;
         }

         // 🚀 OPTIMIZATION: Parallelize province and city resolution
         let province_id = receiver.province_id;
         let city_id = receiver.city_id;

         // If both province and city are provided as names, resolve them in parallel
         if (
            receiver.province &&
            typeof receiver.province === "string" &&
            receiver.city &&
            typeof receiver.city === "string"
         ) {
            const resolvedProvinceId = await resolvers.resolveProvinceId(receiver.province);
            city_id = await resolvers.resolveCityId(receiver.city, resolvedProvinceId);
            province_id = resolvedProvinceId;
         } else {
            // If only province is provided as string name, resolve to ID
            if (receiver.province && typeof receiver.province === "string") {
               province_id = await resolvers.resolveProvinceId(receiver.province);
            }

            // If only city is provided as string name, resolve to ID
            if (receiver.city && typeof receiver.city === "string" && province_id) {
               city_id = await resolvers.resolveCityId(receiver.city, province_id);
            }
         }

         // Validate required location fields
         if (!province_id || !city_id) {
            throw new AppError("Province and city are required for creating a new receiver", 400);
         }

         // Create new receiver with resolved IDs
         const receiverData: Prisma.ReceiverUncheckedCreateInput = {
            first_name: receiver.first_name,
            middle_name: receiver.middle_name || null,
            last_name: receiver.last_name,
            second_last_name: receiver.second_last_name || null,
            ci: receiver.ci,
            passport: receiver.passport || null,
            email: receiver.email || null,
            mobile: receiver.mobile || null,
            phone: receiver.phone || null,
            address: receiver.address,
            province_id: province_id,
            city_id: city_id,
         };

         const newReceiver = await repository.receivers.create(receiverData);
         return newReceiver as Receiver & { province: Province; city: City };
      }

      throw new AppError("Either receiver_id or receiver data with CI is required", 400);
   },

   resolveCustomer: async ({
      customer_id,
      customer,
   }: {
      customer_id?: number;
      customer?: Partial<Customer>;
   }): Promise<Customer> => {
      // Scenario 1: Frontend provides customer_id
      if (customer_id) {
         const existingCustomer = await repository.customers.getById(customer_id as number);
         if (!existingCustomer) {
            throw new AppError(`Customer with ID ${customer_id} not found`, 404);
         }
         return existingCustomer as Customer;
      }

      // Scenario 2: Partners provide customer data
      if (!customer) {
         throw new AppError("Customer information is required", 400);
      }

      // Check if customer exists by mobile and name
      if (customer.mobile && customer.first_name && customer.last_name) {
         const existingCustomer = await repository.customers.getByMobileAndName(
            customer.mobile,
            customer.first_name,
            customer.last_name
         );
         if (existingCustomer) {
            return existingCustomer as Customer;
         }

         // Create new customer if not found
         const customerData: Prisma.CustomerCreateInput = {
            first_name: customer.first_name,
            middle_name: customer.middle_name || null,
            last_name: customer.last_name,
            second_last_name: customer.second_last_name || null,
            mobile: customer.mobile,
            email: customer.email || null,
            address: customer.address || null,
            identity_document: customer.identity_document || null,
         };

         const newCustomer = await repository.customers.create(customerData);
         return newCustomer as Customer;
      }

      throw new AppError("Customer mobile, first_name, and last_name are required", 400);
   },
   resolveItemsWithHbl: async ({
      items,
      service_id,
      agency_id,
   }: {
      items: any[];
      service_id: number;
      agency_id: number;
   }): Promise<any[]> => {
      // 🚀 OPTIMIZATION: Extract unique rate IDs efficiently (single pass, no intermediate arrays)

      // 🚀 OPTIMIZATION: Parallelize HBL generation and rate fetching
      const allHblCodes = await generateHBLFast(agency_id, service_id, items.length);

      // Pre-allocate and populate items array
      const items_hbl: any[] = new Array(items.length);
      for (let i = 0; i < items.length; i++) {
         const item = items[i];

         items_hbl[i] = {
            hbl: allHblCodes[i],
            description: item.description,
            price_in_cents: item.price_in_cents,
            charge_fee_in_cents: item.charge_fee_in_cents || 0,
            delivery_fee_in_cents: item.delivery_fee_in_cents || 0,
            rate_id: item.rate_id,
            insurance_fee_in_cents: item.insurance_fee_in_cents || 0,
            customs_fee_in_cents: item.customs_fee_in_cents || 0,
            quantity: 1,
            weight: item.weight,
            service_id,
            agency_id,
            unit: item.unit,
         };
      }
      return items_hbl;
   },
};
