// CIMA Investimentos - Módulo de Auditoria Administrativa

function loadAuditLogs() {
  if (!systemData.auditLog || !Array.isArray(systemData.auditLog)) {
    systemData.auditLog = [];
    return;
  }

  const tbody = document.getElementById("auditLogsTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  // Ordena logs por data (mais recentes primeiro)
  const sortedLogs = systemData.auditLog
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100); // Mostra apenas os últimos 100 logs

  sortedLogs.forEach((log) => {
    const row = document.createElement("tr");

    // Determina a cor baseada no tipo de ação
    let actionClass = "";
    if (log.action.includes("FAILED") || log.action.includes("ERROR")) {
      actionClass = "negative";
    } else if (
      log.action.includes("SUCCESS") ||
      log.action.includes("CREATED")
    ) {
      actionClass = "positive";
    }

    const detailsText =
      typeof log.details === "object"
        ? JSON.stringify(log.details).substring(0, 100) + "..."
        : (log.details || "").toString().substring(0, 100);

    const userAgent = log.userAgent
      ? log.userAgent.substring(0, 50) + "..."
      : "N/A";

    row.innerHTML = `
      <td><strong>${formatDateTime(log.timestamp)}</strong></td>
      <td>${log.user || "Sistema"}</td>
      <td class="${actionClass}"><strong>${log.action}</strong></td>
      <td>${detailsText}</td>
      <td>
        <small>${log.ip || "localhost"}</small><br>
        <small style="color: var(--medium-gray);">${userAgent}</small>
      </td>
    `;

    tbody.appendChild(row);
  });

  logAction("AUDIT_LOGS_LOADED", { count: sortedLogs.length });
}

function filterAuditLogs() {
  const filter = document.getElementById("auditLogFilter").value;
  const tbody = document.getElementById("auditLogsTableBody");

  if (!tbody || !systemData.auditLog) return;

  tbody.innerHTML = "";

  const filteredLogs = systemData.auditLog
    .filter((log) => !filter || log.action.includes(filter))
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100);

  filteredLogs.forEach((log) => {
    const row = document.createElement("tr");

    let actionClass = "";
    if (log.action.includes("FAILED") || log.action.includes("ERROR")) {
      actionClass = "negative";
    } else if (
      log.action.includes("SUCCESS") ||
      log.action.includes("CREATED")
    ) {
      actionClass = "positive";
    }

    const detailsText =
      typeof log.details === "object"
        ? JSON.stringify(log.details).substring(0, 100) + "..."
        : (log.details || "").toString().substring(0, 100);

    const userAgent = log.userAgent
      ? log.userAgent.substring(0, 50) + "..."
      : "N/A";

    row.innerHTML = `
      <td><strong>${formatDateTime(log.timestamp)}</strong></td>
      <td>${log.user || "Sistema"}</td>
      <td class="${actionClass}"><strong>${log.action}</strong></td>
      <td>${detailsText}</td>
      <td>
        <small>${log.ip || "localhost"}</small><br>
        <small style="color: var(--medium-gray);">${userAgent}</small>
      </td>
    `;

    tbody.appendChild(row);
  });

  logAction("AUDIT_LOGS_FILTERED", { filter, count: filteredLogs.length });
}

function updateAuditStats() {
  if (!systemData.auditLog || !Array.isArray(systemData.auditLog)) {
    return;
  }

  const logs = systemData.auditLog;

  // Contadores
  const totalLogins = logs.filter(
    (log) =>
      log.action.includes("LOGIN_SUCCESS") ||
      log.action.includes("ADMIN_LOGIN_SUCCESS")
  ).length;

  const failedLogins = logs.filter(
    (log) =>
      log.action.includes("LOGIN_FAILED") ||
      log.action.includes("LOGIN_BLOCKED")
  ).length;

  const totalActions = logs.length;

  const systemErrors = logs.filter(
    (log) => log.action.includes("ERROR") || log.action.includes("FAILED")
  ).length;

  // Atualiza elementos
  const totalLoginsEl = document.getElementById("totalLogins");
  const failedLoginsEl = document.getElementById("failedLogins");
  const totalActionsEl = document.getElementById("totalActions");
  const systemErrorsEl = document.getElementById("systemErrors");

  if (totalLoginsEl) totalLoginsEl.textContent = totalLogins;
  if (failedLoginsEl) failedLoginsEl.textContent = failedLogins;
  if (totalActionsEl) totalActionsEl.textContent = totalActions;
  if (systemErrorsEl) systemErrorsEl.textContent = systemErrors;

  // Aplica cores baseadas nos valores
  if (failedLoginsEl) {
    failedLoginsEl.className =
      failedLogins > 10 ? "stat-value negative" : "stat-value";
  }

  if (systemErrorsEl) {
    systemErrorsEl.className =
      systemErrors > 5 ? "stat-value negative" : "stat-value";
  }
}

function refreshAuditLogs() {
  showLoading("Atualizando logs...");

  setTimeout(() => {
    loadAuditLogs();
    updateAuditStats();
    hideLoading();
    showAlert("Logs de auditoria atualizados!", "success");
  }, 500);
}

function exportAuditLogs() {
  if (!systemData.auditLog || systemData.auditLog.length === 0) {
    showAlert("Nenhum log encontrado para exportar!", "warning");
    return;
  }

  const csvData = systemData.auditLog.map((log) => ({
    "Data/Hora": formatDateTime(log.timestamp),
    Usuário: log.user || "Sistema",
    Tipo: log.userType || "system",
    Ação: log.action,
    Detalhes:
      typeof log.details === "object"
        ? JSON.stringify(log.details)
        : log.details || "",
    IP: log.ip || "localhost",
    Navegador: log.userAgent || "N/A",
  }));

  const timestamp = new Date().toISOString().split("T")[0];
  exportToCSV(csvData, `cima-audit-logs-${timestamp}.csv`);

  logAction("AUDIT_LOGS_EXPORTED", { count: csvData.length });
  showAlert(`${csvData.length} logs exportados com sucesso!`, "success");
}

function clearOldLogs() {
  if (
    !confirm(
      "Tem certeza que deseja limpar logs antigos (mais de 30 dias)? Esta ação não pode ser desfeita."
    )
  ) {
    return;
  }

  if (!systemData.auditLog || systemData.auditLog.length === 0) {
    showAlert("Nenhum log encontrado!", "info");
    return;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const originalCount = systemData.auditLog.length;
  systemData.auditLog = systemData.auditLog.filter(
    (log) => new Date(log.timestamp) > thirtyDaysAgo
  );

  const removedCount = originalCount - systemData.auditLog.length;

  if (removedCount > 0) {
    saveData();
    loadAuditLogs();
    updateAuditStats();
    logAction("OLD_LOGS_CLEARED", { removed: removedCount });
    showAlert(`${removedCount} logs antigos foram removidos!`, "success");
  } else {
    showAlert("Nenhum log antigo encontrado para remoção.", "info");
  }
}

function runSystemCheck() {
  showLoading("Executando verificação do sistema...");

  setTimeout(() => {
    const results = [];

    // Verifica integridade dos dados
    const integrityCheck = verifyDataIntegrity();
    results.push({
      test: "Integridade dos Dados",
      status: integrityCheck ? "OK" : "ATENÇÃO",
      message: integrityCheck
        ? "Todos os dados estão íntegros"
        : "Problemas de integridade detectados",
    });

    // Verifica localStorage
    try {
      localStorage.setItem("test", "test");
      localStorage.removeItem("test");
      results.push({
        test: "Armazenamento Local",
        status: "OK",
        message: "LocalStorage funcionando corretamente",
      });
    } catch (e) {
      results.push({
        test: "Armazenamento Local",
        status: "ERRO",
        message: "Problema no localStorage: " + e.message,
      });
    }

    // Verifica dependências
    const dependencies = [
      { name: "Chart.js", check: () => typeof Chart !== "undefined" },
      { name: "jsPDF", check: () => typeof window.jsPDF !== "undefined" },
    ];

    dependencies.forEach((dep) => {
      results.push({
        test: `Dependência: ${dep.name}`,
        status: dep.check() ? "OK" : "AUSENTE",
        message: dep.check()
          ? `${dep.name} carregado`
          : `${dep.name} não encontrado`,
      });
    });

    // Verifica tamanho dos dados
    const dataSize = JSON.stringify(systemData).length;
    const sizeInMB = (dataSize / (1024 * 1024)).toFixed(2);
    results.push({
      test: "Tamanho dos Dados",
      status: dataSize > 5 * 1024 * 1024 ? "ATENÇÃO" : "OK",
      message: `Dados ocupam ${sizeInMB} MB`,
    });

    // Exibe resultados
    const resultsDiv = document.getElementById("systemCheckResults");
    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <div style="background: var(--light-gray); padding: 20px; border-radius: 12px; margin-top: 15px;">
          <h4 style="color: var(--primary-blue); margin-bottom: 15px;">
            <i class="fas fa-clipboard-check"></i> Resultados da Verificação
          </h4>
          ${results
            .map(
              (result) => `
            <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0; padding: 10px; background: var(--white); border-radius: 8px;">
              <div style="min-width: 60px;">
                <span class="badge badge-${
                  result.status === "OK"
                    ? "success"
                    : result.status === "ATENÇÃO"
                    ? "warning"
                    : "danger"
                }"
                      style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;
                             color: white; background: ${
                               result.status === "OK"
                                 ? "var(--success-green)"
                                 : result.status === "ATENÇÃO"
                                 ? "var(--warning-orange)"
                                 : "var(--danger-red)"
                             };">
                  ${result.status}
                </span>
              </div>
              <div style="flex: 1;">
                <strong>${result.test}:</strong> ${result.message}
              </div>
            </div>
          `
            )
            .join("")}
          <div style="margin-top: 15px; padding: 10px; background: rgba(212, 175, 55, 0.1); border-radius: 8px; border-left: 4px solid var(--accent-gold);">
            <small><strong>Verificação concluída em:</strong> ${new Date().toLocaleString(
              "pt-BR"
            )}</small>
          </div>
        </div>
      `;
    }

    hideLoading();
    logAction("SYSTEM_CHECK_COMPLETED", { results: results.length });
    showAlert("Verificação do sistema concluída!", "success");
  }, 2000);
}

function showSystemInfo() {
  const info = {
    "Versão do Sistema": "1.0.0",
    Navegador: navigator.userAgent.split(" ").pop(),
    Idioma: navigator.language,
    "Fuso Horário": Intl.DateTimeFormat().resolvedOptions().timeZone,
    "Total de Clientes": systemData.clients.length,
    "Total de Operações": systemData.operations.length,
    "Total de Logs": systemData.auditLog ? systemData.auditLog.length : 0,
    "Último Backup": localStorage.getItem("lastAutoBackup") || "Nunca",
    "Sessão Iniciada": new Date().toLocaleString("pt-BR"),
  };

  const infoHtml = Object.entries(info)
    .map(
      ([key, value]) => `
    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
      <strong>${key}:</strong>
      <span>${value}</span>
    </div>
  `
    )
    .join("");

  const resultsDiv = document.getElementById("systemCheckResults");
  if (resultsDiv) {
    resultsDiv.innerHTML = `
      <div style="background: var(--light-gray); padding: 20px; border-radius: 12px; margin-top: 15px;">
        <h4 style="color: var(--primary-blue); margin-bottom: 15px;">
          <i class="fas fa-info-circle"></i> Informações do Sistema
        </h4>
        <div style="background: var(--white); padding: 15px; border-radius: 8px;">
          ${infoHtml}
        </div>
      </div>
    `;
  }

  logAction("SYSTEM_INFO_VIEWED");
}

function optimizeDatabase() {
  if (
    !confirm(
      "Deseja otimizar os dados do sistema? Isso pode melhorar a performance."
    )
  ) {
    return;
  }

  showLoading("Otimizando dados...");

  setTimeout(() => {
    let optimizations = 0;

    // Remove logs duplicados
    if (systemData.auditLog && systemData.auditLog.length > 1) {
      const originalLogCount = systemData.auditLog.length;
      const uniqueLogs = systemData.auditLog.filter(
        (log, index, arr) =>
          arr.findIndex(
            (l) =>
              l.timestamp === log.timestamp &&
              l.action === log.action &&
              l.user === log.user
          ) === index
      );

      if (uniqueLogs.length < originalLogCount) {
        systemData.auditLog = uniqueLogs;
        optimizations += originalLogCount - uniqueLogs.length;
      }
    }

    // Remove operações muito antigas (mais de 2 anos)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const originalOpsCount = systemData.operations.length;
    systemData.operations = systemData.operations.filter(
      (op) => new Date(op.date) > twoYearsAgo
    );

    if (systemData.operations.length < originalOpsCount) {
      optimizations += originalOpsCount - systemData.operations.length;
    }

    // Compacta dados se necessário
    const dataString = JSON.stringify(systemData);
    const compactData = JSON.parse(dataString); // Remove espaços extras

    if (optimizations > 0) {
      systemData = compactData;
      saveData();
    }

    hideLoading();

    if (optimizations > 0) {
      logAction("DATABASE_OPTIMIZED", { itemsRemoved: optimizations });
      showAlert(
        `Otimização concluída! ${optimizations} itens removidos/otimizados.`,
        "success"
      );

      // Recarrega dados atualizados
      loadAuditLogs();
      updateAuditStats();
      updateOperationsTable();
    } else {
      showAlert("Dados já estão otimizados. Nenhuma ação necessária.", "info");
    }
  }, 1500);
}
