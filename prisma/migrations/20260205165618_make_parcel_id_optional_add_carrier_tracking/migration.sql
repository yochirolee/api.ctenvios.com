/*
  Warnings:

  - A unique constraint covering the columns `[carrier_tracking_number]` on the table `Parcel` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_parcel_id_fkey";

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "parcel_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "carrier_tracking_number" TEXT;

-- CreateIndex
CREATE INDEX "OrderItem_parcel_id_idx" ON "OrderItem"("parcel_id");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_carrier_tracking_number_key" ON "Parcel"("carrier_tracking_number");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
