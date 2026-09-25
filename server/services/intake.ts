import type { Request, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { BatchResult, ParcelInput, RowError } from '../../shared/types.js';
import { activePolicy, transaction } from '../database.js';
import { HttpError, ValidationError, route } from '../domain.js';
import { context } from './context.js';
export interface BatchMetadata {
  filename: string;
  errors: RowError[];
  expectedVersion?: number;
}
export function intakeService(
  db: DatabaseSync,
  audit: (res: Response, action: string, detail: unknown) => void,
) {
  return function saveItems(
    req: Request,
    res: Response,
    items: ParcelInput[],
    digest: string,
    batch?: BatchMetadata,
  ) {
    const key = req.get('Idempotency-Key') ?? '';
    if (key.length < 8 || key.length > 100)
      throw new ValidationError('Supply an Idempotency-Key of 8–100 characters.');
    const scoped = context(res).username + ':' + key;
    const outcome = transaction(db, () => {
      const prior = db.prepare('SELECT * FROM imports WHERE key=?').get(scoped);
      if (prior) {
        if (prior.digest !== digest)
          throw new HttpError(409, 'This operation key was used for different data.');
        return {
          status: 200,
          result: { ...JSON.parse(String(prior.response)), replayed: true } as BatchResult,
        };
      }
      const { version, policy } = activePolicy(db);
      if (batch?.expectedVersion !== undefined && version !== batch.expectedVersion)
        throw new HttpError(409, 'Routing policy changed. Preview the file again.');
      const counts = { routed: 0, pending_insurance: 0 },
        departments: Record<string, number> = Object.create(null),
        ids: number[] = [];
      const decisions = items.map((item) => {
        const decision = route(item, policy);
        counts[decision.status]++;
        departments[decision.department] = (departments[decision.department] ?? 0) + 1;
        return decision;
      });
      let batchId: number | undefined;
      if (batch) {
        batchId = Number(
          db
            .prepare(
              'INSERT INTO batches(filename,uploader,total,accepted,rejected,counts,errors,policy_version) VALUES(?,?,?,?,?,?,?,?)',
            )
            .run(
              batch.filename,
              context(res).username,
              items.length + batch.errors.length,
              items.length,
              batch.errors.length,
              JSON.stringify({ counts, departments }),
              JSON.stringify(batch.errors),
              version,
            ).lastInsertRowid,
        );
      }
      const insert = db.prepare(
        'INSERT INTO parcels(reference,weight,value,country,attributes,department,status,reason,policy_version,batch_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
      );
      items.forEach((item, i) => {
        const decision = decisions[i];
        ids.push(
          Number(
            insert.run(
              item.reference,
              item.weight,
              item.value,
              item.country,
              JSON.stringify(item.attributes),
              decision.department,
              decision.status,
              decision.reason,
              version,
              batchId ?? null,
            ).lastInsertRowid,
          ),
        );
      });
      const result: BatchResult = {
        count: items.length,
        counts,
        departments,
        first_id: ids[0] ?? 0,
        last_id: ids.at(-1) ?? 0,
        policy_version: version,
        ...(batch ? { batch_id: batchId, errors: batch.errors } : {}),
      };
      audit(res, 'parcels_created', result);
      db.prepare('INSERT INTO imports VALUES(?,?,?)').run(scoped, digest, JSON.stringify(result));
      return { status: 201, result };
    });
    res.status(outcome.status).json(outcome.result);
  };
}
