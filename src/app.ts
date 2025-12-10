import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import router from "./routes/router";
import { errorMiddleware } from "./middlewares/error.middleware";
import morgan from "morgan";
import compression from "compression";

const app: Application = express();

// CORS configuration - DEBE IR ANTES que otros middlewares
const corsOptions = {
   origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      const allowedOrigins = [
         "http://localhost:5173",
         "http://localhost:3000",
         "https://api-ctenvios-com.vercel.app",
         "https://dev.ctenvios.com",
         "https://systemcaribetravel.com/",
         "http://192.168.1.157",
      ];

      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
         callback(null, true);
      } else {
         callback(new Error("Not allowed by CORS"));
      }
   },
   methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
   allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
   exposedHeaders: ["Content-Length", "X-Request-Id"],
   credentials: true,
   preflightContinue: false,
   optionsSuccessStatus: 204, // Some legacy browsers choke on 204
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(
   helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
   })
);
app.use(morgan("dev"));
app.use(compression());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
   res.json({ status: "ok", message: "API is running", timestamp: new Date().toISOString() });
});

app.use("/api/v1/", router);

// Add error handler (MUST be last)
app.use(errorMiddleware);

export default app;
