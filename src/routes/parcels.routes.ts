import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.client";
export const parcels_routes = Router();

parcels_routes.get("/", async (req: Request, res: Response) => {
   const { page = 1, limit = 25 } = req.query;
   const rows = await prisma.parcel.findMany({
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
   });
   const total = await prisma.parcel.count();
   res.status(200).json({ rows, total });
});
//get parcels by order id
parcels_routes.get("/order/:orderId", async (req: Request, res: Response) => {
   const { orderId } = req.params;
   const rows = await prisma.parcel.findMany({
      where: { order_id: parseInt(orderId as string) },
   });
   res.status(200).json({ rows });
});

export default parcels_routes;
