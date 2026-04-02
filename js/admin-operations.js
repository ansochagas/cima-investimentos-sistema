// CIMA Investimentos - Modulo de Operacoes Administrativas

function getOperationFormIds(suffix = "") {
  return {
    date: `operationDate${suffix}`,
    eventName: `operationEvent${suffix}`,
    market: `operationMarket${suffix}`,
    odds: `operationOdds${suffix}`,
    stakePct: `operationStakePct${suffix}`,
    outcome: `operationOutcome${suffix}`,
    notes: `operationNotes${suffix}`,
  };
}

function prefillOperationForms() {
  const today = toLocalDateInputValue();

  ["", "Ops"].forEach((suffix) => {
    const ids = getOperationFormIds(suffix);
    const dateInput = document.getElementById(ids.date);
    const outcomeInput = document.getElementById(ids.outcome);

    if (dateInput && !dateInput.value) {
      dateInput.value = today;
    }

    if (outcomeInput && !outcomeInput.value) {
      outcomeInput.value = "OPEN";
    }
  });
}

function hasAdminApiSession() {
  return (
    !!localStorage.getItem("cimaAccessToken") &&
    systemData.userType === "admin" &&
    !!window.CIMA_API
  );
}

function escapeOperationHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatOddsValue(value) {
  const numeric = toOperationNumber(value, 0);
  if (!numeric) return "--";
  return numeric.toFixed(2).replace(".", ",");
}

function formatStakeValue(value) {
  const numeric = toOperationNumber(value, 0);
  return `${numeric.toFixed(2).replace(".", ",")}%`;
}

function normalizeOperationForUi(operation) {
  return {
    id: operation.id,
    date: operation.date,
    description: getOperationDisplayDescription(operation),
    eventName: String(operation.eventName || "").trim(),
    market: String(operation.market || "").trim(),
    odds:
      operation.odds === null || operation.odds === undefined
        ? null
        : toOperationNumber(operation.odds, null),
    stakePct:
      operation.stakePct === null || operation.stakePct === undefined
        ? null
        : toOperationNumber(operation.stakePct, null),
    outcome: normalizeOperationOutcome(operation.outcome),
    settledAt: operation.settledAt || null,
    notes: String(operation.notes || "").trim(),
    totalCapital: toOperationNumber(operation.totalCapital, 0),
    totalStakeAmount:
      operation.totalStakeAmount === null || operation.totalStakeAmount === undefined
        ? null
        : toOperationNumber(operation.totalStakeAmount, 0),
    pnlAmount:
      operation.pnlAmount === null || operation.pnlAmount === undefined
        ? null
        : toOperationNumber(operation.pnlAmount, 0),
    result: deriveOperationResultPct(operation),
    isCollective: isCollectiveOperationRecord(operation),
  };
}

function clearOperationForm(suffix = "") {
  const ids = getOperationFormIds(suffix);
  const dateInput = document.getElementById(ids.date);
  const eventNameInput = document.getElementById(ids.eventName);
  const marketInput = document.getElementById(ids.market);
  const oddsInput = document.getElementById(ids.odds);
  const stakePctInput = document.getElementById(ids.stakePct);
  const outcomeInput = document.getElementById(ids.outcome);
  const notesInput = document.getElementById(ids.notes);

  if (dateInput) {
    dateInput.value = toLocalDateInputValue();
  }
  if (eventNameInput) eventNameInput.value = "";
  if (marketInput) marketInput.value = "";
  if (oddsInput) oddsInput.value = "";
  if (stakePctInput) stakePctInput.value = "";
  if (outcomeInput) outcomeInput.value = "OPEN";
  if (notesInput) notesInput.value = "";
}

function readOperationForm(suffix = "") {
  const ids = getOperationFormIds(suffix);
  const date = document.getElementById(ids.date)?.value;
  const eventName = sanitizeInput(
    document.getElementById(ids.eventName)?.value || ""
  );
  const market = sanitizeInput(
    document.getElementById(ids.market)?.value || ""
  );
  const odds = document.getElementById(ids.odds)?.value;
  const stakePct = document.getElementById(ids.stakePct)?.value;
  const outcome =
    normalizeOperationOutcome(document.getElementById(ids.outcome)?.value) ||
    "OPEN";
  const notes = sanitizeInput(document.getElementById(ids.notes)?.value || "");

  if (!date || !eventName || !market || !odds || !stakePct) {
    showAlert("Preencha data, evento, mercado, odd e stake da banca.", "danger");
    return null;
  }

  const operationDate = parseDatePreservingCalendar(date);
  if (!operationDate) {
    showAlert("Data da operacao invalida.", "danger");
    return null;
  }

  const oddsValue = parseFloat(odds);
  const stakePctValue = parseFloat(stakePct);

  if (eventName.length < 5) {
    showAlert("O evento precisa ter pelo menos 5 caracteres.", "danger");
    return null;
  }

  if (market.length < 3) {
    showAlert("O mercado/aposta precisa ter pelo menos 3 caracteres.", "danger");
    return null;
  }

  if (!Number.isFinite(oddsValue) || oddsValue <= 1) {
    showAlert("A odd deve ser um numero maior que 1.", "danger");
    return null;
  }

  if (!Number.isFinite(stakePctValue) || stakePctValue <= 0 || stakePctValue > 100) {
    showAlert("O stake deve ser maior que 0% e menor ou igual a 100%.", "danger");
    return null;
  }

  if (stakePctValue > 15) {
    const confirmed = confirm(
      `Stake de ${stakePctValue.toFixed(
        2
      )}% e acima do padrao operacional. Confirmar?`
    );
    if (!confirmed) return null;
  }

  const today = new Date();
  const futureLimit = new Date();
  futureLimit.setDate(futureLimit.getDate() + (outcome === "OPEN" ? 30 : 1));
  const pastLimit = new Date();
  pastLimit.setDate(pastLimit.getDate() - 365);

  if (operationDate > futureLimit) {
    showAlert("A data da operacao esta muito no futuro.", "danger");
    return null;
  }

  if (operationDate < pastLimit) {
    showAlert("A data da operacao esta muito antiga para cadastro rapido.", "danger");
    return null;
  }

  const hasDuplicate = (systemData.operations || []).some((operation) => {
    return (
      String(operation.date).slice(0, 10) === date &&
      String(operation.eventName || "").toLowerCase() === eventName.toLowerCase() &&
      String(operation.market || "").toLowerCase() === market.toLowerCase()
    );
  });

  if (hasDuplicate) {
    const confirmed = confirm(
      "Ja existe uma entrada semelhante para essa data. Deseja continuar?"
    );
    if (!confirmed) return null;
  }

  return {
    date,
    eventName,
    market,
    odds: oddsValue,
    stakePct: stakePctValue,
    outcome,
    notes: notes || null,
  };
}

function buildLocalCollectiveOperation(payload) {
  const operation = {
    id: Date.now(),
    date: payload.date,
    description: `${payload.eventName} - ${payload.market}`,
    eventName: payload.eventName,
    market: payload.market,
    odds: payload.odds,
    stakePct: payload.stakePct,
    outcome: payload.outcome,
    settledAt: payload.outcome === "OPEN" ? null : new Date().toISOString(),
    notes: payload.notes,
    totalCapital: 0,
    totalStakeAmount: 0,
    pnlAmount: 0,
    result: deriveOperationResultPct(payload),
    isCollective: true,
  };

  return normalizeOperationForUi(operation);
}

function buildOperationSubtitle(operation) {
  const bits = [];

  if (operation.market && operation.eventName) {
    bits.push(escapeOperationHtml(operation.market));
  }

  if (operation.notes) {
    bits.push(`Obs: ${escapeOperationHtml(operation.notes)}`);
  }

  if (operation.settledAt) {
    bits.push(`Liquidada em ${formatDateTime(operation.settledAt)}`);
  } else if (normalizeOperationOutcome(operation.outcome) === "OPEN") {
    bits.push("Aguardando liquidacao");
  }

  return bits.join(" • ");
}

function buildOperationActions(operation, useApi) {
  const safeId = String(operation.id).replace(/'/g, "\\'");

  if (!isOperationSettled(operation)) {
    return `
      <div class="operation-actions-inline">
        <select id="settleOutcome-${safeId}" class="operation-settle-select">
          <option value="WON">WIN</option>
          <option value="LOST">LOSS</option>
          <option value="VOID">VOID</option>
        </select>
        <button class="btn btn-success operation-inline-btn" onclick="settleOperationById('${safeId}', ${useApi})">
          Liquidar
        </button>
        ${
          useApi
            ? ""
            : `<button class="btn btn-danger operation-inline-btn" onclick="deleteOperation('${safeId}')">Excluir</button>`
        }
      </div>
    `;
  }

  if (useApi) {
    return `<span class="operation-action-muted">Liquidada</span>`;
  }

  return `
    <div class="operation-actions-inline">
      <span class="operation-action-muted">Liquidada</span>
      <button class="btn btn-danger operation-inline-btn" onclick="deleteOperation('${safeId}')">
        Excluir
      </button>
    </div>
  `;
}

function renderOperationsTableRows(operations, useApi) {
  const tbody = document.getElementById("operationsTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!operations.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="operation-empty-state">
          Nenhuma operacao registrada ainda.
        </td>
      </tr>
    `;
    return;
  }

  operations.forEach((operation) => {
    const impact = calculateOperationImpact(operation);
    const settled = isOperationSettled(operation);
    const statusClass = getOperationStatusClass(operation);
    const outcome = normalizeOperationOutcome(operation.outcome);
    const resultTone =
      !settled || outcome === "VOID"
        ? "neutral"
        : impact >= 0
        ? "positive"
        : "negative";
    const subtitle = buildOperationSubtitle(operation);
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <strong>${formatDate(operation.date)}</strong>
      </td>
      <td>
        <div class="operation-row-title">${escapeOperationHtml(
          operation.description
        )}</div>
        <div class="operation-row-meta">${subtitle || "Carteira coletiva proporcional"}</div>
      </td>
      <td>
        <strong>${operation.stakePct != null ? formatStakeValue(operation.stakePct) : "--"}</strong>
      </td>
      <td>
        <strong>${operation.odds != null ? formatOddsValue(operation.odds) : "--"}</strong>
      </td>
      <td>
        <span class="operation-status-badge ${statusClass}">
          ${getOperationStatusLabel(operation)}
        </span>
        <div class="operation-status-result ${resultTone}">
          ${settled ? formatPercentBr(operation.result || 0) : "Em aberto"}
        </div>
      </td>
      <td class="${resultTone}">
        <strong>${settled ? formatCurrency(impact) : "Aguardando"}</strong>
        <div class="operation-row-meta">
          Base ${formatCurrency(operation.totalCapital || 0)}
        </div>
      </td>
      <td>${buildOperationActions(operation, useApi)}</td>
    `;

    tbody.appendChild(row);
  });
}

async function refreshAdminOperationalViews() {
  updateOperationsTable();
  updateClientsTable();
  updateAdminOverview();
  createPerformanceChart();
}

async function submitOperationFromForm(suffix = "") {
  const payload = readOperationForm(suffix);
  if (!payload) return;

  if (hasAdminApiSession()) {
    try {
      showLoading("Registrando entrada coletiva...");
      await window.CIMA_API.createOperation(payload);
      clearOperationForm(suffix);
      await refreshAdminOperationalViews();
      showAlert(
        `Entrada registrada: ${payload.eventName} | ${payload.market}`,
        "success"
      );
    } catch (error) {
      console.error("Falha ao criar operacao via API:", error);
      showAlert(
        "Falha ao registrar a operacao no servidor. Verifique a conexao.",
        "danger"
      );
    } finally {
      hideLoading();
    }
    return;
  }

  const operation = buildLocalCollectiveOperation(payload);
  systemData.operations.push(operation);
  recalculateBalancesAndTotals();
  clearOperationForm(suffix);
  updateOperationsTable();
  updateClientsTable();
  updateAdminOverview();
  createPerformanceChart();
  saveData();

  showAlert(
    `Entrada local registrada: ${payload.eventName} | ${payload.market}`,
    "success"
  );
}

function addOperation() {
  return submitOperationFromForm("");
}

function addOperationFromOpsTab() {
  return submitOperationFromForm("Ops");
}

async function settleOperationById(operationId, useApi = false) {
  const select = document.getElementById(`settleOutcome-${operationId}`);
  const outcome = normalizeOperationOutcome(select && select.value);

  if (!outcome || outcome === "OPEN") {
    showAlert("Selecione WIN, LOSS ou VOID para liquidar.", "danger");
    return;
  }

  if (useApi && hasAdminApiSession()) {
    try {
      showLoading("Liquidando operacao...");
      await window.CIMA_API.settleOperation(Number(operationId), { outcome });
      await refreshAdminOperationalViews();
      showAlert(`Operacao liquidada como ${outcome}.`, "success");
    } catch (error) {
      console.error("Falha ao liquidar operacao via API:", error);
      showAlert("Falha ao liquidar operacao no servidor.", "danger");
    } finally {
      hideLoading();
    }
    return;
  }

  const operation = (systemData.operations || []).find(
    (item) => String(item.id) === String(operationId)
  );

  if (!operation) {
    showAlert("Operacao nao encontrada.", "danger");
    return;
  }

  operation.outcome = outcome;
  operation.settledAt = new Date().toISOString();
  operation.result = deriveOperationResultPct(operation);

  recalculateBalancesAndTotals();
  updateOperationsTable();
  updateClientsTable();
  updateAdminOverview();
  createPerformanceChart();
  saveData();
  showAlert(`Operacao liquidada como ${outcome}.`, "success");
}

function deleteOperation(operationId) {
  const confirmed = confirm(
    "Tem certeza que deseja excluir esta operacao local? O recálculo da carteira sera refeito."
  );
  if (!confirmed) return;

  systemData.operations = (systemData.operations || []).filter(
    (operation) => String(operation.id) !== String(operationId)
  );

  recalculateBalancesAndTotals();
  updateOperationsTable();
  updateClientsTable();
  updateAdminOverview();
  createPerformanceChart();
  saveData();
  showAlert("Operacao local excluida com sucesso.", "success");
}

function updateOperationsTable() {
  const tbody = document.getElementById("operationsTableBody");
  if (!tbody) return;

  if (hasAdminApiSession()) {
    window.CIMA_API.getOperations()
      .then((operations) => {
        const normalized = (operations || [])
          .map((operation) => normalizeOperationForUi(operation))
          .sort((a, b) => getDateTimestamp(b.date) - getDateTimestamp(a.date));

        systemData.operations = normalized;
        saveData();
        renderOperationsTableRows(normalized, true);
        updateAdminOverview();
        createPerformanceChart();
      })
      .catch((error) => {
        console.warn(
          "Falha ao carregar operacoes da API, usando dados locais:",
          error && error.message
        );
        recalculateBalancesAndTotals();
        renderOperationsTableRows(
          (systemData.operations || [])
            .map((operation) => normalizeOperationForUi(operation))
            .sort((a, b) => getDateTimestamp(b.date) - getDateTimestamp(a.date)),
          false
        );
      });
    return;
  }

  recalculateBalancesAndTotals();
  const normalized = (systemData.operations || [])
    .map((operation) => normalizeOperationForUi(operation))
    .sort((a, b) => getDateTimestamp(b.date) - getDateTimestamp(a.date));

  renderOperationsTableRows(normalized, false);
}
