-- DropForeignKey
ALTER TABLE "Parcel" DROP CONSTRAINT IF EXISTS "Parcel_current_agency_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Parcel_current_agency_id_idx";

-- AlterTable
ALTER TABLE "Parcel" DROP COLUMN IF EXISTS "current_agency_id";
