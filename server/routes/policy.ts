import type { Response } from 'express';
import { createHmac } from 'node:crypto';
import type { ParcelRecord, Policy, Preview } from '../../shared/types.js';
import { equal } from '../auth.js';
import { activePolicy, transaction } from '../database.js';
import {
  HttpError,
  ValidationError,
  enforcePolicyTests,
  modernPolicy,
  object,
  policyTestResults,
  route,
  validateParcel,
  validatePolicy,
} from '../domain.js';
import type { AppServices } from '../services/context.js';
import { context } from '../services/context.js';
export function policyRoutes(services: AppServices) {
  const { app, db, audit, requireRole } = services;
  app.get('/api/policy', (_req, res) => {
    const current = activePolicy(db);
    res.json({
      ...current,
      policy: modernPolicy(current.policy),
      history: db
        .prepare('SELECT * FROM policies ORDER BY version DESC LIMIT 20')
        .all()
        .map((row) => ({
          ...row,
          body: JSON.stringify(modernPolicy(JSON.parse(String(row.body)))),
        })),
    });
  });
  function previewToken(res: Response, policy: Policy, version: number) {
    const latest = db.prepare('SELECT COALESCE(MAX(id),0) latest FROM parcels').get()!.latest;
    return createHmac('sha256', context(res).csrf)
      .update(JSON.stringify([policy, version, latest]))
      .digest('hex');
  }
  app.post('/api/policy/preview', requireRole('admin'), (req, res) => {
    const policy = validatePolicy(object(req.body).policy);
    db.exec('BEGIN');
    let result;
    try {
      result = (() => {
        const current = activePolicy(db);
        let total = 0,
          changed = 0,
          new_holds = 0;
        const examples: Preview['examples'] = [];
        for (const row of db
          .prepare('SELECT * FROM parcels ORDER BY id DESC LIMIT 5000')
          .iterate()) {
          const item = row as unknown as ParcelRecord,
            before = route(item, current.policy),
            after = route(item, policy);
          total++;
          if (before.department !== after.department || before.status !== after.status) {
            changed++;
            if (examples.length < 10) examples.push({ id: item.id, before, after });
          }
          if (before.status !== 'pending_insurance' && after.status === 'pending_insurance')
            new_holds++;
        }
        return {
          sample_limit: 5000,
          population: Number(db.prepare('SELECT count(*) n FROM parcels').get()!.n),
          tests: policyTestResults(policy),
          base_version: current.version,
          total,
          changed,
          new_holds,
          examples,
          token: previewToken(res, policy, current.version),
          policy,
        };
      })();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    res.json(result);
  });
  app.post('/api/policy/validate', requireRole('admin'), (req, res) =>
    res.json(modernPolicy(validatePolicy(object(req.body).policy))),
  );
  app.post('/api/policy/test', requireRole('admin'), (req, res) => {
    const body = object(req.body);
    res.json(route(validateParcel(body.parcel), validatePolicy(body.policy)));
  });
  app.post('/api/policy', requireRole('admin'), (req, res) => {
    const data = object(req.body),
      policy = validatePolicy(data.policy),
      reason = data.reason;
    enforcePolicyTests(policy);
    if (typeof reason !== 'string' || reason.trim().length < 10 || reason.trim().length > 500)
      throw new ValidationError('Give a change reason of 10–500 characters.');
    const version = transaction(db, () => {
      const current = activePolicy(db);
      if (
        data.base_version !== current.version ||
        !equal(String(data.token ?? ''), previewToken(res, policy, current.version))
      )
        throw new HttpError(409, 'Policy or intake changed, or preview is missing. Preview again.');
      const sample = db.prepare('SELECT * FROM parcels ORDER BY id DESC LIMIT 5000').all();
      const affected = sample.filter((row) => {
        const item = row as unknown as ParcelRecord;
        const before = route(item, current.policy),
          after = route(item, policy);
        return before.department !== after.department || before.status !== after.status;
      }).length;
      if (sample.length >= 10 && affected / sample.length >= 0.25)
        db.prepare('INSERT INTO alerts(kind,detail) VALUES(?,?)').run(
          'policy_impact',
          JSON.stringify({ affected, sample: sample.length, request_id: context(res).requestId }),
        );
      const version = current.version + 1;
      db.prepare('INSERT INTO policies(version,body,actor,reason) VALUES(?,?,?,?)').run(
        version,
        JSON.stringify(policy),
        context(res).username,
        reason.trim(),
      );
      audit(res, 'policy_activated', { version, previous: current.version, reason: reason.trim() });
      return version;
    });
    res.json({ version });
  });
}
