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
const express_1 = require("express");
const auth_1 = require("../lib/auth");
const node_1 = require("better-auth/node");
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const client_1 = require("@prisma/client");
const resend_service_1 = require("../services/resend.service");
const router = (0, express_1.Router)();
router.get("/", auth_middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    //if user is root or administrator, return all users
    const { page = 1, limit = 25 } = req.query;
    if (user.role === client_1.Roles.ROOT || user.role === client_1.Roles.ADMINISTRATOR) {
        const [total, rows] = yield Promise.all([
            prisma_client_1.default.user.count(),
            prisma_client_1.default.user.findMany({
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                    agency: {
                        select: {
                            id: true,
                            name: true,
                            agency_type: true,
                        },
                    },
                },
                skip: (parseInt(page) - 1) * (parseInt(limit) || 25),
                take: parseInt(limit) || 25,
                orderBy: {
                    createdAt: "desc",
                },
            }),
        ]);
        res.status(200).json({ rows, total });
    }
    else {
        //return all users in the agency and children agencies
        const agency = yield prisma_client_1.default.agency.findUnique({
            where: {
                id: user.agency_id,
            },
        });
        const children = yield prisma_client_1.default.agency.findMany({
            where: {
                parent_agency_id: user.agency_id,
            },
        });
        const allAgencies = [agency, ...children];
        const total = yield prisma_client_1.default.user.count({
            where: {
                agency_id: user.agency_id,
            },
        });
        const rows = yield prisma_client_1.default.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                agency: {
                    select: {
                        id: true,
                        name: true,
                        agency_type: true,
                    },
                },
            },
            where: {
                agency_id: {
                    in: allAgencies.map((agency) => (agency === null || agency === void 0 ? void 0 : agency.id) || 0),
                },
            },
            skip: (parseInt(page) - 1) * (parseInt(limit) || 25),
            take: parseInt(limit) || 25,
        });
        res.status(200).json({ rows, total });
    }
}));
router.get("/search", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = req.query;
    const users = yield auth_1.auth.api.listUserAccounts({
        headers: (0, node_1.fromNodeHeaders)(req.headers),
    });
    res.status(200).json(users);
}));
router.post("/sign-up/email", auth_middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, agency_id, role, name } = req.body;
        console.log(req.body, "req.body");
        // Register user with external auth provider
        const response = yield auth_1.auth.api.signUpEmail({
            returnHeaders: true,
            body: {
                email,
                password,
                name,
            },
        });
        if (!response.token) {
            return res.status(400).json({ message: "User registration failed." });
        }
        // Update internal Prisma user record
        const updatedUser = yield prisma_client_1.default.user.update({
            where: { email },
            data: {
                agency_id,
                role,
            },
        });
        return res.status(200).json(updatedUser);
    }
    catch (error) {
        console.error("Error during sign-up:", error);
        return res.status(500).json({ message: "Internal error", error });
    }
}));
router.post("/sign-in/email", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }
    // signInEmail returns { token, user } when successful
    const response = yield auth_1.auth.api.signInEmail({
        body: { email, password },
        headers: (0, node_1.fromNodeHeaders)(req.headers),
    });
    if (!(response === null || response === void 0 ? void 0 : response.token)) {
        return res.status(401).json({ message: "Invalid email or password" });
    }
    // Use the token to get the full session
    const sessionHeaders = (0, node_1.fromNodeHeaders)(Object.assign(Object.assign({}, req.headers), { authorization: `Bearer ${response.token}` }));
    const session = yield auth_1.auth.api.getSession({
        headers: sessionHeaders,
    });
    if (!(session === null || session === void 0 ? void 0 : session.user)) {
        return res.status(401).json({ message: "Failed to retrieve user session" });
    }
    const agency = session.user.agency_id
        ? yield prisma_client_1.default.agency.findUnique({
            where: {
                id: session.user.agency_id,
            },
        })
        : null;
    res.status(200).json(Object.assign(Object.assign({}, session), { agency }));
}));
router.get("/get-session", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield auth_1.auth.api.getSession({
        headers: (0, node_1.fromNodeHeaders)(req.headers),
    });
    res.status(200).json(session);
}));
router.post("/forgot-password", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    const response = yield auth_1.auth.api.forgetPassword({
        headers: (0, node_1.fromNodeHeaders)(req.headers),
        body: { email },
    });
    res.status(200).json(response);
}));
router.post("/reset-password", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { password } = req.body;
    const resendResponse = yield resend_service_1.resend.emails.send({
        from: "soporte@api.ctenvios.com",
        to: "yleecruz@gmail.com",
        subject: "Reset your password now!",
        html: `<strong>it Works</strong> `,
    });
    console.log(resendResponse);
    if (resendResponse.error) {
        return res.status(500).json({ message: "Error sending email" });
    }
    const response = yield auth_1.auth.api.resetPassword({
        headers: (0, node_1.fromNodeHeaders)(req.headers),
        body: { newPassword: password },
    });
    res.status(200).json(response);
}));
router.post("/sign-out", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield auth_1.auth.api.signOut({
        headers: (0, node_1.fromNodeHeaders)(req.headers),
    });
    res.status(200).json(user);
}));
exports.default = router;
