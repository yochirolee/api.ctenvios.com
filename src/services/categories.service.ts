import { repository } from "../repository";

const categories = {
	getCategories: async () => {
		const categories = await repository.categories.getCategories();
		return categories;
	},
};

export default categories;
