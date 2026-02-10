"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = __importDefault(require("../controllers"));
const validate_middleware_1 = require("../middlewares/validate.middleware");
const types_1 = require("../types/types");
const router = (0, express_1.Router)();
router.get("/", controllers_1.default.customers.get);
router.get("/search", controllers_1.default.customers.search);
router.post("/", (0, validate_middleware_1.validate)({ body: types_1.createCustomerSchema }), controllers_1.default.customers.create);
router.get("/:id", controllers_1.default.customers.getById);
router.get("/:id/receivers", controllers_1.default.customers.getReceivers);
router.put("/:id", controllers_1.default.customers.edit);
exports.default = router;
