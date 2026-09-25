import type { Status } from '../../shared/types.js';
import { modernPolicy } from '../domain.js';
import { activePolicy } from '../database.js';
import type { AppServices } from '../services/context.js';
import { anomalies } from '../services/observability.js';
export function operationsRoutes(services: AppServices) {
  const { app, db, requireRole } = services;
  app.get('/api/overview', (_req, res) => {
    const counts = Object.fromEntries(
      db
        .prepare('SELECT status,count(*) n FROM parcels GROUP BY status')
        .all()
        .map((r) => [r.status, Number(r.n)]),
    ) as Partial<Record<Status, number>>;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const old = Number(
      db
        .prepare(
          "SELECT count(*) n FROM parcels WHERE status='pending_insurance' AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')",
        )
        .get()!.n,
    );
    const alerts = db
      .prepare(
        "SELECT * FROM alerts WHERE created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day') ORDER BY id DESC LIMIT 10",
      )
      .all();
    const signals: string[] = anomalies(db);
    if (old) signals.push(`${old} insurance holds are older than 24 hours.`);
    if (total >= 20 && (counts.pending_insurance ?? 0) / total > 0.4)
      signals.push('More than 40% of stored parcels await insurance. Investigate the backlog.');
    if (alerts.length)
      signals.push('Server failures recorded in the last 24 hours. Investigate request IDs.');
    const current = activePolicy(db);
    const activeDepartments = new Set(modernPolicy(current.policy).rules!.map((r) => r.department));
    const routed = db
      .prepare(
        "SELECT department,count(*) count FROM parcels WHERE status='routed' GROUP BY department",
      )
      .all();
    const totals = new Map(routed.map((r) => [String(r.department), Number(r.count)]));
    const departments = [...new Set([...activeDepartments, ...totals.keys()])]
      .map((department) => ({
        department,
        count: totals.get(department) ?? 0,
        active: activeDepartments.has(department),
      }))
      .sort(
        (a, b) => Number(b.active) - Number(a.active) || a.department.localeCompare(b.department),
      );
    res.json({
      counts,
      total,
      departments,
      policy_version: current.version,
      signals,
      alerts,
    });
  });
  app.get('/api/audit', requireRole('admin'), (_req, res) =>
    res.json({ items: db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 100').all() }),
  );
}
