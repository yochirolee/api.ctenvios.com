import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import router from "./routes/router";
import errorHandler from "./middlewares/errorHandler";
import morgan from "morgan";
import { auth } from "./lib/auth";
import { toNodeHandler } from "better-auth/node";
import compression from "compression";

const app: Application = express();
// Mount BetterAuth handler BEFORE express.json() middleware

app.use(
	cors({
		origin: [
			"http://localhost:5173",
			"http://localhost:3000",
			"https://dashboard-ctenvios-com-g851.vercel.app",
		],

		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		credentials: true,
	}),
);
//middleware betterAuth

app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(errorHandler);
app.use("/api/auth/{*any}", toNodeHandler(auth));
app.use("/api/v1/", router);

//all other router redirect to api/v1

export default app;
