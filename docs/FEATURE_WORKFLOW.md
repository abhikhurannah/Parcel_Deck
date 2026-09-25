# Executed TypeScript feature branch-to-merge example

Run `npm run feature:demo` from the project root. It creates an isolated temporary Git repository containing the TypeScript domain module, shared types and domain regression tests. It creates `feature/bulky-department`, adds a policy fixture and four boundary/insurance tests, runs tests, commits, merges into main with a merge commit, and tests again.

Running the command generates local execution evidence as `feature-workflow-transcript.txt` and portable Git history as `feature-workflow.bundle`. These generated outputs are intentionally not committed. The exercise itself does not create a remote PR or claim independent colleague review. The temporary repository is cleaned up; the main app's default policy is unchanged.

Acceptance criteria: 10kg stays Regular;10.001–30kg becomes Bulky;30.001kg becomes Heavy;€1000.01 always remains pending. The extension does not modify the routing engine.

```sh
npm run feature:demo
git clone docs/feature-workflow.bundle /tmp/parceldesk-feature-review
cd /tmp/parceldesk-feature-review
git log --graph --oneline --all
git diff main^1 main -- examples tests
```

The bundle holds the small exercise rather than the whole app. Its tests need this project's installed Node/TypeScript dependencies. For real team development, open a PR, let CI run, request review and merge through branch protection, then preview and activate the configuration through the application.
