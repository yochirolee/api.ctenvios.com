"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CARD_PAYMENT_METHODS = exports.PAYMENT_CONFIG = void 0;
// Payment configuration constants
exports.PAYMENT_CONFIG = {
    CARD_PROCESSING_FEE_RATE: 0.03, // 3% fee for credit/debit cards
    MIN_PAYMENT_AMOUNT: 0.01,
    CENTS_MULTIPLIER: 100,
};
exports.CARD_PAYMENT_METHODS = ["CREDIT_CARD", "DEBIT_CARD"];
