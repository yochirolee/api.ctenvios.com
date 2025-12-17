import prisma from "../lib/prisma.client";
import repository from "../repositories";

interface LegacyParcelItem {
   id: number;
   hbl: string;
   invoiceId: number;
   invoiceUser: string;
   parcelType: number;
   description: string;
   senderId: number;
   sender: string;
   receiverId: number;
   senderMobile: string;
   senderEmail: string;
   receiver: string;
   receiverMobile: string;
   cll: string;
   entre_cll: string;
   no: string;
   apto: string;
   reparto: string;
   receiverCi: string;
   city: string;
   province: string;
   invoiceDate: string;
   currentLocation: number;
   containerName: string;
   containerDate: string;
   containerId: number;
   cityId: number;
   stateId: number;
   palletId: number;
   dispatchId: number;
   dispatchDate: string;
   dispatchStatus: number;
   palletDate: string;
   agency: string;
   agencyId: number;
   weight: string;
}

interface ParsedOrder {
   order_id?: number; // Will be null for legacy orders
   customer_id?: number;
   customer?: any;
   receiver_id?: number;
   receiver?: any;
   service_id?: number;
   service?: any;
   agency_id?: number;
   agency?: any;
   parcels: any[];
   paid_in_cents: number;
   requires_home_delivery: boolean;
   created_at: string;
   updated_at: string;
   user_id?: string;
   user?: any;
   payment_status: string;
   stage: string;
   status: string;
   partner_id?: number | null;
   partner_order_id?: string | null;
   discounts: any[];
   payments: any[];
   issues: any[];
   legacy_invoice_id?: number; // Track legacy invoice ID
}

/**
 * Parses legacy MySQL response into API order format
 * Groups items by invoiceId and transforms structure
 */
export const legacyParserService = {
   /**
    * Parse legacy parcels array into orders format
    * Groups by invoiceId and resolves relations from new database
    */
   parseLegacyParcelsToOrders: async (
      legacyParcels: LegacyParcelItem[],
      options?: {
         resolveRelations?: boolean; // Whether to resolve customer/receiver/agency from new DB
         defaultUserId?: string; // Default user ID if relations not found
         defaultServiceId?: number; // Default service ID
      }
   ): Promise<ParsedOrder[]> => {
      const { resolveRelations = true, defaultUserId, defaultServiceId = 1 } = options || {};

      // Group parcels by invoiceId
      const ordersMap = new Map<number, LegacyParcelItem[]>();
      for (const parcel of legacyParcels) {
         const invoiceId = parcel.invoiceId;
         if (!ordersMap.has(invoiceId)) {
            ordersMap.set(invoiceId, []);
         }
         ordersMap.get(invoiceId)!.push(parcel);
      }

      const parsedOrders: ParsedOrder[] = [];

      for (const [invoiceId, parcels] of ordersMap.entries()) {
         // Use first parcel for order-level data
         const firstParcel = parcels[0];

         // Parse customer
         let customer: any = null;
         let customer_id: number | undefined = undefined;
         if (resolveRelations) {
            // Try to find customer by mobile and name
            const nameParts = parseName(firstParcel.sender);
            customer = await repository.customers.getByMobileAndName(
               normalizeMobile(firstParcel.senderMobile),
               nameParts.firstName,
               nameParts.lastName
            );
            if (customer) {
               customer_id = customer.id;
            }
         }

         // Parse receiver
         let receiver: any = null;
         let receiver_id: number | undefined = undefined;
         if (resolveRelations && firstParcel.receiverCi) {
            receiver = await repository.receivers.getByCi(firstParcel.receiverCi);
            if (receiver) {
               receiver_id = receiver.id;
            }
         }

         // Parse agency
         let agency: any = null;
         let agency_id: number | undefined = undefined;
         if (resolveRelations && firstParcel.agencyId) {
            agency = await prisma.agency.findUnique({
               where: { id: firstParcel.agencyId },
            });
            if (agency) {
               agency_id = agency.id;
            }
         }

         // Parse service (map parcelType to service_id)
         let service: any = null;
         let service_id: number = defaultServiceId;
         if (resolveRelations && firstParcel.parcelType) {
            // You may need to map parcelType to service_id based on your business logic
            // For now, using defaultServiceId
            service = await prisma.service.findUnique({
               where: { id: service_id },
            });
         }

         // Parse user
         let user: any = null;
         let user_id: string | undefined = defaultUserId;
         if (resolveRelations && firstParcel.invoiceUser) {
            user = await prisma.user.findUnique({
               where: { email: firstParcel.invoiceUser },
            });
            if (user) {
               user_id = user.id;
            }
         }

         // Build parcels array
         const parsedParcels = parcels.map((parcel) => ({
            id: parcel.id, // Legacy parcel, no ID in new system yet
            tracking_number: parcel.hbl,
            description: parcel.description,
            weight: parseFloat(parcel.weight) || 0,
            status: mapLegacyStatus(parcel.dispatchStatus),
            agency_id: agency_id,
            order_id: invoiceId as number, // Will be set when order is created
            service_id: service_id,
            created_at: parcel.invoiceDate || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_id: user_id || "",
            legacy_parcel_id: parcel.hbl, // Track legacy reference
         }));

         const parsedOrder: ParsedOrder = {
            order_id: invoiceId as number, // Legacy order, no ID in new system yet
            customer_id,
            customer: customer || createCustomerFromLegacy(firstParcel),
            receiver_id,
            receiver: receiver || createReceiverFromLegacy(firstParcel),
            service_id,
            service: service || { id: service_id, name: "Maritimo" },
            agency_id: agency_id || firstParcel.agencyId,
            agency: agency || { id: firstParcel.agencyId, name: firstParcel.agency },
            parcels: parsedParcels,
            paid_in_cents: 0,
            requires_home_delivery: true,
            created_at: firstParcel.invoiceDate || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_id,
            user: user || null,
            payment_status: "PENDING",
            stage: "BILLING",
            status: mapLegacyStatus(firstParcel.dispatchStatus),
            partner_id: null,
            partner_order_id: null,
            discounts: [],
            payments: [],
            issues: [],
            legacy_invoice_id: invoiceId,
         };

         parsedOrders.push(parsedOrder);
      }

      return parsedOrders;
   },

   /**
    * Parse a single legacy order (by invoiceId)
    */
   parseLegacyOrderByInvoiceId: async (
      invoiceId: number,
      legacyParcels: LegacyParcelItem[],
      options?: {
         resolveRelations?: boolean;
         defaultUserId?: string;
         defaultServiceId?: number;
      }
   ): Promise<ParsedOrder | null> => {
      const parcelsForInvoice = legacyParcels.filter((p) => p.invoiceId === invoiceId);
      if (parcelsForInvoice.length === 0) {
         return null;
      }

      const orders = await legacyParserService.parseLegacyParcelsToOrders(parcelsForInvoice, options);
      return orders[0] || null;
   },
};

/**
 * Helper functions
 */

function parseName(fullName: string): {
   firstName: string;
   middleName?: string;
   lastName: string;
   secondLastName?: string;
} {
   const parts = fullName
      .trim()
      .split(/\s+/)
      .filter((p) => p.length > 0);
   if (parts.length === 0) {
      return { firstName: "", lastName: "" };
   }
   if (parts.length === 1) {
      return { firstName: parts[0], lastName: "" };
   }
   if (parts.length === 2) {
      return { firstName: parts[0], lastName: parts[1] };
   }
   if (parts.length === 3) {
      return { firstName: parts[0], middleName: parts[1], lastName: parts[2] };
   }
   // 4+ parts: assume first two are first/middle, last two are last/secondLast
   return {
      firstName: parts[0],
      middleName: parts[1],
      lastName: parts[parts.length - 2],
      secondLastName: parts[parts.length - 1],
   };
}

function normalizeMobile(mobile: string): string {
   const cleaned = mobile.trim().replace(/\D/g, "");
   if (cleaned.length === 8) {
      return "53" + cleaned;
   }
   return cleaned.length >= 10 && cleaned.length <= 15 ? cleaned : mobile;
}

function mapLegacyStatus(dispatchStatus: number): string {
   // Map legacy dispatch status to new Status enum
   // Adjust based on your legacy status codes
   const statusMap: Record<number, string> = {
      0: "IN_AGENCY",
      1: "IN_TRANSIT",
      2: "IN_TRANSIT",
      3: "DELIVERED",
      4: "RETURNED",
   };
   return statusMap[dispatchStatus] || "IN_AGENCY";
}

function createCustomerFromLegacy(parcel: LegacyParcelItem): any {
   const nameParts = parseName(parcel.sender);
   return {
      id: undefined,
      first_name: nameParts.firstName,
      middle_name: nameParts.middleName,
      last_name: nameParts.lastName,
      second_last_name: nameParts.secondLastName,
      mobile: normalizeMobile(parcel.senderMobile),
      email: parcel.senderEmail || null,
      address: null,
      identity_document: null,
      agency_id: parcel.agencyId,
      is_active: true,
   };
}

function createReceiverFromLegacy(parcel: LegacyParcelItem): any {
   const nameParts = parseName(parcel.receiver);
   return {
      id: undefined,
      first_name: nameParts.firstName,
      middle_name: nameParts.middleName,
      last_name: nameParts.lastName,
      second_last_name: nameParts.secondLastName,
      ci: parcel.receiverCi,
      mobile: normalizeMobile(parcel.receiverMobile),
      email: null,
      phone: null,
      address: buildAddress(parcel),
      province_id: parcel.stateId,
      city_id: parcel.cityId,
      province: { id: parcel.stateId, name: parcel.province },
      city: { id: parcel.cityId, name: parcel.city },
      agency_id: parcel.agencyId,
   };
}

function buildAddress(parcel: LegacyParcelItem): string {
   const parts: string[] = [];
   if (parcel.cll) parts.push(parcel.cll);
   if (parcel.entre_cll) parts.push(`entre ${parcel.entre_cll}`);
   if (parcel.no) parts.push(`#${parcel.no}`);
   if (parcel.apto) parts.push(`apto ${parcel.apto}`);
   if (parcel.reparto) parts.push(parcel.reparto);
   return parts.join(", ") || "";
}

export type { LegacyParcelItem, ParsedOrder };
