import { existsSync } from 'node:fs';
import { DatabaseSync, backup } from 'node:sqlite';
const [source, destination] = process.argv.slice(2);
if (!source || !destination || !existsSync(source) || existsSync(destination))
  throw new Error(
    'Usage: npm run backup -- source.sqlite3 NEW-backup.sqlite3. Source must exist; destination must be new.',
  );
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  const restored = new DatabaseSync(destination, { readOnly: true });
  try {
    if (Object.values(restored.prepare('PRAGMA integrity_check').get()!)[0] !== 'ok')
      throw new Error('Backup integrity failed.');
  } finally {
    restored.close();
  }
  console.log('Consistent online backup created; integrity check passed.');
} finally {
  db.close();
}
