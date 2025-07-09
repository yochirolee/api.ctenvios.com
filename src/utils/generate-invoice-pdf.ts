import PDFKit from "pdfkit";
import * as bwipjs from "bwip-js";
import * as fs from "fs";
import * as path from "path";
import { Invoice, Customer, Receipt, Agency, Service, Item } from "@prisma/client";

interface InvoiceWithRelations extends Omit<Invoice, "total"> {
	customer: Customer;
	receipt: Receipt & {
		province?: { name: string };
		city?: { name: string };
	};
	total: number;
	agency: Agency;
	service: Service;
	items: Item[];
}

export const generateInvoicePDF = (invoice: InvoiceWithRelations): Promise<PDFKit.PDFDocument> => {
	return new Promise(async (resolve, reject) => {
		try {
			const doc = new PDFKit({ margin: 10, size: "letter" });

			// Generate the clean modern invoice with proper pagination
			await generateCleanModernInvoiceWithPagination(doc, invoice);

			resolve(doc);
		} catch (error) {
			reject(error);
		}
	});
};

async function generateCleanModernInvoiceWithPagination(
	doc: PDFKit.PDFDocument,
	invoice: InvoiceWithRelations,
) {
	let currentPage = 1;

	// Generate first page header
	await generatePageHeader(doc, invoice, true);

	// Add footer to first page
	addFooterToPage(doc, invoice, currentPage);

	// Generate sender/recipient info (only on first page)
	generateSenderRecipientInfo(doc, invoice);

	// Generate items table with pagination
	const result = await generateItemsTableWithPagination(doc, invoice);
	const totalPages = result.totalPages;

	// Update page numbers on all pages now that we know the total
	updatePageNumbers(doc, totalPages);
}

async function generatePageHeader(
	doc: PDFKit.PDFDocument,
	invoice: InvoiceWithRelations,
	isFirstPage: boolean = false,
) {
	let currentY = 10;

	// Try to add logo first
	const logoPath = path.join(process.cwd(), "assets", "company-logo.png");
	if (fs.existsSync(logoPath)) {
		try {
			doc.image(logoPath, 35, currentY, { width: 60, height: 40 });
			currentY += 45; // Move down after logo
		} catch (error) {
			console.log("Company logo could not be loaded:", error);
		}
	}

	// Company name below logo
	doc
		.fillColor("#2D3748")
		.fontSize(12)
		.font("Helvetica-Bold")
		.text(invoice?.agency.name || "", 40, currentY);

	currentY += 16; // Space after company name

	// Company details below name
	doc
		.fillColor("#718096")
		.fontSize(9)
		.font("Helvetica")
		.text(`Address: ${invoice?.agency.address}`, 40, currentY);

	currentY += 12;

	doc.text(`Phone: ${invoice?.agency.phone}`, 40, currentY);

	// Invoice details (right side) - aligned to the right (reduced spacing)
	doc
		.fillColor("#2D3748")
		.fontSize(16)
		.font("Helvetica-Bold")
		.text(`Invoice ${invoice.id}`, 450, 25, { align: "right", width: 122 })
		.fontSize(12)
		.font("Helvetica")
		.text(`Items: ${invoice.items.length}`, 450, 42, { align: "right", width: 122 });

	// Date - aligned to the right, same style as phone/address (reduced spacing)
	const date = new Date(invoice.created_at);
	const formattedDate =
		date.toLocaleDateString("es-ES") +
		" " +
		date.toLocaleTimeString("es-ES", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});
	doc
		.fillColor("#718096")
		.fontSize(9)
		.font("Helvetica")
		.text(`Fecha: ${formattedDate}`, 450, 56, { align: "right", width: 122 });

	// Generate barcode for invoice number
	try {
		const barcodeBuffer = await bwipjs.toBuffer({
			bcid: "code128",
			text: String(invoice.id).padStart(6, "0"),
			scale: 3,
			height: 8,
			includetext: false,
			textxalign: "center",
		});

		// Add barcode to the right side
		doc.image(barcodeBuffer, 320, 25, { width: 80, height: 20 });

		// Invoice number below barcode
		doc
			.fillColor("#2D3748")
			.fontSize(8)
			.font("Helvetica")
			.text(String(invoice.id).padStart(6, ""), 320, 50, { align: "center", width: 80 });
	} catch (error) {
		console.log("Barcode generation failed:", error);
	}

	return isFirstPage ? 105 : 95; // Return Y position where content should start (reduced)
}

function generateSenderRecipientInfo(doc: PDFKit.PDFDocument, invoice: InvoiceWithRelations) {
	// Envía section - with field labels

	let currentY = 110;

	// Sender name
	const senderName = `${invoice.customer.first_name}  ${invoice.customer.last_name} ${
		invoice.customer.second_last_name || ""
	}`;
	doc.fillColor("#2D3748").fontSize(10).font("Helvetica-Bold").text(senderName, 40, currentY);
	currentY += 14;

	// Phone with label
	if (invoice.customer.mobile) {
		doc
			.fillColor("#718096")
			.fontSize(9)
			.font("Helvetica")
			.text("Tel: ", 40, currentY)
			.fillColor("#2D3748")
			.text(`${invoice.customer.mobile}`, 60, currentY);
		currentY += 14;
	}

	// Email with label (if available in customer data)
	if (invoice.customer.email) {
		doc
			.fillColor("#718096")
			.fontSize(9)
			.font("Helvetica")
			.text("Email: ", 40, currentY)
			.fillColor("#2D3748")
			.text(`${invoice.customer.email}`, 70, currentY);
		currentY += 14;
	}

	// Address with label (if available in customer data)
	if (invoice.customer.address) {
		doc.fillColor("#718096").fontSize(9).font("Helvetica").text("Dir: ", 40, currentY);

		doc.fillColor("#2D3748").text(`${invoice.customer.address}`, 60, currentY, {
			width: 200,
		});
	}

	// Recibe section - with labels

	let recipientY = 113;

	// Recipient name
	const recipientName = `${invoice.receipt.first_name} ${invoice.receipt.last_name} ${
		invoice.receipt.second_last_name || ""
	}`;
	doc.fillColor("#2D3748").fontSize(10).font("Helvetica-Bold").text(recipientName, 320, recipientY);
	recipientY += 14;
	if (invoice.receipt.ci) {
		doc.fillColor("#718096").fontSize(9).font("Helvetica").text("CI: ", 320, recipientY);
		doc.fillColor("#2D3748").text(`${invoice?.receipt?.ci}`, 340, recipientY, {
			width: 232,
		});
		recipientY += 14;
	}
	// Phone with label
	if (invoice.receipt.mobile) {
		doc
			.fillColor("#718096")
			.fontSize(9)
			.font("Helvetica")
			.text("Tel: ", 320, recipientY)
			.fillColor("#2D3748")
			.text(`${invoice.receipt.mobile}`, 340, recipientY);
		recipientY += 14;
	}

	// Address with label and province/city on same line
	const location = `${invoice.receipt.city?.name || ""} ${
		invoice.receipt.province?.name || ""
	}`.trim();

	const fullAddress = location
		? `${invoice.receipt.address}, ${location}`
		: invoice.receipt.address;

	doc.fillColor("#718096").fontSize(9).font("Helvetica").text("Dir: ", 320, recipientY);

	doc.fillColor("#2D3748").text(fullAddress, 340, recipientY, {
		width: 232,
	});
}

async function generateItemsTableWithPagination(
	doc: PDFKit.PDFDocument,
	invoice: InvoiceWithRelations,
) {
	const pageHeight = 792; // Letter size height
	const bottomMargin = 120; // Increased space for footer (was 30)
	let currentY = 200;
	let currentPage = 1;

	const addTableHeaders = (y: number) => {
		doc
			.fillColor("#2D3748")
			.fontSize(10)
			.font("Helvetica-Bold")
			.text("HBL", 50, y)
			.text("Descripción", 150, y)
			.text("Precio", 420, y, { width: 40, align: "right" })
			.text("Peso", 470, y, { width: 40, align: "right" })
			.text("Subtotal", 520, y, { width: 40, align: "right" });

		return y + 25;
	};

	const checkPageBreak = async (currentY: number, spaceNeeded: number = 25) => {
		if (currentY + spaceNeeded > pageHeight - bottomMargin) {
			doc.addPage();
			currentPage++;

			// Add footer to new page
			addFooterToPage(doc, invoice, currentPage);

			// Add header to new page
			await generatePageHeader(doc, invoice, false);

			// Add table headers
			return addTableHeaders(130);
		}
		return currentY;
	};

	// Add initial table headers
	currentY = addTableHeaders(currentY);

	// Generate table rows
	for (let index = 0; index < invoice.items.length; index++) {
		const item = invoice.items[index];

		// Check if we need a new page
		currentY = await checkPageBreak(currentY, 25);

		// Row border - only bottom border, no outer borders
		doc
			.strokeColor("#E2E8F0")
			.lineWidth(0.2)
			.moveTo(40, currentY + 25)
			.lineTo(572, currentY + 25)
			.stroke();

		// Row data
		doc
			.fillColor("#2D3748")
			.fontSize(9)
			.font("Helvetica")
			.text(item.hbl || `CTE${invoice.id}${String(index + 1).padStart(6, "0")}`, 50, currentY + 8, {
				width: 90,
			})
			.text(item.description, 150, currentY + 8, { width: 280 })
			.text(`$${item.rate.toFixed(2)}`, 420, currentY + 8, { width: 40, align: "right" })
			.text(`${item.weight.toFixed(2)}`, 470, currentY + 8, { width: 40, align: "right" })
			.text(`${(item.rate * item.weight + item.customs_fee).toFixed(2)}`, 520, currentY + 8, {
				width: 40,
				align: "right",
			});

		currentY += 25;
	}

	// Check if we need space for totals (reserve about 250 points)
	currentY = await checkPageBreak(currentY, 250);

	// Add spacing before totals
	currentY += 30;

	// Totals section
	const delivery = 0.0;
	const seguro = 0.0;
	const cargoExtra = 0.0;
	const cargoTarjeta = 0.0;
	const descuento = invoice.discount_value.toNumber();
	const pagado = 0.0;

	const total = invoice.total + delivery + seguro + cargoExtra + cargoTarjeta - descuento;
	const pendiente = total - pagado - cargoTarjeta;

	// Subtotal
	doc
		.fillColor("#718096")
		.fontSize(10)
		.font("Helvetica")
		.text("Subtotal:", 420, currentY)
		.fillColor("#2D3748")
		.text(`$${invoice.total.toFixed(2)}`, 520, currentY, { width: 50, align: "right" });

	currentY += 15;

	// Delivery
	doc
		.fillColor("#718096")
		.text("Delivery:", 420, currentY)
		.fillColor("#2D3748")
		.text(`$${delivery.toFixed(2)}`, 520, currentY, { width: 50, align: "right" });

	currentY += 15;

	// Seguro
	doc
		.fillColor("#718096")
		.text("Seguro:", 420, currentY)
		.fillColor("#2D3748")
		.text(`$${seguro.toFixed(2)}`, 520, currentY, { width: 50, align: "right" });

	currentY += 15;

	// Cargo Extra
	doc
		.fillColor("#718096")
		.text("Cargo Extra:", 420, currentY)
		.fillColor("#2D3748")
		.text(`$${cargoExtra.toFixed(2)}`, 520, currentY, { width: 50, align: "right" });

	currentY += 15;

	// Cargo Tarjeta
	doc
		.fillColor("#718096")
		.text("Cargo Tarjeta:", 420, currentY)
		.fillColor("#2D3748")
		.text(`$${cargoTarjeta.toFixed(2)}`, 520, currentY, { width: 50, align: "right" });

	currentY += 15;

	// Descuento
	doc
		.fillColor("#718096")
		.text("Descuento:", 420, currentY)
		.fillColor("#2D3748")
		.text(`-$${descuento.toFixed(2)}`, 520, currentY, { width: 50, align: "right" });

	// Total line separator
	currentY += 10;
	doc.strokeColor("#E2E8F0").lineWidth(1).moveTo(450, currentY).lineTo(572, currentY).stroke();

	// Total
	currentY += 12;
	doc
		.fillColor("#2D3748")
		.fontSize(12)
		.font("Helvetica-Bold")
		.text("TOTAL:", 420, currentY)
		.text(`$${invoice.total.toFixed(2)}`, 520, currentY, { width: 50, align: "right" });

	currentY += 15;

	// Pagado
	doc
		.fillColor("#718096")
		.fontSize(10)
		.font("Helvetica")
		.text("Pagado:", 420, currentY)
		.fillColor("#2D3748")
		.text(`$${(pagado + cargoTarjeta).toFixed(2)}`, 520, currentY, { width: 50, align: "right" });

	currentY += 15;

	// Pendiente de pago
	doc
		.fillColor(pendiente > 0 ? "#FF0000" : "#718096")
		.text("Pendiente de pago:", 420, currentY)
		.fillColor(pendiente > 0 ? "#FF0000" : "#2D3748")
		.text(`$${pendiente.toFixed(2)}`, 520, currentY, { width: 50, align: "right" });

	return { totalPages: currentPage, total };
}

function addFooterToPage(
	doc: PDFKit.PDFDocument,
	invoice: InvoiceWithRelations,
	currentPage: number,
	totalPages: number = 1,
) {
	// Position footer at the bottom of the page
	const footerY = 680; // Near bottom of page (792 - 112 = 680)

	// Tracking information (blue, bold, centered)
	doc
		.fillColor("#4682B4")
		.fontSize(10)
		.font("Helvetica-Bold")
		.text(`Tracking: https://ctenvios.com/tracking?search=${invoice.id}`, 40, footerY, {
			align: "center",
			width: 532,
		});

	// Legal disclaimer (gray, smaller font, justified)
	doc
		.fillColor("#808080")
		.fontSize(7)
		.font("Helvetica")
		.text(
			"Al realizar este envío, declaro que soy responsable de toda la información proporcionada y que el contenido enviado no infringe las leyes de los Estados Unidos ni las regulaciones aduanales de la República de Cuba. También declaro estar de acuerdo con los términos y condiciones de la empresa.",
			40,
			footerY + 15,
			{
				width: 532,
				align: "justify",
				lineGap: 1,
			},
		);

	// Terms link (underlined, centered)
	doc
		.fillColor("#000000")
		.fontSize(8)
		.font("Helvetica")
		.text(
			"Para términos y condiciones completos visite: https://ctenvios.com/terms",
			40,
			footerY + 35,
			{
				align: "center",
				width: 532,
				underline: true,
			},
		);

	// Page number (gray, right-aligned) - will be updated later
	doc
		.fillColor("#808080")
		.fontSize(8)
		.font("Helvetica")
		.text(`Página ${currentPage} de ${totalPages}`, 40, footerY + 50, {
			align: "right",
			width: 532,
		});
}

function updatePageNumbers(doc: PDFKit.PDFDocument, totalPages: number) {
	// Update page numbers on all pages
	const range = doc.bufferedPageRange();
	for (let i = range.start; i < range.start + range.count; i++) {
		doc.switchToPage(i);
		const footerY = 680;

		// Clear the old page number area
		doc
			.fillColor("#FFFFFF")
			.rect(450, footerY + 50, 122, 10)
			.fill();

		// Add updated page number
		doc
			.fillColor("#808080")
			.fontSize(8)
			.font("Helvetica")
			.text(`Página ${i + 1} de ${totalPages}`, 40, footerY + 50, {
				align: "right",
				width: 532,
			});
	}
}
