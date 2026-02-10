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
exports.generateDispatchDebts = exports.generateHierarchicalDebts = exports.determineHierarchyDebts = exports.getAgencyHierarchy = exports.clearPricingCache = exports.getPricingBetweenAgencies = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const client_1 = require("@prisma/client");
/**
 * Cache for pricing agreements to avoid repeated DB queries
 */
const pricingCache = new Map();
/**
 * Gets the pricing agreement price between sender and receiver agencies for a specific product/service
 * Uses cache to avoid repeated queries within the same request
 */
const getPricingBetweenAgencies = (seller_agency_id, buyer_agency_id, product_id, service_id) => __awaiter(void 0, void 0, void 0, function* () {
    const cacheKey = `${seller_agency_id}-${buyer_agency_id}-${product_id}-${service_id}`;
    if (pricingCache.has(cacheKey)) {
        return pricingCache.get(cacheKey) || null;
    }
    const agreement = yield prisma_client_1.default.pricingAgreement.findUnique({
        where: {
            seller_agency_id_buyer_agency_id_product_id_service_id: {
                seller_agency_id,
                buyer_agency_id,
                product_id,
                service_id,
            },
        },
        select: { price_in_cents: true },
    });
    if (agreement) {
        pricingCache.set(cacheKey, agreement.price_in_cents);
        return agreement.price_in_cents;
    }
    return null;
});
exports.getPricingBetweenAgencies = getPricingBetweenAgencies;
/**
 * Clears the pricing cache (call at end of transaction/request)
 */
const clearPricingCache = () => {
    pricingCache.clear();
};
exports.clearPricingCache = clearPricingCache;
/**
 * Obtiene la jerarquía completa de agencias (padre, abuelo, etc.)
 * Retorna array de IDs desde el padre directo hasta el ancestro más lejano
 */
const getAgencyHierarchy = (agencyId) => __awaiter(void 0, void 0, void 0, function* () {
    const hierarchy = [];
    let currentAgencyId = agencyId;
    while (currentAgencyId) {
        const agency = yield prisma_client_1.default.agency.findUnique({
            where: { id: currentAgencyId },
            select: { parent_agency_id: true },
        });
        if (agency && agency.parent_agency_id) {
            hierarchy.push(agency.parent_agency_id);
            currentAgencyId = agency.parent_agency_id;
        }
        else {
            break;
        }
    }
    return hierarchy;
});
exports.getAgencyHierarchy = getAgencyHierarchy;
/**
 * Verifica si un paquete tiene deudas PAGADAS hacia una agencia específica
 * Busca en todos los despachos anteriores del paquete
 */
const checkIfPaidToAgency = (parcel_id, agency_id) => __awaiter(void 0, void 0, void 0, function* () {
    // Buscar deudas pagadas donde:
    // 1. El paquete está en el despacho
    // 2. La deuda es hacia la agencia especificada
    // 3. La deuda está PAGADA
    const paidDebt = yield prisma_client_1.default.interAgencyDebt.findFirst({
        where: {
            dispatch: {
                parcels: {
                    some: { id: parcel_id },
                },
            },
            creditor_agency_id: agency_id,
            status: client_1.DebtStatus.PAID,
        },
    });
    return !!paidDebt;
});
/**
 * Determina las deudas jerárquicas considerando pagos previos
 * Si un paquete ya fue pagado al sender, el sender asume la responsabilidad
 */
const determineHierarchyDebts = (sender_agency_id, receiver_agency_id, parcels, dispatch_id) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const debts = [];
    const errors = [];
    // Agrupar paquetes por agencia original y verificar pagos
    const parcelsByAgency = new Map();
    for (const parcel of parcels) {
        // Validación: skip paquetes sin agency_id
        if (!parcel.agency_id) {
            errors.push(`Parcel ${parcel.id} has no agency_id`);
            continue;
        }
        // Validación: skip paquetes sin order_items
        if (!parcel.order_items || parcel.order_items.length === 0) {
            errors.push(`Parcel ${parcel.id} has no order_items`);
            continue;
        }
        // Calcular costo del paquete
        let parcelCost = 0;
        let hasValidPricing = false;
        for (const orderItem of parcel.order_items) {
            if (!((_a = orderItem.rate) === null || _a === void 0 ? void 0 : _a.pricing_agreement)) {
                continue;
            }
            hasValidPricing = true;
            const unit = orderItem.rate.product.unit;
            const priceInCents = orderItem.rate.pricing_agreement.price_in_cents;
            const itemWeight = Number(orderItem.weight);
            if (unit === "PER_LB") {
                parcelCost += Math.round(itemWeight * priceInCents);
            }
            else if (unit === "FIXED") {
                parcelCost += priceInCents;
            }
        }
        if (!hasValidPricing) {
            errors.push(`Parcel ${parcel.id} has no valid pricing agreement`);
            continue;
        }
        // Verificar si la agencia original ya pagó al sender
        const hasPaidToSender = yield checkIfPaidToAgency(parcel.id, sender_agency_id);
        const current = parcelsByAgency.get(parcel.agency_id) || {
            cost: 0,
            parcel_ids: [],
            has_paid_to_sender: false,
        };
        parcelsByAgency.set(parcel.agency_id, {
            cost: current.cost + parcelCost,
            parcel_ids: [...current.parcel_ids, parcel.id],
            has_paid_to_sender: hasPaidToSender || current.has_paid_to_sender,
        });
    }
    // Si hay errores críticos y no hay paquetes válidos, log warning pero no fallar
    // Esto permite despachos sin pricing configurado
    if (errors.length > 0) {
        console.warn(`[determineHierarchyDebts] Warnings for dispatch ${dispatch_id}:`, errors);
    }
    if (parcelsByAgency.size === 0) {
        console.warn(`[determineHierarchyDebts] No valid parcels with pricing for dispatch ${dispatch_id}`);
        return []; // Retornar vacío en lugar de fallar
    }
    // Calcular deudas
    for (const [original_agency_id, { cost, has_paid_to_sender }] of parcelsByAgency.entries()) {
        // Caso 1: Si la agencia original ya pagó al sender
        // El sender asume la responsabilidad → solo crear deuda sender → receiver
        if (has_paid_to_sender && original_agency_id !== sender_agency_id) {
            const senderHierarchy = yield (0, exports.getAgencyHierarchy)(sender_agency_id);
            if (senderHierarchy.includes(receiver_agency_id)) {
                const level = senderHierarchy.indexOf(receiver_agency_id) + 1;
                if (level === 1) {
                    debts.push({
                        original_sender_agency_id: sender_agency_id,
                        debtor_agency_id: sender_agency_id,
                        creditor_agency_id: receiver_agency_id,
                        relationship: "parent",
                        amount_in_cents: cost,
                    });
                }
                else if (level === 2) {
                    const parent_id = senderHierarchy[0];
                    debts.push({
                        original_sender_agency_id: sender_agency_id,
                        debtor_agency_id: sender_agency_id,
                        creditor_agency_id: parent_id,
                        relationship: "skipped_parent",
                        amount_in_cents: cost,
                    });
                    debts.push({
                        original_sender_agency_id: sender_agency_id,
                        debtor_agency_id: sender_agency_id,
                        creditor_agency_id: receiver_agency_id,
                        relationship: "grandparent",
                        amount_in_cents: cost,
                    });
                }
                else {
                    // Nivel 3+: solo deuda al receiver final
                    debts.push({
                        original_sender_agency_id: sender_agency_id,
                        debtor_agency_id: sender_agency_id,
                        creditor_agency_id: receiver_agency_id,
                        relationship: `ancestor_level_${level}`,
                        amount_in_cents: cost,
                    });
                }
            }
            continue; // No crear deuda de la agencia original
        }
        // Caso 2: La agencia original NO ha pagado al sender
        // Crear deuda normal de la agencia original al receiver
        if (original_agency_id === sender_agency_id && original_agency_id === receiver_agency_id) {
            continue; // Misma agencia enviando a sí misma
        }
        const originalHierarchy = yield (0, exports.getAgencyHierarchy)(original_agency_id);
        if (!originalHierarchy.includes(receiver_agency_id)) {
            // El receiver no está en la jerarquía de la agencia original
            errors.push(`Receiver agency ${receiver_agency_id} is not in hierarchy of original agency ${original_agency_id}`);
            continue;
        }
        const level = originalHierarchy.indexOf(receiver_agency_id) + 1;
        // Si el receiver es el padre directo
        if (level === 1) {
            debts.push({
                original_sender_agency_id: original_agency_id,
                debtor_agency_id: original_agency_id,
                creditor_agency_id: receiver_agency_id,
                relationship: "parent",
                amount_in_cents: cost,
            });
        }
        // Si el receiver es el abuelo (saltándose al padre)
        else if (level === 2) {
            const parent_id = originalHierarchy[0];
            // Deuda de la nieta al padre (por saltarse el nivel)
            debts.push({
                original_sender_agency_id: original_agency_id,
                debtor_agency_id: original_agency_id,
                creditor_agency_id: parent_id,
                relationship: "skipped_parent",
                amount_in_cents: cost,
            });
            // Deuda de la nieta a la abuela
            debts.push({
                original_sender_agency_id: original_agency_id,
                debtor_agency_id: original_agency_id,
                creditor_agency_id: receiver_agency_id,
                relationship: "grandparent",
                amount_in_cents: cost,
            });
        }
        // Si el receiver está más arriba (nivel 3+)
        else {
            // Solo crear deuda al receiver final
            debts.push({
                original_sender_agency_id: original_agency_id,
                debtor_agency_id: original_agency_id,
                creditor_agency_id: receiver_agency_id,
                relationship: `ancestor_level_${level}`,
                amount_in_cents: cost,
            });
        }
    }
    // Log warnings si hay errores no críticos
    if (errors.length > 0) {
        console.warn("Warnings while calculating hierarchy debts:", errors);
    }
    return debts;
});
exports.determineHierarchyDebts = determineHierarchyDebts;
/**
 * Generates hierarchical debts for reception without dispatch
 *
 * Includes ALL costs: transport + customs + insurance + delivery + charges
 *
 * When A (FORWARDER) receives from C (who is child of B):
 * - C owes B the TOTAL cost (parent relationship)
 * - B owes A the TOTAL cost (as intermediary responsible)
 *
 * When A receives from B (direct child):
 * - B owes A the TOTAL cost (direct)
 *
 * @param receiver_agency_id - Agency receiving the parcels (e.g., A)
 * @param parcels - Parcels being received with current_agency_id and order_items (including all fees)
 * @param dispatch_id - Dispatch ID for reference (logging)
 */
const generateHierarchicalDebts = (receiver_agency_id, parcels, dispatch_id) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const allDebts = [];
    const errors = [];
    // Group parcels by holder agency (current_agency_id, fallback to agency_id)
    const parcelsByHolder = new Map();
    for (const parcel of parcels) {
        const holder_agency_id = (_a = parcel.current_agency_id) !== null && _a !== void 0 ? _a : parcel.agency_id;
        if (!holder_agency_id) {
            errors.push(`Parcel ${parcel.id} has no current_agency_id or agency_id`);
            continue;
        }
        // Skip if holder is the same as receiver
        if (holder_agency_id === receiver_agency_id) {
            continue;
        }
        const parcelWeight = Number(parcel.weight);
        // Calculate TOTAL cost from order_items (price + customs + insurance + delivery + charges)
        let parcelTotalCost = 0;
        for (const item of parcel.order_items) {
            parcelTotalCost += item.price_in_cents || 0;
            parcelTotalCost += item.customs_fee_in_cents || 0;
            parcelTotalCost += item.insurance_fee_in_cents || 0;
            parcelTotalCost += item.delivery_fee_in_cents || 0;
            parcelTotalCost += item.charge_fee_in_cents || 0;
        }
        const current = parcelsByHolder.get(holder_agency_id) || {
            weight: 0,
            parcels_count: 0,
            total_cost_in_cents: 0,
            parcel_ids: [],
        };
        parcelsByHolder.set(holder_agency_id, {
            weight: current.weight + parcelWeight,
            parcels_count: current.parcels_count + 1,
            total_cost_in_cents: current.total_cost_in_cents + parcelTotalCost,
            parcel_ids: [...current.parcel_ids, parcel.id],
        });
    }
    if (parcelsByHolder.size === 0) {
        if (errors.length > 0) {
            console.warn(`[generateHierarchicalDebts] Warnings for dispatch ${dispatch_id}:`, errors);
        }
        return [];
    }
    // Process each holder group
    for (const [holder_agency_id, data] of parcelsByHolder.entries()) {
        // Get hierarchy from holder up to root
        // e.g., if holder = C and hierarchy is C → B → A
        // getAgencyHierarchy(C) returns [B, A]
        const hierarchy = yield (0, exports.getAgencyHierarchy)(holder_agency_id);
        // Find receiver's position in the hierarchy
        const receiverIndex = hierarchy.indexOf(receiver_agency_id);
        if (receiverIndex === -1) {
            // Receiver is not in holder's hierarchy
            // This could be a FORWARDER that's not a direct ancestor
            // Create single direct debt: holder → receiver with TOTAL cost
            if (data.total_cost_in_cents > 0) {
                allDebts.push({
                    debtor_agency_id: holder_agency_id,
                    creditor_agency_id: receiver_agency_id,
                    amount_in_cents: data.total_cost_in_cents,
                    weight_in_lbs: data.weight,
                    parcels_count: data.parcels_count,
                    relationship: "direct_to_forwarder",
                    original_holder_agency_id: holder_agency_id,
                });
            }
            continue;
        }
        // For hierarchical debts, each level owes the SAME total cost
        // This represents the full value being transferred up the chain
        // C → B (total), B → A (total)
        // Each agency in the chain is responsible for the full amount
        let currentDebtor = holder_agency_id;
        for (let i = 0; i <= receiverIndex; i++) {
            const creditor = hierarchy[i];
            const relationship = i === 0
                ? "parent"
                : i === receiverIndex
                    ? "final_receiver"
                    : `intermediate_level_${i + 1}`;
            if (data.total_cost_in_cents > 0) {
                allDebts.push({
                    debtor_agency_id: currentDebtor,
                    creditor_agency_id: creditor,
                    amount_in_cents: data.total_cost_in_cents,
                    weight_in_lbs: data.weight,
                    parcels_count: data.parcels_count,
                    relationship,
                    original_holder_agency_id: holder_agency_id,
                });
            }
            else {
                console.warn(`[generateHierarchicalDebts] No cost found: creditor=${creditor}, debtor=${currentDebtor}, weight=${data.weight}`);
            }
            // The next debtor is the current creditor
            currentDebtor = creditor;
        }
    }
    if (errors.length > 0) {
        console.warn(`[generateHierarchicalDebts] Warnings for dispatch ${dispatch_id}:`, errors);
    }
    return allDebts;
});
exports.generateHierarchicalDebts = generateHierarchicalDebts;
/**
 * Generates debts for dispatch reception based on current holder → receiver
 *
 * Includes ALL costs that the receiver (FORWARDER) covers:
 * - Transport cost (price × weight)
 * - Customs fees (aduanal)
 * - Insurance fees (seguro)
 * - Delivery fees
 * - Other charges
 *
 * Example: A receives from B (which includes parcels originally from C)
 * - Parcels with current_agency = B → B owes A the TOTAL cost of those parcels
 *
 * @param receiver_agency_id - Agency receiving the parcels
 * @param parcels - Parcels being received with current_agency_id and order_items (including all fees)
 * @param dispatch_id - Dispatch ID for reference
 */
const generateDispatchDebts = (receiver_agency_id, parcels, dispatch_id) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const debts = [];
    // Group parcels by holder agency (current_agency_id, fallback to agency_id)
    const parcelsByHolder = new Map();
    for (const parcel of parcels) {
        // Determine holder: use current_agency_id if set, otherwise fallback to agency_id
        const holder_agency_id = (_a = parcel.current_agency_id) !== null && _a !== void 0 ? _a : parcel.agency_id;
        if (!holder_agency_id) {
            console.warn(`[generateDispatchDebts] Parcel ${parcel.id} has no current_agency_id or agency_id`);
            continue;
        }
        // Skip if holder is the same as receiver (shouldn't happen)
        if (holder_agency_id === receiver_agency_id) {
            continue;
        }
        const parcelWeight = Number(parcel.weight);
        // Calculate TOTAL cost from order_items (price + customs + insurance + delivery + charges)
        let parcelTotalCost = 0;
        let product_id = null;
        let service_id = null;
        for (const item of parcel.order_items) {
            // Add transport price
            parcelTotalCost += item.price_in_cents || 0;
            // Add customs fee (aduanal)
            parcelTotalCost += item.customs_fee_in_cents || 0;
            // Add insurance fee (seguro)
            parcelTotalCost += item.insurance_fee_in_cents || 0;
            // Add delivery fee
            parcelTotalCost += item.delivery_fee_in_cents || 0;
            // Add other charges
            parcelTotalCost += item.charge_fee_in_cents || 0;
            if (item.rate && !product_id) {
                product_id = item.rate.product_id;
                service_id = item.rate.service_id;
            }
        }
        const current = parcelsByHolder.get(holder_agency_id) || {
            weight: 0,
            parcels_count: 0,
            total_cost_in_cents: 0,
            product_id: null,
            service_id: null,
        };
        parcelsByHolder.set(holder_agency_id, {
            weight: current.weight + parcelWeight,
            parcels_count: current.parcels_count + 1,
            total_cost_in_cents: current.total_cost_in_cents + parcelTotalCost,
            product_id: product_id || current.product_id,
            service_id: service_id || current.service_id,
        });
    }
    // Create debt for each holder using TOTAL cost (not just weight × price)
    for (const [holder_agency_id, data] of parcelsByHolder.entries()) {
        // Use the actual total cost from order_items
        const amount_in_cents = data.total_cost_in_cents;
        if (amount_in_cents > 0) {
            debts.push({
                debtor_agency_id: holder_agency_id,
                creditor_agency_id: receiver_agency_id,
                amount_in_cents,
                weight_in_lbs: data.weight,
                parcels_count: data.parcels_count,
                relationship: "dispatch_reception",
            });
        }
        else {
            console.warn(`[generateDispatchDebts] No cost found for parcels from holder ${holder_agency_id}. ` +
                `Weight: ${data.weight}lbs, Parcels: ${data.parcels_count}`);
        }
    }
    return debts;
});
exports.generateDispatchDebts = generateDispatchDebts;
