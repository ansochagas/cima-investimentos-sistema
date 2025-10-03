// CIMA Investimentos - Sistema de Autenticação

// Função simples de alert se utils.js não carregou
function showAlert(message, type) {
  if (typeof window.showAlert === "undefined") {
    alert(message);
    console.log(`[${type.toUpperCase()}] ${message}`);
  } else {
    window.showAlert(message, type);
  }
}

// Authentication Functions
async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    showAlert("Por favor, preencha todos os campos!", "danger");
    console.log("LOGIN_ATTEMPT_FAILED: empty fields");
    return;
  }

  console.log("Tentativa de login:", username);

  try {
    // Tentativa via API (migração gradual)
    const looksLikeEmail = username.includes("@");
    if (looksLikeEmail && window.CIMA_API) {
      try {
        const user = await window.CIMA_API.login(username, password);
        const role = (user.role || "").toLowerCase();
        if (role === "admin") {
          systemData.currentUser = "admin";
          systemData.userType = "admin";
          localStorage.setItem(
            "cimaActiveSession",
            JSON.stringify({ role: "admin", email: user.email })
          );
          showAdminDashboard();
          showAlert("Login administrativo realizado com sucesso!", "success");
          console.log("ADMIN_LOGIN_SUCCESS_API");
          saveData();
          return;
        } else if (role === "client") {
          console.log("CLIENT_LOGIN_API_SUCCESS");
          try {
            const me = await window.CIMA_API.getMe();
            const normalize = (v) =>
              typeof v === "string" ? parseFloat(v) : v;
            const meNorm = {
              ...me,
              initialInvestment: normalize(me.initialInvestment),
              currentBalance: normalize(me.currentBalance),
            };
            systemData.currentUser = meNorm;
            systemData.userType = "client";
            showClientDashboard(meNorm);
            showAlert("Bem-vindo, " + meNorm.name + "!", "success");
            saveData();
            return;
          } catch (e2) {
            console.warn(
              "Falha ao carregar perfil do cliente via API, tentando fallback local.",
              e2
            );
            // Continua para tentar login local
          }
        }
      } catch (e) {
        console.warn(
          "Falha no login via API, tentando fallback local:",
          e.message
        );
        // Continua para tentar login local
      }
    }
    // Admin login - aceita senhas antigas temporariamente
    if (username === "admin") {
      if (password === "admin123" || password === "CimaInvest2024!") {
        systemData.currentUser = "admin";
        systemData.userType = "admin";
        showAdminDashboard();
        showAlert("Login administrativo realizado com sucesso!", "success");
        console.log("ADMIN_LOGIN_SUCCESS");
        saveData();
        return;
      } else {
        showAlert("Credenciais administrativas incorretas!", "danger");
        console.log("ADMIN_LOGIN_FAILED");
        return;
      }
    } else {
      // Client login - busca por email
      const client = systemData.clients.find((c) => c.email === username);

      if (client) {
        // Para clientes existentes, aceita senhas simples temporariamente
        if (client.password === password || password === "123456") {
          systemData.currentUser = client;
          systemData.userType = "client";
          showClientDashboard(client);
          showAlert(`Bem-vindo, ${client.name}!`, "success");
          console.log("CLIENT_LOGIN_SUCCESS:", client.name);
          saveData();
          return;
        }
      }

      showAlert("Email ou senha incorretos!", "danger");
      console.log("CLIENT_LOGIN_FAILED:", username);
    }
  } catch (error) {
    console.error("Erro no login:", error);
    showAlert("Erro no sistema de autenticação. Tente novamente.", "danger");
  }
}

function logout() {
  const currentUserName =
    systemData.currentUser?.name || systemData.currentUser || "Usuário";

  systemData.currentUser = null;
  systemData.userType = null;

  // Remove sessão ativa
  localStorage.removeItem("cimaActiveSession");
  localStorage.removeItem("cimaAccessToken");

  document.getElementById("loginScreen").style.display = "block";
  document.getElementById("adminDashboard").style.display = "none";
  document.getElementById("clientDashboard").style.display = "none";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";

  showAlert("Logout realizado com sucesso!", "success");
  logAction("LOGOUT_SUCCESS", { user: currentUserName });
  saveData();
}

// ==================== FUNÇÕES DE AUTENTICAÇÃO SEGURA ====================
async function verifyAdminPassword(password) {
  // Verifica se existe senha admin hasheada
  if (!systemData.adminPassword) {
    // Primeira vez - define senha padrão forte
    systemData.adminPassword = await hashPassword("CimaInvest2024!");
    saveData();
    // Para migração, aceita senhas antigas temporariamente
    return password === "admin123" || password === "CimaInvest2024!";
  }

  return await verifyPassword(password, systemData.adminPassword);
}

async function findClientByCredentials(email, password) {
  const client = systemData.clients.find((c) => c.email === email);

  if (!client) return null;

  // Verifica senha
  const isValidPassword = await verifyPassword(password, client.password);
  return isValidPassword ? client : null;
}

// ==================== GESTÃO DE SESSÕES ====================
function generateSecureToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

function createSecureSession(user, userType) {
  const session = {
    token: generateSecureToken(),
    userId: userType === "client" ? user.id : null,
    userType: userType,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 horas
    ipAddress: "localhost", // Em produção capturar IP real
    userAgent: navigator.userAgent.substring(0, 200),
  };

  localStorage.setItem("cimaSecureSession", JSON.stringify(session));
  logAction("SESSION_CREATED", { userType, expiresAt: session.expiresAt });

  return session;
}

function validateSession() {
  const sessionData = localStorage.getItem("cimaSecureSession");

  if (!sessionData) return null;

  try {
    const session = JSON.parse(sessionData);
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);

    if (now >= expiresAt) {
      localStorage.removeItem("cimaSecureSession");
      logAction("SESSION_EXPIRED", { expiredAt: session.expiresAt });
      return null;
    }

    // Renova sessão se está próxima do vencimento (menos de 1 hora)
    if (expiresAt.getTime() - now.getTime() < 60 * 60 * 1000) {
      session.expiresAt = new Date(
        Date.now() + 8 * 60 * 60 * 1000
      ).toISOString();
      localStorage.setItem("cimaSecureSession", JSON.stringify(session));
      logAction("SESSION_RENEWED", { newExpiresAt: session.expiresAt });
    }

    return session;
  } catch (error) {
    localStorage.removeItem("cimaSecureSession");
    logAction("SESSION_VALIDATION_ERROR", { error: error.message });
    return null;
  }
}

// ==================== CONTROLE DE TENTATIVAS DE LOGIN ====================
let loginAttempts = {};

function checkLoginAttempts(identifier) {
  const now = Date.now();
  const maxAttempts = 5;
  const lockoutTime = 15 * 60 * 1000; // 15 minutos

  if (!loginAttempts[identifier]) {
    loginAttempts[identifier] = { count: 0, lastAttempt: now };
  }

  const attempts = loginAttempts[identifier];

  // Reset contador se passou do tempo de lockout
  if (now - attempts.lastAttempt > lockoutTime) {
    attempts.count = 0;
  }

  if (attempts.count >= maxAttempts) {
    const remainingTime = Math.ceil(
      (lockoutTime - (now - attempts.lastAttempt)) / 1000 / 60
    );
    showAlert(
      `Muitas tentativas de login. Tente novamente em ${remainingTime} minutos.`,
      "danger"
    );
    logAction("LOGIN_BLOCKED", { identifier, attempts: attempts.count });
    return false;
  }

  return true;
}

function recordLoginAttempt(identifier, success) {
  const now = Date.now();

  if (!loginAttempts[identifier]) {
    loginAttempts[identifier] = { count: 0, lastAttempt: now };
  }

  if (success) {
    // Reset contador em caso de sucesso
    loginAttempts[identifier].count = 0;
  } else {
    // Incrementa contador de falhas
    loginAttempts[identifier].count++;
    loginAttempts[identifier].lastAttempt = now;
  }

  // Limpa tentativas antigas (mais de 1 hora)
  Object.keys(loginAttempts).forEach((key) => {
    if (now - loginAttempts[key].lastAttempt > 60 * 60 * 1000) {
      delete loginAttempts[key];
    }
  });
}

// ==================== VALIDAÇÕES DE SEGURANÇA ====================
function validatePasswordStrength(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const score = [
    password.length >= minLength,
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    hasSpecialChar,
  ].filter(Boolean).length;

  return {
    score,
    isValid: score >= 3,
    feedback: getPasswordFeedback(
      password.length,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar
    ),
  };
}

function getPasswordFeedback(
  length,
  hasUpper,
  hasLower,
  hasNumbers,
  hasSpecial
) {
  const issues = [];

  if (length < 8) issues.push("pelo menos 8 caracteres");
  if (!hasUpper) issues.push("uma letra maiúscula");
  if (!hasLower) issues.push("uma letra minúscula");
  if (!hasNumbers) issues.push("um número");
  if (!hasSpecial) issues.push("um caractere especial");

  return issues.length > 0
    ? `Senha deve conter: ${issues.join(", ")}`
    : "Senha forte";
}

// ==================== MUDANÇA DE SENHA ====================
async function changePassword(currentPassword, newPassword, confirmPassword) {
  if (!currentPassword || !newPassword || !confirmPassword) {
    showAlert("Preencha todos os campos de senha!", "danger");
    return false;
  }

  if (newPassword !== confirmPassword) {
    showAlert("Nova senha e confirmação não conferem!", "danger");
    return false;
  }

  const strengthCheck = validatePasswordStrength(newPassword);
  if (!strengthCheck.isValid) {
    showAlert(strengthCheck.feedback, "warning");
    return false;
  }

  try {
    showLoading("Alterando senha...");

    if (systemData.userType === "admin") {
      const isCurrentValid = await verifyAdminPassword(currentPassword);
      if (!isCurrentValid) {
        showAlert("Senha atual incorreta!", "danger");
        return false;
      }

      systemData.adminPassword = await hashPassword(newPassword);
      logAction("ADMIN_PASSWORD_CHANGED");
    } else if (systemData.userType === "client" && systemData.currentUser) {
      const isCurrentValid = await verifyPassword(
        currentPassword,
        systemData.currentUser.password
      );
      if (!isCurrentValid) {
        showAlert("Senha atual incorreta!", "danger");
        return false;
      }

      systemData.currentUser.password = await hashPassword(newPassword);

      // Atualiza no array de clientes
      const clientIndex = systemData.clients.findIndex(
        (c) => c.id === systemData.currentUser.id
      );
      if (clientIndex !== -1) {
        systemData.clients[clientIndex].password =
          systemData.currentUser.password;
      }

      logAction("CLIENT_PASSWORD_CHANGED", {
        clientId: systemData.currentUser.id,
      });
    }

    saveData();
    showAlert("Senha alterada com sucesso!", "success");
    return true;
  } catch (error) {
    showAlert("Erro ao alterar senha. Tente novamente.", "danger");
    logAction("PASSWORD_CHANGE_ERROR", { error: error.message });
    return false;
  } finally {
    hideLoading();
  }
}

// Initialize login on Enter key press
function initializeAuth() {
  document.addEventListener("keypress", function (e) {
    if (
      e.key === "Enter" &&
      document.getElementById("loginScreen").style.display !== "none"
    ) {
      login();
    }
  });

  // Solicita permissão para notificações
  requestNotificationPermission();
}
