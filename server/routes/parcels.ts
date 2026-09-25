import { sha256 } from '../auth.js';
import { transaction } from '../database.js';
import { HttpError, ValidationError, object, validateParcel } from '../domain.js';
import { parcelPage, parcelQuery } from '../repositories/parcels.js';
import type { AppServices } from '../services/context.js';
import { context } from '../services/context.js';
import { csv } from '../services/csv.js';
export function parcelsRoutes(services: AppServices) {
  const { app, db, audit, requireRole, saveItems } = services;
  app.post('/api/parcels', requireRole('operator', 'admin'), (req, res) => {
    const item = validateParcel(req.body);
    saveItems(req, res, [item], sha256(JSON.stringify(item)));
  });
  app.get('/api/parcels', (req, res) => res.json(parcelPage(db, req.query)));
  app.get('/api/parcels.csv', (req, res) => {
    const { where, params, sort } = parcelQuery(req.query);
    const rows = db
      .prepare(
        `SELECT id,reference,weight,value,country,department,status,policy_version,batch_id,reason FROM parcels ${where} ORDER BY ${sort} LIMIT 10001`,
      )
      .all(...params);
    if (rows.length > 10000)
      throw new ValidationError('Export is limited to 10,000 rows. Narrow the filters.');
    res
      .type('text/csv')
      .attachment('parcel-results.csv')
      .send(
        csv([
          [
            'id',
            'reference',
            'weight',
            'value',
            'country',
            'department',
            'status',
            'policy_version',
            'batch_id',
            'reason',
          ],
          ...rows.map((r) => Object.values(r)),
        ]),
      );
  });
  app.post('/api/parcels/:id/approval', requireRole('insurer'), (req, res) => {
    const data = object(req.body),
      id = Number(req.params.id),
      action = data.decision,
      reason = data.reason;
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid parcel ID.');
    if (
      !['approve', 'reject'].includes(String(action)) ||
      typeof reason !== 'string' ||
      reason.trim().length < 5 ||
      reason.trim().length > 500
    )
      throw new ValidationError('Choose approve/reject and give a reason of 5–500 characters.');
    const status = action === 'approve' ? 'routed' : 'rejected';
    transaction(db, () => {
      const row = db.prepare('SELECT * FROM parcels WHERE id=?').get(id);
      if (!row) throw new HttpError(404, 'Parcel not found.');
      if (row.status !== 'pending_insurance')
        throw new HttpError(409, 'Parcel already reviewed. Refresh the queue.');
      db.prepare('UPDATE parcels SET status=?,reason=? WHERE id=?').run(
        status,
        `Insurance ${action} by ${context(res).username}: ${reason.trim()} Original decision: ${row.reason}`,
        id,
      );
      audit(res, 'insurance_' + action, {
        parcel_id: id,
        reason: reason.trim(),
        policy_version: row.policy_version,
      });
    });
    res.json({ ok: true, status });
  });
}
