import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, ChevronRight, Download, Search, SlidersHorizontal } from 'lucide-react';
import { api, downloadCSV } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, Field, Modal, Table, Td, useToast, ErrorNote, PageHead, Meter, Spinner } from '../ui.jsx';
import { useLoad, useDebounced, useLocal } from '../hooks.js';
import { fmt, fmtCr, pct, PRODUCT, today } from '../format.js';
import { DOC_CATEGORIES, PdfDropzone, pdfProblem } from '../components/DocumentPanel.jsx';

const STATES = [['', 'All'], ['open', 'With exposure'], ['overdue', 'Overdue'], ['idle', 'No exposure']];

export default function Borrowers() {
  const user = useAuth();
  const nav = useNavigate();
  const canEdit = user.role !== 'analyst';

  const [term, setTerm] = useState('');
  const q = useDebounced(term, 250);
  const [state, setState] = useLocal('borrowers.state', '');
  const [sort, setSort] = useLocal('borrowers.sort', 'outstanding');
  const [adding, setAdding] = useState(false);

  const { data: rows, error, loading, reload } = useLoad(
    () => api.borrowers({ q, state, sort, dir: sort === 'name' ? 'asc' : 'desc' }), [q, state, sort]);

  const exportCSV = () => {
    downloadCSV('valuefin_borrowers_' + today() + '.csv',
      ['Borrower', 'Sector', 'Product', 'Rate %', 'Sanctioned', 'Outstanding', 'Available', 'Utilisation %',
        'Active drawdowns', 'Interest earned', 'Income booked', 'Accrued', 'Overdue days', 'IRR %'],
      (rows || []).map((b) => [b.name, b.biz, PRODUCT[b.loanType].label, b.rate, Math.round(b.limit),
        Math.round(b.outstanding), Math.round(b.available), b.utilPct, b.activeDrawdowns,
        Math.round(b.interestEarned), Math.round(b.incomeBooked), Math.round(b.accruedOpen), b.overdueDays,
        b.irr != null ? b.irr.toFixed(1) : '']));
  };

  const totals = (rows || []).reduce((t, b) => ({
    limit: t.limit + b.limit, outstanding: t.outstanding + b.outstanding, income: t.income + b.incomeBooked
  }), { limit: 0, outstanding: 0, income: 0 });

  return (
    <div className="space-y-5">
      <PageHead icon={Users} title="Borrowers"
        subtitle="Every facility with its live utilisation and yield. Open a row to manage drawdowns, payments, limits and documents.">
        <button className="btn" onClick={exportCSV} disabled={!rows?.length}><Download size={15} /> CSV</button>
        {canEdit && <button className="btn btn-p" onClick={() => setAdding(true)}><Plus size={15} /> Add borrower</button>}
      </PageHead>

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="relative min-w-[15rem] flex-1">
            <span className="lbl">Search</span>
            <Search size={15} className="pointer-events-none absolute bottom-2.5 left-3 text-slate-500" />
            <input className="inp pl-9" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Name or sector…" />
          </label>
          <Field label="Exposure" className="w-44">
            <select className="inp" value={state} onChange={(e) => setState(e.target.value)}>
              {STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Sort by" className="w-48">
            <select className="inp" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="outstanding">Outstanding</option>
              <option value="limit">Sanctioned limit</option>
              <option value="utilPct">Utilisation</option>
              <option value="irr">IRR</option>
              <option value="incomeBooked">Income booked</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </Field>
          {loading && <span className="pb-2.5 text-slate-500"><Spinner /></span>}
        </div>

        {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
          <Table loading={loading && !rows} cols={['Borrower', 'Product', '#Sanctioned', '#Outstanding', 'Utilisation', '#Active', '#Income', '#IRR', '']}
            rows={rows || []}
            empty={<Empty icon={SlidersHorizontal} title={term || state ? 'No borrowers match those filters' : 'No borrowers yet'}
              action={canEdit && !term && !state ? <button className="btn btn-p" onClick={() => setAdding(true)}><Plus size={15} /> Add the first facility</button> : null}>
              {term || state ? 'Clear the search or exposure filter to see the whole book.' : 'Add a facility to start recording drawdowns and payments.'}
            </Empty>}
            render={(b) => (
              <>
                <td>
                  <button className="group text-left" onClick={() => nav('/borrowers/' + b.borrowerId)}>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 transition group-hover:text-neon-violet">{b.name}</span>
                      {b.isSample && <Chip cls="chip-pink">reference</Chip>}
                      {b.overdueDays > 0 && <Chip cls="chip-bad">{b.overdueDays}d overdue</Chip>}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{b.biz || '—'} · {b.rate}% p.a. · {b.tenure} {b.tenureUnit}</span>
                  </button>
                </td>
                <Td><Chip cls={PRODUCT[b.loanType].cls}>{PRODUCT[b.loanType].label}</Chip></Td>
                <Td r>{fmtCr(b.limit)}</Td>
                <Td r className="font-semibold text-slate-100">{fmtCr(b.outstanding)}</Td>
                <td className="w-40">
                  <Meter value={b.outstanding} max={b.limit || 1} />
                  <span className={'mt-1 block text-[11px] num ' + (b.utilPct > 90 ? 'text-rose-300' : 'text-slate-500')}>{b.utilPct}%</span>
                </td>
                <Td r>{b.activeDrawdowns}</Td>
                <Td r className="text-slate-400">{fmtCr(b.incomeBooked)}</Td>
                <Td r className={b.irr >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{pct(b.irr)}</Td>
                <Td>
                  <button className="btn btn-ghost btn-xs" onClick={() => nav('/borrowers/' + b.borrowerId)} aria-label={'Open ' + b.name}>
                    <ChevronRight size={16} />
                  </button>
                </Td>
              </>
            )}
            footer={rows && rows.length > 1 ? (
              <tr className="border-t border-white/10">
                <td className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rows.length} borrowers</td>
                <td />
                <td className="px-3 text-right num text-slate-300">{fmtCr(totals.limit)}</td>
                <td className="px-3 text-right num font-semibold text-white">{fmtCr(totals.outstanding)}</td>
                <td colSpan={2} />
                <td className="px-3 text-right num text-slate-300">{fmtCr(totals.income)}</td>
                <td colSpan={2} />
              </tr>
            ) : null} />
        )}
      </Card>

      {adding && <BorrowerForm onClose={() => setAdding(false)} onDone={(id) => { setAdding(false); reload(); if (id) nav('/borrowers/' + id); }} />}
    </div>
  );
}

/* ============================================================================
   Add / edit facility. Used by this page and by the borrower detail page.
   ========================================================================== */
export function BorrowerForm({ initial, onClose, onDone }) {
  const toast = useToast();
  const editing = !!initial;
  const [f, setF] = useState(() => ({
    name: '', biz: '', loanType: 'po', limit: '', rate: '18', penRate: '6', procFeePct: '1.5', gstPct: '18',
    tenure: '90', tenureUnit: 'days', sanctionDate: today(),
    contactName: '', contactEmail: '', contactPhone: '', pan: '', gstin: '', status: 'active',
    ...(initial || {})
  }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  /* Onboarding requires a document — a borrower cannot exist on the book with
     nothing on file. Only enforced when creating; editing never touches it. */
  const [doc, setDoc] = useState({ file: null, title: '', category: 'KYC' });
  const [showDocError, setShowDocError] = useState(false);
  const pickDoc = (file) => {
    if (file === null) return setDoc((d) => ({ ...d, file: null }));
    const problem = pdfProblem(file);
    if (problem) return toast(problem, 'err');
    setShowDocError(false);
    setDoc((d) => ({ ...d, file, title: d.title || file.name.replace(/\.pdf$/i, '') }));
  };

  const FACILITY_FIELDS = ['name', 'biz', 'loanType', 'limit', 'rate', 'penRate', 'procFeePct', 'gstPct',
    'tenure', 'tenureUnit', 'sanctionDate', 'contactName', 'contactEmail', 'contactPhone', 'pan', 'gstin'];

  const incomplete = !String(f.name).trim() || !(+f.limit > 0) || (!editing && !doc.file);

  const save = async () => {
    if (!editing && !doc.file) { setShowDocError(true); return toast('Attach the onboarding document to continue.', 'err'); }
    setBusy(true);
    try {
      let r;
      if (editing) {
        r = await api.updateBorrower(initial.id, f);
        toast('Facility updated.');
      } else {
        const form = new FormData();
        FACILITY_FIELDS.forEach((k) => form.append(k, f[k] == null ? '' : String(f[k])));
        form.append('file', doc.file);
        form.append('docTitle', doc.title.trim() || doc.file.name.replace(/\.pdf$/i, ''));
        form.append('docCategory', doc.category);
        r = await api.createBorrower(form);
        toast('Borrower “' + r.name + '” onboarded — document sent to the Director for review.');
      }
      onDone(r.borrowerId);
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal size="lg" title={editing ? 'Edit facility · ' + initial.name : 'Add borrower'}
      subtitle={editing ? 'Rate and tenure changes re-price every open drawdown from its own payment history.'
        : 'Set the facility once — drawdowns inherit these terms.'}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" onClick={save} disabled={busy || incomplete}>
          {busy && <Spinner />}{editing ? 'Save changes' : 'Add borrower'}
        </button>
      </>}>
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Borrower name" className="sm:col-span-2">
            <input className="inp" autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Acme Foods Pvt Ltd" />
          </Field>
          <Field label="Business / sector"><input className="inp" value={f.biz || ''} onChange={set('biz')} placeholder="e.g. FMCG distribution" /></Field>
          <Field label="Product">
            <select className="inp" value={f.loanType} onChange={set('loanType')}>
              <option value="po">PO Finance / Working Capital</option>
              <option value="io">Interest-Only (Bullet)</option>
            </select>
          </Field>
        </section>

        <section>
          <p className="ctitle mb-3">Commercials</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Sanctioned limit (₹)" hint={editing ? 'Base limit — enhancements are tracked separately' : null}>
              <input type="number" min="0" className="inp" value={f.limit} onChange={set('limit')} placeholder="5000000" />
            </Field>
            <Field label="Sanction date"><input type="date" className="inp" value={f.sanctionDate} onChange={set('sanctionDate')} /></Field>
            <Field label="Interest rate (% p.a.)"><input type="number" step="0.01" className="inp" value={f.rate} onChange={set('rate')} /></Field>
            <Field label="Penal charge (% p.a. extra)"><input type="number" step="0.01" className="inp" value={f.penRate} onChange={set('penRate')} /></Field>
            <Field label="Processing fee (%)"><input type="number" step="0.01" className="inp" value={f.procFeePct} onChange={set('procFeePct')} /></Field>
            <Field label="GST on fee (%)"><input type="number" step="0.01" className="inp" value={f.gstPct} onChange={set('gstPct')} /></Field>
            <Field label="Tenure"><input type="number" min="1" className="inp" value={f.tenure} onChange={set('tenure')} /></Field>
            <Field label="Tenure unit">
              <select className="inp" value={f.tenureUnit} onChange={set('tenureUnit')}><option value="days">Days</option><option value="months">Months</option></select>
            </Field>
            {editing && (
              <Field label="Facility status">
                <select className="inp" value={f.status} onChange={set('status')}><option value="active">Active</option><option value="closed">Closed</option></select>
              </Field>
            )}
          </div>
        </section>

        <section>
          <p className="ctitle mb-3">Contact &amp; identifiers <span className="normal-case tracking-normal text-slate-600">(optional)</span></p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Contact name"><input className="inp" value={f.contactName || ''} onChange={set('contactName')} /></Field>
            <Field label="Contact email"><input type="email" className="inp" value={f.contactEmail || ''} onChange={set('contactEmail')} /></Field>
            <Field label="Contact phone"><input className="inp" value={f.contactPhone || ''} onChange={set('contactPhone')} /></Field>
            <Field label="PAN"><input className="inp font-mono uppercase" value={f.pan || ''} onChange={set('pan')} placeholder="AAACA1234M" /></Field>
            <Field label="GSTIN"><input className="inp font-mono uppercase" value={f.gstin || ''} onChange={set('gstin')} placeholder="27AAACA1234M1ZP" /></Field>
          </div>
        </section>

        {!editing && (
          <section>
            <p className="ctitle mb-1 flex items-center gap-2">
              Onboarding document
              <span className="chip-bad normal-case tracking-normal">required</span>
            </p>
            <p className="mb-3 text-xs text-slate-500">
              Attach the sanction letter, KYC pack or equivalent. It is filed in this borrower's folder and
              goes to the Director for review — the borrower is not created without it.
            </p>
            <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_11rem]">
              <Field label="Document title">
                <input className="inp" value={doc.title}
                  onChange={(e) => setDoc((d) => ({ ...d, title: e.target.value }))}
                  placeholder="e.g. Sanction letter — Acme Foods" />
              </Field>
              <Field label="Category">
                <select className="inp" value={doc.category} onChange={(e) => setDoc((d) => ({ ...d, category: e.target.value }))}>
                  {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <PdfDropzone file={doc.file} onPick={pickDoc} compact invalid={showDocError}
              hint="PDF only · up to 25 MB · filed against this borrower on creation" />
            {showDocError && !doc.file && (
              <p className="mt-2 text-xs font-semibold text-rose-300">An onboarding document is required.</p>
            )}
            <p className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-xs text-slate-400">
              <Users size={14} className="shrink-0 text-neon-violet" />
              The borrower and this document are saved together — if either fails, neither is kept.
            </p>
          </section>
        )}
      </div>
    </Modal>
  );
}
