import React, { useState } from 'react';
import { Download, BookOpenText } from 'lucide-react';
import { api, downloadCSV } from '../api.js';
import { Card, Empty, Field, useLoad } from '../ui.jsx';
import { LedgerTable } from './BorrowerDetail.jsx';
import { fmt, fmtDate } from '../format.js';

export default function Ledger() {
  const [borrowers] = useLoad(() => api.get('/borrowers'), []);
  const [bid, setBid] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const qs = [bid && 'borrowerId=' + bid, from && 'from=' + from, to && 'to=' + to].filter(Boolean).join('&');
  const [rows] = useLoad(() => api.get('/ledger' + (qs ? '?' + qs : '')), [qs]);

  const exportCSV = () => {
    if (!rows || !rows.length) return;
    downloadCSV('valuefin_ledger_' + new Date().toISOString().slice(0, 10) + '.csv',
      ['Date', 'Entry', 'Borrower', 'Ref', 'Amount', 'Adv Int', 'Fee', 'GST', 'Interest', 'Principal', 'Outstanding After'],
      rows.map((e) => [e.date, e.type, e.borrowerName, e.ref, Math.round(e.amount), e.adv ? Math.round(e.adv) : '', e.fee ? Math.round(e.fee) : '', e.gst ? Math.round(e.gst) : '', e.intAdj != null ? Math.round(e.intAdj) : '', e.prinAdj != null ? Math.round(e.prinAdj) : '', e.outAfter != null ? Math.round(e.outAfter) : '']));
  };

  const outTot = (rows || []).filter((e) => e.dir === 'out').reduce((s, e) => s + e.amount, 0);
  const inTot = (rows || []).filter((e) => e.dir === 'in').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900 flex items-center gap-2"><BookOpenText size={22} className="text-teal-600" /> Ledger</h1>
          <p className="text-sm text-slate-500">Every disbursement and receipt across the book, generated automatically from activity.</p>
        </div>
        <button className="btn" onClick={exportCSV} disabled={!rows || !rows.length}><Download size={15} /> Export CSV</button>
      </div>

      <Card>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <Field label="Borrower">
            <select className="inp" value={bid} onChange={(e) => setBid(e.target.value)}>
              <option value="">All borrowers</option>
              {(borrowers || []).map((b) => <option key={b.borrowerId} value={b.borrowerId}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="From"><input type="date" className="inp" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" className="inp" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        {rows && rows.length > 0 && (
          <div className="flex flex-wrap gap-4 text-sm mb-3 text-slate-600">
            <span>Entries: <b className="text-navy-900">{rows.length}</b></span>
            <span>Disbursed out: <b className="text-navy-900 tabular-nums">{fmt(outTot)}</b></span>
            <span>Received in: <b className="text-navy-900 tabular-nums">{fmt(inTot)}</b></span>
          </div>
        )}
        <LedgerTable rows={rows || []} />
      </Card>
    </div>
  );
}
