import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, ChevronRight } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, Field, Modal, Table, Td, useLoad, useToast } from '../ui.jsx';
import { fmt, fmtCr, pct } from '../format.js';

export default function Borrowers() {
  const user = useAuth();
  const nav = useNavigate();
  const [rows, reload] = useLoad(() => api.get('/borrowers'), []);
  const [open, setOpen] = useState(false);
  const canEdit = user.role !== 'analyst';
  if (!rows) return <Empty>Loading borrowers…</Empty>;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900">Borrowers</h1>
          <p className="text-sm text-slate-500">Every facility, its utilisation and yield. Click a row to manage drawdowns, payments, ledger & documents.</p>
        </div>
        {canEdit && <button className="btn btn-p" onClick={() => setOpen(true)}><Plus size={15} /> Add borrower</button>}
      </div>

      <Card>
        <Table cols={['Borrower', 'Type', '#Limit', '#Outstanding', '#Util', '#Active', '#IRR', '']} rows={rows}
          render={(b) => (<>
            <td>
              <button className="text-left group" onClick={() => nav('/borrowers/' + b.borrowerId)}>
                <div className="font-semibold text-navy-900 group-hover:text-teal-600 flex items-center gap-2">
                  {b.name}
                  {rows.length && b.name === 'PML Pvt Ltd' && <Chip cls="bg-gold-500/15 text-gold-500">reference</Chip>}
                </div>
              </button>
            </td>
            <Td><Chip cls={b.loanType === 'io' ? 'bg-navy-900/10 text-navy-900' : 'bg-teal-600/10 text-teal-700'}>{b.loanType === 'io' ? 'Interest-Only' : 'PO Finance'}</Chip></Td>
            <Td r>{fmtCr(b.limit)}</Td>
            <Td r className="font-semibold">{fmtCr(b.outstanding)}</Td>
            <Td r className={b.utilPct > 90 ? 'text-rose-600 font-semibold' : ''}>{b.utilPct}%</Td>
            <Td r>{b.activeDrawdowns}</Td>
            <Td r className="text-slate-500">{pct(b.irr)}</Td>
            <Td><button className="text-slate-300 hover:text-teal-600" onClick={() => nav('/borrowers/' + b.borrowerId)}><ChevronRight size={18} /></button></Td>
          </>)} empty={canEdit ? 'No borrowers yet — add your first facility.' : 'No borrowers yet.'} />
      </Card>

      {open && <AddBorrower onClose={() => setOpen(false)} onDone={(id) => { setOpen(false); reload(); if (id) nav('/borrowers/' + id); }} />}
    </div>
  );
}

function AddBorrower({ onClose, onDone }) {
  const toast = useToast();
  const [b, setB] = useState({ name: '', biz: '', loanType: 'po', limit: '', rate: '18', penRate: '6', procFeePct: '1.5', gstPct: '18', tenure: '90', tenureUnit: 'days', sanctionDate: new Date().toISOString().slice(0, 10) });
  const set = (k) => (e) => setB({ ...b, [k]: e.target.value });
  const save = async () => {
    try { const r = await api.post('/borrowers', b); toast('Borrower “' + r.name + '” added.'); onDone(r.borrowerId); }
    catch (e) { toast(e.message, true); }
  };
  return (
    <Modal title="Add borrower" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Borrower name" className="col-span-2"><input className="inp" autoFocus value={b.name} onChange={set('name')} placeholder="e.g. Acme Foods Pvt Ltd" /></Field>
        <Field label="Business / sector"><input className="inp" value={b.biz} onChange={set('biz')} placeholder="e.g. FMCG distribution" /></Field>
        <Field label="Product">
          <select className="inp" value={b.loanType} onChange={set('loanType')}>
            <option value="po">PO Finance / Working Capital</option>
            <option value="io">Interest-Only (Bullet)</option>
          </select>
        </Field>
        <Field label="Sanctioned limit (₹)"><input type="number" className="inp" value={b.limit} onChange={set('limit')} placeholder="e.g. 5000000" /></Field>
        <Field label="Sanction date"><input type="date" className="inp" value={b.sanctionDate} onChange={set('sanctionDate')} /></Field>
        <Field label="Interest rate (% p.a.)"><input type="number" className="inp" value={b.rate} onChange={set('rate')} /></Field>
        <Field label="Penal charge (% p.a. extra)"><input type="number" className="inp" value={b.penRate} onChange={set('penRate')} /></Field>
        <Field label="Processing fee (%)"><input type="number" className="inp" value={b.procFeePct} onChange={set('procFeePct')} /></Field>
        <Field label="GST on fee (%)"><input type="number" className="inp" value={b.gstPct} onChange={set('gstPct')} /></Field>
        <Field label="Tenure"><input type="number" className="inp" value={b.tenure} onChange={set('tenure')} /></Field>
        <Field label="Tenure unit"><select className="inp" value={b.tenureUnit} onChange={set('tenureUnit')}><option value="days">Days</option><option value="months">Months</option></select></Field>
      </div>
      <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5"><Users size={13} /> A document folder is created on the server for this borrower automatically.</p>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={!b.name.trim()} onClick={save}>Add borrower</button>
      </div>
    </Modal>
  );
}
