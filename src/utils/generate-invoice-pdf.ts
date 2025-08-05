import PDFKit from "pdfkit";
import * as bwipjs from "bwip-js";
import * as fs from "fs";
import * as path from "path";
import { Invoice, Customer, Receiver, Agency, Service, Item } from "@prisma/client";
import { formatName } from "./capitalize";

interface InvoiceWithRelations extends Omit<Invoice, "total"> {
	customer: Customer;
	receiver: Receiver & {
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
	doc.fillColor("#000000").fontSize(12).font("Helvetica-Bold").text("CTEnvios", 40, currentY);

	currentY += 16; // Space after company name

	// Company details below name
	doc
		.fillColor("#666666")
		.fontSize(9)
		.font("Helvetica")
		.text("Address: 10230 NW 80th Ave. Miami, FL 33016", 40, currentY);

	currentY += 12;

	doc.text("Phone: 3058513004", 40, currentY);

	// Invoice details (right side) - aligned to the right (reduced spacing)
	doc
		.fillColor("#000000")
		.fontSize(16)
		.font("Helvetica-Bold")
		.text(`Invoice ${invoice.id}`, 450, 25, { align: "right", width: 122 })
		.fontSize(12)
		.font("Helvetica")
		.text(`Items: ${invoice.items.length}`, 450, 42, { align: "right", width: 122 });

	// Date - aligned to the right, same style as phone/address (reduced spacing)
	const date = new Date(invoice.created_at);
	const formattedDate =
		date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) +
		" " +
		date.toLocaleTimeString("es-ES", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});
	doc
		.fillColor("#000000")
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
			.fillColor("#000000")
			.fontSize(8)
			.font("Helvetica")
			.text(String(invoice.id).padStart(6, "0"), 320, 50, { align: "center", width: 80 });
	} catch (error) {
		console.log("Barcode generation failed:", error);
	}

	return isFirstPage ? 105 : 95; // Return Y position where content should start (reduced)
}

function generateSenderRecipientInfo(doc: PDFKit.PDFDocument, invoice: InvoiceWithRelations) {
	let currentY = 110;

	// Left side - Sender information
	const senderName = formatName(
		invoice.customer.first_name,
		invoice.customer.middle_name,
		invoice.customer.last_name,
		invoice.customer.second_last_name,
		30, // Max length for invoice display
	);

	// Sender name
	doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text(senderName, 40, currentY);
	currentY += 14;

	// Sender phone (only number, no label)
	if (invoice.customer.mobile) {
		doc
			.fillColor("#000000")
			.fontSize(9)
			.font("Helvetica")
			.text(`Tel: ${invoice.customer.mobile}`, 40, currentY, { width: 100, align: "left" });
		currentY += 14;
	}

	// Sender address (no label)
	if (invoice.customer.address) {
		doc
			.fillColor("#000000")
			.fontSize(9)
			.font("Helvetica")
			.text(`Dirección: ${invoice.customer.address}`, 40, currentY, {
				width: 250,
			});
	}

	// Right side - Recipient information
	let recipientY = 110;

	const recipientName = formatName(
		invoice.receiver.first_name,
		invoice.receiver.middle_name,
		invoice.receiver.last_name,
		invoice.receiver.second_last_name,
		30, // Max length for invoice display
	);

	// Smart recipient name formatting with width constraints
	const maxRecipientWidth = 250;
	const recipientFontSize = recipientName.length > 25 ? 9 : 10;

	// Recipient name with proper width constraints
	doc
		.fillColor("#000000")
		.fontSize(recipientFontSize)
		.font("Helvetica-Bold")
		.text(recipientName, 320, recipientY, {
			width: maxRecipientWidth,
			height: 16,
			ellipsis: true,
		});
	recipientY += 14;

	// Recipient phone (only number, no label)
	if (invoice.receiver.mobile) {
		doc
			.fillColor("#000000")
			.fontSize(9)
			.font("Helvetica")
			.text(
				`Tel: ${invoice.receiver.mobile || ""}${
					invoice.receiver.mobile && invoice.receiver.phone ? " - " : ""
				}${invoice.receiver.phone || ""}`,
				320,
				recipientY,
				{ width: 250, align: "left" },
			);
		recipientY += 14;
	}
	//receiip ci
	if (invoice.receiver.ci) {
		doc
			.fillColor("#000000")
			.fontSize(9)
			.font("Helvetica")
			.text(`CI: ${invoice.receiver.ci}`, 320, recipientY, { width: 100, align: "left" });
		recipientY += 14;
	}

	// Recipient address with location
	const location = `${invoice.receiver.city?.name || ""} ${
		invoice.receiver.province?.name || ""
	}`.trim();

	const fullAddress = location
		? `${invoice.receiver.address}, ${location}`
		: invoice.receiver.address;

	doc
		.fillColor("#000000")
		.fontSize(9)
		.font("Helvetica")
		.text(`Dirección: ${fullAddress}`, 320, recipientY, {
			width: 250,
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
			.fillColor("#000000")
			.fontSize(9)
			.font("Helvetica-Bold")
			.text("HBL", 30, y, { width: 100, align: "left" })
			.text("Descripción", 140, y)
			.text("Seguro", 300, y, { width: 40, align: "right" })
			.text("Delivery", 340, y, { width: 40, align: "right" })
			.text("Arancel", 385, y, { width: 40, align: "right" })
			.text("Precio", 430, y, { width: 40, align: "right" })
			.text("Peso", 470, y, { width: 40, align: "right" })
			.text("Subtotal", 520, y, { width: 40, align: "right" });

		// Add bottom border for headers
		doc
			.strokeColor("#D1D5DB")
			.lineWidth(1)
			.moveTo(25, y + 15)
			.lineTo(572, y + 15)
			.stroke();

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

		// Calculate row height based on description length
		const descriptionHeight = doc.heightOfString(item.description, { width: 150 });
		const rowHeight = Math.max(25, descriptionHeight + 16); // Minimum 25px, add padding

		// Check if we need a new page
		currentY = await checkPageBreak(currentY, rowHeight);

		// Row data

		const subtotal =
			item.rate/100 * item.weight +
			item?.customs_fee +
			(item?.delivery_fee || 0) +
			(item?.insurance_fee || 0);

		// Calculate vertical center position for single-line items
		const verticalCenter = currentY + rowHeight / 2 - 4;

		doc
			.fillColor("#000000")
			.fontSize(9)
			.font("Helvetica")
			.text(
				item.hbl ||
					`CTE${String(invoice.id).padStart(6, "0")}${String(index + 1).padStart(6, "0")}`,
				30,
				verticalCenter,
				{
					width: 100,
				},
			)
			.text(item.description, 140, currentY + 8, {
				width: 150,
			})
			.text(`$${item.insurance_fee?.toFixed(2)}`, 300, verticalCenter, {
				width: 40,
				align: "right",
			})
			.text(`$${item.delivery_fee?.toFixed(2)}`, 340, verticalCenter, { width: 40, align: "right" })
			.text(`$${item.customs_fee?.toFixed(2)}`, 385, verticalCenter, { width: 40, align: "right" })
			.text(`$${(item.rate / 100).toFixed(2)}`, 430, verticalCenter, {
				width: 40,
				align: "right",
			})
			.text(`${item.weight.toFixed(2)}`, 470, verticalCenter, { width: 40, align: "right" })
			.text(`$${(subtotal ).toFixed(2)}`, 520, verticalCenter, {
				width: 40,
				align: "right",
			});

		// Row bottom border (dashed) - positioned at the bottom of the dynamic row
		doc
			.strokeColor("#D1D5DB")
			.lineWidth(1)
			.dash(2, { space: 1 })
			.moveTo(25, currentY + rowHeight)
			.lineTo(572, currentY + rowHeight)
			.stroke()
			.undash();

		currentY += rowHeight;
	}

	// Check if we need space for totals (reserve about 250 points)
	currentY = await checkPageBreak(currentY, 250);

	// Add spacing before totals
	currentY += 30;

	// Totals section - right aligned
	const shipping = 0;
	const tax = 0;
	const discount = 0;

	// Subtotal
	doc
		.fillColor("#000000")
		.fontSize(10)
		.font("Helvetica")
		.text("Subtotal", 420, currentY)
		.text(`$${((invoice.total_amount || 0) / 100).toFixed(2)}`, 520, currentY, {
			width: 50,
			align: "right",
		});

	currentY += 15;

	// Shipping
	doc
		.fillColor("#000000")
		.text("Shipping", 420, currentY)
		.text(`$${shipping}`, 520, currentY, { width: 50, align: "right" });

	currentY += 15;

	// Tax
	doc
		.fillColor("#000000")
		.text("Tax", 420, currentY)
		.text(`$${tax}`, 520, currentY, { width: 50, align: "right" });

	currentY += 15;

	// Discount
	doc
		.fillColor("#000000")
		.text("Discount", 420, currentY)
		.text(`$${discount}`, 520, currentY, { width: 50, align: "right" });

	currentY += 15;

	// Total
	doc
		.fillColor("#000000")
		.fontSize(12)
		.font("Helvetica-Bold")
		.text("Total", 420, currentY)
		.text(`$${((invoice.total_amount || 0) / 100).toFixed(2)}`, 520, currentY, {
			width: 50,
			align: "right",
		});

	return { totalPages: currentPage, total: invoice.total_amount };
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
