import { Request, Response } from "express";
import repository from "../repository";

const provinces = {
	get: async (req: Request, res: Response) => {
		const provinces = await repository.provinces.get();
		res.status(200).json(provinces);
	},
};

export default provinces;
