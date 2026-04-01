import "dotenv/config";
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function run(command) {
  console.log(`[deploy] ${command}`);
  execSync(command, { stdio: "inherit", shell: true });
}

function isPostgresUrl(databaseUrl) {
  return /^postgres(ql)?:\/\//i.test(String(databaseUrl || ""));
}

async function readFlag(query) {
  const rows = await prisma.$queryRawUnsafe(query);
  const firstRow = rows?.[0] || {};
  const value = Object.values(firstRow)[0];
  return Boolean(value);
}

async function inspectLegacyState() {
  const hasMigrationsTable = await readFlag(
    "SELECT to_regclass('public.\"_prisma_migrations\"') IS NOT NULL"
  );
  const hasUserTable = await readFlag(
    "SELECT to_regclass('public.\"User\"') IS NOT NULL"
  );
  const hasClientTable = await readFlag(
    "SELECT to_regclass('public.\"Client\"') IS NOT NULL"
  );
  const hasOperationTable = await readFlag(
    "SELECT to_regclass('public.\"Operation\"') IS NOT NULL"
  );
  const hasAuditLogTable = await readFlag(
    "SELECT to_regclass('public.\"AuditLog\"') IS NOT NULL"
  );
  const hasCollectiveColumns = await readFlag(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Operation'
        AND column_name = 'eventName'
    )
  `);
  const hasOperationAllocation = await readFlag(
    "SELECT to_regclass('public.\"OperationAllocation\"') IS NOT NULL"
  );

  return {
    hasMigrationsTable,
    hasLegacyCore:
      hasUserTable && hasClientTable && hasOperationTable && hasAuditLogTable,
    hasCollectiveColumns,
    hasOperationAllocation,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || "";

  if (!isPostgresUrl(databaseUrl)) {
    run("npx prisma migrate deploy");
    return;
  }

  const state = await inspectLegacyState();
  await prisma.$disconnect();

  if (!state.hasMigrationsTable && state.hasLegacyCore) {
    console.log("[deploy] banco legado detectado, aplicando baseline");
    run("npx prisma migrate resolve --applied 20260331_initial_schema");

    if (state.hasCollectiveColumns) {
      run("npx prisma migrate resolve --applied 20260401_collective_wallet");
    }

    if (state.hasOperationAllocation) {
      run("npx prisma migrate resolve --applied 20260401_operation_allocations");
    }
  }

  run("npx prisma migrate deploy");
}

main().catch(async (error) => {
  console.error("[deploy] erro ao preparar migrations:", error);
  await prisma.$disconnect().catch(() => {});
  process.exitCode = 1;
});
