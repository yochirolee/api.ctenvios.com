import { Request, Response } from "express";
import { Receiver } from "@prisma/client";
import repository from "../repositories";
import { createReceiverSchema } from "../types/types";
import capitalize from "../utils/capitalize";

export const receivers = {
   get: async (req: Request, res: Response) => {
      const { page, limit } = req.query;
      const { rows, total } = await repository.receivers.get(
         parseInt(page as string) || 1,
         parseInt(limit as string) || 50
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
      const receiver = await repository.receivers.getByCi(ci as string);
      if (!receiver) {
         return res.status(404).json({ error: "Receiver not found" });
      }
      res.status(200).json(receiver);
   },
   search: async (req: Request, res: Response) => {
      const { query, page, limit } = req.query;
      if (!query) {
         return res.status(400).json({ error: "Query is required" });
      }

      const data = await repository.receivers.search(
         req.query.query as string,
         parseInt(page as unknown as string) || 1,
         parseInt(limit as unknown as string) || 50
      );
      res.status(200).json({
         rows: data as unknown as Receiver[],
         total: data.length,
      });
   },
   create: async (req: Request, res: Response) => {
      const { first_name, last_name, middle_name, second_last_name, mobile, ci, address, email, province_id, city_id } =
         req.body;
      const new_receiver = {
         ci: ci?.trim() || null,
         email: email?.trim() || null,
         first_name: capitalize(first_name.trim()),
         last_name: capitalize(last_name.trim()),
         middle_name: middle_name ? capitalize(middle_name.trim()) : null,
         second_last_name: second_last_name ? capitalize(second_last_name.trim()) : null,
         mobile: mobile.replace(/\s+/g, ""),
         address: address?.trim() || null,
         province_id: parseInt(province_id),
         city_id: parseInt(city_id),
      };
      const customer_id = parseInt(req.query.customerId as string);

      const receiver = await repository.receivers.create(new_receiver);

      if (customer_id && customer_id > 0) {
         await repository.receivers.connect(receiver.id, customer_id);
      }
      res.status(201).json(receiver);
   },

   edit: async (req: Request, res: Response) => {
      const { id } = req.params;
      if (!id) {
         return res.status(400).json({ error: "Receiver ID is required" });
      }
      const result = createReceiverSchema.safeParse(req.body);
      if (!result.success) {
         const errors = result.error.errors.map((err) => ({
            field: err.path.length > 0 ? err.path.join(".") : "root",
            message: err.message,
         }));
         return res.status(400).json({
            error: "Validation failed",
            source: "zod",
            errors,
         });
      }
      const receiver = await repository.receivers.edit(parseInt(id), req.body);

      res.status(200).json(receiver);
   },
};

export default receivers;
