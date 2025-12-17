-- AlterTable
ALTER TABLE "LegacyIssue" ADD COLUMN     "agency_id" INTEGER;

-- CreateIndex
CREATE INDEX "LegacyIssue_agency_id_status_idx" ON "LegacyIssue"("agency_id", "status");

-- AddForeignKey
ALTER TABLE "LegacyIssue" ADD CONSTRAINT "LegacyIssue_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
