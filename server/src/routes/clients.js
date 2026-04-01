import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { requireAuth } from "../middleware/auth.js";
import {
  computeBalances,
  getClientSummary,
  rebuildPortfolioLedger,
} from "../utils/calc.js";

export const router = Router();
const prisma = new PrismaClient();

function getComputedBalance(balanceMap, client) {
  return balanceMap.get(client.id) || new Prisma.Decimal(client.initialInvestment);
}

function attachComputedClient(client, balanceMap) {
  const currentBalance = getComputedBalance(balanceMap, client);
  const initialInvestment = new Prisma.Decimal(client.initialInvestment);
  const profit = currentBalance.minus(initialInvestment);
  const profitability = initialInvestment.isZero()
    ? new Prisma.Decimal(0)
    : profit.div(initialInvestment).mul(100);

  return {
    ...client,
    currentBalance,
    currentBalanceComputed: currentBalance,
    totals: {
      profit,
      profitability,
    },
  };
}

router.get("/", requireAuth("ADMIN"), async (req, res) => {
  try {
    const [clients, { balanceMap }] = await Promise.all([
      prisma.client.findMany({
        include: { user: true },
        orderBy: [{ startDate: "asc" }, { id: "asc" }],
      }),
      computeBalances(prisma),
    ]);

    return res.json(clients.map((client) => attachComputedClient(client, balanceMap)));
  } catch (error) {
    return res.status(400).json({
      error: "Nao foi possivel listar clientes",
      detail: error.message,
    });
  }
});

router.post("/", requireAuth("ADMIN"), async (req, res) => {
  const { name, email, password, startDate, initialInvestment } = req.body || {};

  if (!name || !email || !password || initialInvestment == null) {
    return res.status(400).json({
      error:
        "Campos obrigatorios ausentes: name, email, password, initialInvestment",
    });
  }

  const hasMinLen = typeof password === "string" && password.length >= 6;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?\":{}|<>]/.test(password);
  const score = [hasMinLen, hasUpper, hasLower, hasNumber, hasSpecial].filter(
    Boolean
  ).length;

  if (score < 2) {
    return res.status(400).json({
      error: "Senha muito fraca. Use pelo menos 6 caracteres.",
    });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, role: "CLIENT" },
    });

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        name,
        startDate: startDate ? new Date(startDate) : new Date(),
        initialInvestment: new Prisma.Decimal(initialInvestment),
        currentBalance: new Prisma.Decimal(initialInvestment),
      },
    });

    await rebuildPortfolioLedger(prisma);
    return res.status(201).json({ id: client.id });
  } catch (error) {
    return res.status(400).json({
      error: "Nao foi possivel criar cliente",
      detail: error.message,
    });
  }
});

router.get("/me", requireAuth(), async (req, res) => {
  if (req.user.role !== "CLIENT") {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { userId: req.user.sub },
      include: { user: true },
    });

    if (!client) {
      return res.status(404).json({ error: "Cliente nao encontrado" });
    }

    const { balanceMap } = await computeBalances(prisma);
    const currentBalance = getComputedBalance(balanceMap, client);

    return res.json({
      id: client.id,
      name: client.name,
      email: client.user.email,
      startDate: client.startDate,
      initialInvestment: client.initialInvestment,
      currentBalance,
    });
  } catch (error) {
    return res.status(400).json({
      error: "Nao foi possivel obter cliente",
      detail: error.message,
    });
  }
});

router.get("/me/summary", requireAuth(), async (req, res) => {
  if (req.user.role !== "CLIENT") {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const summary = await getClientSummary(req.user.sub, {
      prisma,
      last: Number(req.query.last) || 10,
    });
    return res.json(summary);
  } catch (error) {
    return res.status(400).json({
      error: "Nao foi possivel obter resumo",
      detail: error.message,
    });
  }
});

router.get("/:id", requireAuth(), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "ID invalido" });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!client) {
      return res.status(404).json({ error: "Cliente nao encontrado" });
    }

    if (req.user.role !== "ADMIN" && req.user.sub !== client.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { balanceMap } = await computeBalances(prisma);
    return res.json(attachComputedClient(client, balanceMap));
  } catch (error) {
    return res.status(400).json({
      error: "Nao foi possivel obter cliente",
      detail: error.message,
    });
  }
});
