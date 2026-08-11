'use strict';
/* ============================================================================
   Valuefin Desk — internal lending operations API (production, in-house)
   Node + Express · http://localhost:4000 · CORS for http://localhost:3000
   Borrowers → Drawdowns → Payments run through the ported engine (calc.js);
   the ledger and MIS are generated from that activity. Documents upload into
   per-borrower server folders and go through Director approval.
   ============================================================================ */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const calc = require('./calc');

const PORT = 4000;
const ORIGIN = 'http://localhost:3000';

store.load();
const db = () => store.get();

const app = express();
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

/* ---------------- sessions & roles ---------------- */
const SESSIONS = new Map();
app.use((req, _res, next) => {
  const uid = req.cookies.sid ? SESSIONS.get(req.cookies.sid) : null;
  req.user = uid ? db().users.find((u) => u.id === uid) || null : null;
  next();
});
const need = (req) => { if (!req.user) { const e = new Error('Not logged in'); e.status = 401; throw e; } return req.user; };
const canEdit = (req) => { const u = need(req); if (u.role === 'analyst') { const e = new Error('The Analyst role is read-only for this action.'); e.status = 403; throw e; } return u; };
const canApprove = (req) => { const u = need(req); if (u.role !== 'director') { const e = new Error('Only the Director can approve or reject documents.'); e.status = 403; throw e; } return u; };
const H = (fn) => (req, res, next) => { try { const v = fn(req, res); if (v !== undefined) res.json(v); } catch (e) { next(e); } };
const uMeta = (u) => ({ id: u.id, name: u.name, role: u.role });
const bad = (m) => Object.assign(new Error(m), { status: 400 });

function notify(o) {
  const n = Object.assign({ id: store.nextId('notification'), read: false, createdAt: new Date().toISOString() },
    { to: null, toRole: null, type: '', message: '', docId: null, customerName: null }, o);
  db().notifications.push(n); return n;
}

/* ---------------- health / auth ---------------- */
app.get('/api/health', H(() => ({ ok: true, service: 'valuefin-desk', ts: new Date().toISOString() })));
app.get('/api/users', H(() => db().users.map(uMeta)));
app.post('/api/login', H((req, res) => {
  const u = db().users.find((x) => x.id === +req.body.userId);
  if (!u) throw bad('Unknown user');
  const sid = crypto.randomUUID(); SESSIONS.set(sid, u.id);
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax' });
  return uMeta(u);
}));
app.post('/api/logout', H((req, res) => { if (req.cookies.sid) SESSIONS.delete(req.cookies.sid); res.clearCookie('sid'); return { ok: true }; }));
app.get('/api/me', H((req) => (req.user ? uMeta(req.user) : null)));

/* ---------------- borrowers ---------------- */
const EDITABLE = ['name', 'biz', 'loanType', 'limit', 'rate', 'penRate', 'procFeePct', 'gstPct', 'tenure', 'tenureUnit', 'sanctionDate'];
app.get('/api/borrowers', H((req) => { need(req); return db().borrowers.map((b) => calc.borrowerSummary(db(), b.id)); }));
app.get('/api/borrowers/:id', H((req) => {
  need(req);
  const b = db().borrowers.find((x) => x.id === +req.params.id);
  if (!b) throw bad('Borrower not found');
  const dds = db().drawdowns.filter((d) => d.borrowerId === b.id).map((d) => decorateDD(d, b));
  return {
    borrower: b,
    summary: calc.borrowerSummary(db(), b.id),
    drawdowns: dds.sort((a, c) => (a.bankDebit < c.bankDebit ? 1 : -1)),
    payments: db().payments.filter((p) => p.borrowerId === b.id).sort((a, c) => (a.date < c.date ? 1 : -1)),
    documents: db().documents.filter((x) => x.borrowerId === b.id).map(docView).sort((a, c) => c.id - a.id),
    ledger: calc.buildLedger(db(), { borrowerId: b.id })
  };
}));
function decorateDD(d, b) {
  const acc = d.loanType === 'io'
    ? { total: calc.ioNetDue(d, b, calc.td(), db().payments), days: calc.di(d.bankDebit, calc.td()), odD: 0 }
    : calc.poAccrued(d, b, calc.td());
  return Object.assign({}, d, { accrued: acc.total, daysOpen: acc.days, overdueDays: acc.odD || 0,
    dueTotal: d.status === 'Repaid' ? 0 : (d.outPrin + acc.total) });
}
app.post('/api/borrowers', H((req) => {
  canEdit(req);
  const body = req.body;
  if (!(body.name || '').trim()) throw bad('Borrower name is required.');
  if (db().borrowers.some((b) => b.name.toLowerCase() === body.name.trim().toLowerCase())) throw bad('A borrower with this name already exists.');
  let slug = store.slugify(body.name), base = slug, i = 2;
  while (db().borrowers.some((b) => b.slug === slug)) slug = base + '-' + (i++);
  const b = { id: store.nextId('borrower'), slug, createdBy: req.user.name, createdAt: new Date().toISOString(),
    name: body.name.trim(), biz: body.biz || '', loanType: body.loanType === 'io' ? 'io' : 'po',
    limit: +body.limit || 0, rate: +body.rate || 18, penRate: +body.penRate || 6,
    procFeePct: body.procFeePct != null ? +body.procFeePct : 1.5, gstPct: body.gstPct != null ? +body.gstPct : 18,
    tenure: +body.tenure || 90, tenureUnit: body.tenureUnit === 'months' ? 'months' : 'days',
    sanctionDate: body.sanctionDate || calc.td() };
  db().borrowers.push(b);
  try { fs.mkdirSync(path.join(store.paths.CUST_DIR, slug), { recursive: true }); } catch (e) { /* noop */ }
  store.save();
  return calc.borrowerSummary(db(), b.id);
}));
app.put('/api/borrowers/:id', H((req) => {
  canEdit(req);
  const b = db().borrowers.find((x) => x.id === +req.params.id);
  if (!b) throw bad('Borrower not found');
  EDITABLE.forEach((k) => {
    if (req.body[k] == null) return;
    if (['limit', 'rate', 'penRate', 'procFeePct', 'gstPct', 'tenure'].includes(k)) b[k] = +req.body[k];
    else if (k === 'loanType') b[k] = req.body[k] === 'io' ? 'io' : 'po';
    else b[k] = req.body[k];
  });
  store.save();
  return calc.borrowerSummary(db(), b.id);
}));
app.delete('/api/borrowers/:id', H((req) => {
  canEdit(req);
  const id = +req.params.id;
  db().payments = db().payments.filter((p) => p.borrowerId !== id);
  db().drawdowns = db().drawdowns.filter((d) => d.borrowerId !== id);
  db().documents = db().documents.filter((x) => x.borrowerId !== id);
  db().borrowers = db().borrowers.filter((b) => b.id !== id);
  store.save();
  return { ok: true };
}));

/* ---------------- drawdowns ---------------- */
app.get('/api/drawdowns', H((req) => {
  need(req);
  return db().drawdowns.map((d) => {
    const b = db().borrowers.find((x) => x.id === d.borrowerId) || {};
    return Object.assign(decorateDD(d, b), { borrowerName: b.name });
  }).sort((a, c) => (a.bankDebit < c.bankDebit ? 1 : -1));
}));
app.post('/api/drawdowns', H((req) => {
  canEdit(req);
  const b = db().borrowers.find((x) => x.id === +req.body.borrowerId);
  if (!b) throw bad('Pick a borrower.');
  if (!(+req.body.poAmt > 0)) throw bad('Enter the principal / PO amount.');
  const d = Object.assign({ id: store.nextId('drawdown'), borrowerId: b.id },
    calc.computeDrawdown(req.body, b), { createdBy: req.user.name, createdAt: new Date().toISOString() });
  db().drawdowns.push(d);
  store.save();
  return decorateDD(d, b);
}));
app.delete('/api/drawdowns/:id', H((req) => {
  canEdit(req);
  const id = +req.params.id;
  db().payments = db().payments.filter((p) => p.drawdownId !== id);
  db().drawdowns = db().drawdowns.filter((d) => d.id !== id);
  store.save();
  return { ok: true };
}));

/* ---------------- payments (waterfall) ---------------- */
function previewPayment(body) {
  const d = db().drawdowns.find((x) => x.id === +body.drawdownId);
  if (!d) throw bad('Drawdown not found');
  const b = db().borrowers.find((x) => x.id === d.borrowerId);
  const date = body.date || calc.td();
  if (date < d.bankDebit) throw bad('Payment date cannot precede the drawdown date.');
  const amount = +body.amount || 0;
  const alloc = calc.allocatePayment(d, b, amount, date, db().payments);
  return { drawdown: d, borrower: b, date, amount, alloc,
    accruedToDate: alloc.accrued, outstandingBefore: d.outPrin };
}
app.post('/api/payments/preview', H((req) => { need(req); const r = previewPayment(req.body); return { alloc: r.alloc, accruedToDate: r.accruedToDate, outstandingBefore: r.outstandingBefore, date: r.date, amount: r.amount, loanType: r.drawdown.loanType }; }));
app.post('/api/payments', H((req) => {
  canEdit(req);
  const r = previewPayment(req.body);
  const d = r.drawdown, b = r.borrower;
  const p = { id: store.nextId('payment'), borrowerId: b.id, drawdownId: d.id, ref: d.ref,
    date: r.date, amount: r.amount, intAdj: r.alloc.intAdj, prinAdj: r.alloc.prinAdj, outAfter: r.alloc.outAfter,
    closed: r.alloc.closed, kind: r.alloc.kind, rem: req.body.rem || '', createdBy: req.user.name, createdAt: new Date().toISOString() };
  db().payments.push(p);
  d.outPrin = r.alloc.outAfter; d.intOverhang = r.alloc.overhang || 0; d.intCollected = (d.intCollected || 0) + r.alloc.intAdj;
  d.status = r.alloc.closed ? 'Repaid' : 'Open';
  store.save();
  return { payment: p, drawdown: decorateDD(d, b) };
}));
app.delete('/api/payments/:id', H((req) => {
  canEdit(req);
  const p = db().payments.find((x) => x.id === +req.params.id);
  if (!p) throw bad('Payment not found');
  const d = db().drawdowns.find((x) => x.id === p.drawdownId);
  db().payments = db().payments.filter((x) => x.id !== p.id);
  if (d) { // recompute outstanding from remaining payments
    const rest = db().payments.filter((x) => x.drawdownId === d.id).sort((a, c) => (a.date < c.date ? -1 : 1));
    d.outPrin = d.poAmt; d.intOverhang = 0; d.intCollected = 0; d.status = 'Open';
    const b = db().borrowers.find((x) => x.id === d.borrowerId);
    rest.forEach((x) => { const a = calc.allocatePayment(d, b, x.amount, x.date, db().payments.filter((y) => y.drawdownId === d.id && y.id !== x.id && y.date <= x.date));
      x.intAdj = a.intAdj; x.prinAdj = a.prinAdj; x.outAfter = a.outAfter; x.closed = a.closed;
      d.outPrin = a.outAfter; d.intOverhang = a.overhang || 0; d.intCollected += a.intAdj; d.status = a.closed ? 'Repaid' : 'Open'; });
  }
  store.save();
  return { ok: true };
}));

/* ---------------- ledger & MIS (auto) ---------------- */
app.get('/api/ledger', H((req) => {
  need(req);
  return calc.buildLedger(db(), { borrowerId: req.query.borrowerId ? +req.query.borrowerId : null, from: req.query.from || null, to: req.query.to || null });
}));
app.get('/api/mis/:borrowerId', H((req) => {
  need(req);
  const bid = +req.params.borrowerId;
  const b = db().borrowers.find((x) => x.id === bid);
  if (!b) throw bad('Borrower not found');
  return {
    summary: calc.borrowerSummary(db(), bid, req.query.to || calc.td()),
    statement: calc.buildLedger(db(), { borrowerId: bid, from: req.query.from || null, to: req.query.to || null }),
    generatedAt: new Date().toISOString()
  };
}));

/* ---------------- documents ---------------- */
const docView = (d) => { const b = db().borrowers.find((x) => x.id === d.borrowerId) || {}; return Object.assign({}, d, { borrowerName: b.name, hasFile: !!d.relPath }); };
app.get('/api/documents', H((req) => {
  need(req);
  let ds = db().documents.slice();
  if (req.query.status) ds = ds.filter((d) => d.status === req.query.status);
  if (req.query.borrowerId) ds = ds.filter((d) => d.borrowerId === +req.query.borrowerId);
  return ds.sort((a, b) => b.id - a.id).map(docView);
}));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
app.post('/api/borrowers/:id/documents', (req, res, next) => {
  try { canEdit(req); } catch (e) { return next(e); }
  upload.single('file')(req, res, (err) => {
    if (err) return next(Object.assign(err, { status: 400 }));
    try {
      const b = db().borrowers.find((x) => x.id === +req.params.id);
      if (!b) throw bad('Borrower not found.');
      const f = req.file;
      if (!f) throw bad('Attach a PDF to upload.');
      if (!(f.mimetype === 'application/pdf' || /\.pdf$/i.test(f.originalname))) throw bad('Only PDF files are accepted.');
      const folder = path.join(store.paths.CUST_DIR, b.slug);
      fs.mkdirSync(folder, { recursive: true });
      const stored = Date.now() + '-' + f.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/\.pdf$/i, '') + '.pdf';
      fs.writeFileSync(path.join(folder, stored), f.buffer);
      const title = (req.body.title || f.originalname.replace(/\.pdf$/i, '')).trim();
      const d = { id: store.nextId('document'), borrowerId: b.id, title, filename: f.originalname, storedName: stored,
        relPath: path.join('customers', b.slug, stored), size: f.size, uploadedBy: req.user.name, uploadedById: req.user.id,
        uploadedAt: new Date().toISOString(), status: 'pending', decidedBy: null, decidedAt: null, reason: '' };
      db().documents.push(d);
      notify({ toRole: 'director', type: 'upload', docId: d.id, customerName: b.name,
        message: req.user.name + ' uploaded “' + title + '” for ' + b.name + ' — awaiting your review.' });
      store.save();
      res.json(docView(d));
    } catch (e) { next(e); }
  });
});
app.get('/api/documents/:id/file', (req, res, next) => {
  try {
    need(req);
    const d = db().documents.find((x) => x.id === +req.params.id);
    if (!d || !d.relPath) throw Object.assign(new Error('Not found'), { status: 404 });
    const abs = path.join(store.paths.DATA, d.relPath);
    if (!fs.existsSync(abs)) throw Object.assign(new Error('File missing on server'), { status: 404 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + (d.filename || 'document.pdf') + '"');
    fs.createReadStream(abs).pipe(res);
  } catch (e) { next(e); }
});
app.post('/api/documents/:id/decide', H((req) => {
  canApprove(req);
  const d = db().documents.find((x) => x.id === +req.params.id);
  if (!d) throw bad('Document not found.');
  if (d.status !== 'pending') throw bad('This document was already ' + d.status + '.');
  const approve = !!req.body.approve; const reason = (req.body.reason || '').trim();
  if (!approve && !reason) throw bad('A reason is required when rejecting.');
  d.status = approve ? 'approved' : 'rejected'; d.decidedBy = req.user.name; d.decidedAt = new Date().toISOString(); d.reason = reason;
  const b = db().borrowers.find((x) => x.id === d.borrowerId) || {};
  notify({ to: d.uploadedById, type: 'decision', docId: d.id, customerName: b.name,
    message: 'Your document “' + d.title + '” for ' + b.name + ' was ' + d.status + (reason ? ': ' + reason : '') + '.' });
  store.save();
  return docView(d);
}));

/* ---------------- notifications ---------------- */
const forMe = (n, u) => n.to === u.id || (n.toRole && n.toRole === u.role);
app.get('/api/notifications', H((req) => { const u = need(req); const mine = db().notifications.filter((n) => forMe(n, u)).sort((a, b) => b.id - a.id); return { items: mine, unread: mine.filter((n) => !n.read).length }; }));
app.post('/api/notifications/:id/read', H((req) => { const u = need(req); const n = db().notifications.find((x) => x.id === +req.params.id && forMe(x, u)); if (n) n.read = true; store.save(); return { ok: true }; }));
app.post('/api/notifications/read-all', H((req) => { const u = need(req); db().notifications.forEach((n) => { if (forMe(n, u)) n.read = true; }); store.save(); return { ok: true }; }));

/* ---------------- portfolio / dashboard ---------------- */
app.get('/api/portfolio', H((req) => {
  need(req);
  const p = calc.portfolio(db());
  const alerts = [];
  db().borrowers.forEach((b) => {
    const r = calc.renewalStatus(db(), b.id);
    if (r && r.status === 'overdue') alerts.push({ sev: 'high', text: b.name + ' facility renewal is overdue (was due ' + r.renewDate + ')' });
    else if (r && r.status === 'warn') alerts.push({ sev: 'med', text: b.name + ' facility renewal due in ' + r.daysLeft + ' days (' + r.renewDate + ')' });
    db().drawdowns.filter((d) => d.borrowerId === b.id && d.status !== 'Repaid').forEach((d) => {
      const a = d.loanType === 'io' ? { odD: 0 } : calc.poAccrued(d, b, calc.td());
      if (a.odD > 0) alerts.push({ sev: 'high', text: b.name + ' · ' + (d.ref || 'drawdown') + ' is ' + a.odD + ' day(s) overdue' });
    });
  });
  const pending = db().documents.filter((d) => d.status === 'pending').length;
  if (pending) alerts.push({ sev: 'med', text: pending + ' document(s) pending Director review' });
  return Object.assign(p, { alerts, ledger: calc.buildLedger(db()).slice(-8).reverse() });
}));

/* ---------------- admin ---------------- */
app.post('/api/admin/reset', H((req) => {
  const u = need(req);
  if (u.role !== 'director') throw Object.assign(new Error('Only the Director can reset the data.'), { status: 403 });
  store.reset();
  return { ok: true };
}));

/* ---------------- errors ---------------- */
app.use((err, _req, res, _next) => {
  const s = err.status || 500;
  if (s === 500) console.error(err);
  const msg = err.code === 'LIMIT_FILE_SIZE' ? 'PDF is too large (max 25 MB).' : (err.message || 'Server error');
  res.status(s).json({ error: msg });
});
app.listen(PORT, () => console.log('Valuefin Desk API · http://localhost:' + PORT + ' · CORS for ' + ORIGIN));
