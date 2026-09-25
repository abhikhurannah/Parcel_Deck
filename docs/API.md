# API reference

## Authentication

- Business endpoints require a session, except login.
- Login: `POST /api/login` with JSON `{ "username": "...", "password": "..." }`.
- Include `X-Requested-With: ParcelDesk` on login.
- Keep the returned HttpOnly session cookie and CSRF token.
- Include `X-CSRF-Token` on authenticated mutations.
- Responses include `X-Request-ID` for troubleshooting.
- Monitoring uses a separate bearer token with no parcel access.

## Session and accounts

| Method | Path                       | Access / body                           |
| ------ | -------------------------- | --------------------------------------- |
| GET    | `/api/me`                  | Current session                         |
| POST   | `/api/logout`              | Signed-in user                          |
| POST   | `/api/password`            | `{current, password}`; revokes sessions |
| GET    | `/api/users`               | Admin                                   |
| POST   | `/api/users`               | Admin; `{username, role, password}`     |
| POST   | `/api/users/:name/disable` | Admin; cannot disable self              |

- New staff roles: `operator` or `insurer`; no public signup or second admin.
- Password length: 12–128 characters.

## Parcels and batches

| Method | Path                                  | Purpose / access                                       |
| ------ | ------------------------------------- | ------------------------------------------------------ |
| GET    | `/api/overview`                       | Counts, active/retired departments, signals and alerts |
| GET    | `/api/parcels`                        | Paginated records; 25 per page                         |
| POST   | `/api/parcels`                        | Operator/admin intake                                  |
| POST   | `/api/parcels/:id/approval`           | Insurer; `{decision, reason}`                          |
| POST   | `/api/import/preview`                 | Operator/admin; read-only file validation              |
| POST   | `/api/import`                         | Operator/admin; save the batch                         |
| GET    | `/api/batches`                        | Paginated batch history                                |
| GET    | `/api/batches/:id/errors.csv`         | Rejected source rows and reasons                       |
| GET    | `/api/parcels.csv`                    | Filtered export; maximum 10,000 records                |
| GET    | `/api/samples/parcels.json`           | Authenticated sample download                          |
| GET    | `/api/samples/Container_68465468.xml` | Authenticated XML download                             |

### Parcel payload

```json
{
  "reference": "ORDER-001",
  "weight": "2.500",
  "value": "1500.00",
  "country": "NL",
  "attributes": { "fragile": true }
}
```

- Required: weight, value and country. Optional: reference and attributes.
- Weight: > 0, ≤ 100,000 kg, maximum 3 decimal places.
- Value: 0–1,000,000,000 euros, maximum 2 decimal places.
- Approval decision: `approve` or `reject`; pending parcels can be reviewed once.
- Filters: `status`, `search`, `batch_id`, `department`, `country`, `from`, `to`.
- Date bounds are inclusive UTC dates; sort accepts `oldest` or `newest`.

### Import contract

- Send raw JSON/XML bytes as `Content-Type: application/octet-stream`.
- Query options: `format`, `country` fallback, `partial`, `retain`, `filename`.
- Limits: 2 MiB and 5,000 rows.
- Preview returns counts, row errors, proposed departments, policy version and token.
- Commit headers: `X-Import-Preview`, `X-Policy-Version`, `Idempotency-Key`.
- Partial mode requires a valid preview; the UI always previews both modes.
- Legacy atomic API calls may omit preview; validation still applies.
- Changing file/options/policy invalidates the preview.
- Retry keys: 8–100 characters, scoped to the actor; reuse for the same uncertain operation.
- Single intake returns 201 for creation and 200 for a successful replay.

## Policies and audit

| Method | Path                   | Purpose / body                                 |
| ------ | ---------------------- | ---------------------------------------------- |
| GET    | `/api/policy`          | Current policy and latest 20 history entries   |
| POST   | `/api/policy/validate` | Admin; `{policy}`                              |
| POST   | `/api/policy/test`     | Admin; `{policy, parcel}`; no insert           |
| POST   | `/api/policy/preview`  | Admin; `{policy}`; latest 5,000 inputs at most |
| POST   | `/api/policy`          | Admin; `{policy, token, base_version, reason}` |
| GET    | `/api/audit`           | Admin; latest 100 events                       |

- Modern policy fields: `insurance_threshold`, `rules`, `tests`.
- Rules contain `id`, `priority`, `department`, `when`.
- Unique IDs/priorities; exactly one final unconditional catch-all.
- Weight/value: `lt`, `lte`, `gt`, `gte`; country: `in`; attributes: typed `eq`.
- Legacy bands/overrides remain accepted; modern rules take precedence when supplied.
- Activation needs a reason of at least ten characters and passing saved tests.
- Stale preview/version is rejected; activation never rewrites existing parcels.

## Health and monitoring

| Path           | Access                                  | Meaning                   |
| -------------- | --------------------------------------- | ------------------------- |
| `/healthz`     | Public                                  | Process liveness          |
| `/readyz`      | Public                                  | Database read readiness   |
| `/metrics`     | `Authorization: Bearer <MONITOR_TOKEN>` | Prometheus metrics        |
| `/api/monitor` | Same bearer token                       | Signals and recent alerts |

## Error codes

| Code      | Meaning                                             |
| --------- | --------------------------------------------------- |
| 400       | Malformed request                                   |
| 401 / 403 | Missing session / insufficient role or CSRF failure |
| 404       | Record not found                                    |
| 409       | Conflict, stale preview or competing update         |
| 413 / 415 | Payload too large / unsupported media type          |
| 422       | Validation failure                                  |
| 429       | Rate limit reached                                  |
| 503       | Service unavailable                                 |

- Use the response request ID to correlate failures with server logs.
- See [Operations](OPERATIONS.md) for incident handling.
