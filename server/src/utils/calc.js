import { PrismaClient, Prisma } from "@prisma/client";

function toDecimal(value = 0) {
  if (value instanceof Prisma.Decimal) return value;
  if (value === null || value === undefined || value === "") {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(value);
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function normalizeOutcome(outcome) {
  if (!outcome) return null;
  const normalized = String(outcome).toUpperCase();
  return ["OPEN", "WON", "LOST", "VOID"].includes(normalized)
    ? normalized
    : null;
}

function isEligible(client, operationDate) {
  return new Date(client.startDate) <= operationDate;
}

function isCollectiveOperation(operation) {
  return operation.stakePct !== null && operation.stakePct !== undefined;
}

function isSettledOutcome(outcome) {
  return outcome !== "OPEN";
}

function buildOperationLabel(operation) {
  const explicitDescription = String(operation.description || "").trim();
  if (explicitDescription) return explicitDescription;

  const parts = [operation.eventName, operation.market]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  return parts.join(" - ") || "Operacao";
}

function deriveCollectiveResultPct(operation) {
  const stakePct = toDecimal(operation.stakePct);
  const odds = toDecimal(operation.odds);
  const outcome = normalizeOutcome(operation.outcome);

  if (outcome === "WON") {
    return stakePct.mul(odds.minus(1));
  }
  if (outcome === "LOST") {
    return stakePct.neg();
  }
  return new Prisma.Decimal(0);
}

function deriveResultPct(operation) {
  if (isCollectiveOperation(operation)) {
    return deriveCollectiveResultPct(operation);
  }
  return toDecimal(operation.resultPct);
}

function computeCollectivePnl(stakeAmount, operation) {
  const outcome = normalizeOutcome(operation.outcome);
  const odds = toDecimal(operation.odds);

  if (outcome === "WON") {
    return stakeAmount.mul(odds.minus(1));
  }
  if (outcome === "LOST") {
    return stakeAmount.neg();
  }
  return new Prisma.Decimal(0);
}

function getPrismaHandle(providedPrisma) {
  if (providedPrisma) {
    return { prisma: providedPrisma, ownsPrisma: false };
  }

  return { prisma: new PrismaClient(), ownsPrisma: true };
}

function orderClients(clients) {
  return [...clients].sort((a, b) => {
    const dateDiff =
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.id - b.id;
  });
}

function orderOperations(operations) {
  return [...operations].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.id - b.id;
  });
}

function buildSnapshotFromOperation(operation, clientImpacts, totalCapital, totalStakeAmount, pnlAmount) {
  return {
    id: operation.id,
    date: operation.date,
    description: buildOperationLabel(operation),
    eventName: operation.eventName,
    market: operation.market,
    odds: operation.odds ? toDecimal(operation.odds) : null,
    stakePct:
      operation.stakePct !== null && operation.stakePct !== undefined
        ? toDecimal(operation.stakePct)
        : null,
    outcome: normalizeOutcome(operation.outcome),
    settledAt: operation.settledAt,
    notes: operation.notes,
    totalCapital,
    totalStakeAmount,
    pnlAmount,
    resultPct: totalCapital.isZero()
      ? deriveResultPct(operation)
      : pnlAmount.div(totalCapital).mul(100),
    isCollective: isCollectiveOperation(operation),
    clientImpacts,
  };
}

export function simulatePortfolio(clients, operations) {
  const orderedClients = orderClients(clients);
  const orderedOperations = orderOperations(operations);

  const balanceMap = new Map();
  orderedClients.forEach((client) => {
    balanceMap.set(client.id, toDecimal(client.initialInvestment));
  });

  const operationSnapshots = [];

  for (const operation of orderedOperations) {
    const operationDate = toDate(operation.date);
    const eligibleClients = orderedClients.filter((client) =>
      isEligible(client, operationDate)
    );

    const clientImpacts = new Map();
    let totalCapital = new Prisma.Decimal(0);

    eligibleClients.forEach((client) => {
      totalCapital = totalCapital.plus(balanceMap.get(client.id));
    });

    const isCollective = isCollectiveOperation(operation);
    const outcome = normalizeOutcome(operation.outcome);
    const stakePct = isCollective ? toDecimal(operation.stakePct) : null;
    const resultPct = deriveResultPct(operation);
    const shouldAffectBalance = !isCollective || isSettledOutcome(outcome);

    let totalStakeAmount = new Prisma.Decimal(0);
    let pnlAmount = new Prisma.Decimal(0);

    eligibleClients.forEach((client) => {
      const balanceBefore = balanceMap.get(client.id);
      const stakeAmount = isCollective
        ? balanceBefore.mul(stakePct).div(100)
        : new Prisma.Decimal(0);
      const clientPnl = isCollective
        ? computeCollectivePnl(stakeAmount, operation)
        : balanceBefore.mul(resultPct).div(100);
      const balanceAfter = shouldAffectBalance
        ? balanceBefore.plus(clientPnl)
        : balanceBefore;

      totalStakeAmount = totalStakeAmount.plus(stakeAmount);
      pnlAmount = pnlAmount.plus(clientPnl);

      clientImpacts.set(client.id, {
        balanceBefore,
        stakeAmount,
        pnlAmount: clientPnl,
        balanceAfter,
      });

      if (shouldAffectBalance) {
        balanceMap.set(client.id, balanceAfter);
      }
    });

    operationSnapshots.push(
      buildSnapshotFromOperation(
        operation,
        clientImpacts,
        totalCapital,
        totalStakeAmount,
        pnlAmount
      )
    );
  }

  return {
    balanceMap,
    operationSnapshots,
  };
}

function buildSnapshotsFromAllocations(clients, operations) {
  const orderedClients = orderClients(clients);
  const orderedOperations = orderOperations(operations);
  const balanceMap = new Map();

  orderedClients.forEach((client) => {
    balanceMap.set(client.id, toDecimal(client.initialInvestment));
  });

  const operationSnapshots = orderedOperations.map((operation) => {
    const allocations = [...(operation.allocations || [])].sort(
      (a, b) => a.clientId - b.clientId
    );
    const clientImpacts = new Map();
    let totalCapital = new Prisma.Decimal(0);
    let totalStakeAmount = new Prisma.Decimal(0);
    let pnlAmount = new Prisma.Decimal(0);

    allocations.forEach((allocation) => {
      const balanceBefore = toDecimal(allocation.balanceBefore);
      const stakeAmount = toDecimal(allocation.stakeAmount);
      const clientPnl = toDecimal(allocation.pnlAmount);
      const balanceAfter = toDecimal(allocation.balanceAfter);

      totalCapital = totalCapital.plus(balanceBefore);
      totalStakeAmount = totalStakeAmount.plus(stakeAmount);
      pnlAmount = pnlAmount.plus(clientPnl);

      clientImpacts.set(allocation.clientId, {
        balanceBefore,
        stakeAmount,
        pnlAmount: clientPnl,
        balanceAfter,
      });

      balanceMap.set(allocation.clientId, balanceAfter);
    });

    return buildSnapshotFromOperation(
      operation,
      clientImpacts,
      totalCapital,
      totalStakeAmount,
      pnlAmount
    );
  });

  return {
    balanceMap,
    operationSnapshots,
  };
}

function hasCompletePersistedLedger(clients, operations) {
  return operations.every((operation) => {
    const eligibleIds = orderClients(clients)
      .filter((client) => isEligible(client, toDate(operation.date)))
      .map((client) => client.id);
    const allocationIds = [...(operation.allocations || [])]
      .map((allocation) => allocation.clientId)
      .sort((a, b) => a - b);

    if (eligibleIds.length !== allocationIds.length) {
      return false;
    }

    return eligibleIds.every((clientId, index) => clientId === allocationIds[index]);
  });
}

async function loadPortfolioInputs(prisma) {
  const [clients, operations] = await Promise.all([
    prisma.client.findMany({
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
    }),
    prisma.operation.findMany({
      include: {
        allocations: {
          orderBy: [{ clientId: "asc" }],
        },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
  ]);

  return { clients, operations };
}

export async function computeBalances(providedPrisma) {
  const { prisma, ownsPrisma } = getPrismaHandle(providedPrisma);

  try {
    const { clients, operations } = await loadPortfolioInputs(prisma);
    const snapshots = hasCompletePersistedLedger(clients, operations)
      ? buildSnapshotsFromAllocations(clients, operations)
      : simulatePortfolio(clients, operations);

    return {
      clients,
      operations,
      balanceMap: snapshots.balanceMap,
      operationSnapshots: snapshots.operationSnapshots,
    };
  } finally {
    if (ownsPrisma) {
      await prisma.$disconnect();
    }
  }
}

function chunk(array, size = 500) {
  const rows = [];
  for (let index = 0; index < array.length; index += size) {
    rows.push(array.slice(index, index + size));
  }
  return rows;
}

export async function rebuildPortfolioLedger(providedPrisma) {
  const { prisma, ownsPrisma } = getPrismaHandle(providedPrisma);

  try {
    const [clients, operations] = await Promise.all([
      prisma.client.findMany({
        orderBy: [{ startDate: "asc" }, { id: "asc" }],
      }),
      prisma.operation.findMany({
        orderBy: [{ date: "asc" }, { id: "asc" }],
      }),
    ]);

    const { balanceMap, operationSnapshots } = simulatePortfolio(clients, operations);
    const allocationRows = [];

    operationSnapshots.forEach((snapshot) => {
      snapshot.clientImpacts.forEach((impact, clientId) => {
        allocationRows.push({
          operationId: snapshot.id,
          clientId,
          balanceBefore: impact.balanceBefore,
          stakeAmount: impact.stakeAmount,
          pnlAmount: impact.pnlAmount,
          balanceAfter: impact.balanceAfter,
        });
      });
    });

    await prisma.$transaction(async (tx) => {
      await tx.operationAllocation.deleteMany({});

      for (const batch of chunk(allocationRows, 500)) {
        if (!batch.length) continue;
        await tx.operationAllocation.createMany({ data: batch });
      }

      for (const snapshot of operationSnapshots) {
        await tx.operation.update({
          where: { id: snapshot.id },
          data: {
            resultPct: snapshot.resultPct,
            totalCapital: snapshot.totalCapital,
            totalStakeAmount: snapshot.totalStakeAmount,
            pnlAmount: snapshot.pnlAmount,
          },
        });
      }

      for (const client of clients) {
        await tx.client.update({
          where: { id: client.id },
          data: {
            currentBalance:
              balanceMap.get(client.id) || toDecimal(client.initialInvestment),
          },
        });
      }
    });

    return {
      clients,
      balanceMap,
      operationSnapshots,
      allocationCount: allocationRows.length,
    };
  } finally {
    if (ownsPrisma) {
      await prisma.$disconnect();
    }
  }
}

export async function getClientSummary(clientUserId, opts = {}) {
  const { prisma: providedPrisma, last = 10 } = opts;
  const { prisma, ownsPrisma } = getPrismaHandle(providedPrisma);

  try {
    const client = await prisma.client.findUnique({
      where: { userId: clientUserId },
      include: { user: true },
    });

    if (!client) {
      throw new Error("Cliente nao encontrado");
    }

    const { balanceMap, operationSnapshots } = await computeBalances(prisma);
    const currentBalance =
      balanceMap.get(client.id) || toDecimal(client.initialInvestment);
    const profit = currentBalance.minus(toDecimal(client.initialInvestment));
    const profitability = toDecimal(client.initialInvestment).isZero()
      ? new Prisma.Decimal(0)
      : profit.div(toDecimal(client.initialInvestment)).mul(100);

    const lastOperations = operationSnapshots
      .filter((snapshot) => snapshot.clientImpacts.has(client.id))
      .slice(-Math.max(0, Number(last) || 10))
      .reverse()
      .map((snapshot) => {
        const impact = snapshot.clientImpacts.get(client.id);
        return {
          id: snapshot.id,
          date: snapshot.date,
          description: snapshot.description,
          eventName: snapshot.eventName,
          market: snapshot.market,
          odds: snapshot.odds,
          stakePct: snapshot.stakePct,
          outcome: snapshot.outcome,
          settledAt: snapshot.settledAt,
          resultPct: snapshot.resultPct,
          totalCapital: snapshot.totalCapital,
          totalStakeAmount: snapshot.totalStakeAmount,
          pnlAmount: snapshot.pnlAmount,
          impact: impact.pnlAmount,
          stakeAmount: impact.stakeAmount,
          balanceBefore: impact.balanceBefore,
          balanceAfter: impact.balanceAfter,
        };
      });

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.user.email,
        startDate: client.startDate,
        initialInvestment: client.initialInvestment,
        currentBalance,
      },
      totals: {
        profit,
        profitability,
      },
      lastOperations,
    };
  } finally {
    if (ownsPrisma) {
      await prisma.$disconnect();
    }
  }
}

export async function getOperationLedger(operationId, opts = {}) {
  const { prisma: providedPrisma } = opts;
  const { prisma, ownsPrisma } = getPrismaHandle(providedPrisma);

  try {
    const operation = await prisma.operation.findUnique({
      where: { id: operationId },
      include: {
        allocations: {
          include: {
            client: {
              include: {
                user: true,
              },
            },
          },
          orderBy: [{ clientId: "asc" }],
        },
      },
    });

    if (!operation) {
      throw new Error("Operacao nao encontrada");
    }

    const { operationSnapshots } = await computeBalances(prisma);
    const snapshot = operationSnapshots.find((item) => item.id === operationId);

    return {
      operation: snapshot || operation,
      allocations: operation.allocations.map((allocation) => ({
        id: allocation.id,
        clientId: allocation.clientId,
        clientName: allocation.client.name,
        clientEmail: allocation.client.user?.email || null,
        balanceBefore: allocation.balanceBefore,
        stakeAmount: allocation.stakeAmount,
        pnlAmount: allocation.pnlAmount,
        balanceAfter: allocation.balanceAfter,
      })),
    };
  } finally {
    if (ownsPrisma) {
      await prisma.$disconnect();
    }
  }
}

export async function computeBaseAtDate(cutoffDate, opts = {}) {
  const { prisma: providedPrisma, excludeOperationId } = opts;
  const { prisma, ownsPrisma } = getPrismaHandle(providedPrisma);

  try {
    const [clients, operations] = await Promise.all([
      prisma.client.findMany({
        orderBy: [{ startDate: "asc" }, { id: "asc" }],
      }),
      prisma.operation.findMany({
        where: {
          date: { lte: cutoffDate },
          ...(excludeOperationId ? { NOT: { id: excludeOperationId } } : {}),
        },
        orderBy: [{ date: "asc" }, { id: "asc" }],
      }),
    ]);

    const { balanceMap } = simulatePortfolio(clients, operations);

    return clients.reduce((total, client) => {
      if (!isEligible(client, cutoffDate)) return total;
      return total.plus(balanceMap.get(client.id) || toDecimal(0));
    }, new Prisma.Decimal(0));
  } finally {
    if (ownsPrisma) {
      await prisma.$disconnect();
    }
  }
}

export async function syncStoredBalances(providedPrisma) {
  return rebuildPortfolioLedger(providedPrisma);
}
