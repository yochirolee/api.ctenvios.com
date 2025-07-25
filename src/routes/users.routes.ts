import { Router } from "express";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import express from "express";
import prisma from "../config/prisma_db";
import { authMiddleware } from "../middlewares/auth-midleware";
import jwt from "jsonwebtoken";

type Roles = "admin" | "user" | "agent" | string;

const router = Router();

router.get("/", async (req, res) => {
	const { page = 1, limit = 25 } = req.query;
	const total = await prisma.user.count();
	const rows = await prisma.user.findMany({
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
				},
			},
		},
		skip: (parseInt(page as string) - 1) * (parseInt(limit as string) || 25),
		take: parseInt(limit as string) || 25,
	});
	res.status(200).json({ rows, total });
});
router.get("/search", async (req, res) => {
	const { query } = req.query;
	console.log(query, "query");
	const users = await auth.api.listUserAccounts({
		headers: fromNodeHeaders(req.headers),
		query: {
			email: query,
			phone: query,
			firstName: query,
			lastName: query,
		},
	});
	res.status(200).json(users);
});

router.post("/sign-up/email", authMiddleware, async (req, res) => {
	try {
		const { email, password, agency_id, role, name } = req.body;
		console.log(req.body, "req.body");

		// Register user with external auth provider
		const response = await auth.api.signUpEmail({
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
		const updatedUser = await prisma.user.update({
			where: { email },
			data: {
				agency_id,
				role,
			},
		});

		return res.status(200).json(updatedUser);
	} catch (error) {
		console.error("Error during sign-up:", error);
		return res.status(500).json({ message: "Internal error", error });
	}
});

router.post("/sign-in/email", async (req, res) => {
	const { email, password } = req.body;
	console.log(req.headers, "headers");

	console.log({ email, password });

	try {
		const { token } = await auth.api.signInEmail({
			returnHeaders: true,
			body: { email, password },
			headers: fromNodeHeaders(req.headers),
		});

		// const { token } = user;

		// Use the token to get the session
		const sessionHeaders = new Headers();
		sessionHeaders.set("Authorization", `Bearer ${token}`);

		const session = await auth.api.getSession({
			headers: sessionHeaders,
		});

		res.status(200).json(session);
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: "Login failed" });
	}
});

router.get("/get-session", async (req, res) => {
	const session = await auth.api.getSession({
		headers: fromNodeHeaders(req.headers),
	});
	res.status(200).json(session);
});

router.post("/sign-out", async (req, res) => {
	const user = await auth.api.signOut({
		headers: fromNodeHeaders(req.headers),
	});
	
	res.status(200).json(user);
});

export default router;
