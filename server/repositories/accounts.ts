import type { DatabaseSync } from 'node:sqlite';
import type { Accounts } from '../auth.js';
export function seedAccounts(db: DatabaseSync, accounts: Accounts) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO users(username,role,password_hash) VALUES(?,?,?)',
  );
  for (const [name, account] of Object.entries(accounts)) {
    if (
      account.role === 'admin' &&
      db.prepare("SELECT username FROM users WHERE role='admin'").get()
    )
      continue;
    insert.run(name, account.role, account.password_hash);
  }
}
export function loadAccounts(db: DatabaseSync): Accounts {
  return Object.assign(
    Object.create(null) as Accounts,
    Object.fromEntries(
      db
        .prepare('SELECT * FROM users WHERE disabled=0')
        .all()
        .map((r) => [String(r.username), { role: r.role, password_hash: r.password_hash }]),
    ),
  );
}
