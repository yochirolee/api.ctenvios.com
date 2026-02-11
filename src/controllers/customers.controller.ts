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
      const { mobile, first_name, last_name, middle_name, second_last_name, address, identity_document, email } =
         req.body;
      
      if (!first_name || !last_name || !mobile) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "first_name, last_name, and mobile are required");
      }
      
      const normalizedMobile = mobile.replace(/\s+/g, "");
      const normalizedFirstName = capitalize(first_name.trim());
      const normalizedLastName = capitalize(last_name.trim());

      // Check if customer already exists
      const existingCustomer = await repository.customers.getByMobileAndName(
         normalizedMobile,
         normalizedFirstName,
         normalizedLastName
      );

      if (existingCustomer) {
         // Return existing customer
         return res.status(200).json(existingCustomer);
      }

      const new_customer = {
         identity_document: identity_document?.trim() || null,
         email: email?.trim() || null,
         first_name: normalizedFirstName,
         last_name: normalizedLastName,
         middle_name: middle_name ? capitalize(middle_name.trim()) : null,
         second_last_name: second_last_name ? capitalize(second_last_name.trim()) : null,
         mobile: normalizedMobile,
         address: address?.trim() || null,
      };

      const customer = await repository.customers.create(new_customer as Prisma.CustomerCreateInput);
      res.status(201).json(customer);
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
      const body = req.body as Record<string, unknown>;
      const payload = { ...body };
      if (typeof body.first_name === "string") payload.first_name = capitalize(body.first_name.trim());
      if (typeof body.last_name === "string") payload.last_name = capitalize(body.last_name.trim());
      if (typeof body.middle_name === "string") payload.middle_name = capitalize(body.middle_name.trim());
      if (body.middle_name === null) payload.middle_name = null;
      if (typeof body.second_last_name === "string") payload.second_last_name = capitalize(body.second_last_name.trim());
      if (body.second_last_name === null) payload.second_last_name = null;
      const customer = await repository.customers.edit(parseInt(id), payload);
      res.status(200).json(customer);
   }) as RequestHandler,
};

export default customers;
