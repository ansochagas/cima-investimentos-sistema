import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const router = Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Rota temporária para executar seed remotamente (REMOVER EM PRODUÇÃO)
router.post("/seed", async (req, res) => {
  try {
    console.log("Executando seed remotamente...");
    const { stdout, stderr } = await execAsync("node seed.js");

    res.json({
      success: true,
      message: "Seed executado com sucesso",
      output: stdout,
      error: stderr,
    });
  } catch (error) {
    console.error("Erro no seed:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao executar seed",
      error: error.message,
    });
  }
});
