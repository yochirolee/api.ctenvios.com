/*
  Warnings:

  - You are about to drop the column `fixed_fee` on the `CustomsTariff` table. All the data in the column will be lost.
  - Added the required column `fee` to the `CustomsTariff` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CustomsTariff" DROP COLUMN "fixed_fee",
ADD COLUMN     "fee" DOUBLE PRECISION NOT NULL;
