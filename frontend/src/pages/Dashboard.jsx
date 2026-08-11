import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Wallet, TrendingUp, CircleDollarSign, AlertTriangle, ArrowRight, BookOpenText, LifeBuoy } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, Stat, useLoad } from '../ui.jsx';
import { fmtCr, fmt, fmtDate, STATUS } from '../format.js';

export default function Dashboard() {
  const user = useAuth();
  const nav = useNavigate();
  const [p] = useLoad(() => api.get('/portfolio'), []);
  if (!p) return <Empty>Loading portfolio…</Empty>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-navy-900">Welcome, {user.name.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500">Live position across the book — as of {fmtDate(p.asOf)}.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Users} label="Borrowers" value={p.borrowers} sub={p.activeDrawdowns + ' active drawdowns'} />
        <Stat icon={Wallet} label="Sanctioned" value={fmtCr(p.sanctioned)} accent="text-gold-500" />
        <Stat icon={CircleDollarSign} label="Outstanding" value={fmtCr(p.outstanding)} tone="text-teal-600" accent="text-teal-500" />
        <Stat icon={TrendingUp} label="Income booked" value={fmtCr(p.incomeBooked)} sub={'Accrued (open): ' + fmtCr(p.accruedOpen)} accent="text-emerald-500" />
      </div>

      {p.alerts.length > 0 && (
        <Card title="Attention" right={<Chip cls="bg-amber-100 text-amber-800">{p.alerts.length}</Chip>}>
          <div className="space-y-2">
            {p.alerts.map((a, i) => (
              <div key={i} className={'flex items-start gap-2.5 rounded-xl px-3 py-2 ' + (a.sev === 'high' ? 'bg-rose-50' : 'bg-amber-50')}>
                <AlertTriangle size={16} className={a.sev === 'high' ? 'text-rose-500 mt-0.5' : 'text-amber-500 mt-0.5'} />
                <span className="text-sm text-navy-900">{a.text}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-display font-bold text-navy-900">New to the desk?</div>
            <div className="text-sm text-slate-500">The <b>PML Pvt Ltd</b> record is a worked reference — open it to see how a borrower, its drawdowns, payments, ledger and MIS fit together, then add your own.</div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="btn" onClick={() => nav('/guide')}><LifeBuoy size={15} /> Guide</button>
            <button className="btn btn-p" onClick={() => nav('/borrowers')}>Borrowers <ArrowRight size={15} /></button>
          </div>
        </div>
      </Card>

      <Card title="Recent ledger" right={<Link to="/ledger" className="text-sm text-teal-600 font-semibold hover:underline flex items-center gap-1"><BookOpenText size={14} /> Full ledger</Link>}>
        {p.ledger.length ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Entry</th><th>Borrower</th><th>Ref</th><th className="text-right">Amount</th><th className="text-right">Outstanding after</th></tr></thead>
              <tbody>
                {p.ledger.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap text-slate-500">{fmtDate(e.date)}</td>
                    <td><span className={'chip ' + (e.dir === 'out' ? 'bg-navy-900/10 text-navy-900' : 'bg-teal-600/10 text-teal-700')}>{e.type}</span></td>
                    <td className="font-semibold text-navy-900">{e.borrowerName}</td>
                    <td className="mono text-xs text-slate-500">{e.ref || '—'}</td>
                    <td className="text-right tabular-nums">{fmt(e.amount)}</td>
                    <td className="text-right tabular-nums text-slate-500">{e.outAfter != null ? fmt(e.outAfter) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No transactions yet.</Empty>}
      </Card>
    </div>
  );
}
