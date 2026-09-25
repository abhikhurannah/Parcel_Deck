import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { demoAccounts, type Accounts } from '../server/auth.js';
import { transaction } from '../server/database.js';
import { DEFAULT_POLICY } from '../server/domain.js';
import type { Role } from '../shared/types.js';
let users: Accounts;
before(async () => {
  users = await demoAccounts();
});
function setup() {
  const { app, db } = createApp({ database: ':memory:', users, secureCookies: false });
  return { app, db, client: request.agent(app) };
}
type Client = ReturnType<typeof request.agent>;
async function login(client: Client, role: Role = 'operator') {
  const r = await client
    .post('/api/login')
    .set('X-Requested-With', 'ParcelDesk')
    .send({ username: role, password: `Demo-${role}-2026!` });
  assert.equal(r.status, 200);
  return { 'X-CSRF-Token': r.body.csrf as string, 'Idempotency-Key': 'test-operation-1' };
}
const create = (
  client: Client,
  headers: Record<string, string>,
  extra: Record<string, unknown> = {},
) =>
  client
    .post('/api/parcels')
    .set(headers)
    .send({ weight: '1', value: '0', country: 'NL', ...extra });
test('all business routes require authentication', async () => {
  const { client, db } = setup();
  try {
    assert.equal((await client.get('/api/parcels')).status, 401);
    assert.equal((await client.get('/healthz')).status, 200);
    assert.equal((await client.get('/readyz')).status, 200);
  } finally {
    db.close();
  }
});
test('login JSON/custom header and credentials are checked', async () => {
  const { client, db } = setup();
  try {
    assert.equal(
      (await client.post('/api/login').send({ username: 'operator', password: 'bad' })).status,
      403,
    );
    assert.equal(
      (
        await client
          .post('/api/login')
          .set('X-Requested-With', 'ParcelDesk')
          .send({ username: 'operator', password: 'bad' })
      ).status,
      401,
    );
    assert.equal(
      (
        await client
          .post('/api/login')
          .set('X-Requested-With', 'ParcelDesk')
          .send({ username: 'toString', password: 'Demo-operator-2026!' })
      ).status,
      401,
    );
  } finally {
    db.close();
  }
});
test('CSRF, response headers and logout invalidation', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client);
    assert.equal((await create(client, {})).status, 403);
    assert.equal((await create(client, h)).status, 201);
    const me = await client.get('/api/me');
    assert.match(me.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal(me.headers['x-content-type-options'], 'nosniff');
    assert.equal(me.headers['cache-control'], 'no-store');
    assert.equal((await client.post('/api/logout').set(h)).status, 200);
    assert.equal((await client.get('/api/me')).status, 401);
  } finally {
    db.close();
  }
});
test('same operation replay and conflicting content', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client);
    assert.equal((await create(client, h)).status, 201);
    const replay = await create(client, h);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);
    assert.equal((await create(client, h, { weight: 2 })).status, 409);
    assert.equal((await client.get('/api/parcels')).body.total, 1);
  } finally {
    db.close();
  }
});
test('insurer alone can approve and review happens once', async () => {
  const { client, db } = setup();
  try {
    let h = await login(client);
    const pid = (await create(client, h, { value: '1000.01' })).body.first_id;
    const path = `/api/parcels/${pid}/approval`,
      body = { decision: 'approve', reason: 'Coverage checked' };
    assert.equal((await client.post(path).set(h).send(body)).status, 403);
    h = await login(client, 'admin');
    assert.equal((await client.post(path).set(h).send(body)).status, 403);
    h = await login(client, 'insurer');
    assert.equal((await create(client, h)).status, 403);
    assert.equal((await client.post(path).set(h).send(body)).status, 200);
    assert.equal((await client.post(path).set(h).send(body)).status, 409);
    assert.equal((await client.get('/api/parcels')).body.items[0].status, 'routed');
  } finally {
    db.close();
  }
});
test('reject does not count as routed', async () => {
  const { client, db } = setup();
  try {
    let h = await login(client);
    const id = (await create(client, h, { value: 2000 })).body.first_id;
    h = await login(client, 'insurer');
    assert.equal(
      (
        await client
          .post(`/api/parcels/${id}/approval`)
          .set(h)
          .send({ decision: 'reject', reason: 'Coverage denied' })
      ).status,
      200,
    );
    assert.ok(
      (await client.get('/api/overview')).body.departments.every(
        (d: { count: number }) => d.count === 0,
      ),
    );
  } finally {
    db.close();
  }
});
test('supplied XML imports once with confirmed fallback', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client),
      xml = readFileSync(new URL('../examples/Container_68465468.xml', import.meta.url));
    const upload = (country: string) =>
      client
        .post('/api/import?format=xml&country=' + country)
        .set(h)
        .set('Content-Type', 'application/octet-stream')
        .send(xml);
    assert.equal((await upload('')).body.error_count, 17);
    assert.equal((await client.get('/api/parcels')).body.total, 0);
    const result = await upload('NL');
    assert.equal(result.status, 201);
    assert.deepEqual(result.body.counts, { routed: 11, pending_insurance: 6 });
    assert.equal((await upload('NL')).body.replayed, true);
  } finally {
    db.close();
  }
});
test('invalid batch is atomic and row errors are clear', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client);
    const raw = Buffer.from(
      JSON.stringify([
        { weight: 1, value: 0, country: 'NL' },
        { weight: -1, value: 0, country: 'NL' },
      ]),
    );
    const r = await client
      .post('/api/import?format=json')
      .set(h)
      .set('Content-Type', 'application/octet-stream')
      .send(raw);
    assert.equal(r.status, 422);
    assert.equal(r.body.errors[0].row, 2);
    assert.equal((await client.get('/api/parcels')).body.total, 0);
  } finally {
    db.close();
  }
});
test('oversized upload returns 413', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client);
    assert.equal(
      (
        await client
          .post('/api/import?format=json')
          .set(h)
          .set('Content-Type', 'application/octet-stream')
          .send(Buffer.alloc(2 * 1024 * 1024 + 1))
      ).status,
      413,
    );
  } finally {
    db.close();
  }
});
test('policy activation preserves history and rollback increases version', async () => {
  const { client, db } = setup();
  try {
    let h = await login(client);
    await create(client, h, { weight: 2 });
    h = await login(client, 'admin');
    const p = structuredClone(DEFAULT_POLICY);
    p.bands[0].max_kg = '3';
    const preview = (await client.post('/api/policy/preview').set(h).send({ policy: p })).body;
    assert.equal(preview.changed, 1);
    const body = { ...preview, reason: 'Expand Mail capacity following review' };
    assert.equal((await client.post('/api/policy').set(h).send(body)).body.version, 2);
    assert.equal((await client.post('/api/policy').set(h).send(body)).status, 409);
    assert.equal((await client.get('/api/parcels')).body.items[0].department, 'Regular');
    h['Idempotency-Key'] = 'new-operation-key';
    await create(client, h, { weight: 2 });
    assert.equal((await client.get('/api/parcels')).body.items[0].department, 'Mail');
    const rollback = (
      await client.post('/api/policy/preview').set(h).send({ policy: DEFAULT_POLICY })
    ).body;
    assert.equal(
      (
        await client
          .post('/api/policy')
          .set(h)
          .send({ ...rollback, reason: 'Rollback after capacity issue' })
      ).body.version,
      3,
    );
    assert.equal(
      (await client.get('/api/audit')).body.items.filter(
        (x: { action: string }) => x.action === 'policy_activated',
      ).length,
      2,
    );
  } finally {
    db.close();
  }
});
test('new intake and modified candidate invalidate preview', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client, 'admin');
    let preview = (await client.post('/api/policy/preview').set(h).send({ policy: DEFAULT_POLICY }))
      .body;
    await create(client, h);
    assert.equal(
      (
        await client
          .post('/api/policy')
          .set(h)
          .send({ ...preview, reason: 'A reviewed policy change' })
      ).status,
      409,
    );
    preview = (await client.post('/api/policy/preview').set(h).send({ policy: DEFAULT_POLICY }))
      .body;
    preview.policy.bands[0].max_kg = '2';
    assert.equal(
      (
        await client
          .post('/api/policy')
          .set(h)
          .send({ ...preview, reason: 'A reviewed policy change' })
      ).status,
      409,
    );
  } finally {
    db.close();
  }
});
test('operator cannot preview policies or read audit', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client);
    assert.equal((await client.get('/api/audit')).status, 403);
    assert.equal(
      (await client.post('/api/policy/preview').set(h).send({ policy: DEFAULT_POLICY })).status,
      403,
    );
  } finally {
    db.close();
  }
});
test('SQL injection stays data; literal wildcard search', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client),
      reference = "'; DROP TABLE parcels; --%";
    await create(client, h, { reference });
    assert.equal((await client.get('/api/parcels').query({ search: reference })).body.total, 1);
    assert.equal((await client.get('/api/parcels').query({ search: '_' })).body.total, 0);
  } finally {
    db.close();
  }
});
test('pagination returns 25 rows and rejects invalid input', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client);
    await client
      .post('/api/import?format=json')
      .set(h)
      .set('Content-Type', 'application/octet-stream')
      .send(
        Buffer.from(
          JSON.stringify(
            Array.from({ length: 55 }, (_, i) => ({
              reference: `batch-${i}`,
              weight: 1,
              value: 0,
              country: 'NL',
            })),
          ),
        ),
      );
    assert.equal((await client.get('/api/parcels?page=2')).body.items.length, 25);
    assert.equal((await client.get('/api/parcels?page=3')).body.items.length, 5);
    assert.equal((await client.get('/api/parcels?page=NaN')).status, 422);
    assert.equal((await client.get('/api/parcels?status=unknown')).status, 422);
  } finally {
    db.close();
  }
});
test('database transaction rollback is atomic', () => {
  const { db } = setup();
  try {
    assert.throws(() =>
      transaction(db, () => {
        db.prepare('INSERT INTO alerts(kind,detail) VALUES(?,?)').run('test', 'rollback');
        throw new Error('failure');
      }),
    );
    assert.equal(db.prepare('SELECT count(*) n FROM alerts').get()!.n, 0);
  } finally {
    db.close();
  }
});
test('competing reviews have one winner', async () => {
  const { app, client, db } = setup();
  try {
    const h = await login(client),
      id = (await create(client, h, { value: 2000 })).body.first_id;
    const a = request.agent(app),
      b = request.agent(app),
      ha = await login(a, 'insurer'),
      hb = await login(b, 'insurer');
    const codes = (
      await Promise.all([
        a
          .post(`/api/parcels/${id}/approval`)
          .set(ha)
          .send({ decision: 'approve', reason: 'Evidence checked' }),
        b
          .post(`/api/parcels/${id}/approval`)
          .set(hb)
          .send({ decision: 'reject', reason: 'Evidence disputed' }),
      ])
    )
      .map((r) => r.status)
      .sort();
    assert.deepEqual(codes, [200, 409]);
  } finally {
    db.close();
  }
});
test('concurrent retries insert only once', async () => {
  const { app, db } = setup();
  try {
    const a = request.agent(app),
      b = request.agent(app),
      ha = await login(a),
      hb = await login(b);
    const results = await Promise.all([create(a, ha), create(b, hb)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
    assert.equal(db.prepare('SELECT count(*) n FROM parcels').get()!.n, 1);
  } finally {
    db.close();
  }
});
test('expired sessions and invalid host are blocked', async () => {
  const { client, db } = setup();
  try {
    await login(client);
    db.prepare('UPDATE sessions SET expires=0').run();
    assert.equal((await client.get('/api/me')).status, 401);
    assert.equal((await client.get('/').set('Host', 'evil.example')).status, 400);
  } finally {
    db.close();
  }
});
test('approval keeps the intake policy after rule changes', async () => {
  const { client, db } = setup();
  try {
    let h = await login(client);
    const id = (await create(client, h, { weight: 2, value: 2000 })).body.first_id;
    h = await login(client, 'admin');
    const p = structuredClone(DEFAULT_POLICY);
    p.bands[0].max_kg = '5';
    const preview = (await client.post('/api/policy/preview').set(h).send({ policy: p })).body;
    await client
      .post('/api/policy')
      .set(h)
      .send({ ...preview, reason: 'Expand future Mail capacity' });
    h = await login(client, 'insurer');
    await client
      .post(`/api/parcels/${id}/approval`)
      .set(h)
      .send({ decision: 'approve', reason: 'Coverage confirmed' });
    const item = (await client.get('/api/parcels')).body.items[0];
    assert.equal(item.department, 'Regular');
    assert.equal(item.policy_version, 1);
  } finally {
    db.close();
  }
});
test('rate limit returns a retry time', async () => {
  const { client, db } = setup();
  try {
    let r;
    for (let i = 0; i < 11; i++)
      r = await client
        .post('/api/login')
        .set('X-Requested-With', 'ParcelDesk')
        .send({ username: 'no-user', password: 'bad' });
    assert.equal(r!.status, 429);
    assert.equal(r!.headers['retry-after'], '60');
  } finally {
    db.close();
  }
});
test('production cookies are secure and HttpOnly', async () => {
  const { app, db } = createApp({ database: ':memory:', users, secureCookies: true });
  try {
    const r = await request(app)
      .post('/api/login')
      .set('X-Requested-With', 'ParcelDesk')
      .send({ username: 'operator', password: 'Demo-operator-2026!' });
    const cookie = r.headers['set-cookie'][0];
    assert.match(cookie, /Secure/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.ok(r.headers['strict-transport-security']);
  } finally {
    db.close();
  }
});
test('unexpected errors do not leak internals', async () => {
  const { client, db } = setup();
  const h = await login(client);
  db.exec('DROP TABLE parcels');
  try {
    const r = await client.get('/api/overview').set(h);
    assert.equal(r.status, 503);
    assert.ok(r.body.request_id);
    assert.doesNotMatch(r.body.error, /SQL|table|SELECT/);
    assert.equal(db.prepare('SELECT count(*) n FROM alerts').get()!.n, 1);
  } finally {
    db.close();
  }
});
