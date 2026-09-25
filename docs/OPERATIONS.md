# Deployment and operations

Use Node 24.x or the local Docker configuration described in README. Node 22.12 is not supported because this application uses `node:sqlite`. The supplied production Docker image embeds Node 24. Docker daemon, real DNS/TLS and remote receivers must be verified in the deployment environment.

## Deployment and identity

`npm ci && npm run build` compiles React and Express. `npm start` requires configured scrypt hashes in `ROUTING_USERS`, which bootstrap exactly one administrator. Staff accounts must be created by that administrator in Account & access. SQLite retains subsequent password changes and disabled accounts. Use **Account & access** for named operator/insurer creation and disabling and self-service password changes. Password changes and disabling revoke sessions. Environment hashes do not reset an existing account's password. Protect database backups as credentials and personal/business data.

Production cookies are Secure, HttpOnly and SameSite Strict. Configure `TRUSTED_HOSTS` and terminate HTTPS at Caddy. Production Compose publishes only Caddy ports and trusts the internal private network via `TRUST_PROXY=uniquelocal`. Do not expose the app port or let untrusted peers use that network. For a host reverse proxy, configure its exact IP/subnet, usually `loopback`. Never trust arbitrary client-supplied forwarding headers. See [Express proxy guidance](https://expressjs.com/en/guide/behind-proxies/).

The application uses one Node process. Rate limits and the account cache are per-process. Horizontal scale requires shared throttling and account invalidation. Login is throttled by both IP and normalized username; API requests use memory buckets with a capped number of keys, not a SQLite write per request. An attacker can still consume a username's short window, so production edge throttling and identity-provider controls remain useful.

## Monitoring

Public `/healthz` checks liveness and `/readyz` checks a database read. They do not prove write availability. Set a cryptographically random `MONITOR_TOKEN` of at least 32 characters in the server and monitor environments. `Authorization: Bearer <token>` grants only `/metrics` and `/api/monitor`; it grants no parcel access or mutation authority. Do not put the token in URLs.

`/metrics` exposes current parcel counts by department/status, HTTP status counters, import failure count and a duration histogram. Counters reset on process restart; scrape them into Prometheus for durable time series. The monitor endpoint includes recent alerts and anomaly signals. Run `npm run monitor -- --once` for a single check or `npm run monitor` for one-minute polling. Configure `MONITOR_URL` and use HTTPS remotely. No operator credentials are needed.

Anomaly thresholds:

- Department shares: compare the latest hour with the preceding seven days, excluding that hour. Require at least 20 recent and 100 baseline parcels; alert on an absolute shift of 25 percentage points. These are configurable-in-code thresholds, not a trained statistical model. Missing baseline does not mean the distribution is healthy.
- Validation errors: at least ten in the latest hour and more than three times the preceding seven-day hourly average.
- Policy impact: activation changing at least 25% of at least ten sampled inputs stores a policy-impact alert. The sample contains at most the newest 5,000 parcels.
- The operator overview additionally shows old insurance holds and high pending inventory.

If `ALERT_WEBHOOK` is explicitly configured, the server attempts a direct HTTPS POST after a 503, independent of SQLite availability. It uses a five-second timeout, one in-flight request and one-minute storm suppression. Failures are logged and allow a later retry. This is not a durable delivery queue; use the independent polling monitor for outage detection and notification retries/recovery. The monitor saves its fingerprint only after delivery succeeds. Without a webhook, notifications remain stdout output. Run it on a separate supervised host for production.

Logs contain request ID, route pattern, method, status, duration, authenticated username and role; no passwords, tokens, request bodies or query strings. Restrict and retain logs appropriately. Actor identifiers are personal data too.

## Migration, retention and recovery

Schema migrations use `PRAGMA user_version`, run transactionally, and preserve legacy policies/parcels. Version 1 adds batches, parcel batch links and persistent users; version 2 adds validation events and indexes. Automatic startup/hourly retention removes alerts older than 30 days and events older than eight days. Parcel decisions and audit history are excluded. Define organizational retention/deletion policies for business data and optional XML name/city fields separately.

Before an upgrade, run `npm run backup -- SOURCE NEW_DESTINATION`. This uses SQLite's online backup API and integrity check. Do not copy only the main database while WAL is active. Back up to protected storage and test restore. To restore, stop writes, preserve the old database/WAL, restore to a new path, configure DATABASE, revoke restored sessions, start, and verify totals, policy and audit before resuming traffic.

For an incident, correlate request IDs, original policy and parcel inputs. Reproduce the decision and add a regression before changing rules. Rollback appends a policy version; it does not rewrite existing parcels. Retry uncertain intake with the same operation key. Never delete an active WAL to resolve contention.

## CI and remaining operational work

CI runs lint, formatting, build, backend coverage thresholds, React tests, Playwright, benchmark and dependency audit. Separate workflows configure CodeQL, Gitleaks and Trivy; Dependabot checks npm/actions/Docker weekly. Gitleaks organization repositories require a license secret, as documented by [the action](https://github.com/gitleaks/gitleaks-action). Configure CodeQL availability for private repositories. [Trivy](https://github.com/aquasecurity/trivy-action) scans the built image for fixable HIGH/CRITICAL advisories. These workflows require a GitHub repository; local delivery does not claim they ran remotely.

Production still needs real TLS/DNS, external alert testing, independent security review, MFA/SSO where appropriate, patching, protected central logging and measured load/disaster-recovery objectives. Synchronous bounded SQLite work can still block Node. For heavier traffic, use background workers and a shared transactional database.

Schema version 3 enforces a single admin with a unique database index. An older database containing multiple admins must be reconciled before upgrading; the migration does not silently remove or demote accounts. Existing staff credentials persist. Fresh demo startup creates only the admin.
