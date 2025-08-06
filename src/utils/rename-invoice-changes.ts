// utils/trackInvoiceChanges.ts

import { Invoice, PrismaClient } from "@prisma/client";

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
