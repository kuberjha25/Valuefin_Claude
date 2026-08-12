import { useCallback, useEffect, useRef, useState } from 'react';

/* Data loader with explicit loading/error states, a manual reload, and a guard
   so a slow response from a previous query cannot overwrite a newer one. */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const run = useRef(0);
  const alive = useRef(true);
  /* Set on mount as well as cleared on unmount. StrictMode runs effects
     mount → cleanup → mount in dev; without the re-arm the flag would stay
     false after that first simulated unmount and every response would be
     discarded, leaving the component loading forever. */
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const reload = useCallback(() => {
    const id = ++run.current;
    setLoading(true);
    return Promise.resolve()
      .then(fn)
      .then((d) => { if (alive.current && id === run.current) { setData(d); setError(null); } return d; })
      .catch((e) => { if (alive.current && id === run.current) setError(e.message || String(e)); })
      .finally(() => { if (alive.current && id === run.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

/* Debounced mirror of a value — used by search boxes so each keystroke does not
   hit the API. */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/* Global keyboard shortcut. `combo` looks like "mod+k" or "escape". */
export function useHotkey(combo, handler, enabled = true) {
  const cb = useRef(handler);
  cb.current = handler;
  useEffect(() => {
    if (!enabled) return undefined;
    const parts = combo.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const wantMod = parts.includes('mod');
    const wantShift = parts.includes('shift');
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (wantMod !== mod) return;
      if (wantShift && !e.shiftKey) return;
      if (e.key.toLowerCase() !== key) return;
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (typing && !wantMod && key !== 'escape') return;
      e.preventDefault();
      cb.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, enabled]);
}

/* Close-on-outside-click / Escape for dropdowns and popovers. */
export function useDismiss(onDismiss, active = true) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onDismiss(); };
    const onKey = (e) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onDismiss, active]);
  return ref;
}

/* Poll a function on an interval, pausing while the tab is hidden. */
export function usePoll(fn, ms) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    let id = null;
    const tick = () => { if (!document.hidden) cb.current(); };
    tick();
    id = setInterval(tick, ms);
    const onVis = () => { if (!document.hidden) cb.current(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [ms]);
}

/* Persisted UI preference (table density, last filter, …). */
export function useLocal(key, initial) {
  const [v, setV] = useState(() => {
    try { const raw = localStorage.getItem('vf.' + key); return raw == null ? initial : JSON.parse(raw); }
    catch (_) { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem('vf.' + key, JSON.stringify(v)); } catch (_) { /* private mode */ }
  }, [key, v]);
  return [v, setV];
}
