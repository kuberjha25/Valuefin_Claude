import React, { useState } from 'react';
import { Eye, ExternalLink, Check, X, FileText, Bell, CheckCheck } from 'lucide-react';
import { api, fileUrl, openFile } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, Field, Modal, Table, Td, useLoad, useToast } from '../ui.jsx';
import { STATUS, fmtDate } from '../format.js';

const FILTERS = [['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']];

export default function Documents() {
  const user = useAuth();
  const [status, setStatus] = useState(user.role === 'director' ? 'pending' : '');
  const [docs, reload] = useLoad(() => api.get('/documents' + (status ? '?status=' + status : '')), [status]);
  const [notifs, reloadNotifs] = useLoad(() => api.get('/notifications'), []);
  const [preview, setPreview] = useState(null);
  const [reject, setReject] = useState(null);
  const toast = useToast();

  const decide = async (d, approve, reason) => {
    try { await api.post('/documents/' + d.id + '/decide', { approve, reason }); toast('Document ' + (approve ? 'approved' : 'rejected') + '. Uploader notified.'); setPreview(null); setReject(null); reload(); reloadNotifs(); }
    catch (e) { toast(e.message, true); }
  };
  const readAll = async () => { try { await api.post('/notifications/read-all', {}); reloadNotifs(); } catch (e) { /* noop */ } };
  const openNotif = async (n) => { if (!n.read) { try { await api.post('/notifications/' + n.id + '/read', {}); } catch (e) { /* noop */ } reloadNotifs(); } };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-navy-900">{user.role === 'director' ? 'Review documents' : 'Documents'}</h1>
        <p className="text-sm text-slate-500">{user.role === 'director' ? 'Preview each PDF and approve or reject — the uploader is notified.' : 'Uploaded documents and their approval status.'}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-1.5">{FILTERS.map(([v, label]) => <button key={v} onClick={() => setStatus(v)} className={'btn btn-xs ' + (status === v ? 'btn-g' : '')}>{label}</button>)}</div>
          <Card>
            <Table cols={['Document', 'Borrower', 'Uploaded by', 'When', 'Status', '']} rows={docs || []}
              render={(d) => (<>
                <td><button className="flex items-center gap-2 group text-left" onClick={() => setPreview(d)}><div className="rounded-lg bg-rose-100 p-1.5"><FileText size={14} className="text-rose-600" /></div><span className="font-semibold text-navy-900 group-hover:text-teal-600">{d.title}</span></button></td>
                <Td className="text-slate-500">{d.borrowerName}</Td>
                <Td className="text-slate-500">{d.uploadedBy}</Td>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(d.uploadedAt)}</Td>
                <Td><Chip cls={STATUS[d.status].cls}>{STATUS[d.status].label}</Chip>{d.status === 'rejected' && d.reason && <div className="text-[11px] text-rose-600 mt-0.5 max-w-[180px]">{d.reason}</div>}</Td>
                <Td>
                  <div className="flex items-center gap-1.5 justify-end">
                    <button className="btn btn-xs" onClick={() => setPreview(d)}><Eye size={13} /></button>
                    {user.role === 'director' && d.status === 'pending' && (<>
                      <button className="btn btn-xs btn-p" onClick={() => decide(d, true)}><Check size={13} /></button>
                      <button className="btn btn-xs btn-d" onClick={() => setReject(d)}><X size={13} /></button>
                    </>)}
                  </div>
                </Td>
              </>)} empty="No documents match this filter." />
          </Card>
        </div>

        <div>
          <Card title="Notifications" right={notifs && notifs.unread > 0 && <button className="btn btn-xs" onClick={readAll}><CheckCheck size={13} /> Read all</button>}>
            {notifs && notifs.items.length ? (
              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {notifs.items.map((n) => (
                  <button key={n.id} onClick={() => openNotif(n)} className={'w-full text-left rounded-xl px-3 py-2.5 flex gap-2.5 items-start transition ' + (n.read ? 'bg-slate-50' : 'bg-teal-50')}>
                    <Bell size={15} className={n.read ? 'text-slate-400 mt-0.5' : 'text-teal-600 mt-0.5'} />
                    <div className="flex-1 min-w-0"><div className={'text-sm ' + (n.read ? 'text-slate-600' : 'text-navy-900 font-semibold')}>{n.message}</div><div className="text-[11px] text-slate-400 mt-0.5">{fmtDate(n.createdAt, true)}</div></div>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-teal-500 mt-1.5 shrink-0" />}
                  </button>
                ))}
              </div>
            ) : <Empty>No notifications.</Empty>}
          </Card>
        </div>
      </div>

      {preview && (
        <Modal wide title={preview.title} onClose={() => setPreview(null)}>
          <div className="flex items-center justify-between mb-3 text-sm">
            <div className="text-slate-500">{preview.borrowerName} · uploaded by {preview.uploadedBy} · {fmtDate(preview.uploadedAt)}</div>
            <div className="flex items-center gap-2"><Chip cls={STATUS[preview.status].cls}>{STATUS[preview.status].label}</Chip><button className="btn btn-xs" onClick={() => openFile(preview.id)}><ExternalLink size={13} /> New tab</button></div>
          </div>
          <iframe title="pdf" src={fileUrl(preview.id)} className="w-full h-[70vh] rounded-xl border border-slate-200 bg-slate-50" />
          {user.role === 'director' && preview.status === 'pending' && (
            <div className="mt-4 flex justify-end gap-2"><button className="btn btn-d" onClick={() => setReject(preview)}><X size={15} /> Reject</button><button className="btn btn-p" onClick={() => decide(preview, true)}><Check size={15} /> Approve</button></div>
          )}
        </Modal>
      )}
      {reject && (
        <Modal title={'Reject “' + reject.title + '”'} onClose={() => setReject(null)}>
          <Field label="Reason (shared with the uploader)"><textarea className="inp" rows="3" autoFocus id="grej" placeholder="e.g. Wrong period — please re-upload." /></Field>
          <div className="flex justify-end gap-2 mt-4"><button className="btn" onClick={() => setReject(null)}>Cancel</button><button className="btn btn-d" onClick={() => decide(reject, false, document.getElementById('grej').value)}>Reject</button></div>
        </Modal>
      )}
    </div>
  );
}
