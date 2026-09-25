import { useCallback, useEffect, useState } from 'react';
import type { Policy, PolicyResponse, Preview, Role } from '../../../shared/types';
import type { Api } from '../api';
import { Heading, LoadStatus, useResource } from '../components';
import { PolicyTester } from '../policy/PolicyTester';
import { RuleEditor } from '../policy/RuleEditor';
export function PolicyView({
  api,
  revision,
  role,
  onSuccess,
}: {
  api: Api;
  revision: number;
  role: Role;
  onSuccess: (message: string) => void;
}) {
  const resource = useResource(
    useCallback(() => api<PolicyResponse>('/policy'), [api]),
    revision,
  );
  const [policy, setPolicy] = useState<Policy>(),
    [reason, setReason] = useState(''),
    [preview, setPreview] = useState<Preview>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [advanced, setAdvanced] = useState('');
  useEffect(() => {
    if (resource.data) {
      setPolicy(resource.data.policy);
      setAdvanced(JSON.stringify(resource.data.policy, null, 2));
      setPreview(undefined);
    }
  }, [resource.data]);
  function edit(p: Policy) {
    setPolicy(p);
    setAdvanced(JSON.stringify(p, null, 2));
    setPreview(undefined);
  }
  async function simulate() {
    setBusy(true);
    setError('');
    setPreview(undefined);
    try {
      setPreview(await api<Preview>('/policy/preview', { method: 'POST' }, { policy }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function activate() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ version: number }>(
        '/policy',
        { method: 'POST' },
        { ...preview, reason },
      );
      setPreview(undefined);
      onSuccess(`Policy v${r.version} is active for future parcels.`);
    } catch (e) {
      setError((e as Error).message);
      setPreview(undefined);
    } finally {
      setBusy(false);
    }
  }
  const changes =
    policy && resource.data
      ? [
          ...new Set([
            ...(resource.data.policy.rules ?? []).map((r) => r.id),
            ...(policy.rules ?? []).map((r) => r.id),
          ]),
        ].flatMap((id) => {
          const before = resource.data!.policy.rules?.find((r) => r.id === id),
            after = policy.rules?.find((r) => r.id === id);
          return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ id, before, after }];
        })
      : [];
  return (
    <section className="policy-workspace">
      <Heading
        eyebrow="POLICY STUDIO"
        title={`Routing policy${resource.data ? ' · v' + resource.data.version : ''}`}
        description="Build the journey. Set your rules, try a parcel and publish with confidence."
      />
      <LoadStatus {...resource} />
      {policy && (
        <>
          <div className="policy-summary" aria-label="Policy summary">
            <div>
              <span>LIVE VERSION</span>
              <strong>v{resource.data?.version ?? '—'}</strong>
              <small>Applied to new parcels</small>
            </div>
            <div>
              <span>ROUTING RULES</span>
              <strong>{policy.rules?.length ?? 0}</strong>
              <small>Evaluated by priority</small>
            </div>
            <div>
              <span>ACTIVATION TESTS</span>
              <strong>{policy.tests?.length ?? 0}</strong>
              <small>Checks before publishing</small>
            </div>
          </div>
          <div className="policy-steps" aria-label="Policy workflow">
            <span>
              <b>01</b> Build your rules
            </span>
            <span>
              <b>02</b> Test a parcel
            </span>
            <span>
              <b>03</b> Preview & activate
            </span>
          </div>
          <article className="panel policy-editor-panel">
            <RuleEditor policy={policy} onChange={edit} disabled={role !== 'admin' || busy} />
            <details>
              <summary>Advanced JSON editor</summary>
              <label>
                Policy JSON
                <textarea
                  rows={12}
                  value={advanced}
                  readOnly={role !== 'admin'}
                  onChange={(e) => {
                    setAdvanced(e.target.value);
                    setPreview(undefined);
                  }}
                />
              </label>
              {role === 'admin' && (
                <button
                  onClick={async () => {
                    try {
                      edit(
                        await api<Policy>(
                          '/policy/validate',
                          { method: 'POST' },
                          { policy: JSON.parse(advanced) },
                        ),
                      );
                      setError('');
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Load JSON into editor
                </button>
              )}
            </details>
          </article>
          {role === 'admin' && (
            <div className="policy-lab">
              <PolicyTester
                key={JSON.stringify(policy)}
                api={api}
                policy={policy}
                onChange={edit}
              />
              <article className="panel policy-publish">
                <p className="eyebrow">03 / PUBLISH</p>
                <h2>Save and activate changes</h2>
                <p>
                  Add, edit or remove rules above, then preview and activate this draft. Activation
                  creates a new policy version for future parcels. Historical versions remain
                  available for audit and rollback.
                </p>
                <h3>Current versus proposed</h3>
                {policy.insurance_threshold !== resource.data?.policy.insurance_threshold && (
                  <p>
                    Insurance threshold: {resource.data?.policy.insurance_threshold} →{' '}
                    {policy.insurance_threshold}
                  </p>
                )}
                {changes.length ? (
                  changes.map((c) => (
                    <details className="change-detail" key={c.id}>
                      <summary>
                        {c.id}: {c.before ? (c.after ? 'Changed' : 'Removed') : 'Added'}
                      </summary>
                      <div className="form-grid">
                        <div>
                          <small>Current</small>
                          <pre>{JSON.stringify(c.before ?? null, null, 2)}</pre>
                        </div>
                        <div>
                          <small>Proposed</small>
                          <pre>{JSON.stringify(c.after ?? null, null, 2)}</pre>
                        </div>
                      </div>
                    </details>
                  ))
                ) : (
                  <p>No routing rule changes.</p>
                )}
                <p>Activation tests: {policy.tests?.length ?? 0}</p>
                <label>
                  Reason for change
                  <input
                    value={reason}
                    placeholder="Explain this change (at least 10 characters)"
                    minLength={10}
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <p role="status">
                  {busy
                    ? 'Processing policy…'
                    : !preview
                      ? 'Preview this draft to enable activation.'
                      : preview.tests?.some((t) => !t.passed)
                        ? 'Activation blocked: fix the failing activation tests shown below.'
                        : reason.trim().length < 10
                          ? 'Preview ready. Enter a change reason of at least 10 characters to activate.'
                          : 'Ready to activate. Click Activate policy to save and apply this version.'}
                </p>
                <div className="actions">
                  <button disabled={busy} onClick={() => void simulate()}>
                    1. Preview impact
                  </button>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !preview ||
                      reason.trim().length < 10 ||
                      preview.tests?.some((t) => !t.passed)
                    }
                    onClick={() => void activate()}
                  >
                    2. Activate policy
                  </button>
                </div>
              </article>
            </div>
          )}
          <article className="panel policy-impact">
            <p className="eyebrow">CHANGE ANALYSIS</p>
            <h2>Impact preview</h2>
            {preview ? (
              <>
                <strong className="impact-number">
                  {preview.changed} / {preview.total} sampled inputs change
                </strong>
                <p>
                  Latest {preview.sample_limit} maximum, from {preview.population} stored inputs.
                  Historical decisions remain unchanged.
                </p>
                <p>{preview.new_holds} additional insurance holds.</p>
                {preview.tests?.map((t, i) => (
                  <p key={i}>
                    {t.passed ? 'PASS' : 'FAIL'}: {t.name} · {t.actual.department} /{' '}
                    {t.actual.status}
                  </p>
                ))}
                <ul>
                  {preview.examples.map((e) => (
                    <li key={e.id}>
                      #{e.id}: {e.before.department} → {e.after.department}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Preview the candidate before activating it.</p>
            )}
          </article>
        </>
      )}
      <p role="alert">{error}</p>
      <article className="panel policy-history">
        <p className="eyebrow">YOUR AUDIT TRAIL</p>
        <h2>Version history</h2>
        {resource.data?.history.map((v) => (
          <div className="history-item" key={v.version}>
            <h3>
              v{v.version} · {v.actor}
            </h3>
            <p>{v.reason}</p>
            {role === 'admin' && (
              <button onClick={() => edit(JSON.parse(v.body) as Policy)}>
                Load version {v.version} into editor
              </button>
            )}
          </div>
        ))}
      </article>
    </section>
  );
}
