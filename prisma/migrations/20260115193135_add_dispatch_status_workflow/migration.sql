-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DispatchStatus" ADD VALUE 'LOADING';
ALTER TYPE "DispatchStatus" ADD VALUE 'RECEIVING';

-- AlterEnum
ALTER TYPE "ParcelEventType" ADD VALUE 'REMOVED_FROM_DISPATCH';
