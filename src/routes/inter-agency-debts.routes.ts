import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import interAgencyDebtsController from "../controllers/inter-agency-debts.controller";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener mis deudas (donde soy deudor)
router.get("/my-debts", interAgencyDebtsController.getDebtsByDebtor);

// Obtener mis cuentas por cobrar (donde soy acreedor)
router.get("/my-receivables", interAgencyDebtsController.getDebtsByCreditor);

// Obtener deudas de un despacho específico
router.get("/dispatch/:id", interAgencyDebtsController.getDebtsByDispatch);

// Marcar deuda como pagada
router.post("/:id/mark-paid", interAgencyDebtsController.markDebtAsPaid);

export default router;

