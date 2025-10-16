import { betterAuth } from "better-auth";
import { admin, bearer } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { resend } from "../services/resend.service";

const prisma = new PrismaClient();

export const auth = betterAuth({
	plugins: [
		bearer(),
		admin({
			defaultRole: "USER",
			adminRoles: ["ROOT,ADMINISTRATOR"], // <-- plural & includes your admin role
			// adminUserIds: ["<optional-admin-user-id>"], // alternative way
		}),
	],
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),

	emailAndPassword: {
		enabled: true,
		sendResetPassword: async ({ user, url, token }, Request) => {
			await resend.emails.send({
				from: "soporte@ctenvios.com",
				to: user.email,
				subject: "Reset your password now!",
				html: `<strong>it Works</strong> ${url}/reset-password?token=${token}`,
			});
		},
		forgotPassword: {
			enabled: true,
		},
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
