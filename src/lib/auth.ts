import { betterAuth, z } from "better-auth";
import { admin, bearer } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { Roles } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
	plugins: [bearer()],
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),

	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		cookiePrefix: "ctenvios",
	},
	user: {
		additionalFields: {
			role: {
				type: "string",
				enum: Roles,
			},
			agency_id: {
				type: "number",
			},
		},
	},
});
