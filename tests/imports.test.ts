import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_POLICY, route, ValidationError } from '../server/domain.js';
import { MAX_BYTES, parseBatch } from '../server/imports.js';
const xml = readFileSync(new URL('../examples/Container_68465468.xml', import.meta.url));
test('original XML: exact count and routing reconciliation', () => {
  const { items, errors } = parseBatch(xml, 'xml', 'NL');
  assert.equal(items.length, 17);
  assert.equal(errors.length, 0);
  const results = items.map((p) => route(p, DEFAULT_POLICY));
  assert.equal(results.filter((d) => d.status === 'routed').length, 11);
  assert.equal(results.filter((d) => d.status === 'pending_insurance').length, 6);
  for (const [department, count] of [
    ['Mail', 5],
    ['Regular', 3],
    ['Heavy', 3],
  ])
    assert.equal(
      results.filter((d) => d.status === 'routed' && d.department === department).length,
      count,
    );
});
test('missing XML countries generate one error per row', () =>
  assert.equal(parseBatch(xml, 'xml').errors.length, 17));
for (const [raw, kind] of [
  ['{}', 'json'],
  ['[]', 'json'],
  ['x', 'json'],
  ['[', 'json'],
  ['<bad/>', 'xml'],
  ['[]', 'csv'],
  ['[{"weight":1,"weight":2,"value":0,"country":"NL"}]', 'json'],
  ['<!DOCTYPE Container [<!ENTITY x SYSTEM "file:///etc/passwd">]><Container/>', 'xml'],
  [
    '<Container><parcels><Parcel><Weight>1</Weight><Weight>2</Weight><Value>0</Value></Parcel></parcels></Container>',
    'xml',
  ],
])
  test(`reject malformed/unsafe import: ${raw.slice(0, 38)}`, () =>
    assert.throws(() => parseBatch(Buffer.from(raw), kind, 'NL'), ValidationError));
test('XML explicit country wins over fallback', () => {
  const result = parseBatch(
    Buffer.from(
      '<Container><parcels><Parcel><Weight>1</Weight><Value>0</Value><Country>IN</Country></Parcel></parcels></Container>',
    ),
    'xml',
    'NL',
  );
  assert.equal(result.items[0].country, 'IN');
});
test('file byte limit', () =>
  assert.throws(() => parseBatch(Buffer.alloc(MAX_BYTES + 1), 'json'), ValidationError));
test('row limit', () =>
  assert.throws(
    () =>
      parseBatch(
        Buffer.from(JSON.stringify(Array(5001).fill({ weight: 1, value: 0, country: 'NL' }))),
        'json',
      ),
    ValidationError,
  ));
test('row errors preserve source row number', () => {
  const r = parseBatch(
    Buffer.from(
      JSON.stringify([
        { weight: 1, value: 0, country: 'NL' },
        { weight: -1, value: 0, country: 'NL' },
      ]),
    ),
    'json',
  );
  assert.equal(r.errors[0].row, 2);
});
test('prototype fields are never used as parcel data', () => {
  const r = parseBatch(
    Buffer.from('[{"__proto__":{"weight":"1","value":"0","country":"NL"}}]'),
    'json',
  );
  assert.equal(r.errors.length, 1);
});
