"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const router_1 = __importDefault(require("./routes/router"));
const error_middleware_1 = require("./middlewares/error.middleware");
const http_logger_middleware_1 = require("./middlewares/http-logger.middleware");
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const app = (0, express_1.default)();
// CORS configuration - DEBE IR ANTES que otros middlewares
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:3000",
            "https://api-ctenvios-com.vercel.app",
            "https://dev.ctenvios.com",
            "https://systemcaribetravel.com",
            "http://192.168.1.157",
            "https://atlas.ctenvios.com",
        ];
        // Allow requests with no origin (like mobile apps, Postman, etc.)
        if (!origin)
            return callback(null, true);
        // Normalize origin by removing trailing slash for comparison
        const normalizedOrigin = origin.replace(/\/$/, "");
        const normalizedAllowedOrigins = allowedOrigins.map((o) => o.replace(/\/$/, ""));
        if (normalizedAllowedOrigins.indexOf(normalizedOrigin) !== -1) {
            callback(null, true);
        }
        else {
            // Log rejected origin for debugging (only in development)
            if (process.env.NODE_ENV === "development") {
                console.warn(`[CORS] Rejected origin: ${origin}`);
                console.warn(`[CORS] Allowed origins:`, normalizedAllowedOrigins);
            }
            callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "electric-offset",
        "electric-handle",
        "electric-schema",
    ],
    exposedHeaders: ["Content-Length", "X-Request-Id", "electric-offset", "electric-handle", "electric-schema"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204, // Some legacy browsers choke on 204
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use((0, morgan_1.default)("dev"));
app.use((0, compression_1.default)());
app.use(express_1.default.urlencoded({ extended: true }));
// HTTP Logger - logs all requests to database
app.use(http_logger_middleware_1.httpLoggerMiddleware);
// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "API is running", timestamp: new Date().toISOString() });
});
app.use("/api/v1/", router_1.default);
// Add error handler (MUST be last)
app.use(error_middleware_1.errorMiddleware);
exports.default = app;
