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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
const electric_url = `https://api.ctenvios.com/v1/shape`;
router.get("/shape", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const searchParams = new URLSearchParams();
    // Forward all query parameters from the request
    Object.keys(req.query).forEach((key) => {
        const value = req.query[key];
        if (value !== undefined && value !== null) {
            searchParams.set(key, String(value));
        }
    });
    // Use query params from request or default to -1 for offset
    if (!req.query.offset) {
        searchParams.set(`offset`, "-1");
    }
    const url = new URL(electric_url);
    url.search = searchParams.toString();
    const response = yield fetch(url);
    // Forward ALL headers from Electric service response
    // This must be done before calling res.json() or res.send()
    response.headers.forEach((value, key) => {
        // Skip headers that Express manages automatically
        const lowerKey = key.toLowerCase();
        if (lowerKey !== "content-encoding" &&
            lowerKey !== "content-length" &&
            lowerKey !== "transfer-encoding" &&
            lowerKey !== "connection") {
            res.setHeader(key, value);
        }
    });
    // Forward status code
    res.status(response.status);
    const data = yield response.json();
    res.json(data);
}));
exports.default = router;
