# Valuefin Desk

An internal lending-operations system for Valuefin. **Borrowers → drawdowns → payments** go in;
the **ledger, MIS, ageing and IRR** come out. Documents go through a Director approval flow, and
every state change is written to an append-only audit trail.

Stack: **React 18 + Vite + Tailwind** (port 3000) · **Node + Express** (port 4000) · **MySQL 9** (port 3306).

---

## 1. Credentials & system specs

> Everything below is the **local development setup created on this machine**. Change the passwords
> before this ever leaves your laptop — see §8.

### MySQL server

| | |
|---|---|
| Engine | MySQL 9.7.1 (Homebrew, `brew install mysql`) |
| Host / port | `127.0.0.1:3306` |
| Service | `brew services start mysql` / `stop mysql` / `restart mysql` |
| Data directory | `/opt/homebrew/var/mysql` |
| Config file | `/opt/homebrew/etc/my.cnf` |
| Client binary | `/opt/homebrew/opt/mysql/bin/mysql` |

**Accounts**

| Account | Password | Scope |
|---|---|---|
| `root@localhost` | `Valuefin@Root#2026` | Full server admin. Only for DBA work. |
| `valuefin_app@localhost` and `@127.0.0.1` | `Valuefin@App#2026` | `ALL PRIVILEGES ON valuefin.*` — the app connects as this user. |

**Schema:** `valuefin` · `utf8mb4` / `utf8mb4_unicode_ci` · all tables InnoDB.

```bash
mysql -u root -p'Valuefin@Root#2026' valuefin           # DBA shell
mysql -u valuefin_app -p'Valuefin@App#2026' valuefin    # app-level shell
```

### Application sign-ins

Passwords are stored as **bcrypt hashes (cost 12)** — nobody, including a Director, can read one
back. These are the seeded starting values:

| Name | Email | Role | Password |
|---|---|---|---|
| Sonali Bansal | `sonali@valuefin.in` | **Director** | `Director@2026` |
| Manager | `manager@valuefin.in` | **Manager** | `Manager@2026` |
| Ujjwal Mahajan | `ujjwal@valuefin.in` | **Credit Analyst** | `Analyst@2026` |

The password follows the **role**, not the person — so if a role is reassigned later, the
password for that seat stays the same unless you change it in the app.

Change your own under **Settings → Change password**. A Director can reset anyone's under
**Team → 🔑**, which also ends that person's live sessions.

### Backend configuration — `backend/.env`

Copy `backend/.env.example` if you need to rebuild it. **Wrap every password in double quotes** —
an unquoted `#` starts a comment in a `.env` file and will silently truncate the value.

| Key | Value here | Meaning |
|---|---|---|
| `PORT` | `4000` | API port |
| `CORS_ORIGIN` | `http://localhost:3000` | The only origin allowed to send credentialed requests |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | MySQL address |
| `DB_USER` / `DB_PASSWORD` | `valuefin_app` / `"Valuefin@App#2026"` | App credentials |
| `DB_NAME` | `valuefin` | Schema |
| `DB_POOL_SIZE` | `10` | Max pooled connections |
| `SESSION_TTL_HOURS` | `12` | Idle session lifetime; slides forward on each request |
| `BCRYPT_ROUNDS` | `12` | Password hashing work factor |
| `SEED_*_PASSWORD` | see table above | Used **only** on the first migration |

---

## 2. Running it

Two terminals.

```bash
# 1 — make sure MySQL is up
brew services start mysql

# 2 — backend
cd backend
npm install
npm run db:migrate     # creates the schema + seeds staff and the PML reference borrower
npm run dev            # http://localhost:4000

# 3 — frontend
cd frontend
npm install
npm run dev            # http://localhost:3000
```

Open **http://localhost:3000** and sign in.

### Backend scripts

| Command | What it does |
|---|---|
| `npm run dev` | API with auto-reload on `src/**` |
| `npm start` | API, no watcher |
| `npm run db:migrate` | Idempotent: creates the DB if absent, applies `schema.sql`, seeds only empty tables |
| `npm run db:reset` | **Drops every table** and rebuilds from scratch |
| `npm run db:check` | Connection, row counts, portfolio totals, and an integrity check that replays every drawdown against its own payments |

`db:check` is the first thing to run when a number looks wrong.

---

## 3. Roles

| Role | Can do |
|---|---|
| **Director** | Everything a Manager can, plus: approve/reject documents, record limit enhancements, manage the team, reset all data, delete records that carry financial history |
| **Manager** | Add and edit borrowers, record drawdowns, payments and rotations, upload documents |
| **Analyst** | Read-only — dashboard, borrowers, ledger, MIS, documents, activity |

Money operations are **direct entry** — there is no approval step on a drawdown or a payment.
**Documents** keep the maker–checker flow. **Limit enhancements** are a Director-only credit decision.

---

## 4. The core flow

1. **Add a borrower** — the facility, set once: product (PO Finance or Interest-Only), sanctioned
   limit, interest rate, penal charge, processing fee, GST, tenure, sanction date, and optional
   contact/PAN/GSTIN. A document folder is created on the server.
2. **Record a drawdown** — PO reference, amount, debit date, advance-interest option. The desk
   computes advance interest, fee + GST and the **net disbursed**; the full amount is booked as
   outstanding principal. A drawdown that would breach the sanctioned limit is refused.
3. **Record payments** — applied **interest first, then principal** (penal charge and any carried
   interest before principal). A part-payment reduces the outstanding and carries short interest
   forward; a full payment closes the drawdown. Editing or reversing a receipt **replays the whole
   drawdown from its payment history**, so back-dated entries never leave the account out of step.
4. **Rotate at maturity** — rolls the outstanding principal into a fresh drawdown with a new tenure
   clock and settles the original. Choose whether accrued interest is paid in cash or capitalised
   into the new principal. Deleting the replacement unwinds the settlement too.
5. **Enhance the limit** — the sanctioned limit is a base amount plus a dated, attributed history of
   enhancements. A reduction below the current outstanding is refused. Any limit event restarts the
   one-year renewal clock.
6. **Ledger** (auto) — every drawdown and payment, date-sorted, with fees, GST, advance interest, the
   interest/principal split and running outstanding. Filter by borrower, direction or date; export CSV.
7. **MIS** (auto) — per borrower: sanctioned vs. outstanding, utilisation, advance/fees/interest
   collected, income booked, accrued interest, overdue days, IRR, six-month activity chart, the
   drawdown register and the full account statement. Export CSV or print.

---

## 5. How the numbers work

Ported line-for-line in behaviour from the production `po_finance_cloud.html` tool.

- **Day count** is inclusive of both the debit date and the as-at date. Interest uses a **365-day**
  year (daily rate = annual rate ÷ 365).
- **Advance interest** is collected upfront and covers the first part of the tenure — 30 days,
  1 month, 2 months, custom days, or none.
- **Net disbursed** = amount − advance interest − processing fee − GST on the fee. The **full**
  amount, not the net, is booked as outstanding principal.
- **Overdue** days beyond tenure accrue at the interest rate **plus** the penal charge.
- **Payment waterfall**: accrued interest (incl. penal and carried overhang) first, then principal.
- **IRR**: annualised over all of a borrower's cash flows (Newton-Raphson, daily discounting). Open
  drawdowns are marked to today at outstanding + accrued interest, so IRR reflects yield earned so
  far rather than showing a performing loan as a loss.

All money is stored as `DECIMAL(18,2)` and rounded to paise inside the engine, so no floating-point
dust accumulates across a long payment history.

---

## 6. Documents & approval

Upload a PDF from a borrower's page or the Documents page. It is written to that borrower's folder
under `backend/data/customers/<slug>/` and marked **Pending review**.

- Only genuine PDFs are accepted — the server checks the file's leading bytes, not just its name.
- Max 25 MB.
- The **Director** previews it inline and approves or rejects; a reason is required to reject, and
  the uploader is notified either way.
- Where a second Director exists, nobody can approve their own upload.
- An uploader may withdraw their own **pending** upload; anything reviewed is the Director's to remove.

---

## 7. What ships with it

**PML Pvt Ltd** is seeded as a worked reference: a PO-Finance facility with a ₹1 Cr base limit and a
₹25 L enhancement, one fully repaid cycle and one running drawdown with a part payment — so the
ledger, MIS and dashboard are populated on the first sign-in. Every figure on it was produced by the
same engine your own borrowers use.

Delete it from its own page whenever you like. To wipe everything back to just PML, a Director uses
**Settings → Danger zone → Reset all data** (type `RESET` to confirm). Staff accounts and the audit
trail survive a reset, so the reset itself stays on the record.

---

## 8. Security notes

Implemented:

- Passwords hashed with **bcrypt** (cost 12); never logged, never returned by any endpoint.
- Sessions are **server-side rows in MySQL**, referenced by an opaque UUID in an `httpOnly`,
  `sameSite=lax` cookie. They survive a restart, slide forward on use, expire after 12 idle hours,
  and are purged on a timer. Suspending an account, resetting its password or changing your own
  password revokes the relevant sessions immediately.
- **Rate limits**: 20 sign-in attempts per IP per 10 minutes, 600 requests per minute overall.
- Sign-in failures are recorded and never reveal whether an address exists.
- Every write route validates its input and returns a sentence a user can act on, not a stack trace.
- All SQL goes through parameterised queries; multi-statement execution is off on the app pool.
- Document paths are resolved and confined to the data directory, so a stored path cannot escape it.
- `helmet` security headers, CORS locked to a single credentialed origin.
- Multi-step writes (payments, rotations, resets) run inside transactions.

Before this leaves localhost:

1. Change `root` and `valuefin_app` passwords, and every application password.
2. Set `NODE_ENV=production` — the session cookie then sets `Secure`, and 500s stop echoing internals.
3. Terminate TLS in front of the API and serve the built frontend (`npm run build` → `frontend/dist`)
   from the same origin, or update `CORS_ORIGIN`.
4. Grant `valuefin_app` only `SELECT, INSERT, UPDATE, DELETE` on `valuefin.*` (it currently holds
   `ALL PRIVILEGES`, which it needs for `db:migrate` but not at runtime).
5. Back up `valuefin` and `backend/data/customers/` together — the database rows and the PDFs on
   disk are two halves of one record.

---

## 9. Where things live

```
backend/
  .env                     configuration (git-ignored)
  .env.example             template
  src/
    config.js              env loading + boot-time validation
    calc.js                the engine — day count, advance, fees, accrual, waterfall, replay, IRR, ledger, MIS
    repo.js                snake_case ⇄ camelCase mapping and the engine-store loader
    auth.js                bcrypt, MySQL-backed sessions, role guards
    audit.js               append-only activity trail
    notify.js              in-app notifications
    http.js                async route wrapper + input validators
    server.js              app wiring, security middleware, error handling, boot checks
    db/
      pool.js              mysql2 pool, q() / one() / tx()
      schema.sql           the DDL
      migrate.js           npm run db:migrate | db:reset
      seed.js              staff accounts + the PML reference borrower
      check.js             npm run db:check
    routes/                auth · users · borrowers · drawdowns · payments · reports · documents · notifications · admin
  data/customers/<slug>/   uploaded PDFs (git-ignored)

frontend/
  src/
    App.jsx                shell — sidebar, top bar, notification tray, ⌘K palette, routes
    api.js                 API client
    format.js              money/date formatting and the shared status vocabularies
    hooks.js               useLoad, useDebounced, useHotkey, useDismiss, usePoll, useLocal
    ui.jsx                 the UI kit — Card, Stat, Table, Modal, Confirm, Toast, Skeleton, …
    charts.jsx             hand-rolled SVG charts (no charting dependency)
    components/            LedgerTable, DocumentPanel
    pages/                 Login · Dashboard · Borrowers · BorrowerDetail · Ledger · Mis · Documents · Team · Activity · Settings · Guide
```

**Chart colour** is defined once as CSS custom properties in `src/index.css` and validated against the
dark chart surface: two categorical slots (`#8069f5` disbursed, `#0fa0c9` collected) that stay
distinguishable under protanopia and deuteranopia, and a single-hue monotone ramp for the overdue
ageing buckets. Every plot also has a table view, so no reading depends on colour alone.

---

## 10. Keyboard

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette — jump to a borrower, PO reference, document or page |
| `↑` `↓` | Move through results |
| `↵` | Open |
| `Esc` | Close any palette, dropdown or dialog |
