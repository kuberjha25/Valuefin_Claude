import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon, KeyRound, MonitorSmartphone, Database, ShieldAlert, LogOut, Server, Check
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Confirm, ErrorNote, Field, KV, PageHead, Spinner, Table, Td, useToast } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { ROLE, initials, fmtAgo, fmtDate, fmtNum } from '../format.js';

export default function Settings({ onLogout }) {
  const me = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const isDirector = me.role === 'director';

  const { data: sessions, reload: reloadSessions } = useLoad(() => api.sessions(), []);
  const { data: status, error: statusError, reload: reloadStatus } = useLoad(() => api.status(), []);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const pwMismatch = pw.next && pw.confirm && pw.next !== pw.confirm;
  const pwWeak = pw.next && (pw.next.length < 8 || !/[A-Za-z]/.test(pw.next) || !/[0-9]/.test(pw.next));

  const changePassword = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    try {
      await api.changePassword(pw.current, pw.next);
      toast('Password changed. Your other sessions have been signed out.');
      setPw({ current: '', next: '', confirm: '' });
      reloadSessions();
    } catch (err) { toast(err.message, 'err'); }
    finally { setPwBusy(false); }
  };

  const revokeOthers = async () => {
    try { const r = await api.revokeOtherSessions(); toast('Signed out of ' + r.revoked + ' other session(s).'); reloadSessions(); }
    catch (e) { toast(e.message, 'err'); }
  };

  const resetData = async () => {
    setResetBusy(true);
    try {
      await api.resetData();
      toast('All business data reset to the reference example.');
      setConfirmReset(false);
      nav('/borrowers');
    } catch (e) { toast(e.message, 'err'); }
    finally { setResetBusy(false); }
  };

  return (
    <div className="space-y-5">
      <PageHead icon={SettingsIcon} title="Settings" subtitle="Your account, your sessions, and — for a Director — the system controls." />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---- profile ---- */}
        <Card title="Your account">
          <div className="flex items-center gap-3.5">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-neon-indigo to-neon-pink font-display text-lg font-bold text-white">
              {initials(me.name)}
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-white">{me.name}</p>
              <p className="text-sm text-slate-400">{me.email}</p>
              <div className="mt-1.5"><Chip cls={ROLE[me.role].cls}>{ROLE[me.role].label}</Chip></div>
            </div>
          </div>
          <div className="mt-4">
            <KV k="Last sign-in" v={me.lastLoginAt ? fmtDate(me.lastLoginAt, true) : '—'} />
            <KV k="Account created" v={fmtDate(me.createdAt)} />
            <KV k="What you can do" v="" />
          </div>
          <p className="-mt-1 text-[12px] leading-snug text-slate-400">{ROLE[me.role].blurb}</p>
          <button className="btn mt-4 w-full" onClick={onLogout}><LogOut size={15} /> Sign out</button>
        </Card>

        {/* ---- password ---- */}
        <Card title="Change password" subtitle="Your other sessions are signed out when the password changes.">
          <form onSubmit={changePassword} className="space-y-3">
            <Field label="Current password">
              <input type="password" autoComplete="current-password" className="inp" value={pw.current}
                onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))} />
            </Field>
            <Field label="New password" error={pwWeak ? 'At least 8 characters, with a letter and a number.' : null}>
              <input type="password" autoComplete="new-password" className="inp" value={pw.next}
                onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} />
            </Field>
            <Field label="Confirm new password" error={pwMismatch ? 'The two passwords do not match.' : null}>
              <input type="password" autoComplete="new-password" className="inp" value={pw.confirm}
                onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} />
            </Field>
            <button type="submit" className="btn btn-p w-full"
              disabled={pwBusy || !pw.current || !pw.next || pwMismatch || pwWeak}>
              {pwBusy ? <><Spinner /> Updating…</> : <><KeyRound size={15} /> Change password</>}
            </button>
          </form>
        </Card>
      </div>

      {/* ---- sessions ---- */}
      <Card title="Active sessions" subtitle="Every device currently signed in as you."
        right={sessions && sessions.length > 1 && <button className="btn btn-xs" onClick={revokeOthers}>Sign out everywhere else</button>}>
        <Table cols={['Device', 'IP', 'Started', 'Last seen', 'Expires', '']} rows={sessions || []} empty="No active sessions."
          render={(s) => (
            <>
              <td className="max-w-[22rem] truncate text-slate-300" title={s.userAgent}>
                <MonitorSmartphone size={14} className="mr-1.5 inline text-slate-500" />
                {deviceLabel(s.userAgent)}
              </td>
              <Td className="font-mono text-[11px] text-slate-500">{s.ip || '—'}</Td>
              <Td className="whitespace-nowrap text-slate-500">{fmtAgo(s.createdAt)}</Td>
              <Td className="whitespace-nowrap text-slate-500">{fmtAgo(s.lastSeenAt)}</Td>
              <Td className="whitespace-nowrap text-slate-500">{fmtDate(s.expiresAt, true)}</Td>
              <Td>{s.current && <Chip cls="chip-good"><Check size={11} /> this device</Chip>}</Td>
            </>
          )} />
      </Card>

      {/* ---- system ---- */}
      <Card title="System" subtitle="Where the data lives and how much of it there is.">
        {statusError ? <ErrorNote onRetry={reloadStatus}>{statusError}</ErrorNote> : !status ? (
          <p className="py-4 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <Database size={12} /> Database
              </p>
              <KV k="Engine" v={status.database.engine} />
              <KV k="Schema" v={status.database.name} />
              <KV k="Host" v={status.database.host} />
              <KV k="On-disk size" v={fmtNum(status.database.sizeKb) + ' KB'} />
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <Server size={12} /> Server
              </p>
              <KV k="Environment" v={status.server.env} />
              <KV k="Node" v={status.server.node} />
              <KV k="Uptime" v={Math.floor(status.server.uptimeSec / 60) + 'm ' + (status.server.uptimeSec % 60) + 's'} />
              <KV k="Session lifetime" v={status.server.sessionTtlHours + ' hours'} />
            </div>
            <div className="md:col-span-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Records</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {Object.entries(status.counts).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2">
                    <p className="num font-display text-lg font-bold text-white">{fmtNum(v)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{k.replace(/([A-Z])/g, ' $1')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ---- danger zone ---- */}
      {isDirector && (
        <Card className="!border-state-bad/25" title="Danger zone">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex max-w-2xl items-start gap-2.5">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-rose-300" />
              <p className="text-sm leading-relaxed text-slate-400">
                Wipe every borrower, drawdown, payment, limit entry, document and notification, and restore only the
                PML reference example. <b className="text-slate-200">Staff accounts and the activity trail are kept</b>,
                so the reset itself stays on the record.
              </p>
            </div>
            <button className="btn btn-d shrink-0" onClick={() => setConfirmReset(true)}>Reset all data</button>
          </div>
        </Card>
      )}

      {confirmReset && (
        <Confirm danger busy={resetBusy} phrase="RESET" title="Reset all business data?" confirmLabel="Reset everything"
          onCancel={() => setConfirmReset(false)} onConfirm={resetData}>
          This permanently deletes every borrower, drawdown, payment, limit entry and uploaded PDF, and restores the PML
          reference example. It cannot be undone.
        </Confirm>
      )}
    </div>
  );
}

/* A readable name for a user-agent string, without pulling in a parser. */
function deviceLabel(ua = '') {
  const s = String(ua);
  const browser = /Edg\//.test(s) ? 'Edge' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari'
    : /Firefox\//.test(s) ? 'Firefox' : /curl/i.test(s) ? 'curl' : 'Browser';
  const os = /iPhone|iPad/.test(s) ? 'iOS' : /Android/.test(s) ? 'Android' : /Mac OS X/.test(s) ? 'macOS'
    : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : '';
  return os ? browser + ' on ' + os : browser;
}
