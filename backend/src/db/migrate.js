'use strict';
/* ============================================================================
   Migration + seed runner.  `npm run db:migrate`

   Idempotent: creates the database if absent, applies schema.sql (all DDL is
   CREATE TABLE IF NOT EXISTS), then seeds the three staff accounts and the PML
   reference borrower only when those tables are still empty. Safe to re-run.

   `npm run db:reset` drops and rebuilds from scratch.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');
const { seed } = require('./seed');

const SCHEMA = path.join(__dirname, 'schema.sql');

async function rawConnection(withDatabase) {
  return mysql.createConnection({
    host: config.db.host, port: config.db.port,
    user: config.db.user, password: config.db.password,
    database: withDatabase ? config.db.database : undefined,
    multipleStatements: true, dateStrings: true, decimalNumbers: true
  });
}

async function ensureDatabase() {
  const conn = await mysql.createConnection({
    host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.password
  });
  try {
    await conn.query('CREATE DATABASE IF NOT EXISTS `' + config.db.database +
      '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  } catch (e) {
    // The app user may not hold CREATE DATABASE. That is fine when the DBA has
    // already provisioned the schema — surface it only if the DB is missing.
    const [rows] = await conn.query('SHOW DATABASES LIKE ?', [config.db.database]);
    if (!rows.length) throw e;
  } finally { await conn.end(); }
}

async function applySchema() {
  const sql = fs.readFileSync(SCHEMA, 'utf8');
  const conn = await rawConnection(true);
  try { await conn.query(sql); } finally { await conn.end(); }
}

async function dropAll() {
  const conn = await rawConnection(true);
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const [rows] = await conn.query(
      'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?', [config.db.database]);
    for (const r of rows) await conn.query('DROP TABLE IF EXISTS `' + r.t + '`');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally { await conn.end(); }
}

async function main() {
  const reset = process.argv.includes('--reset');
  const t0 = Date.now();
  console.log('[migrate] target ' + config.db.user + '@' + config.db.host + ':' + config.db.port + '/' + config.db.database);

  await ensureDatabase();
  if (reset) { console.log('[migrate] --reset : dropping every table'); await dropAll(); }
  await applySchema();
  console.log('[migrate] schema applied');

  const report = await seed();
  report.forEach((line) => console.log('[seed] ' + line));

  console.log('[migrate] done in ' + (Date.now() - t0) + 'ms');
  const { close } = require('./pool');
  await close();
}

if (require.main === module) {
  main().catch((e) => { console.error('[migrate] FAILED:', e.message); process.exit(1); });
}

module.exports = { ensureDatabase, applySchema, dropAll };
