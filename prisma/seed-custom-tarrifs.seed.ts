// This file is used to seed the database with initial data.

//Categories and Chapters
import { FeeType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const customsTariffs = [
	{
		name: "Ventiladores",
		fee: 25,

		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 1 - APARATOS ELÉCTRICOS",
	},
	{
		name: "Aires acondicionados",
		fee: 60,

		max_quantity: 2,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 1 - APARATOS ELÉCTRICOS",
	},
	{
		name: "Calentadores eléctricos",
		fee: 40,

		max_quantity: 3,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 1 - APARATOS ELÉCTRICOS",
	},
	{
		name: "Lámparas y lámparas halógenas",
		fee: 30,

		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 1 - APARATOS ELÉCTRICOS",
	},
	{
		name: "Bombillos y focos LED",
		fee: 2,

		max_quantity: 20,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 1 - APARATOS ELÉCTRICOS",
	},
	{
		name: "Cables eléctricos",
		fee: 15,

		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 1 - APARATOS ELÉCTRICOS",
	},
	{
		name: "Interruptores y enchufes",
		fee: 5,
		max_quantity: 10,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 1 - APARATOS ELÉCTRICOS",
	},

	{
		name: "Cámaras fotográficas",
		fee: 60,
		max_quantity: 3,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 2 - APARATOS FOTOGRÁFICOS Y SIMILARES",
	},
	{
		name: "Cámaras de vídeo",
		fee: 100,
		max_quantity: 3,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 2 - APARATOS FOTOGRÁFICOS Y SIMILARES",
	},
	{
		name: "Proyectores (Data show) y similares",
		fee: 100,
		max_quantity: 3,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 2 - APARATOS FOTOGRÁFICOS Y SIMILARES",
	},
	{
		name: "Partes, piezas y accesorios fotográficos",
		fee: 100,
		max_quantity: 3,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 2 - APARATOS FOTOGRÁFICOS Y SIMILARES",
	},
	{
		name: "Papel fotográfico",
		fee: 3,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 2 - APARATOS FOTOGRÁFICOS Y SIMILARES",
	},
	{
		name: "Papel para impresos",
		fee: 15,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 2 - APARATOS FOTOGRÁFICOS Y SIMILARES",
	},

	{
		name: "Pinturas y barnices",
		fee: 4,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 3 - PINTURAS Y OTROS",
	},
	{
		name: "Diluentes",
		fee: 4,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 3 - PINTURAS Y OTROS",
	},
	{
		name: "Lámparas eléctricas",
		fee: 20,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 3 - PINTURAS Y OTROS",
	},
	{
		name: "Linternas",
		fee: 3,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 3 - PINTURAS Y OTROS",
	},
	{
		name: "Tanques de agua",
		fee: 60,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 3 - PINTURAS Y OTROS",
	},
	{
		name: "Mangueras",
		fee: 5,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 3 - PINTURAS Y OTROS",
	},
	{
		name: "Escaleras domésticas",
		fee: 30,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 3 - PINTURAS Y OTROS",
	},
	{
		name: "Alarmas contra intrusos",
		fee: 60,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 3 - PINTURAS Y OTROS",
	},

	{
		name: "Sillas",
		fee: 20,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 4 - MUEBLES Y OTROS",
	},
	{
		name: "Mesas",
		fee: 40,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 4 - MUEBLES Y OTROS",
	},
	{
		name: "Estanterías",
		fee: 50,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 4 - MUEBLES Y OTROS",
	},
	{
		name: "Armarios",
		fee: 60,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 4 - MUEBLES Y OTROS",
	},

	{
		name: "Camisas",
		fee: 10,
		max_quantity: 10,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 5 - ROPA Y CALZADO",
	},
	{
		name: "Pantalones",
		fee: 10,
		max_quantity: 10,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 5 - ROPA Y CALZADO",
	},
	{
		name: "Zapatos",
		fee: 15,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 5 - ROPA Y CALZADO",
	},
	{
		name: "Calzado deportivo",
		fee: 20,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 5 - ROPA Y CALZADO",
	},

	{
		name: "Alimentos procesados",
		fee: 10,
		fee_type: "WEIGHT",
		chapter: "CAPÍTULO 6 - ALIMENTOS Y OTROS",
	}, // por peso
	{
		name: "Bebidas alcohólicas",
		fee: 20,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 6 - ALIMENTOS Y OTROS",
	},
	{
		name: "Frutas y verduras",
		fee: 5,
		fee_type: "WEIGHT",
		chapter: "CAPÍTULO 6 - ALIMENTOS Y OTROS",
	},

	{
		name: "Computadoras portátiles",
		fee: 150,
		max_quantity: 3,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 7 - EQUIPOS DE COMPUTO",
	},
	{
		name: "Tablets",
		fee: 100,
		max_quantity: 3,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 7 - EQUIPOS DE COMPUTO",
	},
	{
		name: "Accesorios (mouse, teclado)",
		fee: 30,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 7 - EQUIPOS DE COMPUTO",
	},

	{
		name: "Ciclomotores eléctricos de hasta dos plazas",
		fee: 200,
		max_quantity: 2,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},

	{
		name: "Baterías de litio",
		fee: 60,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},
	{
		name: "Otras baterías",
		fee: 35,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},
	{
		name: "Carburador",
		fee: 40,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},
	{
		name: "Delco (distribuidor)",
		fee: 30,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},
	{
		name: "Guardafangos",
		fee: 40,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},
	{
		name: "Parabrisas",
		fee: 150,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},
	{
		name: "Neumáticos para autos ligeros",
		fee: 60,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},
	{
		name: "Neumáticos para autos pesados",
		fee: 100,
		max_quantity: 7,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},
	{
		name: "Neumáticos para motos o ciclomotores",
		fee: 35,
		max_quantity: 3,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},
	{
		name: "Cámaras para neumáticos de autos ligeros",
		fee: 10,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},
	{
		name: "Cámaras para neumáticos de autos pesados",
		fee: 30,
		max_quantity: 5,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 8 - ACCESORIOS Y REPUESTOS PARA VEHÍCULOS",
	},

	{
		name: "Misceláneas (ropa, calzado, alimentos, etc.)",
		fee: 10,
		fee_type: "WEIGHT",
		chapter: "CAPÍTULO 9 - MISCELEÁNEAS",
	},

	{
		name: "Televisores",
		fee: 100,
		max_quantity: 2,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 10 - ELECTRÓNICOS",
	},
	{
		name: "Reproductores de DVD",
		fee: 40,
		max_quantity: 3,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 10 - ELECTRÓNICOS",
	},
	{
		name: "Consolas de videojuegos",
		fee: 60,
		max_quantity: 2,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 10 - ELECTRÓNICOS",
	},

	{
		name: "Taladros eléctricos",
		fee: 50,
		max_quantity: 3,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 11 - HERRAMIENTAS",
	},
	{
		name: "Sierras eléctricas",
		fee: 60,
		max_quantity: 2,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 11 - HERRAMIENTAS",
	},
	{
		name: "Lijadoras",
		fee: 40,
		max_quantity: 3,
		fee_type: "UNIT",
		chapter: "CAPÍTULO 11 - HERRAMIENTAS",
	},
];

async function main() {
	const cuba = await prisma.country.upsert({
		where: { code: "CU" },
		update: {},
		create: { name: "Cuba", code: "CU" },
	});

	for (const tariff of customsTariffs) {
		const customTariff = await prisma.customsRates.create({
			data: { ...tariff, country_id: cuba.id, fee_type: tariff.fee_type as FeeType, fee: tariff.fee * 100 },
		});
		console.log(`Custom tariff created: ${customTariff.name}`);
	}
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
