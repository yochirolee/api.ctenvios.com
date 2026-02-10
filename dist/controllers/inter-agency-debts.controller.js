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
exports.interAgencyDebtsController = void 0;
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const inter_agency_debts_repository_1 = __importDefault(require("../repositories/inter-agency-debts.repository"));
exports.interAgencyDebtsController = {
    // Obtener deudas donde mi agencia es deudora
    getDebtsByDebtor: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user || !user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated or no agency");
        }
        const status = req.query.status;
        const debts = yield inter_agency_debts_repository_1.default.getDebtsByDebtor(user.agency_id, status);
        // Agrupar por creditor y calcular totales
        const debtsByCreditor = new Map();
        for (const debt of debts) {
            const creditorId = debt.creditor_agency_id;
            if (!debtsByCreditor.has(creditorId)) {
                debtsByCreditor.set(creditorId, {
                    creditor: debt.creditor_agency,
                    total: 0,
                    debts: [],
                });
            }
            const creditorDebts = debtsByCreditor.get(creditorId);
            creditorDebts.total += debt.amount_in_cents;
            creditorDebts.debts.push(debt);
        }
        res.status(200).json({
            total_debt: Array.from(debtsByCreditor.values()).reduce((sum, d) => sum + d.total, 0),
            debts_by_creditor: Array.from(debtsByCreditor.values()),
        });
    }),
    // Obtener deudas donde mi agencia es acreedora
    getDebtsByCreditor: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user || !user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated or no agency");
        }
        const status = req.query.status;
        const debts = yield inter_agency_debts_repository_1.default.getDebtsByCreditor(user.agency_id, status);
        // Agrupar por debtor y calcular totales
        const debtsByDebtor = new Map();
        for (const debt of debts) {
            const debtorId = debt.debtor_agency_id;
            if (!debtsByDebtor.has(debtorId)) {
                debtsByDebtor.set(debtorId, {
                    debtor: debt.debtor_agency,
                    total: 0,
                    debts: [],
                });
            }
            const debtorDebts = debtsByDebtor.get(debtorId);
            debtorDebts.total += debt.amount_in_cents;
            debtorDebts.debts.push(debt);
        }
        res.status(200).json({
            total_receivable: Array.from(debtsByDebtor.values()).reduce((sum, d) => sum + d.total, 0),
            debts_by_debtor: Array.from(debtsByDebtor.values()),
        });
    }),
    // Obtener deudas de un despacho específico
    getDebtsByDispatch: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        if (isNaN(dispatchId)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid dispatch ID");
        }
        const debts = yield inter_agency_debts_repository_1.default.getByDispatch(dispatchId);
        res.status(200).json({
            dispatch_id: dispatchId,
            total_debts: debts.reduce((sum, d) => sum + d.amount_in_cents, 0),
            debts,
        });
    }),
    // Marcar deuda como pagada
    markDebtAsPaid: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const debtId = parseInt(req.params.id);
        if (isNaN(debtId)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid debt ID");
        }
        const { notes } = req.body;
        const updatedDebt = yield inter_agency_debts_repository_1.default.markAsPaid(debtId, user.id, notes);
        res.status(200).json({
            status: "success",
            data: updatedDebt,
        });
    }),
};
exports.default = exports.interAgencyDebtsController;
