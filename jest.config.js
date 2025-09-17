/** @type {import('jest').Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/src"],
	testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
	transform: {
		"^.+\\.ts$": "ts-jest",
	},
	collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/tests/**"],
	setupFilesAfterEnv: ["<rootDir>/src/tests/setup.ts"],
	testTimeout: 60000, // 60 seconds for stress tests
	maxWorkers: "50%", // Use half of available CPU cores
	// Enable concurrent testing
	maxConcurrency: 10,
};
