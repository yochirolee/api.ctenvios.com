-- AlterTable: Add soft delete field to Parcel
ALTER TABLE "Parcel" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable: Add soft delete field to OrderItem
ALTER TABLE "OrderItem" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex: Index for deleted_at on Parcel to optimize queries filtering by deletion status
CREATE INDEX "Parcel_deleted_at_idx" ON "Parcel"("deleted_at");

-- CreateIndex: Index for deleted_at on OrderItem to optimize queries filtering by deletion status
CREATE INDEX "OrderItem_deleted_at_idx" ON "OrderItem"("deleted_at");
