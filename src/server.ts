import app from "./app";

const PORT = process.env.PORT || 3000;

// Solo se ejecuta en desarrollo local, NO en Vercel
if (process.env.NODE_ENV !== "production") {
   app.listen(PORT, () => {
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

export default app;
