import { Router } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { computeBaseAtDate } from '../utils/calc.js';

export const router = Router();
const prisma = new PrismaClient();

router.get('/', requireAuth('ADMIN'), async (req, res) => {
  const { from, to } = req.query;
  const where = {};
  if (from || to) where.date = {};
  if (from) where.date.gte = new Date(String(from));
  if (to) where.date.lte = new Date(String(to));
  const ops = await prisma.operation.findMany({ where, orderBy: { date: 'asc' } });
  res.json(ops);
});

router.post('/', requireAuth('ADMIN'), async (req, res) => {
  const { date, description, resultPct } = req.body || {};
  if (!date || !description || resultPct == null) {
    return res.status(400).json({ error: 'Campos obrigatórios: date, description, resultPct' });
  }
  try {
    const op = await prisma.operation.upsert({
      where: { date_description: { date: new Date(date), description } },
      update: {
        resultPct: new Prisma.Decimal(resultPct),
        totalCapital: await computeBaseAtDate(new Date(String(date))),
      },
      create: {
        date: new Date(date),
        description,
        resultPct: new Prisma.Decimal(resultPct),
        totalCapital: await computeBaseAtDate(new Date(String(date))),
      },
    });
    res.status(201).json(op);
  } catch (e) {
    res.status(400).json({ error: 'Não foi possível salvar operação', detail: e.message });
  }
});


