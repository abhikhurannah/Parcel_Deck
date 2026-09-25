# Improvements and assignment coverage

## Five improvement groups

| Group                     | Delivered                                                                                  | Main implementation                                           |
| ------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Rules and maintainability | Ordered conditions, attributes, final catch-all, legacy conversion, separated modules      | `server/domain.ts`, `server/routes/`, `client/src/policy/`    |
| Batch outcomes            | Preview, partial mode, batch history, rejected-row reports, CSV and upload progress        | `server/routes/imports.ts`, `client/src/views/ImportForm.tsx` |
| Policy editing            | Rule cards, scenario tester, saved tests, comparison, activation and rollback              | `client/src/views/PolicyView.tsx`                             |
| Monitoring                | Scoped metrics token, anomaly signals, logs, monitor script and 503 webhook                | `server/services/observability.ts`, `scripts/monitor.ts`      |
| Testing and security      | Regression/property/browser tests, coverage gates, account controls and security workflows | `tests/`, `.github/`, `server/routes/users.ts`                |

## Assignment mapping

| Requirement                | Evidence                                                           |
| -------------------------- | ------------------------------------------------------------------ |
| Correct parcel routing     | Exact decimals; boundary tests; default Mail/Regular/Heavy rules   |
| Insurance before routing   | Pending state; insurer-only decision; concurrency checks           |
| Adaptable business rules   | Versioned configuration, attributes and country rules              |
| Safe evolution             | Saved activation tests, impact preview and rollback                |
| Large input handling       | Bounded imports, row errors, pagination and explicit limits        |
| Failure visibility         | Request IDs, audit events, metrics and anomaly signals             |
| Internet-facing safeguards | Sessions, CSRF, role checks, input validation and security headers |
| Feature branch exercise    | `npm run feature:demo`                                             |
| AI disclosure              | [AI usage record](AI_USAGE.md)                                     |

## Usability fixes

- Blue operator, teal insurer and violet admin themes.
- Policy cards with priority controls, scenario tests and publication readiness.
- Active department counts appear immediately after a rename.
- Retired department counts remain dimmed to preserve history.
- Exactly one admin; multiple admin-created staff accounts.
- Existing staff accounts and changed passwords persist.

## Example: extend routing safely

```mermaid
flowchart LR
    A[Add Bulky rule] --> B[Test boundaries]
    B --> C[Keep expected results]
    C --> D[Preview impact]
    D --> E[Activate with reason]
    E --> F[Inspect new intake and audit]
```

- Insert `weight lte 30` after Regular and before Heavy.
- Test 10, 10.001, 30 and 30.001 kg.
- Keep the Heavy catch-all last.
- High-value parcels still require insurance.
- Existing parcels retain their original departments and policy versions.

## Verification scope

- Backend tests cover boundaries, imports, retries, permissions and policy safety.
- Property tests and a fixed golden fixture complement example-based tests.
- React tests cover forms; Playwright exercises the browser workflow.
- Coverage gates apply to server code, excluding startup.
- See [Operations](OPERATIONS.md) for the dated CI record and CodeQL prerequisite.

## Remaining improvements

| Priority                      | Work                                                                        | Reason                             |
| ----------------------------- | --------------------------------------------------------------------------- | ---------------------------------- |
| Before public deployment      | TLS/DNS, external alerts, restore rehearsal and independent security review | Validate the real environment      |
| Before multi-instance scaling | Shared rate limits, identity cache invalidation and database strategy       | Current design assumes one process |
| Before carrier integration    | Transactional outbox and consumer deduplication                             | Reliable external delivery         |
| Optional                      | Mutation testing, bulk insurance review, translations and dark theme        | Further assurance and usability    |

- No mutation-testing score or production load guarantee is claimed.
- Preview limit: latest 5,000 inputs; import limit: 2 MiB / 5,000 rows.
