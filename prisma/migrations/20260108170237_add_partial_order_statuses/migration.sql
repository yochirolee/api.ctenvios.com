-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Status" ADD VALUE 'PARTIALLY_IN_PALLET';
ALTER TYPE "Status" ADD VALUE 'PARTIALLY_IN_DISPATCH';
ALTER TYPE "Status" ADD VALUE 'PARTIALLY_IN_CONTAINER';
ALTER TYPE "Status" ADD VALUE 'PARTIALLY_IN_TRANSIT';
ALTER TYPE "Status" ADD VALUE 'PARTIALLY_AT_PORT';
ALTER TYPE "Status" ADD VALUE 'PARTIALLY_IN_CUSTOMS';
ALTER TYPE "Status" ADD VALUE 'PARTIALLY_RELEASED';
ALTER TYPE "Status" ADD VALUE 'PARTIALLY_OUT_FOR_DELIVERY';
