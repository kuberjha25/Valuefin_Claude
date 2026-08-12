import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, Wallet, TrendingUp, CircleDollarSign, AlertTriangle, ArrowRight, ArrowUpRight,
  BookOpenText, LifeBuoy, Layers, Clock
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, Stat, ErrorNote, Skeleton, PageHead, Meter } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { MonthlyColumns, AgeingBars, ExposureBars, Sparkline, UtilRing } from '../charts.jsx';
import { fmtCr, fmt, fmtDate, fmtNum } from '../format.js';

export default function Dashboard() {
  const user = useAuth();
  const nav = useNavigate();
  const { data: p, error, loading, reload } = useLoad(() => api.portfolio(), []);

  if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;
  if (loading || !p) return <DashboardSkeleton />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const collectedSeries = p.monthly.map((m) => m.collected);
  const disbursedSeries = p.monthly.map((m) => m.disbursed);
  const fresh = p.borrowers <= 1 && p.totalDrawdowns <= 2;

  return (
    <div className="space-y-5">
      <PageHead title={`${greeting}, ${user.name.split(' ')[0]}`}
        subtitle={`Live position across the book as at ${fmtDate(p.asOf)}. Every figure is derived from recorded activity — nothing here is keyed in by hand.`}>
        <button className="btn" onClick={() => nav('/ledger')}><BookOpenText size={15} /> Ledger</button>
        <button className="btn btn-p" onClick={() => nav('/borrowers')}>Borrowers <ArrowRight size={15} /></button>
      </PageHead>

      {/* ---- headline tiles ---- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Wallet} label="Sanctioned" value={fmtCr(p.sanctioned)} accent="violet"
          sub={`${fmtNum(p.borrowers)} borrower${p.borrowers === 1 ? '' : 's'} · ${fmtCr(p.available)} available`} />
        <Stat icon={CircleDollarSign} label="Outstanding" value={fmtCr(p.outstanding)} accent="cyan"
          sub={`${p.activeDrawdowns} of ${p.totalDrawdowns} drawdowns open`}
          chart={<Meter value={p.outstanding} max={p.sanctioned || 1} label={`${p.utilPct}% of the sanctioned book deployed`} />} />
        <Stat icon={TrendingUp} label="Income booked" value={fmtCr(p.incomeBooked)} accent="lime"
          sub={`Interest ${fmtCr(p.interestEarned)} · fees ${fmtCr(p.feeCollected)}`}
          chart={<Sparkline values={collectedSeries} color="var(--series-2)" />} />
        <Stat icon={Layers} label="Accrued, unbilled" value={fmtCr(p.accruedOpen)} accent="amber"
          sub={p.overdueAmount > 0 ? `${fmtCr(p.overdueAmount)} sitting overdue` : 'All exposure within tenure'}
          chart={<Sparkline values={disbursedSeries} color="var(--series-1)" />} />
      </div>

      {/* ---- alerts ---- */}
      {p.alerts.length > 0 && (
        <Card title="Needs attention"
          right={<Chip cls={p.alerts.some((a) => a.sev === 'high') ? 'chip-bad' : 'chip-warn'}>{p.alerts.length}</Chip>}>
          <ul className="grid gap-2 md:grid-cols-2">
            {p.alerts.map((a, i) => (
              <li key={i}>
                <button onClick={() => nav(a.borrowerId ? '/borrowers/' + a.borrowerId : '/documents')}
                  className={'flex w-full items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition hover:-translate-y-px ' +
                    (a.sev === 'high'
                      ? 'border-state-bad/25 bg-state-bad/[.08] hover:border-state-bad/45'
                      : 'border-neon-amber/25 bg-neon-amber/[.07] hover:border-neon-amber/45')}>
                  <AlertTriangle size={15} className={'mt-0.5 shrink-0 ' + (a.sev === 'high' ? 'text-rose-300' : 'text-neon-amber')} />
                  <span className="flex-1 text-[13px] leading-snug text-slate-200">{a.text}</span>
                  <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-slate-600" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ---- charts row ---- */}
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Disbursed vs collected" subtitle="Last six months, principal and receipts on one shared scale">
          <MonthlyColumns data={p.monthly} />
        </Card>

        <div className="space-y-5">
          <Card title="Book utilisation">
            <div className="flex items-center gap-5">
              <UtilRing value={p.utilPct} />
              <dl className="min-w-0 flex-1 space-y-2.5 text-sm">
                <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Deployed</dt>
                  <dd className="num font-display text-lg font-bold text-white">{fmtCr(p.outstanding)}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Headroom</dt>
                  <dd className="num font-display text-lg font-bold text-slate-300">{fmtCr(p.available)}</dd></div>
              </dl>
            </div>
          </Card>

          <Card title="Ageing of open principal" subtitle="Days past tenure, by outstanding">
            <AgeingBars buckets={p.ageing} />
          </Card>
        </div>
      </div>

      {/* ---- exposure + recent ---- */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1.6fr]">
        <Card title="Largest exposures" subtitle="Outstanding principal by borrower">
          <ExposureBars rows={p.byBorrower.filter((b) => b.outstanding > 0).slice(0, 6)} onSelect={(id) => nav('/borrowers/' + id)} />
        </Card>

        <Card title="Recent ledger"
          right={<Link to="/ledger" className="btn btn-xs btn-ghost text-neon-violet">Full ledger <ArrowRight size={12} /></Link>}>
          {p.ledger.length ? (
            <div className="-mx-2 overflow-x-auto px-2">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Entry</th><th>Borrower</th><th>Ref</th><th className="text-right">Amount</th><th className="text-right">Outstanding after</th></tr></thead>
                <tbody>
                  {p.ledger.map((e) => (
                    <tr key={e.id} className="cursor-pointer" onClick={() => nav('/borrowers/' + e.borrowerId)}>
                      <td className="whitespace-nowrap text-slate-500">{fmtDate(e.date)}</td>
                      <td><Chip cls={e.dir === 'out' ? 'chip-violet' : 'chip-cyan'}>{e.type}</Chip></td>
                      <td className="font-medium text-slate-200">{e.borrowerName}</td>
                      <td className="font-mono text-[11px] text-slate-500">{e.ref || '—'}</td>
                      <td className="text-right num text-slate-200">{fmt(e.amount)}</td>
                      <td className="text-right num text-slate-500">{e.outAfter != null ? fmt(e.outAfter) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty icon={Clock} title="No transactions yet">Record a drawdown and the ledger writes itself.</Empty>}
        </Card>
      </div>

      {fresh && (
        <Card className="edge-glow">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <p className="font-display font-bold text-white">New to the desk?</p>
              <p className="mt-1 text-sm text-slate-400">
                <b className="text-slate-200">PML Pvt Ltd</b> is a worked reference — a ₹1.25 Cr facility with one closed
                cycle and one running drawdown. Open it to see how a borrower, its drawdowns, payments, ledger and MIS
                fit together, then add your own and delete it.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button className="btn" onClick={() => nav('/guide')}><LifeBuoy size={15} /> Guide</button>
              <button className="btn btn-p" onClick={() => nav('/borrowers')}><Users size={15} /> Borrowers</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

const DashboardSkeleton = () => (
  <div className="space-y-5">
    <Skeleton className="h-9 w-72" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <Skeleton className="h-80" /><Skeleton className="h-80" />
    </div>
  </div>
);
