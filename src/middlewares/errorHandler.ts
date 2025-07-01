import { Request, Response, NextFunction } from "express";
import AppError from "../utils/app.error";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
	console.error("Global Error:", err);

	// Default error response values
	let statusCode = 500;
	let message = "Internal Server Error";
	let details = null;
	let type = null;
	const stack = err.stack || null;

	// Handle specific error types
	if (err instanceof AppError) {
		statusCode = err.statusCode || 500;
		message = err.message || "Internal Server Error";
		details = err.details || null;
		type = err.type || null;
	} else if (err instanceof ZodError) {
		statusCode = 400;
		message = "Validation Error";
		details = err.flatten().fieldErrors || null;

		type = "zod";
	} else if (err instanceof Prisma.PrismaClientKnownRequestError) {
		switch (err.code) {
			case "P2002":
				statusCode = 400;
				message = "Duplicate entry";
				details = err.meta || null;
				type = "prisma";
				break;
			default:
				statusCode = 500;
				message = "Internal Server Error";
				details = null;
				type = "prisma";
		}
	}

	res.status(statusCode).json({
		status: "error",
		message,
		details,
		type,
		stack: process.env.NODE_ENV === "production" ? null : stack,
	});
};

export default errorHandler;
