import { AgencyType, PrismaClient, Roles } from "@prisma/client";
import { auth } from "../src/lib/auth";

const prisma = new PrismaClient();

const provinciasConCiudades = [
	{
		id: 1,
		name: "Pinar del Rio",
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
		id: 2,
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
			"San Antonio de los Banos",
			"San Cristobal",
			"Bahia Honda",
		],
	},
	{
		id: 3,
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
		id: 4,
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
			"Santa Cruz del Norte",
		],
	},
	{
		id: 5,
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
			"Calimete",
		],
	},
	{
		id: 6,
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
		id: 7,
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
		id: 8,
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
		id: 9,
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
		id: 10,
		name: "Camaguey",
		cities: [
			"Camaguey",
			"Carlos Manuel de Cespedes",
			"Esmeralda",
			"Florida",
			"Guaimaro",
			"Jimaguayu",
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
		id: 11,
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
		id: 12,
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
			"Velasco",
		],
	},
	{
		id: 13,
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
		id: 14,
		name: "Santiago de Cuba",
		cities: [
			"Contramaestre",
			"Guama",
			"Mella",
			"Palma Soriano",
			"San Luis",
			"Santiago de Cuba",
			"Segundo Frente",
			"Songo La Maya",
			"Tercer Frente",
		],
	},
	{
		id: 15,
		name: "Guantanamo",
		cities: [
			"Baracoa",
			"Caimanera",
			"El Salvador",
			"Guantanamo",
			"Imias",
			"Maisi",
			"Manuel Tames",
			"Niceto Perez",
			"San Antonio del Sur",
			"Yateras",
		],
	},
	{
		id: 16,
		name: "Isla de la Juventud",
		cities: ["Isla de la Juventud"],
	},
];

async function main(): Promise<void> {
	console.log("🚀 Starting database seed...");

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

	console.log(`✅ Forwarder created: ${forwarder.name}`);

	const cuba = await prisma.country.upsert({
		where: { id: 1 },
		update: {},
		create: {
			name: "Cuba",
			code: "CU",
		},
	});
	console.log(`✅ Country created: ${cuba.name}`);

	const provider = await prisma.provider.upsert({
		where: { id: 1 },
		update: {},
		create: {
			name: "Transcargo",
			address: "Avenida del Puerto y Linea del Ferrocarril, Regla, La Habana.",
			contact: "Transcargo",
			phone: "5376980069",
			email: "atcliente2@transcargo.transnet.cu",
		},
	});

	console.log(`✅ Provider created: ${provider.name}`);

	// Create services
	const maritimeService = await prisma.service.upsert({
		where: { id: 1 },
		update: {},
		create: {
			name: "Maritimo",
			service_type: "MARITIME",
			description: "Envios Maritimos",
			forwarder: { connect: { id: forwarder.id } },
			provider: { connect: { id: provider.id } },
		},
	});

	console.log(`✅ Maritime service created: ${maritimeService.name}`);

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
			agency_type: AgencyType.FORWARDER,
		},
		update: {},
	});
	console.log(`✅ Agency created: ${CTEnvios.name}`);

	console.log("🏝️ Creating provinces and cities...");
	for (const provincia of provinciasConCiudades) {
		// First, upsert the province
		const createdProvince = await prisma.province.upsert({
			where: { id: provincia.id },
			update: {
				name: provincia.name,
			},
			create: {
				name: provincia.name,
			},
		});

		// Then, create cities that don't exist for this province
		for (const cityName of provincia.cities) {
			const existingCity = await prisma.city.findFirst({
				where: {
					name: cityName,
					province_id: createdProvince.id,
				},
			});

			if (!existingCity) {
				await prisma.city.create({
					data: {
						name: cityName,
						province_id: createdProvince.id,
					},
				});
			}
		}

		console.log(`✅ Province created: ${createdProvince.name} (${provincia.cities.length} cities)`);
	}

	const session = await auth.api.signUpEmail({
		body: {
			email: "yleecruz@gmail.com",
			password: "Audioslave*84",
			name: "Yochiro Lee Cruz",
		},
	});
	console.log(session);

	// Update the user with role and agency_id
	/* await prisma.user.update({
		where: { id: session.user.id },
		data: {
			role: Roles.ROOT,
			agency_id: 1,
		},
	}); */

	console.log(`✅ User created:  with ROOT role`);
	console.log("🎉 Database seed completed successfully!");
}

main()
	.catch((e) => {
		console.error("❌ Error seeding database:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
