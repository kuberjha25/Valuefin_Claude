/* Formatting + the shared status/role vocabularies. */

export const today = () => new Date().toISOString().slice(0, 10);

/* Indian digit grouping: ₹12,34,56,789 */
export const fmt = (n, dp = 0) => {
  const x = +n || 0;
  const neg = x < 0 ? '-' : '';
  const abs = Math.abs(x);
  const fixed = abs.toFixed(dp);
  const [whole, frac] = fixed.split('.');
  let s = whole;
  if (s.length > 3) {
    s = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
  }
  return '₹' + neg + s + (frac ? '.' + frac : '');
};

/* Compact for headline tiles: ₹1.25 Cr / ₹4.5 L */
export const fmtCr = (n) => {
  const x = +n || 0;
  const a = Math.abs(x);
  if (a >= 1e7) return '₹' + (x / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
  if (a >= 1e5) return '₹' + (x / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
  return fmt(x);
};

export const fmtNum = (n) => (+n || 0).toLocaleString('en-IN');

export const fmtDate = (iso, withTime = false) => {
  if (!iso) return '—';
  const s = String(iso);
  const d = new Date(s.slice(0, 10) + 'T00:00:00');
  if (isNaN(d)) return s.slice(0, 10);
  const out = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return withTime && s.length >= 16 ? out + ' · ' + s.slice(11, 16) : out;
};

export const fmtAgo = (iso) => {
  if (!iso) return '—';
  const then = new Date(String(iso).replace(' ', 'T'));
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (isNaN(mins)) return '—';
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  if (mins < 1440) return Math.round(mins / 60) + 'h ago';
  if (mins < 10080) return Math.round(mins / 1440) + 'd ago';
  return fmtDate(iso);
};

export const pct = (n, dp = 1) => (n == null || isNaN(n) ? '—' : (+n).toFixed(dp) + '%');
export const fmtBytes = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
export const initials = (name) => String(name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const STATUS = {
  pending: { label: 'Pending review', cls: 'chip-warn' },
  approved: { label: 'Approved', cls: 'chip-good' },
  rejected: { label: 'Rejected', cls: 'chip-bad' },
  Open: { label: 'Open', cls: 'chip-cyan' },
  Repaid: { label: 'Repaid', cls: 'chip-slate' },
  active: { label: 'Active', cls: 'chip-good' },
  closed: { label: 'Closed', cls: 'chip-slate' }
};

export const ROLE = {
  director: { label: 'Director', cls: 'chip-pink', blurb: 'Full operations, document approval, limits, team and data controls.' },
  manager: { label: 'Manager', cls: 'chip-violet', blurb: 'Borrowers, drawdowns, payments and document uploads.' },
  analyst: { label: 'Analyst', cls: 'chip-cyan', blurb: 'Read-only — dashboard, ledger, MIS and documents.' }
};

export const PRODUCT = {
  po: { label: 'PO Finance', cls: 'chip-violet' },
  io: { label: 'Interest-Only', cls: 'chip-cyan' }
};

export const ADV_MODES = [
  ['none', 'None'],
  ['30d', '30 days (daily rate)'],
  ['1m', '1 month'],
  ['2m', '2 months'],
  ['custom', 'Custom days']
];

/* Mirrors calc.advance() on the server so the disbursal preview updates as the
   user types, without a round trip. The server value is always authoritative. */
export const advPreview = (amt, rate, mode, cd) => {
  const a = +amt || 0, r = +rate || 0, dr = r / 100 / 365;
  if (mode === 'none') return { adv: 0, ad: 0 };
  if (mode === '30d') return { adv: a * dr * 30, ad: 30 };
  if (mode === '1m') return { adv: a * (r / 100 / 12), ad: 30 };
  if (mode === '2m') return { adv: a * (r / 100 / 12) * 2, ad: 61 };
  const d = +cd || 30;
  return { adv: a * dr * d, ad: d };
};
