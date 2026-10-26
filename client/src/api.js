const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'taskAppToken';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isLoggedIn() {
  return Boolean(getToken());
}

// Tells the server we are logging out (best effort), then forgets the token.
export async function logoutUser() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Even if the request fails (offline, token already expired), log out locally.
  } finally {
    setToken(null);
  }
}

async function handleResponse(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && (data.message || data.error || (data.messages && data.messages.join(', ')))) ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch (networkErr) {
    throw new Error('Network error. Is the Express backend running on port 5000?');
  }

  if (res.status === 401) {
    setToken(null); // token missing/expired/invalid - clear it client-side
  }

  return handleResponse(res);
}

// Builds "?a=1&b=2" and skips empty values and the "all" placeholder
function toQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      query.append(key, value);
    }
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

// ---------- Auth ----------

export async function registerUser(username, email, password) {
  return apiFetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
}

export async function loginUser(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

// Google Sign-In: send the Google ID token, get OUR JWT back
export async function loginWithGoogle(credential) {
  const data = await apiFetch('/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  setToken(data.token);
  return data;
}

// Forgot / reset password
export async function forgotPassword(email) {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token, password) {
  return apiFetch(`/auth/reset-password/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export async function getMe() {
  const data = await apiFetch('/auth/me');
  return data.user;
}

// ---------- Tasks (all require the token, attached automatically above) ----------

export async function getTasks() {
  return apiFetch('/tasks');
}

export async function createTask(payload) {
  const data = await apiFetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data.task;
}

export async function updateTask(id, updates) {
  const data = await apiFetch(`/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return data.task;
}

export async function deleteTask(id) {
  return apiFetch(`/tasks/${id}`, { method: 'DELETE' });
}

// ---------- AI Task Assistant (Practical 11) ----------

export async function getAiTaskSuggestion(title, description = '', options = {}) {
  const data = await apiFetch('/tasks/ai/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, ...options }),
  });
  return data.suggestion;
}

// ---------- Reports ----------

// params: { startDate, endDate, status, allUsers }
export async function getStats(params = {}) {
  const data = await apiFetch(`/tasks/report/stats${toQuery(params)}`);
  return data.stats;
}

// Downloads a PDF from the API (the Authorization header is needed, so a plain
// <a href> would not work) and hands it to the browser as a file download.
export async function downloadPdf(path, params = {}, filename = 'tasks-report.pdf') {
  const token = getToken();

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}${toQuery(params)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (networkErr) {
    throw new Error('Network error. Is the Express backend running on port 5000?');
  }

  if (res.status === 401) {
    setToken(null);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const err = new Error((data && (data.message || data.error)) || `Download failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ---------- Team & Roles ----------

export async function getUsers() {
  const data = await apiFetch('/auth/users');
  return data.users;
}

export async function updateUserRole(userId, role) {
  return apiFetch(`/auth/users/${userId}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
}