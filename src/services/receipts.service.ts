import { Receipt } from "@prisma/client";
import { repository } from "../repository";

const receipts = {
	get: async (page: number = 1, limit: number = 10) => {
		const receipts = await repository.receipts.get(page, limit);
		return receipts;
	},
	search: async (query: string, page: number = 1, limit: number = 10) => {
		const receipts = await repository.receipts.search(query, page, limit);
		return receipts;
	},
	create_and_connect: async (
		receipt: Omit<Receipt, "id" | "created_at" | "updated_at" | "customer_id">,
		customerId: number,
	) => {
		console.log(receipt, "receipt");
		const createdReceipt = await repository.receipts.create(receipt);
		if (customerId) {
			const connectedReceipt = await repository.receipts.connect(createdReceipt.id, customerId);
			return connectedReceipt;
		}
		return createdReceipt;
	},
	edit: async (id: number, receipt: Receipt) => {
		const updatedReceipt = await repository.receipts.edit(id, receipt);
		return updatedReceipt;
	},
};

export default receipts;
