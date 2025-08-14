import { City, Customer, Prisma, Province, Receiver } from "@prisma/client";
import prisma from "../config/prisma_db";

const customers = {
	get: async (
		page: number = 1,
		limit: number = 10,
	): Promise<{ rows: Customer[]; total: number }> => {
		// Ensure valid numeric values
		const total = await prisma.customer.count();
		const rows = await prisma.customer.findMany({
			skip: (page - 1) * limit,
			take: limit,
			orderBy: {
				first_name: "asc",
			},
		});
		return { rows, total };
	},
	search: async (query: string, page: number = 1, limit: number = 10): Promise<Customer[]> => {
		const trimmedQuery = query.trim();
		const queryWords = trimmedQuery.split(/\s+/).filter((word) => word.length > 0);

		const baseConditions = [
			{ first_name: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ middle_name: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ last_name: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ second_last_name: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ mobile: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ identity_document: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ email: { contains: trimmedQuery, mode: "insensitive" as const } },
		];

		// Búsqueda combinada: cada palabra debe aparecer en al menos un campo
		const combinedNameConditions =
			queryWords.length > 1
				? [
						{
							AND: queryWords.map((word) => ({
								OR: [
									{ first_name: { contains: word, mode: "insensitive" as const } },
									{ middle_name: { contains: word, mode: "insensitive" as const } },
									{ last_name: { contains: word, mode: "insensitive" as const } },
									{ second_last_name: { contains: word, mode: "insensitive" as const } },
								],
							})),
						},
				  ]
				: [];

		const customers = await prisma.customer.findMany({
			where: {
				OR: [...baseConditions, ...combinedNameConditions],
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
				receivers: true,
			},
		});
		return customer;
	},
	getReceivers: async (
		customerId: number,
		page: number = 1,
		limit: number = 10,
	): Promise<(Receiver & { province: Province; city: City })[]> => {
		const receivers = await prisma.receiver.findMany({
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
			skip: (page - 1) * limit,
			take: limit,
		});
		return receivers as (Receiver & { province: Province; city: City })[];
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
