import { City, Prisma, Province, Receipt } from "@prisma/client";
import prisma from "../config/prisma_db";

const receipts = {
	get: async (
		page: number = 1,
		limit: number = 10,
	): Promise<{ rows: (Receipt & { province: Province; city: City })[]; total: number }> => {
		// Ensure valid numeric values
		const total = await prisma.receipt.count();
		const rows = await prisma.receipt.findMany({
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

		return { rows, total };
	},
	search: async (query: string, page: number = 1, limit: number = 10): Promise<Receipt[]> => {
		const terms = query.trim().split(/\s+/).filter(Boolean);

		const receipts = await prisma.receipt.findMany({
			where: {
				OR: [
					// Búsqueda por campos individuales
					{ first_name: { contains: query, mode: "insensitive" } },
					{ middle_name: { contains: query, mode: "insensitive" } },
					{ last_name: { contains: query, mode: "insensitive" } },
					{ second_last_name: { contains: query, mode: "insensitive" } },
					{ email: { contains: query, mode: "insensitive" } },
					{ mobile: { contains: query, mode: "insensitive" } },

					// Búsqueda combinada por nombre completo (en cualquier orden)
					{
						AND: terms.map((term) => ({
							OR: [
								{ first_name: { contains: term, mode: "insensitive" } },
								{ middle_name: { contains: term, mode: "insensitive" } },
								{ last_name: { contains: term, mode: "insensitive" } },
								{ second_last_name: { contains: term, mode: "insensitive" } },
							],
						})),
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

		return receipts.map((receipt) => ({
			...receipt,
			province: receipt.province.name,
			city: receipt.city.name,
		}));
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
	getByCi: async (ci: string): Promise<Receipt & { province: Province; city: City }> => {
		const receipt = await prisma.receipt.findUnique({
			where: { ci: ci },
			include: {
				province: true,
				city: true,
			},
		});
		return receipt;
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
