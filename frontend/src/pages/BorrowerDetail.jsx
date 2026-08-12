import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Wallet2, Upload as UploadIcon, FileBarChart2, Pencil, Trash2, Banknote,
  RefreshCw, Building2, CalendarClock, Mail, Phone, ArrowUpDown, Info
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import {
  Card, Chip, Confirm, Empty, Field, Modal, PageHead, Spinner, Table, Tabs, Td, useToast,
  ErrorNote, Meter, Skeleton, KV
} from '../ui.jsx';
import { useLoad } from '../hooks.js';
import LedgerTable from '../components/LedgerTable.jsx';
import { DocumentTable, UploadDoc } from '../components/DocumentPanel.jsx';
import { BorrowerForm } from './Borrowers.jsx';
import { fmt, fmtCr, fmtDate, pct, today, STATUS, PRODUCT, ADV_MODES, advPreview } from '../format.js';

export default function BorrowerDetail() {
  const { id } = useParams();
  const user = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const canEdit = user.role !== 'analyst';
  const isDirector = user.role === 'director';

  const { data, error, loading, reload } = useLoad(() => api.borrower(id), [id]);
  const [tab, setTab] = useState('drawdowns');
  const [modal, setModal] = useState(null);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  if (error) {
    return (
      <Card>
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
        <div className="mt-4 text-center"><Link className="btn" to="/borrowers"><ArrowLeft size={15} /> All borrowers</Link></div>
      </Card>
    );
  }
  if (loading || !data) return <DetailSkeleton />;

  const { borrower: b, summary: s, drawdowns, payments, documents, ledger, limitHistory } = data;
  const close = () => { setModal(null); setTarget(null); };
  const done = () => { close(); reload(); };

  const act = async (fn, msg) => {
    setBusy(true);
    try { await fn(); toast(msg); done(); }
    catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const TABS = [
    ['drawdowns', 'Drawdowns', drawdowns.length],
    ['payments', 'Payments', payments.length],
    ['ledger', 'Ledger', ledger.length],
    ['limits', 'Limit history', limitHistory.length],
    ['documents', 'Documents', documents.length]
  ];

  return (
    <div className="space-y-5">
      <Link to="/borrowers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-200">
        <ArrowLeft size={14} /> All borrowers
      </Link>

      <PageHead title={b.name}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
          <span className="flex items-center gap-1.5"><Building2 size={13} /> {b.biz || 'Sector not set'}</span>
          <span>{b.rate}% p.a. · penal +{b.penRate}%</span>
          <span>{b.tenure} {b.tenureUnit} tenure</span>
          <span className="flex items-center gap-1.5"><CalendarClock size={13} /> sanctioned {fmtDate(b.sanctionDate)}</span>
        </span>}>
        {canEdit && b.status === 'active' && <button className="btn btn-p" onClick={() => setModal('dd')}><Plus size={15} /> New drawdown</button>}
        {canEdit && <button className="btn" onClick={() => { setTarget(null); setModal('pay'); }}><Wallet2 size={15} /> Record payment</button>}
        {canEdit && <button className="btn" onClick={() => setModal('upload')}><UploadIcon size={15} /> Upload</button>}
        <button className="btn" onClick={() => nav('/mis?borrowerId=' + id)}><FileBarChart2 size={15} /> MIS</button>
        {canEdit && <button className="btn btn-icon" onClick={() => setModal('edit')} title="Edit facility"><Pencil size={15} /></button>}
        {canEdit && <button className="btn btn-icon text-rose-300" onClick={() => setModal('delBorrower')} title="Delete borrower"><Trash2 size={15} /></button>}
      </PageHead>

      <div className="flex flex-wrap items-center gap-2">
        <Chip cls={PRODUCT[b.loanType].cls}>{PRODUCT[b.loanType].label}</Chip>
        <Chip cls={STATUS[b.status].cls}>{STATUS[b.status].label} facility</Chip>
        {b.isSample && <Chip cls="chip-pink">reference example</Chip>}
        {s.overdueDays > 0 && <Chip cls="chip-bad">{s.overdueDays} days overdue</Chip>}
        {s.renewal && s.renewal.status !== 'ok' && (
          <Chip cls="chip-warn">Renewal {s.renewal.status === 'overdue' ? 'overdue' : 'in ' + s.renewal.daysLeft + 'd'} · {fmtDate(s.renewal.renewDate)}</Chip>
        )}
        {(b.pan || b.gstin) && <Chip cls="chip-slate">{[b.pan, b.gstin].filter(Boolean).join(' · ')}</Chip>}
        {b.contactEmail && <a className="chip-slate hover:text-white" href={'mailto:' + b.contactEmail}><Mail size={11} /> {b.contactEmail}</a>}
        {b.contactPhone && <span className="chip-slate"><Phone size={11} /> {b.contactPhone}</span>}
      </div>

      {/* ---- summary ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Sanctioned limit" value={fmtCr(s.limit)}
          sub={s.limitIncreases ? `base ${fmtCr(s.baseLimit)} + ${fmtCr(s.limitIncreases)} enhanced` : 'no enhancements'} />
        <MiniStat label="Outstanding" value={fmtCr(s.outstanding)} tone="text-neon-cyan"
          chart={<Meter value={s.outstanding} max={s.limit || 1} label={`${s.utilPct}% utilised · ${fmtCr(s.available)} available`} />} />
        <MiniStat label="Interest earned" value={fmt(s.interestEarned)} tone="text-emerald-300"
          sub={`advance ${fmt(s.advCollected)} · collected ${fmt(s.intCollected)}`} />
        <MiniStat label="Fees + GST" value={fmt(s.feeCollected + s.gstCollected)} sub={`fee ${fmt(s.feeCollected)} · GST ${fmt(s.gstCollected)}`} />
        <MiniStat label="Accrued, unbilled" value={fmt(s.accruedOpen)} tone={s.overdueDays > 0 ? 'text-rose-300' : 'text-slate-100'}
          sub={s.overdueDays > 0 ? `${s.overdueDays}d overdue on ${fmt(s.overdueAmount)}` : 'within tenure'} />
        <MiniStat label="Income booked" value={fmt(s.incomeBooked)} sub="advance + interest + fees" />
        <MiniStat label="IRR" value={pct(s.irr)} tone={s.irr >= 0 ? 'text-emerald-300' : 'text-rose-300'}
          sub="annualised, open drawdowns marked to today" />
        <MiniStat label="Renewal due" value={s.renewal ? fmtDate(s.renewal.renewDate) : '—'}
          tone={s.renewal && s.renewal.status !== 'ok' ? 'text-neon-amber' : 'text-slate-100'}
          sub={s.renewal ? (s.renewal.status === 'overdue' ? 'overdue' : s.renewal.daysLeft + ' days left') : 'no sanction date'} />
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {/* ---- drawdowns ---- */}
      {tab === 'drawdowns' && (
        <Card>
          <Table cols={['Ref', 'Debit date', 'Matures', '#Principal', '#Net disbursed', '#Adv int', '#Fee+GST', '#Outstanding', '#Accrued', '#Days', 'Status', '']}
            rows={drawdowns}
            empty={<Empty icon={Banknote} title="No drawdowns yet"
              action={canEdit ? <button className="btn btn-p" onClick={() => setModal('dd')}><Plus size={15} /> Record the first disbursal</button> : null}>
              Each disbursal against this facility is recorded here, with its advance interest, fees and running outstanding.
            </Empty>}
            render={(d) => (
              <>
                <td className="font-mono text-[11px] font-semibold text-slate-200">
                  {d.ref || '—'}
                  {d.rotatedFrom && <Chip cls="chip-slate ml-1.5">rotated</Chip>}
                  {d.rem && <span className="mt-0.5 block max-w-[11rem] truncate font-sans text-[11px] font-normal text-slate-500" title={d.rem}>{d.rem}</span>}
                </td>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(d.bankDebit)}</Td>
                <Td className={'whitespace-nowrap ' + (d.overdueDays > 0 ? 'text-rose-300' : 'text-slate-500')}>{fmtDate(d.dueDate)}</Td>
                <Td r>{fmt(d.poAmt)}</Td>
                <Td r>{fmt(d.disbursed)}</Td>
                <Td r className="text-slate-500">{fmt(d.adv)}</Td>
                <Td r className="text-slate-500">{fmt(d.fee + d.gstAmt)}</Td>
                <Td r className="font-semibold text-slate-100">{fmt(d.outPrin)}</Td>
                <Td r className={d.overdueDays > 0 ? 'text-rose-300' : 'text-slate-400'}>{d.status === 'Repaid' ? '—' : fmt(d.accrued)}</Td>
                <Td r className="text-slate-500">{d.daysOpen}{d.overdueDays > 0 && <span className="text-rose-300"> (+{d.overdueDays})</span>}</Td>
                <Td><Chip cls={STATUS[d.status].cls}>{STATUS[d.status].label}</Chip></Td>
                <Td>
                  <span className="flex items-center justify-end gap-1.5">
                    {canEdit && d.status !== 'Repaid' && (
                      <button className="btn btn-xs btn-p" onClick={() => { setTarget(d); setModal('pay'); }}><Banknote size={12} /> Pay</button>
                    )}
                    {canEdit && d.status !== 'Repaid' && (
                      <button className="btn btn-xs" onClick={() => { setTarget(d); setModal('rotate'); }} title="Roll into a new drawdown"><RefreshCw size={12} /></button>
                    )}
                    {canEdit && (
                      <button className="btn btn-ghost btn-xs text-rose-300" onClick={() => { setTarget(d); setModal('delDrawdown'); }} title="Delete"><Trash2 size={13} /></button>
                    )}
                  </span>
                </Td>
              </>
            )} />
        </Card>
      )}

      {/* ---- payments ---- */}
      {tab === 'payments' && (
        <Card subtitle="Receipts settle interest first — penal charge and any carried interest before principal.">
          <Table cols={['Date', 'Ref', 'Entry', '#Amount', '#Interest', '#Principal', '#Outstanding after', 'Remarks', '']}
            rows={payments}
            empty={<Empty icon={Wallet2} title="No payments recorded">When money comes back, record it against the drawdown it repays.</Empty>}
            render={(p) => (
              <>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(p.date)}</Td>
                <td className="font-mono text-[11px] text-slate-500">{p.ref || '—'}</td>
                <Td>
                  <Chip cls={p.kind === 'rotation' ? 'chip-violet' : p.closed ? 'chip-slate' : 'chip-cyan'}>
                    {p.kind === 'rotation' ? 'Rotation' : p.closed ? 'Full / closure' : p.prinAdj > 0 ? 'Part payment' : 'Interest only'}
                  </Chip>
                </Td>
                <Td r className="font-semibold text-slate-100">{fmt(p.amount)}</Td>
                <Td r className="text-slate-400">{fmt(p.intAdj)}</Td>
                <Td r className="text-slate-400">{fmt(p.prinAdj)}</Td>
                <Td r>{fmt(p.outAfter)}</Td>
                <Td className="max-w-[12rem] truncate text-slate-500" title={p.rem}>{p.rem || '—'}</Td>
                <Td>
                  <span className="flex items-center justify-end gap-1.5">
                    {canEdit && p.kind !== 'rotation' && (
                      <button className="btn btn-ghost btn-xs" onClick={() => { setTarget(p); setModal('editPay'); }} title="Edit"><Pencil size={13} /></button>
                    )}
                    {canEdit && (
                      <button className="btn btn-ghost btn-xs text-rose-300" onClick={() => { setTarget(p); setModal('delPayment'); }} title="Reverse"><Trash2 size={13} /></button>
                    )}
                  </span>
                </Td>
              </>
            )} />
          {payments.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
              <Info size={12} /> Editing or reversing a receipt re-derives the drawdown from its whole payment history, so back-dated entries stay consistent.
            </p>
          )}
        </Card>
      )}

      {tab === 'ledger' && <Card subtitle="Generated automatically from the drawdowns and payments above."><LedgerTable rows={ledger} /></Card>}

      {/* ---- limit history ---- */}
      {tab === 'limits' && (
        <Card title="Sanctioned limit"
          subtitle={`Base ${fmtCr(s.baseLimit)} plus approved enhancements. The current limit is ${fmtCr(s.limit)}.`}
          right={isDirector && <button className="btn btn-xs btn-p" onClick={() => setModal('limit')}><ArrowUpDown size={12} /> Record enhancement</button>}>
          <Table cols={['Effective', '#Change', '#Running limit', 'Note', 'Recorded by', '']}
            rows={runningLimits(limitHistory, s.baseLimit)}
            empty={<Empty icon={ArrowUpDown} title="No enhancements recorded"
              action={isDirector ? <button className="btn btn-p" onClick={() => setModal('limit')}><Plus size={15} /> Record an enhancement</button> : null}>
              The sanctioned limit is still at its original {fmtCr(s.baseLimit)}. Enhancements are a Director action.
            </Empty>}
            render={(l) => (
              <>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(l.date)}</Td>
                <Td r className={l.incrAmt >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{l.incrAmt >= 0 ? '+' : ''}{fmt(l.incrAmt)}</Td>
                <Td r className="font-semibold text-slate-100">{fmt(l.running)}</Td>
                <Td className="text-slate-400">{l.note || '—'}</Td>
                <Td className="text-slate-500">{l.createdBy}</Td>
                <Td>{isDirector && (
                  <button className="btn btn-ghost btn-xs text-rose-300" onClick={() => { setTarget(l); setModal('delLimit'); }} title="Reverse"><Trash2 size={13} /></button>
                )}</Td>
              </>
            )} />
        </Card>
      )}

      {tab === 'documents' && (
        <Card title="Documents" subtitle="Uploads wait for Director approval before they count as filed."
          right={canEdit && <button className="btn btn-xs btn-p" onClick={() => setModal('upload')}><UploadIcon size={12} /> Upload</button>}>
          <DocumentTable documents={documents} user={user} onChange={reload}
            emptyAction={canEdit ? <button className="btn btn-p" onClick={() => setModal('upload')}><UploadIcon size={15} /> Upload a PDF</button> : null} />
        </Card>
      )}

      {/* ---------------- modals ---------------- */}
      {modal === 'dd' && <NewDrawdown b={b} summary={s} onClose={close} onDone={done} />}
      {modal === 'pay' && (
        <RecordPayment b={b} drawdowns={drawdowns.filter((d) => d.status !== 'Repaid')} preselect={target} onClose={close} onDone={done} />
      )}
      {modal === 'editPay' && <EditPayment payment={target} onClose={close} onDone={done} />}
      {modal === 'rotate' && <RotateDrawdown b={b} dd={target} onClose={close} onDone={done} />}
      {modal === 'upload' && <UploadDoc borrowerId={id} borrowerName={b.name} onClose={close} onDone={done} />}
      {modal === 'edit' && <BorrowerForm initial={b} onClose={close} onDone={done} />}
      {modal === 'limit' && <LimitForm b={b} summary={s} onClose={close} onDone={done} />}

      {modal === 'delBorrower' && (
        <Confirm danger busy={busy} title="Delete this borrower?" confirmLabel="Delete borrower" phrase="DELETE"
          onCancel={close} onConfirm={() => act(() => api.deleteBorrower(id).then(() => nav('/borrowers')), 'Borrower deleted.')}>
          <b className="text-slate-100">{b.name}</b> and all {drawdowns.length} drawdown(s), {payments.length} payment(s),
          {' '}{limitHistory.length} limit entr{limitHistory.length === 1 ? 'y' : 'ies'} and {documents.length} document(s)
          will be removed. This cannot be undone.
        </Confirm>
      )}
      {modal === 'delDrawdown' && (
        <Confirm danger busy={busy} title="Delete this drawdown?" confirmLabel="Delete"
          onCancel={close} onConfirm={() => act(() => api.deleteDrawdown(target.id), 'Drawdown deleted.')}>
          <b className="text-slate-100">{target.ref || 'Drawdown #' + target.id}</b> and every payment against it will be removed.
          {target.rotatedFrom ? ' Because this drawdown came from a rotation, the settlement booked on the original will be unwound too.' : ''}
        </Confirm>
      )}
      {modal === 'delPayment' && (
        <Confirm danger busy={busy} title="Reverse this payment?" confirmLabel="Reverse payment"
          onCancel={close} onConfirm={() => act(() => api.deletePayment(target.id), 'Payment reversed.')}>
          The receipt of <b className="text-slate-100">{fmt(target.amount)}</b> dated {fmtDate(target.date)} will be removed and the
          drawdown re-derived from its remaining payments.
        </Confirm>
      )}
      {modal === 'delLimit' && (
        <Confirm danger busy={busy} title="Reverse this limit entry?" confirmLabel="Reverse"
          onCancel={close} onConfirm={() => act(() => api.deleteLimit(id, target.id), 'Limit entry reversed.')}>
          The enhancement of <b className="text-slate-100">{fmt(target.incrAmt)}</b> dated {fmtDate(target.date)} will be removed.
        </Confirm>
      )}
    </div>
  );
}

/* running limit column for the limit-history table */
function runningLimits(history, base) {
  const asc = history.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  let running = base;
  const withRunning = asc.map((l) => { running += l.incrAmt; return { ...l, running }; });
  return withRunning.reverse();
}

const MiniStat = ({ label, value, sub, tone = 'text-slate-100', chart }) => (
  <div className="card-tight">
    <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</p>
    <p className={'font-display text-xl font-bold leading-tight num mt-0.5 ' + tone}>{value}</p>
    {chart ? <div className="mt-2">{chart}</div> : sub ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{sub}</p> : null}
  </div>
);

const DetailSkeleton = () => (
  <div className="space-y-5">
    <Skeleton className="h-4 w-28" />
    <Skeleton className="h-10 w-80" />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
    </div>
    <Skeleton className="h-72" />
  </div>
);

/* ============================================================================
   New drawdown
   ========================================================================== */
function NewDrawdown({ b, summary, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({
    ref: '', poAmt: '', bankDebit: today(),
    mode: b.loanType === 'io' ? '1m' : '30d', cd: '30', feePct: String(b.procFeePct), rem: ''
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const amt = +f.poAmt || 0;
  const { adv, ad } = advPreview(amt, b.rate, f.mode, f.cd);
  const fee = amt * (+f.feePct || 0) / 100;
  const gst = fee * (+b.gstPct || 0) / 100;
  const net = amt - adv - fee - gst;
  const over = amt > summary.available;

  const save = async () => {
    setBusy(true);
    try { await api.createDrawdown({ borrowerId: b.id, ...f }); toast('Drawdown recorded.'); onDone(); }
    catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal size="lg" title={'New drawdown · ' + b.name}
      subtitle={`${fmtCr(summary.available)} available of the ${fmtCr(summary.limit)} sanctioned limit`}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" onClick={save} disabled={busy || !(amt > 0) || over}>{busy && <Spinner />}Record drawdown</button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="PO / reference"><input className="inp" autoFocus value={f.ref} onChange={set('ref')} placeholder="e.g. PML/PO-2403" /></Field>
        <Field label="Debit date"><input type="date" className="inp" value={f.bankDebit} onChange={set('bankDebit')} /></Field>
        <Field label={b.loanType === 'io' ? 'Principal (₹)' : 'PO amount (₹)'}
          error={over ? 'Exceeds the available limit of ' + fmt(summary.available) : null}>
          <input type="number" min="0" className="inp" value={f.poAmt} onChange={set('poAmt')} placeholder="4000000" />
        </Field>
        <Field label="Advance interest">
          <select className="inp" value={f.mode} onChange={set('mode')}>
            {ADV_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {f.mode === 'custom' && <Field label="Custom advance days"><input type="number" min="1" className="inp" value={f.cd} onChange={set('cd')} /></Field>}
        <Field label="Processing fee (%)" hint={'Facility default ' + b.procFeePct + '%'}>
          <input type="number" step="0.01" min="0" className="inp" value={f.feePct} onChange={set('feePct')} />
        </Field>
        <Field label="Remarks" className="sm:col-span-2"><input className="inp" value={f.rem} onChange={set('rem')} placeholder="Optional note" /></Field>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <p className="ctitle mb-2">Disbursal preview</p>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <KV k={`Advance interest (${ad}d)`} v={fmt(adv)} />
          <KV k="Processing fee" v={fmt(fee)} />
          <KV k={`GST on fee (${b.gstPct}%)`} v={fmt(gst)} />
          <KV k="Booked as outstanding" v={fmt(amt)} />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2.5">
          <span className="font-display text-sm font-bold text-white">Net disbursed to borrower</span>
          <span className="num font-display text-lg font-bold text-neon-cyan">{fmt(net)}</span>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================================
   Record payment — server-side allocation preview as the user types
   ========================================================================== */
function RecordPayment({ b, drawdowns, preselect, onClose, onDone }) {
  const toast = useToast();
  const [ddId, setDdId] = useState(preselect ? String(preselect.id) : (drawdowns.length === 1 ? String(drawdowns[0].id) : ''));
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [rem, setRem] = useState('');
  const [prev, setPrev] = useState(null);
  const [busy, setBusy] = useState(false);

  const dd = drawdowns.find((d) => String(d.id) === String(ddId));

  const refresh = async (next = {}) => {
    const d = next.ddId ?? ddId, a = next.amount ?? amount, dt = next.date ?? date;
    if (!d || !(+a > 0) || !dt) return setPrev(null);
    try { setPrev(await api.previewPayment({ drawdownId: +d, amount: +a, date: dt })); }
    catch (e) { setPrev({ error: e.message }); }
  };

  const settleAll = () => {
    if (!dd) return;
    const full = String(Math.round(dd.dueTotal));
    setAmount(full);
    refresh({ amount: full });
  };

  const save = async () => {
    setBusy(true);
    try { await api.createPayment({ drawdownId: +ddId, amount: +amount, date, rem }); toast('Payment recorded.'); onDone(); }
    catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal title={'Record payment · ' + b.name} subtitle="Interest settles first — penal charge and carried interest before principal."
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" onClick={save} disabled={busy || !ddId || !(+amount > 0) || (prev && prev.error)}>
          {busy && <Spinner />}Record payment
        </button>
      </>}>
      {!drawdowns.length ? (
        <Empty icon={Wallet2} title="No open drawdowns">Every drawdown on this facility is already repaid.</Empty>
      ) : (
        <div className="space-y-3">
          <Field label="Against drawdown">
            <select className="inp" value={ddId} onChange={(e) => { setDdId(e.target.value); refresh({ ddId: e.target.value }); }}>
              <option value="">— select an open drawdown —</option>
              {drawdowns.map((d) => (
                <option key={d.id} value={d.id}>{(d.ref || 'Drawdown #' + d.id) + ' · outstanding ' + fmt(d.outPrin)}</option>
              ))}
            </select>
          </Field>

          {dd && (
            <div className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-[12px] text-slate-400">
              Outstanding <b className="num text-slate-200">{fmt(dd.outPrin)}</b> · accrued to date{' '}
              <b className="num text-slate-200">{fmt(dd.accrued)}</b> · {dd.daysOpen}d open
              {dd.overdueDays > 0 && <span className="text-rose-300"> · {dd.overdueDays}d overdue</span>}
              <button className="btn btn-xs ml-2" onClick={settleAll}>Settle in full ({fmt(dd.dueTotal)})</button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount received (₹)">
              <input type="number" min="0" className="inp" autoFocus value={amount}
                onChange={(e) => { setAmount(e.target.value); refresh({ amount: e.target.value }); }} />
            </Field>
            <Field label="Credit date">
              <input type="date" className="inp" value={date}
                onChange={(e) => { setDate(e.target.value); refresh({ date: e.target.value }); }} />
            </Field>
          </div>
          <Field label="Remarks"><input className="inp" value={rem} onChange={(e) => setRem(e.target.value)} placeholder="Optional note" /></Field>

          {prev && !prev.error && (
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
              <p className="ctitle mb-2">Allocation preview</p>
              <KV k="Interest settled" v={fmt(prev.alloc.intAdj)} />
              <KV k="Principal reduced" v={fmt(prev.alloc.prinAdj)} />
              {prev.alloc.overhang > 0 && <KV k="Interest carried forward" v={fmt(prev.alloc.overhang)} tone="text-neon-amber" />}
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2.5">
                <span className="font-display text-sm font-bold text-white">Outstanding after</span>
                <span className="num font-display text-lg font-bold text-neon-cyan">{fmt(prev.alloc.outAfter)}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {prev.alloc.closed ? 'This closes the drawdown.' : 'The drawdown stays open.'}
              </p>
            </div>
          )}
          {prev?.error && <p className="rounded-xl border border-state-bad/30 bg-state-bad/10 px-3 py-2 text-[13px] text-rose-200">{prev.error}</p>}
        </div>
      )}
    </Modal>
  );
}

/* ============================================================================
   Edit an existing receipt (amount / date / remark), then replay
   ========================================================================== */
function EditPayment({ payment, onClose, onDone }) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(payment.amount));
  const [date, setDate] = useState(payment.date);
  const [rem, setRem] = useState(payment.rem || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try { await api.updatePayment(payment.id, { amount: +amount, date, rem }); toast('Payment updated.'); onDone(); }
    catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal size="sm" title="Edit payment" subtitle="The drawdown is re-derived from its full payment history afterwards."
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" onClick={save} disabled={busy || !(+amount > 0)}>{busy && <Spinner />}Save</button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount (₹)"><input type="number" className="inp" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Credit date"><input type="date" className="inp" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Remarks" className="mt-3"><input className="inp" value={rem} onChange={(e) => setRem(e.target.value)} /></Field>
    </Modal>
  );
}

/* ============================================================================
   Rotation — roll an open drawdown into a fresh one
   ========================================================================== */
function RotateDrawdown({ b, dd, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ date: today(), mode: '30d', cd: '30', ref: (dd.ref || '') + '-R', feePct: String(b.procFeePct), rem: '', capitalise: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const accrued = dd.accrued;
  const newPrincipal = dd.outPrin + (f.capitalise ? accrued : 0);
  const settlement = dd.outPrin + accrued;
  const { adv, ad } = advPreview(newPrincipal, b.rate, f.mode, f.cd);
  const fee = newPrincipal * (+f.feePct || 0) / 100;
  const gst = fee * (+b.gstPct || 0) / 100;

  const save = async () => {
    setBusy(true);
    try {
      await api.rotateDrawdown(dd.id, {
        date: f.date, mode: f.mode, cd: f.cd, ref: f.ref, feePct: f.feePct, rem: f.rem, capitaliseInterest: f.capitalise
      });
      toast('Rotated into a new drawdown.');
      onDone();
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal size="lg" title={'Rotate · ' + (dd.ref || 'Drawdown #' + dd.id)}
      subtitle="The outstanding principal rolls into a fresh drawdown with a new tenure clock; the original is settled."
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" onClick={save} disabled={busy || !(newPrincipal > 0)}>{busy && <Spinner />}Rotate</button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Rotation date"><input type="date" className="inp" value={f.date} onChange={set('date')} /></Field>
        <Field label="New PO / reference"><input className="inp" value={f.ref} onChange={set('ref')} /></Field>
        <Field label="Advance interest on the new drawdown">
          <select className="inp" value={f.mode} onChange={set('mode')}>
            {ADV_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {f.mode === 'custom' && <Field label="Custom advance days"><input type="number" min="1" className="inp" value={f.cd} onChange={set('cd')} /></Field>}
        <Field label="Processing fee (%)"><input type="number" step="0.01" min="0" className="inp" value={f.feePct} onChange={set('feePct')} /></Field>
        <Field label="Remarks" className="sm:col-span-2"><input className="inp" value={f.rem} onChange={set('rem')} placeholder="Optional note" /></Field>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-3.5">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#8069f5]" checked={f.capitalise} onChange={set('capitalise')} />
        <span>
          <span className="block text-sm font-medium text-slate-200">Capitalise the accrued interest</span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500">
            Off: the borrower pays {fmt(accrued)} in cash and only principal rolls forward.
            On: the interest is added to the new principal instead.
          </span>
        </span>
      </label>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <p className="ctitle mb-2">What will be booked</p>
        <KV k="Interest accrued to the rotation date" v={fmt(accrued)} />
        <KV k="Settlement recorded on the original" v={fmt(settlement)} />
        <KV k={'Advance interest on the new drawdown (' + ad + 'd)'} v={fmt(adv)} />
        <KV k="Fee + GST on the new drawdown" v={fmt(fee + gst)} />
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2.5">
          <span className="font-display text-sm font-bold text-white">New drawdown principal</span>
          <span className="num font-display text-lg font-bold text-neon-violet">{fmt(newPrincipal)}</span>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================================
   Sanctioned-limit enhancement (Director)
   ========================================================================== */
function LimitForm({ b, summary, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ incrAmt: '', date: today(), note: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const next = summary.limit + (+f.incrAmt || 0);
  const invalid = next < summary.outstanding;

  const save = async () => {
    setBusy(true);
    try { await api.addLimit(b.id, { incrAmt: +f.incrAmt, date: f.date, note: f.note }); toast('Limit updated.'); onDone(); }
    catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal size="sm" title="Record a limit enhancement" subtitle={'Current sanctioned limit ' + fmtCr(summary.limit)}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" onClick={save} disabled={busy || !(+f.incrAmt) || invalid}>{busy && <Spinner />}Record</button>
      </>}>
      <div className="space-y-3">
        <Field label="Change (₹)" hint="Use a negative amount to reduce the limit."
          error={invalid ? 'That would take the limit below the outstanding of ' + fmt(summary.outstanding) : null}>
          <input type="number" className="inp" autoFocus value={f.incrAmt} onChange={set('incrAmt')} placeholder="2500000" />
        </Field>
        <Field label="Effective date"><input type="date" className="inp" value={f.date} onChange={set('date')} /></Field>
        <Field label="Note"><input className="inp" value={f.note} onChange={set('note')} placeholder="e.g. Enhancement after Q3 review" /></Field>
        <div className="rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2.5">
          <KV k="Limit after this entry" v={fmt(next)} tone={invalid ? 'text-rose-300' : 'text-neon-violet'} />
          <KV k="Available headroom" v={fmt(Math.max(0, next - summary.outstanding))} />
        </div>
        <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
          <Info size={12} className="mt-0.5 shrink-0" />
          A limit event also restarts the one-year renewal clock for this facility.
        </p>
      </div>
    </Modal>
  );
}
