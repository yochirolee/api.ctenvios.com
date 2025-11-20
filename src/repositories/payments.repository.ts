import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.client";

const payments = {
   create: async (paymentData: Prisma.PaymentCreateInput) => {
      return await prisma.payment.create({ data: paymentData });
   },
};

export default payments;
