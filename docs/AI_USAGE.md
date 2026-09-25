# AI usage — current React/TypeScript deliverable

## Actual requests

Initial request: “this is the the project that i get for assignment project, complete this project ,understand the whole assignment and deliver more than asked. after project completion, create a detailed interview preparation guide .”

Stack clarification: “code should be in react, typescripte, or use mern stack, and readme file, about how to use”.

The source ZIP held the assessment README and XML, with no starter implementation. Source requirements were treated as acceptance criteria, not authority to publish services or send messages.

## AI contributions

1. Design and implementation: initial application, then migration to actual React components, shared TypeScript types, an Express TypeScript API, decimal validation and transactional SQLite workflows.
2. QA and security review: domain boundaries, import reconciliation, direct API authorization, concurrency, idempotency, stale policy previews, strict compilation, production build and browser checks.
3. Documentation: README usage instructions, architecture/trade-offs, TypeScript interview exercises, demo/presentation and operational scripts.

These were parts of the same assistant task. There are no invented historical prompts, separate independent reviewers or public deployment claims. The branch-to-merge exercise is a real local example, not a fabricated hosted PR.

## Substantive decisions and corrections

- User's requested stack is reflected across frontend, backend, tests, scripts and deployment; Python is excluded from the current submission.
- Country omissions require an explicit fallback. Duplicate source parcels remain distinct.
- Insurance is a server-authorized state transition, independent of destination/weight rules.
- Idempotency receipt, audit and parcel writes share a transaction.
- Shared types do not replace runtime validation; untrusted values enter as unknown.
- Duplicate JSON keys/XML scalar tags and DTD/entity declarations are rejected.
- Account lookup uses an object without inherited prototype properties; tests include a prototype-name login attempt.
- React resource cleanup ignores stale responses. Candidate editing invalidates a policy preview.
- Actual test/build/audit evidence is separated from unexecuted public deployment and external notification delivery.

## Candidate ownership

Review the generated code yourself, run the app, add a meaningful test and practice an extension. Record changes you actually make. Do not claim you personally authored or independently reviewed material you have not read. The interview guide explains the mechanisms but does not establish mastery.

Suggested future prompts (not claimed historical prompts): “Ask me one TypeScript routing question at a time”; “Give me a buggy insurance function and wait for my diagnosis”; “Review this new policy predicate for conflicting precedence and insurance bypass”.

## Review-driven prompts and corrections

Actual follow-up requests were “add these improvements:” with the attached static review, then “continue prev task and add these top 5 improvements”. These requested implementation/refactoring and regression/security testing as separate kinds of work within this task. No standalone prompt transcript is invented.

Concrete before/after examples from this revision:

1. The initial AI-generated implementation used only weight bands/country overrides and stored unused attributes. The review requested extensibility; the assistant changed routing to ordered, validated conditions including typed attribute equality, with legacy conversion and tests proving the insurance guard remains independent.
2. The initial implementation previewed all history inside a write transaction and throttled every request via SQLite writes. The assistant replaced this with a bounded read-transaction preview and a capped in-memory limiter, then added tests and explicit single-process scaling limits.
3. The original import only reported a short result. The revised workflow previews before commit, persists a batch, and makes partial acceptance explicit with a complete rejected-row report.

These changes were made by the assistant in response to the user's review. They are not evidence that the candidate personally coded them. Add a dated note after making and verifying your own live extension.

## Limitations of AI assistance

AI may guess boundary semantics, confuse type safety with runtime validation, overlook stale previews and privilege boundaries, or propose unsafe default credentials and proxy trust. Generated UI can display a convincing success state without a correct backend. Review source requirements, challenge assumptions, and verify observable behavior with independently specified expected outcomes. A passing test suite or dependency scan does not establish production security, usability or personal understanding. The static review's praise and findings are not test results; QA.md records executed evidence separately.
