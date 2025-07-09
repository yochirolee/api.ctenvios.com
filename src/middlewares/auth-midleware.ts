import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { NextFunction, Request, Response } from "express";

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
	const session = await auth.api.getSession({
		headers: fromNodeHeaders(req.headers),
	});
	console.log("Auth Middleware");
	if (session) {
		next();
	} else {
		res.status(401).json({ message: "Unauthorized" });
	}
};
