import prisma from "../config/prisma_db";
import { Prisma } from "@prisma/client";

export const customsRates = {
	get: async (page: number, limit: number) => {
		const total = await prisma.customsRates.count();
		const rows = await prisma.customsRates.findMany({
			take: limit,
			skip: (page - 1) * limit,
		});
		return { rows, total };
	},
	getById: async (id: number) => {
		const rate = await prisma.customsRates.findUnique({ where: { id } });
		return rate;
	},
	create: async (rate: Prisma.CustomsRatesCreateInput) => {
		const newRate = await prisma.customsRates.create({ data: rate });
		return newRate;
	},
	update: async (id: number, rate: Prisma.CustomsRatesUpdateInput) => {
		console.log(rate, "rate");
		const updatedRate = await prisma.customsRates.update({ where: { id }, data: rate });
		return updatedRate;
	},
	delete: async (id: number) => {
		const deletedRate = await prisma.customsRates.delete({ where: { id } });
		return deletedRate;
	},
};

export default customsRates;
