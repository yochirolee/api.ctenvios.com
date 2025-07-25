import { Request, RequestHandler, Response } from "express";
import { customerSchema } from "../types/types";
import repository from "../repository";
import AppError from "../utils/app.error";
import { Prisma } from "@prisma/client";
import capitalize from "../utils/capitalize";

export const customers = {
	get: (async (req: Request, res: Response) => {
		const { page, limit } = req.query;
		const { rows, total } = await repository.customers.get(
			parseInt(page as string) || 1,
			parseInt(limit as string) || 50,
		);
		res.status(200).json({ rows, total });
	}) as RequestHandler,

	search: (async (req: Request, res: Response) => {
		if (!req.query.query) {
			throw new AppError("Query is required", 400);
		}
		const { page, limit } = req.query;

		const data = await repository.customers.search(
			req.query.query as string,
			parseInt(page as string) || 1,
			parseInt(limit as string) || 25,
		);
		res.status(200).json({
			rows: data as unknown as Customer[],
			total: data.length,
		});
	}) as RequestHandler,

	create: (async (req: Request, res: Response) => {
		const { error } = customerSchema.safeParse(req.body);
		if (error) {
			throw new AppError("Invalid customer data", 400, error.flatten().fieldErrors, "zod");
		}
		const {
			mobile,
			first_name,
			last_name,
			middle_name,
			second_last_name,
			address,
			identity_document,
			email,
		} = req.body;
		const new_customer = {
			identity_document: identity_document?.trim() || null,
			email: email?.trim() || null,
			first_name: capitalize(first_name.trim()),
			last_name: capitalize(last_name.trim()),
			middle_name: middle_name ? capitalize(middle_name.trim()) : null,
			second_last_name: second_last_name ? capitalize(second_last_name.trim()) : null,
			mobile: mobile.replace(/\s+/g, ""),
			address: address?.trim() || null,
		};

		const customer = await repository.customers.create(new_customer as Prisma.CustomerCreateInput);
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
		const { page, limit } = req.query;
		if (!id) {
			throw new AppError("Customer ID is required", 400);
		}
		const receipts = await repository.customers.getReceipts(
			parseInt(id),
			parseInt(page as string) || 1,
			parseInt(limit as string) || 25,
		);
		const flat_receipts = receipts.map((receipt) => {
			return {
				...receipt,
				province: receipt.province?.name || "",
				city: receipt.city?.name || "",
			};
		});
		res.status(200).json({ rows: flat_receipts, total: flat_receipts.length });
	}) as RequestHandler,

	edit: (async (req: Request, res: Response) => {
		const { id } = req.params;
		if (!id || isNaN(parseInt(id))) {
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
