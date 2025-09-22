import { Router } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { signAccessToken } from '../middleware/auth.js';

export const router = Router();
const prisma = new PrismaClient();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
  const accessToken = signAccessToken(user);
  res.json({ accessToken, user: { id: user.id, email: user.email, role: user.role } });
});

// Stubs para refresh/logout (implementar persistência de refresh em iteração seguinte)
router.post('/refresh', async (req, res) => {
  return res.status(501).json({ error: 'Not implemented' });
});

router.post('/logout', async (req, res) => {
  return res.json({ ok: true });
});

