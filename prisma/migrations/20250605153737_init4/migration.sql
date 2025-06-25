/*
  Warnings:

  - The primary key for the `Customer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Customer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Receipt` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Receipt` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `_CustomerToReceipt` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `invoice_id` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `A` on the `_CustomerToReceipt` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `B` on the `_CustomerToReceipt` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "_CustomerToReceipt" DROP CONSTRAINT "_CustomerToReceipt_A_fkey";

-- DropForeignKey
ALTER TABLE "_CustomerToReceipt" DROP CONSTRAINT "_CustomerToReceipt_B_fkey";

-- AlterTable
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_pkey",
ADD COLUMN     "agency_id" INTEGER,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Customer_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "invoice_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_pkey",
ADD COLUMN     "agency_id" INTEGER,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "_CustomerToReceipt" DROP CONSTRAINT "_CustomerToReceipt_AB_pkey",
DROP COLUMN "A",
ADD COLUMN     "A" INTEGER NOT NULL,
DROP COLUMN "B",
ADD COLUMN     "B" INTEGER NOT NULL,
ADD CONSTRAINT "_CustomerToReceipt_AB_pkey" PRIMARY KEY ("A", "B");

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "receipt_id" INTEGER NOT NULL,
    "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "_CustomerToReceipt_B_index" ON "_CustomerToReceipt"("B");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerToReceipt" ADD CONSTRAINT "_CustomerToReceipt_A_fkey" FOREIGN KEY ("A") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerToReceipt" ADD CONSTRAINT "_CustomerToReceipt_B_fkey" FOREIGN KEY ("B") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
