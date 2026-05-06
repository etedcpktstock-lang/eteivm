-- AlterTable
ALTER TABLE "Transaction"
  ADD COLUMN "asset_tag" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_asset_tag_idx" ON "Transaction"("asset_tag");
