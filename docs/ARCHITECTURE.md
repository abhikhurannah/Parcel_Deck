# React / TypeScript architecture

ParcelDesk is a modular TypeScript application: React views call Express routes, services own transactional workflows, and small repositories hold account and parcel queries. SQLite provides local persistence. `shared/types.ts` provides compile-time contracts; `server/domain.ts` validates untrusted runtime input.

## Rule engine

A policy contains an insurance threshold, ordered rules and optional expected-output tests. Each rule has a unique ID and integer priority, an AND-list of conditions, and a department. Ascending priority wins; exactly one final rule has no conditions. Weight/value support lt/lte/gt/gte, country supports membership, and `attributes.<name>` supports typed equality. Dynamic property names are constrained and checked as own properties. No arbitrary expression runs as code.

Legacy bands/country overrides remain accepted at the API boundary. `policyRules` converts overrides before ascending weight bands; `modernPolicy` converts old versions for the editor without rewriting stored JSON or historical decisions. The registry declares supported field families, while validator/evaluator branches implement their semantics. Adding an entirely new field family requires both validation and matching support plus tests; adding another attribute rule requires configuration only.

Routing chooses a proposed department, then independently applies insurance. The threshold cannot exceed €1000. Exact decimals are normalized to strings and stored as TEXT to avoid binary floating-point rounding. Only an insurer can release or reject a pending parcel. An administrator cannot bypass that role boundary.

## Batch and transaction boundary

`PRAGMA user_version` drives transactional schema migrations. Existing parcels receive a nullable batch ID; new file imports store batch filename, actor, totals, rejected row reasons and policy version. Atomic mode rejects all rows on any validation error. Explicit partial mode requires a preview and commits only valid rows. Rejected row numbers refer to the original source file.

Preview signatures cover file bytes, file metadata/options and policy version. Commit validates those inputs. An actor-scoped idempotency key records the response with parcel/batch/audit writes in one `BEGIN IMMEDIATE` transaction. A replay checks the saved receipt before comparing the current policy, so a successful operation can be recovered even after a subsequent policy change. Intentionally new uploads use new keys. Same-content rows remain distinct parcels.

## Policy safety

The impact preview uses a read transaction and compares the latest 5,000 inputs at most. Its HMAC binds normalized rules, active version and latest parcel ID. Activation checks the binding inside a write transaction, reruns saved expected-output cases, then appends a version. Changes affecting at least 25% of a sample of at least ten inputs create an operational alert. Past parcel decisions are immutable through these routes.

Bounded preview reduces blocking, but SQLite access and rule evaluation still run synchronously on the event loop. Large-scale traffic requires workers/queued intake and a shared transactional datastore. A sample is not a statistical guarantee about older records.

## Frontend

`App.tsx` owns login, navigation and dialogs. Operational views live in separate files. The policy view composes RuleEditor and PolicyTester. Typed API calls retain server authority; React escapes display data. Uploads use XMLHttpRequest for actual byte progress; previews clear whenever file/options change. `useResource` ignores stale responses on unmount or loader replacement. CSV output escapes spreadsheet formula prefixes.

## Operations and limitations

Memory counters provide bounded per-IP and per-username throttling for one process. SQLite stores users and revoked sessions. Environment hashes seed missing users only. Account changes update the local process cache; running multiple Node instances requires a shared identity/cache invalidation and rate-limit design.

Prometheus metrics and read-only monitoring require a separate bearer token. Anomaly detection compares department shares with a prior seven-day window and uses explicit volume thresholds. Direct 503 notifications are asynchronous, rate-limited and backed by logs; the independent monitor detects outages. Alert/event retention excludes audit history. Optional recipient name/city retention is off by default.

SQLite is chosen for an easy local assignment setup, so this is not labelled MERN. MongoDB would require replica-set transactions or a redesigned aggregate to preserve atomic audit/retry behavior. Real carrier delivery additionally needs an outbox and consumer deduplication.
