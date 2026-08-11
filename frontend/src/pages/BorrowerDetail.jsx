import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Wallet2, Upload as UploadIcon, FileBarChart2, Pencil, Trash2, FileText, Eye, ExternalLink, Check, X, Banknote } from 'lucide-react';
import { api, fileUrl, openFile } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, Field, Modal, Table, Td, useLoad, useToast } from '../ui.jsx';
import { fmt, fmtCr, fmtDate, pct, STATUS } from '../format.js';

const DR = (r) => (+r || 0) / 100 / 365;
function advPreview(amt, rate, mode, cd) {
  amt = +amt || 0; rate = +rate || 0;
  if (mode === 'none') return { adv: 0, ad: 0 };
  if (mode === '30d') return { adv: amt * DR(rate) * 30, ad: 30 };
  if (mode === '1m') return { adv: amt * (rate / 100 / 12), ad: 30 };
  if (mode === '2m') return { adv: amt * (rate / 100 / 12) * 2, ad: 61 };
  const d = +cd || 30; return { adv: amt * DR(rate) * d, ad: d };
}

export default function BorrowerDetail() {
  const { id } = useParams();
  const user = useAuth();
  const nav = useNavigate();
  const [data, reload, err] = useLoad(() => api.get('/borrowers/' + id), [id]);
  const [tab, setTab] = useState('drawdowns');
  const [modal, setModal] = useState(null); // 'dd' | 'pay' | 'upload' | 'edit'
  const [payDD, setPayDD] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const toast = useToast();
  const canEdit = user.role !== 'analyst';

  if (err) return <Card><Empty>{err}</Empty><div className="text-center"><Link className="btn" to="/borrowers"><ArrowLeft size={15} /> Back</Link></div></Card>;
  if (!data) return <Empty>Loading…</Empty>;
  const { borrower: b, summary: s, drawdowns, payments, documents, ledger } = data;

  const delBorrower = async () => { try { await api.del('/borrowers/' + id); toast('Borrower deleted.'); nav('/borrowers'); } catch (e) { toast(e.message, true); } };

  const TABS = [['drawdowns', 'Drawdowns', drawdowns.length], ['payments', 'Payments', payments.length], ['ledger', 'Ledger', ledger.length], ['documents', 'Documents', documents.length]];

  return (
    <div className="space-y-5">
      <Link to="/borrowers" className="text-sm text-slate-500 hover:text-navy-900 inline-flex items-center gap-1"><ArrowLeft size={14} /> All borrowers</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-extrabold text-2xl text-navy-900">{b.name}</h1>
            <Chip cls={b.loanType === 'io' ? 'bg-navy-900/10 text-navy-900' : 'bg-teal-600/10 text-teal-700'}>{b.loanType === 'io' ? 'Interest-Only' : 'PO Finance'}</Chip>
            {b.sample && <Chip cls="bg-gold-500/15 text-gold-500">reference example</Chip>}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{b.biz || '—'} · {b.rate}% p.a. · {b.tenure} {b.tenureUnit} tenure · sanctioned {fmtDate(b.sanctionDate)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <button className="btn btn-p" onClick={() => setModal('dd')}><Plus size={15} /> New drawdown</button>}
          {canEdit && <button className="btn" onClick={() => { setPayDD(null); setModal('pay'); }}><Wallet2 size={15} /> Record payment</button>}
          {canEdit && <button className="btn" onClick={() => setModal('upload')}><UploadIcon size={15} /> Upload doc</button>}
          <button className="btn" onClick={() => nav('/mis?borrowerId=' + id)}><FileBarChart2 size={15} /> MIS</button>
          {canEdit && <button className="btn" onClick={() => setModal('edit')}><Pencil size={15} /></button>}
          {canEdit && <button className="btn text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => setConfirmDel(true)}><Trash2 size={15} /></button>}
        </div>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Sanctioned limit" value={fmtCr(s.limit)} />
        <MiniStat label="Outstanding" value={fmtCr(s.outstanding)} tone="text-teal-600" />
        <MiniStat label="Available" value={fmtCr(s.available)} />
        <MiniStat label="Utilisation" value={s.utilPct + '%'} tone={s.utilPct > 90 ? 'text-rose-600' : 'text-navy-900'} />
        <MiniStat label="Interest earned" value={fmt(s.interestEarned)} sub={'Fees ' + fmt(s.feeCollected)} />
        <MiniStat label="Accrued (open)" value={fmt(s.accruedOpen)} sub={s.overdueDays > 0 ? s.overdueDays + 'd overdue' : 'within tenure'} tone={s.overdueDays > 0 ? 'text-rose-600' : 'text-navy-900'} />
        <MiniStat label="Portfolio IRR" value={pct(s.irr)} />
        <MiniStat label="Renewal" value={s.renewal ? fmtDate(s.renewal.renewDate) : '—'} sub={s.renewal ? (s.renewal.status === 'overdue' ? 'overdue' : s.renewal.daysLeft + 'd left') : ''} tone={s.renewal && s.renewal.status !== 'ok' ? 'text-amber-600' : 'text-navy-900'} />
      </div>

      {/* tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(([k, label, n]) => (
          <div key={k} className={'tab ' + (tab === k ? 'tab-on' : '')} onClick={() => setTab(k)}>{label} <span className="opacity-60">{n}</span></div>
        ))}
      </div>

      {tab === 'drawdowns' && (
        <Card>
          <Table cols={['Ref', 'Debit date', '#PO amount', '#Net disbursed', '#Adv int', '#Fee+GST', '#Outstanding', '#Accrued', '#Days', 'Status', '']} rows={drawdowns}
            render={(d) => (<>
              <td className="mono text-xs font-semibold text-navy-900">{d.ref || '—'}</td>
              <Td className="whitespace-nowrap text-slate-500">{fmtDate(d.bankDebit)}</Td>
              <Td r>{fmt(d.poAmt)}</Td>
              <Td r>{fmt(d.disbursed)}</Td>
              <Td r className="text-slate-500">{fmt(d.adv)}</Td>
              <Td r className="text-slate-500">{fmt((d.fee || 0) + (d.gstAmt || 0))}</Td>
              <Td r className="font-semibold">{fmt(d.outPrin)}</Td>
              <Td r className={d.overdueDays > 0 ? 'text-rose-600' : 'text-slate-500'}>{d.status === 'Repaid' ? '—' : fmt(d.accrued)}</Td>
              <Td r className="text-slate-500">{d.daysOpen}</Td>
              <Td><Chip cls={STATUS[d.status].cls}>{STATUS[d.status].label}</Chip></Td>
              <Td>
                <div className="flex items-center gap-1.5 justify-end">
                  {canEdit && d.status !== 'Repaid' && <button className="btn btn-xs btn-p" onClick={() => { setPayDD(d); setModal('pay'); }}><Banknote size={13} /> Pay</button>}
                  {canEdit && <button className="btn btn-xs text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => delDrawdown(d.id)}><Trash2 size={13} /></button>}
                </div>
              </Td>
            </>)} empty="No drawdowns yet. Record the first disbursement with “New drawdown”." />
        </Card>
      )}

      {tab === 'payments' && (
        <Card>
          <Table cols={['Date', 'Ref', 'Entry', '#Amount', '#Interest', '#Principal', '#Outstanding after', '']} rows={payments}
            render={(p) => (<>
              <Td className="whitespace-nowrap text-slate-500">{fmtDate(p.date)}</Td>
              <td className="mono text-xs text-slate-500">{p.ref || '—'}</td>
              <Td><Chip cls={p.closed ? 'bg-slate-100 text-slate-500' : 'bg-teal-600/10 text-teal-700'}>{p.closed ? 'Full / closure' : (p.prinAdj > 0 ? 'Part payment' : 'Interest')}</Chip></Td>
              <Td r className="font-semibold">{fmt(p.amount)}</Td>
              <Td r className="text-slate-500">{fmt(p.intAdj)}</Td>
              <Td r className="text-slate-500">{fmt(p.prinAdj)}</Td>
              <Td r>{fmt(p.outAfter)}</Td>
              <Td>{canEdit && <button className="btn btn-xs text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => delPayment(p.id)}><Trash2 size={13} /></button>}</Td>
            </>)} empty="No payments recorded yet." />
        </Card>
      )}

      {tab === 'ledger' && (
        <Card><LedgerTable rows={ledger} /></Card>
      )}

      {tab === 'documents' && (
        <DocumentsTab borrowerId={id} documents={documents} canEdit={canEdit} role={user.role} onChange={reload} onUpload={() => setModal('upload')} />
      )}

      {modal === 'dd' && <NewDrawdown b={b} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal === 'pay' && <RecordPayment b={b} drawdowns={drawdowns.filter((d) => d.status !== 'Repaid')} preselect={payDD} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal === 'upload' && <UploadDoc borrowerId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal === 'edit' && <EditBorrower b={b} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {confirmDel && (
        <Modal title="Delete borrower?" onClose={() => setConfirmDel(false)}>
          <p className="text-sm text-slate-600">This removes <b>{b.name}</b> and all its drawdowns, payments and document records. This cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-4"><button className="btn" onClick={() => setConfirmDel(false)}>Cancel</button><button className="btn btn-d" onClick={delBorrower}>Delete</button></div>
        </Modal>
      )}
    </div>
  );

  async function delDrawdown(ddId) { try { await api.del('/drawdowns/' + ddId); toast('Drawdown removed.'); reload(); } catch (e) { toast(e.message, true); } }
  async function delPayment(pId) { try { await api.del('/payments/' + pId); toast('Payment reversed.'); reload(); } catch (e) { toast(e.message, true); } }
}

const MiniStat = ({ label, value, sub, tone = 'text-navy-900' }) => (
  <div className="card py-3.5">
    <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
    <div className={'font-display font-extrabold text-xl leading-tight ' + tone}>{value}</div>
    {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
  </div>
);

export function LedgerTable({ rows }) {
  if (!rows || !rows.length) return <Empty>No ledger entries yet.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr>
          <th>Date</th><th>Entry</th><th>Ref</th><th className="text-right">Amount</th><th className="text-right">Adv int</th>
          <th className="text-right">Fee</th><th className="text-right">GST</th><th className="text-right">Interest</th><th className="text-right">Principal</th><th className="text-right">Outstanding after</th>
        </tr></thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={i} className="hover:bg-slate-50/70">
              <td className="whitespace-nowrap text-slate-500">{fmtDate(e.date)}</td>
              <td><span className={'chip ' + (e.dir === 'out' ? 'bg-navy-900/10 text-navy-900' : 'bg-teal-600/10 text-teal-700')}>{e.type}</span></td>
              <td className="mono text-xs text-slate-500">{e.ref || '—'}</td>
              <td className="text-right tabular-nums font-medium">{fmt(e.amount)}</td>
              <td className="text-right tabular-nums text-slate-400">{e.adv ? fmt(e.adv) : '—'}</td>
              <td className="text-right tabular-nums text-slate-400">{e.fee ? fmt(e.fee) : '—'}</td>
              <td className="text-right tabular-nums text-slate-400">{e.gst ? fmt(e.gst) : '—'}</td>
              <td className="text-right tabular-nums text-slate-400">{e.intAdj != null ? fmt(e.intAdj) : '—'}</td>
              <td className="text-right tabular-nums text-slate-400">{e.prinAdj != null ? fmt(e.prinAdj) : '—'}</td>
              <td className="text-right tabular-nums text-slate-600">{e.outAfter != null ? fmt(e.outAfter) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- New Drawdown ---------- */
function NewDrawdown({ b, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ ref: '', poAmt: '', bankDebit: new Date().toISOString().slice(0, 10), mode: b.loanType === 'io' ? '1m' : '30d', cd: '30', feePct: String(b.procFeePct), rem: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const amt = +f.poAmt || 0;
  const { adv, ad } = advPreview(amt, b.rate, f.mode, f.cd);
  const fee = amt * (+f.feePct || 0) / 100;
  const gst = fee * (+b.gstPct || 0) / 100;
  const disbursed = amt - adv - fee - gst;
  const save = async () => {
    try { await api.post('/drawdowns', { borrowerId: b.id, ...f }); toast('Drawdown recorded.'); onDone(); }
    catch (e) { toast(e.message, true); }
  };
  return (
    <Modal title={'New drawdown · ' + b.name} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PO / reference"><input className="inp" autoFocus value={f.ref} onChange={set('ref')} placeholder="e.g. PML/PO-2403" /></Field>
        <Field label="Debit date"><input type="date" className="inp" value={f.bankDebit} onChange={set('bankDebit')} /></Field>
        <Field label={b.loanType === 'io' ? 'Principal (₹)' : 'PO amount (₹)'}><input type="number" className="inp" value={f.poAmt} onChange={set('poAmt')} placeholder="e.g. 4000000" /></Field>
        <Field label="Advance interest">
          <select className="inp" value={f.mode} onChange={set('mode')}>
            <option value="none">None</option>
            <option value="30d">30 days (daily)</option>
            <option value="1m">1 month</option>
            <option value="2m">2 months</option>
            <option value="custom">Custom days</option>
          </select>
        </Field>
        {f.mode === 'custom' && <Field label="Custom advance days"><input type="number" className="inp" value={f.cd} onChange={set('cd')} /></Field>}
        <Field label="Processing fee (%)"><input type="number" className="inp" value={f.feePct} onChange={set('feePct')} /></Field>
        <Field label="Remarks" className="col-span-2"><input className="inp" value={f.rem} onChange={set('rem')} placeholder="Optional note" /></Field>
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm">
        <div className="ctitle mb-2 text-xs">Disbursal preview</div>
        <div className="grid grid-cols-2 gap-x-6">
          <div className="kv"><span className="text-slate-500">Advance interest ({ad}d)</span><span className="tabular-nums">{fmt(adv)}</span></div>
          <div className="kv"><span className="text-slate-500">Processing fee</span><span className="tabular-nums">{fmt(fee)}</span></div>
          <div className="kv"><span className="text-slate-500">GST on fee</span><span className="tabular-nums">{fmt(gst)}</span></div>
          <div className="kv"><span className="text-slate-500">Outstanding booked</span><span className="tabular-nums">{fmt(amt)}</span></div>
        </div>
        <div className="flex justify-between mt-2 pt-2 border-t border-slate-200 font-semibold text-navy-900"><span>Net disbursed to borrower</span><span className="tabular-nums">{fmt(disbursed)}</span></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={!(amt > 0)} onClick={save}>Record drawdown</button></div>
    </Modal>
  );
}

/* ---------- Record Payment ---------- */
function RecordPayment({ b, drawdowns, preselect, onClose, onDone }) {
  const toast = useToast();
  const [ddId, setDdId] = useState(preselect ? String(preselect.id) : '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rem, setRem] = useState('');
  const [prev, setPrev] = useState(null);
  const [busy, setBusy] = useState(false);

  const doPreview = async (nextAmt, nextDate, nextDd) => {
    const dd = nextDd ?? ddId; const a = nextAmt ?? amount; const d = nextDate ?? date;
    if (!dd || !(+a > 0) || !d) { setPrev(null); return; }
    try { setPrev(await api.post('/payments/preview', { drawdownId: +dd, amount: +a, date: d })); }
    catch (e) { setPrev({ error: e.message }); }
  };
  const save = async () => {
    setBusy(true);
    try { await api.post('/payments', { drawdownId: +ddId, amount: +amount, date, rem }); toast('Payment recorded.'); onDone(); }
    catch (e) { toast(e.message, true); }
    finally { setBusy(false); }
  };
  const dd = drawdowns.find((d) => String(d.id) === String(ddId));
  return (
    <Modal title={'Record payment · ' + b.name} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Drawdown">
          <select className="inp" value={ddId} onChange={(e) => { setDdId(e.target.value); doPreview(null, null, e.target.value); }}>
            <option value="">— select an open drawdown —</option>
            {drawdowns.map((d) => <option key={d.id} value={d.id}>{(d.ref || 'Drawdown ' + d.id)} · outstanding {fmt(d.outPrin)}</option>)}
          </select>
        </Field>
        {dd && <div className="text-xs text-slate-500 -mt-1">Outstanding {fmt(dd.outPrin)} · accrued to date {fmt(dd.accrued)} · {dd.daysOpen}d open{dd.overdueDays > 0 ? ' · ' + dd.overdueDays + 'd overdue' : ''}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount received (₹)"><input type="number" className="inp" autoFocus value={amount} onChange={(e) => { setAmount(e.target.value); doPreview(e.target.value); }} /></Field>
          <Field label="Credit date"><input type="date" className="inp" value={date} onChange={(e) => { setDate(e.target.value); doPreview(null, e.target.value); }} /></Field>
        </div>
        <Field label="Remarks"><input className="inp" value={rem} onChange={(e) => setRem(e.target.value)} placeholder="Optional note" /></Field>

        {prev && !prev.error && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm">
            <div className="ctitle mb-2 text-xs">Allocation preview</div>
            <div className="kv"><span className="text-slate-500">Interest settled</span><span className="tabular-nums">{fmt(prev.alloc.intAdj)}</span></div>
            <div className="kv"><span className="text-slate-500">Principal reduced</span><span className="tabular-nums">{fmt(prev.alloc.prinAdj)}</span></div>
            {prev.alloc.overhang > 0 && <div className="kv"><span className="text-amber-600">Interest carried forward</span><span className="tabular-nums text-amber-600">{fmt(prev.alloc.overhang)}</span></div>}
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-200 font-semibold text-navy-900"><span>Outstanding after</span><span className="tabular-nums">{fmt(prev.alloc.outAfter)}</span></div>
            <div className="text-xs mt-1.5 text-slate-500">{prev.alloc.closed ? 'This closes the drawdown.' : 'Drawdown stays open.'}</div>
          </div>
        )}
        {prev && prev.error && <div className="text-sm text-rose-600">{prev.error}</div>}
      </div>
      <div className="flex justify-end gap-2 mt-4"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !ddId || !(+amount > 0)} onClick={save}>Record payment</button></div>
    </Modal>
  );
}

/* ---------- Upload document ---------- */
function UploadDoc({ borrowerId, onClose, onDone }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = React.useRef(null);
  const pick = (f) => { if (!f) return; if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { toast('Only PDF files are accepted.', true); return; } setFile(f); if (!title) setTitle(f.name.replace(/\.pdf$/i, '')); };
  const submit = async () => {
    if (!file) return toast('Attach a PDF.', true);
    setBusy(true);
    try { const form = new FormData(); form.append('file', file); form.append('title', title); await api.upload('/borrowers/' + borrowerId + '/documents', form); toast('Uploaded — sent to the Director for review.'); onDone(); }
    catch (e) { toast(e.message, true); } finally { setBusy(false); }
  };
  return (
    <Modal title="Upload document" onClose={onClose}>
      <Field label="Document title" className="mb-3"><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. March GST return" /></Field>
      {!file ? (
        <div onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          className={'rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition ' + (drag ? 'border-teal-500 bg-teal-50' : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50')}>
          <UploadIcon size={30} className="mx-auto text-teal-600" />
          <div className="mt-2 text-sm font-semibold text-navy-900">Drop a PDF here, or click to browse</div>
          <div className="text-xs text-slate-400 mt-0.5">PDF only · up to 25 MB · stored in this borrower's server folder</div>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="rounded-lg bg-rose-100 p-2"><FileText size={18} className="text-rose-600" /></div>
          <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-navy-900 truncate">{file.name}</div><div className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</div></div>
          <button className="text-slate-400 hover:text-slate-700" onClick={() => setFile(null)}><X size={18} /></button>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !file} onClick={submit}>{busy ? 'Uploading…' : 'Upload'}</button></div>
    </Modal>
  );
}

/* ---------- Edit borrower ---------- */
function EditBorrower({ b, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ ...b });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { await api.put('/borrowers/' + b.id, f); toast('Borrower updated.'); onDone(); } catch (e) { toast(e.message, true); } };
  return (
    <Modal title={'Edit · ' + b.name} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Borrower name" className="col-span-2"><input className="inp" value={f.name} onChange={set('name')} /></Field>
        <Field label="Business / sector"><input className="inp" value={f.biz || ''} onChange={set('biz')} /></Field>
        <Field label="Product"><select className="inp" value={f.loanType} onChange={set('loanType')}><option value="po">PO Finance</option><option value="io">Interest-Only</option></select></Field>
        <Field label="Sanctioned limit (₹)"><input type="number" className="inp" value={f.limit} onChange={set('limit')} /></Field>
        <Field label="Sanction date"><input type="date" className="inp" value={f.sanctionDate} onChange={set('sanctionDate')} /></Field>
        <Field label="Interest rate (% p.a.)"><input type="number" className="inp" value={f.rate} onChange={set('rate')} /></Field>
        <Field label="Penal charge (% p.a.)"><input type="number" className="inp" value={f.penRate} onChange={set('penRate')} /></Field>
        <Field label="Processing fee (%)"><input type="number" className="inp" value={f.procFeePct} onChange={set('procFeePct')} /></Field>
        <Field label="GST on fee (%)"><input type="number" className="inp" value={f.gstPct} onChange={set('gstPct')} /></Field>
        <Field label="Tenure"><input type="number" className="inp" value={f.tenure} onChange={set('tenure')} /></Field>
        <Field label="Tenure unit"><select className="inp" value={f.tenureUnit} onChange={set('tenureUnit')}><option value="days">Days</option><option value="months">Months</option></select></Field>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={save}>Save changes</button></div>
    </Modal>
  );
}

/* ---------- Documents tab ---------- */
function DocumentsTab({ borrowerId, documents, canEdit, role, onChange, onUpload }) {
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [reject, setReject] = useState(null);
  const decide = async (d, approve, reason) => {
    try { await api.post('/documents/' + d.id + '/decide', { approve, reason }); toast('Document ' + (approve ? 'approved' : 'rejected') + '.'); setPreview(null); setReject(null); onChange(); }
    catch (e) { toast(e.message, true); }
  };
  return (
    <Card title="Documents" right={canEdit && <button className="btn btn-xs btn-p" onClick={onUpload}><UploadIcon size={13} /> Upload</button>}>
      <Table cols={['Document', 'Uploaded by', 'When', 'Status', '']} rows={documents}
        render={(d) => (<>
          <td><button className="flex items-center gap-2 group text-left" onClick={() => setPreview(d)}><div className="rounded-lg bg-rose-100 p-1.5"><FileText size={14} className="text-rose-600" /></div><span className="font-semibold text-navy-900 group-hover:text-teal-600">{d.title}</span></button></td>
          <Td className="text-slate-500">{d.uploadedBy}</Td>
          <Td className="whitespace-nowrap text-slate-500">{fmtDate(d.uploadedAt)}</Td>
          <Td><Chip cls={STATUS[d.status].cls}>{STATUS[d.status].label}</Chip>{d.status === 'rejected' && d.reason && <div className="text-[11px] text-rose-600 mt-0.5 max-w-[200px]">{d.reason}</div>}</Td>
          <Td>
            <div className="flex items-center gap-1.5 justify-end">
              <button className="btn btn-xs" onClick={() => setPreview(d)}><Eye size={13} /></button>
              {role === 'director' && d.status === 'pending' && (<>
                <button className="btn btn-xs btn-p" onClick={() => decide(d, true)}><Check size={13} /></button>
                <button className="btn btn-xs btn-d" onClick={() => setReject(d)}><X size={13} /></button>
              </>)}
            </div>
          </Td>
        </>)} empty="No documents uploaded for this borrower yet." />

      {preview && (
        <Modal wide title={preview.title} onClose={() => setPreview(null)}>
          <div className="flex items-center justify-between mb-3 text-sm">
            <div className="text-slate-500">Uploaded by {preview.uploadedBy} · {fmtDate(preview.uploadedAt)}</div>
            <div className="flex items-center gap-2"><Chip cls={STATUS[preview.status].cls}>{STATUS[preview.status].label}</Chip><button className="btn btn-xs" onClick={() => openFile(preview.id)}><ExternalLink size={13} /> New tab</button></div>
          </div>
          <iframe title="pdf" src={fileUrl(preview.id)} className="w-full h-[70vh] rounded-xl border border-slate-200 bg-slate-50" />
          {role === 'director' && preview.status === 'pending' && (
            <div className="mt-4 flex justify-end gap-2"><button className="btn btn-d" onClick={() => setReject(preview)}><X size={15} /> Reject</button><button className="btn btn-p" onClick={() => decide(preview, true)}><Check size={15} /> Approve</button></div>
          )}
        </Modal>
      )}
      {reject && (
        <Modal title={'Reject “' + reject.title + '”'} onClose={() => setReject(null)}>
          <Field label="Reason (shared with the uploader)"><textarea className="inp" rows="3" autoFocus id="rej-reason" placeholder="e.g. Wrong period — please re-upload." /></Field>
          <div className="flex justify-end gap-2 mt-4"><button className="btn" onClick={() => setReject(null)}>Cancel</button><button className="btn btn-d" onClick={() => decide(reject, false, document.getElementById('rej-reason').value)}>Reject</button></div>
        </Modal>
      )}
    </Card>
  );
}
