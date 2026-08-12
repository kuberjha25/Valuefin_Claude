import React, { useState } from 'react';
import { Download, BookOpenText, RotateCcw, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { api, downloadCSV } from '../api.js';
import { Card, Field, ErrorNote, PageHead, Spinner, Stat } from '../ui.jsx';
import { useLoad, useLocal } from '../hooks.js';
import LedgerTable from '../components/LedgerTable.jsx';
import { fmt, fmtCr, today } from '../format.js';

const TYPES = [['', 'Everything'], ['out', 'Money out (disbursals)'], ['in', 'Money in (receipts)']];

export default function Ledger() {
  const { data: borrowers } = useLoad(() => api.borrowers({ sort: 'name', dir: 'asc' }), []);
  const [f, setF] = useLocal('ledger.filters', { borrowerId: '', from: '', to: '', type: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const clear = () => setF({ borrowerId: '', from: '', to: '', type: '' });
  const active = Object.values(f).some(Boolean);

  const { data, error, loading, reload } = useLoad(
    () => api.ledger(f), [f.borrowerId, f.from, f.to, f.type]);

  const rows = data?.rows || [];
  const totals = data?.totals;

  const exportCSV = () => {
    if (!rows.length) return;
    downloadCSV('valuefin_ledger_' + today() + '.csv',
      ['Date', 'Entry', 'Borrower', 'Ref', 'Amount', 'Adv Int', 'Fee', 'GST', 'Interest', 'Principal', 'Outstanding After', 'Remarks'],
      rows.map((e) => [e.date, e.type, e.borrowerName, e.ref, Math.round(e.amount),
        e.adv ? Math.round(e.adv) : '', e.fee ? Math.round(e.fee) : '', e.gst ? Math.round(e.gst) : '',
        e.intAdj != null ? Math.round(e.intAdj) : '', e.prinAdj != null ? Math.round(e.prinAdj) : '',
        e.outAfter != null ? Math.round(e.outAfter) : '', e.rem || '']));
  };

  return (
    <div className="space-y-5">
      <PageHead icon={BookOpenText} title="Ledger"
        subtitle="Every disbursal and receipt across the book, generated automatically from recorded activity. Nothing here is written by hand.">
        <button className="btn" onClick={exportCSV} disabled={!rows.length}><Download size={15} /> Export CSV</button>
      </PageHead>

      {totals && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={ArrowUpRight} label="Disbursed out" value={fmtCr(totals.out)} accent="violet"
            sub={`incl. ${fmt(totals.adv)} advance interest and ${fmt(totals.fee + totals.gst)} fee + GST`} />
          <Stat icon={ArrowDownLeft} label="Received in" value={fmtCr(totals.in)} accent="cyan"
            sub={`${fmt(totals.interest)} interest · ${fmt(totals.principal)} principal`} />
          <Stat icon={BookOpenText} label="Entries" value={data.count} accent="pink"
            sub={active ? 'matching the current filters' : 'across the whole book'} />
        </div>
      )}

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Borrower" className="lg:col-span-2">
            <select className="inp" value={f.borrowerId} onChange={set('borrowerId')}>
              <option value="">All borrowers</option>
              {(borrowers || []).map((b) => <option key={b.borrowerId} value={b.borrowerId}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Direction">
            <select className="inp" value={f.type} onChange={set('type')}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="From"><input type="date" className="inp" value={f.from} onChange={set('from')} /></Field>
          <Field label="To"><input type="date" className="inp" value={f.to} onChange={set('to')} /></Field>
        </div>

        <div className="mb-3 flex items-center gap-3">
          {active && <button className="btn btn-xs" onClick={clear}><RotateCcw size={12} /> Clear filters</button>}
          {loading && <span className="text-slate-500"><Spinner /></span>}
        </div>

        {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : <LedgerTable rows={rows} showBorrower totals={totals} />}
      </Card>
    </div>
  );
}
