
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Create forwarder
  const forwarder = await prisma.forwarder.create({
    data: {
      name: "Caribe Travel Express and Services",
      address: "10230 NW 80th Ave, Miami, FL 33016",
      contact: "F Infanzon",
      phone: "3058513004",
      email: "frank30@gmail.com.com",
      created_at: new Date(),
      updated_at: new Date()
    }
  });

  // Create services
  const maritimeService = await prisma.service.create({
    data: {
      name: "Shipping Marítimo",
      service_type: "SHIPPING_MARITIME",
      description: "Servicio de envío por barco",
      forwarder: { connect: { id: forwarder.id } },
      provider: { connect: { id: 1 } }, // Asume provider existente con id 1
      created_at: new Date("2025-06-05T14:00:40.709177"),
      updated_at: new Date("2025-06-05T14:00:40.709177")
    }
  });

  const airService = await prisma.service.create({
    data: {
      name: "Shipping Aéreo",
      service_type: "SHIPPING_AIR",
      description: "Servicio de envío por avión",
      forwarder: { connect: { id: forwarder.id } },
      provider: { connect: { id: 1 } }, // Asume provider existente con id 1
      created_at: new Date("2025-06-05T14:00:40.709177"),
      updated_at: new Date("2025-06-05T14:00:40.709177")
    }
  });

  // Create Agencia Habana (padre)
  const CTEnvios = await prisma.agency.create({
    data: {
      name: "CTEnvios",
      address: "10230 NW 80th Ave, Miami, FL 33016",
      contact: "F Infanzon",
      phone: "3058513004",
      email: "gerente@ctenvios.com",
      forwarder_id: forwarder.id,
      created_at: new Date(),
      updated_at: new Date()
    }
  });

  // Create Agencia Santa Clara (hija)
  const agenciaSantaClara = await prisma.agency.create({
    data: {
      name: "Agencia Santa Clara",
      address: "Santa Clara",
      contact: "Ana Pérez",
      phone: "555-9999",
      email: "sc@agencia.com",
      forwarder_id: forwarder.id,
      parent_agency_id: agenciaHabana.id,
      created_at: new Date("2025-06-05T14:00:40.709177"),
      updated_at: new Date("2025-06-05T14:00:40.709177")
    }
  });

  // Service rates: Forwarder → Agencia Habana
  await prisma.rates.createMany({
    data: [
      {
        service_id: maritimeService.id,
        agency_id: CTEnvios.id,
        forwarders_rate: 1.50,
        agency_rate: 1.70,
        public_rate: 1.90
      },
      {
        service_id: airService.id,
        agency_id: CTEnvios.id,
        forwarders_rate: 1.50,
        agency_rate: 1.70,
        public_rate: 1.90
      }
    ]
  });

  // Service rate: Agencia Habana → Agencia Santa Clara
  await prisma.rates.create({
    data: {
      service_id: maritimeService.id,
      agency_id: agenciaSantaClara.id,
      forwarders_rate: 1.5,
      agency_rate: 1.5,
      public_rate: 1.99
    }
  });

  console.log("Seed data created successfully.");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
