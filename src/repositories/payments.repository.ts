import { Prisma } from "@prisma/client";
import prisma from "../config/prisma_db";

const payments = {
   create: async (paymentData: Prisma.PaymentCreateInput) => {
      return await prisma.payment.create({ data: paymentData });
   },
};

export default payments;
