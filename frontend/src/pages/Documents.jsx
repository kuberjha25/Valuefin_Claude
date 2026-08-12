import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderCheck, Bell, CheckCheck, Upload as UploadIcon, Search, ChevronRight } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, Field, PageHead, Spinner, Stat, useToast } from '../ui.jsx';
import { useLoad, useDebounced } from '../hooks.js';
import { DocumentTable, UploadDoc } from '../components/DocumentPanel.jsx';
import { fmtAgo } from '../format.js';

const FILTERS = [['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']];

export default function Documents() {
  const user = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const canEdit = user.role !== 'analyst';

  const [status, setStatus] = useState(user.role === 'director' ? 'pending' : '');
  const [term, setTerm] = useState('');
  const q = useDebounced(term, 250);
  const [borrowerId, setBorrowerId] = useState('');
  const [uploadFor, setUploadFor] = useState(null);

  const { data: borrowers } = useLoad(() => api.borrowers({ sort: 'name', dir: 'asc' }), []);
  const { data: docs, error, loading, reload } = useLoad(() => api.documents({ status, q, borrowerId }), [status, q, borrowerId]);
  const { data: counts, reload: reloadCounts } = useLoad(() => api.documentCounts(), []);
  const { data: notifs, reload: reloadNotifs } = useLoad(() => api.notifications(), []);

  const refresh = () => { reload(); reloadCounts(); reloadNotifs(); };

  const openNotif = async (n) => {
    if (!n.read) { try { await api.readNotification(n.id); } catch (_) { /* non-blocking */ } reloadNotifs(); }
    if (n.borrowerId) nav('/borrowers/' + n.borrowerId);
  };
  const readAll = async () => {
    try { await api.readAllNotifications(); reloadNotifs(); toast('All notifications marked read.'); }
    catch (e) { toast(e.message, 'err'); }
  };

  const isDirector = user.role === 'director';

  return (
    <div className="space-y-5">
      <PageHead icon={FolderCheck} title={isDirector ? 'Review documents' : 'Documents'}
        subtitle={isDirector
          ? 'Preview each PDF and approve or reject it — the uploader is notified either way, and a reason is required to reject.'
          : 'Uploaded documents and where they stand in Director review.'}>
        {canEdit && (
          <button className="btn btn-p" onClick={() => setUploadFor(borrowerId || 'pick')} disabled={!borrowers?.length}>
            <UploadIcon size={15} /> Upload
          </button>
        )}
      </PageHead>

      {counts && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Pending review" value={counts.pending} accent="amber" sub={isDirector ? 'waiting on you' : 'with the Director'} />
          <Stat label="Approved" value={counts.approved} accent="lime" />
          <Stat label="Rejected" value={counts.rejected} accent="pink" />
          <Stat label="Total filed" value={counts.total} accent="violet" />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-4">
          <Card>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="relative block">
                <span className="lbl">Search</span>
                <Search size={15} className="pointer-events-none absolute bottom-2.5 left-3 text-slate-500" />
                <input className="inp pl-9" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Title or filename…" />
              </label>
              <Field label="Borrower">
                <select className="inp" value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)}>
                  <option value="">All borrowers</option>
                  {(borrowers || []).map((b) => <option key={b.borrowerId} value={b.borrowerId}>{b.name}</option>)}
                </select>
              </Field>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {FILTERS.map(([v, label]) => (
                <button key={v} onClick={() => setStatus(v)} className={'btn btn-xs ' + (status === v ? 'btn-p' : '')}>
                  {label}
                  {counts && v && <span className="ml-1 opacity-70 num">{counts[v]}</span>}
                </button>
              ))}
              {loading && <span className="ml-1 text-slate-500"><Spinner size={13} /></span>}
            </div>

            {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
              <DocumentTable documents={docs} showBorrower user={user} onChange={refresh} loading={loading && !docs} />
            )}
          </Card>
        </div>

        <Card title="Notifications"
          right={notifs?.unread > 0 && <button className="btn btn-xs" onClick={readAll}><CheckCheck size={12} /> Mark all read</button>}>
          {!notifs && <p className="py-6 text-center text-sm text-slate-500">Loading…</p>}
          {notifs && !notifs.items.length && <Empty icon={Bell} title="All clear">Uploads, decisions and limit changes land here.</Empty>}
          {notifs?.items.length > 0 && (
            <ul className="-mx-1 max-h-[34rem] space-y-1.5 overflow-y-auto px-1">
              {notifs.items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => openNotif(n)}
                    className={'flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition hover:border-white/20 ' +
                      (n.read ? 'border-white/[.07] bg-white/[.03]' : 'border-neon-indigo/30 bg-neon-indigo/[.09]')}>
                    <span className={'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ' + (n.read ? 'bg-slate-700' : 'bg-neon-pink')} />
                    <span className="min-w-0 flex-1">
                      <span className={'block text-[13px] leading-snug ' + (n.read ? 'text-slate-400' : 'text-slate-100')}>{n.message}</span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
                        <Chip cls="chip-slate">{n.type}</Chip> {fmtAgo(n.createdAt)}
                      </span>
                    </span>
                    {n.borrowerId && <ChevronRight size={14} className="mt-0.5 shrink-0 text-slate-600" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {uploadFor && (
        <UploadDoc borrowerId={uploadFor === 'pick' ? '' : uploadFor} borrowers={borrowers || []}
          onClose={() => setUploadFor(null)} onDone={() => { setUploadFor(null); refresh(); }} />
      )}
    </div>
  );
}
