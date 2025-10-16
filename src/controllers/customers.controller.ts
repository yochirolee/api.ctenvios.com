import { Request, RequestHandler, Response } from "express";
import repository from "../repositories";
import AppError from "../utils/app.error";
import { Prisma, Customer } from "@prisma/client";
import capitalize from "../utils/capitalize";

export const customers = {
   get: (async (req: Request, res: Response) => {
      const { page, limit } = req.query;
      const { rows, total } = await repository.customers.get(
         parseInt(page as string) || 1,
         parseInt(limit as string) || 50
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
         parseInt(limit as string) || 25
      );
      res.status(200).json({
         rows: data as unknown as Customer[],
         total: data.length,
      });
   }) as RequestHandler,

   create: (async (req: Request, res: Response) => {
      try {
         const { mobile, first_name, last_name, middle_name, second_last_name, address, identity_document, email } =
            req.body;
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
      } catch (error: any) {
         res.status(400).json({ error: "Error creating customer" });
      }
   }) as RequestHandler,

   getById: (async (req: Request, res: Response) => {
      const { id } = req.params;
      if (!id) {
         throw new AppError("Customer ID is required", 400);
      }
      const customer = await repository.customers.getById(parseInt(id));
      res.status(200).json(customer);
   }) as RequestHandler,

   getReceivers: (async (req: Request, res: Response) => {
      const { id } = req.params;
      const { page, limit } = req.query;
      if (!id) {
         throw new AppError("Customer ID is required", 400);
      }
      const receivers = await repository.customers.getReceivers(
         parseInt(id),
         parseInt(page as string) || 1,
         parseInt(limit as string) || 25
      );
      const flat_receivers = receivers.map((receiver) => {
         return {
            ...receiver,
            province: receiver.province?.name || "",
            city: receiver.city?.name || "",
         };
      });
      res.status(200).json({ rows: flat_receivers, total: flat_receivers.length });
   }) as RequestHandler,

   edit: (async (req: Request, res: Response) => {
      const { id } = req.params;
      if (!id || isNaN(parseInt(id))) {
         throw new AppError("Customer ID is required", 400);
      }
      const customer = await repository.customers.edit(parseInt(id), req.body);
      res.status(200).json(customer);
   }) as RequestHandler,
};

export default customers;
