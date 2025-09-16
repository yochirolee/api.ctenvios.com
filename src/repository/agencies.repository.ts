import prisma from "../config/prisma_db";
import { Prisma } from "@prisma/client";
import repository from "./index";

export const agencies = {
	getAll: async () => {
		const agencies = await prisma.agency.findMany({
			orderBy: {
				id: "asc",
			},
		});
		return agencies;
	},
	getById: async (id: number) => {
		const agency = await prisma.agency.findUnique({
			include: {
				services: {
					include: {
						provider: {
							select: {
								id: true,
								name: true,
							},
						},
						forwarder: {
							select: {
								id: true,
								name: true,
							},
						},
						shipping_rates: true,
					},
				},
				users: true,
			},
			where: { id },
		});
		return agency;
	},
	getUsers: async (id: number) => {
		const users = await prisma.user.findMany({
			where: { agency_id: id },
		});
		return users;
	},
	getServicesAndRates: async (id: number) => {
		const servicesRates = await prisma.service.findMany({
			include: {
				provider: true,
				shipping_rates: {
					where: {
						agency_id: id,
					},
				},
			},
		});
		return servicesRates;
	},

	/* create: async (agency: Partial<Prisma.AgencyCreateInput>) => {
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
					tx.shipping_rates.create({
						data: {
							service_id: service.id,
							agency_id: createdAgency.id,
							agency_rate: 199,
							rate_in_cents: 199,
							rate_type: "WEIGHT",
							min_weight: 0,
							max_weight: 0,
							product_id: null,
							carrier_rates_id: null,
						},
					}),
				),
			);

			return createdAgency;
		});

		return newAgency;
	}, */

	update: async (id: number, agency: Prisma.AgencyUpdateInput) => {
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
