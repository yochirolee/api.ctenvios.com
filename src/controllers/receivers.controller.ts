import { Request, Response } from "express";
import { z } from "zod";
import { Prisma, Receiver } from "@prisma/client";
import repository from "../repository";
import { receiverSchema } from "../types/types";

export const receivers = {
	get: async (req: Request, res: Response) => {
		const { page, limit } = req.query;
		const { rows, total } = await repository.receivers.get(
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
		const receiver = await repository.receivers.getByCi(ci);
		if (!receiver) {
			return res.status(404).json({ message: "Receiver not found", receiver: undefined });
		}
		const flat_receiver = {
			...receiver,
			province: receiver.province?.name,
			city: receiver.city?.name,
		};
		res.status(200).json(flat_receiver);
	},
	search: async (req: Request, res: Response) => {
		const { query, page, limit } = req.query;
		if (!query) {
			return res.status(400).json({ message: "Query is required" });
		}

		const data = await repository.receivers.search(
			req.query.query as string,
			parseInt(page as unknown as string) || 1,
			parseInt(limit as unknown as string) || 50,
		);
		res.status(200).json({
			rows: data as unknown as Receiver[],
			total: data.length,
		});
	},
	create: async (req: Request, res: Response) => {
		const { error } = receiverSchema.safeParse(req.body);
		console.log(req.body, "req.body");
		console.log(error, "error");
		if (error) {
			return res.status(400).json({ message: error.message });
		}
		const customer_id = parseInt(req.query.customerId as string);

		const receiver = await repository.receivers.create(req.body as Prisma.ReceiverCreateInput);
		

		if (customer_id && customer_id > 0) {
			await repository.receivers.connect(receiver.id, customer_id);
		}
		res.status(201).json(receiver);
	},

	edit: async (req: Request, res: Response) => {
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ message: "Customer ID is required" });
		}
		const { error } = receiverSchema.safeParse(req.body);
		if (error) {
			return res.status(400).json({ message: error.message });
		}
		const receiver = await repository.receivers.edit(parseInt(id), req.body);
		const flat_receiver = {
			...receiver,
			province: receiver.province?.name,
			city: receiver.city?.name,
		};
		res.status(200).json(flat_receiver);
	},
};

export default receivers;
