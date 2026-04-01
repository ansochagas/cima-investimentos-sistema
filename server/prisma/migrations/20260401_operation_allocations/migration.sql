-- CreateTable
CREATE TABLE "OperationAllocation" (
    "id" SERIAL NOT NULL,
    "operationId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "balanceBefore" DECIMAL(18,2) NOT NULL,
    "stakeAmount" DECIMAL(18,2) NOT NULL,
    "pnlAmount" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationAllocation_operationId_clientId_key" ON "OperationAllocation"("operationId", "clientId");

-- CreateIndex
CREATE INDEX "OperationAllocation_clientId_operationId_idx" ON "OperationAllocation"("clientId", "operationId");

-- AddForeignKey
ALTER TABLE "OperationAllocation" ADD CONSTRAINT "OperationAllocation_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationAllocation" ADD CONSTRAINT "OperationAllocation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
