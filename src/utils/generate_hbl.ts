import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function generarTracking(
	agencyId: number,
	serviceId: number,
	cantidad = 1,
): Promise<string[]> {
	try {
		const today = new Date();
		const todayOnlyDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

		return await prisma.$transaction(async (tx) => {
			let updatedCounter;

			try {
				// Intenta actualizar el contador atómicamente
				updatedCounter = await tx.counter.update({
					where: {
						date_agency_id: {
							agency_id: agencyId,
							date: todayOnlyDate,
						},
					},
					data: {
						counter: {
							increment: cantidad,
						},
					},
					select: {
						counter: true,
					},
				});
			} catch (error) {
				// Si no existe, lo crea
				updatedCounter = await tx.counter.create({
					data: {
						agency_id: agencyId,
						date: todayOnlyDate,
						counter: cantidad,
					},
					select: {
						counter: true,
					},
				});
			}

			// Genera los códigos
			const newSequence = updatedCounter.counter;
			const start = newSequence - cantidad + 1;

			const fecha = today.toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD
			const agencia = agencyId.toString().padStart(2, "0");
			const servicio = serviceId.toString().padStart(1, "0");

			const codigos = Array.from({ length: cantidad }, (_, i) => {
				const secuencia = (start + i).toString().padStart(4, "0");
				return `CTE${fecha}${servicio}${agencia}${secuencia}`;
			});

			return codigos;
			//return `CTE${fecha}${servicio}${agencia}${secuencia}`;
		});
	} catch (error: any) {
		console.log(error.message);
		return [];
	}
}
