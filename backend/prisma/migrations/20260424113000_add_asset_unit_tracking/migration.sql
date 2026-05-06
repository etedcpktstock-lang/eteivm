-- CreateEnum
CREATE TYPE "TrackingType" AS ENUM ('BATCH', 'SERIALIZED');

-- CreateEnum
CREATE TYPE "AssetUnitStatus" AS ENUM ('stock', 'quarantine', 'repair', 'in_transit', 'with_customer', 'scrap', 'lost');

-- AlterTable
ALTER TABLE "MasterItem"
  ADD COLUMN "tracking_type" "TrackingType" NOT NULL DEFAULT 'BATCH';

-- CreateTable
CREATE TABLE "AssetUnit" (
  "id" SERIAL NOT NULL,
  "master_item_id" INTEGER NOT NULL,
  "asset_tag" TEXT NOT NULL,
  "serial_number" TEXT,
  "status" "AssetUnitStatus" NOT NULL DEFAULT 'stock',
  "current_warehouse_id" INTEGER,
  "holder_customer_cv" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AssetUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetUnit_asset_tag_key" ON "AssetUnit"("asset_tag");
CREATE UNIQUE INDEX "AssetUnit_serial_number_key" ON "AssetUnit"("serial_number");
CREATE INDEX "AssetUnit_master_item_id_idx" ON "AssetUnit"("master_item_id");
CREATE INDEX "AssetUnit_status_idx" ON "AssetUnit"("status");
CREATE INDEX "AssetUnit_current_warehouse_id_idx" ON "AssetUnit"("current_warehouse_id");
CREATE INDEX "AssetUnit_holder_customer_cv_idx" ON "AssetUnit"("holder_customer_cv");
CREATE INDEX "AssetUnit_status_current_warehouse_id_idx" ON "AssetUnit"("status", "current_warehouse_id");

CREATE INDEX "MasterItem_tracking_type_idx" ON "MasterItem"("tracking_type");
CREATE INDEX "Job_status_created_at_idx" ON "Job"("status", "created_at");
CREATE INDEX "Transaction_job_id_created_at_idx" ON "Transaction"("job_id", "created_at");
CREATE INDEX "Transaction_action_type_created_at_idx" ON "Transaction"("action_type", "created_at");
CREATE INDEX "Transaction_warehouse_id_created_at_idx" ON "Transaction"("warehouse_id", "created_at");

-- AddForeignKey
ALTER TABLE "AssetUnit"
  ADD CONSTRAINT "AssetUnit_master_item_id_fkey"
  FOREIGN KEY ("master_item_id") REFERENCES "MasterItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssetUnit"
  ADD CONSTRAINT "AssetUnit_current_warehouse_id_fkey"
  FOREIGN KEY ("current_warehouse_id") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssetUnit"
  ADD CONSTRAINT "AssetUnit_holder_customer_cv_fkey"
  FOREIGN KEY ("holder_customer_cv") REFERENCES "Customer"("cv")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Data integrity checks (safe rollout with NOT VALID)
ALTER TABLE "WarehouseStock"
  ADD CONSTRAINT "WarehouseStock_non_negative_qty_ck"
  CHECK (
    "stock_qty" >= 0 AND
    "repair_qty" >= 0 AND
    "scrap_qty" >= 0 AND
    "lost_qty" >= 0 AND
    "quarantine_qty" >= 0 AND
    "transit_qty" >= 0
  ) NOT VALID;

ALTER TABLE "CustomerInventory"
  ADD CONSTRAINT "CustomerInventory_non_negative_qty_ck"
  CHECK ("quantity" >= 0) NOT VALID;

ALTER TABLE "MasterItem"
  ADD CONSTRAINT "MasterItem_non_negative_stock_qty_ck"
  CHECK ("stock_qty" >= 0) NOT VALID;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_positive_quantity_ck"
  CHECK ("quantity" > 0) NOT VALID;
