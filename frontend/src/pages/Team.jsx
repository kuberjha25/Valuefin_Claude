import React, { useState } from 'react';
import { UsersRound, Plus, KeyRound, Trash2, ShieldCheck, Ban, CircleCheck, Info } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Confirm, ErrorNote, Field, Modal, PageHead, Spinner, Table, Td, useToast } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { ROLE, initials, fmtAgo, fmtDate } from '../format.js';

const ROLES = ['director', 'manager', 'analyst'];

export default function Team() {
  const me = useAuth();
  const toast = useToast();
  const isDirector = me.role === 'director';
  const { data: users, error, loading, reload } = useLoad(() => api.users(), []);
  const [modal, setModal] = useState(null);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const close = () => { setModal(null); setTarget(null); };
  const act = async (fn, msg) => {
    setBusy(true);
    try { await fn(); toast(msg); close(); reload(); }
    catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const toggleActive = (u) => act(() => api.updateUser(u.id, { active: !u.active }),
    u.name + (u.active ? ' suspended.' : ' reactivated.'));
  const changeRole = (u, role) => act(() => api.updateUser(u.id, { role }), u.name + ' is now a ' + ROLE[role].label + '.');

  return (
    <div className="space-y-5">
      <PageHead icon={UsersRound} title="Team"
        subtitle="Who can sign in, what they can do, and where their sessions stand. Roles decide permissions everywhere in the desk.">
        {isDirector && <button className="btn btn-p" onClick={() => setModal('create')}><Plus size={15} /> Add member</button>}
      </PageHead>

      <div className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((r) => (
          <Card key={r} className="edge-glow">
            <div className="flex items-start gap-3">
              <Chip cls={ROLE[r].cls}>{ROLE[r].label}</Chip>
              <span className="num ml-auto text-sm text-slate-500">{(users || []).filter((u) => u.role === r && u.active).length}</span>
            </div>
            <p className="mt-2.5 text-[12.5px] leading-snug text-slate-400">{ROLE[r].blurb}</p>
          </Card>
        ))}
      </div>

      <Card title="Accounts" subtitle={isDirector ? null : 'Only a Director can add members or change roles.'}>
        {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
          <Table loading={loading} cols={['Member', 'Role', 'Status', 'Last sign-in', '#Live sessions', 'Added', '']}
            rows={users || []} empty="No accounts."
            render={(u) => (
              <>
                <td>
                  <span className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neon-indigo to-neon-pink font-display text-[11px] font-bold text-white">
                      {initials(u.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-slate-100">{u.name}</span>
                        {u.id === me.id && <Chip cls="chip-violet">you</Chip>}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">{u.email}</span>
                    </span>
                  </span>
                </td>
                <Td>
                  {isDirector && u.id !== me.id ? (
                    <select className="inp !w-36 !py-1 !text-xs" value={u.role} onChange={(e) => changeRole(u, e.target.value)}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE[r].label}</option>)}
                    </select>
                  ) : <Chip cls={ROLE[u.role].cls}>{ROLE[u.role].label}</Chip>}
                </Td>
                <Td>
                  <Chip cls={u.active ? 'chip-good' : 'chip-slate'}>{u.active ? 'Active' : 'Suspended'}</Chip>
                  {u.mustReset && <Chip cls="chip-warn ml-1.5">password set by admin</Chip>}
                </Td>
                <Td className="whitespace-nowrap text-slate-500">{u.lastLoginAt ? fmtAgo(u.lastLoginAt) : 'never'}</Td>
                <Td r className={u.liveSessions ? 'text-emerald-300' : 'text-slate-600'}>{u.liveSessions}</Td>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(u.createdAt)}</Td>
                <Td>
                  {isDirector && (
                    <span className="flex items-center justify-end gap-1.5">
                      <button className="btn btn-ghost btn-xs" title="Reset password"
                        onClick={() => { setTarget(u); setModal('password'); }}><KeyRound size={14} /></button>
                      {u.id !== me.id && (
                        <button className={'btn btn-ghost btn-xs ' + (u.active ? 'text-neon-amber' : 'text-emerald-300')}
                          title={u.active ? 'Suspend' : 'Reactivate'} onClick={() => toggleActive(u)} disabled={busy}>
                          {u.active ? <Ban size={14} /> : <CircleCheck size={14} />}
                        </button>
                      )}
                      {u.id !== me.id && (
                        <button className="btn btn-ghost btn-xs text-rose-300" title="Delete account"
                          onClick={() => { setTarget(u); setModal('delete'); }}><Trash2 size={14} /></button>
                      )}
                    </span>
                  )}
                </Td>
              </>
            )} />
        )}
        <p className="mt-4 flex items-start gap-1.5 text-[11px] text-slate-500">
          <Info size={12} className="mt-0.5 shrink-0" />
          Suspending an account or resetting its password ends that member's live sessions immediately.
          The last active Director cannot be demoted, suspended or deleted.
        </p>
      </Card>

      {modal === 'create' && <NewMember onClose={close} onDone={() => { close(); reload(); }} />}
      {modal === 'password' && <ResetPassword user={target} onClose={close} onDone={() => { close(); reload(); }} />}
      {modal === 'delete' && (
        <Confirm danger busy={busy} title="Delete this account?" confirmLabel="Delete account"
          onCancel={close} onConfirm={() => act(() => api.deleteUser(target.id), 'Account deleted.')}>
          <b className="text-slate-100">{target.name}</b> ({target.email}) will lose access immediately. Records they created
          keep their name in the ledger and audit trail.
        </Confirm>
      )}
    </div>
  );
}

function NewMember({ onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', role: 'manager', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try { await api.createUser(f); toast(f.name + ' can now sign in.'); onDone(); }
    catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal title="Add a team member" subtitle="They sign in with this email and password, and can change the password afterwards."
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" onClick={save} disabled={busy || !f.name.trim() || !f.email.trim() || f.password.length < 8}>
          {busy && <Spinner />}Create account
        </button>
      </>}>
      <div className="space-y-3">
        <Field label="Full name"><input className="inp" autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Neha Verma" /></Field>
        <Field label="Work email"><input type="email" className="inp" value={f.email} onChange={set('email')} placeholder="neha@valuefin.in" /></Field>
        <Field label="Role" hint={ROLE[f.role].blurb}>
          <select className="inp" value={f.role} onChange={set('role')}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE[r].label}</option>)}
          </select>
        </Field>
        <Field label="Initial password" hint="At least 8 characters, with a letter and a number.">
          <input type="text" className="inp font-mono" value={f.password} onChange={set('password')} placeholder="Give them something to start with" />
        </Field>
        <p className="flex items-start gap-1.5 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-[11.5px] text-slate-400">
          <ShieldCheck size={13} className="mt-0.5 shrink-0 text-neon-violet" />
          Share this password over a channel you trust. It is stored only as a bcrypt hash — nobody, including a Director,
          can read it back later.
        </p>
      </div>
    </Modal>
  );
}

function ResetPassword({ user, onClose, onDone }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try { await api.resetUserPassword(user.id, password); toast('Password reset — their sessions have been ended.'); onDone(); }
    catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal size="sm" title={'Reset password · ' + user.name} subtitle={user.email} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" onClick={save} disabled={busy || password.length < 8}>{busy && <Spinner />}Reset password</button>
      </>}>
      <Field label="New password" hint="At least 8 characters, with a letter and a number.">
        <input type="text" className="inp font-mono" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <p className="mt-3 text-[11.5px] text-slate-500">Every live session for this account ends the moment you confirm.</p>
    </Modal>
  );
}
