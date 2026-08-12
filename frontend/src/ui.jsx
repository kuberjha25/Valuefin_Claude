import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Info, Loader2, Search, X } from 'lucide-react';

/* ============================================================================
   The shared UI kit. Every page is assembled from these, so spacing, focus
   rings, empty states and error copy stay identical across the app.
   ========================================================================== */

/* ---------------- toasts ---------------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs.slice(-3), { id, msg: String(msg), tone: tone === true ? 'err' : tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 5000);
  }, []);
  const drop = (id) => setItems((xs) => xs.filter((x) => x.id !== id));

  const ICON = { ok: Check, err: AlertTriangle, info: Info };
  const TONE = {
    ok: 'border-state-good/40 bg-[#0d1b16]/95 text-emerald-200',
    err: 'border-state-bad/45 bg-[#1e1013]/95 text-rose-200',
    info: 'border-neon-indigo/40 bg-[#12122a]/95 text-slate-200'
  };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] w-[22rem] max-w-[calc(100vw-2.5rem)] space-y-2.5 no-print" role="status" aria-live="polite">
        {items.map((t) => {
          const Icon = ICON[t.tone] || Info;
          return (
            <div key={t.id} className={'animate-slideIn flex items-start gap-2.5 rounded-2xl border backdrop-blur-xl px-3.5 py-3 text-sm shadow-lift ' + (TONE[t.tone] || TONE.info)}>
              <Icon size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1 leading-snug">{t.msg}</span>
              <button onClick={() => drop(t.id)} className="text-current/50 hover:text-current" aria-label="Dismiss"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- layout primitives ---------------- */
export const Card = ({ title, subtitle, right, children, className = '', bare = false }) => (
  <section className={(bare ? '' : 'card ') + className}>
    {(title || right) && (
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          {title && <h2 className="ctitle">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
      </header>
    )}
    {children}
  </section>
);

export const PageHead = ({ icon: Icon, title, subtitle, children }) => (
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="min-w-0">
      <h1 className="h1 flex items-center gap-2.5">
        {Icon && (
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-neon-indigo/15 border border-neon-indigo/25">
            <Icon size={18} className="text-neon-violet" />
          </span>
        )}
        {title}
      </h1>
      {subtitle && <p className="text-sm text-slate-400 mt-1.5 max-w-2xl">{subtitle}</p>}
    </div>
    {children && <div className="flex flex-wrap items-center gap-2 no-print">{children}</div>}
  </div>
);

export const Field = ({ label, hint, error, children, className = '' }) => (
  <label className={'block ' + className}>
    <span className="lbl">{label}</span>
    {children}
    {error ? <span className="mt-1 block text-[11px] text-rose-300">{error}</span>
      : hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
  </label>
);

export const Chip = ({ cls = 'chip-slate', children, className = '' }) => (
  <span className={cls + ' ' + className}>{children}</span>
);

export const KV = ({ k, v, tone = 'text-slate-200' }) => (
  <div className="kv"><span className="text-slate-400">{k}</span><span className={'num ' + tone}>{v}</span></div>
);

/* ---------------- states ---------------- */
export const Empty = ({ icon: Icon = Search, title = 'Nothing here yet', children, action }) => (
  <div className="py-12 text-center">
    <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/[.05] border border-white/10">
      <Icon size={20} className="text-slate-500" />
    </span>
    <p className="font-display font-semibold text-slate-300">{title}</p>
    {children && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{children}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export const ErrorNote = ({ children, onRetry }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-state-bad/30 bg-state-bad/[.08] px-4 py-3">
    <AlertTriangle size={17} className="mt-0.5 shrink-0 text-rose-300" />
    <div className="flex-1 text-sm text-rose-100">{children}</div>
    {onRetry && <button className="btn btn-xs" onClick={onRetry}>Retry</button>}
  </div>
);

export const Skeleton = ({ className = 'h-4 w-full' }) => <div className={'skel ' + className} />;

export const SkeletonRows = ({ rows = 5, cols = 5 }) => (
  <div className="space-y-2.5" aria-hidden="true">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-3">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className={'h-8 ' + (c === 0 ? 'w-1/4' : 'flex-1')} />
        ))}
      </div>
    ))}
  </div>
);

export const Spinner = ({ size = 16, className = '' }) => (
  <Loader2 size={size} className={'animate-spin ' + className} />
);

/* ---------------- stat tiles ---------------- */
export const Stat = ({ icon: Icon, label, value, sub, accent = 'violet', chart, className = '' }) => {
  const ACCENT = {
    violet: 'from-neon-indigo/25 to-transparent text-neon-violet',
    cyan: 'from-neon-cyan/20 to-transparent text-neon-cyan',
    pink: 'from-neon-pink/20 to-transparent text-neon-pink',
    lime: 'from-neon-lime/20 to-transparent text-neon-lime',
    amber: 'from-neon-amber/20 to-transparent text-neon-amber'
  }[accent] || '';
  return (
    <div className={'card card-hover edge-glow relative overflow-hidden ' + className}>
      <div className={'pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br blur-2xl opacity-60 ' + ACCENT} />
      <div className="relative flex items-start gap-3">
        {Icon && (
          <span className={'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.06] border border-white/10 ' + ACCENT.split(' ').pop()}>
            <Icon size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">{label}</p>
          <p className="font-display text-2xl font-bold leading-tight text-white num mt-0.5">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
      {chart && <div className="relative mt-3">{chart}</div>}
    </div>
  );
};

/* A slim horizontal meter — utilisation, progress, share of limit. */
export const Meter = ({ value, max = 100, tone, label }) => {
  const pctVal = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const colour = tone || (pctVal >= 95 ? 'bg-state-bad' : pctVal >= 80 ? 'bg-neon-amber' : 'bg-gradient-to-r from-neon-indigo to-neon-cyan');
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[.08]">
        <div className={'h-full rounded-full transition-[width] duration-700 ' + colour} style={{ width: pctVal + '%' }} />
      </div>
      {label && <p className="mt-1.5 text-[11px] text-slate-500">{label}</p>}
    </div>
  );
};

/* ---------------- tabs ---------------- */
export const Tabs = ({ tabs, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5" role="tablist">
    {tabs.map(([key, label, count]) => (
      <button key={key} role="tab" aria-selected={value === key}
        className={'tab ' + (value === key ? 'tab-on' : '')} onClick={() => onChange(key)}>
        {label}
        {count != null && <span className="ml-1.5 opacity-50 num">{count}</span>}
      </button>
    ))}
  </div>
);

/* ---------------- modal ---------------- */
export function Modal({ title, subtitle, onClose, children, footer, size = 'md' }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector('input,select,textarea,button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size] || 'max-w-xl';
  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-md no-print"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={title}>
      <div ref={ref} className={'animate-popIn my-8 w-full rounded-3xl border border-white/12 bg-ink-850/95 shadow-lift ' + width}>
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-icon shrink-0" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </header>
        <div className="px-5 py-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

/* Confirmation dialog. `danger` turns the primary action red; `phrase` demands
   the user type an exact word first (used for destructive resets). */
export function Confirm({ title, children, confirmLabel = 'Confirm', danger, phrase, busy, onCancel, onConfirm }) {
  const [typed, setTyped] = useState('');
  const blocked = phrase ? typed.trim().toUpperCase() !== phrase.toUpperCase() : false;
  return (
    <Modal title={title} onClose={onCancel} size="sm"
      footer={<>
        <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={'btn ' + (danger ? 'btn-d' : 'btn-p')} onClick={onConfirm} disabled={blocked || busy}>
          {busy && <Spinner />}{confirmLabel}
        </button>
      </>}>
      <div className="text-sm leading-relaxed text-slate-300">{children}</div>
      {phrase && (
        <div className="mt-4">
          <Field label={'Type ' + phrase + ' to confirm'}>
            <input className="inp font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={phrase} autoFocus />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- table ---------------- */
/* `cols` entries are strings; a leading '#' right-aligns the column. */
export function Table({ cols, rows, render, empty, loading, footer }) {
  if (loading) return <SkeletonRows rows={5} cols={Math.min(cols.length, 6)} />;
  if (!rows || !rows.length) return typeof empty === 'string' ? <Empty>{empty}</Empty> : (empty || <Empty />);
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="tbl">
        <thead>
          <tr>{cols.map((c, i) => (
            <th key={i} className={c.startsWith('#') ? 'text-right' : ''}>{c.replace(/^#/, '')}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <tr key={r.id ?? i}>{render(r, i)}</tr>)}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

/* `r` = right-align + tabular numerals. */
export const Td = ({ r, children, className = '', ...rest }) => (
  <td className={(r ? 'text-right num ' : '') + className} {...rest}>{children}</td>
);

/* ---------------- error boundary ---------------- */
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('[ui] render error', err, info); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="card m-6">
        <ErrorNote onRetry={() => this.setState({ err: null })}>
          <b>Something broke while rendering this screen.</b>
          <div className="mt-1 font-mono text-xs opacity-80">{String(this.state.err.message || this.state.err)}</div>
        </ErrorNote>
      </div>
    );
  }
}
