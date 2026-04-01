import "dotenv/config";

function getEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}

async function assertRequest(name, url, options = {}, validate) {
  const response = await fetch(url, options);
  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    throw new Error(
      `${name} falhou com HTTP ${response.status}: ${JSON.stringify(payload)}`
    );
  }

  if (validate) {
    validate(payload);
  }

  console.log(`[ok] ${name}`);
  return payload;
}

async function login(baseUrl, email, password, label) {
  const payload = await assertRequest(
    `${label} login`,
    joinUrl(baseUrl, "/auth/login"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    (body) => {
      if (!body?.accessToken) {
        throw new Error(`${label} login sem accessToken`);
      }
    }
  );

  return payload;
}

async function main() {
  const baseUrl = getEnv("SMOKE_BASE_URL");
  const adminEmail = getEnv("SMOKE_ADMIN_EMAIL");
  const adminPassword = getEnv("SMOKE_ADMIN_PASSWORD");
  const clientEmail = getEnv("SMOKE_CLIENT_EMAIL");
  const clientPassword = getEnv("SMOKE_CLIENT_PASSWORD");

  if (!baseUrl) {
    throw new Error("Defina SMOKE_BASE_URL");
  }
  if (!adminEmail || !adminPassword) {
    throw new Error("Defina SMOKE_ADMIN_EMAIL e SMOKE_ADMIN_PASSWORD");
  }

  const health = await assertRequest(
    "health",
    joinUrl(baseUrl, "/health"),
    {},
    (body) => {
      if (body?.status !== "ok") {
        throw new Error("health sem status ok");
      }
    }
  );

  console.log(`[info] versao API: ${health.version || "indefinida"}`);

  const adminSession = await login(baseUrl, adminEmail, adminPassword, "admin");
  const adminHeaders = {
    Authorization: `Bearer ${adminSession.accessToken}`,
  };

  await assertRequest(
    "auth verify",
    joinUrl(baseUrl, "/auth/verify"),
    { headers: adminHeaders },
    (body) => {
      if (!body?.user?.sub) {
        throw new Error("verify sem usuario autenticado");
      }
    }
  );

  const clients = await assertRequest(
    "admin clients",
    joinUrl(baseUrl, "/clients"),
    { headers: adminHeaders },
    (body) => {
      if (!Array.isArray(body)) {
        throw new Error("clients nao retornou lista");
      }
    }
  );

  const operations = await assertRequest(
    "admin operations",
    joinUrl(baseUrl, "/operations"),
    { headers: adminHeaders },
    (body) => {
      if (!Array.isArray(body)) {
        throw new Error("operations nao retornou lista");
      }
    }
  );

  console.log(
    `[info] staging retornou ${clients.length} clientes e ${operations.length} operacoes`
  );

  if (operations.length > 0) {
    const firstOperation = operations[0];
    await assertRequest(
      "operation allocations",
      joinUrl(baseUrl, `/operations/${firstOperation.id}/allocations`),
      { headers: adminHeaders },
      (body) => {
        if (!Array.isArray(body?.allocations)) {
          throw new Error("allocations nao retornou lista");
        }
      }
    );
  } else {
    console.log("[warn] staging sem operacoes para validar allocations");
  }

  if (clientEmail && clientPassword) {
    const clientSession = await login(
      baseUrl,
      clientEmail,
      clientPassword,
      "client"
    );
    const clientHeaders = {
      Authorization: `Bearer ${clientSession.accessToken}`,
    };

    await assertRequest(
      "client me",
      joinUrl(baseUrl, "/clients/me"),
      { headers: clientHeaders },
      (body) => {
        if (!body?.id || !body?.currentBalance) {
          throw new Error("clients/me sem dados minimos");
        }
      }
    );

    await assertRequest(
      "client summary",
      joinUrl(baseUrl, "/clients/me/summary?last=5"),
      { headers: clientHeaders },
      (body) => {
        if (!body?.client || !Array.isArray(body?.lastOperations)) {
          throw new Error("clients/me/summary sem estrutura esperada");
        }
      }
    );
  } else {
    console.log("[warn] smoke de cliente ignorado por falta de credenciais");
  }

  console.log("[done] smoke check concluido");
}

main().catch((error) => {
  console.error("[fail]", error.message);
  process.exitCode = 1;
});
