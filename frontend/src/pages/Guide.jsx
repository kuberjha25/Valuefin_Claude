import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LifeBuoy, Users, Banknote, Wallet2, BookOpenText, FileBarChart2, FolderCheck, ArrowRight,
  RefreshCw, ArrowUpDown, Calculator, ScrollText, Command
} from 'lucide-react';
import { useAuth } from '../App.jsx';
import { Card, Chip, PageHead } from '../ui.jsx';
import { ROLE } from '../format.js';

export default function Guide() {
  const user = useAuth();
  const nav = useNavigate();

  return (
    <div className="max-w-4xl space-y-5">
      <PageHead icon={LifeBuoy} title="How Valuefin Desk works"
        subtitle="Borrowers, drawdowns and payments go in; the ledger, MIS, ageing and IRR come out. This page is the whole workflow in one screen." />

      <Card title="The three roles">
        <div className="space-y-2.5">
          {['director', 'manager', 'analyst'].map((r) => (
            <div key={r} className={'flex items-start gap-3 rounded-2xl border px-3.5 py-3 ' +
              (user.role === r ? 'border-neon-indigo/35 bg-neon-indigo/[.08]' : 'border-white/[.07] bg-white/[.03]')}>
              <span className="w-24 shrink-0"><Chip cls={ROLE[r].cls}>{ROLE[r].label}</Chip></span>
              <p className="flex-1 text-[13px] leading-relaxed text-slate-400">{ROLE[r].blurb}</p>
              {user.role === r && <Chip cls="chip-violet">you</Chip>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-slate-500">
          Money operations are direct entry — there is no approval step on a drawdown or a payment. <b className="text-slate-300">Documents</b> keep
          the maker–checker flow, and <b className="text-slate-300">limit enhancements</b> are a Director-only credit decision.
        </p>
      </Card>

      <Card title="The core flow">
        <div className="space-y-4">
          <Step n="1" icon={Users} title="Add a borrower" go={() => nav('/borrowers')}>
            The facility, set once: product (PO Finance or Interest-Only), sanctioned limit, interest rate, penal charge,
            processing fee, GST, tenure and sanction date. A document folder is created on the server automatically.
          </Step>
          <Step n="2" icon={Banknote} title="Record a drawdown">
            Per disbursal: PO reference, amount, debit date and the advance-interest option. The desk computes advance
            interest, fee + GST and the <b className="text-slate-300">net disbursed</b>; the full amount is booked as outstanding
            principal. A drawdown that would breach the sanctioned limit is refused.
          </Step>
          <Step n="3" icon={Wallet2} title="Record payments">
            Applied <b className="text-slate-300">interest first, then principal</b> — penal charge and any carried interest settle
            before principal. A part-payment reduces the outstanding and carries short interest forward; a full payment closes
            the drawdown. Editing or reversing a receipt re-derives the whole drawdown from its payment history, so back-dated
            entries never leave the account out of step.
          </Step>
          <Step n="4" icon={RefreshCw} title="Rotate at maturity">
            Rolling an open drawdown into a fresh one settles the original and opens a replacement with a new tenure clock.
            Choose whether the accrued interest is paid in cash or capitalised into the new principal. Deleting the
            replacement unwinds the settlement too, so the pair always moves together.
          </Step>
          <Step n="5" icon={ArrowUpDown} title="Enhance the limit">
            The sanctioned limit is a base amount plus a history of enhancements, each dated and attributed. A reduction that
            would take the limit below the current outstanding is refused, and any limit event restarts the one-year renewal clock.
          </Step>
          <Step n="6" icon={BookOpenText} title="Ledger — automatic" go={() => nav('/ledger')}>
            Every drawdown and payment, date-sorted, with fees, GST, advance interest, the interest/principal split and the
            running outstanding. Filter by borrower, direction or date, and export to CSV. You never write a ledger entry by hand.
          </Step>
          <Step n="7" icon={FileBarChart2} title="MIS — automatic" go={() => nav('/mis')}>
            Pick a borrower for an instant report: sanctioned vs. outstanding, utilisation, advance/fees/interest collected,
            income booked, accrued interest, overdue days and IRR, then the drawdown register and the full account statement.
            Export to CSV or print.
          </Step>
        </div>
      </Card>

      <Card title="How the numbers work" right={<Calculator size={16} className="text-neon-violet" />}>
        <div className="space-y-2.5 text-[13px] leading-relaxed text-slate-400">
          <p><b className="text-slate-200">Day count</b> is inclusive of both the debit date and the as-at date. Interest uses a 365-day year, so the daily rate is the annual rate ÷ 365.</p>
          <p><b className="text-slate-200">Advance interest</b> is collected upfront at disbursal and covers the first part of the tenure — 30 days, 1 month, 2 months, a custom number of days, or none.</p>
          <p><b className="text-slate-200">Net disbursed</b> = amount − advance interest − processing fee − GST on the fee. The full amount, not the net, is booked as outstanding principal.</p>
          <p><b className="text-slate-200">Overdue</b> days beyond tenure accrue at the interest rate <b className="text-slate-200">plus</b> the penal charge, on the outstanding principal.</p>
          <p><b className="text-slate-200">The waterfall</b> settles accrued interest (including penal and any carried overhang) before it touches principal. What a payment cannot cover is carried forward.</p>
          <p><b className="text-slate-200">IRR</b> is annualised across all of a borrower's cash flows by Newton-Raphson. Open drawdowns are marked to today at outstanding + accrued interest, so the figure reflects yield earned so far rather than treating a performing loan as a loss.</p>
        </div>
      </Card>

      <Card title="Documents & approval" right={<FolderCheck size={16} className="text-neon-violet" />}>
        <div className="space-y-2.5 text-[13px] leading-relaxed text-slate-400">
          <p>Upload a PDF from a borrower's page or the Documents tab. It is stored in that borrower's folder on the server and marked <Chip cls="chip-warn">Pending review</Chip>.</p>
          <p>The <b className="text-slate-200">Director</b> previews it inline and approves or rejects — a reason is required to reject, and the uploader is notified either way. Watch the bell in the top bar.</p>
          <p>Only genuine PDFs are accepted: the server checks the file's own bytes, not just its name. An uploader can withdraw their own pending upload; anything already reviewed is the Director's to remove.</p>
        </div>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card title="Audit trail" right={<ScrollText size={16} className="text-neon-violet" />}>
          <p className="text-[13px] leading-relaxed text-slate-400">
            Every create, edit, approval, reversal and sign-in is written to an append-only log with the user, the role, the
            IP and a summary. Open <button className="font-semibold text-neon-violet hover:underline" onClick={() => nav('/activity')}>Activity</button> to
            read or export it. Nothing in it can be edited or deleted from the app.
          </p>
        </Card>
        <Card title="Getting around faster" right={<Command size={16} className="text-neon-violet" />}>
          <p className="text-[13px] leading-relaxed text-slate-400">
            Press <span className="kbd">⌘</span> <span className="kbd">K</span> (or <span className="kbd">Ctrl</span> <span className="kbd">K</span>) anywhere to jump to a
            borrower, a PO reference, a document or a page. Arrow keys move, <span className="kbd">↵</span> opens, <span className="kbd">esc</span> closes.
          </p>
        </Card>
      </div>

      <Card title="The PML reference example">
        <p className="text-[13px] leading-relaxed text-slate-400">
          <b className="text-slate-200">PML Pvt Ltd</b> ships as a worked example: a PO-Finance facility with a ₹1 Cr base limit and a
          ₹25 L enhancement, one fully repaid cycle and one running drawdown with a part payment — so the ledger, MIS and dashboard
          are populated from the first sign-in. Every figure on it was produced by the same engine your own borrowers use.
          Delete it from its own page whenever you no longer need it, or restore it from{' '}
          <button className="font-semibold text-neon-violet hover:underline" onClick={() => nav('/settings')}>Settings → Danger zone</button>.
        </p>
      </Card>
    </div>
  );
}

const Step = ({ n, icon: Icon, title, children, go }) => (
  <div className="flex gap-3.5">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.05]">
      <Icon size={17} className="text-neon-violet" />
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-neon-indigo to-neon-pink text-[11px] font-bold text-white">{n}</span>
        <h3 className="font-display font-bold text-white">{title}</h3>
        {go && (
          <button className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-neon-violet hover:underline" onClick={go}>
            Open <ArrowRight size={12} />
          </button>
        )}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{children}</p>
    </div>
  </div>
);
