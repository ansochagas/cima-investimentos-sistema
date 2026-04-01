-- CreateEnum
CREATE TYPE "OperationOutcome" AS ENUM ('OPEN', 'WON', 'LOST', 'VOID');

-- AlterTable
ALTER TABLE "Operation" ADD COLUMN     "eventName" TEXT,
ADD COLUMN     "market" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "odds" DECIMAL(9,4),
ADD COLUMN     "outcome" "OperationOutcome",
ADD COLUMN     "pnlAmount" DECIMAL(18,2),
ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "stakePct" DECIMAL(9,4),
ADD COLUMN     "totalStakeAmount" DECIMAL(18,2),
ADD COLUMN     "updatedAt" TIMESTAMP(3);

UPDATE "Operation"
SET "updatedAt" = COALESCE("updatedAt", "settledAt", "date", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "Operation"
ALTER COLUMN "updatedAt" SET NOT NULL;

