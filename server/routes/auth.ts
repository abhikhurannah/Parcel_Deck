import { parse as parseCookie } from 'cookie';
import { sha256, token, verifyPassword } from '../auth.js';
import { transaction } from '../database.js';
import { HttpError, ValidationError, object } from '../domain.js';
import type { AppServices } from '../services/context.js';
import { context } from '../services/context.js';
export function authRoutes(services: AppServices) {
  const { app, db, users, secure, cookieName, audit, limit } = services;
  app.post('/api/login', async (req, res) => {
    if (req.get('X-Requested-With') !== 'ParcelDesk' || !req.is('application/json'))
      throw new HttpError(403, 'Unsupported login request.');
    const data = object(req.body),
      username = data.username,
      password = data.password;
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.length > 80 ||
      password.length > 512
    )
      throw new ValidationError('Invalid credentials format.');
    limit('username:' + username.toLowerCase(), 10);
    const user = users[username];
    const hash = user?.password_hash ?? Object.values(users)[0].password_hash;
    const verified = await verifyPassword(password, hash);
    if (!verified || !user || users[username] !== user || users[username]?.password_hash !== hash)
      throw new HttpError(401, 'Username or password is incorrect.');
    const raw = token(),
      csrf = token();
    context(res).username = username;
    context(res).role = user.role;
    transaction(db, () => {
      db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
      db.prepare('DELETE FROM sessions WHERE token=?').run(
        sha256(parseCookie(req.headers.cookie ?? '')[cookieName] ?? ''),
      );
      db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(
        sha256(raw),
        username,
        csrf,
        Date.now() + 8 * 3600000,
      );
      audit(res, 'login', {});
    });
    res
      .cookie(cookieName, raw, {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        maxAge: 8 * 3600000,
        path: '/',
      })
      .json({ username, role: user.role, csrf });
  });
  app.get('/api/me', (_req, res) => {
    const { username, role, csrf } = context(res);
    res.json({ username, role, csrf });
  });
  app.post('/api/logout', (_req, res) => {
    db.prepare('DELETE FROM sessions WHERE token=?').run(context(res).sessionDigest);
    res
      .clearCookie(cookieName, { httpOnly: true, secure, sameSite: 'strict', path: '/' })
      .json({ ok: true });
  });
}
