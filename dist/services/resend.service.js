"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resend = void 0;
const resend_1 = require("resend");
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY environment variable is required");
}
exports.resend = new resend_1.Resend(RESEND_API_KEY);
