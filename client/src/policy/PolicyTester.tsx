import { useState, type FormEvent } from 'react';
import type { Decision, ParcelInput, Policy } from '../../../shared/types';
import type { Api } from '../api';
export function PolicyTester({
  api,
  policy,
  onChange,
}: {
  api: Api;
  policy: Policy;
  onChange: (p: Policy) => void;
}) {
  const [result, setResult] = useState<Decision>(),
    [parcel, setParcel] = useState<ParcelInput>(),
    [error, setError] = useState('');
  async function test(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const f = new FormData(e.currentTarget);
    const input = {
      reference: 'policy-test',
      weight: String(f.get('weight')),
      value: String(f.get('value')),
      country: String(f.get('country')).toUpperCase(),
      attributes: { fragile: f.get('fragile') === 'on' },
    };
    try {
      setResult(await api<Decision>('/policy/test', { method: 'POST' }, { policy, parcel: input }));
      setParcel(input);
    } catch (e) {
      setResult(undefined);
      setError((e as Error).message);
    }
  }
  return (
    <article className="panel policy-tester">
      <p className="eyebrow">02 / SANDBOX</p>
      <h2>Test a parcel</h2>
      <p className="muted">Try a scenario before it reaches your operations.</p>
      <form onSubmit={test} className="tester-form">
        <label>
          Test weight (kg)
          <input name="weight" type="number" defaultValue="12" step="0.001" required />
        </label>
        <label>
          Test value (€)
          <input name="value" type="number" defaultValue="1200" step="0.01" required />
        </label>
        <label>
          Test country
          <input name="country" defaultValue="IN" maxLength={2} required />
        </label>
        <label>
          <input name="fragile" type="checkbox" /> Fragile
        </label>
        <button className="secondary">Test without saving</button>
      </form>
      {result && (
        <>
          <p>
            {result.department} · {result.status}
          </p>
          <p>{result.reason}</p>
          <button
            onClick={() => {
              if (parcel)
                onChange({
                  ...policy,
                  tests: [
                    ...(policy.tests ?? []),
                    {
                      name: 'Example ' + ((policy.tests?.length ?? 0) + 1),
                      parcel,
                      department: result.department,
                      status: result.status,
                    },
                  ],
                });
            }}
          >
            Keep as activation test
          </button>
        </>
      )}
      <p role="alert">{error}</p>
      <h3>Required activation tests</h3>
      {!policy.tests?.length && (
        <p className="test-empty">
          No saved checks yet. Test a parcel, then keep its expected result as an activation test.
        </p>
      )}
      {policy.tests?.map((t, i) => (
        <p key={i}>
          {t.name}: {t.department} / {t.status}{' '}
          <button
            onClick={() => onChange({ ...policy, tests: policy.tests?.filter((_, n) => i !== n) })}
          >
            Remove test
          </button>
        </p>
      ))}
    </article>
  );
}
