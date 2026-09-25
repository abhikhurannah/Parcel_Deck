import type { DatabaseSync } from 'node:sqlite';
// Version 0 includes databases created by the original assignment implementation.
export function migrate(db: DatabaseSync) {
  const version = Number(db.prepare('PRAGMA user_version').get()!.user_version);
  if (version > 3) throw new Error('Database schema is newer than this application.');
  if (version < 1) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE batches(id INTEGER PRIMARY KEY, filename TEXT NOT NULL,uploader TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),total INTEGER NOT NULL,
        accepted INTEGER NOT NULL,rejected INTEGER NOT NULL,counts TEXT NOT NULL,errors TEXT NOT NULL,
        policy_version INTEGER NOT NULL REFERENCES policies(version));
      ALTER TABLE parcels ADD COLUMN batch_id INTEGER REFERENCES batches(id);
      CREATE INDEX parcel_batch ON parcels(batch_id,id);
      CREATE INDEX parcel_created ON parcels(created_at,id);
      CREATE TABLE users(username TEXT PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('operator','insurer','admin')),
        password_hash TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0);
      PRAGMA user_version=1;COMMIT;`);
  }
  if (version < 2) {
    db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE events(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
    CREATE INDEX events_created ON events(created_at);
    CREATE INDEX alerts_created ON alerts(created_at);
    PRAGMA user_version=2;COMMIT;`);
  }
  if (version < 3) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE UNIQUE INDEX users_single_admin ON users(role) WHERE role='admin';
      PRAGMA user_version=3; COMMIT;`);
  }
}
export function pruneOperationalData(db: DatabaseSync) {
  // Audit history and parcel decisions are deliberately excluded from automatic deletion.
  db.exec(
    "DELETE FROM alerts WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'); DELETE FROM events WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days');",
  );
}
