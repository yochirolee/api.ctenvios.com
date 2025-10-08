import { z } from "zod";
import { Request } from "express";
import { AgencyType, FeeType, PaymentMethod, Roles } from "@prisma/client";

// Role hierarchy types
export interface RoleResponse {
	success: boolean;
	data: Roles[];
	userRole: Roles;
	message: string;
}

export interface AuthenticatedRequest extends Request {
	user: {
		id: string;
		role: Roles;
		agency_id?: number;
		forwarder_id?: number;
		[key: string]: any;
	};
}

export const paymentSchema = z.object({
	amount_in_cents: z.number().min(0.00),
	charge_in_cents: z.number().min(0.00),
	method: z.nativeEnum(PaymentMethod),
	reference: z.string().optional(),
	notes: z.string().optional(),
});

export const customerSchema = z
	.object({
		first_name: z.string().min(1, "First name is required"),
		middle_name: z.string().optional(),
		last_name: z.string().min(1, "Last name is required"),
		second_last_name: z.string().optional(),
		identity_document: z.string().optional(),
		email: z.string().min(3, "Email is required").email("Invalid email format").optional(),
		mobile: z.string().optional(),
		phone: z.string().optional(),
		address: z.string().min(1).optional(),
	})
	.refine((data) => data.mobile || data.phone, {
		message: "At least one phone number (mobile or phone) is required",
		path: ["mobile"], // This will show the error on the mobile field
	});

export const receiverSchema = z
	.object({
		first_name: z.string().min(1, "First name is required"),
		middle_name: z.string().optional(),
		last_name: z.string().min(1, "Last name is required"),
		second_last_name: z.string().optional(),
		ci: z.string().length(11, "CI must be 11 characters long"),
		passport: z.string().nullable().optional().default(null),
		email: z.string().min(3, "Email is required").email("Invalid email format").optional(),
		mobile: z.string().optional(),
		phone: z.string().optional(),
		address: z.string().min(3).optional().default(""),
		province_id: z.number().min(1),
		city_id: z.number().min(1),
	})
	.refine((data) => data.mobile || data.phone, {
		message: "At least one phone number (mobile or phone) is required",
		path: ["mobile"], // This will show the error on the mobile field
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
