import { z } from "zod";
import services from "../services";
import { Request, Response } from "express";
import { Forwarder } from "@prisma/client";

const forwarderSchema = z.object({
	name: z.string().min(1),
	logo: z.string().optional(),
	contact: z.string().min(1),
	phone: z.string().min(10),
	email: z.string().email(),
	address: z.string().min(1),
});

const providersIdsSchema = z.array(z.number()).optional();

export const forwarders = {
	getAll: async (req: Request, res: Response) => {
		const forwarders = await services.forwarders.getAll();
		res.status(200).json(forwarders);
	},
	getById: async (req: Request, res: Response) => {
		const { id } = req.params;
		const forwarder = await services.forwarders.getById(Number(id));

		res.status(200).json(forwarder);
	},
	create: async (req: Request, res: Response) => {
		const result = forwarderSchema.safeParse(req.body) as z.SafeParseReturnType<
			typeof forwarderSchema,
			Forwarder
		>;
		if (!result.success) {
			throw new Error(result.error.message);
		}
		const forwarder = await services.forwarders.create(result.data);
		res.status(201).json(forwarder);
	},
	update: async (req: Request, res: Response) => {
		const { id } = req.params;
		const { providersIds } = req.body;
		const parsedforwarder = forwarderSchema.safeParse(req.body) as z.SafeParseReturnType<
			typeof forwarderSchema,
			Forwarder
		>;
		if (!parsedforwarder.success) {
			throw new Error(parsedforwarder.error.message);
		}
		const forwarder = await services.forwarders.update(
			Number(id),
			parsedforwarder.data,
			providersIds,
		);
		res.status(200).json(forwarder);
	},
	delete: async (req: Request, res: Response) => {
		const { id } = req.params;
		const forwarder = await services.forwarders.delete(Number(id));
		res.status(200).json(forwarder);
	},
};

export default forwarders;
