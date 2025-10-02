import prisma from "../config/prisma_db";
import { AgencyType, Prisma, RateType } from "@prisma/client";
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
			select: {
				id: true,
				name: true,
				address: true,
				contact: true,
				phone: true,
				email: true,
				agency_type: true,
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
	getServicesWithRates: async (agency_id: number, is_active: boolean | null = null) => {

		const servicesWithRates = await prisma.service.findMany({
			select: {
				id: true,
				name: true,
				description: true,
				service_type: true,
				provider: { select: { id: true, name: true } },
				forwarder: { select: { id: true, name: true } },
				shipping_rates: { select: { id: true, name: true,description: true, rate_in_cents: true, cost_in_cents: true, rate_type: true, is_active: true, min_weight: true, max_weight: true, length: true, width: true, height: true }
				,where: {
					agency_id: agency_id,
					is_active: is_active === null ? undefined : is_active,
				},
			},
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
		return servicesWithRates;
		/* const servicesWithRates = await prisma.agency.findUnique({
			select: {
				id: true,
				name: true,
				services: {
					select: {
						id: true,
						name: true,
						description: true,
						
						provider: {
							select: {
								id: true,
								name: true,
							},
						},
						
						
						service_type: true,
						shipping_rates: {
							select: {
								id: true,
								rate_in_cents: true,
								cost_in_cents: true,
								min_weight: true,
								max_weight: true,
								length: true,
								width: true,
								height: true,
								rate_type: true,
								agency_id: true,
								forwarder_id: true,
							},

							where: {
								agency_id: agency_id,
								is_active: is_active === null ? undefined : is_active,
							},
						},
					},
				},
				
				
			},
			where: { id: agency_id, is_active: is_active === null ? undefined : is_active },
		}); */
		
		return servicesWithRates;
	},
	
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
	getAllChildrenRecursively: async (parentId: number): Promise<number[]> => {
		const getAllChildren = async (agencyId: number): Promise<number[]> => {
			const directChildren = await prisma.agency.findMany({
				where: { parent_agency_id: agencyId },
				select: { id: true },
			});

			const childIds = directChildren.map(child => child.id);
			const allChildIds = [...childIds];

			// Recursively get children of children
			for (const childId of childIds) {
				const grandChildren = await getAllChildren(childId);
				allChildIds.push(...grandChildren);
			}

			return allChildIds;
		};

		return getAllChildren(parentId);
	},
};

export default agencies;
