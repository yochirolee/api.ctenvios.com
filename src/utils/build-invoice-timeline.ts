import { Invoice, InvoiceHistory, Payment } from "@prisma/client";

export function buildInvoiceTimeline(
	invoice: Invoice & { payments: Payment[]; invoice_history: InvoiceHistory[] },
) {
	const events = [];

	// 1️⃣ Creación
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
				date: payment.payment_date,
				type: "PAYMENT",
				description: `Pagado $${(payment.amount / 100).toFixed(2)}  ${
					payment.payment_method
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
						statusText = "Envío despachado";
						break;
					case "DELIVERED":
						statusText = "Envío entregado";
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

	// 4️⃣ Detección automática de “Fully Paid”
	

	// 5️⃣ Ordenar cronológicamente
	events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	return events;
}
