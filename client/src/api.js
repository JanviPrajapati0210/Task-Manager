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

export function logoutUser() {
  setToken(null);
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

// ---------- Auth ----------

export async function registerUser(email, password) {
  return apiFetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
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