"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const client_1 = require("@prisma/client");
const parcels = {
    get: (page, limit) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.parcel.findMany({
            take: limit,
            skip: (page - 1) * limit,
            orderBy: {
                tracking_number: "asc",
            },
        });
    }),
    getWithEvents: (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (page = 1, limit = 10) {
        return yield prisma_client_1.default.parcel.findMany({
            include: {
                events: true,
            },
            orderBy: {
                updated_at: "desc",
            },
            take: limit,
            skip: (page - 1) * limit,
        });
    }),
    getInAgency: (agency_id_1, ...args_1) => __awaiter(void 0, [agency_id_1, ...args_1], void 0, function* (agency_id, page = 1, limit = 10) {
        const parcels = yield prisma_client_1.default.parcel.findMany({
            where: { agency_id, dispatch_id: null },
            orderBy: {
                tracking_number: "asc",
            },
            take: limit,
            skip: (page - 1) * limit,
            select: {
                id: true,
                tracking_number: true,
                description: true,
                weight: true,
                agency_id: true,
                service_id: true,
                status: true,
                order_id: true,
                dispatch_id: true,
            },
        });
        const total = yield prisma_client_1.default.parcel.count({
            where: { agency_id, dispatch_id: null },
        });
        return { parcels, total };
    }),
    findParcelByHbl: (hbl) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number: hbl },
            select: {
                id: true,
                tracking_number: true,
                description: true,
                weight: true,
                agency_id: true,
                service_id: true,
                dispatch_id: true,
                current_location_id: true,
                status: true,
            },
        });
    }),
    /**
     * Gets the previous status of a parcel before it was set to IN_DISPATCH
     * by querying ParcelEvent history in reverse chronological order
     */
    getPreviousStatus: (parcelId) => __awaiter(void 0, void 0, void 0, function* () {
        // Get all events for this parcel, ordered by created_at descending
        const events = yield prisma_client_1.default.parcelEvent.findMany({
            where: { parcel_id: parcelId },
            orderBy: { created_at: "desc" },
            select: {
                status: true,
                created_at: true,
            },
        });
        if (events.length === 0) {
            return null;
        }
        // Find the status before the first IN_DISPATCH event
        // Skip the most recent event if it's IN_DISPATCH
        let startIndex = 0;
        if (events.length > 0 && events[0].status === client_1.Status.IN_DISPATCH) {
            startIndex = 1;
        }
        // Return the first non-IN_DISPATCH status we find
        for (let i = startIndex; i < events.length; i++) {
            if (events[i].status !== client_1.Status.IN_DISPATCH) {
                return events[i].status;
            }
        }
        // If all events are IN_DISPATCH or no previous status found, return IN_AGENCY as default
        return client_1.Status.IN_AGENCY;
    }),
};
exports.default = parcels;
