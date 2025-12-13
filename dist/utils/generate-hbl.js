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
exports.generateHBLFast = generateHBLFast;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
function generateHBLFast(agencyId, serviceId, cantidad) {
    return __awaiter(this, void 0, void 0, function* () {
        const today = new Date();
        const todayOnlyDate = today.toISOString().slice(2, 10).replace(/-/g, "");
        // Una sola transaccion, sin retries
        const result = yield prisma_client_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
            const updatedCounter = yield tx.counter.upsert({
                where: {
                    date_agency_id: {
                        agency_id: agencyId,
                        date: todayOnlyDate,
                    },
                },
                create: {
                    agency_id: agencyId,
                    date: todayOnlyDate,
                    counter: cantidad,
                },
                update: {
                    counter: { increment: cantidad },
                },
                select: { counter: true },
            });
            const newSequence = updatedCounter.counter;
            const start = newSequence - cantidad + 1;
            const fecha = todayOnlyDate;
            const agencia = agencyId.toString().padStart(2, "0");
            const servicio = serviceId.toString().padStart(1, "0");
            // Generacion inline (mas rapida que Array.from)
            const codigos = [];
            for (let i = 0; i < cantidad; i++) {
                const secuencia = (start + i).toString().padStart(4, "0");
                codigos.push(`CTE${fecha}${servicio}${agencia}${secuencia}`);
            }
            return codigos;
        }), {
            timeout: 20000, // 20 seconds to match Prisma client config
            maxWait: 10000, // 10 seconds to wait for transaction start (increased for stress tests)
        });
        return result;
    });
}
