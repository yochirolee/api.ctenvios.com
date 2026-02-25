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
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDispatchCost = void 0;
exports.calculateDispatchCostFromPdfLogic = calculateDispatchCostFromPdfLogic;
const client_1 = require("@prisma/client");
const agency_hierarchy_1 = require("./agency-hierarchy");
const utils_1 = require("./utils");
/**
 * Calculates dispatch cost using the same logic as the dispatch PDF:
 * - Inter-agency unit rate via getPricingBetweenAgencies(receiver, sender, product_id, service_id) or fallback to pricing_agreement
 * - Per item: calculate_row_subtotal(unitRate, weight, customs, charge, insurance, unit)
 * - Plus delivery once per order (sum of order_items.delivery_fee_in_cents per order)
 * Clears pricing cache after calculation.
 */
function calculateDispatchCostFromPdfLogic(parcels, sender_agency_id, receiver_agency_id) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
        let grandSubtotalInCents = 0;
        for (const parcel of parcels) {
            const items = (_a = parcel.order_items) !== null && _a !== void 0 ? _a : [];
            for (const item of items) {
                const product_id = (_c = (_b = item.rate) === null || _b === void 0 ? void 0 : _b.product) === null || _c === void 0 ? void 0 : _c.id;
                const service_id = (_g = (_f = (_e = (_d = item.rate) === null || _d === void 0 ? void 0 : _d.service) === null || _e === void 0 ? void 0 : _e.id) !== null && _f !== void 0 ? _f : item.service_id) !== null && _g !== void 0 ? _g : undefined;
                const unit = ((_l = (_h = item.unit) !== null && _h !== void 0 ? _h : (_k = (_j = item.rate) === null || _j === void 0 ? void 0 : _j.product) === null || _k === void 0 ? void 0 : _k.unit) !== null && _l !== void 0 ? _l : "PER_LB");
                const itemWeight = (0, utils_1.toNumber)(item.weight);
                let unitRateInCents = 0;
                if (receiver_agency_id && product_id && service_id) {
                    const agreementRate = yield (0, agency_hierarchy_1.getPricingBetweenAgencies)(receiver_agency_id, sender_agency_id, product_id, service_id);
                    if (agreementRate !== null) {
                        unitRateInCents = agreementRate;
                    }
                }
                if (unitRateInCents === 0 && ((_o = (_m = item.rate) === null || _m === void 0 ? void 0 : _m.pricing_agreement) === null || _o === void 0 ? void 0 : _o.price_in_cents)) {
                    unitRateInCents = item.rate.pricing_agreement.price_in_cents;
                }
                const itemCustoms = (_p = item.customs_fee_in_cents) !== null && _p !== void 0 ? _p : 0;
                const itemCharge = (_q = item.charge_fee_in_cents) !== null && _q !== void 0 ? _q : 0;
                const itemInsurance = (_r = item.insurance_fee_in_cents) !== null && _r !== void 0 ? _r : 0;
                const itemSubtotal = (0, utils_1.calculate_row_subtotal)(unitRateInCents, itemWeight, itemCustoms, itemCharge, itemInsurance, unit);
                grandSubtotalInCents += itemSubtotal;
            }
        }
        const deliverySummedForOrderId = new Set();
        let grandDeliveryInCents = 0;
        for (const parcel of parcels) {
            const orderId = (_u = (_s = parcel.order_id) !== null && _s !== void 0 ? _s : (_t = parcel.order) === null || _t === void 0 ? void 0 : _t.id) !== null && _u !== void 0 ? _u : null;
            if (orderId == null || deliverySummedForOrderId.has(orderId))
                continue;
            deliverySummedForOrderId.add(orderId);
            const orderItems = (_w = (_v = parcel.order) === null || _v === void 0 ? void 0 : _v.order_items) !== null && _w !== void 0 ? _w : [];
            for (const item of orderItems) {
                grandDeliveryInCents += (_x = item.delivery_fee_in_cents) !== null && _x !== void 0 ? _x : 0;
            }
        }
        (0, agency_hierarchy_1.clearPricingCache)();
        return grandSubtotalInCents + grandDeliveryInCents;
    });
}
/**
 * Calculates the total cost of a dispatch based on pricing agreements and product units (weight × rate only).
 * Prefer calculateDispatchCostFromPdfLogic for full PDF-aligned cost (rate + fees + delivery).
 * - For PER_LB units: weight * pricing_agreement.price_in_cents
 * - For FIXED units: pricing_agreement.price_in_cents
 */
const calculateDispatchCost = (dispatch) => {
    let totalCost = 0;
    for (const parcel of dispatch.parcels) {
        for (const orderItem of parcel.order_items) {
            const rate = orderItem.rate;
            if (!rate || !rate.product || !rate.pricing_agreement) {
                continue;
            }
            const unit = rate.product.unit;
            const priceInCents = rate.pricing_agreement.price_in_cents;
            if (unit === client_1.Unit.PER_LB) {
                const orderItemWeight = Number(orderItem.weight);
                totalCost += Math.round(orderItemWeight * priceInCents);
            }
            else if (unit === client_1.Unit.FIXED) {
                totalCost += priceInCents;
            }
        }
    }
    return totalCost;
};
exports.calculateDispatchCost = calculateDispatchCost;
