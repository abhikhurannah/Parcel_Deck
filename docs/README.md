# ParcelDesk documentation

Start with the root [README](../README.md). A fresh local demo creates only `admin` / `Demo-admin-2026!`; create operator and insurer accounts in Account & access before exploring those roles.

| Goal                                                    | Read                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| Run and explore every feature                           | [Feature walkthrough](FEATURE_WALKTHROUGH.md)                    |
| Give a 10–15 minute demonstration                       | [Demo script](DEMO.md)                                           |
| Prepare for technical questions                         | [Interview guide](INTERVIEW_GUIDE.md)                            |
| Understand routing, transactions and trade-offs         | [Architecture](ARCHITECTURE.md)                                  |
| Integrate with the HTTP API                             | [API contract](API.md)                                           |
| Configure accounts, monitoring, backups and security CI | [Operations](OPERATIONS.md)                                      |
| Inspect executed tests and limitations                  | [Verification record](QA.md)                                     |
| Compare delivered features with the assessment          | [Requirements](REQUIREMENTS.md), [improvements](IMPROVEMENTS.md) |
| Explain AI assistance and review                        | [AI usage](AI_USAGE.md)                                          |
| Review a local feature-branch exercise                  | [Feature workflow](FEATURE_WORKFLOW.md)                          |
| Read the original assessment                            | [Assignment](ASSIGNMENT.md)                                      |

The presentation is included. Generate the feature-workflow transcript and Git bundle locally with `npm run feature:demo`; generated reports are excluded from version control. The walkthrough and dated QA record are authoritative for the latest account setup, UI and executed checks. The assessment is preserved in ASSIGNMENT.md; the original repository README also remains in Git history.

## Visual previews

- [Operator — blue](screenshots/theme-operator.png)
- [Insurer — teal](screenshots/theme-insurer.png)
- [Admin — violet](screenshots/theme-admin.png)
- [Policy studio](screenshots/policy-editor.png)
- [Mobile policy studio](screenshots/policy-mobile.png)

## Security status

At commit 55fa457, GitHub application verification, full-history secret scanning and container scanning passed. CodeQL remains blocked because Code Security is not enabled for this private repository. The repository owner must resolve that prerequisite; see Operations.md. These are dated results, not promises about future commits.
