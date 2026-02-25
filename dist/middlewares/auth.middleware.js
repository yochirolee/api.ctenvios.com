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
exports.requireRoles = exports.authMiddleware = void 0;
const node_1 = require("better-auth/node");
const auth_1 = require("../lib/auth");
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const authMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const session = yield auth_1.auth.api.getSession({
            headers: (0, node_1.fromNodeHeaders)(req.headers),
        });
        if (session && session.user) {
            // Asegurar que carrier_id y agency_id estén disponibles en el objeto user
            // Si no están en la sesión, obtenerlos de la base de datos
            if (session.user.id && (session.user.carrier_id === undefined || session.user.agency_id === undefined)) {
                const userFromDb = yield prisma_client_1.default.user.findUnique({
                    where: { id: session.user.id },
                    select: {
                        agency_id: true,
                        carrier_id: true,
                    },
                });
                if (userFromDb) {
                    req.user = Object.assign(Object.assign({}, session.user), { agency_id: (_b = (_a = session.user.agency_id) !== null && _a !== void 0 ? _a : userFromDb.agency_id) !== null && _b !== void 0 ? _b : null, carrier_id: (_d = (_c = session.user.carrier_id) !== null && _c !== void 0 ? _c : userFromDb.carrier_id) !== null && _d !== void 0 ? _d : null });
                }
                else {
                    req.user = session.user;
                }
            }
            else {
                req.user = session.user;
            }
            next();
        }
        else {
            res.status(401).json({ message: "Unauthorized" });
        }
    }
    catch (error) {
        console.error("Auth middleware error:", error);
        res.status(401).json({ message: "Unauthorized" });
    }
});
exports.authMiddleware = authMiddleware;
/**
 * Role-based authorization middleware factory
 * @param allowedRoles - Array of roles that are permitted to access the route
 * @returns Express middleware function
 */
const requireRoles = (allowedRoles) => {
    return (req, res, next) => {
        const user = req === null || req === void 0 ? void 0 : req.user;
        if (!user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        if (!allowedRoles.includes(user.role)) {
            res.status(403).json({
                message: `Access denied. You are not authorized to access this resource, if you think this is an error, please contact support.`,
            });
            return;
        }
        next();
    };
};
exports.requireRoles = requireRoles;
