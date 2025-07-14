import { Router } from "express";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import express from "express";
import prisma from "../config/prisma_db";
import { authMiddleware } from "../middlewares/auth-midleware";

const router = Router();

router.get("/", async (req, res) => {
	const { page, limit } = req.query;
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
	const { email, password, agency_id, role, name } = req.body;
	const user = await auth.api.signUpEmail({
		body: {
			email,
			password,
			name: name,
			role: role as Roles,
			agency_id,
		},
	});
	if (user) {
		await prisma.user.update({
			where: { id: user.user.id },
			data: { agency_id, role },
		});
	}

	res.status(200).json(user);
});

router.post("/sign-in/email", async (req, res) => {
	const { email, password } = req.body;

	try {
		const result = await auth.api.signInEmail({
			returnHeaders: true,
			body: { email, password },
		});

		// Set session cookie
		const headers = new Headers();
		if (result.headers.get("Set-Cookie")) {
			headers.set(
				"Set-Cookie",
				`${result.headers.get("Set-Cookie")}; HttpOnly; Path=/; Max-Age=604800`,
			);
		}

		res.set(Object.fromEntries(headers.entries()));
		res.json(result.response.user);
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: "Login failed" });
	}
});

router.get("/get-session", async (req, res) => {
	console.log(req.headers, "headers");
	const user = await auth.api.getSession({
		headers: fromNodeHeaders(req.headers),
	});
	console.log(user, "user");
	res.status(200).json(user);
});

router.post("/sign-out", async (req, res) => {
	const user = await auth.api.signOut({
		headers: fromNodeHeaders(req.headers),
	});
	res.status(200).json(user);
});

export default router;
