import { Request, Response } from "express";
import repository from "../repository";
import { Service, ServiceType } from "@prisma/client";
import { z } from "zod";

const serviceSchema = z.object({
	name: z.string().min(1, { message: "Name is required" }),
	description: z.string().optional(),
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

			const all_agencies = await repository.agencies.getAll();

			// Transform data for Prisma ServiceCreateInput
			const { forwarder_id, provider_id, ...serviceData } = service.data;
			const prismaServiceData = {
				...serviceData,
				forwarder: {
					connect: { id: forwarder_id },
				},
				provider: {
					connect: { id: provider_id },
				},
				agencies: {
					connect: all_agencies.map((agency) => ({ id: agency.id })),
				},
				
			};

			const newService = await repository.services.create(prismaServiceData);
			res.status(201).json(newService);
		} catch (error) {
			console.error("Error creating service:", error);
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
	getByAgencyId: async (req: Request, res: Response) => {
		const { agency_id } = req.params;
		if (!agency_id || isNaN(Number(agency_id))) {
			return res.status(400).json({ error: "Agency ID is required" });
		}
		const services = await repository.services.getByAgencyId(Number(agency_id));
		res.status(200).json(services);
	},
	getByProviderId: async (req: Request, res: Response) => {
		const { provider_id } = req.params;
		if (!provider_id || isNaN(Number(provider_id))) {
			return res.status(400).json({ error: "Provider ID is required" });
		}
		const services = await repository.services.getByProviderId(Number(provider_id));
		res.status(200).json(services);
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
