import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpenText, FileBarChart2, FolderCheck, LifeBuoy, Bell, LogOut,
  Search, Settings, ScrollText, UsersRound, Command, CheckCheck, ChevronRight, Menu, X, Zap
} from 'lucide-react';
import { api } from './api.js';
import { ToastHost, Spinner, ErrorBoundary, ErrorNote, Chip } from './ui.jsx';
import { useDebounced, useDismiss, useHotkey, usePoll } from './hooks.js';
import { ROLE, initials, fmtAgo, fmtCr } from './format.js';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Borrowers from './pages/Borrowers.jsx';
import BorrowerDetail from './pages/BorrowerDetail.jsx';
import Ledger from './pages/Ledger.jsx';
import Mis from './pages/Mis.jsx';
import Documents from './pages/Documents.jsx';
import Team from './pages/Team.jsx';
import Activity from './pages/Activity.jsx';
import SettingsPage from './pages/Settings.jsx';
import Guide from './pages/Guide.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/borrowers', icon: Users, label: 'Borrowers' },
  { to: '/ledger', icon: BookOpenText, label: 'Ledger' },
  { to: '/mis', icon: FileBarChart2, label: 'MIS' },
  { to: '/documents', icon: FolderCheck, label: 'Documents' },
  { to: '/activity', icon: ScrollText, label: 'Activity' },
  { to: '/team', icon: UsersRound, label: 'Team' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/guide', icon: LifeBuoy, label: 'Guide' }
];

export default function App() {
  const [user, setUser] = useState(undefined);
  const [bootError, setBootError] = useState(null);
  const nav = useNavigate();

  const boot = useCallback(() => {
    api.me().then((u) => { setUser(u); setBootError(null); })
      .catch((e) => { setUser(null); if (e.offline) setBootError(e.message); });
  }, []);
  useEffect(boot, [boot]);

  const logout = async () => {
    try { await api.logout(); } catch (_) { /* clear the client either way */ }
    setUser(null);
    nav('/');
  };

  if (user === undefined) {
    return (
      <div className="grid h-screen place-items-center text-slate-400">
        <div className="flex items-center gap-3 text-sm"><Spinner size={18} /> Connecting to Valuefin Desk…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <ToastHost>
        <Login onAuth={setUser} bootError={bootError} onRetry={boot} />
      </ToastHost>
    );
  }

  return (
    <AuthCtx.Provider value={user}>
      <ToastHost>
        <Shell user={user} onLogout={logout}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/borrowers" element={<Borrowers />} />
              <Route path="/borrowers/:id" element={<BorrowerDetail />} />
              <Route path="/ledger" element={<Ledger />} />
              <Route path="/mis" element={<Mis />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/team" element={<Team />} />
              <Route path="/settings" element={<SettingsPage onLogout={logout} />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </Shell>
      </ToastHost>
    </AuthCtx.Provider>
  );
}

const NotFound = () => (
  <div className="card text-center py-16">
    <p className="h1">404</p>
    <p className="mt-2 text-slate-400">That screen does not exist. Use the sidebar to get back.</p>
  </div>
);

/* ============================================================================
   Shell — sidebar, top bar, notification tray, command palette
   ========================================================================== */
function Shell({ user, onLogout, children }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const loc = useLocation();

  useHotkey('mod+k', () => setPalette(true));
  useEffect(() => { setMobileNav(false); }, [loc.pathname]);

  return (
    <div className="flex min-h-screen">
      {/* ---- sidebar ---- */}
      <aside className={'fixed inset-y-0 left-0 z-40 flex w-[236px] shrink-0 flex-col border-r border-white/10 bg-ink-900/85 backdrop-blur-xl transition-transform lg:static lg:translate-x-0 no-print '
        + (mobileNav ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-[18px]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-indigo to-neon-pink shadow-glow">
            <Zap size={17} className="text-white" fill="currentColor" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[15px] font-bold leading-tight text-white">Valuefin<span className="grad-text"> Desk</span></p>
            <p className="text-[9.5px] uppercase tracking-[.18em] text-slate-500">Lending Ops</p>
          </div>
          <button className="btn btn-ghost btn-icon ml-auto lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={17} /></button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => 'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ' +
                (isActive ? 'bg-white/[.1] font-semibold text-white' : 'text-slate-400 hover:bg-white/[.05] hover:text-slate-200')}>
              {({ isActive }) => (<>
                {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-neon-violet to-neon-pink" />}
                <n.icon size={17} className={isActive ? 'text-neon-violet' : ''} />
                {n.label}
              </>)}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-2xl bg-white/[.05] p-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neon-indigo to-neon-pink font-display text-[13px] font-bold text-white">
              {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{user.name}</p>
              <Chip cls={ROLE[user.role]?.cls}>{ROLE[user.role]?.label || user.role}</Chip>
            </div>
            <button onClick={onLogout} title="Sign out" aria-label="Sign out"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-rose-300"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      {mobileNav && <div className="fixed inset-0 z-30 bg-ink-950/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileNav(false)} />}

      {/* ---- main column ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} onMenu={() => setMobileNav(true)} onSearch={() => setPalette(true)} />
        <main className="mx-auto w-full max-w-[1340px] flex-1 p-4 sm:p-6">{children}</main>
        <footer className="mx-auto w-full max-w-[1340px] px-6 pb-6 pt-2 text-[11px] text-slate-600 no-print">
          Valuefin Desk · internal lending operations · figures computed live from the ledger
        </footer>
      </div>

      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}

/* ---------------- top bar ---------------- */
function TopBar({ user, onMenu, onSearch }) {
  const [unread, setUnread] = useState(0);
  const [tray, setTray] = useState(false);
  usePoll(() => { api.unreadCount().then((d) => setUnread(d.unread)).catch(() => {}); }, 25000);

  /* The dismiss ref wraps the bell as well as the panel — otherwise a click on
     the bell counts as "outside", closes the tray, and the button's own toggle
     immediately reopens it. */
  const trayRef = useDismiss(() => setTray(false), tray);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-ink-950/70 px-4 backdrop-blur-xl sm:px-6 no-print">
      <button className="btn btn-ghost btn-icon lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu size={18} /></button>

      <button onClick={onSearch}
        className="group flex h-10 flex-1 max-w-md items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm text-slate-500 transition hover:border-white/20 hover:bg-white/[.07]">
        <Search size={15} />
        <span className="flex-1 text-left">Search borrowers, drawdowns, documents…</span>
        <span className="hidden items-center gap-0.5 sm:flex">
          <span className="kbd">⌘</span><span className="kbd">K</span>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative" ref={trayRef}>
          <button onClick={() => setTray((t) => !t)} aria-label="Notifications" aria-expanded={tray}
            className={'btn btn-icon relative ' + (unread ? 'animate-pulseRing' : '')}>
            <Bell size={17} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-neon-pink px-1 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {tray && <NotificationTray onClose={() => setTray(false)} onCount={setUnread} />}
        </div>
      </div>
    </header>
  );
}

/* ---------------- notification tray ---------------- */
function NotificationTray({ onClose, onCount }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const nav = useNavigate();
  // Outside-click and Escape are owned by TopBar, whose ref wraps the bell too.

  const load = useCallback(() => {
    api.notifications().then((d) => { setData(d); onCount(d.unread); }).catch((e) => setErr(e.message));
  }, [onCount]);
  useEffect(load, [load]);

  const open = async (n) => {
    if (!n.read) { try { await api.readNotification(n.id); } catch (_) { /* non-blocking */ } }
    onClose();
    if (n.borrowerId) nav('/borrowers/' + n.borrowerId);
    else if (n.docId) nav('/documents');
  };
  const readAll = async () => { try { await api.readAllNotifications(); load(); } catch (_) { /* non-blocking */ } };

  return (
    <div className="absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] animate-popIn overflow-hidden rounded-2xl border border-white/12 bg-ink-850/97 shadow-lift backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="font-display text-sm font-bold text-white">Notifications</p>
        {data?.unread > 0 && <button className="btn btn-xs btn-ghost" onClick={readAll}><CheckCheck size={12} /> Mark all read</button>}
      </div>
      <div className="max-h-[24rem] overflow-y-auto">
        {err && <div className="p-4"><ErrorNote onRetry={load}>{err}</ErrorNote></div>}
        {!err && !data && <p className="p-6 text-center text-sm text-slate-500">Loading…</p>}
        {data && !data.items.length && <p className="p-8 text-center text-sm text-slate-500">Nothing to catch up on.</p>}
        {data?.items.map((n) => (
          <button key={n.id} onClick={() => open(n)}
            className={'flex w-full items-start gap-2.5 border-b border-white/[.06] px-4 py-3 text-left transition last:border-0 hover:bg-white/[.05] ' + (n.read ? '' : 'bg-neon-indigo/[.07]')}>
            <span className={'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ' + (n.read ? 'bg-slate-700' : 'bg-neon-pink')} />
            <span className="min-w-0 flex-1">
              <span className={'block text-[13px] leading-snug ' + (n.read ? 'text-slate-400' : 'text-slate-100')}>{n.message}</span>
              <span className="mt-0.5 block text-[11px] text-slate-600">{fmtAgo(n.createdAt)}</span>
            </span>
            <ChevronRight size={14} className="mt-0.5 shrink-0 text-slate-600" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- command palette ---------------- */
function CommandPalette({ onClose }) {
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 220);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const nav = useNavigate();
  const ref = useDismiss(onClose);

  useEffect(() => {
    if (debounced.trim().length < 2) { setRes(null); return; }
    setBusy(true);
    api.search(debounced.trim()).then(setRes).catch(() => setRes(null)).finally(() => setBusy(false));
  }, [debounced]);

  const pages = NAV
    .filter((n) => !term || n.label.toLowerCase().includes(term.toLowerCase()))
    .map((n) => ({ kind: 'page', label: n.label, sub: 'Go to page', icon: n.icon, to: n.to }));
  const hits = [
    ...pages,
    ...(res?.borrowers || []).map((b) => ({ kind: 'borrower', label: b.name, sub: b.biz || 'Borrower', icon: Users, to: '/borrowers/' + b.id })),
    ...(res?.drawdowns || []).map((d) => ({ kind: 'drawdown', label: d.ref || 'Drawdown #' + d.id, sub: d.borrowerName + ' · ' + fmtCr(d.amount) + ' · ' + d.status, icon: BookOpenText, to: '/borrowers/' + d.borrowerId })),
    ...(res?.documents || []).map((d) => ({ kind: 'document', label: d.title, sub: d.borrowerName + ' · ' + d.status, icon: FolderCheck, to: '/documents' }))
  ];

  const go = (h) => { onClose(); nav(h.to); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(hits.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === 'Enter' && hits[cursor]) { e.preventDefault(); go(hits[cursor]); }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-start justify-center bg-ink-950/80 p-4 pt-[12vh] backdrop-blur-md no-print">
      <div ref={ref} className="w-full max-w-xl animate-popIn overflow-hidden rounded-3xl border border-white/12 bg-ink-850/97 shadow-lift">
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <Search size={17} className="text-slate-500" />
          <input autoFocus value={term} onChange={(e) => { setTerm(e.target.value); setCursor(0); }} onKeyDown={onKey}
            placeholder="Search borrowers, PO references, documents, pages…"
            className="h-14 flex-1 bg-transparent text-[15px] text-slate-100 outline-none placeholder:text-slate-600" />
          {busy && <Spinner className="text-slate-500" />}
          <span className="kbd">esc</span>
        </div>
        <div className="max-h-[22rem] overflow-y-auto p-2">
          {!hits.length && (
            <p className="py-10 text-center text-sm text-slate-500">
              {term.trim().length < 2 ? 'Type at least two characters.' : 'No matches for “' + term + '”.'}
            </p>
          )}
          {hits.map((h, i) => (
            <button key={h.kind + h.to + h.label + i} onClick={() => go(h)} onMouseEnter={() => setCursor(i)}
              className={'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ' + (i === cursor ? 'bg-white/[.1]' : 'hover:bg-white/[.05]')}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.06] text-slate-400"><h.icon size={15} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-100">{h.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{h.sub}</span>
              </span>
              <ChevronRight size={14} className="text-slate-600" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2.5 text-[11px] text-slate-600">
          <span className="flex items-center gap-1"><Command size={11} /> palette</span>
          <span className="ml-auto flex items-center gap-1.5"><span className="kbd">↑</span><span className="kbd">↓</span> navigate</span>
          <span className="flex items-center gap-1.5"><span className="kbd">↵</span> open</span>
        </div>
      </div>
    </div>
  );
}

export { AuthCtx };
