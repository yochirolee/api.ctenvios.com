/*
  Warnings:

  - You are about to drop the column `paid_by_id` on the `Dispatch` table. All the data in the column will be lost.
  - You are about to drop the column `payment_date` on the `Dispatch` table. All the data in the column will be lost.
  - You are about to drop the column `payment_method` on the `Dispatch` table. All the data in the column will be lost.
  - You are about to drop the column `payment_notes` on the `Dispatch` table. All the data in the column will be lost.
  - You are about to drop the column `payment_reference` on the `Dispatch` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Dispatch" DROP CONSTRAINT "Dispatch_paid_by_id_fkey";

-- AlterTable
ALTER TABLE "Dispatch" DROP COLUMN "paid_by_id",
DROP COLUMN "payment_date",
DROP COLUMN "payment_method",
DROP COLUMN "payment_notes",
DROP COLUMN "payment_reference";

-- CreateTable
CREATE TABLE "DispatchPayment" (
    "id" SERIAL NOT NULL,
    "dispatch_id" INTEGER NOT NULL,
    "amount_in_cents" INTEGER NOT NULL DEFAULT 0,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_by_id" TEXT,

    CONSTRAINT "DispatchPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DispatchPayment_dispatch_id_idx" ON "DispatchPayment"("dispatch_id");

-- CreateIndex
CREATE INDEX "DispatchPayment_paid_by_id_idx" ON "DispatchPayment"("paid_by_id");

-- AddForeignKey
ALTER TABLE "DispatchPayment" ADD CONSTRAINT "DispatchPayment_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "Dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchPayment" ADD CONSTRAINT "DispatchPayment_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
