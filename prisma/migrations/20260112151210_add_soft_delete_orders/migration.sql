-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "deletion_reason" TEXT;

-- CreateIndex
CREATE INDEX "Order_deleted_at_idx" ON "Order"("deleted_at");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
