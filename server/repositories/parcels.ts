import type { DatabaseSync } from 'node:sqlite';
import { ValidationError } from '../domain.js';
export function parcelQuery(query: Record<string, unknown>) {
  const page = Number(query.page ?? 1),
    status = String(query.status ?? ''),
    search = String(query.search ?? '').slice(0, 80);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1e6)
    throw new ValidationError('Page must be a positive integer up to one million.');
  if (!['', 'routed', 'pending_insurance', 'rejected'].includes(status))
    throw new ValidationError('Unknown status.');
  const clauses = ["(?='' OR status=?)", "(reference LIKE ? ESCAPE '\\' OR CAST(id AS TEXT)=?)"],
    params: (string | number)[] = [
      status,
      status,
      '%' + search.replace(/[\\%_]/g, '\\$&') + '%',
      search,
    ];
  for (const field of ['batch_id', 'department', 'country'])
    if (query[field] !== undefined && query[field] !== '') {
      clauses.push(field + '=?');
      params.push(String(query[field]).slice(0, 80));
    }
  for (const [field, op] of [
    ['from', '>='],
    ['to', '<'],
  ] as const)
    if (query[field]) {
      const date = String(query[field]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
        throw new ValidationError('Invalid date filter.');
      clauses.push('created_at ' + op + ' ?');
      params.push(
        field === 'to'
          ? new Date(Date.parse(date) + 86400000).toISOString()
          : new Date(date).toISOString(),
      );
    }
  const sort = query.sort === 'oldest' ? 'id ASC' : 'id DESC';
  return { where: 'WHERE ' + clauses.join(' AND '), params, page, sort };
}
export function parcelPage(db: DatabaseSync, query: Record<string, unknown>) {
  const { where, params, page, sort } = parcelQuery(query);
  return {
    items: db
      .prepare(`SELECT * FROM parcels ${where} ORDER BY ${sort} LIMIT 25 OFFSET ?`)
      .all(...params, (page - 1) * 25),
    total: Number(db.prepare('SELECT count(*) n FROM parcels ' + where).get(...params)!.n),
    page,
    page_size: 25,
  };
}
