import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Policy } from '../shared/types.js';
import { DEFAULT_POLICY } from './domain.js';
import { migrate, pruneOperationalData } from './migrations.js';
const SCHEMA = `
CREATE TABLE IF NOT EXISTS policies (
 version INTEGER PRIMARY KEY, body TEXT NOT NULL, actor TEXT NOT NULL,
 reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS parcels (
 id INTEGER PRIMARY KEY, reference TEXT NOT NULL, weight TEXT NOT NULL, value TEXT NOT NULL,
 country TEXT NOT NULL, attributes TEXT NOT NULL, department TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('routed','pending_insurance','rejected')),
 reason TEXT NOT NULL, policy_version INTEGER NOT NULL REFERENCES policies(version),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS parcel_status ON parcels(status,id);
CREATE TABLE IF NOT EXISTS audit (
 id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
 detail TEXT NOT NULL, request_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS imports (
 key TEXT PRIMARY KEY, digest TEXT NOT NULL, response TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
 token TEXT PRIMARY KEY, username TEXT NOT NULL, csrf TEXT NOT NULL, expires REAL NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset REAL NOT NULL);
CREATE TABLE IF NOT EXISTS alerts (
 id INTEGER PRIMARY KEY, kind TEXT NOT NULL, detail TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
`;
export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000;');
    db.exec(SCHEMA);
    migrate(db);
    pruneOperationalData(db);
    db.prepare('INSERT OR IGNORE INTO policies(version,body,actor,reason) VALUES(1,?,?,?)').run(
      JSON.stringify(DEFAULT_POLICY),
      'system',
      'Assignment defaults',
    );
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
// All callbacks must be synchronous. Never await while a transaction is open.
// Decimal values remain TEXT so storage never rounds business boundaries through binary floats.
export function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
export function activePolicy(db: DatabaseSync): { version: number; policy: Policy } {
  const row = db.prepare('SELECT version,body FROM policies ORDER BY version DESC LIMIT 1').get()!;
  return { version: Number(row.version), policy: JSON.parse(String(row.body)) as Policy };
}
