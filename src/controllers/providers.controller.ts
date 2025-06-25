import { Request, Response } from "express";
import { z } from "zod";
import { Provider } from "@prisma/client";
import services from "../services";

const providerSchema = z.object({
	name: z.string(),
	address: z.string(),
	contact: z.string(),
	phone: z.string(),
	email: z.string(),
});

export const providers = {
	create: async (req: Request, res: Response) => {
		const result = providerSchema.safeParse(req.body) as z.SafeParseReturnType<
			typeof providerSchema,
			Provider
		>;

		if (!result.success) {
			throw new Error(result.error.message);
		}

		const provider = await services.providers.create(result.data);
		res.status(201).json(provider);
	},
	getAll: async (req: Request, res: Response) => {
		const providers = await services.providers.getAll();
		res.status(200).json(providers);
	},
	getById: async (req: Request, res: Response) => {
		const id = Number(req.params.id);
		if (isNaN(id)) {
			return res.status(400).json({
				message: "Invalid provider id",
			});
		}

		const provider = await services.providers.getById(id);
		res.status(200).json(provider);
	},
	update: async (req: Request, res: Response) => {
		const id = Number(req.params.id);
		if (isNaN(id)) {
			return res.status(400).json({
				message: "Invalid provider id",
			});
		}

		const provider = await services.providers.update(id, req.body);
		res.status(200).json(provider);
	},
	delete: async (req: Request, res: Response) => {
		const id = Number(req.params.id);
		if (isNaN(id)) {
			return res.status(400).json({
				message: "Invalid provider id",
			});
		}
		const provider = await services.providers.delete(id);
		res.status(200).json(provider);
	},
};

export default providers;
