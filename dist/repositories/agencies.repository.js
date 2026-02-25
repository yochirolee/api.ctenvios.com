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
exports.agencies = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
exports.agencies = {
    getAll: () => __awaiter(void 0, void 0, void 0, function* () {
        const agencies = yield prisma_client_1.default.agency.findMany({
            orderBy: {
                id: "asc",
            },
        });
        return agencies;
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const agency = yield prisma_client_1.default.agency.findUnique({
            select: {
                id: true,
                name: true,
                address: true,
                contact: true,
                phone: true,
                email: true,
                agency_type: true,
                forwarder_id: true,
                logo: true,
            },
            where: { id },
        });
        return agency;
    }),
    getUsers: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const users = yield prisma_client_1.default.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
            },
            where: { agency_id: id },
            orderBy: {
                name: "asc",
            },
        });
        return users;
    }),
    update: (id, agency) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedAgency = yield prisma_client_1.default.agency.update({
            where: { id },
            data: agency,
        });
        return updatedAgency;
    }),
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const deletedAgency = yield prisma_client_1.default.agency.delete({
                where: { id },
            });
            return deletedAgency;
        }
        catch (error) {
            console.error("Error deleting agency:", error);
            throw error;
        }
    }),
    getChildren: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const children = yield prisma_client_1.default.agency.findMany({
            where: { parent_agency_id: id },
        });
        return children;
    }),
    getParent: (id) => __awaiter(void 0, void 0, void 0, function* () {
        // First get the agency to find its parent_agency_id
        const agency = yield prisma_client_1.default.agency.findUnique({
            where: { id },
            select: { parent_agency_id: true },
        });
        if (!agency || !agency.parent_agency_id) {
            return null;
        }
        // Then fetch the parent agency
        const parent = yield prisma_client_1.default.agency.findUnique({
            where: { id: agency.parent_agency_id },
        });
        return parent;
    }),
    getAllChildrenRecursively: (parentId) => __awaiter(void 0, void 0, void 0, function* () {
        const getAllChildren = (agencyId) => __awaiter(void 0, void 0, void 0, function* () {
            const directChildren = yield prisma_client_1.default.agency.findMany({
                where: { parent_agency_id: agencyId },
                select: { id: true },
            });
            const childIds = directChildren.map((child) => child.id);
            const allChildIds = [...childIds];
            // Recursively get children of children
            for (const childId of childIds) {
                const grandChildren = yield getAllChildren(childId);
                allChildIds.push(...grandChildren);
            }
            return allChildIds;
        });
        return getAllChildren(parentId);
    }),
    addCustomerToAgency: (agency_id, customer_id) => __awaiter(void 0, void 0, void 0, function* () {
        //connect customer to agency
        yield prisma_client_1.default.agency.update({
            where: { id: agency_id },
            data: {
                customers: {
                    connect: { id: customer_id },
                },
            },
        });
    }),
    addReceiverToAgency: (agency_id, receiver_id) => __awaiter(void 0, void 0, void 0, function* () {
        //connect receiver to agency
        yield prisma_client_1.default.agency.update({
            where: { id: agency_id },
            data: {
                receivers: {
                    connect: { id: receiver_id },
                },
            },
        });
    }),
};
exports.default = exports.agencies;
