import { Provider } from "@prisma/client";
import repository from "../repository";

const providers = {
	create: async (provider: Provider) => {
		const newProvider = await repository.providers.create(provider);
		return newProvider;
	},
	getAll: async () => {
		const providers = await repository.providers.getAll();
		return providers;
	},
	getById: async (id: number) => {
		const provider = await repository.providers.getById(id);
		return provider;
	},
	update: async (id: number, provider: Provider) => {
		const updatedProvider = await repository.providers.update(id, provider);
		return updatedProvider;
	},
	delete: async (id: number) => {
		const deletedProvider = await repository.providers.delete(id);
		return deletedProvider;
	},
};

export default providers;
