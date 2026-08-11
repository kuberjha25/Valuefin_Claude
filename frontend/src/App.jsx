import React, { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpenText, FileBarChart2, FolderCheck, LifeBuoy, Bell, LogOut, Landmark } from 'lucide-react';
import { api } from './api.js';
import { ToastHost } from './ui.jsx';
import { ROLE } from './format.js';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Borrowers from './pages/Borrowers.jsx';
import BorrowerDetail from './pages/BorrowerDetail.jsx';
import Ledger from './pages/Ledger.jsx';
import Mis from './pages/Mis.jsx';
import Documents from './pages/Documents.jsx';
import Guide from './pages/Guide.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/borrowers', icon: Users, label: 'Borrowers' },
  { to: '/ledger', icon: BookOpenText, label: 'Ledger' },
  { to: '/mis', icon: FileBarChart2, label: 'MIS Reports' },
  { to: '/documents', icon: FolderCheck, label: 'Documents' },
  { to: '/guide', icon: LifeBuoy, label: 'Guide' }
];

export default function App() {
  const [user, setUser] = useState(undefined);
  const nav = useNavigate();
  useEffect(() => { api.get('/me').then(setUser).catch(() => setUser(null)); }, []);
  const logout = async () => { await api.post('/logout', {}); setUser(null); nav('/'); };

  if (user === undefined) return <div className="h-screen grid place-items-center text-slate-400">Connecting to Valuefin Desk…</div>;
  if (!user) return <ToastHost><Login onAuth={setUser} /></ToastHost>;

  return (
    <AuthCtx.Provider value={user}>
      <ToastHost>
        <div className="flex min-h-screen">
          <aside className="w-60 shrink-0 bg-navy-950 text-slate-300 flex flex-col">
            <div className="px-5 py-5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-gold-500/15 p-1.5"><Landmark size={20} className="text-gold-400" /></div>
                <div>
                  <div className="font-display font-extrabold text-white leading-tight">Valuefin Desk</div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">Lending Ops · Internal</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 py-3">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'}
                  className={({ isActive }) => 'flex items-center gap-3 mx-3 my-0.5 px-3 py-2.5 rounded-xl text-sm transition ' + (isActive ? 'bg-white/10 text-white font-semibold' : 'hover:bg-white/5')}>
                  <n.icon size={17} /> {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="px-4 py-4 border-t border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-gold-500/20 grid place-items-center font-display font-bold text-gold-400">
                  {user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white text-sm font-semibold truncate">{user.name}</div>
                  <span className={'chip ' + (ROLE[user.role]?.cls || '')}>{ROLE[user.role]?.label || user.role}</span>
                </div>
                <button onClick={logout} title="Log out" className="text-slate-400 hover:text-white"><LogOut size={16} /></button>
              </div>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            <Header />
            <main className="flex-1 p-6 max-w-[1240px] w-full">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/borrowers" element={<Borrowers />} />
                <Route path="/borrowers/:id" element={<BorrowerDetail />} />
                <Route path="/ledger" element={<Ledger />} />
                <Route path="/mis" element={<Mis />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/guide" element={<Guide />} />
              </Routes>
            </main>
          </div>
        </div>
      </ToastHost>
    </AuthCtx.Provider>
  );
}

function Header() {
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);
  const poll = () => api.get('/notifications').then((d) => setUnread(d.unread)).catch(() => {});
  useEffect(() => { poll(); const id = setInterval(poll, 20000); return () => clearInterval(id); }, []);
  return (
    <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-end px-6 gap-3">
      <button onClick={() => { nav('/documents'); setTimeout(poll, 400); }}
        className="relative rounded-xl border border-slate-300 h-10 w-10 grid place-items-center hover:bg-slate-50" title="Notifications">
        <Bell size={18} className="text-navy-900" />
        {unread > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-bold grid place-items-center">{unread > 9 ? '9+' : unread}</span>}
      </button>
    </header>
  );
}

export { AuthCtx };
