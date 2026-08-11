'use strict';
/* Persistence for Valuefin Desk. Metadata in data/store.json; uploaded PDFs on
   disk under data/customers/<slug>/. The ONLY seeded data is one reference
   borrower — "PML Pvt Ltd" — with a closed cycle and one open drawdown, so the
   ledger and MIS populate as a worked example the user can copy or delete. */
const fs = require('fs');
const path = require('path');
const calc = require('./calc');

const DATA = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA, 'store.json');
const CUST_DIR = path.join(DATA, 'customers');

function ensureDirs() { fs.mkdirSync(CUST_DIR, { recursive: true }); }
const offsetISO = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'customer';

/* ---- build the PML reference borrower through the real engine ---- */
function buildSeed() {
  const db = {
    seq: { borrower: 100, drawdown: 200, payment: 300, document: 400, notification: 500, limit: 600 },
    users: [
      { id: 1, name: 'Sonali Bansal', role: 'manager' },
      { id: 2, name: 'Ujjwal Mahajan', role: 'director' },
      { id: 3, name: 'Credit Analyst', role: 'analyst' }
    ],
    borrowers: [], drawdowns: [], payments: [], documents: [], notifications: [], limitHistory: []
  };

  const b = {
    id: db.seq.borrower++, name: 'PML Pvt Ltd', biz: 'Distribution', slug: 'pml-pvt-ltd',
    loanType: 'po', limit: 10000000, rate: 18, penRate: 6, procFeePct: 1.5, gstPct: 18,
    tenure: 90, tenureUnit: 'days', sanctionDate: offsetISO(-150),
    createdBy: 'Sonali Bansal', createdAt: new Date().toISOString(), sample: true
  };
  db.borrowers.push(b);
  try { fs.mkdirSync(path.join(CUST_DIR, b.slug), { recursive: true }); } catch (e) { /* noop */ }

  // Drawdown 1 — will be fully repaid
  const d1 = Object.assign({ id: db.seq.drawdown++, borrowerId: b.id },
    calc.computeDrawdown({ ref: 'PML/PO-2401', poAmt: 4000000, bankDebit: offsetISO(-120), mode: '1m', rem: 'First cycle — anchor PO' }, b),
    { createdBy: 'Sonali Bansal', createdAt: new Date().toISOString() });
  db.drawdowns.push(d1);

  // Full repayment of Drawdown 1 (interest computed to the payment date, then closes)
  const payDate = offsetISO(-34);
  const acc1 = calc.poAccrued(d1, b, payDate);
  const amt1 = d1.outPrin + acc1.total;
  const alloc1 = calc.allocatePayment(d1, b, amt1, payDate, db.payments);
  db.payments.push({ id: db.seq.payment++, borrowerId: b.id, drawdownId: d1.id, ref: d1.ref,
    date: payDate, amount: amt1, intAdj: alloc1.intAdj, prinAdj: alloc1.prinAdj, outAfter: alloc1.outAfter,
    closed: alloc1.closed, kind: alloc1.kind, rem: 'Buyer settled — full closure', createdBy: 'Sonali Bansal', createdAt: new Date().toISOString() });
  d1.outPrin = alloc1.outAfter; d1.intOverhang = alloc1.overhang; d1.intCollected += alloc1.intAdj; d1.status = alloc1.closed ? 'Repaid' : 'Open';

  // Drawdown 2 — remains open (currently outstanding)
  const d2 = Object.assign({ id: db.seq.drawdown++, borrowerId: b.id },
    calc.computeDrawdown({ ref: 'PML/PO-2402', poAmt: 3500000, bankDebit: offsetISO(-40), mode: '30d', rem: 'Second cycle — running' }, b),
    { createdBy: 'Sonali Bansal', createdAt: new Date().toISOString() });
  db.drawdowns.push(d2);

  return db;
}

let db = null;
function load() {
  ensureDirs();
  if (fs.existsSync(FILE)) {
    try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
    catch (e) { db = buildSeed(); }
  } else {
    db = buildSeed();
  }
  save();
  return db;
}
function save() { ensureDirs(); fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); }
function get() { return db; }
function nextId(k) { db.seq[k] = (db.seq[k] || 0) + 1; return db.seq[k]; }
function reset() { db = buildSeed(); save(); return db; }

module.exports = { load, save, get, nextId, reset, buildSeed, slugify, paths: { DATA, CUST_DIR } };
