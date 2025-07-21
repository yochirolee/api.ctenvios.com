import PDFKit from "pdfkit";
import {
	Invoice,
	Customer,
	Receipt,
	Agency,
	Service,
	Item,
	Provider,
	Forwarder,
} from "@prisma/client";
import bwipjs from "bwip-js";
import QRCode from "qrcode";

interface InvoiceWithRelations extends Invoice {
	customer: Customer;
	receipt: Receipt & {
		province: { id: number; name: string };
		city: { id: number; name: string };
	};
	agency: Agency;
	service: Service & {
		provider: Provider;
		forwarder: Forwarder;
	};
	items: Item[];
}

export const generateCTEnviosLabels = (
	invoice: InvoiceWithRelations,
): Promise<PDFKit.PDFDocument> => {
	// 4x6 inch labels (288x432 points at 72 DPI)
	const labelWidth = 288; // 4 inches * 72 points/inch
	const labelHeight = 432; // 6 inches * 72 points/inch

	const doc = new PDFKit({
		size: [labelWidth, labelHeight],
		margin: 10,
	});

	// Generate two labels per item (main label + province/city label)
	return new Promise(async (resolve, reject) => {
		try {
			for (let i = 0; i < invoice.items.length; i++) {
				if (i > 0) {
					doc.addPage(); // New page for each main label
				}
				// Generate main label
				await generateCleanCTEnviosLabel(
					doc,
					invoice,
					invoice.items[i],
					i,
					labelWidth,
					labelHeight,
				);

				// Generate province/city label
				doc.addPage();
				await generateProvinceLabel(doc, invoice, invoice.items[i], i, labelWidth, labelHeight);
			}
			resolve(doc);
		} catch (error) {
			reject(error);
		}
	});
};

// Export internal functions for bulk generation
export const generateBulkCTEnviosLabels = (
	invoices: InvoiceWithRelations[],
): Promise<PDFKit.PDFDocument> => {
	// 4x6 inch labels (288x432 points at 72 DPI)
	const labelWidth = 288; // 4 inches * 72 points/inch
	const labelHeight = 432; // 6 inches * 72 points/inch

	const doc = new PDFKit({
		size: [labelWidth, labelHeight],
		margin: 10,
	});

	// Generate labels for all invoices using the existing internal functions
	return new Promise(async (resolve, reject) => {
		try {
			let isFirstLabel = true;

			for (const invoice of invoices) {
				for (let i = 0; i < invoice.items.length; i++) {
					if (!isFirstLabel) {
						doc.addPage(); // New page for each main label
					}
					isFirstLabel = false;

					// Generate main label using existing function
					await generateCleanCTEnviosLabel(
						doc,
						invoice,
						invoice.items[i],
						i,
						labelWidth,
						labelHeight,
					);

					// Generate province/city label
					doc.addPage();
					await generateProvinceLabel(doc, invoice, invoice.items[i], i, labelWidth, labelHeight);
				}
			}
			resolve(doc);
		} catch (error) {
			reject(error);
		}
	});
};

async function generateCleanCTEnviosLabel(
	doc: PDFKit.PDFDocument,
	invoice: InvoiceWithRelations,
	item: Item,
	itemIndex: number,
	labelWidth: number,
	labelHeight: number,
) {
	const margin = 8;
	let currentY = margin;

	// Header with transport type letter and barcode
	const barcodeText =
		item.hbl ||
		`REF${invoice.id.toString().padStart(8, "0")}${(itemIndex + 1).toString().padStart(3, "0")}`;

	// Large letter for transport type (left side)
	const transportLetter =
		invoice.service.name.toLowerCase().includes("aereo") ||
		invoice.service.name.toLowerCase().includes("air")
			? "A"
			: "M";

	// Draw border around the letter
	doc.rect(margin + 5, currentY + 15, 50, 50).stroke();

	doc
		.fontSize(28)
		.font("Helvetica-Bold")
		.fillColor("#000000")
		.text(transportLetter, margin + 5, currentY + 27, { width: 50, align: "center" });

	// Company name and info (middle section)
	doc
		.fontSize(8)
		.font("Helvetica-Bold")
		.text(invoice?.service?.forwarder.name || "", margin, currentY);

	doc
		.fontSize(7)
		.font("Helvetica")
		.text(`${new Date().toISOString().split("T")[0]}`, margin + labelWidth - 100, currentY, {
			align: "right",
		});

	doc
		.fontSize(12)
		.font("Helvetica")
		.text(`${item.weight.toFixed(2)} lbs`, margin + 65, currentY + 30);

	doc
		.fontSize(12)
		.font("Helvetica")
		.text(`${(item.weight / 2.20462).toFixed(2)} kg`, margin + 65, currentY + 42);

	// Barcode (right side)
	try {
		const barcodeBuffer = await bwipjs.toBuffer({
			bcid: "code128",
			text: barcodeText,
			scale: 2,
			height: 8,
		});

		const barcodeWidth = 120;
		doc.image(barcodeBuffer, labelWidth - margin - barcodeWidth - 5, currentY + 17, {
			width: barcodeWidth,
			height: 30,
		});
	} catch (error) {
		console.error("Barcode generation error:", error);
		doc
			.fontSize(12)
			.font("Helvetica-Bold")
			.text(barcodeText, labelWidth - margin - 120, currentY + 30, {
				width: 115,
				align: "center",
			});
	}

	// HBL number below barcode
	doc
		.fontSize(14)
		.font("Helvetica-Bold")
		.fillColor("#000000")
		.text(`${item.hbl || barcodeText}`, labelWidth - margin - 140, currentY + 50, {
			width: 140,
			align: "right",
		});

	currentY += 80;
	doc
		.fontSize(24)
		.font("Helvetica-Bold")
		.text(`${invoice.service.provider.name.toUpperCase()}`, margin, currentY + 5, {
			width: labelWidth - margin * 2,
			align: "center",
		});
	currentY += 30;

	const destination = `${invoice.receipt.province?.name || ""} / ${
		invoice.receipt.city?.name || ""
	}`;

	doc
		.fontSize(14)
		.font("Helvetica-Bold")
		.text(destination, margin, currentY, {
			width: labelWidth - margin * 2 - 10,
			align: "center",
		});
	//Description
	currentY += 40;
	doc
		.fontSize(10)
		.font("Helvetica")
		.text(item.description?.toUpperCase() || "", margin, currentY);
	// Service section with border

	currentY += 70;
	//Sender Info
	const senderInfo = `${invoice.customer.first_name} ${invoice.customer.middle_name || ""} ${
		invoice.customer.last_name
	} ${invoice.customer.second_last_name || ""}`.trim();

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("ENVIA:", margin + 5, currentY);

	doc
		.fontSize(8)
		.font("Helvetica")
		.text(senderInfo.toUpperCase(), margin + 70, currentY);

	// Transport type checkboxes
	currentY += 10;

	//Dashed line
	doc
		.strokeColor("#808080")
		.lineWidth(0.1)
		.dash(5, { space: 5 })
		.moveTo(margin + 10, currentY + 5)
		.lineTo(labelWidth - margin * 2 - 10, currentY + 5)
		.stroke()
		.undash();
	currentY += 10;
	const recipientName = `${invoice.receipt.first_name} ${invoice.receipt.middle_name || ""} ${
		invoice.receipt.last_name
	} ${invoice.receipt.second_last_name || ""}`.trim();

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("RECIBE:", margin + 5, currentY + 5);

	doc
		.fontSize(10)
		.font("Helvetica-Bold")
		.text(recipientName.toUpperCase(), margin + 70, currentY + 5);

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("TELEFONOS:", margin + 5, currentY + 20);

	doc
		.fontSize(10)
		.font("Helvetica-Bold")
		.text(
			invoice.receipt.phone || "" + " " + invoice.receipt.mobile || "",
			margin + 70,
			currentY + 20,
		);

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("CI:", margin + 5, currentY + 35);

	doc
		.fontSize(10)
		.font("Helvetica-Bold")
		.text(invoice.receipt.ci || "", margin + 70, currentY + 35);

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("DIRECCION:", margin + 5, currentY + 50);

	doc
		.fontSize(10)
		.font("Helvetica")
		.text(
			`${invoice.receipt.address + " " + invoice.receipt.province?.name || ""} / ${
				invoice.receipt.city?.name || ""
			}`,
			margin + 70,
			currentY + 50,
			{
				width: labelWidth - margin - 70 - 10,
				height: 30,
			},
		);

	currentY += 90;

	// Left QR Code
	try {
		const qrData = `${item.hbl},${invoice.id},${recipientName},${invoice.receipt.ci}`;

		const qrCodeDataURL = await QRCode.toDataURL(qrData, {
			width: 80,
			margin: 2,
		});

		const qrBuffer = Buffer.from(qrCodeDataURL.split(",")[1], "base64");
		doc.image(qrBuffer, margin + 10, currentY, { width: 70, height: 70 });
	} catch (error) {
		console.error("QR code generation error:", error);
	}

	// Large tracking number in center
	doc
		.fontSize(20)
		.font("Helvetica-Bold")
		.fillColor("#000000")
		.text(`${invoice.id}`, labelWidth - 140, labelHeight - 35, { width: 60, align: "right" });

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("Factura", labelWidth - 140, labelHeight - 45, { width: 60, align: "right" });
	// Pack number
	doc
		.fontSize(8)
		.font("Helvetica")
		.text("Paquete", labelWidth - 70, labelHeight - 45, { width: 60, align: "right" });
	doc
		.fontSize(20)
		.font("Helvetica-Bold")
		.text(`${itemIndex + 1}-${invoice.items.length}`, labelWidth - 70, labelHeight - 35, {
			width: 60,
			align: "right",
		});
}

async function generateProvinceLabel(
	doc: PDFKit.PDFDocument,
	invoice: InvoiceWithRelations,
	item: Item,
	itemIndex: number,
	labelWidth: number,
	labelHeight: number,
) {
	const margin = 8;
	let currentY = margin + 50;

	// Province and City (main content - large and centered)

	doc
		.fontSize(40)
		.font("Helvetica-Bold")
		.text(invoice.receipt.province?.name.toUpperCase() || "", margin, currentY + 50, {
			width: labelWidth - margin * 2,
			align: "center",
		});

	doc
		.fontSize(30)
		.font("Helvetica-Bold")
		.text(invoice.receipt.city?.name.toUpperCase() || "", margin, currentY + 160, {
			width: labelWidth - margin * 2,
			align: "center",
		});

	doc
		.fontSize(40)
		.font("Helvetica-Bold")
		.text(
			`${invoice.receipt.province?.id || ""} - ${invoice.receipt.city?.id || ""}`,
			margin,
			labelHeight - 60,
			{
				width: labelWidth - margin * 2,
				align: "center",
			},
		);
}
