import { Prisma } from "@prisma/client";
import { Request, Response, RequestHandler } from "express";
import AppError from "../utils/app.error";

import { customerSchema } from "../types/types";
import repository from "../repository";

export const customers = {
	get: (async (req: Request, res: Response) => {
		const { page, limit } = req.query;
		const customers = await repository.customers.get(
			parseInt(page as string) || 1,
			parseInt(limit as string) || 50,
		);
		res.status(200).json(customers);
	}) as RequestHandler,

	search: (async (req: Request, res: Response) => {
		if (!req.query.query) {
			throw new AppError("Query is required", 400);
		}
		const { page, limit } = req.query;

		const customers = await repository.customers.search(
			req.query.query as string,
			parseInt(page as string) || 1,
			parseInt(limit as string) || 50,
		);
		res.status(200).json(customers);
	}) as RequestHandler,

	create: (async (req: Request, res: Response) => {
		const { error } = customerSchema.safeParse(req.body);

		if (error) {
			throw new AppError("Invalid customer data", 400, error.flatten().fieldErrors, "zod");
		}

		const customer = await repository.customers.create(req.body as Prisma.CustomerCreateInput);
		res.status(201).json(customer);
	}) as RequestHandler,

	getById: (async (req: Request, res: Response) => {
		const { id } = req.params;
		if (!id) {
			throw new AppError("Customer ID is required", 400);
		}
		const customer = await repository.customers.getById(parseInt(id));
		res.status(200).json(customer);
	}) as RequestHandler,

	getReceipts: (async (req: Request, res: Response) => {
		const { id } = req.params;
		if (!id) {
			throw new AppError("Customer ID is required", 400);
		}
		const receipts = await repository.customers.getReceipts(parseInt(id));
		res.status(200).json(receipts);
	}) as RequestHandler,

	edit: (async (req: Request, res: Response) => {
		const { id } = req.params;
		if (!id) {
			throw new AppError("Customer ID is required", 400);
		}
		const { error } = customerSchema.safeParse(req.body);
		if (error) {
			throw new AppError("Invalid customer data", 400, error.flatten().fieldErrors, "zod");
		}
		const customer = await repository.customers.edit(parseInt(id), req.body);
		res.status(200).json(customer);
	}) as RequestHandler,
};

export default customers;
