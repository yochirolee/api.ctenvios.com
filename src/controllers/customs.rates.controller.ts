import { Request, Response } from "express";
import repository from "../repository";

const customsRates = {
	get: async (req: Request, res: Response) => {
		const rates = await repository.customsRates.get();
		res.status(200).json(rates);
	},
	getById: async (req: Request, res: Response) => {
		const { id } = req.params;
		const rate = await repository.customsRates.getById(Number(id));
		res.status(200).json(rate);
	},
	create: async (req: Request, res: Response) => {
		const rate = await repository.customsRates.create(req.body);
		res.status(201).json(rate);
	},
	update: async (req: Request, res: Response) => {
		const { id } = req.params;
		const rate = await repository.customsRates.update(Number(id), req.body);
		res.status(200).json(rate);
	},
	delete: async (req: Request, res: Response) => {
		const { id } = req.params;
		const rate = await repository.customsRates.delete(Number(id));
		res.status(200).json(rate);
	},
};

export default customsRates;
