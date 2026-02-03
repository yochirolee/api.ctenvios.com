-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "external_reference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_external_reference_key" ON "Parcel"("external_reference");
