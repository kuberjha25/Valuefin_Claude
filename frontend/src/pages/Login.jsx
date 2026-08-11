import React from 'react';
import { Landmark, PencilLine, ShieldCheck, LineChart } from 'lucide-react';
import { api } from '../api.js';
import { useLoad, useToast } from '../ui.jsx';
import { ROLE } from '../format.js';

const BLURB = {
  manager: { icon: PencilLine, text: 'Onboard borrowers, record drawdowns & payments, upload documents.' },
  director: { icon: ShieldCheck, text: 'Full operations plus approving or rejecting uploaded documents.' },
  analyst: { icon: LineChart, text: 'Read-only — review the ledger, MIS and portfolio.' }
};

export default function Login({ onAuth }) {
  const [users] = useLoad(() => api.get('/users'), []);
  const toast = useToast();
  const pick = async (u) => { try { onAuth(await api.post('/login', { userId: u.id })); } catch (e) { toast(e.message, true); } };
  return (
    <div className="min-h-screen bg-navy-950 grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="inline-flex rounded-2xl bg-gold-500/15 p-3 mb-3"><Landmark size={36} className="text-gold-400" /></div>
          <h1 className="font-display font-extrabold text-3xl text-white">Valuefin Desk</h1>
          <p className="text-slate-400 text-sm mt-1">Internal lending operations — borrowers, ledger, MIS & documents</p>
        </div>
        <div className="space-y-2.5">
          {(users || []).map((u) => {
            const b = BLURB[u.role] || {}; const Icon = b.icon || Landmark;
            return (
              <button key={u.id} onClick={() => pick(u)}
                className="w-full flex items-center gap-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold-400/40 px-4 py-3.5 text-left transition group">
                <div className="rounded-xl bg-white/10 p-2.5 group-hover:bg-gold-500/20"><Icon size={20} className="text-gold-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-semibold text-white">{u.name}</span><span className={'chip ' + (ROLE[u.role]?.cls || '')}>{ROLE[u.role]?.label || u.role}</span></div>
                  <div className="text-xs text-slate-400 mt-0.5">{b.text}</div>
                </div>
              </button>
            );
          })}
          {!users && <div className="text-sm text-slate-400 py-4 text-center">Waiting for the API on :4000…</div>}
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">New here? Sign in and open the <span className="text-slate-300">Guide</span> from the sidebar.</p>
      </div>
    </div>
  );
}
