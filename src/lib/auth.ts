import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
	plugins: [bearer()],
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),

	emailAndPassword: {
		enabled: true,
	},
	user: {
		additionalFields: {
			role: {
				type: "string",
				required: false,
				input: false,
			},
			agency_id: {
				type: "number",
				required: false,
				input: false,
			},
		},
	},
});
