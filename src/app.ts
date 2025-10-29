import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import router from "./routes/router";
import { errorMiddleware } from "./middlewares/error.middleware";
import morgan from "morgan";
import compression from "compression";

const app: Application = express();

app.use(
   cors({
      origin: [
         "http://localhost:5173",
         "http://localhost:3000",
         "https://api-ctenvios-com.vercel.app",
         "https://dev.ctenvios.com",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
      credentials: true,
   })
);

app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));
app.use(compression());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/", (req, res) => {
   res.json({ status: "ok", message: "API is running" });
});

app.use("/api/v1/", router);

// Add error handler (MUST be last)
app.use(errorMiddleware);

export default app;
