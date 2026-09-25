# ParcelDesk — React + TypeScript Parcel Routing System

A complete parcel-routing assignment built with **React, TypeScript, Node.js and Express**. SQLite provides persistent storage without requiring a separate database installation.

## Reviewer quick start

Use **Node.js 24**, run `npm ci` and `npm run dev`, then open http://127.0.0.1:5173. Sign in as `admin` with initial local-demo password `Demo-admin-2026!`. In **Account & access**, create your operator and insurer accounts before trying their workflows.

- [Original assignment](docs/ASSIGNMENT.md)
- [Step-by-step feature walkthrough](docs/FEATURE_WALKTHROUGH.md)
- [Architecture and trade-offs](docs/ARCHITECTURE.md)
- [Verification record and limitations](docs/QA.md)
- [Interview preparation guide](docs/INTERVIEW_GUIDE.md)

Features include role-specific themes, configurable routing policies with impact previews and activation tests, exact-decimal validation, batch imports, insurance review, historical decisions, CSV exports, audit records and admin-managed staff accounts. See [the implementation map](docs/IMPROVEMENTS.md).

## 1. Requirements

- **Node.js 24.x** and npm. Check with `node --version` and `npm --version`.
- A modern browser.
- No MongoDB, Python or frontend API key is needed.

If you have an older Node version, install Node 24 from [nodejs.org](https://nodejs.org/) or, if you already use nvm, run `nvm install 24` followed by `nvm use 24`.

## 2. Install and run

Open a terminal **inside the `parcel-routing` folder**, where this README and `package.json` are located:

```sh
cd parcel-routing
npm ci
npm run dev
```

If your terminal is already inside `parcel-routing`, skip the `cd` command.

Open **http://127.0.0.1:5173**.

`npm run dev` starts both processes:

- React/Vite frontend: **5173**.
- Express API: **8081**.

Vite forwards `/api` requests to Express, so you do not need to configure CORS or run a second terminal. Keep the terminal open while using the app. Press **Ctrl+C** to stop both processes.

### Run with Docker instead of installing Node

With Docker Desktop running, use `docker compose -f compose.demo.yaml up` from this folder, then open **http://127.0.0.1:5173**. The container installs Node 24 dependencies; your host Node version is irrelevant. Initial startup needs network access. Stop with Ctrl+C. Production uses the separate `compose.yaml` configuration and real credentials/TLS.

### Administrator and staff accounts

A fresh local demo starts with exactly one administrator: `admin` / `Demo-admin-2026!` (initial password).

Sign in as admin, open **Account & access**, and use **Approve and create account**. Choose a unique username, operator or insurer role, and an initial password of 12–128 characters. Share those credentials securely; the new user can then sign in and change their password. Repeat for as many operators and insurers as needed. There is no public signup and no option to create another admin. Existing accounts and changed passwords persist across restarts.

The administrator cannot approve insurance. Sign out to switch roles. Older installations may still have their original demo staff accounts; the admin can disable them to revoke those shared logins.

### Run the built application

```sh
npm run build
npm run start:demo
```

Open **http://127.0.0.1:8081**. Express serves the compiled React application and the API from the same port. Vite is not needed in this mode.

## 3. How to use the application

### Add one parcel

1. Sign in as `operator`.
2. Click **New parcel**.
3. Enter an optional reference, weight in kilograms, value in euros, and a two-letter country code such as `NL`, `IN` or `US`.
4. Click **Check & route parcel**.
5. Open **All parcels** to see the department, status, reason and policy version.

Examples under the default policy:

| Weight    | Value    | Result                               |
| --------- | -------- | ------------------------------------ |
| 1 kg      | €1000    | Mail, routed                         |
| 1.001 kg  | €25      | Regular, routed                      |
| 10 kg     | €1000    | Regular, routed                      |
| 10.001 kg | €800     | Heavy, routed                        |
| 10 kg     | €1000.01 | Regular proposed, awaiting insurance |

Weight boundaries are inclusive. Insurance applies only when the value is **greater than** €1000 under the default policy. Held parcels have a proposed department and are not routed until an insurer approves them.

### Import the assignment XML

1. Click **Import a batch**.
2. Select `examples/Container_68465468.xml`.
3. Enter `NL` as fallback country **after confirming that assumption**. The supplied XML does not contain country fields; the app does not infer them from addresses.
4. Click **1. Preview import**. Review the routing totals and any invalid row reasons.
5. Click **2. Confirm import**. The upload progress bar measures bytes sent; server validation follows.
6. Open **Batches & results** to view the batch, export results, or download rejected row reasons.

Drag-and-drop and downloadable sample files are available in the import dialog. Atomic import is the default. For a mixed-validity file, explicitly check **Import valid rows even if some rows fail**, preview again, then confirm. This creates a batch containing valid rows and a downloadable report with every rejected source row number and reason. A changed file, fallback, privacy option or import mode requires a new preview. Changing the policy invalidates an uncommitted preview.

The optional **Retain recipient name and city** checkbox preserves only those XML fields. It is off by default; retained personal data remain in the database and its backups. Street addresses are not retained.

With the default policy, this file produces **17 parcels: 11 routed and 6 awaiting insurance**. Immediately routed department totals are Mail 5, Regular 3 and Heavy 3. Duplicate source rows are preserved as separate parcels.

You can also import `examples/parcels.json`. To demonstrate validation, try `examples/invalid-parcels.json`: the app reports the bad rows and saves none of the batch.

### JSON file format

```json
[
  {
    "reference": "ORDER-001",
    "weight": "2.500",
    "value": "1500.00",
    "country": "NL",
    "attributes": { "fragile": true }
  }
]
```

Use an array of parcel objects. Reference and attributes are optional. Decimal strings are recommended for integration input. Attributes can participate in conditions, such as `attributes.fragile eq true`. They do not affect routing until a policy includes the matching rule.

Limits: **2 MiB and 5,000 rows per file**, 3 decimal places for weight, 2 for value. Weight must be positive and no more than 100,000 kg; value must be €0–€1 billion. Results are paginated, 25 rows per page. Split larger files into smaller batches.

Any invalid row rejects an atomic import. Explicit partial mode imports only valid rows after preview. A same-page retry after a network failure reuses the operation key, preventing duplicate inserts. A deliberately new upload is a new operation. If you refresh during an uncertain submission, inspect records before resubmitting.

### Approve or reject insurance

1. Sign out and sign in as `insurer`.
2. Open **Insurance queue**.
3. Click **Review** next to a parcel.
4. Select approve or reject and enter a review reason.
5. Click **Record insurance decision**.

Approval releases the parcel to its proposed department. Rejection keeps it out of routing. The original policy and reviewer reason remain on record. Two competing reviews cannot both succeed.

### Change routing rules safely

1. Sign in as `admin` and open **Routing policy**.
2. Edit the structured rule rows. Lower priorities run first, and all conditions in a rule must match. A final rule with no conditions catches every remaining parcel.
3. To route fragile parcels to Special, click **Add rule**, choose priority `0` (before the default priorities 100–102), and keep `attributes.fragile eq true` with department `Special`.
4. Use **Test a parcel** with weight 12, value 1200, country IN, and Fragile checked. Expect Special and pending insurance.
5. Click **Keep as activation test** to require that result before future activation. Review the expected result yourself; saving the current result is a convenience, not independent evidence.
6. Review **Current versus proposed**, enter a reason of at least ten characters, click **1. Preview impact**, then **2. Activate policy**. Any failing saved case blocks activation on the server too.

To add Bulky, add `weight lte 30` at priority 102 and move Heavy's catch-all priority to 103. To add a destination override, add `country in IN` at a priority before the weight rules. All operators are dropdowns and values are editable. Advanced JSON remains available; click **Load JSON into editor** before previewing pasted JSON.

Preview compares the latest **5,000** stored inputs at most and shows the sample and population sizes. It is not a full-history guarantee. Existing decisions stay unchanged; rollback loads an older version and activates it as a new one. Older band/override policies convert automatically when loaded.

Configuration cannot raise the insurance threshold above €1000. Unique IDs/priorities and a single final catch-all avoid ambiguous order. Numeric comparisons use exact decimals; attribute conditions compare typed boolean/text values, without running arbitrary code.

### Account administration

Open **Account & access** to change your password (12–128 characters). This revokes your sessions and signs you out. The single admin can create named operators and insurers and disable staff accounts. Disabling revokes their sessions immediately. The environment bootstraps the administrator only; it does not overwrite changed passwords on restart.

### View evidence and operations

- **Overview:** counts, routed department distribution and backlog signals.
- **All parcels:** search by reference/ID and filter status.
- **Audit trail:** administrator-only actor, event, reason and request ID.

## 4. Commands

| Command                                    | Purpose                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `npm ci`                                   | Install exactly the locked dependencies                                              |
| `npm run dev`                              | Start React + API with automatic reload, local demo accounts                         |
| `npm run typecheck`                        | Strict TypeScript checking across frontend/backend/tests                             |
| `npm run lint`                             | ESLint checks                                                                        |
| `npm run format:check`                     | Prettier consistency check                                                           |
| `npm run test:coverage`                    | Backend tests with 75% line / 70% function / 65% branch minimums                     |
| `npm run test:ui`                          | React Testing Library form/component tests                                           |
| `npm run test:e2e`                         | Playwright workflow; run `npm run build` and `npx playwright install chromium` first |
| `npm test`                                 | Domain, import, workflow and security regression tests                               |
| `npm run build`                            | Type-check, build React, compile the Node server                                     |
| `npm run start:demo`                       | Run the built app locally with demo accounts                                         |
| `npm start`                                | Run the built app with configured production users                                   |
| `npm run benchmark`                        | Run an isolated 5,000-row parser/routing/database benchmark                          |
| `npm run backup -- SOURCE NEW_DESTINATION` | Create and integrity-check an online SQLite backup                                   |
| `npm run monitor -- --once`                | Run one configured health/backlog monitor check                                      |
| `npm run feature:demo`                     | Execute the local TypeScript feature branch-to-merge example                         |
| `npm run package`                          | Create the clean submission ZIP, excluding secrets and local data                    |
| `npm audit`                                | Check locked packages for currently known advisories                                 |

## 5. Project structure

```text
parcel-routing/
├── client/
│   ├── index.html
│   └── src/
│       ├── App.tsx          # React application, login, role-aware navigation
│       ├── Views.tsx        # Re-exports for separate views/ components
│       ├── Forms.tsx        # Intake/import/insurance dialogs
│       ├── components.tsx  # Accessible dialog, tables, resource-loading hook
│       ├── api.ts          # Typed API client and errors
│       └── styles.css      # Responsive styling
├── server/
│   ├── index.ts            # Startup and graceful shutdown
│   ├── app.ts              # Express setup and route composition
│   ├── routes/             # Auth, users, imports, parcels, policy, operations
│   ├── services/           # Intake, CSV, observability and request context
│   ├── middleware/         # Bounded in-memory throttling
│   ├── repositories/       # Account and parcel SQL
│   ├── migrations.ts       # Schema versions and operational retention
│   ├── domain.ts           # Pure validation and routing functions
│   ├── imports.ts          # Bounded JSON/XML adapters
│   ├── database.ts         # SQLite schema and transaction boundary
│   └── auth.ts             # Scrypt password hashing and session utilities
├── shared/types.ts         # Shared TypeScript contracts
├── tests/*.test.ts         # Node test runner + Supertest regression tests
├── examples/               # Original XML and JSON/config samples
├── scripts/                # TypeScript operational utilities and ZIP builder
├── docs/                   # Interview guide, architecture, API and presentation
├── data/                   # Created automatically; excluded from submission/Git
├── package.json
├── package-lock.json
└── README.md
```

React owns rendered UI state; user content is escaped by React. The API makes every authoritative decision. TypeScript interfaces help maintain the contracts, while runtime validators enforce them for untrusted requests. `decimal.js` provides exact-decimal comparisons. SQLite transactions commit parcels, audit records and idempotency receipts together.

## 6. Data and configuration

Demo data are stored in `data/demo-ts.sqlite3` and survive restarts. Production defaults to `data/routing-ts.sqlite3`. The previous Python demo database is not overwritten.

The optional `.env` file is loaded by the dev/start commands. Copy `.env.example` only if you want custom settings. Do not commit credentials.

To use a different demo database without deleting your existing records, put this in `.env` and restart:

```dotenv
DATABASE=data/rehearsal.sqlite3
```

The dev proxy expects API port 8081. If you change `PORT` for development, update `vite.config.ts` to match. `npm run start:demo` needs only its single configured port.

## 7. Production deployment

```sh
npm ci
npm run build
npm run users --silent > users.json
```

The account utility prints randomly generated passwords to stderr and the corresponding JSON hashes to stdout. Save the passwords securely and put the generated JSON in `ROUTING_USERS` through a secrets manager or protected `.env`. Never commit `users.json`; move it outside the repository or delete it after secure provisioning. The utility's default account names can be replaced with unique staff usernames in that JSON.

```dotenv
ROUTING_USERS={"alice":{"role":"operator","password_hash":"scrypt$..."},"bob":{"role":"insurer","password_hash":"scrypt$..."},"carol":{"role":"admin","password_hash":"scrypt$..."}}
TRUSTED_HOSTS=parcels.example.com,localhost,127.0.0.1
```

Run `npm start` behind an HTTPS reverse proxy. Production cookies are Secure; plain HTTP login is intentionally unsuitable for production mode. The supplied Docker/Caddy setup uses `DOMAIN` and `ROUTING_USERS` environment variables:

```sh
docker compose up --build -d
```

Production has no default/demo credentials. `ROUTING_USERS` seeds missing named users on startup; account changes persist in SQLite. Provision only the first administrator externally and use Account & access thereafter. The app is intended for one Node process; its memory rate limits and account cache are not a distributed identity system. Deployment assets are supplied, but public hosting, real DNS/TLS, external notifications and a deployment-specific security review are not claimed completed. See [Operations](docs/OPERATIONS.md).

## 8. Troubleshooting

| Problem                                                                         | Fix                                                                                |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Unknown built-in module: node:sqlite`, engine warning, or missing Node feature | Use Node **24.x**, then rerun `npm ci`                                             |
| `ENOENT package.json` or missing npm script                                     | Open the terminal inside **parcel-routing**, not the unrelated parent project      |
| Port 5173 or 8081 already in use                                                | Stop the previous instance; do not start both dev and built-demo servers on 8081   |
| Cannot load the app in development                                              | Open **5173**, and confirm both `api` and `web` processes are running              |
| Cannot load built app                                                           | Run `npm run build` before `npm run start:demo`; open **8081**                     |
| Login fails                                                                     | Use the correct role-specific demo password; demo mode must be enabled             |
| Too many requests                                                               | Wait one minute; repeated login attempts are throttled                             |
| XML import says country missing                                                 | Enter the confirmed two-letter fallback country                                    |
| Policy activation button is disabled                                            | Preview the current candidate and enter a change reason of at least ten characters |
| Preview is stale                                                                | Intake or another rule changed; preview again                                      |
| Production login does not stay signed in over HTTP                              | Use HTTPS, or use the explicit local demo command for local testing                |

## 9. Assignment and interview materials

- [Step-by-step feature walkthrough](docs/FEATURE_WALKTHROUGH.md)
- [Sample batch: 12 valid parcels](examples/explore-batch.json)
- [Partial-import practice: 2 valid and 3 invalid rows](examples/explore-partial-import.json)
- [Review improvements](docs/IMPROVEMENTS.md)
- [Detailed interview preparation guide](docs/INTERVIEW_GUIDE.md)
- [Timed demo script](docs/DEMO.md)
- [Architecture and trade-offs](docs/ARCHITECTURE.md)
- [API contract](docs/API.md)
- [Security and operations](docs/OPERATIONS.md)
- [Executed verification record](docs/QA.md)
- [Requirement coverage](docs/REQUIREMENTS.md)
- [AI contribution and review record](docs/AI_USAGE.md)
- [Feature branch-to-merge example](docs/FEATURE_WORKFLOW.md)
- [Editable interview presentation](docs/ParcelDesk-Presentation.pptx)

The application implements routing decisions and a simulated insurance-approval workflow; it does not book carriers or perform real insurance underwriting. SQLite and synchronous bounded ingestion suit a modest single deployment. For heavier traffic, move database work off the event loop, use queued imports, and migrate to a shared datastore when measured demand warrants it.

## Monitoring setup

Set a random `MONITOR_TOKEN` of at least 32 characters in the server environment (generate with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`). Use the same token in the monitor process. `GET /metrics` exposes Prometheus text and `GET /api/monitor` exposes recent signals with `Authorization: Bearer <token>`. This token cannot log in, read parcel rows or mutate data.

`npm run monitor -- --once` checks the configured `MONITOR_URL` (default localhost:8081). `ALERT_WEBHOOK`, when explicitly configured, sends HTTPS notifications. The server also attempts an asynchronous direct notification on 503 responses, with a timeout and one-minute storm suppression. The independent polling monitor remains necessary for process/machine outages.

Set `TRUST_PROXY` only to actual proxy addresses/subnets. Docker production trusts the internal private network and publishes only Caddy ports. Do not expose the API directly with that setting. [Operations](docs/OPERATIONS.md) explains thresholds, retention and deployment limitations.

### Department distribution after a policy change

The dashboard always lists departments in the active policy, even with zero routed parcels. Departments no longer in the policy are dimmed and marked retired when they retain historical routed parcels. Changing Mail to Whale does not rewrite past decisions: Whale starts at zero and grows as new parcels route there. Insurance holds enter the distribution only after approval.

### Role themes and policy studio

The interface automatically follows the signed-in role: blue for operators, teal for insurers, and violet for the administrator. Insurance reviewers have a direct queue shortcut on their dashboard. Status badges keep consistent meanings across themes.

Routing policy has a version/rule/test summary, separate rule cards with priority and fallback labels, a parcel-testing panel, and a publishing panel. Expand a changed rule under Current versus proposed to inspect its before/after JSON. Preview, change reasons and activation checks work as before. The layout stacks on mobile and supports keyboard focus and reduced-motion preferences.
