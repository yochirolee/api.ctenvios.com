import { Request, Response } from "express";
import { z } from "zod";
import { Prisma, Receipt } from "@prisma/client";
import repository from "../repository";
import { receiptSchema } from "../types/types";

export const receipts = {
	get: async (req: Request, res: Response) => {
		const { page, limit } = req.query;
		const { rows, total } = await repository.receipts.get(
			parseInt(page as string) || 1,
			parseInt(limit as string) || 50,
		);
		const flat_rows = rows.map((row) => {
			return {
				...row,
				province: row.province?.name || "",
				city: row.city?.name || "",
			};
		});
		res.status(200).json({ rows: flat_rows, total });
	},
	getByCi: async (req: Request, res: Response) => {
		const { ci } = req.params;

		if (!ci) {
			return res.status(400).json({ message: "CI is required" });
		}
		const receipt = await repository.receipts.getByCi(ci);
		if (!receipt) {
			return res.status(404).json({ message: "Receipt not found", receipt: undefined });
		}
		const flat_receipt = {
			...receipt,
			province: receipt.province?.name || "",
			city: receipt.city?.name || "",
		};
		res.status(200).json(flat_receipt);
	},
	search: async (req: Request, res: Response) => {
		const { query, page, limit } = req.query;
		if (!query) {
			return res.status(400).json({ message: "Query is required" });
		}

		const data = await repository.receipts.search(
			req.query.query as string,
			parseInt(page as unknown as string) || 1,
			parseInt(limit as unknown as string) || 50,
		);
		res.status(200).json({
			rows: data as unknown as Receipt[],
			total: data.length,
		});
	},
	create: async (req: Request, res: Response) => {
		const { error } = receiptSchema.safeParse(req.body);
		if (error) {
			return res.status(400).json({ message: error.message });
		}
		const customer_id = parseInt(req.query.customerId as string);

		const receipt = await repository.receipts.create(req.body as Prisma.ReceiptCreateInput);

		if (customer_id) {
			await repository.receipts.connect(receipt.id, customer_id);
		}
		res.status(201).json(receipt);
	},

	edit: async (req: Request, res: Response) => {
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ message: "Customer ID is required" });
		}
		const { error } = receiptSchema.safeParse(req.body);
		if (error) {
			return res.status(400).json({ message: error.message });
		}
		const receipt = await repository.receipts.edit(parseInt(id), req.body);
		res.status(200).json(receipt);
	},
};

export default receipts;
