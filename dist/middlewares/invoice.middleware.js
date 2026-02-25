"use strict";
// prisma/middleware/invoiceHistory.ts
// Usage: const extendedPrisma = prisma.$extends(createInvoiceHistoryExtension(userId, prisma));
// Note: Despite the name, this tracks Order model updates (Invoice was renamed to Order)
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
exports.createInvoiceHistoryExtension = createInvoiceHistoryExtension;
const client_1 = require("@prisma/client");
function createInvoiceHistoryExtension(userId, prisma) {
    return {
        query: {
            order: {
                update(_a) {
                    return __awaiter(this, arguments, void 0, function* ({ args, query }) {
                        var _b, _c, _d;
                        const orderId = args.where.id;
                        // Obtener estado anterior
                        const previous = yield prisma.order.findUnique({
                            where: { id: orderId },
                            include: { order_items: true },
                        });
                        const result = yield query(args); // Ejecuta la actualización
                        // Obtener nuevo estado
                        const updated = yield prisma.order.findUnique({
                            where: { id: orderId },
                            include: { order_items: true },
                        });
                        if (!previous || !updated) {
                            return result;
                        }
                        const changes = {};
                        // Campos directos en Invoice a comparar
                        const fieldsToTrack = [
                            "service_id",
                            "customer_id",
                            "receiver_id", // Fixed: was receipt_id, should be receiver_id
                            "total_in_cents",
                            "paid_in_cents",
                            "payment_status",
                            "status",
                        ];
                        // Helper function to normalize values for comparison
                        const normalizeValue = (value) => {
                            if (value === null || value === undefined)
                                return null;
                            if (typeof value === "number")
                                return value;
                            if (typeof value === "string")
                                return value.trim();
                            return value;
                        };
                        for (const field of fieldsToTrack) {
                            // Only compare fields that actually exist in the database
                            if (!(field in previous) || !(field in updated)) {
                                continue;
                            }
                            const prevValue = normalizeValue(previous[field]);
                            const currValue = normalizeValue(updated[field]);
                            // Only track actual changes, not null/undefined to null/undefined
                            if (prevValue !== currValue) {
                                changes[field] = { from: prevValue, to: currValue };
                            }
                        }
                        // Procesar cambios en Items
                        const prevItems = Object.fromEntries(previous.order_items.map((i) => [i.hbl, i]));
                        const newItems = Object.fromEntries(updated.order_items.map((i) => [i.hbl, i]));
                        const allHbls = new Set([...Object.keys(prevItems), ...Object.keys(newItems)]);
                        const itemChanges = {
                            modified: [],
                            added: [],
                            removed: [],
                        };
                        for (const hbl of allHbls) {
                            const prev = prevItems[hbl];
                            const curr = newItems[hbl];
                            if (prev && !curr) {
                                itemChanges.removed.push(hbl);
                            }
                            else if (!prev && curr) {
                                itemChanges.added.push({ hbl, description: curr.description });
                            }
                            else {
                                // Comparar campo por campo
                                const itemDiff = { hbl, changes: {} };
                                const itemFields = ["weight", "rate_in_cents", "quantity", "description"];
                                for (const field of itemFields) {
                                    const prevValue = normalizeValue(prev[field]);
                                    const currValue = normalizeValue(curr[field]);
                                    if (prevValue !== currValue) {
                                        itemDiff.changes[field] = {
                                            from: prevValue,
                                            to: currValue,
                                        };
                                    }
                                }
                                if (Object.keys(itemDiff.changes).length > 0) {
                                    itemChanges.modified.push(itemDiff);
                                }
                            }
                        }
                        if (itemChanges.modified.length > 0 || itemChanges.added.length > 0 || itemChanges.removed.length > 0) {
                            changes.items = itemChanges;
                        }
                        // Filter out any changes where from === to (shouldn't happen with new logic, but safety net)
                        const filteredChanges = {};
                        for (const [key, value] of Object.entries(changes)) {
                            if (key === "items") {
                                // For items, keep if there are actual modifications/additions/removals
                                const itemChanges = value;
                                if (((_b = itemChanges.modified) === null || _b === void 0 ? void 0 : _b.length) > 0 ||
                                    ((_c = itemChanges.added) === null || _c === void 0 ? void 0 : _c.length) > 0 ||
                                    ((_d = itemChanges.removed) === null || _d === void 0 ? void 0 : _d.length) > 0) {
                                    filteredChanges[key] = value;
                                }
                            }
                            else {
                                // For direct fields, only keep if values are actually different
                                const change = value;
                                if (change.from !== change.to) {
                                    filteredChanges[key] = value;
                                }
                            }
                        }
                        // Only create history record if there are meaningful changes
                        if (Object.keys(filteredChanges).length > 0) {
                            yield prisma.orderHistory.create({
                                data: {
                                    order_id: orderId,
                                    user_id: userId,
                                    changed_fields: filteredChanges,
                                    comment: "Modificación detectada por middleware",
                                    status: updated.status,
                                    type: client_1.OrderEventType.PRIVATE_TRACKING,
                                },
                            });
                        }
                        return result;
                    });
                },
            },
        },
    };
}
