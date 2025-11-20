import prisma from "../lib/prisma.client";
import { Prisma } from "@prisma/client";
import { generateApiKey, hashApiKey } from "../utils/apiKeyUtils";

export const partners = {
   getAll: async () => {
      const partners = await prisma.partner.findMany({
         select: {
            id: true,
            name: true,
            email: true,
            contact_name: true,
            phone: true,
            is_active: true,
            rate_limit: true,

            agency_id: true,
            agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
            forwarder: {
               select: {
                  id: true,
                  name: true,
               },
            },
            created_at: true,
            updated_at: true,
            _count: {
               select: {
                  orders: true,
                  partner_logs: true,
               },
            },
         },
         orderBy: {
            created_at: "desc",
         },
      });
      return partners;
   },

   getById: async (id: number) => {
      const partner = await prisma.partner.findUnique({
         select: {
            id: true,
            name: true,
            email: true,
            contact_name: true,
            phone: true,
            is_active: true,
            rate_limit: true,
            agency_id: true,
            forwarder_id: true,
            agency: {
               select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
               },
            },
            forwarder: {
               select: {
                  id: true,
                  name: true,
                  email: true,
               },
            },
            api_keys: {
               select: {
                  id: true,
                  prefix: true,
                  name: true,
                  is_active: true,
                  expires_at: true,
                  created_at: true,
                  last_used: true,
               },
               where: {
                  is_active: true,
               },
            },
            created_at: true,
            updated_at: true,
            _count: {
               select: {
                  partner_logs: true,
                  api_keys: true,
               },
            },
         },
         where: { id },
      });
      return partner;
   },

   getByApiKey: async (
      apiKey: string
   ): Promise<{
      id: number;
      name: string;
      email: string;
      contact_name: string;
      phone: string;
      is_active: boolean;
      rate_limit: number | null;
      agency_id: number;
      forwarder_id: number;
      api_key_id: string;
      agency: {
         id: number;
         name: string;
         forwarder_id: number;
      };
      forwarder: {
         id: number;
         name: string;
      };
   } | null> => {
      // Hash the provided API key to compare with stored hash
      const keyHash = hashApiKey(apiKey);

      // Find the API key record
      const apiKeyRecord = await prisma.apiKey.findUnique({
         where: {
            key_hash: keyHash,
         },
         include: {
            partner: {
               select: {
                  id: true,
                  name: true,
                  email: true,
                  contact_name: true,
                  phone: true,
                  is_active: true,
                  rate_limit: true,
                  agency_id: true,
                  forwarder_id: true,
                  agency: {
                     select: {
                        id: true,
                        name: true,
                        forwarder_id: true,
                     },
                  },
                  forwarder: {
                     select: {
                        id: true,
                        name: true,
                     },
                  },
               },
            },
         },
      });

      if (!apiKeyRecord || !apiKeyRecord.is_active || !apiKeyRecord.partner.is_active) {
         return null;
      }

      // Check if API key is expired
      if (apiKeyRecord.expires_at && new Date() > apiKeyRecord.expires_at) {
         return null;
      }

      // Update last_used timestamp asynchronously (don't block the request)
      prisma.apiKey
         .update({
            where: { id: apiKeyRecord.id },
            data: { last_used: new Date() },
         })
         .catch((err) => console.error("Failed to update API key last_used:", err));

      return {
         ...apiKeyRecord.partner,
         api_key_id: apiKeyRecord.id,
      };
   },

   create: async (data: Prisma.PartnerCreateInput): Promise<{ id: number; name: string; email: string }> => {
      const partner = await prisma.partner.create({
         data,
         select: {
            id: true,
            name: true,
            email: true,
            contact_name: true,
            phone: true,
            is_active: true,
            rate_limit: true,
            agency_id: true,
            forwarder_id: true,
         },
      });
      return partner;
   },

   update: async (id: number, data: Prisma.PartnerUpdateInput) => {
      const partner = await prisma.partner.update({
         where: { id },
         data,
         select: {
            id: true,
            name: true,
            email: true,
            contact_name: true,
            phone: true,
            is_active: true,
            rate_limit: true,
            agency_id: true,
            forwarder_id: true,
            updated_at: true,
         },
      });
      return partner;
   },

   delete: async (id: number) => {
      const partner = await prisma.partner.delete({
         where: { id },
         select: {
            id: true,
            name: true,
         },
      });
      return partner;
   },

   createApiKey: async (
      partnerId: number,
      options: {
         name?: string;
         environment?: "live" | "test";
         expiresAt?: Date;
      } = {}
   ): Promise<{ id: string; displayKey: string; prefix: string }> => {
      const { name, environment = "live", expiresAt } = options;

      // Generate secure API key
      const { displayKey, hashedKey, prefix } = generateApiKey(environment);

      // Store in database
      const apiKey = await prisma.apiKey.create({
         data: {
            key_hash: hashedKey,
            prefix,
            name,
            expires_at: expiresAt,
            partner: {
               connect: { id: partnerId },
            },
         },
         select: {
            id: true,
            prefix: true,
         },
      });

      // Return the display key (only shown once!)
      return {
         id: apiKey.id,
         displayKey,
         prefix: apiKey.prefix,
      };
   },

   getApiKeys: async (partnerId: number) => {
      const apiKeys = await prisma.apiKey.findMany({
         where: { partner_id: partnerId },
         select: {
            id: true,
            prefix: true,
            name: true,
            is_active: true,
            expires_at: true,
            created_at: true,
            last_used: true,
         },
         orderBy: { created_at: "desc" },
      });
      return apiKeys;
   },

   revokeApiKey: async (apiKeyId: string): Promise<void> => {
      await prisma.apiKey.update({
         where: { id: apiKeyId },
         data: { is_active: false },
      });
   },

   deleteApiKey: async (apiKeyId: string): Promise<void> => {
      await prisma.apiKey.delete({
         where: { id: apiKeyId },
      });
   },

   logRequest: async (data: {
      partner_id: number;
      api_key_id: string;
      endpoint: string;
      method: string;
      status_code: number;
      request_body?: any;
      response_body?: any;
      ip_address?: string;
      user_agent?: string;
   }) => {
      const log = await prisma.partnerLog.create({
         data: {
            partner_id: data.partner_id,
            api_key_id: data.api_key_id,
            endpoint: data.endpoint,
            method: data.method,
            status_code: data.status_code,
            request_body: data.request_body || Prisma.JsonNull,
            response_body: data.response_body || Prisma.JsonNull,
            ip_address: data.ip_address,
            user_agent: data.user_agent,
         },
      });
      return log;
   },

   getLogs: async (partnerId: number, limit: number = 100, offset: number = 0) => {
      const logs = await prisma.partnerLog.findMany({
         where: { partner_id: partnerId },
         select: {
            id: true,
            endpoint: true,
            method: true,
            status_code: true,
            ip_address: true,
            created_at: true,
         },
         orderBy: { created_at: "desc" },
         take: limit,
         skip: offset,
      });
      return logs;
   },

   getStats: async (partnerId: number) => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [requestsLastHour, requestsLastDay, totalInvoices, totalRequests] = await Promise.all([
         prisma.partnerLog.count({
            where: {
               partner_id: partnerId,
               created_at: { gte: oneHourAgo },
            },
         }),
         prisma.partnerLog.count({
            where: {
               partner_id: partnerId,
               created_at: { gte: oneDayAgo },
            },
         }),
         prisma.order.count({
            where: { partner_id: partnerId },
         }),
         prisma.partnerLog.count({
            where: { partner_id: partnerId },
         }),
      ]);

      return {
         requests_last_hour: requestsLastHour,
         requests_last_day: requestsLastDay,
         total_invoices: totalInvoices,
         total_requests: totalRequests,
      };
   },
};

export default partners;
