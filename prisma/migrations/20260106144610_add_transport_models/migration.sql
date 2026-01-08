-- CreateEnum
CREATE TYPE "ContainerType" AS ENUM ('DRY_20FT', 'DRY_40FT', 'DRY_40FT_HC', 'REEFER_20FT', 'REEFER_40FT');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('PENDING', 'LOADING', 'SEALED', 'DEPARTED', 'IN_TRANSIT', 'AT_PORT', 'CUSTOMS_HOLD', 'CUSTOMS_CLEARED', 'UNLOADING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('PENDING', 'LOADING', 'DEPARTED', 'IN_TRANSIT', 'LANDED', 'CUSTOMS_HOLD', 'CUSTOMS_CLEARED', 'UNLOADING', 'COMPLETED');

-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "container_id" INTEGER,
ADD COLUMN     "flight_id" INTEGER;

-- CreateTable
CREATE TABLE "Container" (
    "id" SERIAL NOT NULL,
    "container_number" TEXT NOT NULL,
    "bl_number" TEXT,
    "seal_number" TEXT,
    "container_type" "ContainerType" NOT NULL DEFAULT 'DRY_40FT',
    "status" "ContainerStatus" NOT NULL DEFAULT 'PENDING',
    "vessel_name" TEXT,
    "voyage_number" TEXT,
    "origin_port" TEXT NOT NULL,
    "destination_port" TEXT NOT NULL,
    "max_weight_kg" DECIMAL(65,30),
    "current_weight_kg" DECIMAL(65,30) DEFAULT 0.00,
    "estimated_departure" TIMESTAMP(3),
    "estimated_arrival" TIMESTAMP(3),
    "actual_departure" TIMESTAMP(3),
    "actual_arrival" TIMESTAMP(3),
    "notes" TEXT,
    "forwarder_id" INTEGER NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerEvent" (
    "id" SERIAL NOT NULL,
    "container_id" INTEGER NOT NULL,
    "status" "ContainerStatus" NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "ContainerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flight" (
    "id" SERIAL NOT NULL,
    "awb_number" TEXT NOT NULL,
    "flight_number" TEXT,
    "status" "FlightStatus" NOT NULL DEFAULT 'PENDING',
    "airline" TEXT,
    "origin_airport" TEXT NOT NULL,
    "destination_airport" TEXT NOT NULL,
    "estimated_departure" TIMESTAMP(3),
    "estimated_arrival" TIMESTAMP(3),
    "actual_departure" TIMESTAMP(3),
    "actual_arrival" TIMESTAMP(3),
    "total_weight_kg" DECIMAL(65,30) DEFAULT 0.00,
    "total_pieces" INTEGER DEFAULT 0,
    "notes" TEXT,
    "forwarder_id" INTEGER NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "Flight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightEvent" (
    "id" SERIAL NOT NULL,
    "flight_id" INTEGER NOT NULL,
    "status" "FlightStatus" NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "FlightEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Container_container_number_key" ON "Container"("container_number");

-- CreateIndex
CREATE INDEX "Container_container_number_idx" ON "Container"("container_number");

-- CreateIndex
CREATE INDEX "Container_bl_number_idx" ON "Container"("bl_number");

-- CreateIndex
CREATE INDEX "Container_status_idx" ON "Container"("status");

-- CreateIndex
CREATE INDEX "Container_forwarder_id_idx" ON "Container"("forwarder_id");

-- CreateIndex
CREATE INDEX "Container_provider_id_idx" ON "Container"("provider_id");

-- CreateIndex
CREATE INDEX "Container_estimated_arrival_idx" ON "Container"("estimated_arrival");

-- CreateIndex
CREATE INDEX "ContainerEvent_container_id_created_at_idx" ON "ContainerEvent"("container_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Flight_awb_number_key" ON "Flight"("awb_number");

-- CreateIndex
CREATE INDEX "Flight_awb_number_idx" ON "Flight"("awb_number");

-- CreateIndex
CREATE INDEX "Flight_flight_number_idx" ON "Flight"("flight_number");

-- CreateIndex
CREATE INDEX "Flight_status_idx" ON "Flight"("status");

-- CreateIndex
CREATE INDEX "Flight_forwarder_id_idx" ON "Flight"("forwarder_id");

-- CreateIndex
CREATE INDEX "Flight_provider_id_idx" ON "Flight"("provider_id");

-- CreateIndex
CREATE INDEX "Flight_estimated_arrival_idx" ON "Flight"("estimated_arrival");

-- CreateIndex
CREATE INDEX "FlightEvent_flight_id_created_at_idx" ON "FlightEvent"("flight_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Parcel_container_id_idx" ON "Parcel"("container_id");

-- CreateIndex
CREATE INDEX "Parcel_flight_id_idx" ON "Parcel"("flight_id");

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_flight_id_fkey" FOREIGN KEY ("flight_id") REFERENCES "Flight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "Forwarder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerEvent" ADD CONSTRAINT "ContainerEvent_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerEvent" ADD CONSTRAINT "ContainerEvent_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "Forwarder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightEvent" ADD CONSTRAINT "FlightEvent_flight_id_fkey" FOREIGN KEY ("flight_id") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightEvent" ADD CONSTRAINT "FlightEvent_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
