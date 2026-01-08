/*
  Warnings:

  - Added the required column `event_type` to the `ParcelEvent` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ParcelEventType" AS ENUM ('BILLED', 'IN_TRANSIT', 'ARRIVED_DESTINATION', 'CUSTOMS_PROCESSING', 'CUSTOMS_RELEASED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'DELIVERY_RESCHEDULED', 'ADDED_TO_PALLET', 'REMOVED_FROM_PALLET', 'ADDED_TO_DISPATCH', 'RECEIVED_IN_DISPATCH', 'LOADED_TO_CONTAINER', 'REMOVED_FROM_CONTAINER', 'LOADED_TO_FLIGHT', 'REMOVED_FROM_FLIGHT', 'MANIFEST_SCANNED', 'WAREHOUSE_RECEIVED', 'WAREHOUSE_TRANSFERRED', 'ASSIGNED_TO_ROUTE', 'ASSIGNED_TO_MESSENGER', 'DISCREPANCY_FOUND', 'DISCREPANCY_RESOLVED', 'ISSUE_REPORTED', 'NOTE_ADDED', 'STATUS_CORRECTED');

-- CreateEnum
CREATE TYPE "PalletStatus" AS ENUM ('OPEN', 'SEALED', 'DISPATCHED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('PLANNING', 'READY', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'COMPLETED_WITH_DISCREPANCIES');

-- CreateEnum
CREATE TYPE "DiscrepancyType" AS ENUM ('MISSING', 'EXTRA', 'DAMAGED');

-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "current_warehouse_id" INTEGER,
ADD COLUMN     "pallet_id" INTEGER;

-- AlterTable (add columns with nullable event_type first)
ALTER TABLE "ParcelEvent" ADD COLUMN     "description" TEXT,
ADD COLUMN     "event_type" "ParcelEventType",
ADD COLUMN     "pallet_id" INTEGER,
ADD COLUMN     "warehouse_id" INTEGER;

-- Update existing records with a default event_type based on status
UPDATE "ParcelEvent" SET "event_type" = 'BILLED' WHERE "event_type" IS NULL AND "status" = 'IN_AGENCY';
UPDATE "ParcelEvent" SET "event_type" = 'ADDED_TO_PALLET' WHERE "event_type" IS NULL AND "status" = 'IN_PALLET';
UPDATE "ParcelEvent" SET "event_type" = 'ADDED_TO_DISPATCH' WHERE "event_type" IS NULL AND "status" = 'IN_DISPATCH';
UPDATE "ParcelEvent" SET "event_type" = 'RECEIVED_IN_DISPATCH' WHERE "event_type" IS NULL AND "status" = 'RECEIVED_IN_DISPATCH';
UPDATE "ParcelEvent" SET "event_type" = 'WAREHOUSE_RECEIVED' WHERE "event_type" IS NULL AND "status" = 'IN_WAREHOUSE';
UPDATE "ParcelEvent" SET "event_type" = 'LOADED_TO_CONTAINER' WHERE "event_type" IS NULL AND "status" = 'IN_CONTAINER';
UPDATE "ParcelEvent" SET "event_type" = 'IN_TRANSIT' WHERE "event_type" IS NULL AND "status" = 'IN_TRANSIT';
UPDATE "ParcelEvent" SET "event_type" = 'ARRIVED_DESTINATION' WHERE "event_type" IS NULL AND "status" = 'AT_PORT_OF_ENTRY';
UPDATE "ParcelEvent" SET "event_type" = 'CUSTOMS_PROCESSING' WHERE "event_type" IS NULL AND "status" = 'CUSTOMS_INSPECTION';
UPDATE "ParcelEvent" SET "event_type" = 'CUSTOMS_RELEASED' WHERE "event_type" IS NULL AND "status" = 'RELEASED_FROM_CUSTOMS';
UPDATE "ParcelEvent" SET "event_type" = 'OUT_FOR_DELIVERY' WHERE "event_type" IS NULL AND "status" = 'OUT_FOR_DELIVERY';
UPDATE "ParcelEvent" SET "event_type" = 'DELIVERY_FAILED' WHERE "event_type" IS NULL AND "status" = 'FAILED_DELIVERY';
UPDATE "ParcelEvent" SET "event_type" = 'DELIVERED' WHERE "event_type" IS NULL AND "status" = 'PARTIALLY_DELIVERED';
UPDATE "ParcelEvent" SET "event_type" = 'DELIVERED' WHERE "event_type" IS NULL AND "status" = 'DELIVERED';
UPDATE "ParcelEvent" SET "event_type" = 'DELIVERY_FAILED' WHERE "event_type" IS NULL AND "status" = 'RETURNED_TO_SENDER';
-- Fallback for any remaining null values
UPDATE "ParcelEvent" SET "event_type" = 'NOTE_ADDED' WHERE "event_type" IS NULL;

-- Now make event_type NOT NULL
ALTER TABLE "ParcelEvent" ALTER COLUMN "event_type" SET NOT NULL;

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "carrier_id" INTEGER NOT NULL,
    "province_id" INTEGER NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "manager_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRoute" (
    "id" SERIAL NOT NULL,
    "route_number" TEXT NOT NULL,
    "carrier_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "messenger_id" TEXT NOT NULL,
    "province_id" INTEGER NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'PLANNING',
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "DeliveryRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAssignment" (
    "id" SERIAL NOT NULL,
    "parcel_id" INTEGER NOT NULL,
    "route_id" INTEGER,
    "messenger_id" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "recipient_name" TEXT,
    "recipient_ci" TEXT,
    "signature" TEXT,
    "photo_proof" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pallet" (
    "id" SERIAL NOT NULL,
    "pallet_number" TEXT NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "status" "PalletStatus" NOT NULL DEFAULT 'OPEN',
    "total_weight_kg" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "parcels_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "dispatch_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "Pallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManifestVerification" (
    "id" SERIAL NOT NULL,
    "container_id" INTEGER,
    "flight_id" INTEGER,
    "status" "VerificationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "expected_count" INTEGER NOT NULL,
    "received_count" INTEGER NOT NULL DEFAULT 0,
    "missing_count" INTEGER NOT NULL DEFAULT 0,
    "extra_count" INTEGER NOT NULL DEFAULT 0,
    "verified_by_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManifestVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManifestDiscrepancy" (
    "id" SERIAL NOT NULL,
    "verification_id" INTEGER NOT NULL,
    "parcel_id" INTEGER,
    "tracking_number" TEXT NOT NULL,
    "discrepancy_type" "DiscrepancyType" NOT NULL,
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManifestDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Warehouse_carrier_id_is_active_idx" ON "Warehouse"("carrier_id", "is_active");

-- CreateIndex
CREATE INDEX "Warehouse_province_id_idx" ON "Warehouse"("province_id");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_carrier_id_province_id_is_main_key" ON "Warehouse"("carrier_id", "province_id", "is_main");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRoute_route_number_key" ON "DeliveryRoute"("route_number");

-- CreateIndex
CREATE INDEX "DeliveryRoute_carrier_id_status_idx" ON "DeliveryRoute"("carrier_id", "status");

-- CreateIndex
CREATE INDEX "DeliveryRoute_messenger_id_scheduled_date_idx" ON "DeliveryRoute"("messenger_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "DeliveryRoute_warehouse_id_idx" ON "DeliveryRoute"("warehouse_id");

-- CreateIndex
CREATE INDEX "DeliveryRoute_province_id_idx" ON "DeliveryRoute"("province_id");

-- CreateIndex
CREATE INDEX "DeliveryRoute_scheduled_date_idx" ON "DeliveryRoute"("scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAssignment_parcel_id_key" ON "DeliveryAssignment"("parcel_id");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_route_id_status_idx" ON "DeliveryAssignment"("route_id", "status");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_messenger_id_status_idx" ON "DeliveryAssignment"("messenger_id", "status");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_status_idx" ON "DeliveryAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Pallet_pallet_number_key" ON "Pallet"("pallet_number");

-- CreateIndex
CREATE INDEX "Pallet_agency_id_status_idx" ON "Pallet"("agency_id", "status");

-- CreateIndex
CREATE INDEX "Pallet_pallet_number_idx" ON "Pallet"("pallet_number");

-- CreateIndex
CREATE INDEX "Pallet_dispatch_id_idx" ON "Pallet"("dispatch_id");

-- CreateIndex
CREATE INDEX "ManifestVerification_container_id_idx" ON "ManifestVerification"("container_id");

-- CreateIndex
CREATE INDEX "ManifestVerification_flight_id_idx" ON "ManifestVerification"("flight_id");

-- CreateIndex
CREATE INDEX "ManifestVerification_status_idx" ON "ManifestVerification"("status");

-- CreateIndex
CREATE INDEX "ManifestDiscrepancy_verification_id_idx" ON "ManifestDiscrepancy"("verification_id");

-- CreateIndex
CREATE INDEX "ManifestDiscrepancy_parcel_id_idx" ON "ManifestDiscrepancy"("parcel_id");

-- CreateIndex
CREATE INDEX "ManifestDiscrepancy_discrepancy_type_idx" ON "ManifestDiscrepancy"("discrepancy_type");

-- CreateIndex
CREATE INDEX "Parcel_pallet_id_idx" ON "Parcel"("pallet_id");

-- CreateIndex
CREATE INDEX "Parcel_current_warehouse_id_idx" ON "Parcel"("current_warehouse_id");

-- CreateIndex
CREATE INDEX "ParcelEvent_event_type_idx" ON "ParcelEvent"("event_type");

-- CreateIndex
CREATE INDEX "ParcelEvent_pallet_id_idx" ON "ParcelEvent"("pallet_id");

-- CreateIndex
CREATE INDEX "ParcelEvent_warehouse_id_idx" ON "ParcelEvent"("warehouse_id");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_messenger_id_fkey" FOREIGN KEY ("messenger_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "DeliveryRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_messenger_id_fkey" FOREIGN KEY ("messenger_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_pallet_id_fkey" FOREIGN KEY ("pallet_id") REFERENCES "Pallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_current_warehouse_id_fkey" FOREIGN KEY ("current_warehouse_id") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelEvent" ADD CONSTRAINT "ParcelEvent_pallet_id_fkey" FOREIGN KEY ("pallet_id") REFERENCES "Pallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelEvent" ADD CONSTRAINT "ParcelEvent_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pallet" ADD CONSTRAINT "Pallet_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pallet" ADD CONSTRAINT "Pallet_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "Dispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pallet" ADD CONSTRAINT "Pallet_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestVerification" ADD CONSTRAINT "ManifestVerification_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestVerification" ADD CONSTRAINT "ManifestVerification_flight_id_fkey" FOREIGN KEY ("flight_id") REFERENCES "Flight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestVerification" ADD CONSTRAINT "ManifestVerification_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestDiscrepancy" ADD CONSTRAINT "ManifestDiscrepancy_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "ManifestVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestDiscrepancy" ADD CONSTRAINT "ManifestDiscrepancy_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestDiscrepancy" ADD CONSTRAINT "ManifestDiscrepancy_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
