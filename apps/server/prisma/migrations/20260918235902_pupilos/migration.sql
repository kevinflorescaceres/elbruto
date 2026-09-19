-- AlterTable
ALTER TABLE "Brute" ADD COLUMN     "masterId" TEXT;

-- CreateIndex
CREATE INDEX "Brute_masterId_idx" ON "Brute"("masterId");

-- AddForeignKey
ALTER TABLE "Brute" ADD CONSTRAINT "Brute_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "Brute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
