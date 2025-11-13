"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const better_auth_1 = require("better-auth");
const plugins_1 = require("better-auth/plugins");
const prisma_1 = require("better-auth/adapters/prisma");
const client_1 = require("@prisma/client");
const resend_service_1 = require("../services/resend.service");
const prisma = new client_1.PrismaClient();
exports.auth = (0, better_auth_1.betterAuth)({
    plugins: [
        (0, plugins_1.bearer)(),
        (0, plugins_1.admin)({
            defaultRole: "USER",
            adminRoles: ["ROOT,ADMINISTRATOR"], // <-- plural & includes your admin role
            // adminUserIds: ["<optional-admin-user-id>"], // alternative way
        }),
    ],
    database: (0, prisma_1.prismaAdapter)(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        sendResetPassword: (_a, Request_1) => __awaiter(void 0, [_a, Request_1], void 0, function* ({ user, url, token }, Request) {
            yield resend_service_1.resend.emails.send({
                from: "soporte@ctenvios.com",
                to: user.email,
                subject: "Reset your password now!",
                html: `<strong>it Works</strong> ${url}/reset-password?token=${token}`,
            });
        }),
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
