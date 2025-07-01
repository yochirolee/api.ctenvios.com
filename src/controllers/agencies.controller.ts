import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Agency, Prisma } from "@prisma/client";
import AppError from "../utils/app.error";

import { agencySchema } from "../types/types";
import repository from "../repository";

// Create update schema by making all fields optional
const agencyUpdateSchema = agencySchema.partial();

const agencies = {
	getAll: async (req: Request, res: Response) => {
		const agencies = await repository.agencies.getAll();
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

	create: async (req: Request, res: Response) => {
		const result = agencySchema.safeParse(req.body);
		if (!result.success) {
			throw new AppError("Invalid agency data", 400, result.error.flatten().fieldErrors, "zod");
		}
		const agency = await repository.agencies.create(result.data as Partial<Prisma.AgencyCreateInput>);
		res.status(201).json({
			agency,
		});
	},
	update: async (req: Request, res: Response) => {
		const { id } = req.params;
		const result = agencyUpdateSchema.safeParse(req.body) as z.SafeParseReturnType<
			typeof agencyUpdateSchema,
			Agency
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
