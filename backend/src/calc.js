'use strict';
/* ============================================================================
   Valuefin Desk — calculation engine
   Ported line-for-line in behaviour from the production po_finance_cloud.html
   loan tool so every number matches: one-day-inclusive day count, 365-day
   daily rate, advance-interest modes, processing fee + GST, PO overdue/penal
   accrual, Interest-Only accrual, interest→principal payment waterfall,
   Newton-Raphson IRR, and the consolidated ledger + per-borrower statement.
   ========================================================================== */

const round = (n) => Math.round((+n || 0));
const dr = (r) => (+r || 0) / 100 / 365;                       // daily rate (365-day year)
const td = () => new Date().toISOString().slice(0, 10);
const di = (d1, d2) => Math.round((new Date(d2) - new Date(d1)) / 86400000) + 1; // inclusive of both ends
const addYearISO = (d) => { if (!d) return ''; const x = new Date(d); x.setFullYear(x.getFullYear() + 1); return x.toISOString().slice(0, 10); };

function tenureDays(b) {
  const tn = parseFloat(b.tenure) || 90;
  return b.tenureUnit === 'months' ? Math.round(tn * 30.4375) : tn;
}

/* advance-interest window: none | 30d | 1m | 2m | custom days */
function advance(amt, rate, mode, cd) {
  amt = +amt || 0; rate = +rate || 0;
  if (mode === 'none') return { adv: 0, ad: 0 };
  if (mode === '30d') return { adv: amt * dr(rate) * 30, ad: 30 };
  if (mode === '1m') return { adv: amt * (rate / 100 / 12), ad: 30 };
  if (mode === '2m') return { adv: amt * (rate / 100 / 12) * 2, ad: 61 };
  const d = +cd || 30; return { adv: amt * dr(rate) * d, ad: d };
}
function feeCalc(amt, feePct, gstPct) {
  const f = (+amt || 0) * (+feePct || 0) / 100;
  const g = f * (+gstPct || 0) / 100;
  return { fee: f, gst: g, total: f + g };
}

/* build a drawdown record from raw inputs + its borrower */
function computeDrawdown(input, b) {
  const poAmt = +input.poAmt || 0;
  const mode = input.mode || 'none';
  const { adv, ad } = advance(poAmt, b.rate, mode, input.cd);
  const feePct = input.feePct != null ? +input.feePct : (+b.procFeePct || 0);
  const { fee, gst } = feeCalc(poAmt, feePct, b.gstPct);
  const disbursed = poAmt - adv - fee - gst;
  return {
    ref: input.ref || '', poAmt, bankDebit: input.bankDebit || td(),
    mode, cd: mode === 'custom' ? (+input.cd || 30) : null, ad, adv,
    feePct, fee, gstAmt: gst, disbursed,
    outPrin: poAmt, intOverhang: 0, intCollected: 0,
    loanType: b.loanType || 'po', status: 'Open', rem: input.rem || ''
  };
}

/* PO Finance interest accrued on a drawdown up to a date (incl. penal + carried overhang) */
function poAccrued(dd, b, toDate) {
  const days = di(dd.bankDebit, toDate);
  const op = +dd.outPrin || 0;
  const ov = +dd.intOverhang || 0;
  const ten = tenureDays(b);
  const wT = Math.min(days, ten);
  const exD = Math.max(0, wT - (+dd.ad || 0));
  const exI = exD > 0 ? op * dr(b.rate) * exD : 0;
  const odD = Math.max(0, days - ten);
  const cr = (+b.rate || 0) + (+b.penRate || 0);
  const odC = odD > 0 ? op * dr(cr) * odD : 0;
  return { days, exD, exI, odD, cr, penal: odC, interest: exI, overhang: ov, total: exI + odC + ov };
}

/* Interest-Only accrual: advance covers first `ad` days, periodic interest thereafter */
function ioAccrued(dd, b, toDate) {
  const days = di(dd.bankDebit, toDate);
  const ad = +dd.ad || 0;
  const principal = +dd.poAmt || 0;
  const billable = Math.max(0, days - ad);
  return principal * dr(b.rate || 18) * billable;
}
function ioCollected(ddId, payments) {
  return payments.filter((p) => p.drawdownId === ddId).reduce((s, p) => s + (+p.intAdj || 0), 0);
}
function ioNetDue(dd, b, toDate, payments) {
  return Math.max(0, ioAccrued(dd, b, toDate) - ioCollected(dd.id, payments));
}

/* unified payment waterfall — interest (incl. penal + overhang) first, then principal */
function allocatePayment(dd, b, amount, date, payments) {
  amount = +amount || 0;
  if (dd.loanType === 'io') {
    const accrued = ioAccrued(dd, b, date);
    const collected = ioCollected(dd.id, payments);
    const intDueNet = Math.max(0, accrued - collected);
    const intAdj = Math.min(amount, intDueNet);
    const prinAdj = Math.min(Math.max(0, amount - intAdj), +dd.outPrin || 0);
    const outAfter = Math.max(0, (+dd.outPrin || 0) - prinAdj);
    return { accrued: intDueNet, intAdj, prinAdj, outAfter, overhang: 0, closed: outAfter === 0 && prinAdj > 0, kind: prinAdj > 0 ? 'io_close' : 'io_interest' };
  }
  const acc = poAccrued(dd, b, date);
  const iDue = Math.max(0, acc.total);
  let intAdj = 0, prinAdj = 0, overhang = 0;
  if (amount >= iDue) { intAdj = iDue; prinAdj = Math.min(amount - iDue, +dd.outPrin || 0); }
  else { intAdj = amount; overhang = iDue - amount; }
  const outAfter = Math.max(0, (+dd.outPrin || 0) - prinAdj);
  return { accrued: iDue, intAdj, prinAdj, outAfter, overhang, closed: outAfter === 0 && overhang === 0, kind: 'po' };
}

/* current sanctioned limit = base + approved increases */
function currentLimit(store, bid) {
  const b = store.borrowers.find((x) => x.id === bid);
  if (!b) return 0;
  const inc = (store.limitHistory || []).filter((l) => l.borrowerId === bid).reduce((s, l) => s + (+l.incrAmt || 0), 0);
  return (+b.limit || 0) + inc;
}

/* 1-year renewal status from the latest sanction / limit event */
function renewalStatus(store, bid) {
  const b = store.borrowers.find((x) => x.id === bid);
  if (!b) return null;
  const evts = [...(b.sanctionDate ? [{ date: b.sanctionDate }] : []),
    ...(store.limitHistory || []).filter((l) => l.borrowerId === bid).map((l) => ({ date: l.date }))]
    .sort((a, c) => (c.date > a.date ? 1 : -1));
  if (!evts.length) return null;
  const rd = addYearISO(evts[0].date);
  const daysLeft = di(td(), rd) - 1;
  if (daysLeft < 0) return { status: 'overdue', renewDate: rd, daysLeft };
  if (daysLeft <= 30) return { status: 'warn', renewDate: rd, daysLeft };
  return { status: 'ok', renewDate: rd, daysLeft };
}

/* ---- IRR (Newton-Raphson, daily discounting) ---- */
function calcIRR(flows) {
  if (!flows || flows.length < 2) return null;
  const maxT = Math.max(...flows.map((c) => c.t));
  if (maxT <= 0) return null;
  let r = 0.15;
  for (let i = 0; i < 100; i++) {
    let npv = 0, dnpv = 0;
    flows.forEach((cf) => {
      const disc = Math.pow(1 + r, cf.t / 365);
      npv += cf.amount / disc;
      dnpv -= cf.amount * (cf.t / 365) / ((1 + r) * disc);
    });
    if (Math.abs(npv) < 0.01) break;
    r = r - npv / dnpv;
    if (r < -0.999) r = -0.999;
    if (r > 100) r = 100;
  }
  return isFinite(r) ? r * 100 : null;
}
function borrowerCashFlows(store, bid) {
  const dds = store.drawdowns.filter((d) => d.borrowerId === bid);
  if (!dds.length) return [];
  let earliest = null;
  dds.forEach((d) => { const t = new Date(d.bankDebit); if (!earliest || t < earliest) earliest = t; });
  const flows = [];
  dds.forEach((d) => {
    const t = Math.round((new Date(d.bankDebit) - earliest) / 86400000);
    flows.push({ t, amount: -(+d.poAmt || 0) });     // cash out = full principal disbursed against
    if (d.fee > 0) flows.push({ t, amount: +d.fee || 0 });
    if (d.adv > 0) flows.push({ t, amount: +d.adv || 0 });
  });
  store.payments.filter((p) => p.borrowerId === bid).forEach((p) => {
    const t = Math.round((new Date(p.date) - earliest) / 86400000);
    flows.push({ t, amount: +p.amount || 0 });
  });
  /* mark-to-date: value each still-open drawdown at today = outstanding principal
     + interest accrued to date, so IRR reflects yield earned so far rather than
     treating an un-repaid (but performing) loan as a total loss. */
  const b = store.borrowers.find((x) => x.id === bid);
  const today = new Date().toISOString().slice(0, 10);
  const tNow = Math.round((new Date(today) - earliest) / 86400000);
  dds.filter((d) => d.status !== 'Repaid').forEach((d) => {
    const accrued = d.loanType === 'io' ? ioNetDue(d, b, today, store.payments) : poAccrued(d, b, today).total;
    const value = (+d.outPrin || 0) + accrued;
    if (value > 0) flows.push({ t: tNow, amount: value });
  });
  return flows;
}

/* ---- consolidated ledger (auto-generated) ---- */
function buildLedger(store, { borrowerId, from, to } = {}) {
  const bName = (id) => (store.borrowers.find((b) => b.id === id) || {}).name || '—';
  let e = [];
  store.drawdowns.forEach((d) => {
    e.push({ date: d.bankDebit, dir: 'out', type: d.rotatedFrom ? 'Rotation' : 'Disbursement',
      borrowerId: d.borrowerId, borrowerName: bName(d.borrowerId), ref: d.ref || '',
      amount: d.disbursed, fee: d.fee || 0, gst: d.gstAmt || 0, adv: d.adv || 0,
      intAdj: null, prinAdj: null, outAfter: d.poAmt, rem: d.rem || '' });
  });
  store.payments.forEach((p) => {
    const d = store.drawdowns.find((x) => x.id === p.drawdownId) || {};
    const sub = d.loanType === 'io'
      ? (p.prinAdj > 0 ? 'IO Principal Repayment' : 'IO Interest Payment')
      : (p.closed ? 'Full Repayment' : 'Partial Payment');
    e.push({ date: p.date, dir: 'in', type: sub, borrowerId: p.borrowerId, borrowerName: bName(p.borrowerId),
      ref: p.ref || d.ref || '', amount: p.amount, fee: 0, gst: 0, adv: 0,
      intAdj: p.intAdj, prinAdj: p.prinAdj, outAfter: p.outAfter, rem: p.rem || '' });
  });
  e = e.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : (a.dir === 'out' ? -1 : 1)));
  if (borrowerId) e = e.filter((x) => x.borrowerId === borrowerId);
  if (from) e = e.filter((x) => x.date >= from);
  if (to) e = e.filter((x) => x.date <= to);
  return e;
}

/* ---- per-borrower MIS summary (auto-generated) ---- */
function borrowerSummary(store, bid, asOf = td()) {
  const b = store.borrowers.find((x) => x.id === bid);
  if (!b) return null;
  const dds = store.drawdowns.filter((d) => d.borrowerId === bid);
  const pays = store.payments.filter((p) => p.borrowerId === bid);
  const open = dds.filter((d) => d.status !== 'Repaid');
  const outstanding = open.reduce((s, d) => s + (+d.outPrin || 0), 0);
  let accruedOpen = 0, overdueDays = 0;
  open.forEach((d) => {
    if (d.loanType === 'io') accruedOpen += ioNetDue(d, b, asOf, pays);
    else { const a = poAccrued(d, b, asOf); accruedOpen += a.total; overdueDays = Math.max(overdueDays, a.odD); }
  });
  const advCollected = dds.reduce((s, d) => s + (+d.adv || 0), 0);
  const feeCollected = dds.reduce((s, d) => s + (+d.fee || 0), 0);
  const gstCollected = dds.reduce((s, d) => s + (+d.gstAmt || 0), 0);
  const intCollected = pays.reduce((s, p) => s + (+p.intAdj || 0), 0);
  const limit = currentLimit(store, bid);
  return {
    borrowerId: bid, name: b.name, loanType: b.loanType, rate: b.rate, asOf,
    limit, drawn: dds.reduce((s, d) => s + (+d.poAmt || 0), 0),
    disbursedNet: dds.reduce((s, d) => s + (+d.disbursed || 0), 0),
    outstanding, available: Math.max(0, limit - outstanding),
    utilPct: limit > 0 ? +(outstanding / limit * 100).toFixed(1) : 0,
    advCollected, feeCollected, gstCollected, intCollected,
    interestEarned: advCollected + intCollected,
    incomeBooked: advCollected + intCollected + feeCollected,
    accruedOpen, overdueDays,
    activeDrawdowns: open.length, totalDrawdowns: dds.length,
    irr: calcIRR(borrowerCashFlows(store, bid)),
    renewal: renewalStatus(store, bid)
  };
}

/* ---- portfolio-level rollup (dashboard) ---- */
function portfolio(store, asOf = td()) {
  const sums = store.borrowers.map((b) => borrowerSummary(store, b.id, asOf));
  const sum = (k) => sums.reduce((s, x) => s + (x[k] || 0), 0);
  return {
    borrowers: store.borrowers.length,
    sanctioned: store.borrowers.reduce((s, b) => s + currentLimit(store, b.id), 0),
    outstanding: sum('outstanding'),
    disbursedNet: sum('disbursedNet'),
    interestEarned: sum('interestEarned'),
    feeCollected: sum('feeCollected'),
    incomeBooked: sum('incomeBooked'),
    accruedOpen: sum('accruedOpen'),
    activeDrawdowns: store.drawdowns.filter((d) => d.status !== 'Repaid').length,
    totalDrawdowns: store.drawdowns.length,
    asOf
  };
}

module.exports = {
  round, dr, td, di, addYearISO, tenureDays, advance, feeCalc, computeDrawdown,
  poAccrued, ioAccrued, ioCollected, ioNetDue, allocatePayment,
  currentLimit, renewalStatus, calcIRR, borrowerCashFlows,
  buildLedger, borrowerSummary, portfolio
};
