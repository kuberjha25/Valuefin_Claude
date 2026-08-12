import React, { useMemo, useRef, useState } from 'react';
import { Table2, X } from 'lucide-react';
import { fmtCr, fmt } from './format.js';

/* ============================================================================
   Charts — hand-rolled SVG, no charting dependency.

   Colour is taken from the CSS custom properties in index.css, which were
   validated with the data-viz validator against the --surface-chart value
   (#15152a): two categorical slots all-pairs clean in dark mode, and a
   single-hue monotone ordinal ramp for the overdue buckets.

   House rules applied throughout: recessive grid, thin marks, 4px rounded
   data-ends anchored to the baseline, a 2px surface gap between adjacent bars,
   a legend whenever there are two series, values in text tokens rather than
   series colours, a hover layer on every plot, and a table view behind a
   toggle so the numbers are never colour-only.
   ========================================================================== */

const S1 = 'var(--series-1)';
const S2 = 'var(--series-2)';
export const OVERDUE_RAMP = ['var(--od-1)', 'var(--od-2)', 'var(--od-3)', 'var(--od-4)'];
export const GOOD = 'var(--state-good)';

/* rectangle with rounded top corners, flat on the baseline */
function topRounded(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}a${rr},${rr} 0 0 1 ${rr},-${rr}h${w - 2 * rr}a${rr},${rr} 0 0 1 ${rr},${rr}V${y + h}Z`;
}
/* rectangle with rounded right end, flat at the axis */
function rightRounded(x, y, w, h, r = 4) {
  if (w <= 0) return '';
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y}h${w - rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - 2 * rr}a${rr},${rr} 0 0 1 -${rr},${rr}H${x}Z`;
}

const niceCeil = (v) => {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag * 2) / 2 * mag;
};

/* ---------------- shared chrome ---------------- */
export const Legend = ({ items }) => (
  <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
    {items.map((it) => (
      <li key={it.label} className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} aria-hidden="true" />
        {it.label}
      </li>
    ))}
  </ul>
);

function Tooltip({ at, children }) {
  if (!at) return null;
  return (
    <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-white/15 bg-ink-800/95 px-3 py-2 text-xs shadow-lift backdrop-blur"
      style={{ left: at.x, top: at.y - 10 }} role="tooltip">
      {children}
    </div>
  );
}

/* A table view of the same numbers — identity is never colour-only. */
function TableToggle({ open, onToggle }) {
  return (
    <button className="btn btn-xs btn-ghost text-slate-400" onClick={onToggle} aria-expanded={open}>
      {open ? <X size={12} /> : <Table2 size={12} />} {open ? 'Hide table' : 'Table view'}
    </button>
  );
}

const DataTable = ({ head, rows }) => (
  <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-white/10">
    <table className="tbl text-xs">
      <thead><tr>{head.map((h, i) => <th key={i} className={i ? 'text-right' : ''}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'text-right num' : ''}>{c}</td>)}</tr>
      ))}</tbody>
    </table>
  </div>
);

/* ============================================================================
   Grouped columns — disbursed vs collected by month.
   Two measures, same unit and scale, so one shared axis (never a second one).
   ========================================================================== */
export function MonthlyColumns({ data }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const wrap = useRef(null);

  const W = 720, H = 230, PAD = { t: 14, r: 12, b: 30, l: 58 };
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  const max = niceCeil(Math.max(1, ...data.flatMap((d) => [d.disbursed, d.collected])));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
  const slot = plotW / Math.max(1, data.length);
  const barW = Math.min(26, (slot - 14) / 2);
  const y = (v) => PAD.t + plotH - (v / max) * plotH;

  const onMove = (e) => {
    const box = wrap.current.getBoundingClientRect();
    const fx = (e.clientX - box.left) / box.width;
    const i = Math.floor(((fx * W) - PAD.l) / slot);
    if (i < 0 || i >= data.length) return setHover(null);
    setHover({ i, x: ((PAD.l + slot * (i + 0.5)) / W) * box.width, y: (PAD.t / H) * box.height + 8 });
  };

  const empty = data.every((d) => !d.disbursed && !d.collected);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Legend items={[{ label: 'Disbursed', color: S1 }, { label: 'Collected', color: S2 }]} />
        <TableToggle open={showTable} onToggle={() => setShowTable((s) => !s)} />
      </div>

      <div ref={wrap} className="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label={'Monthly disbursed and collected for the last ' + data.length + ' months'}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
              <text x={PAD.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--text-muted)" className="num">
                {t === 0 ? '0' : fmtCr(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD.l + slot * i + slot / 2;
            const on = hover?.i === i;
            return (
              <g key={d.month} opacity={hover && !on ? 0.45 : 1} className="transition-opacity">
                {/* the 2px surface gap between the pair is the 1px offset each side of centre */}
                <path d={topRounded(cx - barW - 1, y(d.disbursed), barW, PAD.t + plotH - y(d.disbursed))} fill={S1} />
                <path d={topRounded(cx + 1, y(d.collected), barW, PAD.t + plotH - y(d.collected))} fill={S2} />
                <text x={cx} y={H - 10} textAnchor="middle" fontSize="10.5" fill="var(--text-secondary)">{d.label}</text>
              </g>
            );
          })}

          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} stroke="rgba(255,255,255,.16)" strokeWidth="1" />
        </svg>

        {hover && (
          <Tooltip at={hover}>
            <p className="mb-1 font-semibold text-slate-200">{data[hover.i].label}</p>
            <p className="flex items-center gap-2 text-slate-400">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: S1 }} />Disbursed
              <span className="num ml-auto pl-3 text-slate-200">{fmt(data[hover.i].disbursed)}</span>
            </p>
            <p className="flex items-center gap-2 text-slate-400">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: S2 }} />Collected
              <span className="num ml-auto pl-3 text-slate-200">{fmt(data[hover.i].collected)}</span>
            </p>
            <p className="mt-1 border-t border-white/10 pt-1 text-slate-500">
              of which interest <span className="num text-slate-300">{fmt(data[hover.i].interest)}</span>
            </p>
          </Tooltip>
        )}

        {empty && (
          <p className="absolute inset-0 grid place-items-center text-sm text-slate-500">No activity in this window yet.</p>
        )}
      </div>

      {showTable && (
        <DataTable head={['Month', 'Disbursed', 'Collected', 'Interest']}
          rows={data.map((d) => [d.label + ' ' + d.month.slice(0, 4), fmt(d.disbursed), fmt(d.collected), fmt(d.interest)])} />
      )}
    </div>
  );
}

/* ============================================================================
   Ageing — one ordered severity dimension, so a single-hue ordinal ramp for the
   overdue buckets and the status "good" step for anything still within tenure.
   Every bar carries its own label, so colour is reinforcement, not the message.
   ========================================================================== */
export function AgeingBars({ buckets }) {
  const [showTable, setShowTable] = useState(false);
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  const max = Math.max(1, ...buckets.map((b) => b.amount));
  const colourFor = (i) => (i === 0 ? GOOD : OVERDUE_RAMP[i - 1]);

  if (!total) {
    return <p className="py-8 text-center text-sm text-slate-500">Nothing outstanding — no ageing to report.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <TableToggle open={showTable} onToggle={() => setShowTable((s) => !s)} />
      </div>
      <ul className="space-y-3">
        {buckets.map((b, i) => (
          <li key={b.key} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colourFor(i) }} aria-hidden="true" />
                {b.label}
                {b.count > 0 && <span className="text-slate-500">· {b.count}</span>}
              </span>
              <span className="num text-slate-200">{b.amount ? fmt(b.amount) : '—'}</span>
            </div>
            <svg viewBox="0 0 400 10" className="w-full" preserveAspectRatio="none" role="img"
              aria-label={b.label + ': ' + fmt(b.amount)} style={{ height: 10 }}>
              <rect x="0" y="0" width="400" height="10" rx="5" fill="rgba(255,255,255,.05)" />
              <path d={rightRounded(0, 0, (b.amount / max) * 400, 10, 5)} fill={colourFor(i)} />
            </svg>
          </li>
        ))}
      </ul>
      {showTable && (
        <DataTable head={['Bucket', 'Drawdowns', 'Outstanding', 'Share']}
          rows={buckets.map((b) => [b.label, b.count, fmt(b.amount), ((b.amount / total) * 100).toFixed(1) + '%'])} />
      )}
    </div>
  );
}

/* ============================================================================
   Top exposures — one series, so one colour and no legend; the title names it.
   ========================================================================== */
export function ExposureBars({ rows, onSelect }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...rows.map((r) => r.outstanding));
  if (!rows.length) return <p className="py-8 text-center text-sm text-slate-500">No exposure on the book.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.borrowerId}>
          <button className="group w-full text-left" onClick={() => onSelect?.(r.borrowerId)}
            onMouseEnter={() => setHover(r.borrowerId)} onMouseLeave={() => setHover(null)}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-slate-200 group-hover:text-white">{r.name}</span>
              <span className="num shrink-0 text-sm text-slate-300">{fmtCr(r.outstanding)}</span>
            </div>
            <svg viewBox="0 0 400 8" className="w-full" preserveAspectRatio="none" style={{ height: 8 }} role="img"
              aria-label={r.name + ' outstanding ' + fmt(r.outstanding)}>
              <rect x="0" y="0" width="400" height="8" rx="4" fill="rgba(255,255,255,.05)" />
              <path d={rightRounded(0, 0, (r.outstanding / max) * 400, 8, 4)} fill={S1}
                opacity={hover && hover !== r.borrowerId ? 0.5 : 1} />
            </svg>
            <p className="mt-1 text-[11px] text-slate-500">
              {r.utilPct}% of {fmtCr(r.limit)} limit · {r.activeDrawdowns} active
              {r.overdueDays > 0 && <span className="text-rose-300"> · {r.overdueDays}d overdue</span>}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ============================================================================
   Sparkline for stat tiles — one series, no axis, no legend. Decorative
   support for the headline number it sits under, never the primary read.
   ========================================================================== */
export function Sparkline({ values, color = S1, height = 34 }) {
  const path = useMemo(() => {
    const v = values.length ? values : [0];
    const max = Math.max(...v, 1), min = Math.min(...v, 0);
    const span = max - min || 1;
    const W = 100, H = 30;
    const pts = v.map((n, i) => [(i / Math.max(1, v.length - 1)) * W, H - ((n - min) / span) * H]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
    return { line, area: line + ` L${W},${H} L0,${H} Z` };
  }, [values]);

  const gid = 'spark-' + useMemo(() => Math.random().toString(36).slice(2, 8), []);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ height }} className="w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#${gid})`} />
      <path d={path.line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ============================================================================
   Utilisation ring — a single headline value, so it is a figure, not a chart:
   no legend, no axis, the number carries the meaning and the arc supports it.
   ========================================================================== */
export function UtilRing({ value, size = 132, label = 'Utilised' }) {
  const pctVal = Math.max(0, Math.min(100, +value || 0));
  const r = (size - 16) / 2, c = 2 * Math.PI * r;
  const tone = pctVal >= 95 ? 'var(--od-4)' : pctVal >= 80 ? '#c99a00' : S1;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={label + ' ' + pctVal + '%'}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="9" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pctVal / 100)}
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.2,.9,.3,1)' }} />
      </svg>
      <div className="absolute text-center">
        <p className="font-display text-2xl font-bold text-white num">{pctVal.toFixed(0)}%</p>
        <p className="text-[10px] uppercase tracking-[.12em] text-slate-500">{label}</p>
      </div>
    </div>
  );
}
