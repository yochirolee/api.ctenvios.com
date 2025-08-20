// Payment configuration constants
export const PAYMENT_CONFIG = {
	CARD_PROCESSING_FEE_RATE: 0.03, // 3% fee for credit/debit cards
	MIN_PAYMENT_AMOUNT: 0.01,
	CENTS_MULTIPLIER: 100,
} as const;

export const CARD_PAYMENT_METHODS = ["CREDIT_CARD", "DEBIT_CARD"] as const;

export type CardPaymentMethod = (typeof CARD_PAYMENT_METHODS)[number];
