import { Service } from "@prisma/client";
import prisma from "../config/prisma_db";

const services = {
	create: async (service: Service) => {
		try {
			return await prisma.service.create({ data: service });
		} catch (error) {
			console.error("Error creating service:", error);
			throw error;
		}
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
