import { Service, Prisma } from "@prisma/client";
import prisma from "../config/prisma_db";

const services = {
	create: async (service: Prisma.ServiceCreateInput) => {
		return await prisma.service.create({ data: service });
	},
	getAll: async () => {
		try {
			const services = await prisma.service.findMany({
				include: {
					provider: true,
					forwarder: true,
				},
				where: {
					is_active: true,
				},
			});
			return services.map((service) => {
				return {
					id: service.id,
					name: service.name,
					provider: service.provider.name,
					service_type: service.service_type,
					is_active: service.is_active,
				};
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
	getByAgencyId: async (agency_id: number) => {
		const services = await prisma.service.findMany({
			select: {
				id: true,
				name: true,
				service_type: true,
				provider: { select: { id: true, name: true } },
				forwarder: { select: { id: true, name: true } },
				shipping_rates: { select: { id: true, rate_in_cents: true, rate_type: true, min_weight: true, max_weight: true, length: true, width: true, height: true } },
			},
		});
		return services;
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
