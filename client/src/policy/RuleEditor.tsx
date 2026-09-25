import type { Condition, Policy, Rule } from '../../../shared/types';
export function RuleEditor({
  policy,
  onChange,
  disabled,
}: {
  policy: Policy;
  onChange: (policy: Policy) => void;
  disabled: boolean;
}) {
  const rules = policy.rules ?? [];
  function update(index: number, change: Partial<Rule>) {
    onChange({ ...policy, rules: rules.map((r, i) => (i === index ? { ...r, ...change } : r)) });
  }
  function condition(index: number, ci: number, c: Condition) {
    update(index, { when: rules[index].when.map((old, i) => (i === ci ? c : old)) });
  }
  return (
    <fieldset disabled={disabled}>
      <legend>01 / Routing rules</legend>
      <p>
        Lower priorities run first. Every condition in a row must match. The last rule must have no
        conditions.
      </p>
      <label>
        Insurance threshold (€; maximum 1000)
        <input
          type="number"
          min="0"
          max="1000"
          step="0.01"
          value={policy.insurance_threshold}
          onChange={(e) => onChange({ ...policy, insurance_threshold: e.target.value })}
        />
      </label>
      {rules.map((r, i) => (
        <article className={`rule-row${r.when.length ? '' : ' fallback-rule'}`} key={i}>
          <header className="rule-card-heading">
            <span className="rule-priority">{r.when.length ? `P${r.priority}` : 'DEFAULT'}</span>
            <strong>{r.department || 'Untitled department'}</strong>
            <span className="rule-kind">
              {r.when.length ? 'Match conditions' : 'Fallback route'}
            </span>
          </header>
          <div className="form-grid rule-fields">
            <label>
              Rule ID
              <input value={r.id} onChange={(e) => update(i, { id: e.target.value })} />
            </label>
            <label>
              Priority
              <input
                type="number"
                value={r.priority}
                onChange={(e) => update(i, { priority: Number(e.target.value) })}
              />
            </label>
            <label>
              Department
              <input
                value={r.department}
                onChange={(e) => update(i, { department: e.target.value })}
              />
            </label>
          </div>
          {r.when.map((c, ci) => (
            <div className="condition-row" key={ci}>
              <label>
                Field
                <select
                  value={c.field.startsWith('attributes.') ? 'attribute' : c.field}
                  onChange={(e) =>
                    condition(
                      i,
                      ci,
                      e.target.value === 'country'
                        ? { field: 'country', op: 'in', value: ['NL'] }
                        : e.target.value === 'attribute'
                          ? { field: 'attributes.fragile', op: 'eq', value: true }
                          : { field: e.target.value as 'weight' | 'value', op: 'lte', value: '1' },
                    )
                  }
                >
                  <option value="weight">Weight</option>
                  <option value="value">Value</option>
                  <option value="country">Country</option>
                  <option value="attribute">Attribute</option>
                </select>
              </label>
              {c.field.startsWith('attributes.') && (
                <label>
                  Attribute name
                  <input
                    value={c.field.slice(11)}
                    onChange={(e) =>
                      condition(i, ci, { ...c, field: `attributes.${e.target.value}` } as Condition)
                    }
                  />
                </label>
              )}
              <label>
                Comparison
                <select
                  value={c.op}
                  onChange={(e) => condition(i, ci, { ...c, op: e.target.value } as Condition)}
                >
                  {(c.field === 'country'
                    ? ['in']
                    : c.field.startsWith('attributes.')
                      ? ['eq']
                      : ['lt', 'lte', 'gt', 'gte']
                  ).map((op) => (
                    <option key={op}>{op}</option>
                  ))}
                </select>
              </label>
              {c.field.startsWith('attributes.') && (
                <label>
                  Value type
                  <select
                    value={typeof c.value}
                    onChange={(e) =>
                      condition(i, ci, {
                        ...c,
                        value: e.target.value === 'boolean' ? true : '',
                      } as Condition)
                    }
                  >
                    <option value="boolean">Boolean</option>
                    <option value="string">Text</option>
                  </select>
                </label>
              )}
              <label>
                Value
                {typeof c.value === 'boolean' ? (
                  <select
                    value={String(c.value)}
                    onChange={(e) =>
                      condition(i, ci, { ...c, value: e.target.value === 'true' } as Condition)
                    }
                  >
                    <option>true</option>
                    <option>false</option>
                  </select>
                ) : (
                  <input
                    value={Array.isArray(c.value) ? c.value.join(',') : c.value}
                    onChange={(e) =>
                      condition(i, ci, {
                        ...c,
                        value:
                          c.field === 'country'
                            ? e.target.value
                                .toUpperCase()
                                .split(',')
                                .map((s) => s.trim())
                            : e.target.value,
                      } as Condition)
                    }
                  />
                )}
              </label>
              <button
                type="button"
                onClick={() => update(i, { when: r.when.filter((_, n) => n !== ci) })}
              >
                Remove condition
              </button>
            </div>
          ))}
          {!r.when.length && <p>Catch-all: matches every parcel.</p>}
          <div className="actions">
            <button
              onClick={() =>
                update(i, { when: [...r.when, { field: 'weight', op: 'lte', value: '10' }] })
              }
            >
              Add condition
            </button>
            <button
              className="danger-button"
              onClick={() => onChange({ ...policy, rules: rules.filter((_, n) => n !== i) })}
            >
              Remove rule
            </button>
          </div>
        </article>
      ))}
      <button
        className="secondary"
        onClick={() =>
          onChange({
            ...policy,
            rules: [
              ...rules.map((rule) => ({ ...rule, priority: rule.priority + 1 })),
              {
                id: 'new-' + Date.now(),
                priority: 0,
                department: 'Special',
                when: [{ field: 'attributes.fragile', op: 'eq', value: true }],
              },
            ],
          })
        }
      >
        Add rule
      </button>
      <p>
        New rules run first by default; adjust their priority to change precedence. For a country
        override, choose Country / in and comma-separated codes.
      </p>
    </fieldset>
  );
}
