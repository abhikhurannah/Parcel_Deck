import { performance } from 'node:perf_hooks';
import { activePolicy, openDatabase, transaction } from '../server/database.js';
import { route } from '../server/domain.js';
import { parseBatch } from '../server/imports.js';
const db = openDatabase(':memory:');
try {
  const raw = Buffer.from(
    JSON.stringify(
      Array.from({ length: 5000 }, (_, i) => ({
        reference: `BENCH-${i}`,
        weight: String((i % 100) + 1),
        value: i % 5 === 0 ? '1200' : '10',
        country: 'NL',
      })),
    ),
  );
  const started = performance.now();
  const { items, errors } = parseBatch(raw, 'json');
  if (errors.length) throw new Error('Invalid benchmark input');
  const counts = { routed: 0, pending_insurance: 0 };
  transaction(db, () => {
    const { version, policy } = activePolicy(db);
    const insert = db.prepare(
      'INSERT INTO parcels(reference,weight,value,country,attributes,department,status,reason,policy_version) VALUES(?,?,?,?,?,?,?,?,?)',
    );
    for (const item of items) {
      const result = route(item, policy);
      insert.run(
        item.reference,
        item.weight,
        item.value,
        item.country,
        JSON.stringify(item.attributes),
        result.department,
        result.status,
        result.reason,
        version,
      );
      counts[result.status]++;
    }
  });
  console.log(
    JSON.stringify(
      {
        rows: items.length,
        bytes: raw.length,
        milliseconds: Number((performance.now() - started).toFixed(2)),
        counts,
        note: 'In-memory parser + routing + database benchmark; excludes HTTP, disk fsync and concurrent load.',
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
