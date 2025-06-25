// Importaciones necesarias
import { PrismaClient } from "@prisma/client";

// Crear una instancia de PrismaClient
const prisma = new PrismaClient();

// Función para obtener todas las agencias
async function getAgencies() {
	try {
		const agencies = await prisma.agency.findMany({
			include: {
				services: true,
				users: true,
			},
		});
		return agencies;
	} catch (error) {
		console.error("Error al obtener las agencias:", error);
		throw error;
	}
}

// Función para obtener todas las agencias
const result = getAgencies();
console.log(result);
