import PDFKit from "pdfkit";
import * as path from "path";
import prisma from "../lib/prisma.client";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

// Font paths
const FONT_PATHS = {
   REGULAR: path.join(process.cwd(), "assets", "fonts", "Inter-Regular.ttf"),
   MEDIUM: path.join(process.cwd(), "assets", "fonts", "Inter-Medium.ttf"),
   SEMIBOLD: path.join(process.cwd(), "assets", "fonts", "Inter-SemiBold.ttf"),
   BOLD: path.join(process.cwd(), "assets", "fonts", "Inter-Bold.ttf"),
} as const;

const FONTS = {
   REGULAR: "Inter-Regular",
   MEDIUM: "Inter-Medium",
   SEMIBOLD: "Inter-SemiBold",
   BOLD: "Inter-Bold",
} as const;

// Printer-friendly colors (minimal ink)
const COLORS = {
   BLACK: "#000000",
   GRAY: "#666666",
   LIGHT_GRAY: "#CCCCCC",
   WHITE: "#FFFFFF",
} as const;

const LAYOUT = {
   PAGE_WIDTH: 792, // Letter size landscape
   PAGE_HEIGHT: 612,
   MARGIN: 40,
   CONTENT_WIDTH: 712, // 792 - 40*2
} as const;

// Helper to format cents to dollars
const formatCents = (cents: number): string => {
   return `$${(cents / 100).toFixed(2)}`;
};

// Helper to format date
const formatDate = (date: Date): string => {
   return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
   });
};

// Helper to format datetime
const formatDateTime = (date: Date): string => {
   return date.toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
   });
};

// Payment method labels
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
   CASH: "Efectivo",
   ZELLE: "Zelle",
   CREDIT_CARD: "Tarjeta",
   DEBIT_CARD: "Débito",
   BANK_TRANSFER: "Transferencia",
   PAYPAL: "PayPal",
   CHECK: "Cheque",
};

interface OrderRow {
   order_id: number;
   created_at: Date;
   customer_name: string;
   customer_phone: string;
   receiver_name: string;
   receiver_city: string;
   service_name: string;
   hbl_count: number;
   weight_lbs: number;
   total_cents: number;
   discount_cents: number;
   paid_cents: number;
   pending_cents: number;
   payment_status: PaymentStatus;
   payment_methods: PaymentMethod[];
   is_debt_collection: boolean; // True if this is a debt payment from a previous day
   original_order_date?: Date; // Original order date if is_debt_collection
}

interface SalesReportData {
   date: string;
   dateRange?: { start: string; end: string };
   agency: { id: number; name: string };
   filteredUser?: { id: string; name: string };
   summary: {
      total_orders: number;
      total_hbls: number;
      total_weight_lbs: number;
      total_billed_cents: number;
      total_collected_cents: number; // Total money received today (billing + debt collections)
      total_charges_cents: number;
      total_pending_cents: number;
      debt_collections_cents: number; // Debts collected today
      active_users: number;
   };
   paymentBreakdown: Array<{
      method: PaymentMethod;
      total_payments: number;
      total_amount_cents: number;
      total_charges_cents: number;
   }>;
   users: Array<{
      user_id: string;
      user_name: string;
      user_email: string;
      summary: {
         total_orders: number;
         total_hbls: number;
         total_weight_lbs: number;
         total_billed_cents: number;
         total_collected_cents: number;
         total_charges_cents: number;
         total_discounts_cents: number;
         total_pending_cents: number;
         debt_collections_cents: number;
      };
      paymentBreakdown: Array<{
         method: PaymentMethod;
         amount_cents: number;
      }>;
      orders: OrderRow[];
   }>;
}

/**
 * Get sales report data
 * Includes orders created today + debt collections (payments from older orders)
 */
export const getSalesReportData = async (
   startDate: Date,
   endDate: Date,
   agencyId: number,
   userId?: string
): Promise<SalesReportData> => {
   // 1. Get orders created today (exclude soft-deleted)
   const orderWhereClause: {
      created_at: { gte: Date; lte: Date };
      agency_id: number;
      deleted_at: null;
      user_id?: string;
   } = {
      created_at: { gte: startDate, lte: endDate },
      agency_id: agencyId,
      deleted_at: null, // Exclude soft-deleted orders
   };

   if (userId) {
      orderWhereClause.user_id = userId;
   }

   const ordersToday = await prisma.order.findMany({
      where: orderWhereClause,
      orderBy: { created_at: "asc" },
      include: {
         user: { select: { id: true, name: true, email: true } },
         customer: { select: { first_name: true, last_name: true, mobile: true } },
         receiver: {
            select: {
               first_name: true,
               last_name: true,
               city: { select: { name: true } },
            },
         },
         service: { select: { name: true } },
         parcels: { select: { id: true, weight: true } },
         payments: { select: { amount_in_cents: true, charge_in_cents: true, method: true, date: true } },
         discounts: { select: { discount_in_cents: true } },
      },
   });

   // 2. Get debt collections: payments received TODAY for orders created BEFORE today (exclude soft-deleted)
   const debtPaymentsWhere: {
      date: { gte: Date; lte: Date };
      order: { created_at: { lt: Date }; agency_id: number; deleted_at: null; user_id?: string };
   } = {
      date: { gte: startDate, lte: endDate },
      order: {
         created_at: { lt: startDate }, // Order was created BEFORE today
         agency_id: agencyId,
         deleted_at: null, // Exclude payments from deleted orders
      },
   };

   if (userId) {
      debtPaymentsWhere.order.user_id = userId;
   }

   const debtPayments = await prisma.payment.findMany({
      where: debtPaymentsWhere,
      include: {
         order: {
            include: {
               user: { select: { id: true, name: true, email: true } },
               customer: { select: { first_name: true, last_name: true, mobile: true } },
               receiver: {
                  select: {
                     first_name: true,
                     last_name: true,
                     city: { select: { name: true } },
                  },
               },
               service: { select: { name: true } },
               parcels: { select: { id: true, weight: true } },
            },
         },
      },
      orderBy: { date: "asc" },
   });

   const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true, name: true },
   });

   // Group orders and debt payments by user
   const userMap = new Map<
      string,
      {
         user: { id: string; name: string | null; email: string };
         orderRows: OrderRow[];
         stats: {
            totalOrders: number;
            totalHbls: number;
            totalWeight: number;
            totalBilled: number;
            totalCollected: number;
            totalCharges: number;
            totalDiscounts: number;
            debtCollections: number;
         };
         paymentMap: Map<PaymentMethod, number>;
      }
   >();

   // Process today's orders
   for (const order of ordersToday) {
      if (!userMap.has(order.user_id)) {
         userMap.set(order.user_id, {
            user: order.user,
            orderRows: [],
            stats: {
               totalOrders: 0,
               totalHbls: 0,
               totalWeight: 0,
               totalBilled: 0,
               totalCollected: 0,
               totalCharges: 0,
               totalDiscounts: 0,
               debtCollections: 0,
            },
            paymentMap: new Map(),
         });
      }

      const userData = userMap.get(order.user_id)!;
      const hblCount = order.parcels.length;
      const weight = order.parcels.reduce((sum, p) => sum + Number(p.weight), 0);
      const discounts = order.discounts.reduce((sum, d) => sum + d.discount_in_cents, 0);
      const paymentMethods = [...new Set(order.payments.map((p) => p.method))];

      // Only count payments made TODAY for this order
      // IMPORTANT: total_in_cents includes card charges, so collected = amount + charge
      const paymentsToday = order.payments.filter((p) => p.date >= startDate && p.date <= endDate);
      const amountToday = paymentsToday.reduce((sum, p) => sum + p.amount_in_cents, 0);
      const chargesToday = paymentsToday.reduce((sum, p) => sum + p.charge_in_cents, 0);
      const paidToday = amountToday + chargesToday; // Total collected includes charges

      userData.stats.totalOrders++;
      userData.stats.totalHbls += hblCount;
      userData.stats.totalWeight += weight;
      userData.stats.totalBilled += order.total_in_cents;
      userData.stats.totalCollected += paidToday; // Now includes charges
      userData.stats.totalCharges += chargesToday;
      userData.stats.totalDiscounts += discounts;

      for (const payment of paymentsToday) {
         // Payment total = amount + charge (since total_in_cents includes charges)
         const paymentTotal = payment.amount_in_cents + payment.charge_in_cents;
         userData.paymentMap.set(payment.method, (userData.paymentMap.get(payment.method) || 0) + paymentTotal);
      }

      userData.orderRows.push({
         order_id: order.id,
         created_at: order.created_at,
         customer_name: `${order.customer.first_name} ${order.customer.last_name}`,
         customer_phone: order.customer.mobile || "",
         receiver_name: `${order.receiver.first_name} ${order.receiver.last_name}`,
         receiver_city: order.receiver.city?.name || "",
         service_name: order.service.name,
         hbl_count: hblCount,
         weight_lbs: Math.round(weight * 100) / 100,
         total_cents: order.total_in_cents,
         discount_cents: discounts,
         paid_cents: paidToday,
         pending_cents: order.total_in_cents - order.paid_in_cents,
         payment_status: order.payment_status,
         payment_methods: paymentMethods,
         is_debt_collection: false,
      });
   }

   // Process debt payments (payments from older orders)
   // Group by order to avoid duplicate rows for same order
   const debtOrderMap = new Map<number, { order: (typeof debtPayments)[0]["order"]; payments: typeof debtPayments }>();
   for (const payment of debtPayments) {
      if (!debtOrderMap.has(payment.order.id)) {
         debtOrderMap.set(payment.order.id, { order: payment.order, payments: [] });
      }
      debtOrderMap.get(payment.order.id)!.payments.push(payment);
   }

   for (const [, debtData] of debtOrderMap) {
      const order = debtData.order;
      const payments = debtData.payments;

      if (!userMap.has(order.user_id)) {
         userMap.set(order.user_id, {
            user: order.user,
            orderRows: [],
            stats: {
               totalOrders: 0,
               totalHbls: 0,
               totalWeight: 0,
               totalBilled: 0,
               totalCollected: 0,
               totalCharges: 0,
               totalDiscounts: 0,
               debtCollections: 0,
            },
            paymentMap: new Map(),
         });
      }

      const userData = userMap.get(order.user_id)!;
      // IMPORTANT: Include charges since total_in_cents includes them
      const amountToday = payments.reduce((sum, p) => sum + p.amount_in_cents, 0);
      const chargesToday = payments.reduce((sum, p) => sum + p.charge_in_cents, 0);
      const paidToday = amountToday + chargesToday; // Total includes charges
      const paymentMethods = [...new Set(payments.map((p) => p.method))];
      const hblCount = order.parcels.length;
      const weight = order.parcels.reduce((sum, p) => sum + Number(p.weight), 0);

      userData.stats.totalCollected += paidToday;
      userData.stats.totalCharges += chargesToday;
      userData.stats.debtCollections += paidToday;

      for (const payment of payments) {
         const paymentTotal = payment.amount_in_cents + payment.charge_in_cents;
         userData.paymentMap.set(payment.method, (userData.paymentMap.get(payment.method) || 0) + paymentTotal);
      }

      // Add as debt collection row
      userData.orderRows.push({
         order_id: order.id,
         created_at: new Date(), // Show today's date for the collection
         customer_name: `${order.customer.first_name} ${order.customer.last_name}`,
         customer_phone: order.customer.mobile || "",
         receiver_name: `${order.receiver.first_name} ${order.receiver.last_name}`,
         receiver_city: order.receiver.city?.name || "",
         service_name: order.service.name,
         hbl_count: hblCount,
         weight_lbs: Math.round(weight * 100) / 100,
         total_cents: paidToday, // Total paid today (amount + charges)
         discount_cents: 0,
         paid_cents: paidToday,
         pending_cents: 0,
         payment_status: PaymentStatus.PAID, // This payment is complete
         payment_methods: paymentMethods,
         is_debt_collection: true,
         original_order_date: order.created_at,
      });
   }

   // Build users array
   const users: SalesReportData["users"] = [];
   const overallPaymentMap = new Map<PaymentMethod, { count: number; amount: number; charges: number }>();

   let totalOrders = 0;
   let totalHbls = 0;
   let totalWeight = 0;
   let totalBilled = 0;
   let totalCollected = 0;
   let totalCharges = 0;
   let totalDebtCollections = 0;

   for (const [uId, userData] of userMap) {
      // Sort orders: regular first, then debts
      userData.orderRows.sort((a, b) => {
         if (a.is_debt_collection !== b.is_debt_collection) {
            return a.is_debt_collection ? 1 : -1;
         }
         return a.created_at.getTime() - b.created_at.getTime();
      });

      const paymentBreakdown: Array<{ method: PaymentMethod; amount_cents: number }> = [];
      for (const [method, amount] of userData.paymentMap) {
         paymentBreakdown.push({ method, amount_cents: amount });

         if (!overallPaymentMap.has(method)) {
            overallPaymentMap.set(method, { count: 0, amount: 0, charges: 0 });
         }
         const pm = overallPaymentMap.get(method)!;
         pm.count++;
         pm.amount += amount;
      }

      totalOrders += userData.stats.totalOrders;
      totalHbls += userData.stats.totalHbls;
      totalWeight += userData.stats.totalWeight;
      totalBilled += userData.stats.totalBilled;
      totalCollected += userData.stats.totalCollected;
      totalCharges += userData.stats.totalCharges;
      totalDebtCollections += userData.stats.debtCollections;

      users.push({
         user_id: uId,
         user_name: userData.user.name || "Sin nombre",
         user_email: userData.user.email,
         summary: {
            total_orders: userData.stats.totalOrders,
            total_hbls: userData.stats.totalHbls,
            total_weight_lbs: Math.round(userData.stats.totalWeight * 100) / 100,
            total_billed_cents: userData.stats.totalBilled,
            total_collected_cents: userData.stats.totalCollected,
            total_charges_cents: userData.stats.totalCharges,
            total_discounts_cents: userData.stats.totalDiscounts,
            total_pending_cents:
               userData.stats.totalBilled - userData.stats.totalCollected + userData.stats.debtCollections,
            debt_collections_cents: userData.stats.debtCollections,
         },
         paymentBreakdown,
         orders: userData.orderRows,
      });
   }

   // Sort users by total collected
   users.sort((a, b) => b.summary.total_collected_cents - a.summary.total_collected_cents);

   // Build overall payment breakdown
   const paymentBreakdown: SalesReportData["paymentBreakdown"] = [];
   for (const [method, data] of overallPaymentMap) {
      paymentBreakdown.push({
         method,
         total_payments: data.count,
         total_amount_cents: data.amount,
         total_charges_cents: data.charges,
      });
   }

   // Get filtered user info if applicable
   let filteredUserInfo: { id: string; name: string } | undefined;
   if (userId) {
      const filteredUser = await prisma.user.findUnique({
         where: { id: userId },
         select: { id: true, name: true },
      });
      if (filteredUser) {
         filteredUserInfo = { id: filteredUser.id, name: filteredUser.name || "Usuario" };
      }
   }

   return {
      date: startDate.toISOString().split("T")[0],
      dateRange:
         startDate.toDateString() !== endDate.toDateString()
            ? {
                 start: startDate.toISOString().split("T")[0],
                 end: endDate.toISOString().split("T")[0],
              }
            : undefined,
      agency: agency || { id: agencyId, name: "Agencia" },
      filteredUser: filteredUserInfo,
      summary: {
         total_orders: totalOrders,
         total_hbls: totalHbls,
         total_weight_lbs: Math.round(totalWeight * 100) / 100,
         total_billed_cents: totalBilled,
         total_collected_cents: totalCollected,
         total_charges_cents: totalCharges,
         total_pending_cents: totalBilled - totalCollected + totalDebtCollections,
         debt_collections_cents: totalDebtCollections,
         active_users: users.length,
      },
      paymentBreakdown,
      users,
   };
};

/**
 * Generate PDF buffer for sales report
 */
export const generateSalesReportPdf = async (
   startDate: Date,
   endDate: Date,
   agencyId: number,
   userId?: string
): Promise<Buffer> => {
   const data = await getSalesReportData(startDate, endDate, agencyId, userId);

   return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFKit({
         size: "LETTER",
         layout: "landscape",
         margins: { top: LAYOUT.MARGIN, bottom: LAYOUT.MARGIN, left: LAYOUT.MARGIN, right: LAYOUT.MARGIN },
      });

      // Register fonts
      doc.registerFont(FONTS.REGULAR, FONT_PATHS.REGULAR);
      doc.registerFont(FONTS.MEDIUM, FONT_PATHS.MEDIUM);
      doc.registerFont(FONTS.SEMIBOLD, FONT_PATHS.SEMIBOLD);
      doc.registerFont(FONTS.BOLD, FONT_PATHS.BOLD);

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Footer text
      const footerText = `Generado: ${new Date().toLocaleString("es-ES")} | CTEnvios`;
      let pageCount = 1;

      // Add footer to current page (saves and restores position)
      const addFooter = (): void => {
         const savedY = doc.y;
         doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.GRAY);
         doc.text(footerText, LAYOUT.MARGIN, LAYOUT.PAGE_HEIGHT - 25, {
            align: "center",
            width: LAYOUT.CONTENT_WIDTH,
            lineBreak: false,
         });
         doc.y = savedY;
      };

      let y = LAYOUT.MARGIN;

      // ========== HEADER ==========
      doc.font(FONTS.BOLD).fontSize(16).fillColor(COLORS.BLACK);
      doc.text("REPORTE DE VENTAS", LAYOUT.MARGIN, y, { align: "center", width: LAYOUT.CONTENT_WIDTH });
      y += 25;

      doc.font(FONTS.MEDIUM).fontSize(12);
      doc.text(data.agency.name, LAYOUT.MARGIN, y, { align: "center", width: LAYOUT.CONTENT_WIDTH });
      y += 18;

      // Show filtered user if applicable
      if (data.filteredUser) {
         doc.font(FONTS.REGULAR).fontSize(10).fillColor(COLORS.GRAY);
         doc.text(`Usuario: ${data.filteredUser.name}`, LAYOUT.MARGIN, y, {
            align: "center",
            width: LAYOUT.CONTENT_WIDTH,
         });
         y += 15;
      }

      doc.font(FONTS.REGULAR).fontSize(10).fillColor(COLORS.GRAY);
      const dateText = data.dateRange ? `${data.dateRange.start} al ${data.dateRange.end}` : `Fecha: ${data.date}`;
      doc.text(dateText, LAYOUT.MARGIN, y, { align: "center", width: LAYOUT.CONTENT_WIDTH });
      y += 30;

      // ========== SUMMARY BOXES ==========
      const boxWidth = (LAYOUT.CONTENT_WIDTH - 40) / 5;
      const boxHeight = 50;
      const boxY = y;

      // Box 1: Órdenes
      drawSummaryBox(
         doc,
         LAYOUT.MARGIN,
         boxY,
         boxWidth,
         boxHeight,
         "Órdenes Hoy",
         `${data.summary.total_orders}`,
         `${data.summary.total_hbls} HBLs`
      );

      // Box 2: Total Facturado
      drawSummaryBox(
         doc,
         LAYOUT.MARGIN + boxWidth + 10,
         boxY,
         boxWidth,
         boxHeight,
         "Facturado Hoy",
         formatCents(data.summary.total_billed_cents),
         `${data.summary.total_weight_lbs} lbs`
      );

      // Box 3: Deudas Cobradas
      drawSummaryBox(
         doc,
         LAYOUT.MARGIN + (boxWidth + 10) * 2,
         boxY,
         boxWidth,
         boxHeight,
         "Deudas Cobradas",
         formatCents(data.summary.debt_collections_cents),
         "De días anteriores"
      );

      // Box 4: Total Recaudado
      drawSummaryBox(
         doc,
         LAYOUT.MARGIN + (boxWidth + 10) * 3,
         boxY,
         boxWidth,
         boxHeight,
         "Total Recaudado",
         formatCents(data.summary.total_collected_cents),
         data.summary.total_charges_cents > 0 ? `+${formatCents(data.summary.total_charges_cents)} cargos` : ""
      );

      // Box 5: Pendiente
      drawSummaryBox(
         doc,
         LAYOUT.MARGIN + (boxWidth + 10) * 4,
         boxY,
         boxWidth,
         boxHeight,
         "Pendiente",
         formatCents(data.summary.total_pending_cents),
         ""
      );

      y = boxY + boxHeight + 20;

      // ========== PAYMENT METHODS ==========
      if (data.paymentBreakdown.length > 0) {
         doc.font(FONTS.SEMIBOLD).fontSize(10).fillColor(COLORS.BLACK);
         doc.text("Métodos de Pago:", LAYOUT.MARGIN, y);
         y += 15;

         doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.GRAY);
         const methodTexts = data.paymentBreakdown.map(
            (p) =>
               `${PAYMENT_METHOD_LABELS[p.method]}: ${formatCents(p.total_amount_cents)} (${p.total_payments} pagos)`
         );
         doc.text(methodTexts.join("  •  "), LAYOUT.MARGIN, y);
         y += 16;
      }

      // ========== USERS SECTION ==========

      y += 10;

      doc.font(FONTS.BOLD).fontSize(11).fillColor(COLORS.BLACK);
      doc.text("DETALLE POR USUARIO", LAYOUT.MARGIN, y);
      y += 20;

      for (const user of data.users) {
         // Check if we need a new page
         if (y > LAYOUT.PAGE_HEIGHT - 200) {
            addFooter();
            doc.addPage();
            y = LAYOUT.MARGIN;
         }

         // User header
         doc.font(FONTS.SEMIBOLD).fontSize(10).fillColor(COLORS.BLACK);
         doc.text(user.user_name, LAYOUT.MARGIN, y);

         // User summary on the right
         doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.GRAY);
         const debtText =
            user.summary.debt_collections_cents > 0
               ? ` | Deudas: ${formatCents(user.summary.debt_collections_cents)}`
               : "";
         const userSummary = `${user.summary.total_orders} órdenes | Facturado: ${formatCents(
            user.summary.total_billed_cents
         )} | Recaudado: ${formatCents(user.summary.total_collected_cents)}${debtText} | Pendiente: ${formatCents(
            user.summary.total_pending_cents
         )}`;
         doc.text(userSummary, LAYOUT.MARGIN + 200, y, { width: LAYOUT.CONTENT_WIDTH - 200, align: "right" });
         y += 20;

         // Payment methods for user
         if (user.paymentBreakdown.length > 0) {
            doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.GRAY);
            const userMethods = user.paymentBreakdown.map(
               (p) => `${PAYMENT_METHOD_LABELS[p.method]}: ${formatCents(p.amount_cents)}`
            );
            doc.text(userMethods.join(" | "), LAYOUT.MARGIN, y);
            y += 12;
         }

         // Orders table header (landscape layout - more space)
         const tableY = y;
         const colWidths = [35, 70, 100, 95, 45, 60, 50, 50, 50, 60, 35];
         const headers = [
            "Orden",
            "Fecha/Hora",
            "Cliente",
            "Receptor",
            "Servicio",
            "HBLs/Peso",
            "Total",
            "Pagado",
            "Pendiente",
            "Método",
            "Tipo",
         ];

         doc.font(FONTS.MEDIUM).fontSize(7).fillColor(COLORS.BLACK);
         let xPos = LAYOUT.MARGIN;
         headers.forEach((header, i) => {
            doc.text(header, xPos, tableY, { width: colWidths[i] });
            xPos += colWidths[i];
         });
         y = tableY + 12;

         // Draw header line
         doc.moveTo(LAYOUT.MARGIN, y)
            .lineTo(LAYOUT.MARGIN + LAYOUT.CONTENT_WIDTH, y)
            .stroke(COLORS.LIGHT_GRAY);
         y += 3;

         // Orders rows
         const ROW_HEIGHT = 12;
         const FONT_SIZE = 7;
         const TEXT_OFFSET = (ROW_HEIGHT - FONT_SIZE) / 2; // Center text vertically

         doc.font(FONTS.REGULAR).fontSize(FONT_SIZE).fillColor(COLORS.GRAY);
         for (const order of user.orders) {
            if (y > LAYOUT.PAGE_HEIGHT - 60) {
               addFooter();
               doc.addPage();
               y = LAYOUT.MARGIN;
            }

            xPos = LAYOUT.MARGIN;
            const paymentMethodsText =
               order.payment_methods.length > 0
                  ? order.payment_methods.map((m) => PAYMENT_METHOD_LABELS[m]).join(", ")
                  : "-";

            // For debt collections, show original order date
            const dateToShow =
               order.is_debt_collection && order.original_order_date ? order.original_order_date : order.created_at;

            const rowData = [
               `#${order.order_id}`,
               formatDateTime(dateToShow),
               order.customer_name,
               order.receiver_name,
               order.service_name.substring(0, 5),
               `${order.hbl_count} / ${order.weight_lbs}`,
               formatCents(order.total_cents),
               formatCents(order.paid_cents),
               formatCents(order.pending_cents),
               paymentMethodsText,
               order.is_debt_collection ? "DEUDA" : "",
            ];

            // Highlight debt collections with orange color
            if (order.is_debt_collection) {
               doc.fillColor("#D97706");
            } else {
               doc.fillColor(COLORS.GRAY);
            }

            rowData.forEach((text, i) => {
               doc.text(text, xPos, y + TEXT_OFFSET, { width: colWidths[i] });
               xPos += colWidths[i];
            });
            y += ROW_HEIGHT;
         }

         y += 10;

         // Separator line between users
         doc.moveTo(LAYOUT.MARGIN, y)
            .lineTo(LAYOUT.MARGIN + LAYOUT.CONTENT_WIDTH, y)
            .stroke(COLORS.LIGHT_GRAY);
         y += 15;
      }

      // Add footer to the first page (and last if content ends before a new page)
      addFooter();

      doc.end();
   });
};

// Helper function to draw summary box
function drawSummaryBox(
   doc: PDFKit.PDFDocument,
   x: number,
   y: number,
   width: number,
   height: number,
   label: string,
   value: string,
   subtitle: string
): void {
   // Border
   doc.rect(x, y, width, height).stroke(COLORS.LIGHT_GRAY);

   // Label
   doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.GRAY);
   doc.text(label, x + 5, y + 5, { width: width - 10 });

   // Value
   doc.font(FONTS.BOLD).fontSize(12).fillColor(COLORS.BLACK);
   doc.text(value, x + 5, y + 18, { width: width - 10 });

   // Subtitle
   if (subtitle) {
      doc.font(FONTS.REGULAR).fontSize(7).fillColor(COLORS.GRAY);
      doc.text(subtitle, x + 5, y + 35, { width: width - 10 });
   }
}

export default generateSalesReportPdf;
