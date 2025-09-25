import { Request, Response } from "express";
import { z } from "zod";
import { AgencyType, Prisma, Roles, ShippingRate } from "@prisma/client";
import AppError from "../utils/app.error";

import { agencySchema } from "../types/types";
import repository from "../repository";
import prisma from "../config/prisma_db";
import { auth } from "../lib/auth";

// Create update schema by making all fields optional
const agencyUpdateSchema = agencySchema.partial();

const create_agency_schema = z.object({
	agency: z.object({
		name: z.string().min(1),
		address: z.string().min(1),
		contact: z.string().min(1),
		phone: z.string().min(10),
		email: z.string().email(),
		website: z.string().url().optional(),
		agency_type: z.enum(["AGENCY", "RESELLER", "FORWARDER"]),
		parent_agency_id: z.number().int().positive().optional(),
	}),
	user: z.object({
		name: z.string().min(1),
		email: z.string().email(),
		phone: z.string().min(10),
		password: z.string().min(8),
		role: z.literal("AGENCY_ADMIN"),
	}),
});

const agencies = {
	getAll: async (req: any, res: Response) => {
		const user = req.user;
		const user_agency = await repository.agencies.getById(user.agency_id);
		let agencies = [];
		if (user_agency?.agency_type === AgencyType.FORWARDER) {
			agencies = await repository.agencies.getAll();
		} else {
			agencies.push(user_agency);
			agencies.push(...(await repository.agencies.getChildren(Number(user_agency?.id))));
		}
		res.status(200).json(agencies);
	},
	getById: async (req: Request, res: Response) => {
		const { id } = req.params;
		const agency = await repository.agencies.getById(Number(id));
		res.status(200).json(agency);
	},

	getUsers: async (req: Request, res: Response) => {
		const { id } = req.params;
		if (!id) {
			throw new AppError("Agency ID is required", 400, [], "zod");
		}
		const users = await repository.agencies.getUsers(Number(id));
		res.status(200).json(users);
	},

	create: async (req: any, res: Response) => {
		const current_user = req.user;
		if (
			current_user.role !== Roles.ROOT &&
			current_user.role !== Roles.ADMINISTRATOR &&
			current_user.role !== Roles.AGENCY_ADMIN
		) {
			throw new AppError(
				"You are not authorized to create this agency, please contact the administrator",
				403,
			);
		}
		console.log(req.body, "req.body");
		const result = create_agency_schema.safeParse(req.body);
		if (!result.success) {
			// Detailed error logging for debugging
			console.log("=== VALIDATION ERRORS ===");
			console.log("Full error object:", JSON.stringify(result.error, null, 2));

			// Show each error with its path
			result.error.issues.forEach((issue, index) => {
				console.log(`Error ${index + 1}:`);
				console.log(`  Path: ${issue.path.join(".")}`);
				console.log(`  Message: ${issue.message}`);
				console.log(`  Code: ${issue.code}`);
				if (issue.code === "invalid_type") {
					console.log(`  Expected: ${issue.expected}`);
					console.log(`  Received: ${issue.received}`);
				}
			});

			const fieldErrors = result.error.flatten().fieldErrors;
			const errorSummary = Object.entries(fieldErrors).map(([field, messages]) => ({
				field,
				messages,
				firstError: messages[0],
			}));

			console.log("Field errors:", fieldErrors);
			console.log("Error summary:", errorSummary);

			return res.status(400).json({
				message: "Invalid agency data",
				errors: fieldErrors,
				errorSummary,
				fieldsWithErrors: Object.keys(fieldErrors),
				detailedErrors: result.error.issues.map((issue) => ({
					path: issue.path.join("."),
					message: issue.message,
					code: issue.code,
					...(issue.code === "invalid_type"
						? {
								expected: issue.expected,
								received: issue.received,
						  }
						: {}),
				})),
			});
		}

		const { agency, user } = result.data;

		const parent_agency = await prisma.agency.findUnique({
			where: {
				id: agency.parent_agency_id || current_user.agency_id,
			},
			include: {
				shipping_rates: true,
			},
		});

		if (!parent_agency?.shipping_rates) {
			throw new AppError("Parent agency has no rates", 400, [], "zod");
		}

		const services_ids = parent_agency?.shipping_rates
			.filter(
				(shipping_rate, index, self) =>
					index === self.findIndex((t) => t.service_id === shipping_rate.service_id),
			)
			.map((shipping_rate) => shipping_rate.service_id)
			.filter((id): id is number => id !== null);

		try {
			const agency_created = await prisma.$transaction(async (tx) => {
				const created_agency = await tx.agency.create({
					data: {
						...agency,
						parent_agency_id: parent_agency?.id,
						forwarder_id: parent_agency?.forwarder_id || 1,
						services: {
							connect: services_ids.map((service_id) => ({
								id: service_id,
							})),
						},
					},
				});
				await tx.shippingRate.createMany({
					data: parent_agency?.shipping_rates.map((shipping_rate: ShippingRate) => ({
						cost_in_cents: shipping_rate.cost_in_cents,
						rate_in_cents: shipping_rate.rate_in_cents,
						service_id: shipping_rate.service_id,
						name: shipping_rate.name,
						rate_type: shipping_rate.rate_type,
						min_weight: shipping_rate.min_weight,
						max_weight: shipping_rate.max_weight,
						is_base_rate: shipping_rate.is_base_rate,
						length: shipping_rate.length,
						width: shipping_rate.width,
						height: shipping_rate.height,
						forwarder_id: shipping_rate.forwarder_id,
						agency_id: created_agency.id,
						parent_rate_id: shipping_rate.parent_rate_id,
					})),
				});

				// Create user using signup API instead of admin API
				await auth.api.signUpEmail({
					body: {
						email: user.email,
						password: user.password,
						name: user.name,
					},
				});

				// Update the created user with additional fields
				await tx.user.update({
					where: { email: user.email },
					data: {
						agency_id: created_agency.id,
						role: user.role,
						phone: user.phone,
						emailVerified: true,
						created_by: current_user.email,
					},
				});

				return created_agency;
			});

			res.status(201).json(agency_created);
		} catch (error) {
			console.error("Error creating agency:", error);
			res.status(500).json({
				message: "Error creating agency",
				error: error,
			});
		}
	},

	/* 	create: async (req: any, res: Response) => {
		const user = req.user;
		if (
			user.role !== Roles.ROOT &&
			user.role !== Roles.ADMINISTRATOR &&
			user.role !== Roles.AGENCY_ADMIN
		) {
			res.status(400).json({
				message: "You are not authorized to create this agency, please contact the administrator",
			});
			return;
		}
		const user_agency = await repository.agencies.getById(user.agency_id);

		if (
			user_agency?.agency_type !== AgencyType.FORWARDER &&
			user_agency?.agency_type !== AgencyType.RESELLER
		) {
			res.status(400).json({
				message: "You are not authorized to create this agency, please contact the administrator",
			});
			return;
		}

		const result = agencySchema.safeParse(req.body) as z.SafeParseReturnType<
			typeof agencySchema,
			Agency
		>;
		if (!result.success) {
			throw new AppError("Invalid agency data", 400, result.error.flatten().fieldErrors, "zod");
		}

		const data = result.data;

		// Set parent agency relationship based on user's agency type
		if (user_agency?.agency_type === AgencyType.FORWARDER) {
			// FORWARDER can create agencies without parent (top-level) or with themselves as parent
			data.parent_agency_id = data.parent_agency_id || null;
		} else if (user_agency?.agency_type === AgencyType.RESELLER) {
			// RESELLER agencies must have the current user's agency as parent
			data.parent_agency_id = user_agency.id;
			data.agency_type = AgencyType.AGENCY;
		}

		// Validate that forwarder_id is set correctly
		if (!data.forwarder_id) {
			data.forwarder_id = user_agency?.forwarder_id || 1; // Default to forwarder 1 if not specified
		}

		try {
			const agency = await repository.agencies.create(data as Partial<Prisma.AgencyCreateInput>);

			res.status(201).json({
				message: "Agency created successfully",
				agency,
			});
		} catch (error) {
			console.error("Failed to create agency:", error);
			throw new AppError("Failed to create agency", 500, [], "database");
		}
	}, */

	update: async (req: Request, res: Response) => {
		const { id } = req.params;
		const result = agencyUpdateSchema.safeParse(req.body) as z.SafeParseReturnType<
			typeof agencyUpdateSchema,
			Prisma.AgencyUpdateInput
		>;
		if (!result.success) {
			throw new AppError("Invalid agency data", 400, result.error.flatten().fieldErrors, "zod");
		}
		const agency = await repository.agencies.update(Number(id), result.data);
		res.status(200).json({
			agency,
		});
	},
	remove: async (req: Request, res: Response) => {
		const { id } = req.params;
		const agency = await repository.agencies.delete(Number(id));
		res.status(200).json({
			agency,
		});
	},
	getChildren: async (req: Request, res: Response) => {
		const { id } = req.params;
		const children = await repository.agencies.getChildren(Number(id));
		res.status(200).json(children);
	},
	getParent: async (req: Request, res: Response) => {
		const { id } = req.params;
		const parent = await repository.agencies.getParent(Number(id));
		res.status(200).json(parent);
	},
	getServices: async (req: Request, res: Response) => {
		const { id } = req.params;
		const { is_active } = req.query;
		const isActiveBoolean =
			is_active === undefined
				? undefined
				: is_active === "true"
				? true
				: is_active === "false"
				? false
				: undefined;
		const servicesAndRates = await repository.agencies.getServices(
			Number(id),
			isActiveBoolean as boolean | null,
		);
		res.status(200).json(servicesAndRates);
		res.status(200).json(servicesAndRates);
	},
	getServiceShippingRates: async (req: Request, res: Response) => {
		const { id, service_id } = req.params;
		if (!id || !service_id) {
			throw new AppError("Agency ID and service ID are required", 400, [], "zod");
		}
		const { rate_type, is_active } = req.query;

		const isActiveBoolean =
			is_active === undefined
				? undefined
				: is_active === "true"
				? true
				: is_active === "false"
				? false
				: undefined;

		const rates = await repository.agencies.getShippingRatesByService(
			Number(id),
			Number(service_id),
			rate_type as string | null,
			isActiveBoolean as boolean | null,
		);
		res.status(200).json(rates);
	},
	getShippingRates: async (req: Request, res: Response) => {
		const { id } = req.params;
		const rates = await repository.agencies.getShippingRates(Number(id));
		res.status(200).json(rates);
	},
};

export default agencies;
