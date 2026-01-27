import { Request, RequestHandler, Response } from "express";
import repository from "../repositories";
import { AppError } from "../common/app-errors";
import { Prisma, Customer, Roles } from "@prisma/client";
import capitalize from "../utils/capitalize";
import HttpStatusCodes from "../common/https-status-codes";

export const customers = {
   get: (async (req: any, res: Response) => {
      const user = req.user;
      const { page, limit } = req.query;

      // ROOT and ADMINISTRATOR can see all customers
      const allowedRoles = [Roles.ROOT, Roles.ADMINISTRATOR];
      const agency_id = allowedRoles.includes(user.role) ? null : user.agency_id;

      const { rows, total } = await repository.customers.get(
         agency_id,
         parseInt(page as string) || 1,
         parseInt(limit as string) || 50
      );
      res.status(200).json({ rows, total });
   }) as RequestHandler,

   search: (async (req: any, res: Response) => {
      if (!req.query.query) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Query is required");
      }
      const { page, limit } = req.query;

      console.log("page", page);

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
         throw new AppError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error creating customer");
      }
   }) as RequestHandler,

   getById: (async (req: Request, res: Response) => {
      const id = req.params.id as string;
      if (!id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Customer ID is required");
      }
      const customer = await repository.customers.getById(parseInt(id));
      res.status(200).json(customer);
   }) as RequestHandler,

   getReceivers: (async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const { page, limit } = req.query;
      if (!id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Customer ID is required");
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
      const id = req.params.id as string;
      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Customer ID is required");
      }
      const customer = await repository.customers.edit(parseInt(id), req.body);
      res.status(200).json(customer);
   }) as RequestHandler,
};

export default customers;
