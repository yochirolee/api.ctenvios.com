import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function generateHBLFast(agencyId: number, serviceId: number, cantidad: number): Promise<string[]> {
   const today = new Date();
   const todayOnlyDate = today.toISOString().slice(2, 10).replace(/-/g, "");

   // Una sola transaccion, sin retries
   const result = await prisma.$transaction(
      async (tx) => {
         const updatedCounter = await tx.counter.upsert({
            where: {
               date_agency_id: {
                  agency_id: agencyId,
                  date: todayOnlyDate,
               },
            },
            create: {
               agency_id: agencyId,
               date: todayOnlyDate,
               counter: cantidad,
            },
            update: {
               counter: { increment: cantidad },
            },
            select: { counter: true },
         });

         const newSequence = updatedCounter.counter;
         const start = newSequence - cantidad + 1;
         const fecha = todayOnlyDate;
         const agencia = agencyId.toString().padStart(2, "0");
         const servicio = serviceId.toString().padStart(1, "0");

         // Generacion inline (mas rapida que Array.from)
         const codigos: string[] = [];
         for (let i = 0; i < cantidad; i++) {
            const secuencia = (start + i).toString().padStart(4, "0");
            codigos.push(`CTE${fecha}${servicio}${agencia}${secuencia}`);
         }

         return codigos;
      },
      { timeout: 10000 }
   ); // Timeout mas corto

   return result;
}
