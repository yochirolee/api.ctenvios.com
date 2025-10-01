import { Invoice, InvoiceHistory, Payment } from "@prisma/client";

export function buildInvoiceTimeline(
	invoice: Invoice & { payments: Payment[]; invoice_history: InvoiceHistory[] },
) {
	const events = [];

	// 1️⃣ Creacion
	events.push({
		date: invoice.created_at,
		type: "CREATED",
		description: `Factura #${invoice.id} creada`,
	});

	// 2️⃣ Pagos
	if (invoice.payments?.length > 0) {
		invoice.payments.forEach((payment: Payment) => {
			events.push({
                id:payment.id,
				date: payment.date,
				type: "PAYMENT",
				description: `Pagado $${((payment.amount_in_cents + payment.charge_in_cents) / 100).toFixed(2)}  ${
					payment.method
				}`,
			});
		});
	}

	/* // 3️⃣ Cambios de historial
	if (invoice.invoice_history?.length > 0) {
		invoice.invoice_history.forEach((history) => {
			// Detectar cambios clave
			if (history.changed_fields && (history.changed_fields as any).status) {
				const newStatus = (history.changed_fields as any).status.to;
				let statusText = "";

				switch (newStatus) {
					case "CREATED":
						statusText = "Factura creada";
						break;
					case "PARTIALLY_PAID":
						statusText = "Factura parcialmente pagada";
						break;
					case "PAID":
						statusText = "Factura pagada en su totalidad";
						break;
					case "SHIPPED":
						statusText = "Envio despachado";
						break;
					case "DELIVERED":
						statusText = "Envio entregado";
						break;
					case "CANCELLED":
						statusText = "Factura cancelada";
						break;
					default:
						statusText = `Estado cambiado a ${newStatus}`;
				}

				events.push({
					date: history.created_at,
					type: "STATUS_CHANGE",
					description: `📌 ${statusText}`,
				});
			} else {
				events.push({
					date: history.created_at,
					type: "UPDATE",
					description: history.comment || "🔄 Cambios en la factura",
				});
			}
		});
	} */

	// 4️⃣ Deteccion automatica de “Fully Paid”
	

	// 5️⃣ Ordenar cronologicamente
	events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	return events;
}
