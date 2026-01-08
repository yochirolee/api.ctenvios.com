-- AlterTable
ALTER TABLE "ParcelEvent" ADD COLUMN     "container_id" INTEGER,
ADD COLUMN     "dispatch_id" INTEGER,
ADD COLUMN     "flight_id" INTEGER,
ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE INDEX "ParcelEvent_parcel_id_created_at_idx" ON "ParcelEvent"("parcel_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ParcelEvent_dispatch_id_idx" ON "ParcelEvent"("dispatch_id");

-- CreateIndex
CREATE INDEX "ParcelEvent_container_id_idx" ON "ParcelEvent"("container_id");

-- CreateIndex
CREATE INDEX "ParcelEvent_flight_id_idx" ON "ParcelEvent"("flight_id");

-- AddForeignKey
ALTER TABLE "ParcelEvent" ADD CONSTRAINT "ParcelEvent_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "Dispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelEvent" ADD CONSTRAINT "ParcelEvent_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelEvent" ADD CONSTRAINT "ParcelEvent_flight_id_fkey" FOREIGN KEY ("flight_id") REFERENCES "Flight"("id") ON DELETE SET NULL ON UPDATE CASCADE;
