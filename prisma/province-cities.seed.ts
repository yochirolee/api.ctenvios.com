import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const provinciasConCiudades = [
	{
		name: "Pinar del Río",
		cities: [
			"Pinar del Río",
			"Consolación del Sur",
			"Guane",
			"La Palma",
			"Los Palacios",
			"Mantua",
			"Minas de Matahambre",
			"San Juan y Martínez",
			"San Luis",
			"Sandino",
			"Viñales",
		],
	},
	{
		name: "Artemisa",
		cities: [
			"Alquízar",
			"Artemisa",
			"Bauta",
			"Caimito",
			"Candelaria",
			"Guanajay",
			"Güira de Melena",
			"Mariel",
			"San Antonio de los Baños",
			"San Cristóbal",
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
			"Plaza de la Revolución",
			"Regla",
			"San Miguel del Padrón",
		],
	},
	{
		name: "Mayabeque",
		cities: [
			"Batabanó",
			"Bejucal",
			"Güines",
			"Jaruco",
			"Madruga",
			"Melena del Sur",
			"Nueva Paz",
			"Quivicán",
			"San José de las Lajas",
			"San Nicolás",
		],
	},
	{
		name: "Matanzas",
		cities: [
			"Cárdenas",
			"Ciénaga de Zapata",
			"Colón",
			"Jagüey Grande",
			"Jovellanos",
			"Limonar",
			"Los Arabos",
			"Martí",
			"Matanzas",
			"Pedro Betancourt",
			"Perico",
			"Unión de Reyes",
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
			"Caibarién",
			"Camajuaní",
			"Cifuentes",
			"Corralillo",
			"Encrucijada",
			"Manicaragua",
			"Placetas",
			"Quemado de Güines",
			"Ranchuelo",
			"Remedios",
			"Sagua la Grande",
			"Santa Clara",
			"Santo Domingo",
		],
	},
	{
		name: "Sancti Spíritus",
		cities: [
			"Cabaiguán",
			"Fomento",
			"Jatibonico",
			"La Sierpe",
			"Sancti Spíritus",
			"Taguasco",
			"Trinidad",
			"Yaguajay",
		],
	},
	{
		name: "Ciego de Ávila",
		cities: [
			"Baraguá",
			"Bolivia",
			"Chambas",
			"Ciego de Ávila",
			"Ciro Redondo",
			"Florencia",
			"Majagua",
			"Morón",
			"Primero de Enero",
			"Venezuela",
		],
	},
	{
		name: "Camagüey",
		cities: [
			"Camagüey",
			"Carlos Manuel de Céspedes",
			"Esmeralda",
			"Florida",
			"Guaímaro",
			"Jimaguayú",
			"Minas",
			"Najasa",
			"Nuevitas",
			"Santa Cruz del Sur",
			"Sibanicú",
			"Sierra de Cubitas",
			"Vertientes",
		],
	},
	{
		name: "Las Tunas",
		cities: [
			"Amancio",
			"Colombia",
			"Jesús Menéndez",
			"Jobabo",
			"Las Tunas",
			"Majibacoa",
			"Manatí",
			"Puerto Padre",
		],
	},
	{
		name: "Holguín",
		cities: [
			"Antilla",
			"Báguanos",
			"Banes",
			"Cacocum",
			"Calixto García",
			"Cueto",
			"Frank País",
			"Gibara",
			"Holguín",
			"Mayarí",
			"Moa",
			"Rafael Freyre",
			"Sagua de Tánamo",
			"Urbano Noris",
		],
	},
	{
		name: "Granma",
		cities: [
			"Bartolomé Masó",
			"Bayamo",
			"Buey Arriba",
			"Campechuela",
			"Cauto Cristo",
			"Guisa",
			"Jiguaní",
			"Manzanillo",
			"Media Luna",
			"Niquero",
			"Pilón",
			"Río Cauto",
			"Yara",
		],
	},
	{
		name: "Santiago de Cuba",
		cities: [
			"Contramaestre",
			"Guamá",
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
		name: "Guantánamo",
		cities: [
			"Baracoa",
			"Caimanera",
			"El Salvador",
			"Guantánamo",
			"Imías",
			"Maisí",
			"Manuel Tames",
			"Niceto Pérez",
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
	for (const provincia of provinciasConCiudades) {
		const createdProvince = await prisma.province.create({
			data: {
				name: provincia.name,
				cities: {
					create: provincia.cities.map((name) => ({ name })),
				},
			},
		});
		console.log(`Provincia insertada: ${createdProvince.name}`);
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
