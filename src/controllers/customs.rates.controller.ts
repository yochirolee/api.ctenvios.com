import { Request, Response } from "express";
import repository from "../repository";
import { customsRatesSchema } from "../types/types";
import { Prisma } from "@prisma/client";

const customsRates = {
	get: async (req: Request, res: Response) => {
		const { page, limit } = req.query;
		const { rows, total } = await repository.customsRates.get(
			parseInt(page as string) || 1,
			parseInt(limit as string) || 25,
		);
		res.status(200).json({ rows, total });
	},
	getById: async (req: Request, res: Response) => {
		const { id } = req.params;
		const rate = await repository.customsRates.getById(Number(id));
		res.status(200).json(rate);
	},
	create: async (req: Request, res: Response) => {
		const schema = customsRatesSchema.safeParse(req.body);
		if (!schema.success) {
			throw new Error(schema.error.message);
		}
		const customsRate = schema.data;
		const rate = await repository.customsRates.create(
			customsRate as unknown as Prisma.CustomsRatesCreateInput,
		);
		res.status(201).json(rate);
	},
	update: async (req: Request, res: Response) => {
		const { id } = req.params;
		const schema = customsRatesSchema.safeParse(req.body);	
		if (!schema.success) {
			throw new Error(schema.error.message);
		}
		const customsRate = schema.data;
		const rate = await repository.customsRates.update(Number(id), customsRate as unknown as Prisma.CustomsRatesUpdateInput);
		res.status(200).json(rate);
	},
	delete: async (req: Request, res: Response) => {
		const { id } = req.params;
		const rate = await repository.customsRates.delete(Number(id));
		res.status(200).json(rate);
	},
};

export default customsRates;
