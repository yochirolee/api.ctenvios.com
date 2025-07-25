import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { NextFunction, Request, Response } from "express";

export const authMiddleware = async (req: any, res: Response, next: NextFunction) => {
	try {
		const session = await auth.api.getSession({
			headers: fromNodeHeaders(req.headers),
		});
		if (session) {
			req.user = session.user;
			next();
		} else {
			res.status(401).json({ message: "Unauthorized - Invalid token" });
		}
	} catch (error) {
		console.error("Auth middleware error:", error);
		res.status(401).json({ message: "Unauthorized - Token verification failed" });
	}
};
