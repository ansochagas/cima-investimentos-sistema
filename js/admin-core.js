// CIMA Investimentos - Nucleo do Painel Administrativo

function showAdminDashboard() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("adminDashboard").style.display = "block";

  if (typeof prefillOperationForms === "function") {
    prefillOperationForms();
  }

  updateAdminOverview();
  updateClientsTable();
  updateOperationsTable();
  createPerformanceChart();
}

function showAdminTab(tabName) {
  document.getElementById("adminOverview").style.display = "none";
  document.getElementById("adminClients").style.display = "none";
  document.getElementById("adminOperations").style.display = "none";
  document.getElementById("adminReports").style.display = "none";
  document.getElementById("adminAudit").style.display = "none";
  document.getElementById("adminImport").style.display = "none";

  if (tabName === "overview") {
    document.getElementById("adminOverview").style.display = "grid";
    setTimeout(createPerformanceChart, 100);
  } else if (tabName === "operations") {
    document.getElementById("adminOperations").style.display = "block";
    if (typeof prefillOperationForms === "function") {
      prefillOperationForms();
    }
  } else if (tabName === "audit") {
    document.getElementById("adminAudit").style.display = "block";
    setTimeout(() => {
      loadAuditLogs();
      updateAuditStats();
    }, 100);
  } else {
    document.getElementById(
      "admin" + tabName.charAt(0).toUpperCase() + tabName.slice(1)
    ).style.display = "block";
  }

  document
    .querySelectorAll(".nav-tab")
    .forEach((tab) => tab.classList.remove("active"));
  event.target.classList.add("active");

  logAction("ADMIN_TAB_ACCESSED", { tab: tabName });
}

function updateAdminOverview() {
  const currentCapital = (systemData.clients || []).reduce(
    (sum, client) => sum + toOperationNumber(client.currentBalance, 0),
    0
  );

  document.getElementById("totalCapital").textContent =
    formatCurrency(currentCapital);
  document.getElementById("totalClients").textContent =
    (systemData.clients || []).length;

  const today = new Date().toISOString().split("T")[0];
  const todayProfit = (systemData.operations || [])
    .filter((operation) => operation.date && String(operation.date).slice(0, 10) === today)
    .reduce((sum, operation) => sum + calculateOperationImpact(operation), 0);

  document.getElementById("todayProfit").textContent =
    formatCurrency(todayProfit);

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthProfit = (systemData.operations || [])
    .filter((operation) => {
      if (!operation.date) return false;
      const operationDate = new Date(operation.date);
      return (
        operationDate.getMonth() === month &&
        operationDate.getFullYear() === year
      );
    })
    .reduce((sum, operation) => sum + calculateOperationImpact(operation), 0);

  document.getElementById("monthProfit").textContent =
    formatCurrency(monthProfit);

  updateValueColor("todayProfit", todayProfit);
  updateValueColor("monthProfit", monthProfit);
}

function createPerformanceChart() {
  const ctx = document.getElementById("performanceChart");
  if (!ctx || typeof Chart === "undefined") return;

  if (window.performanceChartInstance) {
    window.performanceChartInstance.destroy();
  }

  const operations = (systemData.operations || [])
    .filter((operation) => isOperationSettled(operation))
    .slice(-30);

  const dates = operations.map((operation) => formatDate(operation.date));
  const results = operations.map((operation) =>
    deriveOperationResultPct(operation)
  );

  const cumulativeData = [];
  let cumulative = 0;
  operations.forEach((operation) => {
    cumulative += deriveOperationResultPct(operation);
    cumulativeData.push(cumulative);
  });

  const monthlyData = calculateMonthlyPerformance(operations);

  window.performanceChartInstance = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Performance Diaria (%)",
          data: results,
          borderColor: "#d4af37",
          backgroundColor: "rgba(212, 175, 55, 0.1)",
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          pointBackgroundColor: "#d4af37",
          pointBorderColor: "#1e3a5f",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: "y",
        },
        {
          label: "Performance Acumulada (%)",
          data: cumulativeData,
          borderColor: "#28a745",
          backgroundColor: "rgba(40, 167, 69, 0.1)",
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "#28a745",
          pointBorderColor: "#1e3a5f",
          pointBorderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          yAxisID: "y",
        },
        {
          label: "Media Mensal (%)",
          data: monthlyData,
          borderColor: "#007bff",
          backgroundColor: "rgba(0, 123, 255, 0.1)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          fill: false,
          pointBackgroundColor: "#007bff",
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
            font: {
              weight: "bold",
              size: 12,
            },
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          backgroundColor: "rgba(30, 58, 95, 0.9)",
          titleColor: "#d4af37",
          bodyColor: "#ffffff",
          borderColor: "#d4af37",
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(
                2
              )}%`;
            },
          },
        },
      },
      scales: {
        y: {
          type: "linear",
          display: true,
          position: "left",
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
              return value.toFixed(1) + "%";
            },
          },
          title: {
            display: true,
            text: "Performance (%)",
            color: "#1e3a5f",
            font: {
              weight: "bold",
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
            maxTicksLimit: 10,
          },
          title: {
            display: true,
            text: "Data",
            color: "#1e3a5f",
            font: {
              weight: "bold",
            },
          },
        },
      },
    },
  });
}

function calculateMonthlyPerformance(operations) {
  const monthlyMap = new Map();

  operations.forEach((operation) => {
    const date = new Date(operation.date);
    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { total: 0, count: 0 });
    }

    const monthData = monthlyMap.get(monthKey);
    monthData.total += deriveOperationResultPct(operation);
    monthData.count += 1;
  });

  const monthlyAverages = [];
  let currentMonth = null;
  let currentAverage = 0;

  operations.forEach((operation) => {
    const date = new Date(operation.date);
    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    if (currentMonth !== monthKey) {
      currentMonth = monthKey;
      const monthData = monthlyMap.get(monthKey);
      currentAverage = monthData ? monthData.total / monthData.count : 0;
    }

    monthlyAverages.push(currentAverage);
  });

  return monthlyAverages;
}
