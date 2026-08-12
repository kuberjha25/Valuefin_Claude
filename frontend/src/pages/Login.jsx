import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, Zap } from 'lucide-react';
import { api } from '../api.js';
import { useToast, Spinner, ErrorNote, Chip } from '../ui.jsx';
import { ROLE, initials } from '../format.js';

export default function Login({ onAuth, bootError, onRetry }) {
  const [directory, setDirectory] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  useEffect(() => { api.directory().then(setDirectory).catch(() => setDirectory([])); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true); setError(null);
    try {
      const user = await api.login(email.trim(), password);
      toast('Welcome back, ' + user.name.split(' ')[0] + '.');
      onAuth(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ---- brand panel ---- */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-neon-indigo to-neon-pink shadow-glow">
            <Zap size={20} className="text-white" fill="currentColor" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-white">Valuefin<span className="grad-text"> Desk</span></p>
            <p className="text-[10px] uppercase tracking-[.2em] text-slate-500">Lending Operations</p>
          </div>
        </div>

        <div className="max-w-lg">
          <h1 className="font-display text-[44px] font-bold leading-[1.08] tracking-tight text-white">
            Your book,<br /><span className="grad-text">computed live.</span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-slate-400">
            Borrowers, drawdowns and payments in — ledger, MIS, ageing and IRR out. No spreadsheet
            reconciliation, no hand-written journal entries, no month-end scramble.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3">
            {[
              ['Interest-first waterfall', 'Penal and carried interest settle before principal'],
              ['Auto ledger & MIS', 'Generated from activity, never keyed in'],
              ['Maker–checker on docs', 'Uploads wait for Director approval'],
              ['Full audit trail', 'Every change attributed and timestamped']
            ].map(([t, s]) => (
              <li key={t} className="rounded-2xl border border-white/10 bg-white/[.035] p-3.5">
                <p className="text-[13px] font-semibold text-slate-200">{t}</p>
                <p className="mt-1 text-[11.5px] leading-snug text-slate-500">{s}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-center gap-2 text-[11px] text-slate-600">
          <ShieldCheck size={13} /> Internal system · sessions expire after 12 hours of inactivity
        </p>
      </section>

      {/* ---- sign-in panel ---- */}
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-neon-indigo to-neon-pink shadow-glow">
              <Zap size={22} className="text-white" fill="currentColor" />
            </span>
            <p className="font-display text-xl font-bold text-white">Valuefin<span className="grad-text"> Desk</span></p>
          </div>

          <h2 className="font-display text-2xl font-bold text-white">Sign in</h2>
          <p className="mt-1.5 text-sm text-slate-400">Use your Valuefin work email.</p>

          {bootError && (
            <div className="mt-5"><ErrorNote onRetry={onRetry}>{bootError}</ErrorNote></div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="lbl">Email</span>
              <span className="relative block">
                <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" autoComplete="username" className="inp pl-9" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@valuefin.in" autoFocus />
              </span>
            </label>

            <label className="block">
              <span className="lbl">Password</span>
              <span className="relative block">
                <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type={reveal ? 'text' : 'password'} autoComplete="current-password" className="inp px-9" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setReveal((r) => !r)} tabIndex={-1}
                  aria-label={reveal ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300">
                  {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </span>
            </label>

            {error && <p className="rounded-xl border border-state-bad/30 bg-state-bad/10 px-3 py-2 text-[13px] text-rose-200">{error}</p>}

            <button type="submit" className="btn btn-p w-full py-2.5" disabled={busy}>
              {busy ? <><Spinner /> Signing in…</> : <>Sign in <ArrowRight size={15} /></>}
            </button>
          </form>

          {/* The staff directory is a convenience for an internal desk: it fills the
              email field, never the password. */}
          {directory && directory.length > 0 && (
            <div className="mt-8">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[.12em] text-slate-500">Desk accounts</p>
              <div className="space-y-1.5">
                {directory.map((u) => (
                  <button key={u.id} type="button" onClick={() => { setEmail(u.email); setError(null); }}
                    className={'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ' +
                      (email === u.email ? 'border-neon-indigo/45 bg-neon-indigo/10' : 'border-white/10 bg-white/[.03] hover:border-white/20 hover:bg-white/[.07]')}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[.08] font-display text-[11px] font-bold text-slate-300">
                      {initials(u.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-200">{u.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">{u.email}</span>
                    </span>
                    <Chip cls={ROLE[u.role]?.cls}>{ROLE[u.role]?.label}</Chip>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
