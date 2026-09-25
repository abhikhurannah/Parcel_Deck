import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_POLICY,
  route,
  validateParcel,
  validatePolicy,
  ValidationError,
} from '../server/domain.js';
import type { Policy } from '../shared/types.js';
const input = { weight: '1', value: '1000', country: 'NL' };
for (const [weight, target] of [
  ['0.001', 'Mail'],
  ['0.999', 'Mail'],
  ['1', 'Mail'],
  ['1.001', 'Regular'],
  ['9.999', 'Regular'],
  ['10', 'Regular'],
  ['10.001', 'Heavy'],
  ['100000', 'Heavy'],
])
  test(`inclusive weight boundary ${weight} → ${target}`, () => {
    const result = route(validateParcel({ ...input, weight }), DEFAULT_POLICY);
    assert.equal(result.department, target);
    assert.equal(result.status, 'routed');
  });
for (const [value, status] of [
  ['999.99', 'routed'],
  ['1000', 'routed'],
  ['1000.01', 'pending_insurance'],
])
  test(`insurance boundary ${value}`, () =>
    assert.equal(route(validateParcel({ ...input, value }), DEFAULT_POLICY).status, status));
for (const [field, value] of [
  ['weight', 0],
  ['weight', -1],
  ['weight', true],
  ['weight', 'NaN'],
  ['weight', 'Infinity'],
  ['weight', '0.0001'],
  ['weight', '0x10'],
  ['value', -1],
  ['value', '1.001'],
  ['value', false],
  ['country', 'ZZ'],
  ['country', 'Netherlands'],
] as const)
  test(`reject ${field}: ${value}`, () =>
    assert.throws(() => validateParcel({ ...input, [field]: value }), ValidationError));
for (const data of [
  null,
  [],
  {},
  'hello',
  { ...input, approved: true },
  { ...input, attributes: { nested: {} } },
])
  test(`reject invalid schema ${JSON.stringify(data)}`, () =>
    assert.throws(() => validateParcel(data), ValidationError));
test('country is normalized and precision is exact', () => {
  const p = validateParcel({ ...input, country: ' nl ', weight: '1.000', value: '1000.00' });
  assert.equal(p.country, 'NL');
  assert.equal(p.weight, '1');
  assert.equal(p.value, '1000.00');
});
const invalidPolicies: Record<string, (p: Policy) => void> = {
  descending: (p) => {
    p.bands[1].max_kg = '0.5';
  },
  duplicate: (p) => {
    p.bands[1].department = 'Mail';
  },
  catchall: (p) => {
    p.bands[2].max_kg = '100';
  },
  earlyCatchall: (p) => {
    p.bands[0].max_kg = null;
  },
  insurance: (p) => {
    p.insurance_threshold = '1000.01';
  },
  ambiguous: (p) => {
    p.country_overrides = [
      { country: 'IN', department: 'Customs' },
      { country: 'IN', department: 'Other' },
    ];
  },
  injection: (p) => {
    p.bands[0].department = '<script>';
  },
};
for (const [name, change] of Object.entries(invalidPolicies))
  test(`reject unsafe policy: ${name}`, () => {
    const p = structuredClone(DEFAULT_POLICY);
    change(p);
    assert.throws(() => validatePolicy(p), ValidationError);
  });
test('country override cannot bypass insurance', () => {
  const p = structuredClone(DEFAULT_POLICY);
  p.country_overrides = [{ country: 'IN', department: 'Customs' }];
  const result = route(
    validateParcel({ ...input, value: '1000.01', country: 'IN' }),
    validatePolicy(p),
  );
  assert.equal(result.department, 'Customs');
  assert.equal(result.status, 'pending_insurance');
});
test('Bulky extension preserves every boundary and insurance', () => {
  const p = structuredClone(DEFAULT_POLICY);
  p.bands.splice(2, 0, { max_kg: '30', department: 'Bulky' });
  for (const [weight, target] of [
    ['10', 'Regular'],
    ['10.001', 'Bulky'],
    ['30', 'Bulky'],
    ['30.001', 'Heavy'],
  ]) {
    const d = route(validateParcel({ ...input, weight, value: '1200' }), validatePolicy(p));
    assert.equal(d.department, target);
    assert.equal(d.status, 'pending_insurance');
  }
});
