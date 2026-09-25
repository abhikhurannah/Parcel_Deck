# Executed verification — review edition

Verified locally with Node.js 24. The attached review itself was a static review, not an executed test result.

Final submission validation: 25 September 2026.

## Passing checks

- **101 backend tests** via Node test runner + Supertest. Includes the original business-boundary, authorization, concurrency, atomicity and retry regressions, plus generic predicates, legacy conversion, failed activation cases, preview tokens, partial batches, CSV safety, schema upgrades, metrics authorization, anomaly baselines, retention, memory limits, webhook dispatch (mock receiver), password revocation and proxy/username throttling.
- **4 React Testing Library tests**: preserving a parcel retry key after network failure; preview-before-import and explicit partial selection; non-persistent test-parcel calls and saved expected cases; visual fragile-rule creation.
- **1 Playwright end-to-end workflow** against an isolated in-memory server: operator login, original XML preview/commit (17 valid, 11 routed, 6 held), insurer login/approval (queue decreases to five), administrator creates the staff accounts, adds/activates/edits/removes a fragile rule, verifies persistence after reload, renames Mail to Whale, and verifies retired/active department counts. The role-specific themes were inspected on desktop. Mobile policy page at 390px had no page-level horizontal overflow.
- **fast-check** generated 2,000 parcel examples with shrinking enabled; separate golden-file expected outcomes and exact boundaries protect against shared implementation errors. These examples are part of one test, not 2,000 separate tests.
- Backend coverage: **95.01% lines, 85.30% branches, 94.08% functions** in the recorded run. The command enforces minimums of 75% / 65% / 70% respectively. Scope: `server/**/*.ts`, excluding startup `server/index.ts`; this is not whole-project/browser coverage.
- ESLint, Prettier and strict TypeScript checks passed. Vite production build and server compilation passed.
- `npm audit` reported zero known advisories at verification time; rerun `npm audit` for current results. This is not a penetration test.
- 5,000-row benchmark: 345,491-byte JSON file, **50.47 ms**, 4,000 routed/1,000 held. This measures parsing, routing and in-memory SQLite only; excludes HTTP, disk fsync and concurrent users.
- The actual isolated local branch/test/merge example was regenerated from the current TypeScript source. Its transcript and Git bundle can be regenerated with `npm run feature:demo`; generated evidence is not retained in the documentation folder.

## Defects caught during the work

The Playwright workflow caught duplicate status query parameters introduced while adding filters. The backend rejected the array as an unknown status. Building one URLSearchParams object fixed the insurance queue. Regression coverage also checks prototype-named departments so batch count maps cannot accidentally inherit object properties. Advanced JSON is server-validated before entering the visual editor, preventing malformed configuration from crashing the editor.

## Remaining limitations and unverified deployment work

GitHub Actions built the production Docker image and passed Trivy and Gitleaks for security-fix commit 55fa457. Application verification also passed remotely. CodeQL ran analysis but could not upload results because GitHub Code Security is not enabled for this private repository; do not count that job as passed. Production Compose/TLS and a live deployed-container smoke test are not claimed verified. No real external webhook was contacted; a mock receiver verified direct server dispatch. Public DNS/TLS, independent penetration testing, production load, screen-reader certification and disaster recovery on an independent host remain deployment work. No Stryker mutation score is claimed.

The policy preview is a bounded newest-input sample, not a guarantee about all historical records. Parsing and SQLite remain synchronous. Per-process throttling/account cache target one Node process. Operational anomaly thresholds can have false positives and miss low-volume shifts. Optional recipient name/city retention has privacy implications. Browser data and generated test artifacts are excluded from the submission ZIP.

## GitHub verification record — 25 September 2026

| Check                    | Recorded result                                                                       | Evidence                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Application verification | Passed: lint, formatting, build, coverage, UI/E2E, benchmark and npm audit            | [Run 36118524593](https://github.com/Tetrifox/NITR-Abhay-kumar/actions/runs/36118524593)          |
| Container build / Trivy  | Passed after removing unused runtime npm/Yarn                                         | [Security run 36118524580](https://github.com/Tetrifox/NITR-Abhay-kumar/actions/runs/36118524580) |
| Full-history Gitleaks    | Passed; five exact historical manifest-checksum false positives verified and excluded | Same security run                                                                                 |
| CodeQL                   | Blocked: private repository requires Code Security enablement                         | Same security run                                                                                 |

The initial submission's six failures represented three jobs on two triggers (push and pull request), not six independent application bugs. The runtime scan found four HIGH findings in bundled npm tooling. Application production packages had no findings in that scan. No vulnerability severity thresholds were relaxed. `.gitleaksignore` excludes exact historical checksum fingerprints, not future files or general credential patterns.
