/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Forwarder` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Forwarder" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Forwarder_code_key" ON "Forwarder"("code");
