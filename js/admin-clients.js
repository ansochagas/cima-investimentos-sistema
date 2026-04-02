// CIMA Investimentos - Módulo de Gestão de Clientes

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
  if (
    systemData.clients.some(
      (c) => c.email.toLowerCase() === email.toLowerCase()
    )
  ) {
    showAlert("Este email já está cadastrado!", "danger");
    return;
  }

  // Validação do investimento
  const investment = parseFloat(investmentInput);
  if (!validateInvestmentAmount(investment)) {
    showAlert(
      "Valor de investimento deve estar entre R$ 1.000,00 e R$ 10.000.000,00!",
      "danger"
    );
    return;
  }

  // Validação da senha
  const passwordStrength = validatePasswordStrength(password);
  if (!passwordStrength.isValid) {
    showAlert(`Senha fraca! ${passwordStrength.feedback}`, "warning");

    if (
      !confirm(
        "Deseja continuar com uma senha fraca? Recomenda-se uma senha mais forte."
      )
    ) {
      return;
    }
  }

  // Se autenticado como admin, tenta criar cliente na API
  const hasToken = !!localStorage.getItem("cimaAccessToken");
  if (hasToken && systemData.userType === "admin" && window.CIMA_API) {
    try {
      showLoading("Cadastrando cliente...");

      const clientData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        startDate:
          startDateInput && /^\d{4}-\d{2}-\d{2}$/.test(startDateInput)
            ? startDateInput
            : toLocalDateInputValue(),
        initialInvestment: investment,
      };

      const result = await window.CIMA_API.createClient(clientData);

      // Clear form
      document.getElementById("newClientName").value = "";
      document.getElementById("newClientEmail").value = "";
      document.getElementById("newClientInvestment").value = "";
      document.getElementById("newClientPassword").value = "";
      const sd = document.getElementById("newClientStartDate");
      if (sd) sd.value = "";

      // Atualiza tabelas com dados do servidor
      updateClientsTable();
      closeModal("addClientModal");
      updateAdminOverview();

      hideLoading();

      // Popup de confirmação de sucesso
      setTimeout(() => {
        alert(
          `✅ Cliente ${name} cadastrado com sucesso!\n\n📧 Email: ${email}\n💰 Aporte: ${formatCurrency(
            investment
          )}`
        );
      }, 100);

      showAlert(`Cliente ${name} cadastrado com sucesso!`, "success");

      // Log da ação
      logAction("CLIENT_CREATED_API", {
        name: name,
        email: email,
        initialInvestment: investment,
      });

      return;
    } catch (apiError) {
      console.warn("Falha ao criar cliente via API, tentando local:", apiError);
      hideLoading();
      // Continua para fallback local
    }
  }

  // Fallback local (se API falhar ou não estiver disponível)
  try {
    showLoading("Cadastrando cliente...");

    // Gera senha hasheada
    const hashedPassword = await hashPassword(password);

    // Gera ID único mais seguro
    const newId =
      systemData.clients.length > 0
        ? Math.max(...systemData.clients.map((c) => c.id)) + 1
        : 1;

    // Define startDate informado ou hoje
    const todayStr = toLocalDateInputValue();
    let startDate =
      startDateInput && /^\d{4}-\d{2}-\d{2}$/.test(startDateInput)
        ? startDateInput
        : todayStr;

    const newClient = {
      id: newId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      initialInvestment: investment,
      currentBalance: investment,
      startDate,
      createdAt: new Date().toISOString(),
      status: "active",
      loginAttempts: 0,
      lastLogin: null,
    };

    systemData.clients.push(newClient);

    // Clear form
    document.getElementById("newClientName").value = "";
    document.getElementById("newClientEmail").value = "";
    document.getElementById("newClientInvestment").value = "";
    document.getElementById("newClientPassword").value = "";
    const sd = document.getElementById("newClientStartDate");
    if (sd) sd.value = "";

    updateClientsTable();
    closeModal("addClientModal");
    updateAdminOverview();
    saveData();
    hideLoading();

    // Popup de confirmação de sucesso
    setTimeout(() => {
      alert(
        `✅ Cliente ${name} cadastrado com sucesso!\n\n📧 Email: ${email}\n💰 Aporte: ${formatCurrency(
          investment
        )}`
      );
    }, 100);

    showAlert(`Cliente ${name} cadastrado com sucesso!`, "success");

    // Log da ação
    logAction("CLIENT_CREATED_LOCAL", {
      clientId: newId,
      name: name,
      email: email,
      initialInvestment: investment,
    });

    // Notifica sobre o novo cliente
    showNotification(
      "Novo Cliente Cadastrado",
      `${name} foi cadastrado com aporte de ${formatCurrency(investment)}`,
      "success"
    );
  } catch (error) {
    hideLoading();
    showAlert("Erro ao cadastrar cliente. Tente novamente.", "danger");
    logAction("CLIENT_CREATION_FAILED", {
      error: error.message,
      email: email,
    });
  }
}

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

function updateClientsTable() {
  const tbody = document.getElementById("clientsTableBody");
  tbody.innerHTML = "";

  // Se autenticado via API como admin, busca clientes do servidor (migração gradual)
  const hasToken = !!localStorage.getItem("cimaAccessToken");
  if (hasToken && systemData.userType === "admin" && window.CIMA_API) {
    window.CIMA_API.getClients()
      .then((clients) => {
        // Normaliza para o formato usado no front
        const normalized = (clients || []).map((c) => ({
          id: c.id,
          name: c.name,
          email: c.user && c.user.email ? c.user.email : "",
          initialInvestment: parseFloat(c.initialInvestment),
          currentBalance: parseFloat(
            c.currentBalanceComputed ?? c.currentBalance
          ),
          startDate: c.startDate ? String(c.startDate).slice(0, 10) : null,
        }));

        // Atualiza base local para reutilizar renderizações existentes
        systemData.clients = normalized;

        // Renderiza tabela com dados normalizados
        normalized.forEach((client) => {
          const profit = client.currentBalance - client.initialInvestment;
          const profitability = (
            (profit / client.initialInvestment) *
            100
          ).toFixed(2);
          const row = document.createElement("tr");
          row.innerHTML = `
                  <td><strong>${client.name}</strong></td>
                  <td>${client.email}</td>
                  <td>${formatCurrency(client.initialInvestment)}</td>
                  <td><strong>${formatCurrency(
                    client.currentBalance
                  )}</strong></td>
                  <td class="${profitability >= 0 ? "positive" : "negative"}">
                      <strong>${
                        profitability >= 0 ? "+" : ""
                      }${profitability}%</strong>
                  </td>
                  <td>
                      <button class="btn btn-gold" onclick="editClient(${
                        client.id
                      })" style="margin: 2px; padding: 8px 15px; font-size: 0.9rem;">
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
        console.warn(
          "Falha ao carregar clientes da API, usando dados locais:",
          err && err.message
        );
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
      const profitability = ((profit / client.initialInvestment) * 100).toFixed(
        2
      );
      const row = document.createElement("tr");
      row.innerHTML = `
              <td><strong>${client.name}</strong></td>
              <td>${client.email}</td>
              <td>${formatCurrency(client.initialInvestment)}</td>
              <td><strong>${formatCurrency(client.currentBalance)}</strong></td>
              <td class="${profitability >= 0 ? "positive" : "negative"}">
                  <strong>${
                    profitability >= 0 ? "+" : ""
                  }${profitability}%</strong>
              </td>
              <td>
                  <button class="btn btn-gold" onclick="editClient(${
                    client.id
                  })" style="margin: 2px; padding: 8px 15px; font-size: 0.9rem;">
                      <i class="fas fa-edit"></i>
                  </button>
              </td>
          `;
      tbody.appendChild(row);
    });
  }

  renderLocalClientsTable();
}
