import { Customer, Receiver, Province, City, Prisma, Unit } from "@prisma/client";
import prisma from "../lib/prisma.client";
import { AppError } from "../common/app-errors";
import repository from "../repositories";
import { generateHBLFast } from "../utils/pdf/generate-hbl";
import { pricingService } from "./pricing.service";
import HttpStatusCodes from "../common/https-status-codes";
import { createReceiverSchema } from "../types/types";

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
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Province '${provinceName}' not found`);
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
         throw new AppError(HttpStatusCodes.NOT_FOUND, `City '${cityName}' not found in the specified province`);
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
         if (existingReceiver) return existingReceiver;
      }

      // Scenario 2: Partners provide receiver data
      if (receiver?.ci) {
         // Check if receiver exists by CI
         const existingReceiver = await repository.receivers.getByCi(receiver.ci);
         if (existingReceiver) return existingReceiver;
      }

      // If both province and city are provided as names, resolve them in parallel

      if (
         receiver?.province &&
         typeof receiver?.province === "string" &&
         receiver?.city &&
         typeof receiver?.city === "string"
      ) {
         const resolvedProvinceId = await resolvers.resolveProvinceId(receiver?.province);
         receiver.province_id = resolvedProvinceId;
         receiver.city_id = await resolvers.resolveCityId(receiver?.city, resolvedProvinceId);
      }

      // Validate required location fields
      if (!receiver?.province_id || !receiver?.city_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Province and city are required for creating a new receiver");
      }
      const parseResult = createReceiverSchema.safeParse({
         first_name: receiver.first_name,
         last_name: receiver.last_name,
         ci: receiver.ci,
         address: receiver.address,
         province_id: receiver.province_id,
         city_id: receiver.city_id,
         middle_name: receiver.middle_name ?? null,
         second_last_name: receiver.second_last_name ?? null,
         passport: receiver.passport ?? null,
         email: receiver.email ?? null,
         mobile: receiver.mobile ?? null,
         phone: receiver.phone ?? null,
      });

      if (!parseResult.success) {
         const errors = parseResult.error.flatten().fieldErrors;
         throw new AppError(HttpStatusCodes.BAD_REQUEST, JSON.stringify({ message: "Validation failed", errors }));
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
         province_id: receiver.province_id,
         city_id: receiver.city_id,
      };

      const newReceiver = await repository.receivers.create(receiverData);

      return newReceiver as Receiver & { province: Province; city: City };
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
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Customer with ID ${customer_id} not found`);
         }
         return existingCustomer as Customer;
      }

      // Scenario 2: Partners provide customer data
      if (!customer) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Customer information is required");
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

      throw new AppError(HttpStatusCodes.BAD_REQUEST, "Customer mobile, first_name, and last_name are required");
   },
   resolveItemsWithHbl: async ({
      order_items,
      service_id,
      agency_id,
   }: {
      order_items: any[];
      service_id: number;
      agency_id: number;
   }): Promise<any[]> => {
      // 🚀 OPTIMIZATION: Extract unique rate IDs efficiently (single pass, no intermediate arrays)

      // 🚀 OPTIMIZATION: Parallelize HBL generation and rate fetching
      const allHblCodes = await generateHBLFast(agency_id, service_id, order_items.length);

      const rates = await pricingService.getRatesByServiceIdAndAgencyId(service_id, agency_id);

      // Pre-allocate and populate items array
      const items_hbl: any[] = new Array(order_items.length);
      for (let i = 0; i < order_items.length; i++) {
         const item = order_items[i];
         const rate = rates.find((rate) => rate.id === item.rate_id);
         if (!rate) {
            throw new AppError(
               HttpStatusCodes.NOT_FOUND,
               `Rate with ID ${item.rate_id} not found or not exists for your agency ${agency_id}`
            );
         }
         items_hbl[i] = {
            hbl: allHblCodes[i],
            external_reference: item.external_reference || null,
            description: item.description,
            price_in_cents: item.price_in_cents || rate?.price_in_cents || 0,
            charge_fee_in_cents: item.charge_fee_in_cents || 0,
            delivery_fee_in_cents: item.delivery_fee_in_cents || 0,
            rate_id: item.rate_id,
            insurance_fee_in_cents: item.insurance_fee_in_cents || 0,
            customs_fee_in_cents: item.customs_fee_in_cents || 0,
            customs_rates_id: item.customs_rates_id || null,
            quantity: 1,
            weight: item.weight,
            service_id,
            agency_id,
            unit: rate?.unit || item.unit || Unit.PER_LB,
         };
      }
      return items_hbl;
   },
};
