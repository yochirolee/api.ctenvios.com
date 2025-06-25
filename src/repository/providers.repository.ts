import prisma from "../config/prisma_db";
import { Provider } from "@prisma/client";

export const providers = {
	getAll: async () => {
		const providers = await prisma.provider.findMany({
			include: {
				forwarders: true,
				services: {
					include: {
						agencies: true,
					},
				},
			},
		});
		return providers;
	},
	getIn: async (ids: number[]) => {
		const providers = await prisma.provider.findMany({
			where: { id: { in: ids } },
		});
		return providers;
	},
	getById: async (id: number) => {
		const provider = await prisma.provider.findUnique({
			where: { id },
			include: {
				services: {},
			},
		});
		return provider;
	},
	create: async (provider: Omit<Provider, "id">) => {
		const newProvider = await prisma.provider.create({
			data: provider,
		});
		return newProvider;
	},
	update: async (id: number, provider: Omit<Provider, "id">) => {
		try {
			const updatedProvider = await prisma.provider.update({
				where: { id },
				data: provider,
			});
			return updatedProvider;
		} catch (error) {
			console.error("Error updating provider:", error);
			throw error;
		}
	},
	delete: async (id: number) => {
		try {
			const deletedProvider = await prisma.provider.delete({
				where: { id },
			});
			return deletedProvider;
		} catch (error) {
			console.error("Error deleting provider:", error);
			throw error;
		}
	},
};

export default providers;
