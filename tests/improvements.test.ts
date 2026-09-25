import fc from 'fast-check';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { before, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { demoAccounts, type Accounts } from '../server/auth.js';
import { openDatabase } from '../server/database.js';
import {
  DEFAULT_POLICY,
  enforcePolicyTests,
  modernPolicy,
  route,
  validateParcel,
  validatePolicy,
  ValidationError,
} from '../server/domain.js';
import { createLimiter } from '../server/middleware/limiter.js';
import { pruneOperationalData } from '../server/migrations.js';
import { csv } from '../server/services/csv.js';
import { anomalies } from '../server/services/observability.js';
let users: Accounts;
before(async () => {
  users = await demoAccounts();
});
const parcel = { weight: '12', value: '1200', country: 'IN', attributes: { fragile: true } };
function custom() {
  const p = modernPolicy(DEFAULT_POLICY);
  p.rules!.unshift({
    id: 'fragile',
    priority: 0,
    when: [{ field: 'attributes.fragile', op: 'eq', value: true }],
    department: 'Special',
  });
  return validatePolicy(p);
}
function setup(extra: Partial<Parameters<typeof createApp>[0]> = {}) {
  const result = createApp({ database: ':memory:', users, secureCookies: false, ...extra });
  return { ...result, client: request.agent(result.app) };
}
async function login(client: ReturnType<typeof request.agent>, role = 'admin') {
  const r = await client
    .post('/api/login')
    .set('X-Requested-With', 'ParcelDesk')
    .send({ username: role, password: `Demo-${role}-2026!` });
  assert.equal(r.status, 200);
  return { 'X-CSRF-Token': r.body.csrf, 'Idempotency-Key': 'review-improvement-operation' };
}
const raw = Buffer.from(
  JSON.stringify([
    { weight: 1, value: 0, country: 'NL' },
    { weight: -1, value: 0, country: 'NL' },
    { weight: 11, value: 1200, country: 'IN' },
  ]),
);
test('fragile rule uses attributes and cannot bypass insurance', () => {
  const d = route(validateParcel(parcel), custom());
  assert.equal(d.department, 'Special');
  assert.equal(d.status, 'pending_insurance');
  assert.match(d.reason, /fragile/);
});
test('fast-check: legacy conversion preserves routing for 2000 generated parcels', () =>
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 100000000 }),
      fc.integer({ min: 0, max: 100000000000 }),
      fc.constantFrom('NL', 'IN', 'US'),
      (w, v, country) => {
        const input = validateParcel({
          weight: (w / 1000).toFixed(3),
          value: (v / 100).toFixed(2),
          country,
        });
        assert.deepEqual(route(input, DEFAULT_POLICY), route(input, modernPolicy(DEFAULT_POLICY)));
        assert.equal(route(input, custom()).status, v > 100000 ? 'pending_insurance' : 'routed');
      },
    ),
    { numRuns: 2000, seed: 24 },
  ));
test('generic comparisons and all conditions must match', () => {
  const p = custom();
  p.rules![0].when = [
    { field: 'weight', op: 'gt', value: '10' },
    { field: 'value', op: 'lt', value: '500' },
    { field: 'country', op: 'in', value: ['IN'] },
  ];
  assert.equal(route(validateParcel({ ...parcel, value: 100 }), p).department, 'Special');
  assert.equal(route(validateParcel({ ...parcel, value: 500 }), p).department, 'Heavy');
  p.rules![0].when = [{ field: 'weight', op: 'gte', value: '12' }];
  assert.equal(route(validateParcel(parcel), p).department, 'Special');
});
for (const [name, change] of Object.entries({
  duplicate: (p: ReturnType<typeof custom>) => {
    p.rules![1].priority = 0;
  },
  catchall: (p: ReturnType<typeof custom>) => {
    p.rules![0].when = [];
  },
  unknown: (p: ReturnType<typeof custom>) => {
    p.rules![0].when = [{ field: 'danger', op: 'eq', value: true } as never];
  },
  insurance: (p: ReturnType<typeof custom>) => {
    p.insurance_threshold = '1001';
  },
}))
  test('reject unsafe generic policy ' + name, () => {
    const p = custom();
    change(p);
    assert.throws(() => validatePolicy(p), ValidationError);
  });
test('policy tests block activation when expected result is wrong', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client),
      p = custom();
    p.tests = [
      {
        name: 'fragile expectation',
        parcel: validateParcel(parcel),
        department: 'Heavy',
        status: 'pending_insurance',
      },
    ];
    assert.throws(() => enforcePolicyTests(p));
    const preview = await client.post('/api/policy/preview').set(h).send({ policy: p });
    assert.equal(preview.body.tests[0].passed, false);
    assert.equal(
      (
        await client
          .post('/api/policy')
          .set(h)
          .send({ ...preview.body, reason: 'Activate reviewed fragile rules' })
      ).status,
      422,
    );
  } finally {
    db.close();
  }
});
test('preview and explicit partial import preserve batch provenance and retries', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client, 'operator'),
      path = '/api/import?format=json&partial=true&filename=test.json';
    const post = (url: string, headers = h) =>
      client.post(url).set(headers).set('Content-Type', 'application/octet-stream').send(raw);
    assert.equal((await post(path)).status, 409);
    const preview = (await post('/api/import/preview?format=json&partial=true&filename=test.json'))
      .body;
    assert.equal(preview.valid, 2);
    assert.equal(preview.invalid, 1);
    assert.equal(preview.errors[0].row, 2);
    assert.equal(db.prepare('SELECT count(*) n FROM parcels').get()!.n, 0);
    const headers = {
      ...h,
      'X-Import-Preview': preview.token,
      'X-Policy-Version': String(preview.policy_version),
    };
    const saved = await post(path, headers);
    assert.equal(saved.status, 201);
    assert.equal(saved.body.count, 2);
    assert.equal((await post(path, headers)).body.replayed, true);
    assert.equal((await client.get('/api/parcels?batch_id=' + saved.body.batch_id)).body.total, 2);
    assert.match((await client.get(`/api/batches/${saved.body.batch_id}/errors.csv`)).text, /"2"/);
    assert.equal((await client.get('/api/batches')).body.items[0].rejected, 1);
  } finally {
    db.close();
  }
});
test('import token rejects changed options and stale policies', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client);
    const preview = (
      await client
        .post('/api/import/preview?format=json&partial=true')
        .set(h)
        .set('Content-Type', 'application/octet-stream')
        .send(raw)
    ).body;
    const headers = {
      ...h,
      'X-Import-Preview': preview.token,
      'X-Policy-Version': String(preview.policy_version),
    };
    assert.equal(
      (
        await client
          .post('/api/import?format=json&partial=true&retain=true')
          .set(headers)
          .set('Content-Type', 'application/octet-stream')
          .send(raw)
      ).status,
      409,
    );
    db.prepare('INSERT INTO policies(version,body,actor,reason) VALUES(2,?,?,?)').run(
      JSON.stringify(DEFAULT_POLICY),
      'admin',
      'changed',
    );
    assert.equal(
      (
        await client
          .post('/api/import?format=json&partial=true')
          .set(headers)
          .set('Content-Type', 'application/octet-stream')
          .send(raw)
      ).status,
      409,
    );
  } finally {
    db.close();
  }
});
test('CSV protects formula injection and quotes', () => {
  assert.equal(
    csv([['=HYPERLINK("evil")', 'a,b', 'line\nend']]),
    '"\'=HYPERLINK(""evil"")","a,b","line\nend"\r\n',
  );
});
test('golden routing fixture', () => {
  const cases = JSON.parse(
    readFileSync(new URL('./fixtures/routing-golden.json', import.meta.url), 'utf8'),
  ) as { input: unknown; department: string; status: string }[];
  for (const c of cases) {
    const d = route(validateParcel(c.input), DEFAULT_POLICY);
    assert.equal(d.department, c.department);
    assert.equal(d.status, c.status);
  }
});
test('schema migrations preserve old parcels and are idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'parcel-migration-'));
  const file = join(dir, 'old.db');
  let db = new DatabaseSync(file);
  db.exec(
    `CREATE TABLE policies(version INTEGER PRIMARY KEY,body TEXT NOT NULL,actor TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT);CREATE TABLE parcels(id INTEGER PRIMARY KEY,reference TEXT,weight TEXT,value TEXT,country TEXT,attributes TEXT,department TEXT,status TEXT,reason TEXT,policy_version INTEGER,created_at TEXT);INSERT INTO parcels VALUES(1,'old','1','0','NL','{}','Mail','routed','old',1,'2026-01-01');`,
  );
  db.close();
  try {
    db = openDatabase(file);
    assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, 3);
    assert.equal(db.prepare('SELECT reference,batch_id FROM parcels').get()!.reference, 'old');
    db.close();
    db = openDatabase(file);
    assert.equal(db.prepare('SELECT count(*) n FROM parcels').get()!.n, 1);
  } finally {
    db.close();
    rmSync(dir, { recursive: true });
  }
});
test('metrics token has no mutation authority and reports response metrics', async () => {
  const token = 'test-monitor-token-that-is-at-least-32';
  const { client, db } = setup({ monitorToken: token });
  try {
    assert.equal((await client.get('/metrics')).status, 401);
    const r = await client.get('/metrics').set('Authorization', 'Bearer ' + token);
    assert.equal(r.status, 200);
    assert.match(r.text, /parceldesk_request_duration_seconds_bucket/);
    assert.equal(
      (await client.get('/api/monitor').set('Authorization', 'Bearer ' + token)).status,
      200,
    );
    assert.equal(
      (
        await client
          .post('/api/parcels')
          .set('Authorization', 'Bearer ' + token)
          .send(parcel)
      ).status,
      401,
    );
  } finally {
    db.close();
  }
});
test('department and validation spikes require a sufficient baseline', () => {
  const { db } = setup();
  try {
    const insert = db.prepare(
      "INSERT INTO parcels(reference,weight,value,country,attributes,department,status,reason,policy_version,created_at) VALUES('x','1','0','NL','{}',?,'routed','test',1,strftime('%Y-%m-%dT%H:%M:%fZ','now',?))",
    );
    for (let i = 0; i < 100; i++) insert.run('Mail', '-2 days');
    assert.deepEqual(anomalies(db), []);
    for (let i = 0; i < 20; i++) insert.run('Heavy', '-10 minutes');
    for (let i = 0; i < 10; i++)
      db.prepare("INSERT INTO events(kind) VALUES('validation_error')").run();
    assert.equal(anomalies(db).length, 3);
  } finally {
    db.close();
  }
});
test('operational retention does not remove audit records', () => {
  const { db } = setup();
  try {
    db.exec(
      "INSERT INTO alerts(kind,detail,created_at) VALUES('test','old','2000-01-01');INSERT INTO audit(actor,action,detail,request_id,created_at) VALUES('test','test','{}','x','2000-01-01');",
    );
    pruneOperationalData(db);
    assert.equal(db.prepare('SELECT count(*) n FROM alerts').get()!.n, 0);
    assert.equal(db.prepare('SELECT count(*) n FROM audit').get()!.n, 1);
  } finally {
    db.close();
  }
});
test('limiter window expires without SQLite writes', () => {
  let now = 0;
  const limit = createLimiter(() => now);
  limit('a', 1);
  assert.throws(() => limit('a', 1));
  now = 60001;
  assert.doesNotThrow(() => limit('a', 1));
});
test('direct 503 webhook and authenticated request log', async () => {
  const calls: unknown[] = [],
    logs: unknown[] = [];
  const send: typeof fetch = async (_url, init) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response('', { status: 200 });
  };
  const { client, db } = setup({
    alertWebhook: 'https://alerts.example.test/hook',
    webhookFetch: send,
    log: (e) => logs.push(e),
  });
  try {
    await login(client);
    await client.get('/api/me');
    assert.ok(
      logs.some(
        (e) =>
          (e as { username: string; role: string }).username === 'admin' &&
          (e as { role: string }).role === 'admin',
      ),
    );
    db.exec('DROP TABLE parcels');
    assert.equal((await client.get('/api/overview')).status, 503);
    assert.equal(calls.length, 1);
  } finally {
    db.close();
  }
});
test('password change revokes sessions and disabled users cannot login', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client);
    assert.equal(
      (
        await client
          .post('/api/users')
          .set(h)
          .send({ username: 'new-user', role: 'operator', password: 'strong-test-password' })
      ).status,
      201,
    );
    assert.equal((await client.post('/api/users/new-user/disable').set(h)).status, 200);
    assert.equal((await client.post('/api/users/admin/disable').set(h)).status, 422);
    const changed = await client
      .post('/api/password')
      .set(h)
      .send({ current: 'Demo-admin-2026!', password: 'changed-test-password' });
    assert.equal(changed.status, 200);
    assert.equal((await client.get('/api/me')).status, 401);
    assert.equal(
      (
        await client
          .post('/api/login')
          .set('X-Requested-With', 'ParcelDesk')
          .send({ username: 'admin', password: 'changed-test-password' })
      ).status,
      200,
    );
  } finally {
    db.close();
  }
});

test('prototype-named department counts stay numeric', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client);
    const p = custom();
    p.rules!.at(-1)!.department = 'constructor';
    db.prepare('UPDATE policies SET body=? WHERE version=1').run(JSON.stringify(p));
    const body = Buffer.from('[{"weight":99,"value":0,"country":"NL"}]');
    const preview = await client
      .post('/api/import/preview?format=json')
      .set(h)
      .set('Content-Type', 'application/octet-stream')
      .send(body);
    assert.equal(preview.body.departments.constructor, 1);
    const saved = await client
      .post('/api/import?format=json')
      .set(h)
      .set('Content-Type', 'application/octet-stream')
      .send(body);
    assert.equal(saved.body.departments.constructor, 1);
  } finally {
    db.close();
  }
});
test('advanced policy validation rejects malformed JSON structure', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client);
    assert.equal(
      (
        await client
          .post('/api/policy/validate')
          .set(h)
          .send({ policy: { rules: {} } })
      ).status,
      422,
    );
    assert.equal(
      (await client.post('/api/policy/validate').set(h).send({ policy: DEFAULT_POLICY })).body.rules
        .length,
      3,
    );
  } finally {
    db.close();
  }
});
test('trusted proxy clients and per-username limits are independent', async () => {
  const { app, db } = setup({ trustProxy: ['loopback'] });
  try {
    for (let i = 0; i < 10; i++) {
      const r = await request(app)
        .post('/api/login')
        .set('X-Forwarded-For', `192.0.2.${i + 1}`)
        .set('X-Requested-With', 'ParcelDesk')
        .send({ username: 'nonexistent', password: 'wrong' });
      assert.equal(r.status, 401);
    }
    const blocked = await request(app)
      .post('/api/login')
      .set('X-Forwarded-For', '192.0.2.50')
      .set('X-Requested-With', 'ParcelDesk')
      .send({ username: 'nonexistent', password: 'wrong' });
    assert.equal(blocked.status, 429);
  } finally {
    db.close();
  }
});

test('distribution includes active zero totals and preserves retired historical counts', async () => {
  const { client, db } = setup();
  try {
    const h = await login(client);
    await client
      .post('/api/parcels')
      .set(h)
      .send({ weight: '1', value: '20', country: 'NL' })
      .expect(201);
    const policy = modernPolicy(DEFAULT_POLICY);
    policy.rules!.find((r) => r.department === 'Mail')!.department = 'Whale';
    const preview = await client.post('/api/policy/preview').set(h).send({ policy }).expect(200);
    await client
      .post('/api/policy')
      .set(h)
      .send({ ...preview.body, reason: 'Rename Mail to Whale for future parcels' })
      .expect(200);
    let overview = (await client.get('/api/overview')).body;
    assert.deepEqual(
      overview.departments.find((d: { department: string }) => d.department === 'Whale'),
      { department: 'Whale', count: 0, active: true },
    );
    assert.deepEqual(
      overview.departments.find((d: { department: string }) => d.department === 'Mail'),
      { department: 'Mail', count: 1, active: false },
    );
    await client
      .post('/api/parcels')
      .set({ ...h, 'Idempotency-Key': 'whale-parcel' })
      .send({ weight: '1', value: '20', country: 'NL' })
      .expect(201);
    overview = (await client.get('/api/overview')).body;
    assert.equal(
      overview.departments.find((d: { department: string }) => d.department === 'Whale').count,
      1,
    );
  } finally {
    db.close();
  }
});

test('only admin can approve multiple named staff accounts and no second admin can exist', async () => {
  const { app, client, db } = setup();
  try {
    const staff = request.agent(app);
    const staffHeaders = await login(staff, 'operator');
    const candidate = {
      username: 'operator-two',
      role: 'operator',
      password: 'Approved-password-2026!',
    };
    await staff.post('/api/users').set(staffHeaders).send(candidate).expect(403);
    await request(app).post('/api/users').send(candidate).expect(401);
    await request(app)
      .post('/api/login')
      .set('X-Requested-With', 'ParcelDesk')
      .send({ username: candidate.username, password: candidate.password })
      .expect(401);
    const h = await login(client);
    for (const [username, role] of [
      ['operator-two', 'operator'],
      ['operator-three', 'operator'],
      ['insurer-two', 'insurer'],
      ['insurer-three', 'insurer'],
    ]) {
      await client
        .post('/api/users')
        .set(h)
        .send({ ...candidate, username, role })
        .expect(201);
      const signedIn = await request
        .agent(app)
        .post('/api/login')
        .set('X-Requested-With', 'ParcelDesk')
        .send({ username, password: candidate.password })
        .expect(200);
      assert.equal(signedIn.body.role, role);
    }
    await client
      .post('/api/users')
      .set(h)
      .send({ ...candidate, username: 'admin-two', role: 'admin' })
      .expect(422);
    assert.throws(
      () =>
        db
          .prepare("INSERT INTO users(username,role,password_hash) VALUES('admin-two','admin',?)")
          .run(users.admin.password_hash),
      /UNIQUE/,
    );
    assert.equal(db.prepare("SELECT count(*) n FROM users WHERE role='admin'").get()!.n, 1);
  } finally {
    db.close();
  }
});
