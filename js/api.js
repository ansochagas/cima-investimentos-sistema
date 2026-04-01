// API Client - migracao progressiva para backend

const HOSTED_API_BY_HOST = {
  "cima-investimentos-sistema.onrender.com":
    "https://cima-investimentos-sistema-api.onrender.com/api/v1",
  "cima-frontend-o7sn.onrender.com":
    "https://cima-investimentos-api.onrender.com/api/v1",
};

function resolveApiBase() {
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("apiBase");
  if (queryValue) {
    return queryValue.replace(/\/+$/, "");
  }

  if (window.API_BASE) {
    return String(window.API_BASE).replace(/\/+$/, "");
  }

  const hostname = String(window.location.hostname || "").toLowerCase();
  const hostedApiBase = HOSTED_API_BY_HOST[hostname];
  if (hostedApiBase) {
    return hostedApiBase;
  }

  return "/api/v1";
}

const API_BASE = resolveApiBase();

async function apiRequest(path, opts = {}) {
  const token = localStorage.getItem("cimaAccessToken");
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {}
  );
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(
    `${API_BASE}${path}`,
    Object.assign({}, opts, { headers })
  );

  if (!res.ok) {
    if (res.status === 401) {
      const refreshToken = localStorage.getItem("cimaRefreshToken");
      if (refreshToken && !opts._retry) {
        try {
          const refreshData = await apiRefreshToken();
          localStorage.setItem("cimaAccessToken", refreshData.accessToken);
          localStorage.setItem("cimaRefreshToken", refreshData.refreshToken);
          return apiRequest(path, { ...opts, _retry: true });
        } catch (refreshError) {
          localStorage.removeItem("cimaAccessToken");
          localStorage.removeItem("cimaRefreshToken");
        }
      } else {
        localStorage.removeItem("cimaAccessToken");
        localStorage.removeItem("cimaRefreshToken");
      }
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API error");
  }
  return res.json();
}

async function apiRefreshToken() {
  const refreshToken = localStorage.getItem("cimaRefreshToken");
  return apiRequest("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

async function apiLogin(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("cimaAccessToken", data.accessToken);
  localStorage.setItem("cimaRefreshToken", data.refreshToken);
  return data.user;
}

async function apiGetClients() {
  return apiRequest("/clients");
}

async function apiGetClient(id) {
  if (!id && typeof id !== "number") throw new Error("Client id e obrigatorio");
  return apiRequest(`/clients/${id}`);
}

async function apiCreateClient(payload) {
  return apiRequest("/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function apiGetOperations(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/operations${query ? "?" + query : ""}`);
}

async function apiCreateOperation(op) {
  return apiRequest("/operations", {
    method: "POST",
    body: JSON.stringify(op),
  });
}

async function apiSettleOperation(id, payload) {
  if (!id && typeof id !== "number") {
    throw new Error("Operation id e obrigatorio");
  }

  return apiRequest(`/operations/${id}/settle`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function apiGetMe() {
  return apiRequest("/clients/me");
}

async function apiGetMySummary(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/clients/me/summary${query ? "?" + query : ""}`);
}

async function apiLogout() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } finally {
    localStorage.removeItem("cimaAccessToken");
    localStorage.removeItem("cimaRefreshToken");
  }
}

window.CIMA_API = {
  login: apiLogin,
  getClients: apiGetClients,
  getClient: apiGetClient,
  getMe: apiGetMe,
  getMySummary: apiGetMySummary,
  createClient: apiCreateClient,
  getOperations: apiGetOperations,
  createOperation: apiCreateOperation,
  settleOperation: apiSettleOperation,
  logout: apiLogout,
};
