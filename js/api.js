// API Client - migração progressiva para backend

const API_BASE = window.API_BASE || '/api/v1';

async function apiRequest(path, opts = {}) {
  const token = localStorage.getItem('cimaAccessToken');
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, Object.assign({}, opts, { headers }));
  if (!res.ok) {
    if (res.status === 401) {
      // Limpa token inválido e propaga erro
      localStorage.removeItem('cimaAccessToken');
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }
  return res.json();
}

async function apiLogin(email, password) {
  const data = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem('cimaAccessToken', data.accessToken);
  return data.user;
}

async function apiGetClients() {
  return apiRequest('/clients');
}

async function apiGetClient(id) {
  if (!id && typeof id !== 'number') throw new Error('Client id é obrigatório');
  return apiRequest(`/clients/${id}`);
}

async function apiCreateClient(payload) {
  return apiRequest('/clients', { method: 'POST', body: JSON.stringify(payload) });
}

async function apiGetOperations(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/operations${query ? '?' + query : ''}`);
}

async function apiCreateOperation(op) {
  return apiRequest('/operations', { method: 'POST', body: JSON.stringify(op) });
}

async function apiGetMe() {
  return apiRequest('/clients/me');
}

async function apiGetMySummary(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/clients/me/summary${query ? '?' + query : ''}`);
}

// Exponha apenas o necessário por enquanto
window.CIMA_API = {
  login: apiLogin,
  getClients: apiGetClients,
  getClient: apiGetClient,
  getMe: apiGetMe,
  getMySummary: apiGetMySummary,
  createClient: apiCreateClient,
  getOperations: apiGetOperations,
  createOperation: apiCreateOperation,
};
