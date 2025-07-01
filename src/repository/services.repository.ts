import { Service, Prisma } from "@prisma/client";
import prisma from "../config/prisma_db";

const services = {
	create: async (service: Prisma.ServiceCreateInput) => {
		// Using Prisma transaction to ensure atomicity
		const newService = await prisma.$transaction(async (tx) => {
			// Step 1: Create the service
			const createdService = await tx.service.create({
				data: service,
			});

			// Step 2: Get all existing agencies
			const agencies = await tx.agency.findMany({
				select: { id: true },
			});

			// Step 3: Create base rates for each agency
			await Promise.all(
				agencies.map((agency) =>
					tx.rates.create({
						data: {
							service_id: createdService.id,
							agency_id: agency.id,
							agency_rate: 1.99, // Default base rate
							forwarders_rate: 1.25, // Default forwarder rate
						},
					}),
				),
			);

			return createdService;
		});

		return newService;
	},
	getAll: async () => {
		try {
			return await prisma.service.findMany({
				include: {
					provider: true,
					forwarder: true,
					rates: true,
				},
			});
		} catch (error) {
			console.error("Error getting all services:", error);
			throw error;
		}
	},
	getById: async (id: number) => {
		try {
			return await prisma.service.findUnique({ where: { id } });
		} catch (error) {
			console.error("Error getting service by id:", error);
			throw error;
		}
	},

	update: async (id: number, service: Service) => {
		try {
			return await prisma.service.update({ where: { id }, data: service });
		} catch (error) {
			console.error("Error updating service:", error);
			throw error;
		}
	},
	delete: async (id: number) => {
		try {
			return await prisma.service.delete({ where: { id } });
		} catch (error) {
			console.error("Error deleting service:", error);
			throw error;
		}
	},
};

export default services;
