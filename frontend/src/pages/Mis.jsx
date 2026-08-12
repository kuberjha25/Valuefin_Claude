import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileBarChart2, Printer, RefreshCw } from 'lucide-react';
import { api, downloadCSV } from '../api.js';
import { Card, Chip, Empty, ErrorNote, Field, PageHead, Spinner } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import LedgerTable from '../components/LedgerTable.jsx';
import { MonthlyColumns, UtilRing } from '../charts.jsx';
import { fmt, fmtCr, fmtDate, pct, PRODUCT, STATUS } from '../format.js';

export default function Mis() {
  const [sp, setSp] = useSearchParams();
  const { data: borrowers } = useLoad(() => api.borrowers({ sort: 'name', dir: 'asc' }), []);

  const [bid, setBid] = useState(sp.get('borrowerId') || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async (id = bid) => {
    if (!id) { setReport(null); return; }
    setBusy(true);
    try { setReport(await api.mis(id, { from, to })); setError(null); }
    catch (e) { setError(e.message); setReport(null); }
    finally { setBusy(false); }
  };

  useEffect(() => { if (bid) load(bid); /* auto-generate when a borrower is chosen */ }, [bid]); // eslint-disable-line

  const pick = (id) => { setBid(id); setSp(id ? { borrowerId: id } : {}, { replace: true }); };

  const s = report?.summary;

  const exportCSV = () => {
    if (!report) return;
    const meta = [
      ['MIS report', s.name], ['Generated', fmtDate(report.generatedAt, true)], ['As at', s.asOf],
      ['Product', PRODUCT[s.loanType].label], ['Interest rate % p.a.', s.rate], ['Tenure', s.tenure + ' ' + s.tenureUnit], [],
      ['Sanctioned limit', Math.round(s.limit)], ['— base limit', Math.round(s.baseLimit)], ['— enhancements', Math.round(s.limitIncreases)],
      ['Drawn (cumulative)', Math.round(s.drawn)], ['Net disbursed', Math.round(s.disbursedNet)],
      ['Outstanding', Math.round(s.outstanding)], ['Available', Math.round(s.available)], ['Utilisation %', s.utilPct], [],
      ['Advance interest collected', Math.round(s.advCollected)], ['Processing fees collected', Math.round(s.feeCollected)],
      ['GST collected', Math.round(s.gstCollected)], ['Interest collected', Math.round(s.intCollected)],
      ['Principal repaid', Math.round(s.principalRepaid)], ['Interest earned', Math.round(s.interestEarned)],
      ['Income booked', Math.round(s.incomeBooked)], ['Accrued, unbilled', Math.round(s.accruedOpen)], [],
      ['Overdue days', s.overdueDays], ['Overdue principal', Math.round(s.overdueAmount)],
      ['Active drawdowns', s.activeDrawdowns + ' of ' + s.totalDrawdowns],
      ['IRR %', s.irr != null ? s.irr.toFixed(2) : ''],
      ['Renewal due', s.renewal ? s.renewal.renewDate : ''], [], ['ACCOUNT STATEMENT']
    ];
    downloadCSV('MIS_' + s.name.replace(/\s+/g, '_') + '_' + s.asOf + '.csv', ['Field', 'Value'], [
      ...meta.map((m) => (m.length ? m : ['', ''])),
      ['Date', 'Entry', 'Ref', 'Amount', 'Adv int', 'Fee', 'GST', 'Interest', 'Principal', 'Outstanding after'],
      ...report.statement.map((e) => [e.date, e.type, e.ref, Math.round(e.amount),
        e.adv ? Math.round(e.adv) : '', e.fee ? Math.round(e.fee) : '', e.gst ? Math.round(e.gst) : '',
        e.intAdj != null ? Math.round(e.intAdj) : '', e.prinAdj != null ? Math.round(e.prinAdj) : '',
        e.outAfter != null ? Math.round(e.outAfter) : ''])
    ]);
  };

  return (
    <div className="space-y-5">
      <PageHead icon={FileBarChart2} title="MIS reports"
        subtitle="Pick a borrower — the summary, ageing and full account statement are generated from live activity.">
        {report && <>
          <button className="btn" onClick={() => window.print()}><Printer size={15} /> Print</button>
          <button className="btn btn-p" onClick={exportCSV}><Download size={15} /> Export CSV</button>
        </>}
      </PageHead>

      <Card className="no-print">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Borrower" className="lg:col-span-2">
            <select className="inp" value={bid} onChange={(e) => pick(e.target.value)}>
              <option value="">— select a borrower —</option>
              {(borrowers || []).map((b) => <option key={b.borrowerId} value={b.borrowerId}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Statement from"><input type="date" className="inp" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Statement to" hint="Also the as-at date for the summary">
            <input type="date" className="inp" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        {bid && (
          <div className="mt-3 flex items-center gap-3">
            <button className="btn btn-xs" onClick={() => load()} disabled={busy}>
              {busy ? <Spinner size={12} /> : <RefreshCw size={12} />} Regenerate
            </button>
            {report && <span className="text-[11px] text-slate-500">Generated {fmtDate(report.generatedAt, true)}</span>}
          </div>
        )}
      </Card>

      {error && <ErrorNote onRetry={() => load()}>{error}</ErrorNote>}
      {!bid && !error && (
        <Card><Empty icon={FileBarChart2} title="Select a borrower">Choose a facility above to generate its MIS report.</Empty></Card>
      )}

      {s && (
        <>
          <Card title={'Summary · ' + s.name}
            right={<span className="flex items-center gap-2">
              <Chip cls={PRODUCT[s.loanType].cls}>{PRODUCT[s.loanType].label}</Chip>
              <span className="text-xs text-slate-500">as at {fmtDate(s.asOf)}</span>
            </span>}>
            <div className="flex flex-wrap items-start gap-6">
              <div className="shrink-0"><UtilRing value={s.utilPct} /></div>
              <div className="grid min-w-[18rem] flex-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="Sanctioned" value={fmtCr(s.limit)} sub={s.limitIncreases ? 'incl. ' + fmtCr(s.limitIncreases) + ' enhanced' : null} />
                <Metric label="Drawn (cumulative)" value={fmtCr(s.drawn)} sub={s.totalDrawdowns + ' drawdowns'} />
                <Metric label="Net disbursed" value={fmtCr(s.disbursedNet)} />
                <Metric label="Outstanding" value={fmtCr(s.outstanding)} tone="text-neon-cyan" />
                <Metric label="Available" value={fmtCr(s.available)} />
                <Metric label="Principal repaid" value={fmtCr(s.principalRepaid)} />
                <Metric label="Advance interest" value={fmt(s.advCollected)} />
                <Metric label="Fees collected" value={fmt(s.feeCollected)} sub={'GST ' + fmt(s.gstCollected)} />
                <Metric label="Interest collected" value={fmt(s.intCollected)} />
                <Metric label="Interest earned" value={fmt(s.interestEarned)} tone="text-emerald-300" sub="advance + collected" />
                <Metric label="Income booked" value={fmt(s.incomeBooked)} sub="interest + fees" />
                <Metric label="Accrued, unbilled" value={fmt(s.accruedOpen)} tone={s.overdueDays > 0 ? 'text-rose-300' : 'text-slate-100'}
                  sub={s.overdueDays > 0 ? s.overdueDays + 'd overdue on ' + fmt(s.overdueAmount) : 'within tenure'} />
                <Metric label="IRR" value={pct(s.irr)} tone={s.irr >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
                <Metric label="Active drawdowns" value={s.activeDrawdowns + ' / ' + s.totalDrawdowns} />
                <Metric label="Renewal due" value={s.renewal ? fmtDate(s.renewal.renewDate) : '—'}
                  tone={s.renewal && s.renewal.status !== 'ok' ? 'text-neon-amber' : 'text-slate-100'}
                  sub={s.renewal ? (s.renewal.status === 'overdue' ? 'overdue' : s.renewal.daysLeft + ' days left') : null} />
              </div>
            </div>
          </Card>

          <Card title="Activity by month" subtitle="Disbursed against collected over the last six months">
            <MonthlyColumns data={report.monthly} />
          </Card>

          <Card title="Drawdown register">
            <div className="-mx-2 overflow-x-auto px-2">
              <table className="tbl">
                <thead><tr>
                  <th>Ref</th><th>Debit</th><th>Matures</th><th className="text-right">Principal</th>
                  <th className="text-right">Net disbursed</th><th className="text-right">Outstanding</th>
                  <th className="text-right">Accrued</th><th className="text-right">Days</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {report.drawdowns.map((d) => (
                    <tr key={d.id}>
                      <td className="font-mono text-[11px] text-slate-200">{d.ref || '—'}</td>
                      <td className="whitespace-nowrap text-slate-500">{fmtDate(d.bankDebit)}</td>
                      <td className={'whitespace-nowrap ' + (d.overdueDays > 0 ? 'text-rose-300' : 'text-slate-500')}>{fmtDate(d.dueDate)}</td>
                      <td className="text-right num">{fmt(d.poAmt)}</td>
                      <td className="text-right num text-slate-400">{fmt(d.disbursed)}</td>
                      <td className="text-right num font-semibold text-slate-100">{fmt(d.outPrin)}</td>
                      <td className={'text-right num ' + (d.overdueDays > 0 ? 'text-rose-300' : 'text-slate-400')}>{d.status === 'Repaid' ? '—' : fmt(d.accrued)}</td>
                      <td className="text-right num text-slate-500">{d.daysOpen}</td>
                      <td><Chip cls={STATUS[d.status].cls}>{STATUS[d.status].label}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Account statement"
            subtitle={from || to ? 'Filtered ' + (from ? 'from ' + fmtDate(from) : '') + ' ' + (to ? 'to ' + fmtDate(to) : '') : 'Complete history'}>
            <LedgerTable rows={report.statement} />
          </Card>
        </>
      )}
    </div>
  );
}

const Metric = ({ label, value, sub, tone = 'text-slate-100' }) => (
  <div className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5">
    <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">{label}</p>
    <p className={'font-display text-base font-bold num ' + tone}>{value}</p>
    {sub && <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{sub}</p>}
  </div>
);
