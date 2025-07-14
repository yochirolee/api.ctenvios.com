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
	cookies: {
		secure: true,
		sameSite: "none",
		domain: "vercel.app",
		httpOnly: true,
	},

	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		cookiePrefix: "ctenvios",
		cookieDomain: "vercel.app",
		cookieSameSite: "none",
		cookieSecure: true,
		cookieHttpOnly: true,
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
