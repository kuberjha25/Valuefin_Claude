import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { X } from 'lucide-react';

const ToastCtx = createContext(() => {});
export function ToastHost({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, isErr) => {
    const id = Math.random();
    setItems((xs) => [...xs, { id, msg: String(msg), isErr }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 w-80">
        {items.map((t) => (
          <div key={t.id} className={'rounded-xl px-3.5 py-2.5 text-sm shadow-lg text-white ' + (t.isErr ? 'bg-rose-600' : 'bg-navy-900')}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const reload = useCallback(() => { fn().then((d) => { setData(d); setErr(null); }).catch((e) => setErr(e.message)); }, deps); // eslint-disable-line
  useEffect(() => { reload(); }, [reload]);
  return [data, reload, err];
}

export const Card = ({ title, right, children, className = '' }) => (
  <div className={'card ' + className}>
    {(title || right) && (
      <div className="flex items-center justify-between mb-4 gap-3">
        {title && <div className="ctitle">{title}</div>}
        {right}
      </div>
    )}
    {children}
  </div>
);

export const Stat = ({ icon: Icon, label, value, sub, tone = 'text-navy-900', accent = 'text-teal-600' }) => (
  <div className="card flex items-start gap-3.5">
    {Icon && <div className="rounded-xl bg-navy-900/5 p-2.5"><Icon size={20} className={accent} /></div>}
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      <div className={'font-display font-extrabold text-2xl leading-tight ' + tone}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  </div>
);

export const Chip = ({ cls = 'bg-slate-100 text-slate-600', children }) => <span className={'chip ' + cls}>{children}</span>;
export const Field = ({ label, children, className = '' }) => (<div className={className}><label className="lbl">{label}</label>{children}</div>);
export const Empty = ({ children }) => <div className="text-sm text-slate-400 py-8 text-center">{children}</div>;

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'bg-white rounded-2xl shadow-2xl w-full my-8 ' + (wide ? 'max-w-4xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div className="font-display font-bold text-navy-900">{title}</div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Table({ cols, rows, render, empty = 'Nothing here yet.' }) {
  if (!rows || !rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr>{cols.map((c, i) => <th key={i} className={c.startsWith('#') ? 'text-right' : ''}>{c.replace(/^#/, '')}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.id ?? i} className="hover:bg-slate-50/70">{render(r, i)}</tr>)}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ r, children, className = '' }) => (<td className={(r ? 'text-right tabular-nums ' : '') + className}>{children}</td>);
