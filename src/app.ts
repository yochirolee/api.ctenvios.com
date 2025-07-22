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
			"https://api-ctenvios-com.vercel.app/api/v1/",
			"https://dashboard-ctenvios-com-git-main-yoshos-projects.vercel.app/",
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
app.use(errorHandler);
app.use("/api/v1/", router);

//all other router redirect to api/v1

export default app;
