import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../lib/prisma.client";
import {
   DiscrepancyType,
   ManifestDiscrepancy,
   ManifestVerification,
   ParcelEventType,
   Prisma,
   Status,
   VerificationStatus,
} from "@prisma/client";
import { AppError } from "../common/app-errors";
import { buildParcelStatusDetails } from "../utils/parcel-status-details";

/**
 * Manifest Verification Repository
 * Following: Repository pattern, TypeScript strict typing
 */

interface VerificationWithDetails extends ManifestVerification {
   container?: { id: number; container_number: string } | null;
   flight?: { id: number; awb_number: string } | null;
   verified_by?: { id: string; name: string };
   discrepancies?: ManifestDiscrepancy[];
}

const manifestVerification = {
   /**
    * Get all verifications with pagination
    */
   getAll: async (
      page: number,
      limit: number,
      status?: VerificationStatus,
      container_id?: number,
      flight_id?: number
   ): Promise<{ verifications: VerificationWithDetails[]; total: number }> => {
      const where: Prisma.ManifestVerificationWhereInput = {};

      if (status) {
         where.status = status;
      }

      if (container_id) {
         where.container_id = container_id;
      }

      if (flight_id) {
         where.flight_id = flight_id;
      }

      const [verifications, total] = await Promise.all([
         prisma.manifestVerification.findMany({
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
         prisma.manifestVerification.count({ where }),
      ]);

      return { verifications, total };
   },

   /**
    * Get verification by ID with full details
    */
   getById: async (id: number): Promise<VerificationWithDetails | null> => {
      const verification = await prisma.manifestVerification.findUnique({
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
   },

   /**
    * Start verification for a container
    */
   startContainerVerification: async (container_id: number, user_id: string): Promise<ManifestVerification> => {
      // Check if container exists and is at port
      const container = await prisma.container.findUnique({
         where: { id: container_id },
         include: { _count: { select: { parcels: true } } },
      });

      if (!container) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Container with id ${container_id} not found`);
      }

      // Check if there's already an in-progress verification
      const existingVerification = await prisma.manifestVerification.findFirst({
         where: {
            container_id,
            status: VerificationStatus.IN_PROGRESS,
         },
      });

      if (existingVerification) {
         throw new AppError(
            HttpStatusCodes.CONFLICT,
            `Container already has an in-progress verification (ID: ${existingVerification.id})`
         );
      }

      const verification = await prisma.manifestVerification.create({
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
   },

   /**
    * Start verification for a flight
    */
   startFlightVerification: async (flight_id: number, user_id: string): Promise<ManifestVerification> => {
      // Check if flight exists
      const flight = await prisma.flight.findUnique({
         where: { id: flight_id },
         include: { _count: { select: { parcels: true } } },
      });

      if (!flight) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Flight with id ${flight_id} not found`);
      }

      // Check if there's already an in-progress verification
      const existingVerification = await prisma.manifestVerification.findFirst({
         where: {
            flight_id,
            status: VerificationStatus.IN_PROGRESS,
         },
      });

      if (existingVerification) {
         throw new AppError(
            HttpStatusCodes.CONFLICT,
            `Flight already has an in-progress verification (ID: ${existingVerification.id})`
         );
      }

      const verification = await prisma.manifestVerification.create({
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
   },

   /**
    * Scan parcel for verification
    */
   scanParcel: async (
      verification_id: number,
      tracking_number: string,
      user_id: string
   ): Promise<{ parcel: any; status: "received" | "extra" | "already_scanned" }> => {
      const verification = await prisma.manifestVerification.findUnique({
         where: { id: verification_id },
      });

      if (!verification) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Verification with id ${verification_id} not found`);
      }

      if (verification.status !== VerificationStatus.IN_PROGRESS) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Verification is ${verification.status}. Cannot scan more parcels.`
         );
      }

      // Find parcel
      const parcel = await prisma.parcel.findUnique({
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
         const alreadyScanned = await prisma.parcelEvent.findFirst({
            where: {
               parcel_id: parcel.id,
               event_type: ParcelEventType.MANIFEST_SCANNED,
               notes: { contains: `verification #${verification_id}` },
            },
         });

         if (alreadyScanned) {
            return { parcel, status: "already_scanned" };
         }
      }

      // Check if parcel is in the expected manifest
      const isExpected =
         parcel &&
         ((verification.container_id && parcel.container_id === verification.container_id) ||
            (verification.flight_id && parcel.flight_id === verification.flight_id));

      return await prisma.$transaction(async (tx) => {
         if (isExpected) {
            const statusDetails = buildParcelStatusDetails({
               status: Status.AT_PORT_OF_ENTRY,
               container_id: verification.container_id ?? undefined,
               flight_id: verification.flight_id ?? undefined,
            });
            // Parcel is expected - mark as received
            await tx.parcelEvent.create({
               data: {
                  parcel_id: parcel!.id,
                  event_type: ParcelEventType.MANIFEST_SCANNED,
                  user_id,
                  status: Status.AT_PORT_OF_ENTRY,
                  container_id: verification.container_id,
                  flight_id: verification.flight_id,
                  status_details: statusDetails,
                  notes: `Scanned at verification #${verification_id}`,
               },
            });

            await tx.manifestVerification.update({
               where: { id: verification_id },
               data: {
                  received_count: { increment: 1 },
               },
            });

            return { parcel, status: "received" as const };
         } else {
            // Parcel is not expected - mark as extra
            await tx.manifestDiscrepancy.create({
               data: {
                  verification_id,
                  parcel_id: parcel?.id,
                  tracking_number,
                  discrepancy_type: DiscrepancyType.EXTRA,
               },
            });

            await tx.manifestVerification.update({
               where: { id: verification_id },
               data: {
                  extra_count: { increment: 1 },
               },
            });

            if (parcel) {
               const statusDetails = buildParcelStatusDetails({
                  status: parcel.status,
                  dispatch_id: parcel.dispatch_id ?? undefined,
                  container_id: parcel.container_id ?? undefined,
                  flight_id: parcel.flight_id ?? undefined,
                  current_warehouse_id: parcel.current_warehouse_id ?? undefined,
               });
               await tx.parcelEvent.create({
                  data: {
                     parcel_id: parcel.id,
                     event_type: ParcelEventType.DISCREPANCY_FOUND,
                     user_id,
                     status: parcel.status,
                     status_details: statusDetails,
                     notes: `Found as EXTRA at verification #${verification_id} - not in manifest`,
                  },
               });
            }

            return { parcel, status: "extra" as const };
         }
      });
   },

   /**
    * Complete verification and calculate missing parcels
    */
   complete: async (verification_id: number, user_id: string, notes?: string): Promise<ManifestVerification> => {
      const verification = await prisma.manifestVerification.findUnique({
         where: { id: verification_id },
      });

      if (!verification) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Verification with id ${verification_id} not found`);
      }

      if (verification.status !== VerificationStatus.IN_PROGRESS) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, `Verification is already ${verification.status}`);
      }

      // Find all expected parcels that weren't scanned
      const scannedParcelIds = await prisma.parcelEvent.findMany({
         where: {
            event_type: ParcelEventType.MANIFEST_SCANNED,
            notes: { contains: `verification #${verification_id}` },
         },
         select: { parcel_id: true },
      });

      const scannedIds = scannedParcelIds.map((p) => p.parcel_id);

      // Get all parcels that should have been in the container/flight
      const expectedParcels = await prisma.parcel.findMany({
         where: {
            OR: [
               { container_id: verification.container_id ?? undefined },
               { flight_id: verification.flight_id ?? undefined },
            ],
            id: { notIn: scannedIds },
         },
         select: { id: true, tracking_number: true },
      });

      // Filter out nulls
      const missingParcels = verification.container_id
         ? expectedParcels.filter((p) => true) // Container parcels
         : expectedParcels;

      const updated = await prisma.$transaction(async (tx) => {
         // Create discrepancies for missing parcels
         for (const parcel of missingParcels) {
            await tx.manifestDiscrepancy.create({
               data: {
                  verification_id,
                  parcel_id: parcel.id,
                  tracking_number: parcel.tracking_number,
                  discrepancy_type: DiscrepancyType.MISSING,
               },
            });

            const statusDetails = buildParcelStatusDetails({
               status: Status.AT_PORT_OF_ENTRY,
               container_id: verification.container_id ?? undefined,
               flight_id: verification.flight_id ?? undefined,
            });
            await tx.parcelEvent.create({
               data: {
                  parcel_id: parcel.id,
                  event_type: ParcelEventType.DISCREPANCY_FOUND,
                  user_id,
                  status: Status.AT_PORT_OF_ENTRY,
                  container_id: verification.container_id,
                  flight_id: verification.flight_id,
                  status_details: statusDetails,
                  notes: `Marked as MISSING at verification #${verification_id}`,
               },
            });
         }

         const hasDiscrepancies = missingParcels.length > 0 || verification.extra_count > 0;

         const result = await tx.manifestVerification.update({
            where: { id: verification_id },
            data: {
               status: hasDiscrepancies
                  ? VerificationStatus.COMPLETED_WITH_DISCREPANCIES
                  : VerificationStatus.COMPLETED,
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
      });

      return updated;
   },

   /**
    * Report damaged parcel
    */
   reportDamage: async (
      verification_id: number,
      tracking_number: string,
      user_id: string,
      notes?: string
   ): Promise<ManifestDiscrepancy> => {
      const verification = await prisma.manifestVerification.findUnique({
         where: { id: verification_id },
      });

      if (!verification) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Verification with id ${verification_id} not found`);
      }

      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      const discrepancy = await prisma.$transaction(async (tx) => {
         const created = await tx.manifestDiscrepancy.create({
            data: {
               verification_id,
               parcel_id: parcel.id,
               tracking_number,
               discrepancy_type: DiscrepancyType.DAMAGED,
            },
         });

         const statusDetails = buildParcelStatusDetails({
            status: parcel.status,
            dispatch_id: parcel.dispatch_id ?? undefined,
            container_id: parcel.container_id ?? verification.container_id ?? undefined,
            flight_id: parcel.flight_id ?? verification.flight_id ?? undefined,
            current_warehouse_id: parcel.current_warehouse_id ?? undefined,
         });
         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: ParcelEventType.DISCREPANCY_FOUND,
               user_id,
               status: parcel.status,
               container_id: verification.container_id,
               flight_id: verification.flight_id,
               status_details: statusDetails,
               notes: notes || `Reported as DAMAGED at verification #${verification_id}`,
            },
         });

         return created;
      });

      return discrepancy;
   },

   /**
    * Resolve discrepancy
    */
   resolveDiscrepancy: async (
      discrepancy_id: number,
      resolution: string,
      user_id: string
   ): Promise<ManifestDiscrepancy> => {
      const discrepancy = await prisma.manifestDiscrepancy.findUnique({
         where: { id: discrepancy_id },
      });

      if (!discrepancy) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Discrepancy with id ${discrepancy_id} not found`);
      }

      if (discrepancy.resolved_at) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Discrepancy is already resolved");
      }

      const updated = await prisma.$transaction(async (tx) => {
         const result = await tx.manifestDiscrepancy.update({
            where: { id: discrepancy_id },
            data: {
               resolution,
               resolved_at: new Date(),
               resolved_by_id: user_id,
            },
         });

         if (discrepancy.parcel_id) {
            const statusDetails = buildParcelStatusDetails({ status: Status.AT_PORT_OF_ENTRY });
            await tx.parcelEvent.create({
               data: {
                  parcel_id: discrepancy.parcel_id,
                  event_type: ParcelEventType.DISCREPANCY_RESOLVED,
                  user_id,
                  status: Status.AT_PORT_OF_ENTRY,
                  status_details: statusDetails,
                  notes: `Discrepancy resolved: ${resolution}`,
               },
            });
         }

         return result;
      });

      return updated;
   },

   /**
    * Get discrepancies for a verification
    */
   getDiscrepancies: async (verification_id: number): Promise<ManifestDiscrepancy[]> => {
      const discrepancies = await prisma.manifestDiscrepancy.findMany({
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
   },
};

export default manifestVerification;
