import { Request, Response } from "express";
import repository from "../repository";
import { Service, ServiceType } from "@prisma/client";
import { z } from "zod";

const serviceSchema = z.object({
	name: z.string().min(1, { message: "Name is required" }),
	service_type: z.nativeEnum(ServiceType, { message: "Service type is required" }),
	forwarder_id: z.number().min(0, { message: "Forwarder ID is required" }),
	provider_id: z.number().min(0, { message: "Provider ID is required" }),
	is_active: z.boolean().default(true),
});

export const services_controller = {
	create: async (req: Request, res: Response) => {
		try {
			const service = serviceSchema.safeParse(req.body) as z.SafeParseReturnType<
				typeof serviceSchema,
				Service
			>;

			if (!service.success) {
				throw new Error(service.error.message);
			}

			const newService = await repository.services.create(service.data);
			res.status(201).json(newService);
		} catch (error) {
			res.status(500).json({ error: (error as Error).message });
		}
	},
	getAll: async (req: Request, res: Response) => {
		const service = await repository.services.getAll();
		res.status(200).json(service);
	},
	getById: async (req: Request, res: Response) => {
		const { id } = req.params;
		const service = await repository.services.getById(Number(id));
		res.status(200).json(service);
	},
	update: async (req: Request, res: Response) => {
		const { id } = req.params;
		const service = await repository.services.update(Number(id), req.body);
		res.status(200).json(service);
	},
	delete: async (req: Request, res: Response) => {
		const { id } = req.params;
		const service = await repository.services.delete(Number(id));
		res.status(200).json(service);
	},
};

export default services_controller;
