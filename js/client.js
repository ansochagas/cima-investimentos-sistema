// CIMA Investimentos - Painel do Cliente

function showClientDashboard(client) {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("clientDashboard").style.display = "block";

  if (!client || !client.name) {
    showAlert("Erro: dados do cliente não encontrados.", "danger");
    return;
  }

  const normalizedClient = normalizeClientData(client);
  renderClientIdentity(normalizedClient);

  const localOperations = buildLocalClientOperations(normalizedClient);
  renderClientExperience(normalizedClient, localOperations);

  const hasApiSession =
    window.CIMA_API && localStorage.getItem("cimaAccessToken");
  if (!hasApiSession) return;

  // Busca mais operações para enriquecer os cards de 6 meses + últimas entradas.
  window.CIMA_API.getMySummary({ last: 220 })
    .then((summary) => {
      const apiClient = summary && summary.client
        ? normalizeClientData({ ...normalizedClient, ...summary.client })
        : normalizedClient;
      const apiOperations = normalizeApiOperations(summary?.lastOperations);

      if (summary && summary.client) {
        systemData.currentUser = { ...systemData.currentUser, ...apiClient };
      }

      renderClientIdentity(apiClient);
      renderClientExperience(
        apiClient,
        apiOperations.length ? apiOperations : localOperations
      );
    })
    .catch((err) => {
      console.warn(
        "Falha ao carregar resumo do cliente via API. Mantendo fallback local.",
        err && err.message
      );
    });
}

function normalizeClientData(client) {
  return {
    ...client,
    id: toNumber(client.id, null),
    name: String(client.name || "Cliente"),
    email: client.email ? String(client.email) : "",
    startDate: client.startDate || null,
    initialInvestment: toNumber(client.initialInvestment, 0),
    currentBalance: toNumber(client.currentBalance, toNumber(client.initialInvestment, 0)),
  };
}

function renderClientIdentity(client) {
  const initialInvestment = toNumber(client.initialInvestment, 0);
  const currentBalance = toNumber(client.currentBalance, initialInvestment);
  const profit = currentBalance - initialInvestment;
  const profitability = initialInvestment > 0 ? (profit / initialInvestment) * 100 : 0;

  const clientName = document.getElementById("clientName");
  if (clientName) {
    clientName.innerHTML = `<i class="fas fa-user-tie"></i> ${escapeHtml(client.name)}`;
  }

  const contractStart = document.getElementById("clientContractStart");
  if (contractStart) {
    contractStart.textContent = formatDateSafe(client.startDate);
  }

  const lastUpdate = document.getElementById("clientLastUpdate");
  if (lastUpdate) {
    lastUpdate.textContent = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const initialEl = document.getElementById("clientInitialInvestment");
  const currentEl = document.getElementById("clientCurrentBalance");
  const profitEl = document.getElementById("clientTotalProfit");
  const profitabilityEl = document.getElementById("clientProfitability");

  if (initialEl) initialEl.textContent = formatCurrency(initialInvestment);
  if (currentEl) currentEl.textContent = formatCurrency(currentBalance);
  if (profitEl) profitEl.textContent = formatCurrency(profit);
  if (profitabilityEl) profitabilityEl.textContent = formatPercentBr(profitability);

  updateValueColor("clientTotalProfit", profit);
  updateValueColor("clientProfitability", profitability);
}

function renderClientExperience(client, operations) {
  updateClientRecentEntries(operations);
  updateClientSixMonthPanel(operations);
  createClientChart(client, operations);
}

function buildLocalClientOperations(client) {
  if (!Array.isArray(systemData.operations) || systemData.operations.length === 0) {
    return [];
  }

  const operationTimeline = systemData.operations
    .slice()
    .sort((a, b) => getDateTimestamp(a.date) - getDateTimestamp(b.date));

  let runningBalance = toNumber(client.initialInvestment, 0);

  return operationTimeline
    .map((operation) => {
      const operationDate = parseDatePreservingCalendar(operation.date);
      const clientStartDate = client.startDate
        ? parseDatePreservingCalendar(client.startDate)
        : null;
      if (clientStartDate && clientStartDate > operationDate) {
        return null;
      }

      const result = deriveOperationResultPct(operation);
      const collective = isCollectiveOperationRecord(operation);
      const outcome = normalizeOperationOutcome(operation.outcome);
      let impact = 0;

      if (collective) {
        const stakePct = toOperationNumber(operation.stakePct, 0);
        const stakeAmount = runningBalance * (stakePct / 100);
        if (outcome === "WON") {
          impact = stakeAmount * (toOperationNumber(operation.odds, 0) - 1);
        } else if (outcome === "LOST") {
          impact = -stakeAmount;
        }
      } else {
        impact = (result / 100) * runningBalance;
      }

      if (isOperationSettled(operation)) {
        runningBalance += impact;
      } else {
        impact = 0;
      }

      return {
        date: operation.date,
        description: getOperationDisplayDescription(operation),
        result,
        impact,
        outcome,
      };
    })
    .filter(Boolean)
    .filter((operation) => isValidDate(operation.date))
    .sort((a, b) => getDateTimestamp(a.date) - getDateTimestamp(b.date));
}

function normalizeApiOperations(rawOperations) {
  if (!Array.isArray(rawOperations)) return [];

  return rawOperations
    .map((operation) => ({
      date: operation.date,
      description: getOperationDisplayDescription(operation),
      result: toNumber(operation.resultPct, 0),
      impact: toNumber(operation.impact, 0),
      outcome: normalizeOperationOutcome(operation.outcome),
    }))
    .filter((operation) => isValidDate(operation.date))
    .sort((a, b) => getDateTimestamp(a.date) - getDateTimestamp(b.date));
}

function updateClientRecentEntries(operations) {
  const entriesContainer = document.getElementById("clientRecentEntries");
  if (!entriesContainer) return;

  const recentOperations = (operations || [])
    .slice()
    .sort((a, b) => getDateTimestamp(b.date) - getDateTimestamp(a.date))
    .slice(0, 5);

  if (!recentOperations.length) {
    entriesContainer.innerHTML =       `
      <div class="client-entry-empty">
        Nenhuma entrada recente para exibir no momento.
      </div>
    `;
    return;
  }

  entriesContainer.innerHTML = recentOperations
    .map((operation) => {
      const result = toNumber(operation.result, 0);
      const impact = toNumber(operation.impact, 0);
      const outcome = normalizeOperationOutcome(operation.outcome);
      const statusClass = outcome === "OPEN"
        ? "neutral"
        : outcome === "VOID"
        ? "neutral"
        : result > 0
        ? "win"
        : result < 0
        ? "loss"
        : "neutral";
      const statusLabel = outcome === "OPEN"
        ? "ABERTA"
        : outcome === "VOID"
        ? "VOID"
        : result > 0
        ? "WIN"
        : result < 0
        ? "LOSS"
        : "NEUTRO";
      const resultText = formatPercentBr(result);
      const impactClass =
        outcome === "OPEN" ? "neutral" : impact >= 0 ? "positive" : "negative";
      const formattedDate = formatDateSafe(operation.date);
      const description = escapeHtml(operation.description);

      return         `
        <div class="client-entry-item">
          <div class="client-entry-main">
            <span class="client-entry-badge ${statusClass}">${statusLabel}</span>
            <div>
              <div class="client-entry-text">
                <strong>${outcome === "OPEN" ? "Aguardando resultado" : resultText}</strong> no jogo ${description}
              </div>
              <div class="client-entry-meta">${formattedDate}</div>
            </div>
          </div>
          <div class="client-entry-impact ${impactClass}">
            ${outcome === "OPEN" ? "Em aberto" : formatCurrency(impact)}
          </div>
        </div>
      `;
    })
    .join("");
}

function updateClientSixMonthPanel(operations) {
  const sixMonthSeries = buildSixMonthSeries(operations || []);
  const totalResult = sixMonthSeries.reduce((sum, month) => sum + month.result, 0);
  const positiveMonths = sixMonthSeries.filter((month) => month.result > 0).length;

  const resultEl = document.getElementById("clientSixMonthResult");
  const consistencyEl = document.getElementById("clientSixMonthConsistency");
  const listEl = document.getElementById("clientSixMonthList");

  if (resultEl) {
    resultEl.textContent = formatPercentBr(totalResult);
    resultEl.className = totalResult >= 0 ? "positive" : "negative";
  }

  if (consistencyEl) {
    consistencyEl.textContent = `${positiveMonths} de 6 meses positivos`;
    consistencyEl.className = positiveMonths >= 3 ? "positive" : "negative";
  }

  if (listEl) {
    listEl.innerHTML = sixMonthSeries
      .map((month) => `
        <div class="client-month-item">
          <strong>${month.label}</strong>
          <span class="${month.result >= 0 ? "positive" : "negative"}">${formatPercentBr(month.result)}</span>
        </div>
      `)
      .join("");
  }

  createClientSixMonthChart(sixMonthSeries);
}

function buildSixMonthSeries(operations) {
  const now = new Date();
  const slots = [];
  const monthIndex = new Map();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = getMonthKey(date);
    const label = date.toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    }).replace(".", "").toUpperCase();

    const slot = { key, label, result: 0, impact: 0, entries: 0 };
    slots.push(slot);
    monthIndex.set(key, slot);
  }

  operations.forEach((operation) => {
    if (!isValidDate(operation.date)) return;
    const date = parseDatePreservingCalendar(operation.date);
    if (!date) return;
    const key = getMonthKey(date);
    const slot = monthIndex.get(key);
    if (!slot) return;

    slot.result += toNumber(operation.result, 0);
    slot.impact += toNumber(operation.impact, 0);
    slot.entries += 1;
  });

  return slots;
}

function createClientSixMonthChart(series) {
  const ctx = document.getElementById("clientSixMonthChart");
  if (!ctx || typeof Chart === "undefined") return;

  if (window.clientSixMonthChartInstance) {
    window.clientSixMonthChartInstance.destroy();
  }

  window.clientSixMonthChartInstance = new Chart(ctx.getContext("2d"), {
    type: "bar",
    data: {
      labels: series.map((month) => month.label),
      datasets: [
        {
          label: "Resultado mensal (%)",
          data: series.map((month) => month.result),
          backgroundColor: series.map((month) =>
            month.result >= 0 ? "rgba(40, 167, 69, 0.7)" : "rgba(220, 53, 69, 0.7)"
          ),
          borderColor: series.map((month) =>
            month.result >= 0 ? "rgba(40, 167, 69, 1)" : "rgba(220, 53, 69, 1)"
          ),
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 44,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `Resultado: ${formatPercentBr(context.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        y: {
          grid: { color: "rgba(30, 58, 95, 0.1)" },
          ticks: {
            color: "#1e3a5f",
            callback: function (value) {
              return `${value}%`;
            },
          },
          title: {
            display: true,
            text: "Retorno mensal (%)",
            color: "#1e3a5f",
            font: { weight: "bold" },
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: "#1e3a5f",
            font: { weight: "600" },
          },
        },
      },
    },
  });
}

function createClientChart(client, operationsInput = null) {
  const ctx = document.getElementById("clientChart");
  if (!ctx || typeof Chart === "undefined") return;

  if (window.clientChartInstance) {
    window.clientChartInstance.destroy();
  }

  const operations = (operationsInput && operationsInput.length
    ? operationsInput
    : buildLocalClientOperations(client))
    .slice()
    .sort((a, b) => getDateTimestamp(a.date) - getDateTimestamp(b.date))
    .slice(-12);

  const balanceProgression = [];
  const profitProgression = [];
  const dates = [];

  let runningBalance = toNumber(client.initialInvestment, 0);
  let runningProfit = 0;

  operations.forEach((operation) => {
    const impact = toNumber(operation.impact, 0);
    runningBalance += impact;
    runningProfit += impact;

    balanceProgression.push(runningBalance);
    profitProgression.push(runningProfit);
    dates.push(formatDateSafe(operation.date));
  });

  if (operations.length > 0) {
    balanceProgression.unshift(toNumber(client.initialInvestment, 0));
    profitProgression.unshift(0);
    dates.unshift("Início");
  } else {
    balanceProgression.push(toNumber(client.currentBalance, 0));
    profitProgression.push(
      toNumber(client.currentBalance, 0) - toNumber(client.initialInvestment, 0)
    );
    dates.push("Atual");
  }

  window.clientChartInstance = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Saldo Atual (R$)",
          data: balanceProgression,
          borderColor: "#28a745",
          backgroundColor: "rgba(40, 167, 69, 0.1)",
          borderWidth: 3,
          tension: 0.35,
          fill: true,
          pointBackgroundColor: "#28a745",
          pointBorderColor: "#1e3a5f",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: "y",
        },
        {
          label: "Lucro Acumulado (R$)",
          data: profitProgression,
          borderColor: "#d4af37",
          backgroundColor: "rgba(212, 175, 55, 0.1)",
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.35,
          fill: false,
          pointBackgroundColor: "#d4af37",
          pointBorderColor: "#1e3a5f",
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          yAxisID: "y",
        },
      ],
    },
    plugins: [Chart.Annotation && Chart.Annotation],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "#1e3a5f",
            font: { weight: "bold", size: 12 },
            usePointStyle: true,
            padding: 15,
          },
        },
        tooltip: {
          backgroundColor: "rgba(30, 58, 95, 0.92)",
          titleColor: "#d4af37",
          bodyColor: "#ffffff",
          borderColor: "#d4af37",
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            afterBody: function () {
              const initial = toNumber(client.initialInvestment, 0);
              const current = toNumber(client.currentBalance, 0);
              const profitability = initial > 0
                ? ((current - initial) / initial) * 100
                : 0;

              return [
                `Aporte Inicial: ${formatCurrency(initial)}`,
                `Saldo Atual: ${formatCurrency(current)}`,
                `Rentabilidade: ${formatPercentBr(profitability)}`,
              ];
            },
          },
        },
        annotation: {
          annotations: {
            initialInvestment: {
              type: "line",
              yMin: toNumber(client.initialInvestment, 0),
              yMax: toNumber(client.initialInvestment, 0),
              borderColor: "#6c757d",
              borderWidth: 2,
              borderDash: [8, 4],
              label: {
                content: `Aporte: ${formatCurrency(toNumber(client.initialInvestment, 0))}`,
                enabled: true,
                position: "start",
                backgroundColor: "rgba(108, 117, 125, 0.8)",
                color: "#ffffff",
                font: { size: 11, weight: "bold" },
              },
            },
          },
        },
      },
      scales: {
        y: {
          type: "linear",
          display: true,
          position: "left",
          grid: { color: "rgba(30, 58, 95, 0.1)" },
          ticks: {
            color: "#1e3a5f",
            font: { weight: "600" },
            callback: function (value) {
              return formatCurrency(value);
            },
          },
          title: {
            display: true,
            text: "Valor (R$)",
            color: "#1e3a5f",
            font: { weight: "bold" },
          },
        },
        x: {
          grid: { color: "rgba(30, 58, 95, 0.08)" },
          ticks: {
            color: "#1e3a5f",
            font: { weight: "600" },
            maxTicksLimit: 8,
          },
        },
      },
    },
  });
}

function formatDateSafe(dateLike) {
  return isValidDate(dateLike) ? formatDate(dateLike) : "--/--/----";
}

function getMonthKey(dateLike) {
  const date = parseDatePreservingCalendar(dateLike);
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function isValidDate(dateLike) {
  return !!parseDatePreservingCalendar(dateLike);
}

function toNumber(value, fallback = 0) {
  const numeric = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatPercentBr(value) {
  const numeric = toNumber(value, 0);
  const signal = numeric > 0 ? "+" : "";
  return `${signal}${numeric.toFixed(2).replace(".", ",")}%`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
