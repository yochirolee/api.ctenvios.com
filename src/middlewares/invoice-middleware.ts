// prisma/middleware/invoiceHistory.ts
// Usage: const extendedPrisma = prisma.$extends(createInvoiceHistoryExtension(userId, prisma));

import { PrismaClient } from "@prisma/client";

export function createInvoiceHistoryExtension(userId: string, prisma: PrismaClient) {
	return {
		query: {
			invoice: {
				async update({ args, query }: { args: any; query: any }) {
					const invoiceId = args.where.id;

					// Obtener estado anterior
					const previous = await prisma.invoice.findUnique({
						where: { id: invoiceId },
						include: { items: true },
					});

					const result = await query(args); // Ejecuta la actualización

					// Obtener nuevo estado
					const updated = await prisma.invoice.findUnique({
						where: { id: invoiceId },
						include: { items: true },
					});

					if (!previous || !updated) {
						return result;
					}

					const changes: any = {};

					// Campos directos en Invoice a comparar
					const fieldsToTrack = [
						"service_id",
						"customer_id",
						"receipt_id",
						"total_in_cents",
						"paid_in_cents",
						"payment_status",
						"status",
					];

					// Helper function to normalize values for comparison
					const normalizeValue = (value: any) => {
						if (value === null || value === undefined) return null;
						if (typeof value === "number") return value;
						if (typeof value === "string") return value.trim();
						return value;
					};

					for (const field of fieldsToTrack) {
						// Only compare fields that actually exist in the database
						if (!(field in previous) || !(field in updated)) {
							continue;
						}

						const prevValue = normalizeValue((previous as any)[field]);
						const currValue = normalizeValue((updated as any)[field]);

						// Only track actual changes, not null/undefined to null/undefined
						if (prevValue !== currValue) {
							changes[field] = { from: prevValue, to: currValue };
						}
					}

					// Procesar cambios en Items
					const prevItems = Object.fromEntries(previous.items.map((i: any) => [i.hbl, i]));
					const newItems = Object.fromEntries(updated.items.map((i: any) => [i.hbl, i]));

					const allHbls = new Set([...Object.keys(prevItems), ...Object.keys(newItems)]);

					const itemChanges = {
						modified: [] as any[],
						added: [] as any[],
						removed: [] as string[],
					};

					for (const hbl of allHbls) {
						const prev = prevItems[hbl];
						const curr = newItems[hbl];

						if (prev && !curr) {
							itemChanges.removed.push(hbl);
						} else if (!prev && curr) {
							itemChanges.added.push({ hbl, description: curr.description });
						} else {
							// Comparar campo por campo
							const itemDiff: any = { hbl, changes: {} };
							const itemFields = [
								"weight",
								"rate_in_cents",
								"quantity",
								"description",
								"volume",
								"customs_fee_in_cents",
							];

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

					if (
						itemChanges.modified.length > 0 ||
						itemChanges.added.length > 0 ||
						itemChanges.removed.length > 0
					) {
						changes.items = itemChanges;
					}

					// Filter out any changes where from === to (shouldn't happen with new logic, but safety net)
					const filteredChanges: any = {};
					for (const [key, value] of Object.entries(changes)) {
						if (key === "items") {
							// For items, keep if there are actual modifications/additions/removals
							const itemChanges = value as any;
							if (
								itemChanges.modified?.length > 0 ||
								itemChanges.added?.length > 0 ||
								itemChanges.removed?.length > 0
							) {
								filteredChanges[key] = value;
							}
						} else {
							// For direct fields, only keep if values are actually different
							const change = value as any;
							if (change.from !== change.to) {
								filteredChanges[key] = value;
							}
						}
					}

					// Only create history record if there are meaningful changes
					if (Object.keys(filteredChanges).length > 0) {
						await prisma.invoiceHistory.create({
							data: {
								invoice_id: invoiceId,
								user_id: userId,
								changed_fields: filteredChanges,
								comment: "Modificación detectada por middleware",
							},
						});
					}

					return result;
				},
			},
		},
	};
}
