import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { signAccessToken, requireAuth } from "../middleware/auth.js";

export const router = Router();
const prisma = new PrismaClient();

// Login com JWT e bcrypt
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email e senha são obrigatórios" });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

    const accessToken = signAccessToken(user);
    const refreshToken = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: process.env.REFRESH_EXPIRES_IN || "30d" }
    );

    // TODO: Salvar refresh token no banco para invalidação futura
    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Refresh token
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken)
    return res.status(400).json({ error: "Refresh token é obrigatório" });

  try {
    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: process.env.REFRESH_EXPIRES_IN || "30d" }
    );

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ error: "Refresh token inválido" });
  }
});

// Logout (invalida tokens)
router.post("/logout", requireAuth(), async (req, res) => {
  // TODO: Implementar blacklist de tokens se necessário
  res.json({ ok: true });
});

// Verificar token (middleware já faz isso, mas endpoint útil para frontend)
router.get("/verify", requireAuth(), async (req, res) => {
  res.json({ user: req.user });
});
