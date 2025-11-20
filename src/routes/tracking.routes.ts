import { Request, Response, Router } from "express";
import prisma from "../lib/prisma.client";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
   const rows = await prisma.orderItem.findMany({
      select: {
         hbl: true,
         description: true,
         weight: true,
         status: true,
         created_at: true,
         updated_at: true,
         agency: {
            select: {
               name: true,
            },
         },
      },
      take: 25,
      skip: 0,
      orderBy: { created_at: "desc" },
   });
   const total = await prisma.orderItem.count();
   res.status(200).json({ rows, total });
});

export default router;
