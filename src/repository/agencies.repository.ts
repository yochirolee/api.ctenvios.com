import prisma from "../config/prisma_db";
import { Agency } from "@prisma/client";
import repository from "./index";

export const agencies = {
	getAll: async () => {
		const agencies = await prisma.agency.findMany({
			select: {
				id: true,
				name: true,
			},
		});
		return agencies;
	},
	getById: async (id: number) => {
		const agency = await prisma.agency.findUnique({
			where: { id },
			include: {
				services: {
					include: {
						provider: {
							include: {
								services: {
									include: {
										service_rates: {
											where: {
												agency_id: id,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		});
		return agency;
	},
	getServicesAndRates: async (id: number) => {
		const servicesRates = await prisma.service.findMany({
			include: {
				rates: {
					where: {
						agency_id: id,
					},
					
				},
			},
		});
		return servicesRates;
	},
	create: async (agency: Omit<Agency, "id">): Promise<Agency> => {
		const services = await repository.services.getAll();

		// Using Prisma transaction to ensure atomicity
		const newAgency = await prisma.$transaction(async (tx) => {
			// Step 1: Create the agency with services
			const createdAgency = await tx.agency.create({
				data: {
					...agency,
					services: {
						connect: services.map((service) => ({
							id: service.id,
						})),
					},
				},
			});

			// Step 2: Create service rates for each service
			await Promise.all(
				services.map((service) =>
					tx.rates.create({
						data: {
							service_id: service.id,
							agency_id: createdAgency.id,
							agency_rate: 1.99,
							forwarders_rate: 1.75,
						},
					}),
				),
			);

			return createdAgency;
		});

		return newAgency;
	},

	update: async (id: number, agency: Omit<Agency, "id">) => {
		const updatedAgency = await prisma.agency.update({
			where: { id },
			data: agency,
		});
		return updatedAgency;
	},
	delete: async (id: number) => {
		try {
			const deletedAgency = await prisma.agency.delete({
				where: { id },
			});
			return deletedAgency;
		} catch (error) {
			console.error("Error deleting agency:", error);
			throw error;
		}
	},
	getChildren: async (id: number) => {
		const children = await prisma.agency.findMany({
			include: {
				services: {
					include: {
						rates: true,
						provider: true,
					},
				},
			},
			where: { parent_agency_id: id },
		});
		return children;
	},
	getParent: async (id: number) => {
		const parent = await prisma.agency.findUnique({
			where: { id },
		});
		return parent;
	},
};

export default agencies;
