-- AlterTable
ALTER TABLE "user" ADD COLUMN     "carrier_id" INTEGER;

-- CreateIndex
CREATE INDEX "user_carrier_id_role_idx" ON "user"("carrier_id", "role");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
