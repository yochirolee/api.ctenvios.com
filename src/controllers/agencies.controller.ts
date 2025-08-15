import { Request, Response } from "express";
import { z } from "zod";
import { Agency, AgencyType, Prisma, Roles } from "@prisma/client";
import AppError from "../utils/app.error";

import { agencySchema } from "../types/types";
import repository from "../repository";

// Create update schema by making all fields optional
const agencyUpdateSchema = agencySchema.partial();

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
	},

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
	getServicesAndRates: async (req: Request, res: Response) => {
		const { id } = req.params;
		const servicesAndRates = await repository.agencies.getServicesAndRates(Number(id));
		res.status(200).json(servicesAndRates);
	},
};

export default agencies;
