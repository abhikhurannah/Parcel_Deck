import { parse as parseCookie } from 'cookie';
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Role } from '../shared/types.js';
import { equal, sha256, validateAccounts, type Accounts } from './auth.js';
import { openDatabase } from './database.js';
import { HttpError } from './domain.js';
import { createLimiter } from './middleware/limiter.js';
import { loadAccounts, seedAccounts } from './repositories/accounts.js';
import { authRoutes } from './routes/auth.js';
import { importRoutes } from './routes/imports.js';
import { operationsRoutes } from './routes/operations.js';
import { parcelsRoutes } from './routes/parcels.js';
import { policyRoutes } from './routes/policy.js';
import { userRoutes } from './routes/users.js';
import { context } from './services/context.js';
import { intakeService } from './services/intake.js';
import { anomalies, metricsService, webhookNotifier } from './services/observability.js';
export interface AppOptions {
  database: string;
  users: Accounts;
  secureCookies?: boolean;
  allowedHosts?: string[];
  clientDirectory?: string;
  log?: (entry: unknown) => void;
  rateLimit?: number;
  trustProxy?: string[];
  monitorToken?: string;
  alertWebhook?: string;
  webhookFetch?: typeof fetch;
}

export function createApp(options: AppOptions) {
  if (options.monitorToken && options.monitorToken.length < 32)
    throw new Error('MONITOR_TOKEN must contain at least 32 characters.');
  const db = openDatabase(options.database),
    app = express();
  seedAccounts(db, validateAccounts(options.users));
  const users = loadAccounts(db);
  const metrics = metricsService(),
    notify = webhookNotifier(options.alertWebhook, options.webhookFetch, options.log);
  const secure = options.secureCookies ?? true,
    cookieName = 'parceldesk_session';
  app.disable('x-powered-by');
  if (options.trustProxy?.length) app.set('trust proxy', options.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: secure ? [] : null,
        },
      },
      strictTransportSecurity: secure ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.use((req, res, next) => {
    const start = performance.now();
    Object.assign(res.locals, { requestId: randomUUID(), username: 'anonymous' });
    res.set({
      'X-Request-ID': context(res).requestId,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    res.on('finish', () => {
      metrics.record(
        res.statusCode,
        (performance.now() - start) / 1000,
        req.path.startsWith('/api/import'),
      );
      options.log?.({
        event: 'request',
        request_id: context(res).requestId,
        method: req.method,
        route: req.route?.path ?? 'unmatched',
        status: res.statusCode,
        duration_ms: Math.round(performance.now() - start),
        username: context(res).username,
        role: context(res).role ?? 'anonymous',
      });
    });
    if (!(options.allowedHosts ?? ['localhost', '127.0.0.1']).includes(req.hostname))
      return next(new HttpError(400, 'Untrusted host.'));
    next();
  });
  function audit(res: Response, action: string, detail: unknown) {
    db.prepare('INSERT INTO audit(actor,action,detail,request_id) VALUES(?,?,?,?)').run(
      context(res).username,
      action,
      JSON.stringify(detail),
      context(res).requestId,
    );
  }
  const limit = createLimiter();
  app.use('/api', (req, res, next) => {
    try {
      limit('ip:' + req.ip, options.rateLimit ?? 240);
      if (
        req.method === 'GET' &&
        req.path === '/monitor' &&
        options.monitorToken &&
        equal(req.get('Authorization') ?? '', 'Bearer ' + options.monitorToken)
      )
        return next();
      if (req.path === '/login') {
        limit('login:' + req.ip, 10);
        return next();
      }
      const raw = parseCookie(req.headers.cookie ?? '')[cookieName] ?? '';
      const digest = sha256(raw);
      const session = db
        .prepare('SELECT * FROM sessions WHERE token=? AND expires>?')
        .get(digest, Date.now());
      if (!session || !users[String(session.username)])
        throw new HttpError(401, 'Sign in to continue.');
      Object.assign(res.locals, {
        username: String(session.username),
        role: users[String(session.username)].role,
        csrf: String(session.csrf),
        sessionDigest: digest,
      });
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        !equal(req.get('X-CSRF-Token') ?? '', context(res).csrf)
      )
        throw new HttpError(403, 'Security token expired. Sign in again.');
      next();
    } catch (error) {
      next(error);
    }
  });
  const requireRole =
    (...roles: Role[]): RequestHandler =>
    (_req, res, next) =>
      roles.includes(context(res).role)
        ? next()
        : next(new HttpError(403, 'Your role cannot perform this action.'));
  const saveItems = intakeService(db, audit);
  const services = {
    app,
    db,
    users,
    secure,
    cookieName,
    audit,
    requireRole,
    saveItems,
    limit,
    options,
  };
  importRoutes(services);
  app.use(express.json({ limit: '64kb', strict: true }));
  authRoutes(services);
  userRoutes(services);
  parcelsRoutes(services);
  policyRoutes(services);
  operationsRoutes(services);
  app.get('/metrics', (req, res) => {
    if (
      !options.monitorToken ||
      !equal(req.get('Authorization') ?? '', 'Bearer ' + options.monitorToken)
    )
      throw new HttpError(401, 'Monitoring token required.');
    res.type('text/plain; version=0.0.4').send(metrics.render(db));
  });
  app.get('/api/monitor', (req, res) => {
    if (
      !options.monitorToken ||
      !equal(req.get('Authorization') ?? '', 'Bearer ' + options.monitorToken)
    )
      throw new HttpError(403, 'Monitoring token required.');
    res.json({
      status: 'ready',
      signals: anomalies(db),
      alerts: db
        .prepare(
          "SELECT kind,detail,created_at FROM alerts WHERE created_at>strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day') ORDER BY id DESC LIMIT 20",
        )
        .all(),
    });
  });
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.get('/readyz', (_req, res) => {
    db.prepare('SELECT version FROM policies LIMIT 1').get();
    res.json({ status: 'ready' });
  });
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Unknown API route.')));
  const client = options.clientDirectory ?? resolve('dist/client');
  if (existsSync(client)) {
    app.use(express.static(client, { index: false }));
    app.get('/', (_req, res) => res.sendFile(resolve(client, 'index.html')));
  }
  app.use((_req, _res, next) =>
    next(new HttpError(404, 'Page not found. Run npm run build to generate the React app.')),
  );
  app.use(
    (
      error: Error & { status?: number; type?: string },
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 503;
      if (status === 422) {
        try {
          db.prepare("INSERT INTO events(kind) VALUES('validation_error')").run();
        } catch {
          /* report the original error */
        }
      }
      if (status === 503) {
        notify(context(res).requestId);
        options.log?.({
          event: 'server_error',
          request_id: context(res).requestId,
          stack: error.stack,
        });
        try {
          db.prepare('INSERT INTO alerts(kind,detail) VALUES(?,?)').run(
            'server_error',
            context(res).requestId,
          );
        } catch {
          /* stdout remains available when storage is down */
        }
      }
      if (status === 429) res.set('Retry-After', '60');
      res.status(status).json({
        error:
          status === 503
            ? 'Service temporarily unavailable. Retry with the same operation key.'
            : status === 413
              ? 'File or request exceeds its size limit.'
              : error.type === 'entity.parse.failed'
                ? 'Malformed JSON.'
                : error.message,
        request_id: context(res).requestId,
      });
    },
  );
  return { app, db };
}
