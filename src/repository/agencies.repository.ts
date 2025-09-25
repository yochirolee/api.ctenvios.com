import prisma from "../config/prisma_db";
import { Prisma, RateType } from "@prisma/client";
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
	getServices: async (agency_id: number, is_active: boolean | null = null) => {
		const servicesRates = await prisma.service.findMany({
			select: {
				id: true,
				name: true,
				service_type: true,
				provider: { select: { id: true, name: true } },
				forwarder: { select: { id: true, name: true } },
			},
			where: {
				agencies: {
					some: {
						id: agency_id,
					},
				},
				is_active: is_active === null ? undefined : is_active,
			},
		});
		return servicesRates;
	},
	getShippingRates: async (agency_id: number) => {
		const rates = await prisma.shippingRate.findMany({
			where: { agency_id: agency_id },
		});
		return rates;
	},
	getShippingRatesByService: async (
		id: number,
		service_id: number,
		RateType: string | null = null,
		IsActive: boolean | null = null,
	) => {
		let rates = await prisma.shippingRate.findMany({
			where: {
				agency_id: id,
				service_id: service_id,
				rate_type: RateType === null ? undefined : (RateType as RateType),
				is_active: IsActive === null ? undefined : (IsActive as boolean),
			},
		});
		return rates;
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
