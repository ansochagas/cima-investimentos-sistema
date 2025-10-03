import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { requireAuth } from "../middleware/auth.js";
import { computeBalances, getClientSummary } from "../utils/calc.js";

export const router = Router();
const prisma = new PrismaClient();

router.get("/", requireAuth("ADMIN"), async (req, res) => {
  const clients = await prisma.client.findMany({ include: { user: true } });
  try {
    const { balanceMap } = await computeBalances();
    const withComputed = clients.map((c) => ({
      ...c,
      currentBalanceComputed: balanceMap.get(c.id) || c.currentBalance,
    }));
    return res.json(withComputed);
  } catch (e) {
    return res.json(clients);
  }
});

router.post("/", requireAuth("ADMIN"), async (req, res) => {
  const { name, email, password, startDate, initialInvestment } =
    req.body || {};
  if (!name || !email || !password || initialInvestment == null) {
    return res.status(400).json({
      error:
        "Campos obrigatórios ausentes: name, email, password, initialInvestment",
    });
  }
  // Validação básica de senha no servidor (mais permissiva para testes)
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
  const hashed = await bcrypt.hash(password, 10);
  try {
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
    res.status(201).json({ id: client.id });
  } catch (e) {
    res
      .status(400)
      .json({ error: "NÃ£o foi possÃ­vel criar cliente", detail: e.message });
  }
});

router.get("/:id", requireAuth(), async (req, res) => {
  const id = Number(req.params.id);
  const client = await prisma.client.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!client)
    return res.status(404).json({ error: "Cliente nÃ£o encontrado" });
  // Permite admin ou o prÃ³prio cliente
  if (req.user.role !== "ADMIN" && req.user.sub !== client.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(client);
});

// Cliente autenticado (role CLIENT) - dados básicos
router.get("/me", requireAuth(), async (req, res) => {
  if (req.user.role !== "CLIENT")
    return res.status(403).json({ error: "Forbidden" });
  try {
    const summary = await getClientSummary(req.user.sub, { last: 0 });
    const c = summary.client;
    return res.json({
      id: c.id,
      name: c.name,
      email: c.email,
      startDate: c.startDate,
      initialInvestment: c.initialInvestment,
      currentBalance: c.currentBalance,
    });
  } catch (e) {
    return res
      .status(400)
      .json({ error: "Não foi possível obter cliente", detail: e.message });
  }
});

// Resumo do cliente autenticado com últimas operações e impactos
router.get("/me/summary", requireAuth(), async (req, res) => {
  if (req.user.role !== "CLIENT")
    return res.status(403).json({ error: "Forbidden" });
  try {
    const summary = await getClientSummary(req.user.sub, {
      last: Number(req.query.last) || 10,
    });
    return res.json(summary);
  } catch (e) {
    return res
      .status(400)
      .json({ error: "Não foi possível obter resumo", detail: e.message });
  }
});
