import prisma from "../config/prisma_db";
import { Prisma, RateType } from "@prisma/client";
import agencies from "./agencies.repository";

interface CreateBaseRateData {
	name: string;
	description: string;
	service_id: number;
	cost_in_cents: number;
	rate_in_cents: number;
	rate_type: RateType;
	min_weight: number;
	max_weight: number;
}

export const shippingRates = {
	createBaseRateForForwarderAndChildren: async (
		forwarderAgencyId: number,
		rateData: CreateBaseRateData
	): Promise<{ baseRate: any; childRates: any[] }> => {
		// Get the forwarder agency
		const forwarderAgency = await prisma.agency.findUnique({
			where: { id: forwarderAgencyId },
		});

		if (!forwarderAgency || forwarderAgency.agency_type !== "FORWARDER") {
			throw new Error("Agency not found or is not a forwarder");
		}

		// Get all child agencies recursively
		const childAgencyIds = await agencies.getAllChildrenRecursively(forwarderAgencyId);
		
		
		// Use transaction to ensure all rates are created atomically
		const result = await prisma.$transaction(async (tx) => {
			// Create the base rate for the forwarder
			const baseRate = await tx.shippingRate.create({
				data: {
					agency_id: forwarderAgencyId,
					name: rateData.name,
					description: rateData.description,
					service_id: rateData.service_id,
					cost_in_cents: rateData.cost_in_cents,
					rate_in_cents: rateData.rate_in_cents,
					rate_type: rateData.rate_type,
					forwarder_id: forwarderAgency.forwarder_id,
					is_base_rate: true,
					min_weight: rateData.min_weight,
					max_weight: rateData.max_weight,
					is_active: true,
				},
			});

			// Create rates for all child agencies
			const childRates = await Promise.all(
				childAgencyIds.map(async (childAgencyId) => {
					// Get child agency details
					const childAgency = await tx.agency.findUnique({
						where: { id: childAgencyId },
					});

					if (!childAgency) {
						throw new Error(`Child agency with id ${childAgencyId} not found`);
					}

					// Calculate child rate based on commission
					const commissionRate = childAgency.commission_rate || 0;
					const childRateInCents = Math.round(
						rateData.rate_in_cents * (1 + commissionRate / 100)
					);

					return tx.shippingRate.create({
						data: {
							agency_id: childAgencyId,
							name: rateData.name,
							description: rateData.description,
							service_id: rateData.service_id,
							cost_in_cents: rateData.rate_in_cents, // Child's cost is parent's rate
							rate_in_cents: childRateInCents, // Child's rate includes commission
							rate_type: rateData.rate_type,
							forwarder_id: forwarderAgency.forwarder_id,
							is_base_rate: false,
							parent_rate_id: baseRate.id, // Link to parent rate
							min_weight: rateData.min_weight,
							max_weight: rateData.max_weight,
							is_active: true,
						},
					});
				})
			);

			return { baseRate, childRates };
		});

		return result;
	},

	getRatesByAgency: async (agencyId: number) => {
		const rates = await prisma.shippingRate.findMany({
			where: { agency_id: agencyId },
			include: {
				service: {
					select: {
						id: true,
						name: true,
						service_type: true,
						provider: {
							select: { id: true, name: true },
						},
					},
				},
				parent_rate: {
					select: {
						id: true,
						name: true,
						rate_in_cents: true,
					},
				},
			},
			orderBy: {
				service_id: "asc",
			},
		});
		return rates;
	},

	getRatesByAgencyAndService: async (agencyId: number, serviceId: number) => {
		const rates = await prisma.shippingRate.findMany({
			where: {
				agency_id: agencyId,
				service_id: serviceId,
				is_active: true,
			},
			include: {
				forwarder: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});
		return rates;
	},

	updateRate: async (rateId: number, updateData: Prisma.ShippingRateUpdateInput) => {
		const updatedRate = await prisma.shippingRate.update({
			where: { id: rateId },
			data: updateData,
		});
		return updatedRate;
	},

	deleteRate: async (rateId: number) => {
		const deletedRate = await prisma.shippingRate.delete({
			where: { id: rateId },
		});
		return deletedRate;
	},
};

export default shippingRates;