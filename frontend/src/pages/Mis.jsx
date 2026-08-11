import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileBarChart2, Printer } from 'lucide-react';
import { api, downloadCSV } from '../api.js';
import { Card, Empty, Field, useLoad } from '../ui.jsx';
import { LedgerTable } from './BorrowerDetail.jsx';
import { fmt, fmtCr, fmtDate, pct } from '../format.js';

export default function Mis() {
  const [sp] = useSearchParams();
  const [borrowers] = useLoad(() => api.get('/borrowers'), []);
  const [bid, setBid] = useState(sp.get('borrowerId') || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => { if (bid) load(); /* auto-load when arriving with a borrower */ }, [bid]); // eslint-disable-line
  const load = async () => {
    try { const qs = [from && 'from=' + from, to && 'to=' + to].filter(Boolean).join('&'); setReport(await api.get('/mis/' + bid + (qs ? '?' + qs : ''))); setErr(null); }
    catch (e) { setErr(e.message); setReport(null); }
  };
  const exportCSV = () => {
    if (!report) return;
    const s = report.summary;
    const meta = [
      ['MIS Report', s.name], ['Generated', fmtDate(report.generatedAt, true)], ['As of', s.asOf], [],
      ['Sanctioned limit', s.limit], ['Drawn (cumulative)', s.drawn], ['Net disbursed', s.disbursedNet],
      ['Outstanding', s.outstanding], ['Available', s.available], ['Utilisation %', s.utilPct],
      ['Advance interest collected', Math.round(s.advCollected)], ['Fees collected', Math.round(s.feeCollected)], ['GST collected', Math.round(s.gstCollected)],
      ['Interest collected', Math.round(s.intCollected)], ['Interest earned', Math.round(s.interestEarned)], ['Income booked', Math.round(s.incomeBooked)],
      ['Accrued (open)', Math.round(s.accruedOpen)], ['Overdue days', s.overdueDays], ['IRR %', s.irr != null ? s.irr.toFixed(1) : ''], [], ['STATEMENT']
    ];
    const head = ['Date', 'Entry', 'Ref', 'Amount', 'Interest', 'Principal', 'Outstanding After'];
    const rows = report.statement.map((e) => [e.date, e.type, e.ref, Math.round(e.amount), e.intAdj != null ? Math.round(e.intAdj) : '', e.prinAdj != null ? Math.round(e.prinAdj) : '', e.outAfter != null ? Math.round(e.outAfter) : '']);
    downloadCSV('MIS_' + s.name.replace(/\s+/g, '_') + '_' + s.asOf + '.csv', ['Field', 'Value'], [...meta.map((m) => m.length ? m : ['', '']), head, ...rows]);
  };

  const s = report?.summary;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900 flex items-center gap-2"><FileBarChart2 size={22} className="text-teal-600" /> MIS Reports</h1>
          <p className="text-sm text-slate-500">Pick a borrower — the summary and statement are generated automatically from live activity.</p>
        </div>
        {report && <div className="flex gap-2"><button className="btn" onClick={() => window.print()}><Printer size={15} /> Print</button><button className="btn btn-p" onClick={exportCSV}><Download size={15} /> Export CSV</button></div>}
      </div>

      <Card>
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <Field label="Borrower" className="sm:col-span-2">
            <select className="inp" value={bid} onChange={(e) => setBid(e.target.value)}>
              <option value="">— select a borrower —</option>
              {(borrowers || []).map((b) => <option key={b.borrowerId} value={b.borrowerId}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="From"><input type="date" className="inp" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" className="inp" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        {bid && <div className="mt-3"><button className="btn btn-g btn-xs" onClick={load}>Regenerate</button></div>}
      </Card>

      {err && <Card><Empty>{err}</Empty></Card>}
      {!bid && <Card><Empty>Select a borrower to generate its MIS report.</Empty></Card>}

      {s && (
        <>
          <Card title={'Summary · ' + s.name} right={<span className="text-xs text-slate-400">as of {fmtDate(s.asOf)}</span>}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Sanctioned" value={fmtCr(s.limit)} />
              <Metric label="Drawn (cum.)" value={fmtCr(s.drawn)} />
              <Metric label="Net disbursed" value={fmtCr(s.disbursedNet)} />
              <Metric label="Outstanding" value={fmtCr(s.outstanding)} tone="text-teal-600" />
              <Metric label="Available" value={fmtCr(s.available)} />
              <Metric label="Utilisation" value={s.utilPct + '%'} tone={s.utilPct > 90 ? 'text-rose-600' : 'text-navy-900'} />
              <Metric label="Advance collected" value={fmt(s.advCollected)} />
              <Metric label="Fees collected" value={fmt(s.feeCollected)} />
              <Metric label="Interest collected" value={fmt(s.intCollected)} />
              <Metric label="Interest earned" value={fmt(s.interestEarned)} tone="text-emerald-600" />
              <Metric label="Income booked" value={fmt(s.incomeBooked)} />
              <Metric label="Accrued (open)" value={fmt(s.accruedOpen)} tone={s.overdueDays > 0 ? 'text-rose-600' : 'text-navy-900'} sub={s.overdueDays > 0 ? s.overdueDays + 'd overdue' : ''} />
              <Metric label="Portfolio IRR" value={pct(s.irr)} />
              <Metric label="Active drawdowns" value={s.activeDrawdowns + ' / ' + s.totalDrawdowns} />
              <Metric label="Renewal due" value={s.renewal ? fmtDate(s.renewal.renewDate) : '—'} sub={s.renewal ? (s.renewal.status === 'overdue' ? 'overdue' : s.renewal.daysLeft + 'd left') : ''} />
            </div>
          </Card>
          <Card title="Account statement">
            <LedgerTable rows={report.statement} />
          </Card>
        </>
      )}
    </div>
  );
}

const Metric = ({ label, value, sub, tone = 'text-navy-900' }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
    <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
    <div className={'font-display font-bold text-lg ' + tone}>{value}</div>
    {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
  </div>
);
