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
const express_1 = require("express");
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const router = (0, express_1.Router)();
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const rows = yield prisma_client_1.default.orderItem.findMany({
        select: {
            hbl: true,
            description: true,
            weight: true,
            status: true,
            created_at: true,
            updated_at: true,
            agency: {
                select: {
                    name: true,
                },
            },
        },
        take: 25,
        skip: 0,
        orderBy: { created_at: "desc" },
    });
    const total = yield prisma_client_1.default.orderItem.count();
    res.status(200).json({ rows, total });
}));
exports.default = router;
