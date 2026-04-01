import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { rebuildPortfolioLedger } from "./src/utils/calc.js";

const prisma = new PrismaClient();

async function main() {
  const result = await rebuildPortfolioLedger(prisma);
  console.log(
    `Ledger reconstruido: ${result.operationSnapshots.length} operacoes, ${result.allocationCount} alocacoes`
  );
}

main()
  .catch((error) => {
    console.error("Erro ao reconstruir ledger:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
