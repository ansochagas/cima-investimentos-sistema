import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import {
  computeBalances,
  getOperationLedger,
  rebuildPortfolioLedger,
} from "../utils/calc.js";

export const router = Router();
const prisma = new PrismaClient();

function toDecimal(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`Campo obrigatorio ausente: ${fieldName}`);
  }

  const decimal = new Prisma.Decimal(value);
  if (!decimal.isFinite()) {
    throw new Error(`Valor invalido para ${fieldName}`);
  }
  return decimal;
}

function parseDateValue(value, fieldName) {
  if (!value) {
    throw new Error(`Campo obrigatorio ausente: ${fieldName}`);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Data invalida para ${fieldName}`);
    }
    return value;
  }

  const rawValue = String(value).trim();
  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  const date = dateOnlyMatch
    ? new Date(
        Date.UTC(
          Number(dateOnlyMatch[1]),
          Number(dateOnlyMatch[2]) - 1,
          Number(dateOnlyMatch[3]),
          12,
          0,
          0,
          0
        )
      )
    : new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data invalida para ${fieldName}`);
  }
  return date;
}

function parseDateRangeValue(value, boundary) {
  if (!value) return null;

  const rawValue = String(value).trim();
  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    return boundary === "end"
      ? new Date(
          Date.UTC(
            Number(dateOnlyMatch[1]),
            Number(dateOnlyMatch[2]) - 1,
            Number(dateOnlyMatch[3]),
            23,
            59,
            59,
            999
          )
        )
      : new Date(
          Date.UTC(
            Number(dateOnlyMatch[1]),
            Number(dateOnlyMatch[2]) - 1,
            Number(dateOnlyMatch[3]),
            0,
            0,
            0,
            0
          )
        );
  }

  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeOutcome(outcome) {
  if (!outcome) return null;
  const normalized = String(outcome).toUpperCase();
  if (!["OPEN", "WON", "LOST", "VOID"].includes(normalized)) {
    throw new Error("Outcome invalido. Use OPEN, WON, LOST ou VOID.");
  }
  return normalized;
}

function isCollectivePayload(payload) {
  return (
    payload.stakePct !== undefined ||
    payload.odds !== undefined ||
    payload.eventName !== undefined ||
    payload.market !== undefined ||
    payload.outcome !== undefined
  );
}

function deriveCollectiveResultPct(stakePct, odds, outcome) {
  if (outcome === "WON") {
    return stakePct.mul(odds.minus(1));
  }
  if (outcome === "LOST") {
    return stakePct.neg();
  }
  return new Prisma.Decimal(0);
}

function formatOperationResponse(snapshot) {
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
    notes: snapshot.notes,
    totalCapital: snapshot.totalCapital,
    totalStakeAmount: snapshot.totalStakeAmount,
    pnlAmount: snapshot.pnlAmount,
    resultPct: snapshot.resultPct,
    isCollective: snapshot.isCollective,
    allocationsCount: snapshot.clientImpacts ? snapshot.clientImpacts.size : undefined,
  };
}

function buildOperationPayload(body) {
  const collectiveMode = isCollectivePayload(body);

  if (!collectiveMode) {
    const date = parseDateValue(body.date, "date");
    const description = String(body.description || "").trim();
    if (!description) {
      throw new Error("Campo obrigatorio ausente: description");
    }

    return {
      date,
      description,
      eventName: null,
      market: null,
      odds: null,
      stakePct: null,
      outcome: null,
      settledAt: null,
      notes: String(body.notes || "").trim() || null,
      resultPct: toDecimal(body.resultPct, "resultPct"),
    };
  }

  const date = parseDateValue(body.date || body.openedAt, "date");
  const eventName = String(body.eventName || "").trim();
  const market = String(body.market || "").trim();
  if (!eventName || !market) {
    throw new Error("Campos obrigatorios: eventName, market");
  }

  const odds = toDecimal(body.odds, "odds");
  const stakePct = toDecimal(body.stakePct, "stakePct");
  if (odds.lte(1)) {
    throw new Error("Odds deve ser maior que 1");
  }
  if (stakePct.lte(0)) {
    throw new Error("stakePct deve ser maior que 0");
  }

  const outcome = normalizeOutcome(body.outcome || "OPEN");
  const description =
    String(body.description || "").trim() || `${eventName} - ${market}`;
  const settledAt =
    outcome && outcome !== "OPEN"
      ? parseDateValue(body.settledAt || new Date(), "settledAt")
      : null;

  return {
    date,
    description,
    eventName,
    market,
    odds,
    stakePct,
    outcome,
    settledAt,
    notes: String(body.notes || "").trim() || null,
    resultPct: deriveCollectiveResultPct(stakePct, odds, outcome),
  };
}

async function findFormattedSnapshot(operationId) {
  const { operationSnapshots } = await computeBalances(prisma);
  const snapshot = operationSnapshots.find((item) => item.id === operationId);
  return snapshot ? formatOperationResponse(snapshot) : null;
}

router.get("/", requireAuth("ADMIN"), async (req, res) => {
  const { from, to } = req.query;

  try {
    const { operationSnapshots } = await computeBalances(prisma);
    const fromDate = parseDateRangeValue(from, "start");
    const toDate = parseDateRangeValue(to, "end");

    const filtered = operationSnapshots.filter((snapshot) => {
      const snapshotDate = new Date(snapshot.date);
      if (fromDate && snapshotDate < fromDate) return false;
      if (toDate && snapshotDate > toDate) return false;
      return true;
    });

    res.json(filtered.map(formatOperationResponse));
  } catch (error) {
    res.status(400).json({
      error: "Nao foi possivel listar operacoes",
      detail: error.message,
    });
  }
});

router.get("/:id/allocations", requireAuth("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "ID invalido" });
  }

  try {
    const ledger = await getOperationLedger(id, { prisma });
    return res.json(ledger);
  } catch (error) {
    return res.status(400).json({
      error: "Nao foi possivel obter ledger da operacao",
      detail: error.message,
    });
  }
});

router.post("/", requireAuth("ADMIN"), async (req, res) => {
  try {
    const payload = buildOperationPayload(req.body || {});

    const operation = await prisma.operation.create({
      data: {
        date: payload.date,
        description: payload.description,
        eventName: payload.eventName,
        market: payload.market,
        odds: payload.odds,
        stakePct: payload.stakePct,
        outcome: payload.outcome,
        settledAt: payload.settledAt,
        notes: payload.notes,
        resultPct: payload.resultPct,
        totalCapital: new Prisma.Decimal(0),
        totalStakeAmount: payload.stakePct !== null ? new Prisma.Decimal(0) : null,
        pnlAmount: new Prisma.Decimal(0),
      },
    });

    await rebuildPortfolioLedger(prisma);
    const snapshot = await findFormattedSnapshot(operation.id);

    res.status(201).json(snapshot || operation);
  } catch (error) {
    res.status(400).json({
      error: "Nao foi possivel salvar operacao",
      detail: error.message,
    });
  }
});

router.patch("/:id/settle", requireAuth("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "ID invalido" });
  }

  try {
    const operation = await prisma.operation.findUnique({ where: { id } });
    if (!operation) {
      return res.status(404).json({ error: "Operacao nao encontrada" });
    }

    if (operation.stakePct !== null && operation.stakePct !== undefined) {
      const outcome = normalizeOutcome(req.body?.outcome);
      if (!outcome) {
        return res.status(400).json({
          error: "Campo obrigatorio ausente: outcome",
        });
      }

      const stakePct = new Prisma.Decimal(operation.stakePct);
      const odds = new Prisma.Decimal(operation.odds);
      const resultPct = deriveCollectiveResultPct(stakePct, odds, outcome);
      const settledAt =
        outcome === "OPEN"
          ? null
          : parseDateValue(req.body?.settledAt || new Date(), "settledAt");

      await prisma.operation.update({
        where: { id },
        data: {
          outcome,
          settledAt,
          resultPct,
          notes:
            req.body?.notes !== undefined
              ? String(req.body.notes || "").trim() || null
              : operation.notes,
        },
      });
    } else {
      const resultPct = toDecimal(req.body?.resultPct, "resultPct");
      await prisma.operation.update({
        where: { id },
        data: {
          resultPct,
          notes:
            req.body?.notes !== undefined
              ? String(req.body.notes || "").trim() || null
              : operation.notes,
        },
      });
    }

    await rebuildPortfolioLedger(prisma);
    const snapshot = await findFormattedSnapshot(id);
    return res.json(snapshot || { ok: true });
  } catch (error) {
    return res.status(400).json({
      error: "Nao foi possivel liquidar operacao",
      detail: error.message,
    });
  }
});
