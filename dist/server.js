"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const PORT = process.env.PORT || 3000;
// Start server unless running on Vercel (which handles serverless)
// Docker deployments need the server to listen
const isVercel = process.env.VERCEL === "1";
if (!isVercel) {
    app_1.default.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
});
exports.default = app_1.default;
