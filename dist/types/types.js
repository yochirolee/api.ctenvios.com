"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discountSchema = exports.searchSchema = exports.createOrderSchema = exports.createReceiverSchema = exports.createCustomerSchema = exports.ItemSchema = exports.customsRatesSchema = exports.agencySchema = exports.paymentSchema = void 0;
exports.parseDateFlexible = parseDateFlexible;
exports.buildNameSearchFilter = buildNameSearchFilter;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const utils_1 = require("../utils/utils");
exports.paymentSchema = zod_1.z.object({
    amount_in_cents: zod_1.z.number().positive("Amount must be greater than 0"),
    charge_in_cents: zod_1.z.number().min(0).optional(),
    method: zod_1.z.nativeEnum(client_1.PaymentMethod, {
        required_error: "Payment method is required",
        invalid_type_error: "Invalid payment method",
    }),
    reference: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.agencySchema = zod_1.z.object({
    name: zod_1.z.string().min(5, "Name must be at least 5 characters long"),
    logo: zod_1.z.string().optional(),
    address: zod_1.z.string().min(1, "Address is required"),
    phone: zod_1.z.string().min(10, "Phone must be at least 10 characters long"),
    email: zod_1.z.string().email("Invalid email"),
    contact: zod_1.z.string().min(1, "Contact is required"),
    forwarder_id: zod_1.z.number().min(1, "Forwarder ID is required"),
    parent_agency_id: zod_1.z.number().nullable().optional(),
    created_at: zod_1.z.date().optional(),
    updated_at: zod_1.z.date().optional(),
    services: zod_1.z.array(zod_1.z.number()).optional(),
    website: zod_1.z.string().optional(),
    agency_type: zod_1.z.nativeEnum(client_1.AgencyType).optional().default(client_1.AgencyType.AGENCY),
});
exports.customsRatesSchema = zod_1.z.object({
    country_id: zod_1.z.number().min(1, "Country ID is required"),
    name: zod_1.z.string().min(1, "Name is required"),
    description: zod_1.z.string().optional(),
    chapter: zod_1.z.string().optional(),
    fee_type: zod_1.z.nativeEnum(client_1.FeeType).optional().default(client_1.FeeType.UNIT),
    fee_in_cents: zod_1.z.number().min(0, "Fee must be greater than 0"),
    insurance_fee_in_cents: zod_1.z.number().optional().default(0),
    max_weight: zod_1.z.number().optional().default(0),
    max_quantity: zod_1.z.number().optional().default(0),
    weight: zod_1.z.number().optional(),
    volume: zod_1.z.number().optional(),
    quantity: zod_1.z.number().optional(),
    unit_price: zod_1.z.number().optional(),
});
////NEW ORDER SCHEMA
// Esquema para un solo item en la factura
exports.ItemSchema = zod_1.z.object({
    charge_fee_in_cents: zod_1.z.number().optional().default(0),
    customs_fee_in_cents: zod_1.z.number().optional().default(0),
    insurance_fee_in_cents: zod_1.z.number().optional().default(0),
    delivery_fee_in_cents: zod_1.z.number().optional().default(0),
    description: zod_1.z
        .string({ required_error: "Item description is required." })
        .min(1, "Item description cannot be empty."),
    weight: zod_1.z.number({ required_error: "Item weight is required." }).positive("Item weight must be a positive number."),
    rate_id: zod_1.z.number().positive(),
    customs_rates_id: zod_1.z.number().optional().nullable(),
    price_in_cents: zod_1.z.number().optional().default(0),
    unit: zod_1.z.nativeEnum(client_1.Unit).optional().default(client_1.Unit.PER_LB),
});
// Esquema para el objeto Customer cuando se envía completo
exports.createCustomerSchema = zod_1.z.object({
    first_name: zod_1.z.string({ required_error: "First name is required" }).min(1),
    middle_name: zod_1.z.string().optional(),
    last_name: zod_1.z.string({ required_error: "Last name is required" }).min(1),
    second_last_name: zod_1.z.string().optional(),
    email: zod_1.z.string().email("Invalid email format for customer.").optional().or(zod_1.z.literal("")),
    mobile: zod_1.z.string({ required_error: "Mobile is required" }).min(1),
    address: zod_1.z.string().optional(),
    identity_document: zod_1.z.string().optional(),
});
// Esquema para el objeto Receiver cuando se envía completo
exports.createReceiverSchema = zod_1.z
    .object({
    first_name: zod_1.z.string({ required_error: "First name is required" }).min(1),
    middle_name: zod_1.z.string().nullish(),
    last_name: zod_1.z.string({ required_error: "Last name is required" }).min(1),
    second_last_name: zod_1.z.string().nullish(),
    ci: zod_1.z.string({ required_error: "CI is required" }).length(11, "Receiver CI must be 11 characters long."), // Carnet de Identidad
    passport: zod_1.z.string().nullish(),
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal("")]).nullish(),
    mobile: zod_1.z.string().nullish(),
    phone: zod_1.z.string().nullish(),
    address: zod_1.z.string({ required_error: "Address is required" }).min(1),
    // Support both ID (from frontend) and name (from partners)
    province_id: zod_1.z.number().int().positive().optional(),
    province: zod_1.z.string().optional(),
    city_id: zod_1.z.number().int().positive().optional(),
    city: zod_1.z.string().optional(),
})
    .refine((data) => {
    // Either province_id or province name must be provided
    return !!data.province_id || !!data.province;
}, {
    message: "Either province_id or province name must be provided",
    path: ["province"],
})
    .refine((data) => {
    // Either city_id or city name must be provided
    return !!data.city_id || !!data.city;
}, {
    message: "Either city_id or city name must be provided",
    path: ["city"],
})
    .refine((data) => !data.ci || (0, utils_1.isValidCubanCI)(data.ci), {
    message: "CI (Carnet de Identidad) format or check digit is invalid",
    path: ["ci"],
});
// --- El Esquema Principal para la Creación de la Factura ---
exports.createOrderSchema = zod_1.z
    .object({
    customer_id: zod_1.z.number().int().positive().optional(),
    customer: exports.createCustomerSchema.optional(),
    receiver_id: zod_1.z.number().int().positive().optional(),
    receiver: exports.createReceiverSchema.optional(),
    service_id: zod_1.z.number().int().positive(),
    order_items: zod_1.z.array(exports.ItemSchema).min(1, "At least one item is required in the invoice."),
    total_delivery_fee_in_cents: zod_1.z.number().int().min(0).optional().default(0),
    requires_home_delivery: zod_1.z.boolean().optional().default(true),
    partner_order_id: zod_1.z.string().optional(),
})
    // Ahora aplicamos las reglas de negocio complejas con .refine()
    .refine((data) => {
    // Esta es la lógica XOR (exclusive OR): uno debe existir, pero no ambos.
    // La doble negación (!!) convierte los valores en booleanos (true si existe, false si no).
    return !!data.customer_id !== !!data.customer;
}, {
    // Mensaje de error si la condición de arriba falla
    message: 'Either "customer_id" or a "customer" object must be provided, but not both.',
    path: ["customer_id", "customer"], // Indica qué campos están relacionados con el error
})
    .refine((data) => {
    // La misma lógica XOR para el receptor
    return !!data.receiver_id !== !!data.receiver;
}, {
    message: 'Either "receiver_id" or a "receiver" object must be provided, but not both.',
    path: ["receiver_id", "receiver"],
});
//searh schema
exports.searchSchema = zod_1.z.object({
    page: zod_1.z.string().optional().default("1"),
    limit: zod_1.z.string().optional().default("25"),
    search: zod_1.z.string().optional().default(""),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
});
//discount schema
exports.discountSchema = zod_1.z.object({
    type: zod_1.z.nativeEnum(client_1.DiscountType),
    description: zod_1.z.string().optional(),
    discount_in_cents: zod_1.z.number().positive(),
});
//buildNameSearchFilter
function parseDateFlexible(dateStr) {
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
function buildNameSearchFilter(words) {
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
