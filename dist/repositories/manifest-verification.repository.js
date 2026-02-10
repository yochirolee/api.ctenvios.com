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
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const client_1 = require("@prisma/client");
const app_errors_1 = require("../common/app-errors");
const manifestVerification = {
    /**
     * Get all verifications with pagination
     */
    getAll: (page, limit, status, container_id, flight_id) => __awaiter(void 0, void 0, void 0, function* () {
        const where = {};
        if (status) {
            where.status = status;
        }
        if (container_id) {
            where.container_id = container_id;
        }
        if (flight_id) {
            where.flight_id = flight_id;
        }
        const [verifications, total] = yield Promise.all([
            prisma_client_1.default.manifestVerification.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    container: {
                        select: { id: true, container_number: true },
                    },
                    flight: {
                        select: { id: true, awb_number: true },
                    },
                    verified_by: {
                        select: { id: true, name: true },
                    },
                    _count: {
                        select: { discrepancies: true },
                    },
                },
                orderBy: { created_at: "desc" },
            }),
            prisma_client_1.default.manifestVerification.count({ where }),
        ]);
        return { verifications, total };
    }),
    /**
     * Get verification by ID with full details
     */
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const verification = yield prisma_client_1.default.manifestVerification.findUnique({
            where: { id },
            include: {
                container: {
                    select: { id: true, container_number: true, status: true },
                },
                flight: {
                    select: { id: true, awb_number: true, status: true },
                },
                verified_by: {
                    select: { id: true, name: true },
                },
                discrepancies: {
                    include: {
                        parcel: {
                            select: { id: true, tracking_number: true, description: true },
                        },
                        resolved_by: {
                            select: { id: true, name: true },
                        },
                    },
                    orderBy: { created_at: "desc" },
                },
            },
        });
        return verification;
    }),
    /**
     * Start verification for a container
     */
    startContainerVerification: (container_id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        // Check if container exists and is at port
        const container = yield prisma_client_1.default.container.findUnique({
            where: { id: container_id },
            include: { _count: { select: { parcels: true } } },
        });
        if (!container) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Container with id ${container_id} not found`);
        }
        // Check if there's already an in-progress verification
        const existingVerification = yield prisma_client_1.default.manifestVerification.findFirst({
            where: {
                container_id,
                status: client_1.VerificationStatus.IN_PROGRESS,
            },
        });
        if (existingVerification) {
            throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Container already has an in-progress verification (ID: ${existingVerification.id})`);
        }
        const verification = yield prisma_client_1.default.manifestVerification.create({
            data: {
                container_id,
                expected_count: container._count.parcels,
                verified_by_id: user_id,
            },
            include: {
                container: {
                    select: { id: true, container_number: true },
                },
                verified_by: {
                    select: { id: true, name: true },
                },
            },
        });
        return verification;
    }),
    /**
     * Start verification for a flight
     */
    startFlightVerification: (flight_id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        // Check if flight exists
        const flight = yield prisma_client_1.default.flight.findUnique({
            where: { id: flight_id },
            include: { _count: { select: { parcels: true } } },
        });
        if (!flight) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Flight with id ${flight_id} not found`);
        }
        // Check if there's already an in-progress verification
        const existingVerification = yield prisma_client_1.default.manifestVerification.findFirst({
            where: {
                flight_id,
                status: client_1.VerificationStatus.IN_PROGRESS,
            },
        });
        if (existingVerification) {
            throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Flight already has an in-progress verification (ID: ${existingVerification.id})`);
        }
        const verification = yield prisma_client_1.default.manifestVerification.create({
            data: {
                flight_id,
                expected_count: flight._count.parcels,
                verified_by_id: user_id,
            },
            include: {
                flight: {
                    select: { id: true, awb_number: true },
                },
                verified_by: {
                    select: { id: true, name: true },
                },
            },
        });
        return verification;
    }),
    /**
     * Scan parcel for verification
     */
    scanParcel: (verification_id, tracking_number, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const verification = yield prisma_client_1.default.manifestVerification.findUnique({
            where: { id: verification_id },
        });
        if (!verification) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Verification with id ${verification_id} not found`);
        }
        if (verification.status !== client_1.VerificationStatus.IN_PROGRESS) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Verification is ${verification.status}. Cannot scan more parcels.`);
        }
        // Find parcel
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
            include: {
                order: {
                    select: {
                        id: true,
                        receiver: { select: { first_name: true, last_name: true } },
                    },
                },
            },
        });
        // Check if already scanned (has MANIFEST_SCANNED event for this verification)
        if (parcel) {
            const alreadyScanned = yield prisma_client_1.default.parcelEvent.findFirst({
                where: {
                    parcel_id: parcel.id,
                    event_type: client_1.ParcelEventType.MANIFEST_SCANNED,
                    notes: { contains: `verification #${verification_id}` },
                },
            });
            if (alreadyScanned) {
                return { parcel, status: "already_scanned" };
            }
        }
        // Check if parcel is in the expected manifest
        const isExpected = parcel &&
            ((verification.container_id && parcel.container_id === verification.container_id) ||
                (verification.flight_id && parcel.flight_id === verification.flight_id));
        return yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            if (isExpected) {
                // Parcel is expected - mark as received
                yield tx.parcelEvent.create({
                    data: {
                        parcel_id: parcel.id,
                        event_type: client_1.ParcelEventType.MANIFEST_SCANNED,
                        user_id,
                        status: client_1.Status.AT_PORT_OF_ENTRY,
                        container_id: verification.container_id,
                        flight_id: verification.flight_id,
                        notes: `Scanned at verification #${verification_id}`,
                    },
                });
                yield tx.manifestVerification.update({
                    where: { id: verification_id },
                    data: {
                        received_count: { increment: 1 },
                    },
                });
                return { parcel, status: "received" };
            }
            else {
                // Parcel is not expected - mark as extra
                yield tx.manifestDiscrepancy.create({
                    data: {
                        verification_id,
                        parcel_id: parcel === null || parcel === void 0 ? void 0 : parcel.id,
                        tracking_number,
                        discrepancy_type: client_1.DiscrepancyType.EXTRA,
                    },
                });
                yield tx.manifestVerification.update({
                    where: { id: verification_id },
                    data: {
                        extra_count: { increment: 1 },
                    },
                });
                if (parcel) {
                    yield tx.parcelEvent.create({
                        data: {
                            parcel_id: parcel.id,
                            event_type: client_1.ParcelEventType.DISCREPANCY_FOUND,
                            user_id,
                            status: parcel.status,
                            notes: `Found as EXTRA at verification #${verification_id} - not in manifest`,
                        },
                    });
                }
                return { parcel, status: "extra" };
            }
        }));
    }),
    /**
     * Complete verification and calculate missing parcels
     */
    complete: (verification_id, user_id, notes) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const verification = yield prisma_client_1.default.manifestVerification.findUnique({
            where: { id: verification_id },
        });
        if (!verification) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Verification with id ${verification_id} not found`);
        }
        if (verification.status !== client_1.VerificationStatus.IN_PROGRESS) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Verification is already ${verification.status}`);
        }
        // Find all expected parcels that weren't scanned
        const scannedParcelIds = yield prisma_client_1.default.parcelEvent.findMany({
            where: {
                event_type: client_1.ParcelEventType.MANIFEST_SCANNED,
                notes: { contains: `verification #${verification_id}` },
            },
            select: { parcel_id: true },
        });
        const scannedIds = scannedParcelIds.map((p) => p.parcel_id);
        // Get all parcels that should have been in the container/flight
        const expectedParcels = yield prisma_client_1.default.parcel.findMany({
            where: {
                OR: [
                    { container_id: (_a = verification.container_id) !== null && _a !== void 0 ? _a : undefined },
                    { flight_id: (_b = verification.flight_id) !== null && _b !== void 0 ? _b : undefined },
                ],
                id: { notIn: scannedIds },
            },
            select: { id: true, tracking_number: true },
        });
        // Filter out nulls
        const missingParcels = verification.container_id
            ? expectedParcels.filter((p) => true) // Container parcels
            : expectedParcels;
        const updated = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Create discrepancies for missing parcels
            for (const parcel of missingParcels) {
                yield tx.manifestDiscrepancy.create({
                    data: {
                        verification_id,
                        parcel_id: parcel.id,
                        tracking_number: parcel.tracking_number,
                        discrepancy_type: client_1.DiscrepancyType.MISSING,
                    },
                });
                yield tx.parcelEvent.create({
                    data: {
                        parcel_id: parcel.id,
                        event_type: client_1.ParcelEventType.DISCREPANCY_FOUND,
                        user_id,
                        status: client_1.Status.AT_PORT_OF_ENTRY,
                        container_id: verification.container_id,
                        flight_id: verification.flight_id,
                        notes: `Marked as MISSING at verification #${verification_id}`,
                    },
                });
            }
            const hasDiscrepancies = missingParcels.length > 0 || verification.extra_count > 0;
            const result = yield tx.manifestVerification.update({
                where: { id: verification_id },
                data: {
                    status: hasDiscrepancies
                        ? client_1.VerificationStatus.COMPLETED_WITH_DISCREPANCIES
                        : client_1.VerificationStatus.COMPLETED,
                    missing_count: missingParcels.length,
                    completed_at: new Date(),
                    notes,
                },
                include: {
                    container: {
                        select: { id: true, container_number: true },
                    },
                    flight: {
                        select: { id: true, awb_number: true },
                    },
                    verified_by: {
                        select: { id: true, name: true },
                    },
                    discrepancies: true,
                },
            });
            return result;
        }));
        return updated;
    }),
    /**
     * Report damaged parcel
     */
    reportDamage: (verification_id, tracking_number, user_id, notes) => __awaiter(void 0, void 0, void 0, function* () {
        const verification = yield prisma_client_1.default.manifestVerification.findUnique({
            where: { id: verification_id },
        });
        if (!verification) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Verification with id ${verification_id} not found`);
        }
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        const discrepancy = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const created = yield tx.manifestDiscrepancy.create({
                data: {
                    verification_id,
                    parcel_id: parcel.id,
                    tracking_number,
                    discrepancy_type: client_1.DiscrepancyType.DAMAGED,
                },
            });
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: parcel.id,
                    event_type: client_1.ParcelEventType.DISCREPANCY_FOUND,
                    user_id,
                    status: parcel.status,
                    container_id: verification.container_id,
                    flight_id: verification.flight_id,
                    notes: notes || `Reported as DAMAGED at verification #${verification_id}`,
                },
            });
            return created;
        }));
        return discrepancy;
    }),
    /**
     * Resolve discrepancy
     */
    resolveDiscrepancy: (discrepancy_id, resolution, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const discrepancy = yield prisma_client_1.default.manifestDiscrepancy.findUnique({
            where: { id: discrepancy_id },
        });
        if (!discrepancy) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Discrepancy with id ${discrepancy_id} not found`);
        }
        if (discrepancy.resolved_at) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Discrepancy is already resolved");
        }
        const updated = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield tx.manifestDiscrepancy.update({
                where: { id: discrepancy_id },
                data: {
                    resolution,
                    resolved_at: new Date(),
                    resolved_by_id: user_id,
                },
            });
            if (discrepancy.parcel_id) {
                yield tx.parcelEvent.create({
                    data: {
                        parcel_id: discrepancy.parcel_id,
                        event_type: client_1.ParcelEventType.DISCREPANCY_RESOLVED,
                        user_id,
                        status: client_1.Status.AT_PORT_OF_ENTRY,
                        notes: `Discrepancy resolved: ${resolution}`,
                    },
                });
            }
            return result;
        }));
        return updated;
    }),
    /**
     * Get discrepancies for a verification
     */
    getDiscrepancies: (verification_id) => __awaiter(void 0, void 0, void 0, function* () {
        const discrepancies = yield prisma_client_1.default.manifestDiscrepancy.findMany({
            where: { verification_id },
            include: {
                parcel: {
                    select: { id: true, tracking_number: true, description: true },
                },
                resolved_by: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { created_at: "desc" },
        });
        return discrepancies;
    }),
};
exports.default = manifestVerification;
