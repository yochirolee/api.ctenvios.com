-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "InterAgencyDebt" (
    "id" SERIAL NOT NULL,
    "debtor_agency_id" INTEGER NOT NULL,
    "creditor_agency_id" INTEGER NOT NULL,
    "dispatch_id" INTEGER NOT NULL,
    "amount_in_cents" INTEGER NOT NULL DEFAULT 0,
    "original_sender_agency_id" INTEGER NOT NULL,
    "relationship" TEXT NOT NULL,
    "status" "DebtStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "paid_by_id" TEXT,
    "notes" TEXT,

    CONSTRAINT "InterAgencyDebt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterAgencyDebt_debtor_agency_id_creditor_agency_id_idx" ON "InterAgencyDebt"("debtor_agency_id", "creditor_agency_id");

-- CreateIndex
CREATE INDEX "InterAgencyDebt_dispatch_id_idx" ON "InterAgencyDebt"("dispatch_id");

-- CreateIndex
CREATE INDEX "InterAgencyDebt_status_idx" ON "InterAgencyDebt"("status");

-- CreateIndex
CREATE INDEX "InterAgencyDebt_original_sender_agency_id_idx" ON "InterAgencyDebt"("original_sender_agency_id");

-- CreateIndex
CREATE INDEX "InterAgencyDebt_creditor_agency_id_status_idx" ON "InterAgencyDebt"("creditor_agency_id", "status");

-- CreateIndex
CREATE INDEX "InterAgencyDebt_debtor_agency_id_status_idx" ON "InterAgencyDebt"("debtor_agency_id", "status");

-- AddForeignKey
ALTER TABLE "InterAgencyDebt" ADD CONSTRAINT "InterAgencyDebt_debtor_agency_id_fkey" FOREIGN KEY ("debtor_agency_id") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterAgencyDebt" ADD CONSTRAINT "InterAgencyDebt_creditor_agency_id_fkey" FOREIGN KEY ("creditor_agency_id") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterAgencyDebt" ADD CONSTRAINT "InterAgencyDebt_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "Dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterAgencyDebt" ADD CONSTRAINT "InterAgencyDebt_original_sender_agency_id_fkey" FOREIGN KEY ("original_sender_agency_id") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterAgencyDebt" ADD CONSTRAINT "InterAgencyDebt_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
