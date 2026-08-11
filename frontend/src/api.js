const BASE = 'http://localhost:4000/api';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    ...opts,
    headers: opts.json ? { 'Content-Type': 'application/json' } : opts.headers,
    body: opts.json ? JSON.stringify(opts.json) : opts.body
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch (e) { /* keep */ }
    const err = new Error(msg); err.status = res.status; throw err;
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

export const api = {
  get: (p) => req(p),
  post: (p, json) => req(p, { method: 'POST', json }),
  put: (p, json) => req(p, { method: 'PUT', json }),
  del: (p) => req(p, { method: 'DELETE' }),
  upload: (p, form) => req(p, { method: 'POST', body: form })
};

export const fileUrl = (id) => BASE + '/documents/' + id + '/file';
export const openFile = (id) => window.open(fileUrl(id), '_blank');

/* client-side CSV download */
export function downloadCSV(filename, header, rows) {
  const esc = (v) => { const s = String(v ?? ''); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
