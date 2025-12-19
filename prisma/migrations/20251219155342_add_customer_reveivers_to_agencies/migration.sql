/*
  Warnings:

  - You are about to drop the column `agency_id` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `agency_id` on the `Receiver` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_agency_id_fkey";

-- DropForeignKey
ALTER TABLE "Receiver" DROP CONSTRAINT "Receiver_agency_id_fkey";

-- DropIndex
DROP INDEX "Customer_agency_id_created_at_idx";

-- DropIndex
DROP INDEX "Receiver_agency_id_idx";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "agency_id";

-- AlterTable
ALTER TABLE "Receiver" DROP COLUMN "agency_id";

-- CreateTable
CREATE TABLE "_AgencyToCustomer" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AgencyToCustomer_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AgencyToReceiver" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AgencyToReceiver_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AgencyToCustomer_B_index" ON "_AgencyToCustomer"("B");

-- CreateIndex
CREATE INDEX "_AgencyToReceiver_B_index" ON "_AgencyToReceiver"("B");

-- AddForeignKey
ALTER TABLE "_AgencyToCustomer" ADD CONSTRAINT "_AgencyToCustomer_A_fkey" FOREIGN KEY ("A") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgencyToCustomer" ADD CONSTRAINT "_AgencyToCustomer_B_fkey" FOREIGN KEY ("B") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgencyToReceiver" ADD CONSTRAINT "_AgencyToReceiver_A_fkey" FOREIGN KEY ("A") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgencyToReceiver" ADD CONSTRAINT "_AgencyToReceiver_B_fkey" FOREIGN KEY ("B") REFERENCES "Receiver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
