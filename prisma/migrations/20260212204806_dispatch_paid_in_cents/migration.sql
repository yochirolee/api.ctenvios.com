-- AlterTable
ALTER TABLE "Dispatch" ADD COLUMN     "paid_in_cents" INTEGER NOT NULL DEFAULT 0;

-- Backfill paid_in_cents from existing DispatchPayment rows
UPDATE "Dispatch" d
SET paid_in_cents = COALESCE(
  (SELECT SUM(amount_in_cents)::integer FROM "DispatchPayment" dp WHERE dp.dispatch_id = d.id),
  0
);
