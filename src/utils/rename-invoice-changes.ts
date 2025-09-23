// utils/trackInvoiceChanges.ts

import { Invoice, Item, PrismaClient, PaymentStatus } from "@prisma/client";

export async function registerInvoiceChange(
	prisma: PrismaClient,
	previous: Invoice,
	updated: Invoice,
	userId: string,
	comment: string = "Cambio detectado manualmente",
) {
	const changes: any = {};
	const fieldsToTrack = [
		"service_id",
		"customer_id",
		"receipt_id",
		"total_amount",
		"paid_amount",
		"rate_id",
		"payment_status",
		"status",
	];

	const normalizeValue = (value: any) => {
		if (value === null || value === undefined) return null;
		if (typeof value === "number") return value;
		if (typeof value === "string") return value.trim();
		return value;
	};

	for (const field of fieldsToTrack) {
		if (!(field in previous) || !(field in updated)) continue;

		const prevValue = normalizeValue((previous as any)[field]);
		const currValue = normalizeValue((updated as any)[field]);

		if (prevValue !== currValue) {
			changes[field] = { from: prevValue, to: currValue };
		}
	}

	const filteredChanges: any = {};
	for (const [key, value] of Object.entries(changes)) {
		if (key === "items") {
			const itemChanges = value as any;
			if (
				itemChanges.modified?.length > 0 ||
				itemChanges.added?.length > 0 ||
				itemChanges.removed?.length > 0
			) {
				filteredChanges[key] = value;
			}
		} else {
			const change = value as any;
			if (change.from !== change.to) {
				filteredChanges[key] = value;
			}
		}
	}

	if (Object.keys(filteredChanges).length > 0) {
		await prisma.invoiceHistory.create({
			data: {
				invoice_id: previous.id,
				user_id: userId,
				changed_fields: filteredChanges,
				comment,
			},
		});
	}
}

/**
 * Legacy function - consider using calculate_subtotal from utils instead for proper rate type handling
 * This function assumes WEIGHT-based pricing and may not be accurate for FIXED rates
 */
export function calculateInvoiceTotal(items: Item[]) {
	const total = items.reduce((sum: number, item: Item) => {
		// Basic calculation: rate * quantity * weight + fees
		const baseAmount = (item.rate_in_cents || 0) * (item.quantity || 1) * (item.weight || 0);
		const fees =
			(item.customs_fee_in_cents || 0) +
			(item.insurance_fee_in_cents || 0) +
			(item.delivery_fee_in_cents || 0) +
			(item.charge_fee_in_cents || 0);
		return sum + baseAmount + fees;
	}, 0);
	return total;
}

export interface PaymentStatusResult {
	paymentStatus: PaymentStatus;
	warnings: string[];
}

/**
 * Calculates the appropriate payment status based on paid amount vs total amount
 * @param paidInCents - Amount already paid in cents
 * @param totalInCents - New total amount in cents
 * @returns PaymentStatusResult with status and any warnings
 */
export function calculatePaymentStatus(
	paidInCents: number,
	totalInCents: number,
): PaymentStatusResult {
	const warnings: string[] = [];
	let paymentStatus: PaymentStatus;

	if (paidInCents <= 0) {
		paymentStatus = PaymentStatus.PENDING;
	} else if (paidInCents >= totalInCents) {
		paymentStatus = PaymentStatus.PAID;
		if (paidInCents > totalInCents) {
			warnings.push(
				`Invoice has been overpaid. Paid: $${(paidInCents / 100).toFixed(2)}, Total: $${(
					totalInCents / 100
				).toFixed(2)}`,
			);
		}
	} else {
		paymentStatus = PaymentStatus.PARTIALLY_PAID;
	}

	return { paymentStatus, warnings };
}
