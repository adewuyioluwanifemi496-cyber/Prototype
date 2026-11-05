const KEY = 'pxy-break-token';
export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

// Throws { errors: { field: message } } on failure so forms can show errors next to fields.
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw { errors: { form: 'Could not reach the server. Check that it is running.' } };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, errors: data.errors || { form: 'Something went wrong.' } };
  return data;
}

export const qs = (obj) => {
  const p = new URLSearchParams(Object.entries(obj).filter(([, v]) => v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const fmtDate = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');
