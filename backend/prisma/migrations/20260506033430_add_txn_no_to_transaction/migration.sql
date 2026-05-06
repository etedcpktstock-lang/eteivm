-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "txn_no" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_job_id_txn_no_idx" ON "Transaction"("job_id", "txn_no");
