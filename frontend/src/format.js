export const fmt = (n) => {
  const x = Math.round(+n || 0);
  const neg = x < 0 ? '-' : '';
  let s = String(Math.abs(x));
  if (s.length > 3) {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    s = rest + ',' + last3;
  }
  return '₹' + neg + s;
};

export const fmtCr = (n) => {
  const x = +n || 0;
  if (Math.abs(x) >= 1e7) return '₹' + (x / 1e7).toFixed(2).replace(/\.00$/, '') + ' Cr';
  if (Math.abs(x) >= 1e5) return '₹' + (x / 1e5).toFixed(2).replace(/\.00$/, '') + ' L';
  return fmt(x);
};

export const fmtDate = (iso, withTime = false) => {
  if (!iso) return '—';
  const s = String(iso);
  const d = s.slice(0, 10).replaceAll('-', '/');
  return withTime && s.length >= 16 ? d + ' ' + s.slice(11, 16) : d;
};

export const pct = (n) => (n == null ? '—' : (+n).toFixed(1) + '%');

export const STATUS = {
  pending: { label: 'Pending review', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-rose-100 text-rose-700' },
  Open: { label: 'Open', cls: 'bg-teal-600/10 text-teal-700' },
  Repaid: { label: 'Repaid', cls: 'bg-slate-100 text-slate-500' }
};

export const ROLE = {
  manager: { label: 'Manager', cls: 'bg-teal-600/10 text-teal-700' },
  director: { label: 'Director', cls: 'bg-gold-500/20 text-gold-500' },
  analyst: { label: 'Analyst', cls: 'bg-navy-900/10 text-navy-900' }
};
