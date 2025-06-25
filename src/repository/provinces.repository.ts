import { Province } from "@prisma/client";
import prisma from "../config/prisma_db";

const provinces = {
	get: async (): Promise<Province[]> => {
		// Ensure valid numeric values
		const provinces = await prisma.province.findMany({
			include: {
				cities: true,
			},
			orderBy: {
				id: "asc",
			},
		});
		return provinces;
	},
};

export default provinces;
