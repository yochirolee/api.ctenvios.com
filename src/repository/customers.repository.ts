import { Customer, Prisma, Receipt } from "@prisma/client";
import prisma from "../config/prisma_db";

const customers = {
	get: async (page: number = 1, limit: number = 10): Promise<Customer[]> => {
		// Ensure valid numeric values
		const customers = await prisma.customer.findMany({
			skip: (page - 1) * limit,
			take: limit,
			orderBy: {
				first_name: "asc",
			},
		});
		return customers;
	},
	search: async (query: string, page: number = 1, limit: number = 10): Promise<Customer[]> => {
		const customers = await prisma.customer.findMany({
			where: {
				OR: [
					// Individual field searches
					{ first_name: { contains: query, mode: "insensitive" } },
					{ second_name: { contains: query, mode: "insensitive" } },
					{ last_name: { contains: query, mode: "insensitive" } },
					{ phone: { contains: query, mode: "insensitive" } },

					// Combined name searches
					{
						AND: [
							{
								OR: query.split(" ").map((term, index) => {
									if (index === 0) {
										return {
											OR: [
												{ first_name: { contains: term, mode: "insensitive" } },
												{ second_name: { contains: term, mode: "insensitive" } },
											],
										};
									} else {
										return {
											OR: [
												{ second_name: { contains: term, mode: "insensitive" } },
												{ last_name: { contains: term, mode: "insensitive" } },
												{ second_last_name: { contains: term, mode: "insensitive" } },
											],
										};
									}
								}),
							},
						],
					},
				],
			},

			skip: (page - 1) * limit,
			take: limit,
			orderBy: {
				first_name: "asc",
			},
		});
		return customers;
	},
	getById: async (customerId: number): Promise<Customer | null> => {
		const customer = await prisma.customer.findUnique({
			where: {
				id: customerId,
			},
			include: {
				receipts: true,
			},
		});
		return customer;
	},
	getReceipts: async (customerId: number): Promise<Receipt[]> => {
		const receipts = await prisma.receipt.findMany({
			where: {
				customers: {
					some: {
						id: customerId,
					},
				},
			},
			include: {
				province: true,
				city: true,
			},
		});
		const flat_receipts = receipts.map((receipt) => {
			return {
				...receipt,
				province: receipt.province.name,
				city: receipt.city.name,
			};
		});
		return flat_receipts;
	},
	create: async (customer: Prisma.CustomerCreateInput): Promise<Customer> => {
		const newCustomer = await prisma.customer.create({
			data: customer,
		});
		return newCustomer;
	},
	edit: async (id: number, customer: Prisma.CustomerUpdateInput): Promise<Customer> => {
		const updatedCustomer = await prisma.customer.update({
			where: { id: id },
			data: {
				...customer,
			},
		});
		return updatedCustomer;
	},
};

export default customers;
