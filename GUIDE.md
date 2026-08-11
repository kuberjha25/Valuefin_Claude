# Valuefin Desk — Setup & Usage Guide

An internal, in-house lending-operations system for Valuefin. It replaces the
document-only MVP with a real system: **borrowers → drawdowns → payments**, from
which the **ledger and MIS are generated automatically** (the same engine as your
`po_finance_cloud.html` tool), plus the **document upload → Director approval**
flow. The only seeded data is one reference borrower, **PML Pvt Ltd**.

---

## 1. Running it locally

Two parts — run each in its own terminal.

**Backend** (API, port 4000):
```
cd backend
npm install
npm run dev      # or: npm start
```
On first run it creates `data/store.json` and seeds the PML reference borrower.
Uploaded PDFs are written to `backend/data/customers/<borrower-slug>/`.

**Frontend** (UI, port 3000):
```
cd frontend
npm install
npm run dev
```
Open **http://localhost:3000** and pick a role card.

> Both run on `localhost` so the session cookie is same-site — inline PDF preview
> and plain HTTP work with no extra setup. If `npm install` fails on a blocked
> domain, that's a network-settings restriction on your machine, not the code.

---

## 2. Roles

| Role | Can do |
|------|--------|
| **Manager** (Sonali Bansal) | Add/edit borrowers, record drawdowns & payments, upload documents, view everything |
| **Director** (Ujjwal Mahajan) | Everything the Manager can + **approve/reject** documents + **reset** data |
| **Analyst** (Credit Analyst) | **Read-only** — dashboard, ledger, MIS, documents |

Money operations (borrowers, drawdowns, payments) are direct entry — no approval
step, matching the HTML tool. **Documents** keep the maker→checker approval flow.

---

## 3. The core flow

1. **Add a borrower** — the facility, set once: product (PO Finance or
   Interest-Only), sanctioned limit, interest rate, penal charge, processing fee,
   GST, tenure and sanction date. A document folder is created on the server.
2. **Record a drawdown** — per disbursal: PO/reference, amount, debit date and
   advance-interest option. The desk computes advance interest, fee + GST and the
   **net disbursed**; the full amount is booked as outstanding principal.
3. **Record payments** — applied **interest first, then principal** (penal + any
   carried interest before principal). Part-payment reduces outstanding and carries
   short interest forward; full payment closes the drawdown.
4. **Ledger** (auto) — every drawdown and payment, date-sorted, with fees, GST,
   advance interest, the interest/principal split and running outstanding. Filter
   by borrower/date, export CSV.
5. **MIS** (auto) — pick a borrower for an instant report: sanctioned vs.
   outstanding, utilisation, advance/fees/interest collected, income booked,
   accrued interest, overdue days, IRR, then the full account statement. Export
   CSV or print.

---

## 4. How the numbers work (ported from `po_finance_cloud.html`)

- **Day count** is inclusive of both ends; interest uses a **365-day** year
  (daily rate = rate ÷ 365).
- **Advance interest** is upfront and covers the first part of tenure — options:
  30 days, 1 month, 2 months, custom days, or none.
- **Net disbursed** = amount − advance interest − processing fee − GST on fee.
- **Overdue** days beyond tenure accrue at interest rate **+ penal charge**.
- **Payment waterfall**: interest (incl. penal + carried overhang) first, then
  principal.
- **IRR**: annualised over all of a borrower's cash flows (Newton-Raphson). Open
  drawdowns are marked to today at outstanding + accrued interest, so IRR reflects
  yield earned so far rather than showing a performing loan as a loss. *(This
  mark-to-date step is the one addition beyond the HTML tool, to keep IRR sensible
  while a loan is still running.)*

---

## 5. Documents & approval

Upload a PDF from a borrower's page or the Documents tab → it's stored in that
borrower's server folder and marked **Pending review**. The **Director** previews
it inline and approves/rejects (reason required to reject). The uploader is
notified — see the bell in the top bar and the Notifications panel on the
Documents page.

---

## 6. The PML reference example

**PML Pvt Ltd** is seeded as a worked example: a ₹1 Cr PO-Finance facility with one
repaid cycle and one open drawdown, so the ledger and MIS are already populated.
Open it to see how the pieces fit, then add your own borrowers. **Delete PML** any
time from its page (trash icon).

To wipe everything back to just PML, the **Director** can use **Guide →
Danger zone → Reset data** (or delete `backend/data/` and restart).

---

## 7. Where things live

```
backend/
  src/calc.js     engine (day count, advance, fees, PO/IO accrual, waterfall, IRR, ledger, MIS)
  src/store.js    JSON persistence + the PML seed (built through the engine)
  src/server.js   REST API (auth, borrowers, drawdowns, payments, ledger, MIS, documents)
  data/           store.json + customers/<slug>/*.pdf   (created at runtime)

frontend/
  src/App.jsx     shell: sidebar, header, notification bell, routes
  src/pages/      Dashboard, Borrowers, BorrowerDetail, Ledger, Mis, Documents, Guide, Login
  src/api.js      API client + CSV export helper
```
