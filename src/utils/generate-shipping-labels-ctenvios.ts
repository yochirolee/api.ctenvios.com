import PDFKit from "pdfkit";
import {
	Invoice,
	Customer,
	Receiver,
	Agency,
	Service,
	Item,
	Provider,
	Forwarder,
	ServiceType,
} from "@prisma/client";
import bwipjs from "bwip-js";
import QRCode from "qrcode";
import { formatName } from "./capitalize";

interface InvoiceWithRelations extends Invoice {
	customer: Customer;
	receiver: Receiver & {
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
	let currentY = 2;

	// Header with transport type letter and barcode
	const barcodeText =
		item.hbl ||
		`REF${invoice.id.toString().padStart(8, "0")}${(itemIndex + 1).toString().padStart(3, "0")}`;

	// Large letter for transport type (left side)
	const transportLetter =
		invoice.service.service_type === ServiceType.AIR ? "A" :
		invoice.service.service_type === ServiceType.MARITIME ? "M" : "M";

	// Draw border around the letter - aligned left with company name
	doc.rect(margin, currentY + 5, 50, 50).stroke();

	doc
		.fontSize(34)
		.font("Helvetica-Bold")
		.fillColor("#000000")
		.text(transportLetter, margin, currentY + 17, { width: 50, align: "center" });

	// Company name removed from top section

	// Date moved below Caribe Travel Express

	// TRANSCARGO beside both squares - right aligned
	doc
		.fontSize(18)
		.font("Helvetica-Bold")
		.fillColor("#000000")
		.text(`${invoice.service.provider.name.toUpperCase()}`, margin + 140, currentY + 15, {
			width: labelWidth - margin - 145,
			align: "right",
		});

	// Weight area beside M square
	const weightSquareX = margin + 60; // Right beside M square (M is at margin, width 50, plus 10px gap)
	const weightSquareY = currentY + 5; // Same Y as M square
	const weightSquareWidth = 70; // Increased width to prevent overlap

	// Weight area without border

	// Weight text - lbs above, kg below
	const weightLbs = `${item.weight.toFixed(2)} lbs`;
	const weightKg = `${(item.weight / 2.20462).toFixed(2)} kg`;

	// Pounds on top - left aligned, larger font size
	doc
		.fontSize(12)
		.font("Helvetica")
		.fillColor("#000000")
		.text(weightLbs, weightSquareX, weightSquareY + 14, {
			width: weightSquareWidth,
			align: "left",
		});

	// Kilograms below - left aligned, larger font size
	doc
		.fontSize(12)
		.font("Helvetica")
		.fillColor("#000000")
		.text(weightKg, weightSquareX, weightSquareY + 28, {
			width: weightSquareWidth,
			align: "left",
		});

	// Caribe Travel Express beside both squares - right aligned
	doc
		.fontSize(7)
		.font("Helvetica")
		.fillColor("#000000")
		.text(invoice?.service?.forwarder.name || "", margin + 140, currentY + 34, {
			width: labelWidth - margin - 145,
			align: "right",
		});

	// Date below Caribe Travel Express
	doc
		.fontSize(7)
		.font("Helvetica")
		.fillColor("#000000")
		.text(`${new Date().toISOString().split("T")[0]}`, margin + 140, currentY + 45, {
			width: labelWidth - margin - 145,
			align: "right",
		});

	currentY += 65;

	// Barcode dimensions (declared outside try block for scope access)
	const barcodeWidth = 210; // Expanded barcode for even better scanning
	const barcodeX = margin; // Aligned to the left margin

	// SUPER FAST Barcode - Optimized for maximum reading speed
	try {
		const barcodeBuffer = await bwipjs.toBuffer({
			bcid: "code128",
			text: barcodeText,
			scale: 3, // Optimal scale: 0.5mm per bar (industry standard for fastest reading)
			height: 20, // Increased height for better readability (minimum 15mm recommended)
			includetext: false, // Clean appearance, no text duplication
			backgroundcolor: "ffffff", // Pure white background for maximum contrast
			barcolor: "000000", // Pure black bars for maximum contrast
			rotate: "N", // No rotation - fastest processing
			parsefnc: true, // Enable FNC characters for better compatibility
			addontextxoffset: 0, // No addon text offset
			addontextyoffset: 0, // No addon text offset
		});

		doc.image(barcodeBuffer, barcodeX, currentY + 5, {
			width: barcodeWidth,
			height: 50, // Increased height for super fast scanning (minimum 15mm)
		});
	} catch (error) {
		console.error("Barcode generation error:", error);
		doc
			.fontSize(12)
			.font("Helvetica-Bold")
			.text(`ERROR: ${barcodeText}`, barcodeX, currentY + 20, {
				width: barcodeWidth,
				align: "center",
			});
	}

	// HBL moved to below both barcode and QR

	// QR Code dimensions (declared outside try block for scope access)
	const qrWidth = 50; // Same height as optimized barcode
	const qrHeight = 50; // Same height as optimized barcode
	const qrX = labelWidth - margin - qrWidth; // Aligned to right edge
	const qrY = currentY + 5; // Same Y as barcode

	// SUPER FAST QR Code - Optimized for maximum reading speed
	try {
		const qrData = `${item.hbl || barcodeText}`;
		const QRCode = require("qrcode");

		const qrCodeDataURL = await QRCode.toDataURL(qrData, {
			width: 200, // High resolution for crisp rendering at 50x50
			margin: 0, // Minimal margin for maximum data space and faster processing
			color: {
				dark: "#000000", // Pure black for maximum contrast
				light: "#ffffff", // Pure white for maximum contrast
			},
			errorCorrectionLevel: "L", // Low error correction = faster reading (7% recovery)
			version: undefined, // Auto-select smallest version for fastest processing
			maskPattern: undefined, // Auto-select optimal mask pattern
		});

		const qrBuffer = Buffer.from(qrCodeDataURL.split(",")[1], "base64");

		doc.image(qrBuffer, qrX, qrY, {
			width: qrWidth,
			height: qrHeight,
		});
	} catch (error) {
		console.error("QR code generation error:", error);
	}

	// HBL below both barcode and QR (spans across full width)
	doc
		.fontSize(22)
		.font("Helvetica-Bold")
		.fillColor("#000000")
		.text(`${item.hbl || barcodeText}`, barcodeX, currentY + 65, {
			width: qrX + qrWidth - barcodeX, // From barcode start to QR end
			align: "center",
		});

	currentY += 50;

	//Description
	currentY += 45;
	doc
		.fontSize(10)
		.font("Helvetica")
		.text(item.description?.toUpperCase() || "", margin, currentY);
	// Service section with border

	currentY +=60;
	//Sender Info
	const senderInfo = formatName(
		invoice.customer.first_name,
		invoice.customer.middle_name,
		invoice.customer.last_name,
		invoice.customer.second_last_name,
		25, // Max length for label display
	);

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("Env:", margin + 5, currentY);

	doc
		.fontSize(8)
		.font("Helvetica")
		.text(senderInfo.toUpperCase(), margin + 35, currentY);

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
	const recipientName = formatName(
		invoice.receiver.first_name,
		invoice.receiver.middle_name,
		invoice.receiver.last_name,
		invoice.receiver.second_last_name,
		25, // Max length for label display
	);

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("Para:", margin + 5, currentY + 5);

	// Smart name formatting with width constraints and font sizing
	const maxNameWidth = labelWidth - margin - 65 - 10;
	const nameUpperCase = recipientName.toUpperCase();

	// Use smaller font for very long names
	const nameFontSize = nameUpperCase.length > 25 ? 8 : 10;

	doc
		.fontSize(nameFontSize)
		.font("Helvetica-Bold")
		.text(nameUpperCase, margin + 35, currentY + 5, {
			width: maxNameWidth,
			height: 20,
			ellipsis: true,
		});

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("Tel:", margin + 5, currentY + 20);

	doc
		.fontSize(10)
		.font("Helvetica-Bold")
		.text(
			`${invoice.receiver.mobile || ""}${
				invoice.receiver.mobile && invoice.receiver.phone ? " - " : ""
			}${invoice.receiver.phone || ""}`,
			margin + 35,
			currentY + 20,
		);

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("CI:", margin + 5, currentY + 35);

	doc
		.fontSize(10)
		.font("Helvetica-Bold")
		.text(invoice.receiver.ci || "", margin + 35, currentY + 35);

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("Dir:", margin + 5, currentY + 50);

	// Address (regular text)
	doc
		.fontSize(9)
		.font("Helvetica")
		.text(invoice.receiver.address, margin + 35, currentY + 50, {
			width: labelWidth - margin - 35 - 10,
		});

	// Province and Municipality (bold text) - positioned dynamically after address
	const addressHeight = doc.heightOfString(invoice.receiver.address, {
		width: labelWidth - margin - 35 - 10,
	});
	
	doc
		.fontSize(10	)
		.font("Helvetica-Bold")
		.text(
			`${invoice.receiver.province?.name || ""} / ${invoice.receiver.city?.name || ""}`,
			margin,
			currentY + 50 + addressHeight + 5,
			{
				width: labelWidth - margin * 2,
				align: "center",
			},
		);

	// Update currentY to account for dynamic address height plus province/city text
	const provinceCityHeight = doc.heightOfString(
		`${invoice.receiver.province?.name || ""} / ${invoice.receiver.city?.name || ""}`,
		{
			width: labelWidth - margin * 2,
		}
	);
	currentY += 50 + addressHeight + 5 + provinceCityHeight + 10; // 10 points margin

	// SUPER FAST Footer QR Code - Maximum speed optimization
	try {
		// Optimized data: only essential info for fastest processing
		const qrData = `${
			item.hbl ||
			`REF${invoice.id.toString().padStart(8, "0")}${(itemIndex + 1).toString().padStart(3, "0")}`
		}`;

		const qrCodeDataURL = await QRCode.toDataURL(qrData, {
			width: 280, // Very high resolution for ultra-crisp rendering
			margin: 0, // No margin for maximum speed and data space
			color: {
				dark: "#000000", // Pure black for maximum contrast
				light: "#ffffff", // Pure white for maximum contrast
			},
			errorCorrectionLevel: "L", // Low error correction (7% recovery) = FASTEST reading
			version: undefined, // Auto-select smallest version for speed
			maskPattern: undefined, // Auto-select optimal mask for speed
		});

		const qrBuffer = Buffer.from(qrCodeDataURL.split(",")[1], "base64");
		// Position QR with safe bottom margin to avoid page overflow
		const qrSize = 70;
		const qrY = labelHeight - qrSize - 25; // Safe margin to prevent overflow
		const qrX = margin + 8; // Left aligned with small offset

		doc.image(qrBuffer, qrX, qrY, {
			width: qrSize,
			height: qrSize,
		});

		// Provider name below QR code
		doc
			.fontSize(8)
			.font("Helvetica-Bold")
			.fillColor("#000000")
			.text(invoice.service.provider.name.toUpperCase(), qrX, qrY + qrSize + 2, {
				width: qrSize,
				align: "center",
			});
	} catch (error) {
		console.error("QR code generation error:", error);
		// Enhanced fallback with error handling - positioned at bottom with provider name
		const qrSize = 70;
		const qrY = labelHeight - qrSize - 20; // Same safe margin as main QR
		const qrX = margin + 8;

		doc
			.strokeColor("#000000")
			.rect(qrX, qrY, qrSize, qrSize)
			.stroke()
			.fontSize(8)
			.fillColor("#666666")
			.text("QR ERROR", qrX, qrY + qrSize / 2 - 8, { width: qrSize, align: "center" })
			.fontSize(6)
			.text("Manual scan required", qrX, qrY + qrSize / 2 + 2, {
				width: qrSize,
				align: "center",
			});

		// Provider name below fallback QR
		doc
			.fontSize(8)
			.font("Helvetica-Bold")
			.fillColor("#000000")
			.text(invoice.service.provider.name.toUpperCase(), qrX, qrY + qrSize + 2, {
				width: qrSize,
				align: "center",
			});
	}

	// Large tracking number in center - positioned safely within page bounds
	doc
		.fontSize(20)
		.font("Helvetica-Bold")
		.fillColor("#000000")
		.text(`${invoice.id}`, labelWidth - 160, labelHeight - 40, { width: 60, align: "center" });

	doc
		.fontSize(8)
		.font("Helvetica")
		.text("Factura", labelWidth - 165, labelHeight - 50, { width: 60, align: "center" });
	// Pack number
	doc
		.fontSize(8)
		.font("Helvetica")
		.text("Paquete", labelWidth - 85, labelHeight - 50, { width: 60, align: "center" });
	doc
		.fontSize(20)
		.font("Helvetica-Bold")
		.text(`${itemIndex + 1}-${invoice.items.length}`, labelWidth - 85, labelHeight - 40, {
			width: 80,
			align: "center",
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
		.text(invoice.receiver.province?.name.toUpperCase() || "", margin, currentY + 50, {
			width: labelWidth - margin * 2,
			align: "center",
		});

	doc
		.fontSize(30)
		.font("Helvetica-Bold")
		.text(invoice.receiver.city?.name.toUpperCase() || "", margin, currentY + 160, {
			width: labelWidth - margin * 2,
			align: "center",
		});

	doc
		.fontSize(40)
		.font("Helvetica-Bold")
		.text(
			`${invoice.receiver.province?.id || ""} - ${invoice.receiver.city?.id || ""}`,
			margin,
			labelHeight - 60,
			{
				width: labelWidth - margin * 2,
				align: "center",
			},
		);
}
