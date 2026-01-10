import prisma from "../lib/prisma.client";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

/**
 * Financial Reports Repository
 * Following: Repository pattern, TypeScript strict typing
 */

interface DateRange {
   start: Date;
   end: Date;
}

interface SalesReportByAgency {
   agency_id: number;
   agency_name: string;
   total_orders: number;
   total_billed_cents: number;
   total_paid_cents: number;
   total_pending_cents: number;
   total_discounts_cents: number;
   orders_paid: number;
   orders_pending: number;
   orders_partially_paid: number;
}

interface SalesReportByUser {
   user_id: string;
   user_name: string;
   user_email: string;
   agency_name: string;
   total_orders: number;
   total_billed_cents: number;
   total_paid_cents: number;
   total_pending_cents: number;
   orders_paid: number;
   orders_pending: number;
}

interface PaymentMethodBreakdown {
   method: PaymentMethod;
   total_payments: number;
   total_amount_cents: number;
   total_charges_cents: number;
}

interface CustomerDebt {
   customer_id: number;
   customer_name: string;
   customer_phone: string | null;
   total_orders: number;
   total_billed_cents: number;
   total_paid_cents: number;
   total_debt_cents: number;
   oldest_pending_order: Date | null;
}

interface DailySalesReport {
   date: string;
   total_orders: number;
   total_billed_cents: number;
   total_paid_cents: number;
   total_pending_cents: number;
}

interface AgencyFinancialSummary {
   agency_id: number;
   agency_name: string;
   period: string;
   total_orders: number;
   total_billed_cents: number;
   total_paid_cents: number;
   total_pending_cents: number;
   total_discounts_cents: number;
   payment_breakdown: PaymentMethodBreakdown[];
   top_users: SalesReportByUser[];
   customer_debts: CustomerDebt[];
}

/**
 * Get date range helpers
 */
const getDateRange = (
   period: "today" | "week" | "month" | "year" | "custom",
   customStart?: Date,
   customEnd?: Date
): DateRange => {
   const now = new Date();
   let start: Date;
   let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

   switch (period) {
      case "today":
         start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
         break;
      case "week":
         const dayOfWeek = now.getDay();
         start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
         break;
      case "month":
         start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
         break;
      case "year":
         start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
         break;
      case "custom":
         start = customStart || new Date(now.getFullYear(), now.getMonth(), 1);
         end = customEnd || end;
         break;
      default:
         start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
   }

   return { start, end };
};

const financialReports = {
   /**
    * Get sales report by agency for a period
    */
   getSalesByAgency: async (
      period: "today" | "week" | "month" | "year" | "custom",
      agency_id?: number,
      customStart?: Date,
      customEnd?: Date
   ): Promise<SalesReportByAgency[]> => {
      const { start, end } = getDateRange(period, customStart, customEnd);

      const where: any = {
         created_at: { gte: start, lte: end },
      };

      if (agency_id) {
         where.agency_id = agency_id;
      }

      const results = await prisma.order.groupBy({
         by: ["agency_id"],
         where,
         _count: { id: true },
         _sum: {
            total_in_cents: true,
            paid_in_cents: true,
         },
      });

      // Get agency names and payment status counts
      const enrichedResults = await Promise.all(
         results.map(async (r) => {
            const agency = await prisma.agency.findUnique({
               where: { id: r.agency_id },
               select: { name: true },
            });

            const statusCounts = await prisma.order.groupBy({
               by: ["payment_status"],
               where: { ...where, agency_id: r.agency_id },
               _count: { id: true },
            });

            const discounts = await prisma.discount.aggregate({
               where: {
                  order: { ...where, agency_id: r.agency_id },
               },
               _sum: { discount_in_cents: true },
            });

            const statusMap = statusCounts.reduce((acc, s) => {
               acc[s.payment_status] = s._count.id;
               return acc;
            }, {} as Record<string, number>);

            return {
               agency_id: r.agency_id,
               agency_name: agency?.name || "Unknown",
               total_orders: r._count.id,
               total_billed_cents: r._sum.total_in_cents || 0,
               total_paid_cents: r._sum.paid_in_cents || 0,
               total_pending_cents: (r._sum.total_in_cents || 0) - (r._sum.paid_in_cents || 0),
               total_discounts_cents: discounts._sum.discount_in_cents || 0,
               orders_paid: statusMap[PaymentStatus.PAID] || 0,
               orders_pending: statusMap[PaymentStatus.PENDING] || 0,
               orders_partially_paid: statusMap[PaymentStatus.PARTIALLY_PAID] || 0,
            };
         })
      );

      return enrichedResults;
   },

   /**
    * Get sales report by user (who created the orders)
    */
   getSalesByUser: async (
      period: "today" | "week" | "month" | "year" | "custom",
      agency_id?: number,
      customStart?: Date,
      customEnd?: Date
   ): Promise<SalesReportByUser[]> => {
      const { start, end } = getDateRange(period, customStart, customEnd);

      const where: any = {
         created_at: { gte: start, lte: end },
      };

      if (agency_id) {
         where.agency_id = agency_id;
      }

      const results = await prisma.order.groupBy({
         by: ["user_id"],
         where,
         _count: { id: true },
         _sum: {
            total_in_cents: true,
            paid_in_cents: true,
         },
      });

      const enrichedResults = await Promise.all(
         results.map(async (r) => {
            const user = await prisma.user.findUnique({
               where: { id: r.user_id },
               select: { name: true, email: true, agency: { select: { name: true } } },
            });

            const statusCounts = await prisma.order.groupBy({
               by: ["payment_status"],
               where: { ...where, user_id: r.user_id },
               _count: { id: true },
            });

            const statusMap = statusCounts.reduce((acc, s) => {
               acc[s.payment_status] = s._count.id;
               return acc;
            }, {} as Record<string, number>);

            return {
               user_id: r.user_id,
               user_name: user?.name || "Unknown",
               user_email: user?.email || "",
               agency_name: user?.agency?.name || "Unknown",
               total_orders: r._count.id,
               total_billed_cents: r._sum.total_in_cents || 0,
               total_paid_cents: r._sum.paid_in_cents || 0,
               total_pending_cents: (r._sum.total_in_cents || 0) - (r._sum.paid_in_cents || 0),
               orders_paid: statusMap[PaymentStatus.PAID] || 0,
               orders_pending: statusMap[PaymentStatus.PENDING] || 0,
            };
         })
      );

      return enrichedResults.sort((a, b) => b.total_billed_cents - a.total_billed_cents);
   },

   /**
    * Get payment method breakdown
    */
   getPaymentMethodBreakdown: async (
      period: "today" | "week" | "month" | "year" | "custom",
      agency_id?: number,
      customStart?: Date,
      customEnd?: Date
   ): Promise<PaymentMethodBreakdown[]> => {
      const { start, end } = getDateRange(period, customStart, customEnd);

      const where: any = {
         date: { gte: start, lte: end },
      };

      if (agency_id) {
         where.order = { agency_id };
      }

      const results = await prisma.payment.groupBy({
         by: ["method"],
         where,
         _count: { id: true },
         _sum: {
            amount_in_cents: true,
            charge_in_cents: true,
         },
      });

      return results.map((r) => ({
         method: r.method,
         total_payments: r._count.id,
         total_amount_cents: r._sum.amount_in_cents || 0,
         total_charges_cents: r._sum.charge_in_cents || 0,
      }));
   },

   /**
    * Get customer debts
    */
   getCustomerDebts: async (agency_id?: number, limit: number = 50): Promise<CustomerDebt[]> => {
      const where: any = {
         payment_status: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIALLY_PAID] },
      };

      if (agency_id) {
         where.agency_id = agency_id;
      }

      const results = await prisma.order.groupBy({
         by: ["customer_id"],
         where,
         _count: { id: true },
         _sum: {
            total_in_cents: true,
            paid_in_cents: true,
         },
         _min: { created_at: true },
      });

      const enrichedResults = await Promise.all(
         results.map(async (r) => {
            const customer = await prisma.customer.findUnique({
               where: { id: r.customer_id },
               select: { first_name: true, last_name: true, mobile: true },
            });

            const debtAmount = (r._sum.total_in_cents || 0) - (r._sum.paid_in_cents || 0);

            return {
               customer_id: r.customer_id,
               customer_name: customer ? `${customer.first_name} ${customer.last_name}` : "Unknown",
               customer_phone: customer?.mobile || null,
               total_orders: r._count.id,
               total_billed_cents: r._sum.total_in_cents || 0,
               total_paid_cents: r._sum.paid_in_cents || 0,
               total_debt_cents: debtAmount,
               oldest_pending_order: r._min.created_at,
            };
         })
      );

      return enrichedResults
         .filter((r) => r.total_debt_cents > 0)
         .sort((a, b) => b.total_debt_cents - a.total_debt_cents)
         .slice(0, limit);
   },

   /**
    * Get daily sales breakdown for a month
    */
   getDailySalesBreakdown: async (year: number, month: number, agency_id?: number): Promise<DailySalesReport[]> => {
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const end = new Date(year, month, 0, 23, 59, 59, 999);

      const where: any = {
         created_at: { gte: start, lte: end },
      };

      if (agency_id) {
         where.agency_id = agency_id;
      }

      const orders = await prisma.order.findMany({
         where,
         select: {
            created_at: true,
            total_in_cents: true,
            paid_in_cents: true,
         },
      });

      // Group by date
      const dailyMap = new Map<string, DailySalesReport>();

      for (const order of orders) {
         const dateKey = order.created_at.toISOString().split("T")[0];

         if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, {
               date: dateKey,
               total_orders: 0,
               total_billed_cents: 0,
               total_paid_cents: 0,
               total_pending_cents: 0,
            });
         }

         const day = dailyMap.get(dateKey)!;
         day.total_orders++;
         day.total_billed_cents += order.total_in_cents;
         day.total_paid_cents += order.paid_in_cents;
         day.total_pending_cents += order.total_in_cents - order.paid_in_cents;
      }

      return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
   },

   /**
    * Get complete financial summary for an agency
    */
   getAgencyFinancialSummary: async (
      agency_id: number,
      period: "today" | "week" | "month" | "year" | "custom",
      customStart?: Date,
      customEnd?: Date
   ): Promise<AgencyFinancialSummary> => {
      const [salesByAgency] = await financialReports.getSalesByAgency(period, agency_id, customStart, customEnd);
      const paymentBreakdown = await financialReports.getPaymentMethodBreakdown(
         period,
         agency_id,
         customStart,
         customEnd
      );
      const topUsers = await financialReports.getSalesByUser(period, agency_id, customStart, customEnd);
      const customerDebts = await financialReports.getCustomerDebts(agency_id, 20);

      const agency = await prisma.agency.findUnique({
         where: { id: agency_id },
         select: { name: true },
      });

      return {
         agency_id,
         agency_name: agency?.name || "Unknown",
         period,
         total_orders: salesByAgency?.total_orders || 0,
         total_billed_cents: salesByAgency?.total_billed_cents || 0,
         total_paid_cents: salesByAgency?.total_paid_cents || 0,
         total_pending_cents: salesByAgency?.total_pending_cents || 0,
         total_discounts_cents: salesByAgency?.total_discounts_cents || 0,
         payment_breakdown: paymentBreakdown,
         top_users: topUsers.slice(0, 10),
         customer_debts: customerDebts,
      };
   },

   /**
    * Get orders pending payment for a customer
    */
   getCustomerPendingOrders: async (
      customer_id: number
   ): Promise<{
      customer: { id: number; name: string; phone: string | null };
      pending_orders: Array<{
         order_id: number;
         created_at: Date;
         total_in_cents: number;
         paid_in_cents: number;
         pending_cents: number;
         payment_status: PaymentStatus;
      }>;
      total_debt_cents: number;
   }> => {
      const customer = await prisma.customer.findUnique({
         where: { id: customer_id },
         select: { id: true, first_name: true, last_name: true, mobile: true },
      });

      if (!customer) {
         throw new Error("Customer not found");
      }

      const orders = await prisma.order.findMany({
         where: {
            customer_id,
            payment_status: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIALLY_PAID] },
         },
         select: {
            id: true,
            created_at: true,
            total_in_cents: true,
            paid_in_cents: true,
            payment_status: true,
         },
         orderBy: { created_at: "asc" },
      });

      const pendingOrders = orders.map((o) => ({
         order_id: o.id,
         created_at: o.created_at,
         total_in_cents: o.total_in_cents,
         paid_in_cents: o.paid_in_cents,
         pending_cents: o.total_in_cents - o.paid_in_cents,
         payment_status: o.payment_status,
      }));

      const totalDebt = pendingOrders.reduce((sum, o) => sum + o.pending_cents, 0);

      return {
         customer: {
            id: customer.id,
            name: `${customer.first_name} ${customer.last_name}`,
            phone: customer.mobile,
         },
         pending_orders: pendingOrders,
         total_debt_cents: totalDebt,
      };
   },

   /**
    * Get monthly comparison (current vs previous month)
    */
   getMonthlyComparison: async (
      agency_id?: number
   ): Promise<{
      current_month: SalesReportByAgency[];
      previous_month: SalesReportByAgency[];
      growth_percentage: number;
   }> => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      const [currentMonth, previousMonth] = await Promise.all([
         financialReports.getSalesByAgency("custom", agency_id, currentMonthStart, currentMonthEnd),
         financialReports.getSalesByAgency("custom", agency_id, previousMonthStart, previousMonthEnd),
      ]);

      const currentTotal = currentMonth.reduce((sum, a) => sum + a.total_billed_cents, 0);
      const previousTotal = previousMonth.reduce((sum, a) => sum + a.total_billed_cents, 0);

      const growthPercentage = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

      return {
         current_month: currentMonth,
         previous_month: previousMonth,
         growth_percentage: Math.round(growthPercentage * 100) / 100,
      };
   },

   /**
    * Get detailed orders report with full information
    */
   getOrdersDetailedReport: async (
      period: "today" | "week" | "month" | "year" | "custom",
      agency_id?: number,
      payment_status?: PaymentStatus,
      customStart?: Date,
      customEnd?: Date,
      page: number = 1,
      limit: number = 50
   ): Promise<{
      orders: OrderDetailedReport[];
      pagination: { page: number; limit: number; total: number; total_pages: number };
      totals: {
         total_orders: number;
         total_hbls: number;
         total_weight_lbs: number;
         total_billed_cents: number;
         total_paid_cents: number;
         total_pending_cents: number;
         total_discounts_cents: number;
      };
   }> => {
      const { start, end } = getDateRange(period, customStart, customEnd);

      const where: any = {
         created_at: { gte: start, lte: end },
      };

      if (agency_id) {
         where.agency_id = agency_id;
      }

      if (payment_status) {
         where.payment_status = payment_status;
      }

      const [orders, total] = await Promise.all([
         prisma.order.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { created_at: "desc" },
            include: {
               customer: {
                  select: { id: true, first_name: true, last_name: true, mobile: true },
               },
               receiver: {
                  select: {
                     id: true,
                     first_name: true,
                     last_name: true,
                     phone: true,
                     address: true,
                     city: { select: { name: true } },
                  },
               },
               user: {
                  select: { id: true, name: true, email: true },
               },
               agency: {
                  select: { id: true, name: true },
               },
               service: {
                  select: { id: true, name: true, service_type: true },
               },
               parcels: {
                  select: { id: true, tracking_number: true, weight: true, status: true },
               },
               payments: {
                  select: { id: true, amount_in_cents: true, method: true, date: true },
               },
               discounts: {
                  select: { id: true, discount_in_cents: true, type: true, description: true },
               },
            },
         }),
         prisma.order.count({ where }),
      ]);

      const detailedOrders: OrderDetailedReport[] = orders.map((order) => {
         const totalWeight = order.parcels.reduce((sum, p) => sum + Number(p.weight), 0);
         const totalDiscounts = order.discounts.reduce((sum, d) => sum + d.discount_in_cents, 0);
         const paymentMethods = [...new Set(order.payments.map((p) => p.method))];

         return {
            order_id: order.id,
            created_at: order.created_at,
            agency: {
               id: order.agency.id,
               name: order.agency.name,
            },
            user: {
               id: order.user.id,
               name: order.user.name,
               email: order.user.email,
            },
            customer: {
               id: order.customer.id,
               name: `${order.customer.first_name} ${order.customer.last_name}`,
               phone: order.customer.mobile,
            },
            receiver: {
               id: order.receiver.id,
               name: `${order.receiver.first_name} ${order.receiver.last_name}`,
               phone: order.receiver.phone,
               address: order.receiver.address,
               city: order.receiver.city?.name || null,
            },
            service: {
               id: order.service.id,
               name: order.service.name,
               type: order.service.service_type,
            },
            hbl_count: order.parcels.length,
            total_weight_lbs: Math.round(totalWeight * 100) / 100,
            parcels: order.parcels.map((p) => ({
               tracking_number: p.tracking_number,
               weight: Number(p.weight),
               status: p.status,
            })),
            total_in_cents: order.total_in_cents,
            paid_in_cents: order.paid_in_cents,
            pending_in_cents: order.total_in_cents - order.paid_in_cents,
            discounts_in_cents: totalDiscounts,
            payment_status: order.payment_status,
            payment_methods: paymentMethods,
            payments: order.payments.map((p) => ({
               amount_cents: p.amount_in_cents,
               method: p.method,
               date: p.date,
            })),
         };
      });

      // Calculate totals for all matching orders (not just current page)
      const allOrdersForTotals = await prisma.order.findMany({
         where,
         select: {
            total_in_cents: true,
            paid_in_cents: true,
            parcels: { select: { weight: true } },
            discounts: { select: { discount_in_cents: true } },
         },
      });

      const totals = allOrdersForTotals.reduce(
         (acc, order) => {
            acc.total_orders++;
            acc.total_hbls += order.parcels.length;
            acc.total_weight_lbs += order.parcels.reduce((sum, p) => sum + Number(p.weight), 0);
            acc.total_billed_cents += order.total_in_cents;
            acc.total_paid_cents += order.paid_in_cents;
            acc.total_pending_cents += order.total_in_cents - order.paid_in_cents;
            acc.total_discounts_cents += order.discounts.reduce((sum, d) => sum + d.discount_in_cents, 0);
            return acc;
         },
         {
            total_orders: 0,
            total_hbls: 0,
            total_weight_lbs: 0,
            total_billed_cents: 0,
            total_paid_cents: 0,
            total_pending_cents: 0,
            total_discounts_cents: 0,
         }
      );

      totals.total_weight_lbs = Math.round(totals.total_weight_lbs * 100) / 100;

      return {
         orders: detailedOrders,
         pagination: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
         },
         totals,
      };
   },

   /**
    * Get daily closing report by user
    * Shows each user's orders and totals for a specific day
    */
   getDailyClosingByUser: async (
      date: Date,
      agency_id?: number,
      user_id?: string
   ): Promise<{
      date: string;
      date_range: { start: string; end: string };
      total_orders_found: number;
      agency?: { id: number; name: string };
      user?: { id: string; name: string; email: string };
      users: UserDailyClosing[];
      totals: {
         total_orders: number;
         total_hbls: number;
         total_weight_lbs: number;
         total_billed_cents: number;
         total_paid_cents: number;
         total_charges_cents: number; // Card processing fees
         grand_total_collected_cents: number; // paid
         total_pending_cents: number;
         total_discounts_cents: number;
         payment_breakdown: PaymentMethodBreakdown[];
      };
   }> => {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

      const where: any = {
         created_at: { gte: startOfDay, lte: endOfDay },
      };

      if (agency_id) {
         where.agency_id = agency_id;
      }

      if (user_id) {
         where.user_id = user_id;
      }

      // Get all orders for the day with full details
      const orders = await prisma.order.findMany({
         where,
         orderBy: { created_at: "asc" },
         include: {
            user: { select: { id: true, name: true, email: true } },
            agency: { select: { id: true, name: true } },
            customer: { select: { id: true, first_name: true, last_name: true, mobile: true } },
            receiver: {
               select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  phone: true,
                  address: true,
                  city: { select: { name: true } },
               },
            },
            service: { select: { id: true, name: true, service_type: true } },
            parcels: { select: { id: true, tracking_number: true, weight: true, status: true } },
            payments: { select: { id: true, amount_in_cents: true, charge_in_cents: true, method: true, date: true } },
            discounts: { select: { id: true, discount_in_cents: true, type: true, description: true } },
         },
      });

      // Group by user
      const userMap = new Map<
         string,
         {
            user: { id: string; name: string | null; email: string };
            orders: typeof orders;
         }
      >();

      for (const order of orders) {
         if (!userMap.has(order.user_id)) {
            userMap.set(order.user_id, {
               user: order.user,
               orders: [],
            });
         }
         userMap.get(order.user_id)!.orders.push(order);
      }

      // Build user closing reports
      const users: UserDailyClosing[] = [];

      for (const [userId, data] of userMap) {
         const userOrders = data.orders;

         // Payment method breakdown for this user
         const paymentMap = new Map<PaymentMethod, { count: number; amount: number; charges: number }>();

         let totalHbls = 0;
         let totalWeight = 0;
         let totalBilled = 0;
         let totalPaid = 0;
         let totalCharges = 0;
         let totalDiscounts = 0;

         // Build order details
         const orderDetails: UserOrderDetail[] = userOrders.map((order) => {
            const orderWeight = order.parcels.reduce((sum, p) => sum + Number(p.weight), 0);
            const orderDiscounts = order.discounts.reduce((sum, d) => sum + d.discount_in_cents, 0);
            const paymentMethods = [...new Set(order.payments.map((p) => p.method))];

            totalHbls += order.parcels.length;
            totalWeight += orderWeight;
            totalBilled += order.total_in_cents;
            totalPaid += order.paid_in_cents;
            totalDiscounts += orderDiscounts;

            for (const payment of order.payments) {
               if (!paymentMap.has(payment.method)) {
                  paymentMap.set(payment.method, { count: 0, amount: 0, charges: 0 });
               }
               const pm = paymentMap.get(payment.method)!;
               pm.count++;
               pm.amount += payment.amount_in_cents;
               pm.charges += payment.charge_in_cents;
               totalCharges += payment.charge_in_cents;
            }

            return {
               order_id: order.id,
               created_at: order.created_at,
               customer: {
                  id: order.customer.id,
                  name: `${order.customer.first_name} ${order.customer.last_name}`,
                  phone: order.customer.mobile,
               },
               receiver: {
                  id: order.receiver.id,
                  name: `${order.receiver.first_name} ${order.receiver.last_name}`,
                  city: order.receiver.city?.name || null,
               },
               service: order.service.name,
               hbl_count: order.parcels.length,
               total_weight_lbs: Math.round(orderWeight * 100) / 100,
               total_in_cents: order.total_in_cents,
               paid_in_cents: order.paid_in_cents,
               pending_in_cents: order.total_in_cents - order.paid_in_cents,
               discounts_in_cents: orderDiscounts,
               payment_status: order.payment_status,
               payment_methods: paymentMethods,
               payments: order.payments.map((p) => ({
                  amount_cents: p.amount_in_cents,
                  charge_cents: p.charge_in_cents,
                  total_cents: p.amount_in_cents + p.charge_in_cents,
                  method: p.method,
                  date: p.date,
               })),
            };
         });

         const paymentBreakdown: PaymentMethodBreakdown[] = [];
         for (const [method, stats] of paymentMap) {
            paymentBreakdown.push({
               method,
               total_payments: stats.count,
               total_amount_cents: stats.amount,
               total_charges_cents: stats.charges,
            });
         }

         users.push({
            user_id: userId,
            user_name: data.user.name || "Unknown",
            user_email: data.user.email,
            summary: {
               total_orders: userOrders.length,
               total_hbls: totalHbls,
               total_weight_lbs: Math.round(totalWeight * 100) / 100,
               total_billed_cents: totalBilled,
               total_paid_cents: totalPaid,
               total_charges_cents: totalCharges, // Card processing fees
               grand_total_collected_cents: totalPaid,
               total_pending_cents: totalBilled - totalPaid,
               total_discounts_cents: totalDiscounts,
            },
            payment_breakdown: paymentBreakdown,
            orders: orderDetails,
         });
      }

      // Sort by total billed (highest first)
      users.sort((a, b) => b.summary.total_billed_cents - a.summary.total_billed_cents);

      // Calculate overall totals
      const overallPaymentMap = new Map<PaymentMethod, { count: number; amount: number; charges: number }>();

      const totals = orders.reduce(
         (acc, order) => {
            acc.total_orders++;
            acc.total_hbls += order.parcels.length;
            acc.total_weight_lbs += order.parcels.reduce((sum, p) => sum + Number(p.weight), 0);
            acc.total_billed_cents += order.total_in_cents;
            acc.total_paid_cents += order.paid_in_cents;
            acc.total_pending_cents += order.total_in_cents - order.paid_in_cents;
            acc.total_discounts_cents += order.discounts.reduce((sum, d) => sum + d.discount_in_cents, 0);

            for (const payment of order.payments) {
               if (!overallPaymentMap.has(payment.method)) {
                  overallPaymentMap.set(payment.method, { count: 0, amount: 0, charges: 0 });
               }
               const pm = overallPaymentMap.get(payment.method)!;
               pm.count++;
               pm.amount += payment.amount_in_cents;
               pm.charges += payment.charge_in_cents;
               acc.total_charges_cents += payment.charge_in_cents;
            }

            return acc;
         },
         {
            total_orders: 0,
            total_hbls: 0,
            total_weight_lbs: 0,
            total_billed_cents: 0,
            total_paid_cents: 0,
            total_charges_cents: 0,
            grand_total_collected_cents: 0,
            total_pending_cents: 0,
            total_discounts_cents: 0,
         }
      );

      totals.total_weight_lbs = Math.round(totals.total_weight_lbs * 100) / 100;
      totals.grand_total_collected_cents = totals.total_paid_cents;

      const overallPaymentBreakdown: PaymentMethodBreakdown[] = [];
      for (const [method, stats] of overallPaymentMap) {
         overallPaymentBreakdown.push({
            method,
            total_payments: stats.count,
            total_amount_cents: stats.amount,
            total_charges_cents: stats.charges,
         });
      }

      // Get agency info if filtering
      let agencyInfo: { id: number; name: string } | undefined;
      if (agency_id) {
         const agency = await prisma.agency.findUnique({
            where: { id: agency_id },
            select: { id: true, name: true },
         });
         if (agency) agencyInfo = agency;
      }

      // Get user info if filtering by specific user
      let userInfo: { id: string; name: string; email: string } | undefined;
      if (user_id) {
         const user = await prisma.user.findUnique({
            where: { id: user_id },
            select: { id: true, name: true, email: true },
         });
         if (user) {
            userInfo = { id: user.id, name: user.name || "Unknown", email: user.email };
         }
      }

      return {
         date: startOfDay.toISOString().split("T")[0],
         date_range: {
            start: startOfDay.toISOString(),
            end: endOfDay.toISOString(),
         },
         total_orders_found: orders.length,
         agency: agencyInfo,
         user: userInfo,
         users,
         totals: {
            ...totals,
            payment_breakdown: overallPaymentBreakdown,
         },
      };
   },

   /**
    * Get daily sales report with billing and collections
    * - Billing (Facturación): Orders created that day
    * - Collections (Recaudación): Payments received that day (may be from older orders)
    */
   getDailySalesReport: async (date: Date, agency_id: number, user_id?: string): Promise<DailySalesReportResult> => {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

      // ========== BILLING: Orders created today ==========
      const ordersWhere: any = {
         created_at: { gte: startOfDay, lte: endOfDay },
         agency_id,
      };
      if (user_id) {
         ordersWhere.user_id = user_id;
      }

      const orders = await prisma.order.findMany({
         where: ordersWhere,
         orderBy: { created_at: "asc" },
         include: {
            user: { select: { id: true, name: true, email: true } },
            customer: { select: { id: true, first_name: true, last_name: true } },
            parcels: { select: { id: true, weight: true } },
            payments: {
               where: { date: { gte: startOfDay, lte: endOfDay } }, // Only today's payments
               select: { amount_in_cents: true, method: true, date: true },
            },
         },
      });

      const billingOrders: DailySaleOrder[] = orders.map((order) => {
         const totalWeight = order.parcels.reduce((sum, p) => sum + Number(p.weight), 0);
         const todayPayments = order.payments; // Already filtered to today
         const todayCollected = todayPayments.reduce((sum, p) => sum + p.amount_in_cents, 0);
         const paymentMethods = [...new Set(todayPayments.map((p) => p.method))];

         return {
            order_id: order.id,
            created_at: order.created_at,
            user_name: order.user.name || "Unknown",
            customer_name: `${order.customer.first_name} ${order.customer.last_name}`,
            parcels_count: order.parcels.length,
            total_weight_lbs: Math.round(totalWeight * 100) / 100,
            total_in_cents: order.total_in_cents,
            collected_today_cents: todayCollected,
            pending_in_cents: order.total_in_cents - order.paid_in_cents,
            payment_status: order.payment_status,
            is_paid: order.payment_status === PaymentStatus.PAID,
            payment_methods: paymentMethods,
         };
      });

      // Calculate billing totals
      let ordersPaid = 0;
      let ordersPending = 0;
      let ordersPartial = 0;

      const billingTotals = orders.reduce(
         (acc, order) => {
            acc.total_orders++;
            acc.total_parcels += order.parcels.length;
            acc.total_weight_lbs += order.parcels.reduce((sum, p) => sum + Number(p.weight), 0);
            acc.total_billed_cents += order.total_in_cents;
            acc.collected_today_cents += order.payments.reduce((sum, p) => sum + p.amount_in_cents, 0);
            acc.pending_cents += order.total_in_cents - order.paid_in_cents;

            if (order.payment_status === PaymentStatus.PAID) ordersPaid++;
            else if (order.payment_status === PaymentStatus.PARTIALLY_PAID) ordersPartial++;
            else if (order.payment_status === PaymentStatus.PENDING) ordersPending++;

            return acc;
         },
         {
            total_orders: 0,
            total_parcels: 0,
            total_weight_lbs: 0,
            total_billed_cents: 0,
            collected_today_cents: 0,
            pending_cents: 0,
         }
      );
      billingTotals.total_weight_lbs = Math.round(billingTotals.total_weight_lbs * 100) / 100;

      // ========== COLLECTIONS: All payments received today ==========
      const paymentsWhere: any = {
         date: { gte: startOfDay, lte: endOfDay },
         order: { agency_id },
      };
      if (user_id) {
         paymentsWhere.user_id = user_id;
      }

      const payments = await prisma.payment.findMany({
         where: paymentsWhere,
         orderBy: { date: "asc" },
         include: {
            order: {
               select: {
                  id: true,
                  created_at: true,
                  total_in_cents: true,
                  customer: { select: { first_name: true, last_name: true } },
               },
            },
            user: { select: { id: true, name: true } },
         },
      });

      const collections: DailyCollection[] = payments.map((payment) => ({
         payment_id: payment.id,
         order_id: payment.order_id,
         order_date: payment.order.created_at,
         is_old_order: payment.order.created_at < startOfDay, // Order from previous day
         payment_date: payment.date,
         amount_cents: payment.amount_in_cents,
         charge_cents: payment.charge_in_cents, // Card processing fee
         total_cents: payment.amount_in_cents + payment.charge_in_cents, // Amount + charge
         method: payment.method,
         customer_name: `${payment.order.customer.first_name} ${payment.order.customer.last_name}`,
         collected_by: payment.user.name || "Unknown",
      }));

      // Calculate collections totals by method
      const collectionsByMethod = new Map<PaymentMethod, { amount: number; charges: number }>();
      let totalCollected = 0;
      let totalCharges = 0;
      let collectedFromOldOrders = 0;
      let collectedFromTodayOrders = 0;

      for (const payment of payments) {
         totalCollected += payment.amount_in_cents;
         totalCharges += payment.charge_in_cents;

         const current = collectionsByMethod.get(payment.method) || { amount: 0, charges: 0 };
         collectionsByMethod.set(payment.method, {
            amount: current.amount + payment.amount_in_cents,
            charges: current.charges + payment.charge_in_cents,
         });

         if (payment.order.created_at < startOfDay) {
            collectedFromOldOrders += payment.amount_in_cents;
         } else {
            collectedFromTodayOrders += payment.amount_in_cents;
         }
      }

      const collectionBreakdown: Array<{
         method: PaymentMethod;
         amount_cents: number;
         charge_cents: number;
         total_cents: number;
      }> = [];
      for (const [method, data] of collectionsByMethod) {
         collectionBreakdown.push({
            method,
            amount_cents: data.amount,
            charge_cents: data.charges,
            total_cents: data.amount + data.charges,
         });
      }

      // Get agency info
      const agency = await prisma.agency.findUnique({
         where: { id: agency_id },
         select: { id: true, name: true },
      });

      // Get user info if filtering
      let userInfo: { id: string; name: string; email: string } | undefined;
      if (user_id) {
         const user = await prisma.user.findUnique({
            where: { id: user_id },
            select: { id: true, name: true, email: true },
         });
         if (user) {
            userInfo = { id: user.id, name: user.name || "Unknown", email: user.email };
         }
      }

      return {
         date: startOfDay.toISOString().split("T")[0],
         agency: agency || { id: agency_id, name: "Unknown" },
         user: userInfo,

         // Billing section - orders created today
         billing: {
            orders: billingOrders,
            totals: {
               ...billingTotals,
               orders_paid: ordersPaid,
               orders_pending: ordersPending,
               orders_partially_paid: ordersPartial,
            },
         },

         // Collections section - payments received today
         collections: {
            payments: collections,
            totals: {
               total_collected_cents: totalCollected,
               total_charges_cents: totalCharges, // Card processing fees
               grand_total_cents: totalCollected + totalCharges, // Total including charges
               from_today_orders_cents: collectedFromTodayOrders,
               from_old_orders_cents: collectedFromOldOrders, // Deudas cobradas
               by_method: collectionBreakdown,
            },
         },

         // Summary - quick view
         summary: {
            total_billed_cents: billingTotals.total_billed_cents,
            total_collected_cents: totalCollected,
            total_charges_cents: totalCharges, // Card fees collected
            grand_total_collected_cents: totalCollected,
            new_pending_cents: billingTotals.pending_cents, // New debts created today
            old_debts_collected_cents: collectedFromOldOrders, // Old debts paid today
         },
      };
   },
};

// Interface for daily sales report result
interface DailySalesReportResult {
   date: string;
   agency: { id: number; name: string };
   user?: { id: string; name: string; email: string };
   billing: {
      orders: DailySaleOrder[];
      totals: {
         total_orders: number;
         total_parcels: number;
         total_weight_lbs: number;
         total_billed_cents: number;
         collected_today_cents: number;
         pending_cents: number;
         orders_paid: number;
         orders_pending: number;
         orders_partially_paid: number;
      };
   };
   collections: {
      payments: DailyCollection[];
      totals: {
         total_collected_cents: number;
         total_charges_cents: number; // Card processing fees
         grand_total_cents: number; // Total including charges
         from_today_orders_cents: number;
         from_old_orders_cents: number;
         by_method: Array<{ method: PaymentMethod; amount_cents: number; charge_cents: number; total_cents: number }>;
      };
   };
   summary: {
      total_billed_cents: number;
      total_collected_cents: number;
      total_charges_cents: number; // Card fees
      grand_total_collected_cents: number;
      new_pending_cents: number;
      old_debts_collected_cents: number;
   };
}

// Interface for daily collection
interface DailyCollection {
   payment_id: number;
   order_id: number;
   order_date: Date;
   is_old_order: boolean;
   payment_date: Date;
   amount_cents: number;
   charge_cents: number; // Card processing fee
   total_cents: number; // Amount + charge
   method: PaymentMethod;
   customer_name: string;
   collected_by: string;
}

// Interface for daily sale order
interface DailySaleOrder {
   order_id: number;
   created_at: Date;
   user_name: string;
   customer_name: string;
   parcels_count: number;
   total_weight_lbs: number;
   total_in_cents: number;
   collected_today_cents: number; // Amount collected TODAY for this order
   pending_in_cents: number; // Total still pending (may include old unpaid amounts)
   payment_status: PaymentStatus;
   is_paid: boolean;
   payment_methods: PaymentMethod[]; // Methods used TODAY
}

// Interface for order detail in user closing
interface UserOrderDetail {
   order_id: number;
   created_at: Date;
   customer: { id: number; name: string; phone: string };
   receiver: { id: number; name: string; city: string | null };
   service: string;
   hbl_count: number;
   total_weight_lbs: number;
   total_in_cents: number;
   paid_in_cents: number;
   pending_in_cents: number;
   discounts_in_cents: number;
   payment_status: PaymentStatus;
   payment_methods: PaymentMethod[];
   payments: Array<{
      amount_cents: number;
      charge_cents: number; // Card processing fee
      total_cents: number; // amount + charge
      method: PaymentMethod;
      date: Date;
   }>;
}

// Interface for user daily closing
interface UserDailyClosing {
   user_id: string;
   user_name: string;
   user_email: string;
   summary: {
      total_orders: number;
      total_hbls: number;
      total_weight_lbs: number;
      total_billed_cents: number;
      total_paid_cents: number;
      total_charges_cents: number; // Card processing fees
      grand_total_collected_cents: number; // paid + charges
      total_pending_cents: number;
      total_discounts_cents: number;
   };
   payment_breakdown: PaymentMethodBreakdown[];
   orders: UserOrderDetail[];
}

// Interface for detailed order report
interface OrderDetailedReport {
   order_id: number;
   created_at: Date;
   agency: { id: number; name: string };
   user: { id: string; name: string | null; email: string };
   customer: { id: number; name: string; phone: string };
   receiver: { id: number; name: string; phone: string | null; address: string | null; city: string | null };
   service: { id: number; name: string; type: string };
   hbl_count: number;
   total_weight_lbs: number;
   parcels: Array<{ tracking_number: string; weight: number; status: string }>;
   total_in_cents: number;
   paid_in_cents: number;
   pending_in_cents: number;
   discounts_in_cents: number;
   payment_status: PaymentStatus;
   payment_methods: PaymentMethod[];
   payments: Array<{ amount_cents: number; method: PaymentMethod; date: Date }>;
}

export default financialReports;
