import { Decimal } from 'decimal.js';
import type {
  Condition,
  Decision,
  ParcelInput,
  Policy,
  PolicyTest,
  Rule,
} from '../shared/types.js';
export class ValidationError extends Error {
  status = 422;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const COUNTRIES = new Set(
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  ),
);
export const DEFAULT_POLICY: Policy = {
  insurance_threshold: '1000.00',
  bands: [
    { max_kg: '1', department: 'Mail' },
    { max_kg: '10', department: 'Regular' },
    { max_kg: null, department: 'Heavy' },
  ],
  country_overrides: [],
};
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ValidationError('Expected a JSON object.');
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(','))
    throw new ValidationError(`Expected these fields only: ${keys.join(', ')}.`);
}
export function decimal(value: unknown, label: string, max: number, places: number): Decimal {
  if (
    !['string', 'number'].includes(typeof value) ||
    String(value).length > 64 ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(value))
  )
    throw new ValidationError(`${label} must be a number.`);
  let n: Decimal;
  try {
    n = new Decimal(String(value));
  } catch {
    throw new ValidationError(`${label} must be a number.`);
  }
  if (!n.isFinite() || n.lt(0) || n.gt(max))
    throw new ValidationError(`${label} must be between 0 and ${max}.`);
  if (n.decimalPlaces() > places)
    throw new ValidationError(`${label} supports at most ${places} decimal places.`);
  return n;
}
export function validateParcel(input: unknown): ParcelInput {
  const p = object(input);
  if (['weight', 'value', 'country'].some((k) => !Object.hasOwn(p, k)))
    throw new ValidationError('Weight, value and country are required.');
  if (
    Object.keys(p).some(
      (k) => !['reference', 'weight', 'value', 'country', 'attributes'].includes(k),
    )
  )
    throw new ValidationError('Unknown parcel fields are not allowed.');
  const weight = decimal(p.weight, 'Weight', 100000, 3);
  if (weight.isZero()) throw new ValidationError('Weight must be greater than zero.');
  const value = decimal(p.value, 'Value', 1e9, 2);
  const country = typeof p.country === 'string' ? p.country.trim().toUpperCase() : '';
  if (!COUNTRIES.has(country))
    throw new ValidationError('Choose a valid two-letter destination country, e.g. NL or IN.');
  const reference = p.reference ?? '';
  if (typeof reference !== 'string' || reference.length > 80 || /[\x00-\x1f]/.test(reference))
    throw new ValidationError('Reference must be plain text of up to 80 characters.');
  const attributes = object(p.attributes ?? {});
  if (
    Object.keys(attributes).length > 10 ||
    Object.entries(attributes).some(
      ([k, v]) =>
        !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k) ||
        !['string', 'boolean'].includes(typeof v) ||
        String(v).length > 200,
    )
  )
    throw new ValidationError('Attributes allow at most 10 short text or boolean values.');
  return {
    reference: reference.trim(),
    weight: weight.toFixed(),
    value: value.toFixed(2),
    country,
    attributes: attributes as ParcelInput['attributes'],
  };
}
function department(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9 -]{0,39}$/.test(value))
    throw new ValidationError(
      'Department must start with a letter and use at most 40 plain characters.',
    );
  return value;
}
export function validatePolicy(input: unknown): Policy {
  const p = object(input);
  if (Object.hasOwn(p, 'rules')) return validateRulePolicy(p);
  exactKeys(p, ['insurance_threshold', 'bands', 'country_overrides']);
  const threshold = decimal(p.insurance_threshold, 'Insurance threshold', 1000, 2);
  if (!Array.isArray(p.bands) || p.bands.length < 2 || p.bands.length > 12)
    throw new ValidationError('Provide 2–12 ascending weight bands and a final catch-all.');
  let previous = new Decimal(0);
  const names = new Set<string>();
  const length = p.bands.length;
  const bands = p.bands.map((raw, index) => {
    const band = object(raw);
    exactKeys(band, ['max_kg', 'department']);
    const name = department(band.department);
    if (names.has(name)) throw new ValidationError('Department names must be unique across bands.');
    names.add(name);
    if (index === length - 1) {
      if (band.max_kg !== null)
        throw new ValidationError('Final max_kg must be null to cover every weight.');
      return { max_kg: null, department: name };
    }
    const bound = decimal(band.max_kg, 'Weight boundary', 100000, 3);
    if (bound.lte(previous))
      throw new ValidationError('Weight boundaries must be strictly increasing.');
    previous = bound;
    return { max_kg: bound.toFixed(), department: name };
  });
  if (!Array.isArray(p.country_overrides) || p.country_overrides.length > 30)
    throw new ValidationError('Allow at most 30 destination overrides.');
  const seen = new Set<string>();
  const country_overrides = p.country_overrides.map((raw) => {
    const override = object(raw);
    exactKeys(override, ['country', 'department']);
    if (
      typeof override.country !== 'string' ||
      !COUNTRIES.has(override.country) ||
      seen.has(override.country)
    )
      throw new ValidationError('Override countries must be valid, uppercase and unique.');
    seen.add(override.country);
    return { country: override.country, department: department(override.department) };
  });
  return { insurance_threshold: threshold.toFixed(2), bands, country_overrides };
}

// One registry governs supported condition fields. Arbitrary code and property paths are never evaluated.
export const conditionRegistry = {
  weight: { kind: 'decimal', max: 100000, places: 3 },
  value: { kind: 'decimal', max: 1e9, places: 2 },
  country: { kind: 'country' },
  attributes: { kind: 'attribute' },
} as const;
function validateCondition(raw: unknown): Condition {
  const c = object(raw);
  exactKeys(c, ['field', 'op', 'value']);
  if (c.field === 'weight' || c.field === 'value') {
    const spec = conditionRegistry[c.field];
    if (!['lt', 'lte', 'gt', 'gte'].includes(String(c.op)))
      throw new ValidationError('Invalid numeric comparison.');
    return {
      field: c.field,
      op: c.op as 'lt' | 'lte' | 'gt' | 'gte',
      value: decimal(c.value, 'Condition value', spec.max, spec.places).toFixed(),
    };
  }
  if (c.field === 'country') {
    if (
      c.op !== 'in' ||
      !Array.isArray(c.value) ||
      !c.value.length ||
      c.value.length > 50 ||
      c.value.some((v) => typeof v !== 'string' || !COUNTRIES.has(v))
    )
      throw new ValidationError(
        'Country conditions require a nonempty list of uppercase country codes.',
      );
    return { field: 'country', op: 'in', value: [...new Set(c.value as string[])] };
  }
  if (
    typeof c.field === 'string' &&
    /^attributes\.[A-Za-z][A-Za-z0-9_]{0,39}$/.test(c.field) &&
    c.op === 'eq' &&
    ['string', 'boolean'].includes(typeof c.value) &&
    String(c.value).length <= 200
  ) {
    if (['__proto__', 'constructor', 'prototype'].includes(c.field.slice(11)))
      throw new ValidationError('Reserved attribute name.');
    return {
      field: c.field as `attributes.${string}`,
      op: 'eq',
      value: c.value as string | boolean,
    };
  }
  throw new ValidationError('Unsupported rule condition.');
}
function validateRulePolicy(p: Record<string, unknown>): Policy {
  if (
    Object.keys(p).some(
      (k) => !['insurance_threshold', 'rules', 'tests', 'bands', 'country_overrides'].includes(k),
    )
  )
    throw new ValidationError('Unknown policy field.');
  // The assignment insurance limit is a non-bypassable business constraint, including for custom rules.
  const threshold = decimal(p.insurance_threshold, 'Insurance threshold', 1000, 2).toFixed(2);
  if (!Array.isArray(p.rules) || !p.rules.length || p.rules.length > 50)
    throw new ValidationError('Use 1–50 routing rules.');
  const ids = new Set<string>(),
    priorities = new Set<number>();
  const rules = p.rules
    .map((raw) => {
      const r = object(raw);
      exactKeys(r, ['id', 'priority', 'when', 'department']);
      if (typeof r.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(r.id) || ids.has(r.id))
        throw new ValidationError('Rule IDs must be unique plain identifiers.');
      if (
        !Number.isSafeInteger(r.priority) ||
        Number(r.priority) < 0 ||
        Number(r.priority) > 100000 ||
        priorities.has(Number(r.priority))
      )
        throw new ValidationError('Rule priorities must be unique integers from 0 to 100000.');
      if (!Array.isArray(r.when) || r.when.length > 10)
        throw new ValidationError('Use at most 10 conditions per rule.');
      ids.add(r.id);
      priorities.add(Number(r.priority));
      return {
        id: r.id,
        priority: Number(r.priority),
        department: department(r.department),
        when: r.when.map(validateCondition),
      };
    })
    .sort((a, b) => a.priority - b.priority);
  if (rules.at(-1)!.when.length || rules.slice(0, -1).some((r) => !r.when.length))
    throw new ValidationError('Exactly one catch-all rule is required, at the final priority.');
  if (p.tests !== undefined && (!Array.isArray(p.tests) || p.tests.length > 30))
    throw new ValidationError('Use at most 30 policy test cases.');
  const tests: PolicyTest[] = ((p.tests ?? []) as unknown[]).map((raw) => {
    const t = object(raw);
    exactKeys(t, ['name', 'parcel', 'department', 'status']);
    if (
      typeof t.name !== 'string' ||
      !t.name.trim() ||
      t.name.length > 80 ||
      !['routed', 'pending_insurance'].includes(String(t.status))
    )
      throw new ValidationError('Invalid policy test.');
    return {
      name: t.name,
      parcel: validateParcel(t.parcel),
      department: department(t.department),
      status: t.status as PolicyTest['status'],
    };
  });
  return { insurance_threshold: threshold, bands: [], country_overrides: [], rules, tests };
}
// Legacy versions are converted on read, leaving their recorded decisions and JSON untouched.
export function policyRules(policy: Policy): Rule[] {
  return (
    policy.rules ?? [
      ...policy.country_overrides.map((r, i) => ({
        id: `country-${i}`,
        priority: i,
        when: [{ field: 'country', op: 'in', value: [r.country] } as Condition],
        department: r.department,
      })),
      ...policy.bands.map((b, i) => ({
        id: `weight-${i}`,
        priority: 100 + i,
        when:
          b.max_kg === null ? [] : [{ field: 'weight', op: 'lte', value: b.max_kg } as Condition],
        department: b.department,
      })),
    ]
  );
}
export function modernPolicy(policy: Policy): Policy {
  return { ...policy, rules: policyRules(policy), tests: policy.tests ?? [] };
}
function matches(
  item: Pick<ParcelInput, 'weight' | 'value' | 'country'> & {
    attributes?: ParcelInput['attributes'] | string;
  },
  c: Condition,
): boolean {
  if (c.field === 'weight' || c.field === 'value') {
    const n = new Decimal(item[c.field]),
      value = c.value as string;
    switch (c.op) {
      case 'lt':
        return n.lt(value);
      case 'lte':
        return n.lte(value);
      case 'gt':
        return n.gt(value);
      case 'gte':
        return n.gte(value);
      default:
        return false;
    }
  }
  if (c.field === 'country') return (c.value as string[]).includes(item.country);
  const attributes =
    typeof item.attributes === 'string' ? JSON.parse(item.attributes) : (item.attributes ?? {});
  const key = c.field.slice(11);
  return Object.hasOwn(attributes, key) && attributes[key] === c.value;
}
export function route(
  item: Pick<ParcelInput, 'weight' | 'value' | 'country'> & {
    attributes?: ParcelInput['attributes'] | string;
  },
  policy: Policy,
): Decision {
  const rule = [...policyRules(policy)]
    .sort((a, b) => a.priority - b.priority)
    .find((r) => r.when.every((c) => matches(item, c)));
  if (!rule) throw new ValidationError('No department matches this parcel. Routing stopped.');
  const pending = new Decimal(item.value).gt(policy.insurance_threshold);
  return {
    department: rule.department,
    status: pending ? 'pending_insurance' : 'routed',
    reason:
      (pending
        ? `Insurance approval required: €${item.value} exceeds €${policy.insurance_threshold}. `
        : '') + `Rule ${rule.id} (priority ${rule.priority}) matched ${rule.department}.`,
  };
}
export function policyTestResults(policy: Policy) {
  return (policy.tests ?? []).map((t) => {
    const actual = route(t.parcel, policy);
    return {
      name: t.name,
      passed: actual.department === t.department && actual.status === t.status,
      actual,
    };
  });
}
export function enforcePolicyTests(policy: Policy) {
  const failed = policyTestResults(policy).filter((t) => !t.passed);
  if (failed.length)
    throw new ValidationError('Policy tests failed: ' + failed.map((t) => t.name).join(', '));
}
