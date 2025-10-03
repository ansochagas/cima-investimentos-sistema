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
    console.log("🔄 Executando seed remotamente...");
    console.log("📍 Diretório atual:", process.cwd());
    console.log(
      "🗄️ DATABASE_URL:",
      process.env.DATABASE_URL ? "Configurada" : "NÃO CONFIGURADA"
    );

    // Primeiro listar diretórios para debug
    console.log("📂 Listando diretórios:");
    try {
      const { stdout: lsOut } = await execAsync("ls -la");
      console.log("Conteúdo do diretório atual:", lsOut);
    } catch (e) {
      console.log("Erro ao listar:", e.message);
    }

    // Tentar caminhos diferentes
    let seedCommand = "node seed.js"; // tentar primeiro no diretório atual
    try {
      await execAsync("ls seed.js");
      console.log("✅ seed.js encontrado no diretório atual");
    } catch (e) {
      console.log(
        "❌ seed.js não encontrado no diretório atual, tentando ../seed.js"
      );
      seedCommand = "node ../seed.js";
      try {
        await execAsync("ls ../seed.js");
        console.log("✅ seed.js encontrado em ../seed.js");
      } catch (e2) {
        console.log(
          "❌ seed.js não encontrado em ../seed.js, tentando ../../seed.js"
        );
        seedCommand = "node ../../seed.js";
      }
    }

    console.log("🔄 Executando comando:", seedCommand);
    const { stdout, stderr } = await execAsync(seedCommand);

    console.log("✅ Seed executado com sucesso");
    console.log("📄 Output:", stdout);
    if (stderr) console.log("⚠️ Stderr:", stderr);

    res.json({
      success: true,
      message: "Seed executado com sucesso",
      output: stdout,
      error: stderr,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Erro no seed:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao executar seed",
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
});
