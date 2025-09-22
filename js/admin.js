// CIMA Investimentos - Painel Administrativo

// Admin Dashboard Functions
function showAdminDashboard() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("adminDashboard").style.display = "block";
  document.getElementById("operationDate").value = new Date()
    .toISOString()
    .split("T")[0];
  updateAdminOverview();
  updateClientsTable();
  updateOperationsTable();
  createPerformanceChart();
}

function showAdminTab(tabName) {
  // Hide all tabs
  document.getElementById("adminOverview").style.display = "none";
  document.getElementById("adminClients").style.display = "none";
  document.getElementById("adminOperations").style.display = "none";
  document.getElementById("adminReports").style.display = "none";
  document.getElementById("adminAudit").style.display = "none";

  // Show selected tab
  if (tabName === "overview") {
    document.getElementById("adminOverview").style.display = "grid";
    setTimeout(createPerformanceChart, 100); // Refresh chart
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

  // Update active tab
  document
    .querySelectorAll(".nav-tab")
    .forEach((tab) => tab.classList.remove("active"));
  event.target.classList.add("active");

  // Log tab access
  logAction('ADMIN_TAB_ACCESSED', { tab: tabName });
}

function updateAdminOverview() {
  const totalCapital = systemData.clients.reduce(
    (sum, client) => sum + client.initialInvestment,
    0
  );
  const currentCapital = systemData.clients.reduce(
    (sum, client) => sum + client.currentBalance,
    0
  );

  document.getElementById("totalCapital").textContent =
    formatCurrency(currentCapital);
  document.getElementById("totalClients").textContent =
    systemData.clients.length;

  // Calculate today's and month's profit
  const today = new Date().toISOString().split("T")[0];
  const todayOp = systemData.operations.find((op) => op.date === today);
  const todayProfit = todayOp
    ? (todayOp.result / 100) * todayOp.totalCapital
    : 0;

  document.getElementById("todayProfit").textContent =
    formatCurrency(todayProfit);

  // Calcula lucro do mês corrente somando o impacto das operações do mês
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthProfit = (systemData.operations || [])
    .filter(op => {
      if (!op.date) return false;
      const d = new Date(op.date);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, op) => sum + ((op.result || 0) / 100) * (op.totalCapital || 0), 0);
  document.getElementById("monthProfit").textContent =
    formatCurrency(monthProfit);

  // Update profit colors
  updateValueColor("todayProfit", todayProfit);
  updateValueColor("monthProfit", monthProfit);
}

// Operations Management
function addOperation() {
  const date = document.getElementById("operationDate").value;
  const resultInput = document.getElementById("operationResult").value;
  const description = sanitizeInput(document.getElementById("operationDesc").value);

  // Validações robustas
  if (!date || !resultInput || !description) {
    showAlert("Por favor, preencha todos os campos!", "danger");
    return;
  }

  const result = parseFloat(resultInput);
  if (isNaN(result)) {
    showAlert("Resultado deve ser um número válido!", "danger");
    return;
  }

  if (Math.abs(result) > 50) {
    if (!confirm(`Resultado de ${result}% é muito alto. Confirma este valor?`)) {
      return;
    }
  }

  if (description.length < 5) {
    showAlert("Descrição deve ter pelo menos 5 caracteres!", "danger");
    return;
  }

  if (description.length > 200) {
    showAlert("Descrição muito longa (máximo 200 caracteres)!", "danger");
    return;
  }

  // Verifica se a data não é muito futura (máximo 1 dia)
  const operationDate = new Date(date);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 1);

  if (operationDate > maxDate) {
    showAlert("Data da operação não pode ser mais de 1 dia no futuro!", "danger");
    return;
  }

  // Verifica se não é muito antiga (máximo 90 dias)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 90);

  if (operationDate < minDate) {
    showAlert("Data da operação não pode ser mais de 90 dias no passado!", "danger");
    return;
  }

  // Verifica duplicatas
  const existingOperation = systemData.operations.find(op =>
    op.date === date && op.description.toLowerCase() === description.toLowerCase()
  );

  if (existingOperation) {
    if (!confirm("Já existe uma operação similar nesta data. Deseja continuar?")) {
      return;
    }
  }

  // Se autenticado como admin, registra operação na API e atualiza UI
  const hasToken = !!localStorage.getItem('cimaAccessToken');
  if (hasToken && systemData.userType === 'admin' && window.CIMA_API) {
    (async () => {
      try {
        await window.CIMA_API.createOperation({ date, description, resultPct: result });

        // Clear form
        document.getElementById("operationResult").value = "";
        document.getElementById("operationDesc").value = "";

        // Atualiza tabelas com dados do servidor
        updateOperationsTable();
        updateClientsTable();
        updateAdminOverview();
        showAlert(`Operação registrada no servidor com sucesso! Resultado: ${result.toFixed(2)}%`, 'success');
      } catch (e) {
        console.error('Falha ao criar operação via API:', e);
        showAlert('Falha ao registrar operação no servidor. Verifique a conexão.', 'danger');
      }
    })();
    return;
  }

  const totalCapital = systemData.clients.reduce((sum, client) => {
    const clientStart = client.startDate ? new Date(client.startDate) : null;
    return sum + (!clientStart || clientStart <= operationDate ? client.currentBalance : 0);
  }, 0);

  const operation = {
    date,
    description,
    result,
    totalCapital,
  };

  systemData.operations.push(operation);

  // Update client balances proportionally (respeita data de entrada)
  const opDate = new Date(date);
  systemData.clients.forEach((client) => {
    const clientStart = client.startDate ? new Date(client.startDate) : null;
    if (!clientStart || clientStart <= opDate) {
      const impact = (result / 100) * client.currentBalance;
      client.currentBalance += impact;
      if (client.currentBalance < 0) {
        client.currentBalance = 0;
      }
    }
  });

  // Clear form
  document.getElementById("operationResult").value = "";
  document.getElementById("operationDesc").value = "";

  updateAdminOverview();
  updateOperationsTable();
  updateClientsTable();
  saveData();

  const resultText =
    result >= 0 ? `+${result.toFixed(2)}%` : `${result.toFixed(2)}%`;
  showAlert(
    `Operação registrada com sucesso! Resultado: ${resultText}`,
    "success"
  );
}

// Client Management
async function addClient() {
  const name = sanitizeInput(document.getElementById("newClientName").value);
  const email = sanitizeInput(document.getElementById("newClientEmail").value);
  const investmentInput = document.getElementById("newClientInvestment").value;
  const startDateInput = document.getElementById("newClientStartDate")?.value;
  const password = document.getElementById("newClientPassword").value;

  // Validações de campos obrigatórios
  if (!name || !email || !investmentInput || !password) {
    showAlert("Por favor, preencha todos os campos!", "danger");
    return;
  }

  // Validação do nome
  if (name.length < 3) {
    showAlert("Nome deve ter pelo menos 3 caracteres!", "danger");
    return;
  }

  if (name.length > 100) {
    showAlert("Nome muito longo (máximo 100 caracteres)!", "danger");
    return;
  }

  if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(name)) {
    showAlert("Nome deve conter apenas letras e espaços!", "danger");
    return;
  }

  // Validação do email
  if (!validateEmail(email)) {
    showAlert("Email inválido!", "danger");
    return;
  }

  if (email.length > 255) {
    showAlert("Email muito longo!", "danger");
    return;
  }

  // Verifica se email já existe
  if (systemData.clients.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
    showAlert("Este email já está cadastrado!", "danger");
    return;
  }

  // Validação do investimento
  const investment = parseFloat(investmentInput);
  if (!validateInvestmentAmount(investment)) {
    showAlert("Valor de investimento deve estar entre R$ 1.000,00 e R$ 10.000.000,00!", "danger");
    return;
  }

  // Validação da senha
  const passwordStrength = validatePasswordStrength(password);
  if (!passwordStrength.isValid) {
    showAlert(`Senha fraca! ${passwordStrength.feedback}`, "warning");

    if (!confirm("Deseja continuar com uma senha fraca? Recomenda-se uma senha mais forte.")) {
      return;
    }
  }

  try {
    showLoading('Cadastrando cliente...');

    // Gera senha hasheada
    const hashedPassword = await hashPassword(password);

    // Gera ID único mais seguro
    const newId = systemData.clients.length > 0
      ? Math.max(...systemData.clients.map((c) => c.id)) + 1
      : 1;

    // Define startDate informado ou hoje
    const todayStr = new Date().toISOString().split("T")[0];
    let startDate = (startDateInput && /^\d{4}-\d{2}-\d{2}$/.test(startDateInput)) ? startDateInput : todayStr;

    const newClient = {
      id: newId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      initialInvestment: investment,
      currentBalance: investment,
      startDate,
      createdAt: new Date().toISOString(),
      status: 'active',
      loginAttempts: 0,
      lastLogin: null
    };

    systemData.clients.push(newClient);

    // Log da ação
    logAction('CLIENT_CREATED', {
      clientId: newId,
      name: name,
      email: email,
      initialInvestment: investment
    });

  } catch (error) {
    hideLoading();
    showAlert('Erro ao cadastrar cliente. Tente novamente.', 'danger');
    logAction('CLIENT_CREATION_FAILED', {
      error: error.message,
      email: email
    });
    return;
  }

  // Clear form
  document.getElementById("newClientName").value = "";
  document.getElementById("newClientEmail").value = "";
  document.getElementById("newClientInvestment").value = "";
  document.getElementById("newClientPassword").value = "";
  const sd = document.getElementById("newClientStartDate"); if (sd) sd.value = "";

  updateClientsTable();
  closeModal("addClientModal");
  updateAdminOverview();
  saveData();
  hideLoading();

  showAlert(`Cliente ${name} cadastrado com sucesso!`, "success");

  // Notifica sobre o novo cliente
  showNotification(
    'Novo Cliente Cadastrado',
    `${name} foi cadastrado com aporte de ${formatCurrency(investment)}`,
    'success'
  );
}

// Table Updates
function updateClientsTable() {
  const tbody = document.getElementById("clientsTableBody");
  tbody.innerHTML = "";

  // Se autenticado via API como admin, busca clientes do servidor (migração gradual)
  const hasToken = !!localStorage.getItem('cimaAccessToken');
  if (hasToken && systemData.userType === 'admin' && window.CIMA_API) {
    window.CIMA_API.getClients()
      .then((clients) => {
        // Normaliza para o formato usado no front
        const normalized = (clients || []).map((c) => ({
          id: c.id,
          name: c.name,
          email: (c.user && c.user.email) ? c.user.email : '',
          initialInvestment: parseFloat(c.initialInvestment),
          currentBalance: parseFloat(c.currentBalanceComputed ?? c.currentBalance),
          startDate: c.startDate ? String(c.startDate).slice(0, 10) : null,
        }));

        // Atualiza base local para reutilizar renderizações existentes
        systemData.clients = normalized;

        // Renderiza tabela com dados normalizados
        normalized.forEach((client) => {
          const profit = client.currentBalance - client.initialInvestment;
          const profitability = ((profit / client.initialInvestment) * 100).toFixed(2);
          const row = document.createElement("tr");
          row.innerHTML = `
                  <td><strong>${client.name}</strong></td>
                  <td>${client.email}</td>
                  <td>${formatCurrency(client.initialInvestment)}</td>
                  <td><strong>${formatCurrency(client.currentBalance)}</strong></td>
                  <td class="${profitability >= 0 ? "positive" : "negative"}">
                      <strong>${profitability >= 0 ? "+" : ""}${profitability}%</strong>
                  </td>
                  <td>
                      <button class="btn btn-gold" onclick="editClient(${client.id})" style="margin: 2px; padding: 8px 15px; font-size: 0.9rem;">
                          <i class="fas fa-edit"></i>
                      </button>
                  </td>
              `;
          tbody.appendChild(row);
        });

        // Atualiza métricas do overview que dependem de clients
        updateAdminOverview();
      })
      .catch((err) => {
        console.warn('Falha ao carregar clientes da API, usando dados locais:', err && err.message);
        // Fallback para fluxo local abaixo
        renderLocalClientsTable();
      });
    return; // evita render duplicado; restante será feito no then/catch
  }

  // Fallback local
  function renderLocalClientsTable() {
    tbody.innerHTML = "";
    systemData.clients.forEach((client) => {
      const profit = client.currentBalance - client.initialInvestment;
      const profitability = ((profit / client.initialInvestment) * 100).toFixed(2);
      const row = document.createElement("tr");
      row.innerHTML = `
              <td><strong>${client.name}</strong></td>
              <td>${client.email}</td>
              <td>${formatCurrency(client.initialInvestment)}</td>
              <td><strong>${formatCurrency(client.currentBalance)}</strong></td>
              <td class="${profitability >= 0 ? "positive" : "negative"}">
                  <strong>${profitability >= 0 ? "+" : ""}${profitability}%</strong>
              </td>
              <td>
                  <button class="btn btn-gold" onclick="editClient(${client.id})" style="margin: 2px; padding: 8px 15px; font-size: 0.9rem;">
                      <i class="fas fa-edit"></i>
                  </button>
              </td>
          `;
      tbody.appendChild(row);
    });
  }

  renderLocalClientsTable();

  
}

function updateOperationsTable() {
  const tbody = document.getElementById("operationsTableBody");
  tbody.innerHTML = "";

  const hasToken = !!localStorage.getItem('cimaAccessToken');
  if (hasToken && systemData.userType === 'admin' && window.CIMA_API) {
    window.CIMA_API.getOperations()
      .then((ops) => {
        const mapped = (ops || []).map(op => ({
          date: op.date,
          description: op.description,
          result: parseFloat(op.resultPct),
          totalCapital: op.totalCapital != null ? parseFloat(op.totalCapital) : null,
        }));
        mapped.slice().reverse().forEach((operation, index) => {
          const hasCapital = operation.totalCapital != null && !isNaN(operation.totalCapital);
          const impactVal = hasCapital ? (operation.result / 100) * operation.totalCapital : null;
          const impactCell = hasCapital ? `<strong>${formatCurrency(impactVal)}</strong>` : '<strong>-</strong>';
          const row = document.createElement("tr");
          row.innerHTML = `
                <td><strong>${formatDate(operation.date)}</strong></td>
                <td>${operation.description}</td>
                <td class="${operation.result >= 0 ? "positive" : "negative"}">
                    <strong>${operation.result >= 0 ? "+" : ""}${operation.result.toFixed(2)}%</strong>
                </td>
                <td class="${hasCapital && impactVal >= 0 ? "positive" : hasCapital ? "negative" : ""}">
                    ${impactCell}
                </td>
                <td>
                    <button class="btn btn-danger" disabled title="Remoção local desabilitada em modo API" style="padding: 8px 15px; font-size: 0.9rem; opacity: 0.6;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
          tbody.appendChild(row);
        });
      })
      .catch((err) => {
        console.warn('Falha ao carregar operações da API, usando dados locais:', err && err.message);
        renderLocalOps();
      });
    return;
  }

  function renderLocalOps() {
    systemData.operations
      .slice()
      .reverse()
      .forEach((operation, index) => {
        const impact = (operation.result / 100) * operation.totalCapital;
        const row = document.createElement("tr");
        row.innerHTML = `
              <td><strong>${formatDate(operation.date)}</strong></td>
              <td>${operation.description}</td>
              <td class="${operation.result >= 0 ? "positive" : "negative"}">
                  <strong>${operation.result >= 0 ? "+" : ""}${operation.result.toFixed(2)}%</strong>
              </td>
              <td class="${impact >= 0 ? "positive" : "negative"}">
                  <strong>${formatCurrency(impact)}</strong>
              </td>
              <td>
                  <button class="btn btn-danger" onclick="deleteOperation(${ 
                    systemData.operations.length - 1 - index 
                  })" style="padding: 8px 15px; font-size: 0.9rem;">
                      <i class="fas fa-trash"></i>
                  </button>
              </td>
          `;
        tbody.appendChild(row);
      });
  }

  renderLocalOps();
}

// Charts
function createPerformanceChart() {
  const ctx = document.getElementById("performanceChart");
  if (!ctx || typeof Chart === "undefined") return;

  // Destroy existing chart if it exists
  if (window.performanceChartInstance) {
    window.performanceChartInstance.destroy();
  }

  const dates = systemData.operations
    .slice(-30)
    .map((op) => formatDate(op.date));
  const results = systemData.operations.slice(-30).map((op) => op.result);

  window.performanceChartInstance = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Performance Diária (%)",
          data: results,
          borderColor: "#d4af37",
          backgroundColor: "rgba(212, 175, 55, 0.1)",
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "#d4af37",
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
              return value + "%";
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

// Additional Functions
function editClient(clientId) {
  const client = systemData.clients.find((c) => c.id === clientId);
  if (client) {
    const newInvestment = prompt(
      `Editar aporte inicial de ${
        client.name
      }:\n\nAporte atual: ${formatCurrency(client.initialInvestment)}`,
      client.initialInvestment
    );
    if (
      newInvestment &&
      !isNaN(newInvestment) &&
      parseFloat(newInvestment) > 0
    ) {
      const difference = parseFloat(newInvestment) - client.initialInvestment;
      client.initialInvestment = parseFloat(newInvestment);
      client.currentBalance += difference;
      updateClientsTable();
      updateAdminOverview();
      saveData();
      showAlert(`Aporte de ${client.name} atualizado com sucesso!`, "success");
    }
  }
}

function deleteOperation(index) {
  if (
    confirm(
      "Tem certeza que deseja excluir esta operação?\n\nEsta ação irá reverter o impacto nos saldos dos clientes e não pode ser desfeita."
    )
  ) {
    const operation = systemData.operations[index];

    // Reverse the impact on all clients proportionally
    const totalCapital = operation.totalCapital;
    systemData.clients.forEach((client) => {
      const clientProportion =
        client.currentBalance /
        systemData.clients.reduce((sum, c) => sum + c.currentBalance, 0);
      const impact =
        (operation.result / 100) * (totalCapital * clientProportion);
      client.currentBalance -= impact;
      // Ensure balance doesn't go negative
      if (client.currentBalance < 0) {
        client.currentBalance = 0;
      }
    });

    systemData.operations.splice(index, 1);
    updateOperationsTable();
    updateAdminOverview();
    updateClientsTable();
    saveData();
    showAlert(
      "Operação excluída e impactos revertidos com sucesso!",
      "success"
    );
  }
}

function generateReport() {
  const month = document.getElementById("reportMonth").value;
  if (!month) {
    showAlert("Selecione um mês para gerar o relatório!", "danger");
    return;
  }

  const [year, monthNum] = month.split("-");
  const monthName = new Date(year, monthNum - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const monthOperations = systemData.operations.filter((op) =>
    op.date.startsWith(month)
  );
  const totalReturn = monthOperations.reduce((sum, op) => sum + op.result, 0);
  const positiveOps = monthOperations.filter((op) => op.result > 0).length;
  const negativeOps = monthOperations.filter((op) => op.result < 0).length;
  const successRate =
    monthOperations.length > 0
      ? ((positiveOps / monthOperations.length) * 100).toFixed(1)
      : 0;

  const bestOp =
    monthOperations.length > 0
      ? monthOperations.reduce((max, op) => (op.result > max.result ? op : max))
      : null;
  const worstOp =
    monthOperations.length > 0
      ? monthOperations.reduce((min, op) => (op.result < min.result ? op : min))
      : null;

  const reportHTML = `
        <div style="margin-top: 40px; padding: 30px; background: var(--white); border-radius: 20px; box-shadow: 0 10px 40px var(--shadow); border: 1px solid rgba(212, 175, 55, 0.2);">
            <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="color: var(--primary-blue); margin-bottom: 10px;">
                    <i class="fas fa-chart-bar"></i> Relatório Executivo
                </h2>
                <h3 style="color: var(--accent-gold); text-transform: capitalize;">${monthName}</h3>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${monthOperations.length}</div>
                    <div class="stat-label">
                        <i class="fas fa-calculator"></i> Total de Operações
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value ${
                      totalReturn >= 0 ? "positive" : "negative"
                    }">
                        ${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%
                    </div>
                    <div class="stat-label">
                        <i class="fas fa-chart-line"></i> Retorno Total
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${successRate}%</div>
                    <div class="stat-label">
                        <i class="fas fa-target"></i> Taxa de Sucesso
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value positive">${positiveOps}</div>
                    <div class="stat-label">
                        <i class="fas fa-arrow-up"></i> Operações Positivas
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value negative">${negativeOps}</div>
                    <div class="stat-label">
                        <i class="fas fa-arrow-down"></i> Operações Negativas
                    </div>
                </div>
            </div>
            
            ${
              bestOp && worstOp
                ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
                <div style="background: rgba(40, 167, 69, 0.1); padding: 20px; border-radius: 15px; border-left: 4px solid var(--success-green);">
                    <h4 style="color: var(--success-green); margin-bottom: 10px;">
                        <i class="fas fa-trophy"></i> Melhor Operação
                    </h4>
                    <strong>${bestOp.description}</strong><br>
                    <span style="color: var(--success-green); font-weight: bold;">+${bestOp.result.toFixed(
                      2
                    )}%</span> em ${formatDate(bestOp.date)}
                </div>
                <div style="background: rgba(220, 53, 69, 0.1); padding: 20px; border-radius: 15px; border-left: 4px solid var(--danger-red);">
                    <h4 style="color: var(--danger-red); margin-bottom: 10px;">
                        <i class="fas fa-chart-line-down"></i> Pior Operação
                    </h4>
                    <strong>${worstOp.description}</strong><br>
                    <span style="color: var(--danger-red); font-weight: bold;">${worstOp.result.toFixed(
                      2
                    )}%</span> em ${formatDate(worstOp.date)}
                </div>
            </div>
            `
                : ""
            }
            
            <h4 style="margin: 40px 0 20px 0; color: var(--primary-blue);">
                <i class="fas fa-list-alt"></i> Detalhes das Operações do Período:
            </h4>
            <table class="table">
                <thead>
                    <tr>
                        <th><i class="fas fa-calendar"></i> Data</th>
                        <th><i class="fas fa-info-circle"></i> Descrição</th>
                        <th><i class="fas fa-percentage"></i> Resultado</th>
                        <th><i class="fas fa-money-bill"></i> Impacto</th>
                    </tr>
                </thead>
                <tbody>
                    ${
                      monthOperations.length > 0
                        ? monthOperations
                            .map((op) => {
                              const impact =
                                (op.result / 100) * op.totalCapital;
                              return `
                            <tr>
                                <td><strong>${formatDate(op.date)}</strong></td>
                                <td>${op.description}</td>
                                <td style="color: ${
                                  op.result >= 0
                                    ? "var(--success-green)"
                                    : "var(--danger-red)"
                                };">
                                    <strong>${
                                      op.result >= 0 ? "+" : ""
                                    }${op.result.toFixed(2)}%</strong>
                                </td>
                                <td style="color: ${
                                  impact >= 0
                                    ? "var(--success-green)"
                                    : "var(--danger-red)"
                                };">
                                    <strong>${formatCurrency(impact)}</strong>
                                </td>
                            </tr>
                        `;
                            })
                            .join("")
                        : '<tr><td colspan="4" style="text-align: center; color: var(--medium-gray); padding: 40px;">Nenhuma operação encontrada neste período</td></tr>'
                    }
                </tbody>
            </table>
        </div>
    `;

  document.getElementById("reportContent").innerHTML = reportHTML;
  showAlert("Relatório gerado com sucesso!", "success");
}

// ==================== SISTEMA DE AUDITORIA ====================

function loadAuditLogs() {
  if (!systemData.auditLog || !Array.isArray(systemData.auditLog)) {
    systemData.auditLog = [];
    return;
  }

  const tbody = document.getElementById('auditLogsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  // Ordena logs por data (mais recentes primeiro)
  const sortedLogs = systemData.auditLog
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100); // Mostra apenas os últimos 100 logs

  sortedLogs.forEach(log => {
    const row = document.createElement('tr');

    // Determina a cor baseada no tipo de ação
    let actionClass = '';
    if (log.action.includes('FAILED') || log.action.includes('ERROR')) {
      actionClass = 'negative';
    } else if (log.action.includes('SUCCESS') || log.action.includes('CREATED')) {
      actionClass = 'positive';
    }

    const detailsText = typeof log.details === 'object'
      ? JSON.stringify(log.details).substring(0, 100) + '...'
      : (log.details || '').toString().substring(0, 100);

    const userAgent = log.userAgent ? log.userAgent.substring(0, 50) + '...' : 'N/A';

    row.innerHTML = `
      <td><strong>${formatDateTime(log.timestamp)}</strong></td>
      <td>${log.user || 'Sistema'}</td>
      <td class="${actionClass}"><strong>${log.action}</strong></td>
      <td>${detailsText}</td>
      <td>
        <small>${log.ip || 'localhost'}</small><br>
        <small style="color: var(--medium-gray);">${userAgent}</small>
      </td>
    `;

    tbody.appendChild(row);
  });

  logAction('AUDIT_LOGS_LOADED', { count: sortedLogs.length });
}

function filterAuditLogs() {
  const filter = document.getElementById('auditLogFilter').value;
  const tbody = document.getElementById('auditLogsTableBody');

  if (!tbody || !systemData.auditLog) return;

  tbody.innerHTML = '';

  const filteredLogs = systemData.auditLog
    .filter(log => !filter || log.action.includes(filter))
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100);

  filteredLogs.forEach(log => {
    const row = document.createElement('tr');

    let actionClass = '';
    if (log.action.includes('FAILED') || log.action.includes('ERROR')) {
      actionClass = 'negative';
    } else if (log.action.includes('SUCCESS') || log.action.includes('CREATED')) {
      actionClass = 'positive';
    }

    const detailsText = typeof log.details === 'object'
      ? JSON.stringify(log.details).substring(0, 100) + '...'
      : (log.details || '').toString().substring(0, 100);

    const userAgent = log.userAgent ? log.userAgent.substring(0, 50) + '...' : 'N/A';

    row.innerHTML = `
      <td><strong>${formatDateTime(log.timestamp)}</strong></td>
      <td>${log.user || 'Sistema'}</td>
      <td class="${actionClass}"><strong>${log.action}</strong></td>
      <td>${detailsText}</td>
      <td>
        <small>${log.ip || 'localhost'}</small><br>
        <small style="color: var(--medium-gray);">${userAgent}</small>
      </td>
    `;

    tbody.appendChild(row);
  });

  logAction('AUDIT_LOGS_FILTERED', { filter, count: filteredLogs.length });
}

function updateAuditStats() {
  if (!systemData.auditLog || !Array.isArray(systemData.auditLog)) {
    return;
  }

  const logs = systemData.auditLog;

  // Contadores
  const totalLogins = logs.filter(log =>
    log.action.includes('LOGIN_SUCCESS') || log.action.includes('ADMIN_LOGIN_SUCCESS')
  ).length;

  const failedLogins = logs.filter(log =>
    log.action.includes('LOGIN_FAILED') || log.action.includes('LOGIN_BLOCKED')
  ).length;

  const totalActions = logs.length;

  const systemErrors = logs.filter(log =>
    log.action.includes('ERROR') || log.action.includes('FAILED')
  ).length;

  // Atualiza elementos
  const totalLoginsEl = document.getElementById('totalLogins');
  const failedLoginsEl = document.getElementById('failedLogins');
  const totalActionsEl = document.getElementById('totalActions');
  const systemErrorsEl = document.getElementById('systemErrors');

  if (totalLoginsEl) totalLoginsEl.textContent = totalLogins;
  if (failedLoginsEl) failedLoginsEl.textContent = failedLogins;
  if (totalActionsEl) totalActionsEl.textContent = totalActions;
  if (systemErrorsEl) systemErrorsEl.textContent = systemErrors;

  // Aplica cores baseadas nos valores
  if (failedLoginsEl) {
    failedLoginsEl.className = failedLogins > 10 ? 'stat-value negative' : 'stat-value';
  }

  if (systemErrorsEl) {
    systemErrorsEl.className = systemErrors > 5 ? 'stat-value negative' : 'stat-value';
  }
}

function refreshAuditLogs() {
  showLoading('Atualizando logs...');

  setTimeout(() => {
    loadAuditLogs();
    updateAuditStats();
    hideLoading();
    showAlert('Logs de auditoria atualizados!', 'success');
  }, 500);
}

function exportAuditLogs() {
  if (!systemData.auditLog || systemData.auditLog.length === 0) {
    showAlert('Nenhum log encontrado para exportar!', 'warning');
    return;
  }

  const csvData = systemData.auditLog.map(log => ({
    'Data/Hora': formatDateTime(log.timestamp),
    'Usuário': log.user || 'Sistema',
    'Tipo': log.userType || 'system',
    'Ação': log.action,
    'Detalhes': typeof log.details === 'object' ? JSON.stringify(log.details) : log.details || '',
    'IP': log.ip || 'localhost',
    'Navegador': log.userAgent || 'N/A'
  }));

  const timestamp = new Date().toISOString().split('T')[0];
  exportToCSV(csvData, `cima-audit-logs-${timestamp}.csv`);

  logAction('AUDIT_LOGS_EXPORTED', { count: csvData.length });
  showAlert(`${csvData.length} logs exportados com sucesso!`, 'success');
}

function clearOldLogs() {
  if (!confirm('Tem certeza que deseja limpar logs antigos (mais de 30 dias)? Esta ação não pode ser desfeita.')) {
    return;
  }

  if (!systemData.auditLog || systemData.auditLog.length === 0) {
    showAlert('Nenhum log encontrado!', 'info');
    return;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const originalCount = systemData.auditLog.length;
  systemData.auditLog = systemData.auditLog.filter(log =>
    new Date(log.timestamp) > thirtyDaysAgo
  );

  const removedCount = originalCount - systemData.auditLog.length;

  if (removedCount > 0) {
    saveData();
    loadAuditLogs();
    updateAuditStats();
    logAction('OLD_LOGS_CLEARED', { removed: removedCount });
    showAlert(`${removedCount} logs antigos foram removidos!`, 'success');
  } else {
    showAlert('Nenhum log antigo encontrado para remoção.', 'info');
  }
}

function runSystemCheck() {
  showLoading('Executando verificação do sistema...');

  setTimeout(() => {
    const results = [];

    // Verifica integridade dos dados
    const integrityCheck = verifyDataIntegrity();
    results.push({
      test: 'Integridade dos Dados',
      status: integrityCheck ? 'OK' : 'ATENÇÃO',
      message: integrityCheck ? 'Todos os dados estão íntegros' : 'Problemas de integridade detectados'
    });

    // Verifica localStorage
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      results.push({
        test: 'Armazenamento Local',
        status: 'OK',
        message: 'LocalStorage funcionando corretamente'
      });
    } catch (e) {
      results.push({
        test: 'Armazenamento Local',
        status: 'ERRO',
        message: 'Problema no localStorage: ' + e.message
      });
    }

    // Verifica dependências
    const dependencies = [
      { name: 'Chart.js', check: () => typeof Chart !== 'undefined' },
      { name: 'jsPDF', check: () => typeof window.jsPDF !== 'undefined' }
    ];

    dependencies.forEach(dep => {
      results.push({
        test: `Dependência: ${dep.name}`,
        status: dep.check() ? 'OK' : 'AUSENTE',
        message: dep.check() ? `${dep.name} carregado` : `${dep.name} não encontrado`
      });
    });

    // Verifica tamanho dos dados
    const dataSize = JSON.stringify(systemData).length;
    const sizeInMB = (dataSize / (1024 * 1024)).toFixed(2);
    results.push({
      test: 'Tamanho dos Dados',
      status: dataSize > 5 * 1024 * 1024 ? 'ATENÇÃO' : 'OK',
      message: `Dados ocupam ${sizeInMB} MB`
    });

    // Exibe resultados
    const resultsDiv = document.getElementById('systemCheckResults');
    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <div style="background: var(--light-gray); padding: 20px; border-radius: 12px; margin-top: 15px;">
          <h4 style="color: var(--primary-blue); margin-bottom: 15px;">
            <i class="fas fa-clipboard-check"></i> Resultados da Verificação
          </h4>
          ${results.map(result => `
            <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0; padding: 10px; background: var(--white); border-radius: 8px;">
              <div style="min-width: 60px;">
                <span class="badge badge-${result.status === 'OK' ? 'success' : result.status === 'ATENÇÃO' ? 'warning' : 'danger'}"
                      style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;
                             color: white; background: ${result.status === 'OK' ? 'var(--success-green)' : result.status === 'ATENÇÃO' ? 'var(--warning-orange)' : 'var(--danger-red)'};">
                  ${result.status}
                </span>
              </div>
              <div style="flex: 1;">
                <strong>${result.test}:</strong> ${result.message}
              </div>
            </div>
          `).join('')}
          <div style="margin-top: 15px; padding: 10px; background: rgba(212, 175, 55, 0.1); border-radius: 8px; border-left: 4px solid var(--accent-gold);">
            <small><strong>Verificação concluída em:</strong> ${new Date().toLocaleString('pt-BR')}</small>
          </div>
        </div>
      `;
    }

    hideLoading();
    logAction('SYSTEM_CHECK_COMPLETED', { results: results.length });
    showAlert('Verificação do sistema concluída!', 'success');

  }, 2000);
}

function showSystemInfo() {
  const info = {
    'Versão do Sistema': '1.0.0',
    'Navegador': navigator.userAgent.split(' ').pop(),
    'Idioma': navigator.language,
    'Fuso Horário': Intl.DateTimeFormat().resolvedOptions().timeZone,
    'Total de Clientes': systemData.clients.length,
    'Total de Operações': systemData.operations.length,
    'Total de Logs': systemData.auditLog ? systemData.auditLog.length : 0,
    'Último Backup': localStorage.getItem('lastAutoBackup') || 'Nunca',
    'Sessão Iniciada': new Date().toLocaleString('pt-BR')
  };

  const infoHtml = Object.entries(info).map(([key, value]) => `
    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
      <strong>${key}:</strong>
      <span>${value}</span>
    </div>
  `).join('');

  const resultsDiv = document.getElementById('systemCheckResults');
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

  logAction('SYSTEM_INFO_VIEWED');
}

function optimizeDatabase() {
  if (!confirm('Deseja otimizar os dados do sistema? Isso pode melhorar a performance.')) {
    return;
  }

  showLoading('Otimizando dados...');

  setTimeout(() => {
    let optimizations = 0;

    // Remove logs duplicados
    if (systemData.auditLog && systemData.auditLog.length > 1) {
      const originalLogCount = systemData.auditLog.length;
      const uniqueLogs = systemData.auditLog.filter((log, index, arr) =>
        arr.findIndex(l =>
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
    systemData.operations = systemData.operations.filter(op =>
      new Date(op.date) > twoYearsAgo
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
      logAction('DATABASE_OPTIMIZED', { itemsRemoved: optimizations });
      showAlert(`Otimização concluída! ${optimizations} itens removidos/otimizados.`, 'success');

      // Recarrega dados atualizados
      loadAuditLogs();
      updateAuditStats();
      updateOperationsTable();
    } else {
      showAlert('Dados já estão otimizados. Nenhuma ação necessária.', 'info');
    }

  }, 1500);
}
