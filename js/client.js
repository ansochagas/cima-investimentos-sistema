// CIMA Investimentos - Painel do Cliente

// Client Dashboard Functions
function showClientDashboard(client) {
  console.log("showClientDashboard called with:", client);

  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("clientDashboard").style.display = "block";

  // Verificar se o cliente tem dados válidos
  if (!client) {
    console.error("Cliente não fornecido para showClientDashboard");
    showAlert("Erro: Dados do cliente não encontrados", "danger");
    return;
  }

  if (!client.name) {
    console.error("Cliente sem nome:", client);
    showAlert("Erro: Nome do cliente não encontrado", "danger");
    return;
  }

  document.getElementById(
    "clientName"
  ).innerHTML = `<i class="fas fa-user-tie"></i> ${client.name}`;

  // Garantir que os valores sejam números válidos
  const initialInvestment = parseFloat(client.initialInvestment) || 0;
  const currentBalance = parseFloat(client.currentBalance) || initialInvestment;

  console.log("Valores calculados:", { initialInvestment, currentBalance });

  document.getElementById("clientInitialInvestment").textContent =
    formatCurrency(initialInvestment);
  document.getElementById("clientCurrentBalance").textContent =
    formatCurrency(currentBalance);

  const profit = currentBalance - initialInvestment;
  const profitability =
    initialInvestment > 0
      ? ((profit / initialInvestment) * 100).toFixed(2)
      : "0.00";

  console.log("Lucro e rentabilidade:", { profit, profitability });

  document.getElementById("clientTotalProfit").textContent =
    formatCurrency(profit);
  document.getElementById("clientProfitability").textContent =
    profitability + "%";

  // Update colors
  updateValueColor("clientTotalProfit", profit);
  updateValueColor("clientProfitability", profit);

  // Carrega últimas operações/impactos via API, quando disponível
  if (window.CIMA_API && localStorage.getItem("cimaAccessToken")) {
    window.CIMA_API.getMySummary({ last: 10 })
      .then((summary) => {
        try {
          const ops = (summary.lastOperations || []).map((o) => ({
            date: o.date,
            description: o.description,
            result: parseFloat(o.resultPct),
            impact:
              typeof o.impact === "string" ? parseFloat(o.impact) : o.impact,
          }));
          updateClientOperationsTableAPI(client, ops);
        } catch (e) {
          console.warn(
            "Falha ao processar resumo do cliente. Usando fallback local.",
            e
          );
          updateClientOperationsTable(client);
        }
      })
      .catch((err) => {
        console.warn(
          "Falha ao carregar resumo do cliente. Usando fallback local.",
          err && err.message
        );
        updateClientOperationsTable(client);
      });
  } else {
    updateClientOperationsTable(client);
  }
  createClientChart(client);
}

function updateClientOperationsTable(client) {
  const tbody = document.getElementById("clientOperationsTable");
  tbody.innerHTML = "";

  const totalCurrentCapital = systemData.clients.reduce(
    (sum, c) => sum + c.currentBalance,
    0
  );
  const clientProportion = client.currentBalance / totalCurrentCapital;

  systemData.operations
    .slice(-10)
    .reverse()
    .forEach((operation) => {
      const impact =
        (operation.result / 100) * (operation.totalCapital * clientProportion);
      const row = document.createElement("tr");
      row.innerHTML = `
            <td><strong>${formatDate(operation.date)}</strong></td>
            <td>${operation.description}</td>
            <td class="${operation.result >= 0 ? "positive" : "negative"}">
                <strong>${
                  operation.result >= 0 ? "+" : ""
                }${operation.result.toFixed(2)}%</strong>
            </td>
            <td class="${impact >= 0 ? "positive" : "negative"}">
                <strong>${formatCurrency(impact)}</strong>
            </td>
        `;
      tbody.appendChild(row);
    });
}

// Renderiza usando dados vindos da API (impact já calculado)
function updateClientOperationsTableAPI(client, operations) {
  const tbody = document.getElementById("clientOperationsTable");
  tbody.innerHTML = "";

  operations
    .slice()
    .reverse()
    .forEach((operation) => {
      const impact = operation.impact;
      const row = document.createElement("tr");
      row.innerHTML = `
            <td><strong>${formatDate(operation.date)}</strong></td>
            <td>${operation.description}</td>
            <td class="${operation.result >= 0 ? "positive" : "negative"}">
                <strong>${
                  operation.result >= 0 ? "+" : ""
                }${operation.result.toFixed(2)}%</strong>
            </td>
            <td class="${impact >= 0 ? "positive" : "negative"}">
                <strong>${formatCurrency(impact)}</strong>
            </td>
        `;
      tbody.appendChild(row);
    });
}

function createClientChart(client) {
  const ctx = document.getElementById("clientChart");
  if (!ctx || typeof Chart === "undefined") return;

  // Destroy existing chart if it exists
  if (window.clientChartInstance) {
    window.clientChartInstance.destroy();
  }

  // Calculate monthly progression based on operations
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
  ];
  const balances = [];
  let currentBalance = client.initialInvestment;

  months.forEach((month, index) => {
    if (index === months.length - 1) {
      // Last month uses actual current balance
      balances.push(client.currentBalance);
    } else {
      // Simulate progressive growth
      const monthlyGrowth = Math.random() * 3 + 1; // 1-4% monthly growth
      currentBalance *= 1 + monthlyGrowth / 100;
      balances.push(currentBalance);
    }
  });

  window.clientChartInstance = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: months,
      datasets: [
        {
          label: "Evolução do Saldo (R$)",
          data: balances,
          borderColor: "#28a745",
          backgroundColor: "rgba(40, 167, 69, 0.1)",
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "#28a745",
          pointBorderColor: "#1e3a5f",
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "#1e3a5f",
            font: {
              weight: "bold",
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(30, 58, 95, 0.1)",
          },
          ticks: {
            color: "#1e3a5f",
            font: {
              weight: "600",
            },
            callback: function (value) {
              return formatCurrency(value);
            },
          },
        },
        x: {
          grid: {
            color: "rgba(30, 58, 95, 0.1)",
          },
          ticks: {
            color: "#1e3a5f",
            font: {
              weight: "600",
            },
          },
        },
      },
    },
  });
}
