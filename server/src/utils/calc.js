import { PrismaClient, Prisma } from '@prisma/client';

// Recalcula saldos de todos os clientes aplicando sequencialmente as operações,
// respeitando a data de entrada (startDate). Usa Decimal para precisão.
export async function computeBalances() {
  const prisma = new PrismaClient();
  const [clients, operations] = await Promise.all([
    prisma.client.findMany({ orderBy: { id: 'asc' } }),
    prisma.operation.findMany({ orderBy: { date: 'asc' } }),
  ]);

  // Inicializa mapa de saldos com o aporte inicial
  const balanceMap = new Map();
  clients.forEach((c) => {
    balanceMap.set(c.id, new Prisma.Decimal(c.initialInvestment));
  });

  // Aplica operações em ordem
  for (const op of operations) {
    const opDate = new Date(op.date);
    // Base de participação: soma dos saldos dos clientes já entrados
    let base = new Prisma.Decimal(0);
    clients.forEach((c) => {
      const start = new Date(c.startDate);
      if (start <= opDate) {
        base = base.plus(balanceMap.get(c.id));
      }
    });

    if (base.isZero()) continue;

    const pct = new Prisma.Decimal(op.resultPct);

    // Aplica impacto proporcional a cada cliente que já entrou
    clients.forEach((c) => {
      const start = new Date(c.startDate);
      if (start <= opDate) {
        const current = balanceMap.get(c.id);
        const proportion = current.div(base);
        const impact = current.mul(pct).div(100);
        const newBalance = current.plus(impact);
        balanceMap.set(c.id, newBalance);
      }
    });
  }

  return { clients, operations, balanceMap };
}

// Retorna um resumo para um cliente específico, incluindo as últimas N operações
// com impacto estimado nesse cliente.
export async function getClientSummary(clientUserId, opts = { last: 10 }) {
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { id: clientUserId } });
  if (!user) throw new Error('Usuário não encontrado');
  const client = await prisma.client.findUnique({ where: { userId: user.id } });
  if (!client) throw new Error('Cliente não encontrado');

  const { clients, operations, balanceMap } = await computeBalances();
  const finalBalance = balanceMap.get(client.id) || new Prisma.Decimal(client.initialInvestment);
  const profit = finalBalance.minus(client.initialInvestment);
  const profitability = profit.div(client.initialInvestment).mul(100);

  // Monta lista das últimas N operações (impacto aproximado com base no saldo após recálculo sequencial)
  const lastOps = operations.slice(-Math.max(0, opts.last || 10));

  // Para cada operação, reconstruímos o saldo do cliente imediatamente ANTES daquela operação
  // para calcular impacto daquela operação de forma mais fiel.
  // Para eficiência simples, recalculamos do zero até cada op (N pequeno).
  const opImpacts = [];
  for (const op of lastOps) {
    const cutoff = new Date(op.date);
    let balances = new Map();
    clients.forEach((c) => balances.set(c.id, new Prisma.Decimal(c.initialInvestment)));
    for (const o of operations) {
      const oDate = new Date(o.date);
      if (oDate > cutoff) break;
      let base = new Prisma.Decimal(0);
      clients.forEach((c) => {
        const start = new Date(c.startDate);
        if (start <= oDate) base = base.plus(balances.get(c.id));
      });
      if (base.isZero()) continue;
      const pct = new Prisma.Decimal(o.resultPct);
      clients.forEach((c) => {
        const start = new Date(c.startDate);
        if (start <= oDate) {
          const cur = balances.get(c.id);
          const impact = cur.mul(pct).div(100);
          balances.set(c.id, cur.plus(impact));
        }
      });
    }
    const before = balances.get(client.id);
    const impact = before.mul(new Prisma.Decimal(op.resultPct)).div(100);
    opImpacts.push({
      date: op.date,
      description: op.description,
      resultPct: op.resultPct,
      impact: impact,
    });
  }

  return {
    client: {
      id: client.id,
      name: client.name,
      email: user.email,
      startDate: client.startDate,
      initialInvestment: client.initialInvestment,
      currentBalance: finalBalance,
    },
    totals: {
      profit,
      profitability,
    },
    lastOperations: opImpacts,
  };
}

// Retorna a base (soma dos saldos dos clientes elegíveis) imediatamente antes ou na data informada
export async function computeBaseAtDate(cutoffDate) {
  const prisma = new PrismaClient();
  const clients = await prisma.client.findMany({ orderBy: { id: 'asc' } });
  const operations = await prisma.operation.findMany({ orderBy: { date: 'asc' } });

  const balances = new Map();
  clients.forEach((c) => balances.set(c.id, new Prisma.Decimal(c.initialInvestment)));

  for (const op of operations) {
    const opDate = new Date(op.date);
    if (opDate > cutoffDate) break;
    let base = new Prisma.Decimal(0);
    clients.forEach((c) => {
      if (new Date(c.startDate) <= opDate) base = base.plus(balances.get(c.id));
    });
    if (base.isZero()) continue;
    const pct = new Prisma.Decimal(op.resultPct);
    clients.forEach((c) => {
      const start = new Date(c.startDate);
      if (start <= opDate) {
        const cur = balances.get(c.id);
        const impact = cur.mul(pct).div(100);
        balances.set(c.id, cur.plus(impact));
      }
    });
  }

  // Soma dos saldos dos clientes com startDate <= cutoffDate
  let baseAt = new Prisma.Decimal(0);
  clients.forEach((c) => {
    if (new Date(c.startDate) <= cutoffDate) baseAt = baseAt.plus(balances.get(c.id));
  });
  return baseAt;
}
