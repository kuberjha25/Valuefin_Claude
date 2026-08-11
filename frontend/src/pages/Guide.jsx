import React, { useState } from 'react';
import { LifeBuoy, Users, Banknote, Wallet2, BookOpenText, FileBarChart2, FolderCheck, ShieldAlert, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Modal, useToast } from '../ui.jsx';

export default function Guide() {
  const user = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = async () => { try { await api.post('/admin/reset', {}); toast('Data reset to the PML reference example.'); setConfirmReset(false); nav('/borrowers'); } catch (e) { toast(e.message, true); } };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-navy-900 flex items-center gap-2"><LifeBuoy size={22} className="text-teal-600" /> How to use Valuefin Desk</h1>
        <p className="text-sm text-slate-500">A short walkthrough of the workflow. The <b>PML Pvt Ltd</b> borrower is a worked example you can copy from or delete.</p>
      </div>

      <Card title="The three roles">
        <div className="space-y-2.5 text-sm">
          <Row chip={<Chip cls="bg-teal-600/10 text-teal-700">Manager</Chip>}>Runs day-to-day operations — adds borrowers, records drawdowns and payments, and uploads documents.</Row>
          <Row chip={<Chip cls="bg-gold-500/20 text-gold-500">Director</Chip>}>Everything the Manager can do, plus <b>approving or rejecting</b> uploaded documents. Can reset the data.</Row>
          <Row chip={<Chip cls="bg-navy-900/10 text-navy-900">Analyst</Chip>}>Read-only — reviews the dashboard, ledger, MIS and documents without making changes.</Row>
        </div>
      </Card>

      <Card title="The core flow">
        <div className="space-y-3">
          <Step icon={Users} n="1" title="Add a borrower" onGo={() => nav('/borrowers')}>
            Create the facility once: name, product (PO Finance or Interest-Only), sanctioned limit, interest rate, penal charge, processing fee, GST and tenure. A document folder is created for them on the server automatically.
          </Step>
          <Step icon={Banknote} n="2" title="Record a drawdown">
            Each time you disburse against the facility, add a drawdown with the PO/reference, amount, debit date and advance-interest option. The desk computes advance interest, processing fee + GST and the <b>net amount disbursed</b> — the full amount is booked as outstanding principal.
          </Step>
          <Step icon={Wallet2} n="3" title="Record payments">
            When money comes back, record a payment against the drawdown. The desk applies it <b>interest first, then principal</b> (penal charge and any carried interest come before principal). A part-payment reduces the outstanding and carries any short interest forward; a full payment closes the drawdown.
          </Step>
          <Step icon={BookOpenText} n="4" title="Ledger — automatic" onGo={() => nav('/ledger')}>
            Every drawdown and payment appears in the consolidated ledger, date-sorted, with fees, GST, advance interest, the interest/principal split and running outstanding. Filter by borrower or date and export to CSV. You never write ledger entries by hand.
          </Step>
          <Step icon={FileBarChart2} n="5" title="MIS — automatic" onGo={() => nav('/mis')}>
            Pick a borrower to generate its MIS instantly: sanctioned vs. outstanding, utilisation, advance/fees/interest collected, income booked, accrued interest, overdue days and IRR — followed by the full account statement. Export to CSV or print.
          </Step>
        </div>
      </Card>

      <Card title="How the numbers work">
        <div className="text-sm text-slate-600 space-y-2">
          <p><b>Day count</b> is inclusive of both the debit date and the as-of date. Interest uses a 365-day year (daily rate = rate ÷ 365).</p>
          <p><b>Advance interest</b> is collected upfront at disbursal and covers the first part of the tenure — choose 30 days, 1 month, 2 months, a custom number of days, or none.</p>
          <p><b>Processing fee</b> is a % of the drawdown; <b>GST</b> is charged on the fee. Net disbursed = amount − advance interest − fee − GST.</p>
          <p><b>Overdue</b> days beyond tenure accrue at the interest rate <b>plus</b> the penal charge.</p>
          <p><b>IRR</b> is annualised across all of a borrower's cash flows; open drawdowns are marked to today at outstanding + accrued interest, so it reflects yield earned so far.</p>
        </div>
      </Card>

      <Card title="Documents & approval">
        <div className="text-sm text-slate-600 space-y-2">
          <p>Upload a PDF from a borrower's page or the Documents tab. It's stored in that borrower's folder on the server and marked <Chip cls="bg-amber-100 text-amber-800">Pending review</Chip>.</p>
          <p>The <b>Director</b> previews it inline and approves or rejects (a reason is required to reject). The uploader is notified — watch the bell in the top bar and the Notifications panel on the <button className="text-teal-600 font-semibold" onClick={() => nav('/documents')}>Documents</button> page.</p>
        </div>
      </Card>

      <Card title="The PML reference example">
        <div className="text-sm text-slate-600 space-y-2">
          <p><b>PML Pvt Ltd</b> is seeded as a worked example: a ₹1 Cr PO-Finance facility with one repaid cycle and one open drawdown, so the ledger and MIS are already populated. Open it to see how the pieces fit, then add your own borrowers. Delete PML whenever you like — from its page, use the trash icon.</p>
        </div>
      </Card>

      {user.role === 'director' && (
        <Card title="Danger zone" className="border-rose-200">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-slate-600 flex items-start gap-2"><ShieldAlert size={18} className="text-rose-500 mt-0.5" /><span>Reset all data back to just the PML reference example. This deletes every borrower, drawdown, payment and document record.</span></div>
            <button className="btn btn-d shrink-0" onClick={() => setConfirmReset(true)}>Reset data</button>
          </div>
        </Card>
      )}

      {confirmReset && (
        <Modal title="Reset all data?" onClose={() => setConfirmReset(false)}>
          <p className="text-sm text-slate-600">This permanently removes all borrowers, drawdowns, payments and document records, and restores only the PML reference example. This cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-4"><button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button><button className="btn btn-d" onClick={reset}>Reset to reference</button></div>
        </Modal>
      )}
    </div>
  );
}

const Row = ({ chip, children }) => (<div className="flex items-start gap-3"><div className="w-24 shrink-0">{chip}</div><div className="text-slate-600">{children}</div></div>);

const Step = ({ icon: Icon, n, title, children, onGo }) => (
  <div className="flex gap-3.5">
    <div className="shrink-0 h-10 w-10 rounded-xl bg-navy-900/5 grid place-items-center"><Icon size={18} className="text-teal-600" /></div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="chip bg-navy-900 text-white">{n}</span>
        <span className="font-display font-bold text-navy-900">{title}</span>
        {onGo && <button className="ml-auto text-teal-600 text-sm font-semibold inline-flex items-center gap-1 hover:underline" onClick={onGo}>Open <ArrowRight size={13} /></button>}
      </div>
      <p className="text-sm text-slate-600 mt-1">{children}</p>
    </div>
  </div>
);
