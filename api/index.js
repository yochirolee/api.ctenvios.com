"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// api/index.ts
const app_1 = __importDefault(require("../src/app"));
// Vercel espera que exportes el handler de Express
// No uses app.listen() aquí
exports.default = app_1.default;
