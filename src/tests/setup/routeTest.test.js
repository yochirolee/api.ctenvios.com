"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../../app");
/**
 * Simple test to verify route configuration
 */
describe("Route Configuration Test", () => {
    test("Should respond to API root endpoint", () => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield (0, supertest_1.default)(app_1.app).get("/api/v1/").expect(200);
        expect(response.text).toBe("Welcome to CTEnvios API V1");
    }));
    test("Should return 404 for non-existent routes", () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, supertest_1.default)(app_1.app).get("/api/nonexistent").expect(404);
    }));
    test("Invoice route should exist (POST)", () => __awaiter(void 0, void 0, void 0, function* () {
        // This should return validation error, not 404
        const response = yield (0, supertest_1.default)(app_1.app)
            .post("/api/v1/invoices")
            .send({})
            .expect((res) => {
            // Should not be 404 - route exists
            expect(res.status).not.toBe(404);
        });
    }));
});
