"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = __importDefault(require("../controllers"));
const validate_middleware_1 = require("../middlewares/validate.middleware");
const zod_1 = require("zod");
const types_1 = require("../types/types");
const router = (0, express_1.Router)();
router.get("/", controllers_1.default.customsRates.get);
router.get("/search", controllers_1.default.customsRates.search);
router.get("/:id", controllers_1.default.customsRates.getById);
router.post("/", (0, validate_middleware_1.validate)({ body: types_1.customsRatesSchema }), controllers_1.default.customsRates.create);
router.put("/:id", (0, validate_middleware_1.validate)({ params: zod_1.z.object({ id: zod_1.z.coerce.number() }), body: types_1.customsRatesSchema }), controllers_1.default.customsRates.update);
router.delete("/:id", (0, validate_middleware_1.validate)({ params: zod_1.z.object({ id: zod_1.z.coerce.number() }) }), controllers_1.default.customsRates.delete);
exports.default = router;
