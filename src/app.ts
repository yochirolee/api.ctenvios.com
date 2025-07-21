import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import router from "./routes/router";
import errorHandler from "./middlewares/errorHandler";
import morgan from "morgan";

import compression from "compression";

const app: Application = express();
// Mount BetterAuth handler BEFORE express.json() middleware

app.use(
	cors({
		origin: [
			"http://localhost:5173",
			"http://localhost:3000",
			"https://dashboard-ctenvios-com-g851.vercel.app",
			"https://dashboard-ctenvios-37jauqv6f-yoshos-projects.vercel.app",
			"https://dashboard-ctenvios",
		],

		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: false,
	}),
);

//middleware betterAuth

//app.use("/api/auth/{*any}", toNodeHandler(auth));
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));
app.use(compression());
app.use(express.urlencoded({ extended: true }));

// Root health check endpoint
app.get("/", (req, res) => {
	res.json({
		status: "ok",
		message: "CTEnvios Backend API",
		timestamp: new Date().toISOString(),
		endpoints: {
			api: "/api/v1",
			health: "/health",
		},
	});
});

// Health check endpoint
app.get("/health", (req, res) => {
	res.json({
		status: "healthy",
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
	});
});

app.use("/api/v1", router);

// Catch-all for undefined routes
app.use("*", (req, res) => {
	res.status(404).json({
		error: "Not Found",
		message: `Route ${req.originalUrl} not found`,
		availableEndpoints: ["/", "/health", "/api/v1"],
	});
});

app.use(errorHandler);

//all other router redirect to api/v1

export default app;
