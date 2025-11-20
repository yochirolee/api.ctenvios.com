import { z } from "zod";
import { Request } from "express";
import { AgencyType, DiscountType, FeeType, PaymentMethod, Roles, Unit } from "@prisma/client";

// Role hierarchy types
export interface RoleResponse {
   success: boolean;
   data: Roles[];
   userRole: Roles;
   message: string;
}

export const paymentSchema = z.object({
   amount_in_cents: z.number().positive("Amount must be greater than 0"),
   charge_in_cents: z.number().min(0).optional(),
   method: z.nativeEnum(PaymentMethod, {
      required_error: "Payment method is required",
      invalid_type_error: "Invalid payment method",
   }),
   reference: z.string().optional(),
   notes: z.string().optional(),
});

export const agencySchema = z.object({
   name: z.string().min(5, "Name must be at least 5 characters long"),
   logo: z.string().optional(),
   address: z.string().min(1, "Address is required"),
   phone: z.string().min(10, "Phone must be at least 10 characters long"),
   email: z.string().email("Invalid email"),
   contact: z.string().min(1, "Contact is required"),
   forwarder_id: z.number().min(1, "Forwarder ID is required"),
   parent_agency_id: z.number().optional(),
   created_at: z.date().optional(),
   updated_at: z.date().optional(),
   services: z.array(z.number()).optional(),
   website: z.string().optional(),
   agency_type: z.nativeEnum(AgencyType).optional().default(AgencyType.AGENCY),
});

export const customsRatesSchema = z.object({
   country_id: z.number().min(1, "Country ID is required"),
   name: z.string().min(1, "Name is required"),
   description: z.string().optional(),
   chapter: z.string().optional(),
   fee_type: z.nativeEnum(FeeType).optional().default(FeeType.UNIT),
   fee_in_cents: z.number().min(0, "Fee must be greater than 0"),
   min_weight: z.number().optional().default(0),
   max_weight: z.number().optional().default(0),
   max_quantity: z.number().optional().default(0),
   weight: z.number().optional(),
   volume: z.number().optional(),
   quantity: z.number().optional(),
   unit_price: z.number().optional(),
});

////NEW ORDER SCHEMA
// Esquema para un solo item en la factura
export const ItemSchema = z.object({
   charge_fee_in_cents: z.number().optional().default(0),
   customs_fee_in_cents: z.number().optional().default(0),
   insurance_fee_in_cents: z.number().optional().default(0),
   delivery_fee_in_cents: z.number().optional().default(0),
   description: z
      .string({ required_error: "Item description is required." })
      .min(1, "Item description cannot be empty."),
   weight: z.number({ required_error: "Item weight is required." }).positive("Item weight must be a positive number."),
   rate_id: z.number().positive(),
   price_in_cents: z.number().positive(),
   unit: z.nativeEnum(Unit).optional().default(Unit.PER_LB),
});

// Esquema para el objeto Customer cuando se envía completo
export const createCustomerSchema = z.object({
   first_name: z.string({ required_error: "First name is required" }).min(1),
   middle_name: z.string().optional(),
   last_name: z.string({ required_error: "Last name is required" }).min(1),
   second_last_name: z.string().optional(),
   email: z.string().email("Invalid email format for customer.").optional().or(z.literal("")),
   mobile: z.string({ required_error: "Mobile is required" }).min(1),
   address: z.string().optional(),
   identity_document: z.string().optional(),
});

// Esquema para el objeto Receiver cuando se envía completo
export const createReceiverSchema = z
   .object({
      first_name: z.string({ required_error: "First name is required" }).min(1),
      middle_name: z.string().optional(),
      last_name: z.string({ required_error: "Last name is required" }).min(1),
      second_last_name: z.string().optional(),
      ci: z.string({ required_error: "CI is required" }).length(11, "Receiver CI must be 11 characters long."), // Carnet de Identidad
      passport: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      mobile: z.string().optional(),
      phone: z.string().optional(),
      address: z.string({ required_error: "Address is required" }).min(1),
      // Support both ID (from frontend) and name (from partners)
      province_id: z.number().int().positive().optional(),
      province: z.string().optional(),
      city_id: z.number().int().positive().optional(),
      city: z.string().optional(),
   })
   .refine(
      (data) => {
         // Either province_id or province name must be provided
         return !!data.province_id || !!data.province;
      },
      {
         message: "Either province_id or province name must be provided",
         path: ["province"],
      }
   )
   .refine(
      (data) => {
         // Either city_id or city name must be provided
         return !!data.city_id || !!data.city;
      },
      {
         message: "Either city_id or city name must be provided",
         path: ["city"],
      }
   );

// --- El Esquema Principal para la Creación de la Factura ---
export const createOrderSchema = z
   .object({
      customer_id: z.number().int().positive().optional(),
      customer: createCustomerSchema.optional(),
      receiver_id: z.number().int().positive().optional(),
      receiver: createReceiverSchema.optional(),
      service_id: z.number().int().positive(),
      order_items: z.array(ItemSchema).min(1, "At least one item is required in the invoice."),
      total_delivery_fee_in_cents: z.number().int().min(0).optional().default(0),
      requires_home_delivery: z.boolean().optional().default(true),
      partner_order_id: z.string().optional(),
   })
   // Ahora aplicamos las reglas de negocio complejas con .refine()
   .refine(
      (data) => {
         // Esta es la lógica XOR (exclusive OR): uno debe existir, pero no ambos.
         // La doble negación (!!) convierte los valores en booleanos (true si existe, false si no).
         return !!data.customer_id !== !!data.customer;
      },
      {
         // Mensaje de error si la condición de arriba falla
         message: 'Either "customer_id" or a "customer" object must be provided, but not both.',
         path: ["customer_id", "customer"], // Indica qué campos están relacionados con el error
      }
   )
   .refine(
      (data) => {
         // La misma lógica XOR para el receptor
         return !!data.receiver_id !== !!data.receiver;
      },
      {
         message: 'Either "receiver_id" or a "receiver" object must be provided, but not both.',
         path: ["receiver_id", "receiver"],
      }
   );

//searh schema
export const searchSchema = z.object({
   page: z.string().optional().default("1"),
   limit: z.string().optional().default("25"),
   search: z.string().optional().default(""),
   startDate: z.string().optional(),
   endDate: z.string().optional(),
});

//discount schema
export const discountSchema = z.object({
   type: z.nativeEnum(DiscountType),
   description: z.string().optional(),
   discount_in_cents: z.number().positive(),
});

//buildNameSearchFilter

export function parseDateFlexible(dateStr: string): Date | null {
   if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
   }
   if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split("/");
      const d = new Date(`${year}-${month}-${day}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
   }
   return null;
}

export function buildNameSearchFilter(words: string[]) {
   return {
      AND: words.map((w) => ({
         OR: [
            { first_name: { contains: w, mode: "insensitive" } },
            { middle_name: { contains: w, mode: "insensitive" } },
            { last_name: { contains: w, mode: "insensitive" } },
            { second_last_name: { contains: w, mode: "insensitive" } },
         ],
      })),
   };
}

// Pricing Service Types
export interface CreatePricingInput {
   product_id: number;
   service_id: number;
   seller_agency_id: number;
   buyer_agency_id: number;
   cost_in_cents: number; // Goes to PricingAgreement.price_in_cents
   price_in_cents: number; // Goes to ShippingRate.price_in_cents
   name?: string;
   min_weight?: number;
   max_weight?: number;
   is_active?: boolean;
}
