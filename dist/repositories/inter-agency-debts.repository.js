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
exports.interAgencyDebts = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const client_1 = require("@prisma/client");
exports.interAgencyDebts = {
    create: (data) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.interAgencyDebt.create({
            data,
            include: {
                debtor_agency: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                creditor_agency: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                original_sender_agency: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                dispatch: {
                    select: {
                        id: true,
                        status: true,
                        created_at: true,
                    },
                },
            },
        });
    }),
    createMany: (debts) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.interAgencyDebt.createMany({
            data: debts,
        });
    }),
    getByAgencies: (debtor_agency_id, creditor_agency_id, status) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.interAgencyDebt.findMany({
            where: Object.assign({ debtor_agency_id,
                creditor_agency_id }, (status && { status })),
            include: {
                dispatch: {
                    select: {
                        id: true,
                        created_at: true,
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
        });
    }),
    getTotalDebt: (debtor_agency_id, creditor_agency_id) => __awaiter(void 0, void 0, void 0, function* () {
        const debts = yield prisma_client_1.default.interAgencyDebt.aggregate({
            where: {
                debtor_agency_id,
                creditor_agency_id,
                status: client_1.DebtStatus.PENDING,
            },
            _sum: {
                amount_in_cents: true,
            },
        });
        return debts._sum.amount_in_cents || 0;
    }),
    getDebtsByDebtor: (debtor_agency_id, status) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.interAgencyDebt.findMany({
            where: Object.assign({ debtor_agency_id }, (status && { status })),
            include: {
                creditor_agency: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                dispatch: {
                    select: {
                        id: true,
                        created_at: true,
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
        });
    }),
    getDebtsByCreditor: (creditor_agency_id, status) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.interAgencyDebt.findMany({
            where: Object.assign({ creditor_agency_id }, (status && { status })),
            include: {
                debtor_agency: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                dispatch: {
                    select: {
                        id: true,
                        created_at: true,
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
        });
    }),
    markAsPaid: (id, paid_by_id, notes) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.interAgencyDebt.update({
            where: { id },
            data: {
                status: client_1.DebtStatus.PAID,
                paid_at: new Date(),
                paid_by_id,
                notes,
            },
        });
    }),
    getByDispatch: (dispatch_id) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.interAgencyDebt.findMany({
            where: { dispatch_id },
            include: {
                debtor_agency: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                creditor_agency: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                created_at: "asc",
            },
        });
    }),
    cancelByDispatch: (dispatch_id) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.interAgencyDebt.updateMany({
            where: {
                dispatch_id,
                status: client_1.DebtStatus.PENDING,
            },
            data: {
                status: client_1.DebtStatus.CANCELLED,
            },
        });
    }),
};
exports.default = exports.interAgencyDebts;
