"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const inter_agency_debts_controller_1 = __importDefault(require("../controllers/inter-agency-debts.controller"));
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authMiddleware);
// Obtener mis deudas (donde soy deudor)
router.get("/my-debts", inter_agency_debts_controller_1.default.getDebtsByDebtor);
// Obtener mis cuentas por cobrar (donde soy acreedor)
router.get("/my-receivables", inter_agency_debts_controller_1.default.getDebtsByCreditor);
// Obtener deudas de un despacho específico
router.get("/dispatch/:id", inter_agency_debts_controller_1.default.getDebtsByDispatch);
// Marcar deuda como pagada
router.post("/:id/mark-paid", inter_agency_debts_controller_1.default.markDebtAsPaid);
exports.default = router;
