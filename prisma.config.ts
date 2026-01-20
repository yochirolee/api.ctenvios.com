import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
   datasource: { url: env("DATABASE_URL") },
   schema: "./prisma/schema/", // Multi-file schema organizado por dominio
   migrations: {
      path: "./prisma/migrations",
      seed: "npx ts-node --compiler-options {\"module\":\"CommonJS\"} ./prisma/seeds/seed.ts",
   },
});
