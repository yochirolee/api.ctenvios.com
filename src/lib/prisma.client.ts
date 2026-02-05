import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
   // eslint-disable-next-line no-var
   var prisma: PrismaClient | undefined;
   // eslint-disable-next-line no-var
   var pgPool: Pool | undefined;
}

if (!process.env.DATABASE_URL) {
   throw new Error("DATABASE_URL environment variable is not set");
}

function makePool() {
   // Si puedes, usa connectionString directo (menos errores con password encoding)
   return new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 30, // 👈 30-40 local, 20-30 prod pequeño
      idleTimeoutMillis:  30000,
      connectionTimeoutMillis: 2000, // 👈 baja a 2s
   });
}

// ✅ Pool singleton
const pool = global.pgPool ?? makePool();
if (process.env.NODE_ENV !== "production") global.pgPool = pool;

const adapter = new PrismaPg(pool);

// ✅ Prisma singleton (ya lo tenías)
const prisma =
   global.prisma ??
   new PrismaClient({
      adapter,
      transactionOptions: {
         maxWait: 5000, // 👈 baja a 5s para no acumular cola
         timeout: 20000,
         isolationLevel: "ReadCommitted",
      },
      errorFormat: "pretty",
   });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export default prisma;
