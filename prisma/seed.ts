import { PrismaClient } from "@prisma/client";
import { Roles } from "@prisma/client";
import { auth } from "../src/lib/auth";

const prisma = new PrismaClient();

const provinciasConCiudades = [
	{
		name: "Pinar del Río",
		cities: [
			"Pinar del Rio",
			"Consolacion del Sur",
			"Guane",
			"La Palma",
			"Los Palacios",
			"Mantua",
			"Minas de Matahambre",
			"San Juan y Martinez",
			"San Luis",
			"Sandino",
			"Vinales",
		],
	},
	{
		name: "Artemisa",
		cities: [
			"Alquizar",
			"Artemisa",
			"Bauta",
			"Caimito",
			"Candelaria",
			"Guanajay",
			"Guira de Melena",
			"Mariel",
			"San Antonio de los Baños",
			"San Cristobal",
		],
	},
	{
		name: "La Habana",
		cities: [
			"Arroyo Naranjo",
			"Boyeros",
			"Centro Habana",
			"Cerro",
			"Cotorro",
			"Diez de Octubre",
			"Guanabacoa",
			"Habana del Este",
			"Habana Vieja",
			"La Lisa",
			"Marianao",
			"Playa",
			"Plaza de la Revolucion",
			"Regla",
			"San Miguel del Padron",
		],
	},
	{
		name: "Mayabeque",
		cities: [
			"Batabano",
			"Bejucal",
			"Guines",
			"Jaruco",
			"Madruga",
			"Melena del Sur",
			"Nueva Paz",
			"Quivican",
			"San Jose de las Lajas",
			"San Nicolas",
		],
	},
	{
		name: "Matanzas",
		cities: [
			"Cardenas",
			"Cienaga de Zapata",
			"Colon",
			"Jaguey Grande",
			"Jovellanos",
			"Limonar",
			"Los Arabos",
			"Marti",
			"Matanzas",
			"Pedro Betancourt",
			"Perico",
			"Union de Reyes",
		],
	},
	{
		name: "Cienfuegos",
		cities: [
			"Abreus",
			"Aguada de Pasajeros",
			"Cienfuegos",
			"Cruces",
			"Cumanayagua",
			"Lajas",
			"Palmira",
			"Rodas",
		],
	},
	{
		name: "Villa Clara",
		cities: [
			"Caibarien",
			"Camajuani",
			"Cifuentes",
			"Corralillo",
			"Encrucijada",
			"Manicaragua",
			"Placetas",
			"Quemado de Guines",
			"Ranchuelo",
			"Remedios",
			"Sagua la Grande",
			"Santa Clara",
			"Santo Domingo",
		],
	},
	{
		name: "Sancti Spiritus",
		cities: [
			"Cabaiguan",
			"Fomento",
			"Jatibonico",
			"La Sierpe",
			"Sancti Spiritus",
			"Taguasco",
			"Trinidad",
			"Yaguajay",
		],
	},
	{
		name: "Ciego de Avila",
		cities: [
			"Baragua",
			"Bolivia",
			"Chambas",
			"Ciego de Avila",
			"Ciro Redondo",
			"Florencia",
			"Majagua",
			"Moron",
			"Primero de Enero",
			"Venezuela",
		],
	},
	{
		name: "Camaguey",
		cities: [
			"Camaguey",
			"Carlos Manuel de Cespedes",
			"Esmeralda",
			"Florida",
			"Guaímaro",
			"Jimaguayú",
			"Minas",
			"Najasa",
			"Nuevitas",
			"Santa Cruz del Sur",
			"Sibanicu",
			"Sierra de Cubitas",
			"Vertientes",
		],
	},
	{
		name: "Las Tunas",
		cities: [
			"Amancio",
			"Colombia",
			"Jesus Menendez",
			"Jobabo",
			"Las Tunas",
			"Majibacoa",
			"Manati",
			"Puerto Padre",
		],
	},
	{
		name: "Holguin",
		cities: [
			"Antilla",
			"Baguanos",
			"Banes",
			"Cacocum",
			"Calixto Garcia",
			"Cueto",
			"Frank Pais",
			"Gibara",
			"Holguin",
			"Mayari",
			"Moa",
			"Rafael Freyre",
			"Sagua de Tanamo",
			"Urbano Noris",
		],
	},
	{
		name: "Granma",
		cities: [
			"Bartolome Maso",
			"Bayamo",
			"Buey Arriba",
			"Campechuela",
			"Cauto Cristo",
			"Guisa",
			"Jiguani",
			"Manzanillo",
			"Media Luna",
			"Niquero",
			"Pilon",
			"Rio Cauto",
			"Yara",
		],
	},
	{
		name: "Santiago de Cuba",
		cities: [
			"Contramaestre",
			"Guama",
			"Mella",
			"Palma Soriano",
			"San Luis",
			"Santiago de Cuba",
			"Segundo Frente",
			"Songo-La Maya",
			"Tercer Frente",
		],
	},
	{
		name: "Guantanamo",
		cities: [
			"Baracoa",
			"Caimanera",
			"El Salvador",
			"Guantanamo",
			"Imías",
			"Maisí",
			"Manuel Tames",
			"Niceto Perez",
			"San Antonio del Sur",
			"Yateras",
		],
	},
	{
		name: "Isla de la Juventud",
		cities: ["Isla de la Juventud"],
	},
];

async function main() {
	// Create forwarder
	const forwarder = await prisma.forwarder.upsert({
		where: { id: 1 },
		update: {},
		create: {
			name: "Caribe Travel Express and Services Inc",
			address: "10230 NW 80th Ave, Miami, FL 33016",
			contact: "F Infanzon",
			phone: "3058513004",
			email: "gerente@ctenvios.com",
		},
	});

	console.log(`Forwarder created: ${forwarder.name}`);

	const cuba = await prisma.country.upsert({
		where: { id: 1 },
		update: {},
		create: {
			name: "Cuba",
			code: "CU",
		},
	});
	console.log(`Country created: ${cuba.name}`);

	const provider = await prisma.provider.upsert({
		where: { id: 1 },

		update: {},
		create: {
			name: "Transcargo",
			address: "Avenida del Puerto y Línea del Ferrocarril, Regla, La Habana.",
			contact: "Transcargo",
			phone: "5376980069",
			email: "atcliente2@transcargo.transnet.cu",
		},
	});

	console.log(`Provider created: ${provider.name}`);

	// Create services
	const maritimeService = await prisma.service.upsert({
		where: { id: 1 },

		update: {},
		create: {
			name: "Maritimo",
			service_type: "MARITIME",
			description: "Envios Marítimos",
			forwarder: { connect: { id: forwarder.id } },
			provider: { connect: { id: provider.id } },
		},
	});

	console.log(`Maritime service created: ${maritimeService.name}`);

	// Create Agencia Habana (padre)
	const CTEnvios = await prisma.agency.upsert({
		where: { id: 1 },
		create: {
			name: "CTEnvios",
			address: "10230 NW 80th Ave, Miami, FL 33016",
			contact: "F Infanzon",
			phone: "3058513004",
			email: "gerente@ctenvios.com",
			forwarder_id: forwarder.id,
		},
		update: {},
	});
	console.log(`Agency created: ${CTEnvios.name}`);

	for (const provincia of provinciasConCiudades) {
		const createdProvince = await prisma.province.create({
			data: {
				name: provincia.name,
				cities: {
					create: provincia.cities.map((name) => ({ name })),
				},
			},
		});
		console.log(`Province created: ${createdProvince.name}`);
	}
	const user = await auth.api.signUpEmail({
		body: {
			email: "yleecruz@gmail.com",
			password: "Audioslave*84",
			name: "Yochiro Lee Cruz",
			role: Roles.ROOT,
			agency_id: 1,
		},
	});

	console.log(`User created: ${user.user.name}`);
}

main()
	.catch((e) => console.error(e))
	.finally(() => prisma.$disconnect());
