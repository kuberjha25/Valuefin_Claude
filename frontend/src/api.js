/* API client. One place that knows the base URL, the cookie policy and how the
   server reports errors — every page calls through `api`. */
const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

async function req(path, opts = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      credentials: 'include',
      ...opts,
      headers: opts.json ? { 'Content-Type': 'application/json', ...(opts.headers || {}) } : opts.headers,
      body: opts.json ? JSON.stringify(opts.json) : opts.body
    });
  } catch (e) {
    const err = new Error('Cannot reach the API on ' + BASE + '. Is the backend running?');
    err.offline = true;
    throw err;
  }
  if (!res.ok) {
    let msg = res.statusText || 'Request failed';
    try { msg = (await res.json()).error || msg; } catch (_) { /* non-JSON error body */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

const qs = (o = {}) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== '' && v != null && v !== false) p.set(k, v); });
  const s = p.toString();
  return s ? '?' + s : '';
};

export const api = {
  get: (p) => req(p),
  post: (p, json) => req(p, { method: 'POST', json }),
  put: (p, json) => req(p, { method: 'PUT', json }),
  del: (p) => req(p, { method: 'DELETE' }),
  upload: (p, form) => req(p, { method: 'POST', body: form }),

  /* ---- auth ---- */
  directory: () => req('/auth/directory'),
  login: (email, password) => req('/auth/login', { method: 'POST', json: { email, password } }),
  logout: () => req('/auth/logout', { method: 'POST', json: {} }),
  me: () => req('/auth/me'),
  changePassword: (current, next) => req('/auth/password', { method: 'POST', json: { current, next } }),
  sessions: () => req('/auth/sessions'),
  revokeOtherSessions: () => req('/auth/sessions/revoke-others', { method: 'POST', json: {} }),

  /* ---- borrowers ---- */
  borrowers: (f) => req('/borrowers' + qs(f)),
  borrower: (id) => req('/borrowers/' + id),
  /* Onboarding is multipart — the facility fields travel with the mandatory
     onboarding PDF so the borrower and its first document are created together. */
  createBorrower: (form) => req('/borrowers', { method: 'POST', body: form }),
  updateBorrower: (id, b) => req('/borrowers/' + id, { method: 'PUT', json: b }),
  deleteBorrower: (id) => req('/borrowers/' + id, { method: 'DELETE' }),
  addLimit: (id, body) => req('/borrowers/' + id + '/limit', { method: 'POST', json: body }),
  deleteLimit: (id, limitId) => req('/borrowers/' + id + '/limit/' + limitId, { method: 'DELETE' }),

  /* ---- drawdowns & payments ---- */
  drawdowns: (f) => req('/drawdowns' + qs(f)),
  createDrawdown: (d) => req('/drawdowns', { method: 'POST', json: d }),
  updateDrawdown: (id, d) => req('/drawdowns/' + id, { method: 'PUT', json: d }),
  rotateDrawdown: (id, body) => req('/drawdowns/' + id + '/rotate', { method: 'POST', json: body }),
  deleteDrawdown: (id) => req('/drawdowns/' + id, { method: 'DELETE' }),

  previewPayment: (p) => req('/payments/preview', { method: 'POST', json: p }),
  createPayment: (p) => req('/payments', { method: 'POST', json: p }),
  updatePayment: (id, p) => req('/payments/' + id, { method: 'PUT', json: p }),
  deletePayment: (id) => req('/payments/' + id, { method: 'DELETE' }),

  /* ---- reports ---- */
  portfolio: () => req('/portfolio'),
  ledger: (f) => req('/ledger' + qs(f)),
  mis: (id, f) => req('/mis/' + id + qs(f)),
  search: (q) => req('/search' + qs({ q })),
  audit: (f) => req('/audit' + qs(f)),

  /* ---- documents ---- */
  documents: (f) => req('/documents' + qs(f)),
  documentCounts: () => req('/documents/counts'),
  uploadDocument: (borrowerId, form) => req('/borrowers/' + borrowerId + '/documents', { method: 'POST', body: form }),
  decideDocument: (id, approve, reason) => req('/documents/' + id + '/decide', { method: 'POST', json: { approve, reason } }),
  deleteDocument: (id) => req('/documents/' + id, { method: 'DELETE' }),

  /* ---- notifications ---- */
  notifications: () => req('/notifications'),
  unreadCount: () => req('/notifications/unread-count'),
  readNotification: (id) => req('/notifications/' + id + '/read', { method: 'POST', json: {} }),
  readAllNotifications: () => req('/notifications/read-all', { method: 'POST', json: {} }),

  /* ---- team & admin ---- */
  users: () => req('/users'),
  createUser: (u) => req('/users', { method: 'POST', json: u }),
  updateUser: (id, u) => req('/users/' + id, { method: 'PUT', json: u }),
  resetUserPassword: (id, password) => req('/users/' + id + '/password', { method: 'POST', json: { password } }),
  deleteUser: (id) => req('/users/' + id, { method: 'DELETE' }),
  status: () => req('/admin/status'),
  resetData: () => req('/admin/reset', { method: 'POST', json: { confirm: 'RESET' } }),
  health: () => req('/health')
};

export const fileUrl = (id, download) => BASE + '/documents/' + id + '/file' + (download ? '?download=1' : '');
export const openFile = (id) => window.open(fileUrl(id), '_blank', 'noopener');

/* Client-side CSV download — BOM included so Excel reads ₹ and en-dashes. */
export function downloadCSV(filename, header, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
