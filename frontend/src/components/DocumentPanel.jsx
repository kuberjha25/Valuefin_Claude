import React, { useRef, useState } from 'react';
import { Check, Eye, ExternalLink, FileText, Download, Trash2, Upload as UploadIcon, X } from 'lucide-react';
import { api, fileUrl, openFile } from '../api.js';
import { Chip, Confirm, Empty, Field, Modal, Spinner, Table, Td, useToast } from '../ui.jsx';
import { STATUS, fmtBytes, fmtDate, fmtAgo } from '../format.js';

export const DOC_CATEGORIES = ['KYC', 'Financials', 'Sanction', 'Security', 'Invoice', 'PO', 'Bank statement', 'Other'];

/* ============================================================================
   Upload — drag/drop or browse, PDF only, with a title and a category.
   ========================================================================== */
export function UploadDoc({ borrowerId, borrowerName, borrowers, onClose, onDone }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Other');
  const [target, setTarget] = useState(String(borrowerId || ''));
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  /* On the global Documents page the borrower is a choice; on a borrower's own
     page it is fixed and the picker is not rendered. */
  const choosable = Array.isArray(borrowers) && borrowers.length > 0;

  const pick = (f) => {
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') return toast('Only PDF files are accepted.', 'err');
    if (f.size > 25 * 1024 * 1024) return toast('That PDF is larger than 25 MB.', 'err');
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ''));
  };

  const submit = async () => {
    if (!target) return toast('Choose which borrower this belongs to.', 'err');
    if (!file) return toast('Attach a PDF first.', 'err');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title);
      form.append('category', category);
      await api.uploadDocument(target, form);
      toast('Uploaded — sent to the Director for review.');
      onDone();
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal title="Upload document" subtitle={borrowerName ? 'Filed under ' + borrowerName : null} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" onClick={submit} disabled={busy || !file || !target}>{busy ? <><Spinner /> Uploading…</> : 'Upload for review'}</button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
        {choosable && (
          <Field label="Borrower" className="sm:col-span-2">
            <select className="inp" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">— select a borrower —</option>
              {borrowers.map((b) => <option key={b.borrowerId} value={b.borrowerId}>{b.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Document title"><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. March GST return" /></Field>
        <Field label="Category">
          <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)}>
            {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        {!file ? (
          <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            className={'cursor-pointer rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ' +
              (drag ? 'border-neon-violet bg-neon-indigo/10' : 'border-white/15 hover:border-neon-violet/50 hover:bg-white/[.04]')}>
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-neon-indigo/15 border border-neon-indigo/25">
              <UploadIcon size={20} className="text-neon-violet" />
            </span>
            <p className="text-sm font-semibold text-slate-200">Drop a PDF here, or click to browse</p>
            <p className="mt-1 text-xs text-slate-500">PDF only · up to 25 MB · stored in this borrower's folder on the server</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
              onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[.05] px-4 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-state-bad/15"><FileText size={18} className="text-rose-300" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-100">{file.name}</span>
              <span className="block text-xs text-slate-500">{fmtBytes(file.size)}</span>
            </span>
            <button className="btn btn-ghost btn-icon" onClick={() => setFile(null)} aria-label="Remove file"><X size={16} /></button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ============================================================================
   The document table + preview + approve/reject, shared by the Documents page
   and the borrower detail tab.
   ========================================================================== */
export function DocumentTable({ documents, showBorrower, user, onChange, loading, emptyAction }) {
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const isDirector = user.role === 'director';
  const canDelete = (d) => isDirector || (d.status === 'pending' && d.uploadedById === user.id);

  const decide = async (d, approve, why) => {
    setBusy(true);
    try {
      await api.decideDocument(d.id, approve, why);
      toast('Document ' + (approve ? 'approved' : 'rejected') + '. The uploader has been notified.');
      setPreview(null); setReject(null); setReason('');
      onChange();
    } catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await api.deleteDocument(confirmDel.id); toast('Document deleted.'); setConfirmDel(null); onChange(); }
    catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Table loading={loading}
        cols={['Document', ...(showBorrower ? ['Borrower'] : []), 'Category', 'Uploaded by', 'When', 'Status', '']}
        rows={documents || []}
        empty={<Empty icon={FileText} title="No documents here yet" action={emptyAction}>
          Upload a PDF and it lands in this borrower's server folder, pending Director review.
        </Empty>}
        render={(d) => (
          <>
            <td>
              <button className="group flex items-center gap-2.5 text-left" onClick={() => setPreview(d)}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-state-bad/15"><FileText size={14} className="text-rose-300" /></span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-100 transition group-hover:text-neon-violet">{d.title}</span>
                  <span className="block text-[11px] text-slate-500">{fmtBytes(d.size)}</span>
                </span>
              </button>
            </td>
            {showBorrower && <Td className="text-slate-400">{d.borrowerName}</Td>}
            <Td><Chip cls="chip-slate">{d.category}</Chip></Td>
            <Td className="text-slate-400">{d.uploadedBy}</Td>
            <Td className="whitespace-nowrap text-slate-500" title={fmtDate(d.uploadedAt, true)}>{fmtAgo(d.uploadedAt)}</Td>
            <Td>
              <Chip cls={STATUS[d.status].cls}>{STATUS[d.status].label}</Chip>
              {d.status === 'rejected' && d.reason && <span className="mt-1 block max-w-[13rem] text-[11px] leading-snug text-rose-300">{d.reason}</span>}
              {d.status === 'approved' && d.decidedBy && <span className="mt-1 block text-[11px] text-slate-600">by {d.decidedBy}</span>}
            </Td>
            <Td>
              <span className="flex items-center justify-end gap-1.5">
                <button className="btn btn-ghost btn-xs" onClick={() => setPreview(d)} title="Preview"><Eye size={14} /></button>
                <a className="btn btn-ghost btn-xs" href={fileUrl(d.id, true)} title="Download"><Download size={14} /></a>
                {isDirector && d.status === 'pending' && (<>
                  <button className="btn btn-xs btn-p" onClick={() => decide(d, true)} disabled={busy} title="Approve"><Check size={13} /></button>
                  <button className="btn btn-xs btn-d" onClick={() => { setReject(d); setReason(''); }} title="Reject"><X size={13} /></button>
                </>)}
                {canDelete(d) && (
                  <button className="btn btn-ghost btn-xs text-rose-300" onClick={() => setConfirmDel(d)} title="Delete"><Trash2 size={14} /></button>
                )}
              </span>
            </Td>
          </>
        )} />

      {preview && (
        <Modal size="xl" title={preview.title}
          subtitle={(showBorrower ? preview.borrowerName + ' · ' : '') + 'uploaded by ' + preview.uploadedBy + ' · ' + fmtDate(preview.uploadedAt, true)}
          onClose={() => setPreview(null)}
          footer={<>
            <a className="btn" href={fileUrl(preview.id, true)}><Download size={15} /> Download</a>
            <button className="btn" onClick={() => openFile(preview.id)}><ExternalLink size={15} /> New tab</button>
            {isDirector && preview.status === 'pending' && (<>
              <button className="btn btn-d" onClick={() => { setReject(preview); setReason(''); }}><X size={15} /> Reject</button>
              <button className="btn btn-p" onClick={() => decide(preview, true)} disabled={busy}>{busy && <Spinner />}<Check size={15} /> Approve</button>
            </>)}
          </>}>
          <div className="mb-3 flex items-center gap-2">
            <Chip cls={STATUS[preview.status].cls}>{STATUS[preview.status].label}</Chip>
            <Chip cls="chip-slate">{preview.category}</Chip>
            {preview.decidedBy && <span className="text-xs text-slate-500">Decided by {preview.decidedBy} · {fmtDate(preview.decidedAt, true)}</span>}
          </div>
          <iframe title={preview.title} src={fileUrl(preview.id)}
            className="h-[68vh] w-full rounded-2xl border border-white/12 bg-ink-900" />
        </Modal>
      )}

      {reject && (
        <Modal size="sm" title={'Reject “' + reject.title + '”'} onClose={() => setReject(null)}
          footer={<>
            <button className="btn" onClick={() => setReject(null)}>Cancel</button>
            <button className="btn btn-d" onClick={() => decide(reject, false, reason)} disabled={busy || !reason.trim()}>
              {busy && <Spinner />}Reject document
            </button>
          </>}>
          <Field label="Reason" hint="Shared with the uploader in their notification.">
            <textarea className="inp" rows="3" autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wrong period — please re-upload the March return." />
          </Field>
        </Modal>
      )}

      {confirmDel && (
        <Confirm danger busy={busy} title="Delete this document?" confirmLabel="Delete"
          onCancel={() => setConfirmDel(null)} onConfirm={remove}>
          <b className="text-slate-100">{confirmDel.title}</b> and its stored PDF will be removed from the server.
          This cannot be undone.
        </Confirm>
      )}
    </>
  );
}
