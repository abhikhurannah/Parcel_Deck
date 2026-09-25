# ParcelDesk interview preparation — React and TypeScript edition

This guide describes the **current React + TypeScript + Express application**. Python is not required. Read the code, run the demo and practice changing it before claiming ownership. AI-generated preparation material is not proof that you have already mastered the implementation.

## 1. Your 60-second introduction

> “ParcelDesk is a React and TypeScript operations app backed by an Express TypeScript API and SQLite. Operators enter parcels or import JSON/XML, the server assigns a proposed department, and high-value parcels remain pending until a separate insurer approves them. I isolated exact-decimal validation and routing from HTTP and storage, versioned every routing policy, and made policy activation require an impact preview. Transactions couple decisions with their audit evidence and retry receipts. The project includes automated regression tests, a responsive UI, deployment assets and an operational runbook. AI assisted development, so I can show the code, explain the decisions and distinguish verified behavior from remaining deployment work.”

Keep this under a minute. Start with the business behavior, then demonstrate it. Avoid listing frameworks without explaining why they matter.

## 2. Assignment semantics you must know

| Input              | Default result                |
| ------------------ | ----------------------------- |
| 0 < weight ≤ 1 kg  | Mail                          |
| 1 < weight ≤ 10 kg | Regular                       |
| weight > 10 kg     | Heavy                         |
| value = €1000      | No insurance hold             |
| value = €1000.01   | Insurance hold before routing |

Weight zero is rejected as an explicit domain assumption. Decimal precision is three places for weight and two for euros. Input limits are operational safety bounds: 100,000 kg and €1 billion. Do not attribute those chosen limits to the assignment itself.

A pending parcel has a **proposed** department. Assignment to a department and authorization to release are distinct facts. An IN → Customs override must not bypass the insurance gate.

The supplied XML omits countries. Its Dutch-looking addresses do not authorize inventing destination data. The operator confirms a fallback. The XML includes duplicate rows; preserve them because identical properties do not establish that they are one physical parcel. The isolated source result under default rules with NL fallback is 17 total, 11 routed, 6 held; routed department counts are Mail 5 / Regular 3 / Heavy 3.

## 3. Read the code in this order

| File                        | Explain without reading notes                                                          |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `shared/types.ts`           | Compile-time request/result/state contracts; not runtime validation                    |
| `server/domain.ts`          | `validateParcel`, `validatePolicy`, Decimal comparisons, `route`                       |
| `server/imports.ts`         | File limits, strict JSON, duplicate keys, XML entity/DTD rejection, row errors         |
| `server/database.ts`        | SQLite schema, WAL, immediate transactions, active policy lookup                       |
| `server/auth.ts`            | Async scrypt, random tokens, safe comparisons, account validation                      |
| `server/app.ts`             | Middleware order, sessions/CSRF/roles, idempotent intake, approval, preview/activation |
| `client/src/api.ts`         | Typed fetch wrapper, cookies, CSRF, bounded row errors and expired-session handling    |
| `client/src/App.tsx`        | Session, navigation, dialog state and refresh revision                                 |
| `client/src/views/`         | Loading state, pagination, previews, role-aware presentation                           |
| `client/src/Forms.tsx`      | Async submissions, pending feedback, retry key, server error feedback                  |
| `client/src/components.tsx` | Resource hook cleanup, native dialogs and shared table                                 |
| `tests/*.test.ts`           | Node test runner and Supertest, explicit boundary expectations                         |

Exercise: trace one NL parcel weighing 12 kg and valued at €1500 from form submission through validation, routing, transaction, pending UI, insurer review and audit. Repeat for IN with Customs override. Then explain the same flow from a direct API caller bypassing React.

## 4. React and TypeScript interview questions

### Why React?

The app has several related views and stateful interactions: session, navigation, pagination, dialogs and policy preview. React makes these components explicit and updates the DOM from state. The migration removes the old manual DOM rendering approach. This is a focused application; a larger routing solution or state-management library is not required merely to display five views.

### Why TypeScript on both sides?

Shared interfaces let the compiler catch mismatched fields and impossible union values during development. For example, `Status` is a union of routed, pending_insurance and rejected. The API can still receive arbitrary JSON, so `unknown` values are validated at runtime before entering the typed domain. Do not say TypeScript protects an Express endpoint from malicious JSON by itself.

### What state belongs where?

Session/navigation/current modal belong in `App`. Search filters and pagination belong in the relevant view. A policy preview belongs to the exact edited candidate in `PolicyView`; changing the editor invalidates it. The authoritative business state belongs in SQLite, not in a React state variable.

### Why use a ref for the operation key?

The retry key should survive renders without causing renders. A ref stores it while the dialog remains mounted. Plain retries reuse it; editing the submitted input creates a new operation. Closing/reloading loses it. A more advanced app could retain durable operation receipts, but do not claim that this implementation does so.

### Explain `useResource` cleanup

An earlier async request may finish after a view unmounts or its loader changes. The effect cleanup marks the previous request inactive, so its result cannot overwrite the current view's state. This prevents stale UI updates; it does not cancel work already running on the server. An AbortController could additionally stop unnecessary client-side request work.

### Why `useCallback` for loaders?

The hook depends on the loader identity. A stable callback changes only when its real inputs change, avoiding an effect loop on every render. This is dependency management, not a reason to memoize every function indiscriminately.

### Why native dialogs?

`showModal()` gives modal focus behavior and Escape handling. Labels and visible error messages support keyboard operation. Focus styles and responsive layouts are present; the project does not claim screen-reader certification.

### How is XSS prevented?

React escapes JSX string values, and the code does not use `dangerouslySetInnerHTML`. Helmet serves a restrictive CSP for the built app. Imported references and review reasons are treated as text. CSP is defense in depth, not permission to render arbitrary HTML.

### What does Vite do?

During development it serves React modules and reloads changes, proxying `/api` to Express. During build it emits static files into `dist/client`. Express serves those files in built mode, so production uses one same-origin service. The development proxy avoids a permissive CORS configuration.

## 5. Backend and design questions

### Why Express and a modular monolith?

Express gives an explicit request/middleware boundary, while the domain and import modules stay independent. A single deployable unit keeps atomic changes straightforward. Separate services would add network and coordination failure modes before there is evidence of a need.

### Why SQLite instead of MongoDB?

The user allowed React/TypeScript rather than requiring MongoDB. SQLite persists data without a second service and supports transactions for parcels, audit and idempotency together. This stack is not MERN. If MongoDB becomes mandatory, use a transactional replica-set deployment or redesign aggregates to preserve equivalent atomicity; changing the database is not just replacing a connection string.

### Why decimal.js?

JavaScript numbers are binary floating point. Values such as 0.1 are not represented exactly. Decimal parses the input string, validates precision, compares boundaries, and stores normalized decimal text. Integer grams and cents would also be defensible. Numeric conversion in the UI is for display only.

### Why constrained policy JSON instead of an expression language?

Ordered rules use constrained weight/value comparisons, country membership and typed attribute equality. Unique priorities and one final catch-all make precedence and coverage explicit. Arbitrary code or expressions make precedence and safety harder to reason about. A new predicate type should have a reviewed schema and evaluator, not `eval`.

### How does insurance stay independent?

The route function first selects a proposed department, including overrides. It then applies the value comparison for every department. There is no early return that allows a new rule to skip insurance.

### What does the transaction protect?

Input validation happens before insertion. The write transaction reads one active policy and writes parcels, audit and the idempotency response. Any failure rolls all of them back. Policy activation and approval use equivalent guarded transactions. The callback is synchronous; no `await` is permitted while the transaction is open.

### Does Node's single thread eliminate database races?

No. A synchronous transaction prevents same-process JavaScript interleaving during that callback, but multiple processes still contend for the database. SQLite's immediate write lock serializes them. External services and asynchronous work create additional race opportunities. Tests issue competing requests and verify one review wins.

### What is the cost of synchronous SQLite?

It blocks the event loop while processing a batch or preview. The app therefore bounds files/rows and paginates results. A large historical preview still needs redesign. For higher traffic, use worker threads/jobs and a suitable shared database; do not call a small local benchmark a throughput guarantee.

## 6. Configuration safety and reliability

### What does preview actually compare?

It runs stored immutable inputs under active and candidate rules, before manual approval status. It reports changed department/status and new insurance holds. It is evidence about stored inputs, not proof that the rule is appropriate for every future parcel.

### How is the preview bound to activation?

An HMAC covers normalized rules, active version and latest parcel ID, using a secret bound to the admin session. Activation recomputes this within a write transaction. New intake, another activation or changed JSON makes the token stale and returns 409. Approval does not change input values and does not invalidate this input-based comparison.

### Why can an admin not raise the threshold above €1000?

The assignment requires approval above that value. Raising the configurable threshold would silently disable the stated rule. Lowering it is conservative. A genuine requirement change to the safety ceiling needs source review and updated regression tests.

### What happens to old decisions?

They keep their original department, policy version and review evidence. A newly activated rule governs future intake. Rollback creates another version; it does not delete history. Correcting historical records would require a separate governed workflow.

### What if the response is lost after commit?

The recorded operation result committed with the parcels. A retry with the same actor/key/content returns it without inserting again. Changed content under the same key returns 409. New keys are deliberately new operations. This is not an end-to-end exactly-once guarantee.

### How would you add actual carrier dispatch?

Commit an outbox event with the route, retry delivery independently, and let the receiver deduplicate by stable event ID. Do not make an irreversible external dispatch before the database transaction commits or assume network success can be known with certainty.

### What if one import row is invalid?

No records are written. The response reports bounded row errors and the total count. A database error during a valid batch also rolls back all rows, audit and retry receipt. The chosen user contract is all-or-nothing rather than partial success.

## 7. Security and operations questions

### Authentication versus authorization

A session token identifies a configured account. A server-side role check decides whether that account can perform the action. Hiding a React button is only a UI convenience; tests call forbidden endpoints directly.

### Why separate admin and insurer?

Changing business rules and accepting insurance evidence are different authorities. An admin can inspect audit and change future policies but cannot approve a held item. Real deployments need named users and identity governance rather than shared demo names.

### Password and session handling

Password hashes use salted asynchronous scrypt. Random session tokens are placed in HttpOnly cookies and only their SHA-256 digests are stored in SQLite. Sessions expire after eight hours, and logout deletes the record. Production cookies use Secure and SameSite Strict. Do not confuse password hashing with encryption or claim a session digest protects against every database compromise.

### CSRF

Browsers send cookies automatically, so mutations also need the session's unpredictable CSRF token in a custom header. Login requires JSON and a custom header with no cross-origin CORS permission. SameSite Strict adds another layer. XSS can still act as the user, so it must be prevented separately.

### XML attacks

A DTD/entity can describe a local file or network resource. The adapter rejects these declarations before parsing and disables entity processing. File size limits still matter. Duplicate weight/value/country tags are rejected as ambiguous rather than silently choosing one.

### What gets logged?

Request ID, method, route, status and latency; unexpected failures also produce stack traces and a stored alert reference when storage is available. Uploaded data and passwords are omitted. Protect logs and use request IDs to investigate a reported failure.

### How does notification delivery work?

The monitor checks readiness and business signals, emits only changed state/recovery and saves a delivered fingerprint. Failed delivery does not advance the fingerprint, so it retries. Without a webhook, output stays local. An external receiver and independent monitoring host are deployment responsibilities, not fabricated completed integrations.

### What remains for public deployment?

Real DNS/TLS and secrets, SSO/MFA and account lifecycle, trusted-edge client limits, protected central logs, monitored backups and restore drills, patching, realistic load testing and independent review. Production startup refuses missing accounts; demo mode binds loopback. The Docker/Caddy assets are not proof of a public deployment.

## 8. Regression testing strategy

`npm test` uses Node's test runner and Supertest. The review edition adds backend, React and Playwright tests; see QA.md for the executed counts. fast-check runs 2,000 generated domain examples with shrinking. Do not describe those examples as 2,000 separate tests. Server coverage is measured and threshold-gated; it does not prove semantic correctness.

| Risk                       | Evidence                                                                    |
| -------------------------- | --------------------------------------------------------------------------- |
| Wrong inclusive boundary   | 1, 1.001, 10, 10.001 kg                                                     |
| Wrong insurance comparison | 999.99, 1000, 1000.01                                                       |
| Override bypass            | IN/Customs at high value remains pending                                    |
| Invalid input              | Non-finite values, booleans, hex strings, excess precision, invalid country |
| Unsafe policy              | Descending/duplicate/missing catch-all/raised threshold                     |
| Forged approval            | Intake rejects unknown approval fields; review route enforces insurer       |
| Duplicate retry            | Same key creates one record; conflicting content gets 409                   |
| Partial import             | Invalid later row leaves the database empty                                 |
| Concurrent review          | One succeeds, one conflicts                                                 |
| Stale preview              | New intake or tampered rules reject activation                              |
| Historical correctness     | Approval after policy change retains original version/department            |
| Security failures          | CSRF, host, expired session, SQL data, XML entities, throttling             |

Beyond tests: strict compilation, production build, real React browser workflows, source XML reconciliation, dependency audit and an explicitly scoped benchmark. An in-memory benchmark excludes disk fsync and HTTP. A vulnerability scan is not a penetration test.

## 9. Live extension exercises

### Add Bulky: five minutes

Insert `{ "max_kg":"30", "department":"Bulky" }` before Heavy's catch-all. Explain the range **10 < weight ≤ 30**. Preview, give a reason, activate. Test 10, 10.001, 30 and 30.001. At value1000.01 all departments must still hold. Load the previous policy and activate a rollback as a new version.

### Add Customs: five minutes

Load `examples/policy-customs.json`, which adds IN → Customs. Test an IN parcel at low/high weight and both insurance-boundary values, plus NL as the unaffected weight-based case. No domain-engine edit is needed.

### Add fragile handling: ten-minute design discussion

The generic engine already supports typed attribute equality. Add a priority-0 rule with `attributes.fragile eq true` and department Special using the visual editor. Test with value 1000 and 1000.01; the latter must remain pending insurance. Save that expected result as an activation case, preview and activate. Explain how a new attribute is configuration while a new field family/operator still needs validator/evaluator code and tests.

### Add MongoDB: design discussion

Keep domain functions unchanged and isolate storage behind a repository. Preserve operation-key uniqueness, version checks and atomic audit/decision changes. Explain that multi-document transactions need the appropriate deployment. Migrate and verify data deliberately; do not suggest swapping dependencies without revisiting concurrency guarantees.

## 10. TypeScript debugging drills

Use this sequence aloud: state expected behavior → choose smallest failing input → trace branches/types → fix narrowly → add a failing regression → test neighbors.

### Drill 1: overlapping branches

```ts
let department = 'Heavy';
if (weight <= 1) department = 'Mail';
if (weight <= 10) department = 'Regular';
```

At 0.5 kg, the second condition overwrites Mail. Fix with `else if` or return after each correct branch. Test both sides of 1 and 10.

### Drill 2: wrong threshold

```ts
const pending = value >= 1000;
```

Exactly €1000 should not be held under default rules. Fix to `>` using the exact-decimal representation. Test 999.99, 1000 and 1000.01.

### Drill 3: early return bypass

```ts
if (country === 'IN') return { department: 'Customs', status: 'routed' };
if (value > 1000) return { status: 'pending_insurance' };
```

IN / €5000 bypasses insurance. Select department first, then apply the same insurance gate to every result. Add an override/high-value regression.

### Drill 4: string comparison

```ts
if (input.weight <= '10') return 'Regular';
```

Lexical ordering is wrong for values such as `'2'`. Parse and validate Decimal. A casual `Number()` conversion is not the entire fix: non-finite inputs and precision policy still need validation.

### Drill 5: stale React response

```tsx
useEffect(() => {
  fetchResults(query).then(setResults);
}, [query]);
```

An older query can resolve after a newer one. Ignore obsolete results with effect cleanup/request identity or use an AbortController. Test rapid filter changes and component unmounting. Do not just hide the loading indicator.

### Drill 6: client-approved insurance

```ts
if (req.body.approved) status = 'routed';
```

Any caller can forge it. Reject unknown intake fields; implement an insurer-authorized persisted state transition with audit. A disabled checkbox does not fix the API.

### Drill 7: partial transaction

```ts
for (const row of rows) {
  validate(row);
  insertAndCommit(row);
}
```

A later failure leaves earlier records committed. For this app's all-or-nothing contract, validate the whole bounded batch first, then commit all records, audit and receipt in one transaction.

### Drill 8: asynchronous work inside a synchronous transaction

```ts
transaction(db, async () => {
  await sendToCarrier();
  insertParcel();
});
```

The synchronous helper can commit before awaited work completes. Do not pass an async callback. Move external work to a durable outbox/worker. The type signature and review should enforce the intended synchronous contract; never assume a callback makes remote work atomic.

### Drill 9: check then update without a guard

Two reviewers both read pending and both write a result. Put the state check/update/audit inside the transaction, or use a conditional update and inspect affected rows. A concurrency regression must verify one successful decision and one conflict.

## 11. AI ownership and actual migration work

The first implementation used Python. The user then explicitly requested React/TypeScript or MERN, and the current deliverable was migrated end-to-end to React + TypeScript + Express. The old runtime was archived rather than shipped as the main code. README, API upload contract, tests, operational scripts and deployment assets were updated accordingly.

AI helped implementation, tests and documentation. You should explain what you personally reviewed or changed without inventing prompts or human reviewers. Examples of substantive review decisions: country fallback is explicit, duplicate rows are preserved, insurer authority is separate, unknown/prototype fields cannot bypass validation, rule preview is bound to the candidate, and tests exercise actual API permissions.

A good response to “What did you change in AI output?” describes a real correction and evidence. If you have not changed it yourself yet, say so and demonstrate your review. Do not claim all tests passing makes the system immune to bugs.

## 12. Timed preparation

**One day:** run every role, trace domain/API/React code, practice a rule change and rollback, debug three functions, rehearse a 13-minute presentation, and prepare a clean database by selecting a new `DATABASE` path.

**Three days:** day1 domain/import/UI understanding; day2 security/concurrency plus your own regression test; day3 mock interview and live-change rehearsal.

**30-minute mock:** 3 minutes introduction, 6 minutes demo, 5 minutes code walkthrough, 5 minutes live extension, 5 minutes debugging, 4 minutes security/operations/AI, 2 minutes questions. Ask the interviewer about input volume, insurance ownership, rule approval, identity provider and deployment expectations.

Final checklist: start with `npm ci && npm run dev`; know all three demo roles; explain exact boundaries; reconcile 17/11/6; locate `route`, `saveItems`, approval and activation; distinguish compile-time types from validation; explain a transaction and an async UI race; demonstrate rollback; state the SQLite and deployment limits honestly.

## Review edition: questions to rehearse

**How did you preserve old policies?** Legacy JSON remains in the database. A conversion function emits equivalent ordered rules when loading versions. Prior country overrides precede weight bands. fast-check compares the old configuration path against conversion over generated parcels, while golden expected outputs and boundary tests prevent a shared mistake from passing unnoticed.

**Can a generic engine be too generic?** Yes. This engine uses a bounded union of operators, at most 50 rules/10 conditions each, unique priorities, and exactly one final catch-all. It never evals uploaded expressions. Numeric values use Decimal; attribute values retain boolean/text type. Insurance remains a separate final guard.

**What is safe partial import?** The user opts in, reviews counts and row errors, and confirms a token binding bytes/options/policy. Valid rows, batch metadata, audit and receipt commit together. Every rejected row retains its original source row number, and its reason can be downloaded. A failed atomic file inserts nothing. An all-invalid partial file may create a zero-accepted batch documenting the outcome.

**Why only the last 5,000 inputs in policy preview?** This bounds event-loop work and avoids a write lock during preview. The UI discloses population and sample; old rare cases may be absent, so saved representative tests and human review matter. Activation still locks the final version transition and rejects stale tokens. A larger system needs background snapshot analysis, not merely a higher limit.

**What does anomaly detection mean here?** A documented baseline comparison: department share shifts of at least 25 percentage points, enough baseline/recent observations, validation-rate spikes, and material policy impact. It is neither machine learning nor guaranteed detection of fraud. Explain false positives, baseline contamination, traffic seasonality and minimum sample sizes.

**Why use a monitor token?** It can only read metrics and operational signals. It cannot list parcel records or mutate them. Tokens are sent in Authorization headers over HTTPS. The server attempts a direct 503 webhook, but an independent monitor is necessary when the server cannot run at all.

**What did an end-to-end test find?** A duplicate `status` query parameter introduced while adding filters caused the insurance queue to show an error. Backend route tests alone did not generate that exact UI request. The query now uses one URLSearchParams object. Distinguish this actual fix from hypothetical issues.

**Does coverage prove regression protection?** No. Coverage identifies unexecuted code; golden examples specify independent expected answers, properties explore/shrink cases, and browser tests cover integration. Mutation testing could measure whether intentional mistakes are caught, but no Stryker score is claimed.

**What changed in security?** Bounded memory throttling and per-username login limits, explicit trusted proxies, persistent users and session revocation, actor logs, and security CI. Discuss single-process cache/limiter limitations and the risk of trusting a proxy subnet when direct API access is possible.

## Final implementation questions

**Why does Mail remain after I rename it Whale?** The chart describes stored routed decisions, not a retrospective simulation. The active policy adds Whale immediately at zero; Mail is marked retired and retains its historical count. New qualifying parcels increase Whale. Rewriting history would erase which policy actually handled a parcel.

**How are staff accounts approved?** The single administrator creates each operator or insurer with a unique username and initial password. Creation is the approval step; there is no public signup or separate pending-approval queue. A database constraint blocks additional admins. Disabled staff lose sessions immediately. Existing demo staff accounts were retained by request, while fresh installs bootstrap only admin.

**Do different themes enforce roles?** No. Blue, teal and violet identify the current workspace visually. Server-side authorization enforces operator/insurer/admin privileges regardless of what a client displays or sends.

**What changed in the policy editor?** New rules receive priority zero and existing priorities shift up. Rules are shown as cards with condition and fallback labels. Scenario testing, saved expected cases, impact preview, the change reason and activation are separate steps. JSON comparisons expand on demand. Historical decisions are not rerouted by activation.

**Why did tests pass while security checks failed?** They inspect different concerns. CodeQL first lacked actions:read, then encountered the private repository's missing Code Security entitlement. The Gitleaks Action required an organization license; the open-source scanner found five manifest hashes that were independently verified as false positives. Trivy found vulnerable packages inside the image's unused npm installation. Removing runtime package managers resolved those findings without weakening scan thresholds.

**What can I honestly claim?** 101 backend tests and four UI tests passed, alongside the browser workflow and build. Recorded backend coverage is 95.01% lines, 85.30% branches and 94.08% functions. GitHub application verification, secret scanning and container scanning passed on 55fa457. CodeQL remains blocked by repository configuration. See QA.md for dated evidence and remaining deployment limits.
