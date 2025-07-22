import app from "./app";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
	app.listen(PORT, () => {
		console.log(`Server is running on port ${PORT}`);
	});
};

process.on("unhandledRejection", (reason, promise) => {
	console.log("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
	console.log("Uncaught Exception:", error);
});

startServer();

export default app;
