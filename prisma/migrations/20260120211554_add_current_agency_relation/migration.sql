-- CreateIndex
CREATE INDEX "Parcel_current_agency_id_idx" ON "Parcel"("current_agency_id");

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_current_agency_id_fkey" FOREIGN KEY ("current_agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
