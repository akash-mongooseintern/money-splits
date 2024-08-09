-- CreateTable
CREATE TABLE "transaction_meta" (
    "transaction_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "total_person" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_meta_transaction_id_key" ON "transaction_meta"("transaction_id");

-- AddForeignKey
ALTER TABLE "transaction_meta" ADD CONSTRAINT "transaction_meta_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
