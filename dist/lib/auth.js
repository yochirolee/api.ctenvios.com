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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const better_auth_1 = require("better-auth");
const plugins_1 = require("better-auth/plugins");
const prisma_1 = require("better-auth/adapters/prisma");
const prisma_client_1 = __importDefault(require("./prisma.client"));
const resend_service_1 = require("../services/resend.service");
const FRONTEND_URL = "https://atlas.ctenvios.com";
exports.auth = (0, better_auth_1.betterAuth)({
    baseURL: FRONTEND_URL,
    plugins: [
        (0, plugins_1.bearer)(),
        (0, plugins_1.admin)({
            defaultRole: "USER",
            adminRoles: ["ROOT,ADMINISTRATOR"], // <-- plural & includes your admin role
            // adminUserIds: ["<optional-admin-user-id>"], // alternative way
        }),
    ],
    database: (0, prisma_1.prismaAdapter)(prisma_client_1.default, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        sendResetPassword: (_a, request_1) => __awaiter(void 0, [_a, request_1], void 0, function* ({ user, url, token }, request) {
            const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
            yield resend_service_1.resend.emails.send({
                from: "CTEnvios <soporte@ctenvios.com>",
                to: "yleecruz@gmail.com",
                subject: "Restablecer tu contraseña - CTEnvios",
                html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f7fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">CTEnvios</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: #1e3a5f; font-size: 22px; font-weight: 600;">Restablecer contraseña</h2>
              <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 15px; line-height: 1.6;">
                Hola${user.name ? ` <strong>${user.name}</strong>` : ""},
              </p>
              <p style="margin: 0 0 32px 0; color: #4a5568; font-size: 15px; line-height: 1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva contraseña.
              </p>
              
              <!-- Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 36px; border-radius: 8px; box-shadow: 0 4px 12px rgba(30, 58, 95, 0.3);">
                      Restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px 0; color: #718096; font-size: 13px; line-height: 1.6;">
                Este enlace expirará en 1 hora por seguridad.
              </p>
              <p style="margin: 0 0 24px 0; color: #718096; font-size: 13px; line-height: 1.6;">
                Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña permanecerá igual.
              </p>
              
              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
              
              <p style="margin: 0; color: #a0aec0; font-size: 12px; line-height: 1.5;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin: 8px 0 0 0; word-break: break-all;">
                <a href="${resetUrl}" style="color: #2d5a87; font-size: 12px; text-decoration: underline;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px;">
                © ${new Date().getFullYear()} CTEnvios. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
            `,
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
            carrier_id: {
                type: "number",
                required: false,
                input: false,
            },
        },
    },
});
