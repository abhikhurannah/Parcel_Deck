# Assignment coverage — React/TypeScript implementation

| Requirement                                      | Current implementation                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Requested React/TypeScript code and usage README | React TSX UI, shared types, Node/Express TypeScript API, npm workflows, step-by-step README                                         |
| Default parcel routing and >€1000 insurance      | Pure decimal engine, pending state, insurer-only approval/rejection                                                                 |
| Adaptable and safe rules                         | Ordered generic conditions, visual editor, legacy conversion, bound sampled preview, activation tests, immutable versions, rollback |
| Individual and batch intake                      | React dialogs, original XML support and JSON arrays, explicit country fallback                                                      |
| Large files and responsive UI                    | 2MiB/5,000-row bounds, bounded errors, 25-row pages, responsive layouts                                                             |
| Regression testing                               | Node test runner + Supertest, domain boundaries, generated invariants, workflows/security/concurrency                               |
| Safe new feature and branch-to-merge             | Bulky/Customs examples and executed local TypeScript Git exercise                                                                   |
| Monitoring and failure handling                  | Request IDs, structured logs, alerts/backlog signals, monitor retry and recovery behavior                                           |
| Internet-facing security                         | Auth, role checks, CSRF, parameterized SQL, safe React rendering, Helmet CSP, XML restrictions and resource limits                  |
| Debugging / AI discussion                        | TypeScript debugging drills, model answers and actual AI record                                                                     |
| Presentation and interview preparation           | Updated editable deck, timed demo, detailed React/TypeScript interview guide                                                        |

SQLite is intentionally retained; this is React + TypeScript, not MERN. MongoDB, real insurance underwriting and carrier dispatch are not implemented or claimed. Public deployment and external alert delivery remain environment-specific setup. The original source assignment is preserved in `ASSIGNMENT.md`.

Review edition details: [five-priority acceptance map](IMPROVEMENTS.md).

## Final acceptance examples

- Rename Mail to Whale, preview and activate: Whale appears immediately at zero; Mail is retired without losing historical counts. A new low-value parcel of 0.5 kg routes to Whale.
- Admin creates two operators and two insurers with unique credentials. They can sign in; a staff user cannot create another account, and creating a second admin is rejected.
- Add, activate, reload, edit and remove a fragile rule through the policy studio. New parcels follow the active version; existing parcels keep their original version.
- Compare blue operator, teal insurer and violet admin views. Mobile policy editing stays within a 390px viewport.

Security verification is partial until the repository owner enables GitHub Code Security. Container and secret scans passed; do not describe CodeQL as passing. See QA.md.
