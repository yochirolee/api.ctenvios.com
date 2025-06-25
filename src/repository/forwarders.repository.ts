import prisma from "../config/prisma_db";
import { Forwarder } from "@prisma/client";
import { repository } from ".";

export const forwarders = {
	getAll: async () => {
		const forwarders = await prisma.forwarder.findMany();
		return forwarders;
	},
	getById: async (id: number) => {
		const forwarder = await prisma.forwarder.findUnique({
			where: { id },
			include: {
				services: true,
				agencies: true,
				users: true,
				providers: true,
			},
		});
		return forwarder;
	},
	create: async (forwarder: Omit<Forwarder, "id">) => {
		const newForwarder = await prisma.forwarder.create({
			data: forwarder,
		});
		return newForwarder;
	},
	update: async (
		id: number,
		forwarder: Omit<Forwarder, "id" | "created_at">,
		providersIds: number[],
	) => {
		if (providersIds) {
			const providers = await repository.providers.getAll();

			//disconnect all providers
			await prisma.forwarder.update({
				where: { id },
				data: {
					providers: { disconnect: providers.map((provider) => ({ id: provider.id })) },
				},
			});

			await prisma.forwarder.update({
				where: { id },
				data: {
					providers: { connect: providersIds.map((id) => ({ id: id })) },
				},
			});
		}
		const updatedForwarder = await prisma.forwarder.update({
			where: { id },
			data: forwarder,
		});
		return updatedForwarder;
	},
	delete: async (id: number) => {
		const deletedForwarder = await prisma.forwarder.delete({
			where: { id },
		});
		return deletedForwarder;
	},
};

export default forwarders;
