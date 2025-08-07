import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

interface HBLGenerationResult {
	success: boolean;
	hblCodes: string[];
	error?: string;
}

export async function generarTracking(
	agencyId: number,
	serviceId: number,
	cantidad = 1,
): Promise<string[]> {
	const maxRetries = 5;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		const result = await generateUniqueHBL(agencyId, serviceId, cantidad);

		if (result.success) {
			return result.hblCodes;
		}

		if (attempt === maxRetries) {
			console.error(`Failed to generate unique HBL after ${maxRetries} attempts:`, result.error);
			throw new Error(`Unable to generate unique HBL codes: ${result.error}`);
		}

		// Wait before retry with exponential backoff
		await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
	}

	return [];
}

async function generateUniqueHBL(
	agencyId: number,
	serviceId: number,
	cantidad: number,
): Promise<HBLGenerationResult> {
	try {
		const today = new Date();
		const todayOnlyDate = today.toISOString().slice(2, 10).replace(/-/g, "");

		return await prisma.$transaction(async (tx) => {
			// Intenta actualizar el contador atómicamente
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
					counter: {
						increment: cantidad,
					},
				},
				select: {
					counter: true,
				},
			});

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

			// Verificar que no existan HBL duplicados en la base de datos
			/* 	const existingHBLs = await tx.item.findMany({
				where: {
					hbl: {
						in: codigos,
					},
				},
				select: {
					hbl: true,
				},
			});

			if (existingHBLs.length > 0) {
				const duplicates = existingHBLs.map((item) => item.hbl);
				return {
					success: false,
					hblCodes: [],
					error: `Duplicate HBL codes found: ${duplicates.join(", ")}`,
				};
			} */

			return {
				success: true,
				hblCodes: codigos,
			};
		});
	} catch (error: any) {
		console.error("Error generating HBL:", error.message);
		return {
			success: false,
			hblCodes: [],
			error: error.message,
		};
	}
}


