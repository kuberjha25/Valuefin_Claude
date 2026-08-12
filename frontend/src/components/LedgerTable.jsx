import React from 'react';
import { BookOpenText } from 'lucide-react';
import { Chip, Empty } from '../ui.jsx';
import { fmt, fmtDate } from '../format.js';

/* The consolidated ledger view, shared by the Ledger page, the MIS statement and
   the borrower detail tab. Disbursements read violet (money out), receipts cyan
   (money in) — the same two categorical slots as the dashboard chart. */
export default function LedgerTable({ rows, showBorrower = false, totals }) {
  if (!rows || !rows.length) {
    return <Empty icon={BookOpenText} title="No ledger entries">Entries appear here the moment a drawdown or payment is recorded.</Empty>;
  }
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="tbl">
        <thead>
          <tr>
            <th>Date</th>
            <th>Entry</th>
            {showBorrower && <th>Borrower</th>}
            <th>Ref</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Adv int</th>
            <th className="text-right">Fee</th>
            <th className="text-right">GST</th>
            <th className="text-right">Interest</th>
            <th className="text-right">Principal</th>
            <th className="text-right">Outstanding after</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap text-slate-500">{fmtDate(e.date)}</td>
              <td><Chip cls={e.dir === 'out' ? 'chip-violet' : 'chip-cyan'}>{e.type}</Chip></td>
              {showBorrower && <td className="font-medium text-slate-200">{e.borrowerName}</td>}
              <td className="max-w-[12rem] truncate font-mono text-[11px] text-slate-500" title={e.rem || ''}>{e.ref || '—'}</td>
              <td className="text-right num font-medium text-slate-100">{fmt(e.amount)}</td>
              <td className="text-right num text-slate-500">{e.adv ? fmt(e.adv) : '—'}</td>
              <td className="text-right num text-slate-500">{e.fee ? fmt(e.fee) : '—'}</td>
              <td className="text-right num text-slate-500">{e.gst ? fmt(e.gst) : '—'}</td>
              <td className="text-right num text-slate-400">{e.intAdj != null ? fmt(e.intAdj) : '—'}</td>
              <td className="text-right num text-slate-400">{e.prinAdj != null ? fmt(e.prinAdj) : '—'}</td>
              <td className="text-right num text-slate-300">{e.outAfter != null ? fmt(e.outAfter) : '—'}</td>
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="border-t border-white/10">
              <td colSpan={showBorrower ? 4 : 3} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {rows.length} entries · out {fmt(totals.out)} · in {fmt(totals.in)}
              </td>
              <td className="px-3 py-2.5 text-right num text-slate-300">{fmt(totals.out + totals.in)}</td>
              <td className="px-3 py-2.5 text-right num text-slate-400">{fmt(totals.adv)}</td>
              <td className="px-3 py-2.5 text-right num text-slate-400">{fmt(totals.fee)}</td>
              <td className="px-3 py-2.5 text-right num text-slate-400">{fmt(totals.gst)}</td>
              <td className="px-3 py-2.5 text-right num text-slate-300">{fmt(totals.interest)}</td>
              <td className="px-3 py-2.5 text-right num text-slate-300">{fmt(totals.principal)}</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
