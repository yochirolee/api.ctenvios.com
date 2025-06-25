import { Prisma, Receipt } from "@prisma/client";
import prisma from "../config/prisma_db";

const receipts = {
	get: async (page: number = 1, limit: number = 10): Promise<Receipt[]> => {
		// Ensure valid numeric values
		const receipts = await prisma.receipt.findMany({
			skip: (page - 1) * limit,
			take: limit,
			orderBy: {
				first_name: "asc",
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
	search: async (query: string, page: number = 1, limit: number = 10): Promise<Receipt[]> => {
		const receipts = await prisma.receipt.findMany({
			where: {
				OR: [
					// Individual field searches
					{ first_name: { contains: query, mode: "insensitive" } },
					{ second_name: { contains: query, mode: "insensitive" } },
					{ last_name: { contains: query, mode: "insensitive" } },
					{ second_last_name: { contains: query, mode: "insensitive" } },
					{ ci: { contains: query, mode: "insensitive" } },
					{ email: { contains: query, mode: "insensitive" } },
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
			include: {
				province: true,
				city: true,
			},
			skip: (page - 1) * limit,
			take: limit,
			orderBy: {
				first_name: "asc",
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
	create: async (receipt: Prisma.ReceiptCreateInput): Promise<Receipt> => {
		const newReceipt = await prisma.receipt.create({
			data: receipt,
			include: {
				province: true,
				city: true,
			},
		});
		const flat_receipt = {
			...newReceipt,
			province: newReceipt.province.name,
			city: newReceipt.city.name,
		};
		return flat_receipt;
	},
	connect: async (receiptId: number, customerId: number): Promise<Receipt> => {
		// Ensure both IDs are valid
		if (!receiptId || !customerId) {
			throw new Error("Both receiptId and customerId are required");
		}

		const updatedReceipt = await prisma.receipt.update({
			where: {
				id: receiptId,
			},
			data: {
				customers: {
					connect: {
						id: customerId,
					},
				},
			},
			include: {
				province: true,
				city: true,
				customers: true, // Include customer data in response
			},
		});
		const flat_receipt = {
			...updatedReceipt,
			province: updatedReceipt.province.name,
			city: updatedReceipt.city.name,
		};

		return flat_receipt;
	},
	disconnect: async (receiptId: number, customerId: number): Promise<Receipt> => {
		const updatedReceipt = await prisma.receipt.update({
			where: { id: receiptId },
			data: {
				customers: {
					disconnect: { id: customerId },
				},
			},
		});
		return updatedReceipt;
	},
	edit: async (id: number, receipt: Prisma.ReceiptUpdateInput): Promise<Receipt> => {
		const updatedReceipt = await prisma.receipt.update({
			where: { id },
			data: receipt,
		});
		return updatedReceipt;
	},
};

export default receipts;
