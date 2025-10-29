import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import router from "./routes/router";
import { errorMiddleware } from "./middlewares/error.middleware";
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
         "https://dev.ctenvios.com",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
      credentials: true,
   })
);
//middleware betterAuth

//app.use("/api/auth/{*any}", toNodeHandler(auth));
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use("/api/v1/", router);
// Add error handler
app.use(errorMiddleware);

export default app;
