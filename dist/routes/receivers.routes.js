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
const utils_1 = require("../utils/utils");
const ciSchema = zod_1.z
    .object({
    ci: zod_1.z.string().length(11, "CI must be 11 characters long"),
})
    .refine((data) => (0, utils_1.isValidCubanCI)(data.ci), {
    message: "CI (Carnet de Identidad) format or check digit is invalid",
    path: ["ci"],
});
const router = (0, express_1.Router)();
router.get("/", controllers_1.default.receivers.get);
router.get("/search", controllers_1.default.receivers.search);
router.get("/ci/:ci", (0, validate_middleware_1.validate)({ params: ciSchema }), controllers_1.default.receivers.getByCi);
router.post("/", (0, validate_middleware_1.validate)({ body: types_1.createReceiverSchema }), controllers_1.default.receivers.create);
router.put("/:id", controllers_1.default.receivers.edit);
exports.default = router;
