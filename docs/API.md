# TypeScript API contract

Business endpoints require a session except login and the separately token-protected monitor. Login uses JSON plus `X-Requested-With: ParcelDesk`, returns a CSRF token and sets an HttpOnly cookie. Include `X-CSRF-Token` on authenticated mutations. Every response has `X-Request-ID`.

| Method | Route                                 | Purpose / authority                                                                         |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| POST   | `/api/login`                          | `{username,password}`; JSON and custom header required                                      |
| GET    | `/api/me`                             | Session username, role and CSRF token                                                       |
| POST   | `/api/logout`                         | Revoke current server-side session                                                          |
| GET    | `/api/overview`                       | Totals, department distribution, active version, signals                                    |
| GET    | `/api/parcels?page=1&status=&search=` | Paginated records, 25 per page                                                              |
| POST   | `/api/parcels`                        | Operator/admin; parcel JSON and `Idempotency-Key`                                           |
| POST   | `/api/import?format=xml&country=NL`   | Operator/admin; **raw file bytes**, `Content-Type: application/octet-stream`, operation key |
| POST   | `/api/parcels/:id/approval`           | Insurer; `{decision:"approve" or "reject",reason}`                                          |
| GET    | `/api/policy`                         | Current rules and latest 20 versions                                                        |
| POST   | `/api/policy/preview`                 | Admin; `{policy}` → impact, normalized policy, token, base version                          |
| POST   | `/api/policy`                         | Admin; `{policy,token,base_version,reason}`                                                 |
| GET    | `/api/audit`                          | Admin; latest 100 audit events                                                              |
| GET    | `/healthz`                            | Public process liveness                                                                     |
| GET    | `/readyz`                             | Public database read readiness                                                              |

The upload API accepts raw JSON/XML bytes, not multipart form data. The React client sends this format. `country` applies only as a fallback for XML parcels missing Country; JSON requires each parcel's country.

Parcel fields: required `weight`, `value`, `country`; optional `reference`, `attributes`. Runtime validators reject unknown fields, including supplied approval flags. Shared compile-time definitions are in `shared/types.ts`.

Creation returns 201 with counts, first/last IDs and policy version. A same-key/same-content replay returns 200 and `replayed:true`. Keys are 8–100 characters, scoped to username. A new key is a new operation.

Errors: 400 malformed request, 401 missing/expired session, 403 role/CSRF denial, 404 missing route/record, 409 stale state or conflicting key, 413 oversized body, 415 wrong upload content type, 422 validation, 429 throttle with `Retry-After`, 503 internal/storage failure. Import validation gives `error_count` and every `{row,message}` entry (up to the 5,000-row file limit). Atomic imports commit no rows on validation failure; explicit partial imports require preview.

## Review edition additions

- `POST /api/import/preview?format=json&country=NL&partial=false&retain=false&filename=batch.json`: raw bytes; returns valid/invalid counts, department totals, complete row errors, policy version and token; never writes parcels.
- `POST /api/import` accepts the same options. Send `X-Import-Preview` and `X-Policy-Version` from preview plus `Idempotency-Key`. Preview is mandatory for partial mode; legacy atomic API callers remain compatible. Changing file/options invalidates the token. Successful committed retries return the saved receipt, including after policy changes.
- `GET /api/batches?page=1`: persisted filename/uploader/time/counts and error report.
- `GET /api/batches/:id/errors.csv`: every rejected source row number and reason.
- `GET /api/parcels.csv`: filtered CSV, maximum 10,000 rows; spreadsheet formula prefixes are escaped.
- Parcel listing/export additionally accept `batch_id`, `department`, `country`, `from`, `to` (inclusive date), and `sort=oldest|newest`.
- `GET /api/samples/parcels.json` and `/api/samples/Container_68465468.xml`: authenticated downloads.
- `POST /api/policy/test`: admin `{policy,parcel}`, validates and returns the decision without inserting anything.
- Policy preview returns `sample_limit`, `population`, `tests`, and impact over at most 5,000 newest inputs. Activation rejects failed tests regardless of the UI.
- `POST /api/password`: `{current,password}`, revokes every session for the user.
- `GET /api/users`, `POST /api/users` with `{username,role,password}`, and `POST /api/users/:name/disable`: administrator only; creation accepts operator or insurer roles only. Exactly one admin is enforced, and it cannot disable itself. Admin creation is the approval step; there is no public signup.
- `GET /metrics` and `GET /api/monitor`: separate read-only `Authorization: Bearer <MONITOR_TOKEN>`. No session or CSRF needed for these reads. Token does not authorize any other endpoint.

Modern policies have `insurance_threshold`, `rules` and optional `tests`. Rules carry `id`, `priority`, `department`, and `when` conditions. Legacy `bands`/`country_overrides` remain accepted and are converted for display; the modern rule list is authoritative when present. Never edit stale compatibility fields expecting them to override `rules`.

`GET /api/overview` department entries contain `{department, count, active}`. Active policy departments appear with zero counts when necessary. Historical departments absent from the policy have `active: false`; counts always describe stored routed decisions.
