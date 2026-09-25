import { hashPassword, verifyPassword, type Account } from '../auth.js';
import { transaction } from '../database.js';
import { HttpError, object, ValidationError } from '../domain.js';
import type { AppServices } from '../services/context.js';
import { context } from '../services/context.js';
function password(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    throw new ValidationError('Choose a password of 12–128 characters.');
  return value;
}
export function userRoutes({ app, db, users, requireRole, audit, limit }: AppServices) {
  app.post('/api/password', async (req, res) => {
    const data = object(req.body),
      name = context(res).username;
    limit('password:' + name, 5);
    const current = users[name].password_hash;
    if (
      typeof data.current !== 'string' ||
      data.current.length > 512 ||
      !(await verifyPassword(data.current, current))
    )
      throw new HttpError(403, 'Current password is incorrect.');
    const hash = await hashPassword(password(data.password));
    transaction(db, () => {
      const changed = db
        .prepare(
          'UPDATE users SET password_hash=? WHERE username=? AND password_hash=? AND disabled=0',
        )
        .run(hash, name, current);
      if (!changed.changes) throw new HttpError(409, 'Account changed. Sign in again.');
      db.prepare('DELETE FROM sessions WHERE username=?').run(name);
      audit(res, 'password_changed', { username: name });
    });
    users[name].password_hash = hash;
    res.json({ ok: true });
  });
  app.get('/api/users', requireRole('admin'), (_req, res) =>
    res.json({
      items: db.prepare('SELECT username,role,disabled FROM users ORDER BY username').all(),
    }),
  );
  app.post('/api/users', requireRole('admin'), async (req, res) => {
    const data = object(req.body),
      name = data.username;
    limit('users:' + context(res).username, 10);
    if (
      typeof name !== 'string' ||
      !/^[A-Za-z0-9_.-]{1,80}$/.test(name) ||
      ['__proto__', 'constructor', 'prototype'].includes(name) ||
      !['operator', 'insurer'].includes(String(data.role))
    )
      throw new ValidationError(
        'Choose a valid username and the operator or insurer role. There is only one administrator.',
      );
    const hash = await hashPassword(password(data.password));
    const account: Account = { role: data.role as Account['role'], password_hash: hash };
    transaction(db, () => {
      if (db.prepare('SELECT username FROM users WHERE username=?').get(name))
        throw new HttpError(409, 'Username already exists.');
      db.prepare('INSERT INTO users(username,role,password_hash) VALUES(?,?,?)').run(
        name,
        account.role,
        hash,
      );
      audit(res, 'user_created', { username: name, role: account.role });
    });
    users[name] = account;
    res.status(201).json({ ok: true });
  });
  app.post('/api/users/:name/disable', requireRole('admin'), (req, res) => {
    const name = String(req.params.name);
    if (name === context(res).username)
      throw new ValidationError('You cannot disable your own account.');
    transaction(db, () => {
      if (
        !db.prepare('UPDATE users SET disabled=1 WHERE username=? AND disabled=0').run(name).changes
      )
        throw new HttpError(404, 'Active user not found.');
      db.prepare('DELETE FROM sessions WHERE username=?').run(name);
      audit(res, 'user_disabled', { username: name });
    });
    delete users[name];
    res.json({ ok: true });
  });
}
