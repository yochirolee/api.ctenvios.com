import { Request, Response, NextFunction } from "express";
import { services } from "../services";
import { parseDateFlexible } from "../types/types";
import { buildNameSearchFilter } from "../types/types";
import { Roles } from "@prisma/client";
import prisma from "../config/prisma_db";
import repository from "../repositories";
export const ordersController = {
   /**
    * Creates an order from frontend or partner API
    * Frontend: sends customer_id and receiver_id
    * Partners: send customer and receiver objects with location names
    */
   create: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const {
            customer_id,
            receiver_id,
            customer,
            receiver,
            service_id,
            items,
            total_delivery_fee_in_cents,
            requires_home_delivery,
         } = req.body;
         const user = req.user;

         const orderResult = await services.orders.create({
            customer_id,
            receiver_id,
            customer,
            receiver,
            service_id,
            items,
            user_id: user.id,
            agency_id: user.agency_id,
            total_delivery_fee_in_cents,
            requires_home_delivery,
         });

         res.status(201).json(orderResult);
      } catch (error) {
         next(error);
      }
   },
   search: async (req: any, res: Response) => {
      try {
         const user = req.user;
         const { page, limit, search, startDate, endDate } = req.query;

         const pageNum = parseInt(page) || 1;
         const limitNum = parseInt(limit) || 25;

         const searchTerm = search.trim().toLowerCase() || "";
         const words = searchTerm.split(/\s+/).filter(Boolean);
         const isNumeric = /^\d+$/.test(searchTerm);

         // 2. Construccion de Clausula WHERE unificada
         let whereClause: any = {};
         const filters: any[] = [];

         // Filtro de fecha
         if (startDate || endDate) {
            const dateFilter: any = { created_at: {} };
            if (startDate) {
               const start = parseDateFlexible(startDate);
               if (!start) return res.status(400).json({ message: "startDate invalida" });
               dateFilter.created_at.gte = start;
            }
            if (endDate) {
               const end = parseDateFlexible(endDate);
               if (!end) return res.status(400).json({ message: "endDate invalida" });
               end.setHours(23, 59, 59, 999);
               dateFilter.created_at.lte = end;
            }
            filters.push(dateFilter);
         }

         // Filtro principal de busqueda
         if (searchTerm) {
            if (isNumeric) {
               // Logica numerica combinada con OR para evitar el fallback
               const numericConditions = [];
               if (searchTerm.length <= 5) {
                  numericConditions.push({ id: parseInt(searchTerm) });
               }
               if (searchTerm.length === 10) {
                  numericConditions.push({ customer: { mobile: { contains: searchTerm } } });
                  numericConditions.push({ receiver: { mobile: { contains: searchTerm } } }); // fallback incluido aqui
               }
               if (searchTerm.length === 11) {
                  numericConditions.push({ receiver: { ci: { contains: searchTerm } } });
               }

               if (numericConditions.length > 0) {
                  filters.push({ OR: numericConditions });
               } else {
                  // Si es numerico pero no cumple ninguna longitud, no devolver nada.
                  // Esto evita que una busqueda de 6 digitos devuelva todos los resultados.
                  filters.push({ id: -1 }); // Condicion para no encontrar resultados
               }
            } else {
               // Logica de busqueda por nombre
               const nameFilters = buildNameSearchFilter(words);
               filters.push({ OR: [{ customer: nameFilters }, { receiver: nameFilters }] });
            }
         }

         // Filtro de Rol (RBAC)
         const allowedRoles = [Roles.ROOT, Roles.ADMINISTRATOR];
         if (!allowedRoles.includes(user.role)) {
            filters.push({ agency_id: user.agency_id });
         }

         // Combinar todos los filtros con AND
         if (filters.length > 0) {
            whereClause.AND = filters;
         }

         // 3. Ejecutar consultas en una sola transaccion
         const [count, rows] = await prisma.$transaction([
            prisma.order.count({ where: whereClause }),
            prisma.order.findMany({
               select: {
                  id: true,
                  created_at: true,
                  total_in_cents: true,
                  paid_in_cents: true,
                  payment_status: true,
                  status: true,

                  customer: {
                     select: { id: true, first_name: true, last_name: true, second_last_name: true, mobile: true },
                  },
                  receiver: {
                     select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        second_last_name: true,
                        mobile: true,
                        province: { select: { name: true } },
                        city: { select: { name: true } },
                     },
                  },
                  service: { select: { id: true, name: true } },
                  agency: { select: { id: true, name: true } },
                  user: { select: { id: true, name: true } },
                  _count: { select: { items: true } },
               },

               where: whereClause,
               orderBy: { created_at: "desc" },
               take: limitNum,
               skip: (pageNum - 1) * limitNum,
            }),
         ]);

         res.status(200).json({ rows, total: count });
      } catch (error) {
         console.error("Search error:", error);
         res.status(500).json({ message: "Error searching orders", error });
      }
   },
   getById: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { id } = req.params;
         const orderId = parseInt(id);

         if (isNaN(orderId)) {
            res.status(400).json({ message: "Invalid order ID" });
            return;
         }

         const order = await repository.orders.getByIdWithDetails(orderId);

         if (!order) {
            res.status(404).json({ message: "Order not found" });
            return;
         }

         res.status(200).json(order);
      } catch (error) {
         next(error);
      }
   },
   payOrder: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const paymentData = req.body;
         const order_id = parseInt(req.params.id);
         const user = req.user;

         const result = await services.orders.payOrder(order_id, paymentData, user.id);

         res.status(201).json(result);
      } catch (error) {
         next(error);
      }
   },
   removePayment: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const payment_id = parseInt(req.params.id);
         const result = await services.orders.removePayment(payment_id);
         res.status(200).json(result);
      } catch (error) {
         next(error);
      }
   },
};

export default ordersController;
