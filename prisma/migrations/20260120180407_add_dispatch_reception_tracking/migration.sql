-- AlterEnum
ALTER TYPE "DispatchStatus" ADD VALUE 'PARTIAL_RECEIVED';

-- AlterTable
ALTER TABLE "Dispatch" ADD COLUMN     "origin_dispatch_id" INTEGER;

-- CreateIndex
CREATE INDEX "Dispatch_origin_dispatch_id_idx" ON "Dispatch"("origin_dispatch_id");

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_origin_dispatch_id_fkey" FOREIGN KEY ("origin_dispatch_id") REFERENCES "Dispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
