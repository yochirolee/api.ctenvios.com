import { Forwarder } from "@prisma/client";
import repository from "../repository";

const forwarders = {
	create: async (forwarder: Forwarder) => {
		const newforwarder = await repository.forwarders.create(forwarder);
		return newforwarder;
	},
	getAll: async () => {
		const forwarders = await repository.forwarders.getAll();
		return forwarders;
	},
	getById: async (id: number) => {
		const forwarder = await repository.forwarders.getById(id);
		return forwarder;
	},
	update: async (id: number, forwarder: Omit<Forwarder, "id" | "created_at">, providersIds: number[]) => {
		const updatedforwarder = await repository.forwarders.update(id, forwarder, providersIds);
		return updatedforwarder;
	},

	delete: async (id: number) => {
		const deletedforwarder = await repository.forwarders.delete(id);
		return deletedforwarder;
	},
};

export default forwarders;
