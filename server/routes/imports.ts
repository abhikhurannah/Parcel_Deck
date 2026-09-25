import express from 'express';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { equal, sha256 } from '../auth.js';
import { activePolicy } from '../database.js';
import { HttpError, ValidationError, route } from '../domain.js';
import { MAX_BYTES, parseBatch } from '../imports.js';
import type { AppServices } from '../services/context.js';
import { context } from '../services/context.js';
import { csv } from '../services/csv.js';
export function importRoutes({ app, db, requireRole, saveItems }: AppServices) {
  const raw = express.raw({ type: 'application/octet-stream', limit: MAX_BYTES });
  for (const path of ['/api/import/preview', '/api/import'])
    app.post(path, requireRole('operator', 'admin'), raw, (req, res) => {
      if (!Buffer.isBuffer(req.body))
        throw new HttpError(415, 'Upload the file as application/octet-stream.');
      const format = String(req.query.format ?? ''),
        country = String(req.query.country ?? '')
          .trim()
          .toUpperCase(),
        partial = req.query.partial === 'true',
        retain = req.query.retain === 'true';
      if (req.query.partial !== undefined && !['true', 'false'].includes(String(req.query.partial)))
        throw new ValidationError('Partial import must be true or false.');
      const filename = String(req.query.filename ?? `batch.${format}`)
        .slice(0, 200)
        .replace(/[\x00-\x1f]/g, '');
      const { items, errors } = parseBatch(req.body, format, country, retain);
      const digest = sha256(
        Buffer.concat([
          Buffer.from(JSON.stringify([format, country, partial, retain, filename])),
          req.body,
        ]),
      );
      const { version, policy } = activePolicy(db);
      const signature = (v: number) =>
        createHmac('sha256', context(res).csrf)
          .update(JSON.stringify([digest, v]))
          .digest('hex');
      if (req.path.endsWith('/preview')) {
        const counts = { routed: 0, pending_insurance: 0 },
          departments: Record<string, number> = Object.create(null);
        for (const item of items) {
          const d = route(item, policy);
          counts[d.status]++;
          departments[d.department] = (departments[d.department] ?? 0) + 1;
        }
        return res.json({
          digest,
          policy_version: version,
          valid: items.length,
          invalid: errors.length,
          counts,
          departments,
          errors,
          token: signature(version),
        });
      }
      if (errors.length && !partial) {
        db.prepare("INSERT INTO events(kind) VALUES('validation_error')").run();
        return res.status(422).json({
          error: `${errors.length} rows need attention. No parcels were imported.`,
          errors,
          error_count: errors.length,
        });
      }
      // Partial ingestion requires explicit review. Existing atomic API callers remain compatible.
      const supplied = req.get('X-Import-Preview');
      const expected = Number(req.get('X-Policy-Version'));
      if (partial && !supplied)
        throw new HttpError(409, 'Preview is required for partial imports.');
      if (supplied && (!Number.isSafeInteger(expected) || !equal(supplied, signature(expected))))
        throw new HttpError(409, 'File or import options changed. Preview again.');
      saveItems(req, res, items, digest, {
        filename,
        errors,
        expectedVersion: supplied ? expected : undefined,
      });
    });
  app.get('/api/batches', (req, res) => {
    const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
    res.json({
      items: db
        .prepare('SELECT * FROM batches ORDER BY id DESC LIMIT 25 OFFSET ?')
        .all((page - 1) * 25),
      total: Number(db.prepare('SELECT count(*) n FROM batches').get()!.n),
      page,
    });
  });
  app.get('/api/batches/:id/errors.csv', (req, res) => {
    const batch = db.prepare('SELECT errors FROM batches WHERE id=?').get(String(req.params.id));
    if (!batch) throw new HttpError(404, 'Batch not found.');
    const errors = JSON.parse(String(batch.errors)) as { row: number; message: string }[];
    res
      .type('text/csv')
      .attachment('rejected-rows.csv')
      .send(csv([['source_row', 'reason'], ...errors.map((e) => [e.row, e.message])]));
  });
  app.get('/api/samples/:name', (req, res) => {
    const name = String(req.params.name);
    if (!['parcels.json', 'Container_68465468.xml'].includes(name))
      throw new HttpError(404, 'Sample not found.');
    res.download(resolve('examples', name));
  });
}
