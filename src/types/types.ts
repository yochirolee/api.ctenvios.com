import { z } from "zod";

export const customerSchema = z.object({
	first_name: z.string().min(1, "First name is required"),
	second_name: z.string().optional(),
	last_name: z.string().min(1, "Last name is required"),
	second_last_name: z.string().min(1, "Second last name is required"),
	identity_document: z.string().optional(),
	email: z.string().min(3, "Email is required").email("Invalid email format").optional(),
	phone: z.string().min(1, "Phone is required"),
	address: z.string().min(1).optional(),
});

export const receiptSchema = z.object({
	first_name: z.string().min(1, "First name is required"),
	second_name: z.string().nullable().optional().default(null),
	last_name: z.string().min(1, "Last name is required"),
	second_last_name: z.string().min(1, "Second last name is required"),
	ci: z.string().length(11, "CI must be 11 characters long"),
	passport: z.string().nullable().optional().default(null),
	email: z.string().min(3, "Email is required").email("Invalid email format").optional(),
	phone: z.string().min(1),
	address: z.string().min(3).optional().default(""),
	province_id: z.number().min(1),
	city_id: z.number().min(1),
});

export const agencySchema = z.object({
	name: z.string().min(5, "Name must be at least 5 characters long"),
	address: z.string().min(1, "Address is required"),
	phone: z.string().min(10, "Phone must be at least 10 characters long"),
	email: z.string().email("Invalid email"),
	contact: z.string().min(1, "Contact is required"),
	forwarder_id: z.number().min(1, "Forwarder ID is required"),
	parent_agency_id: z.number().min(1, "Parent Agency ID is required").optional(),
	created_at: z.date().optional(),
	updated_at: z.date().optional(),
	services: z.array(z.number()).optional(),
});
