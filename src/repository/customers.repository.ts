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
		// Decode URL-encoded query and trim whitespace
		const trimmedQuery = query.trim();
		const queryWords = trimmedQuery.split(/\s+/).filter((word) => word.length > 0);

		// Base OR conditions for searching in individual fields
		const baseConditions = [
			{ first_name: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ last_name: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ middle_name: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ second_last_name: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ mobile: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ identity_document: { contains: trimmedQuery, mode: "insensitive" as const } },
			{ email: { contains: trimmedQuery, mode: "insensitive" as const } },
		];

		// Additional conditions for multi-word searches (first_name + last_name combinations)
		const multiWordConditions = [];
		if (queryWords.length >= 2) {
			const [firstName, ...lastNameParts] = queryWords;
			const lastName = lastNameParts.join(" ");

			// first_name + last_name
			multiWordConditions.push({
				AND: [
					{ first_name: { contains: firstName, mode: "insensitive" as const } },
					{ last_name: { contains: lastName, mode: "insensitive" as const } },
				],
			});

			// first_name + second_last_name
			multiWordConditions.push({
				AND: [
					{ first_name: { contains: firstName, mode: "insensitive" as const } },
					{ second_last_name: { contains: lastName, mode: "insensitive" as const } },
				],
			});

			// If there are 3+ words, also try first_name + middle_name + last_name
			if (queryWords.length >= 3) {
				const [first, middle, ...lastParts] = queryWords;
				const last = lastParts.join(" ");

				multiWordConditions.push({
					AND: [
						{ first_name: { contains: first, mode: "insensitive" as const } },
						{ middle_name: { contains: middle, mode: "insensitive" as const } },
						{ last_name: { contains: last, mode: "insensitive" as const } },
					],
				});
			}
		}

		const customers = await prisma.customer.findMany({
			where: {
				OR: [...baseConditions, ...multiWordConditions],
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
