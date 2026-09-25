# Explore ParcelDesk step by step

Allow about 30–45 minutes. Start with the default policy and a fresh demo database if you want the totals below to match exactly. The sample files contain fictional parcel references and no recipient personal data.

## 1. Open the app

Open a terminal in the project root (the folder containing package.json). Use Node 24 and run:

```sh
npm ci
npm run dev
```

If it is already running, simply open http://127.0.0.1:5173. Do not start a second copy on the same ports. Stop with Ctrl+C.

Optional clean rehearsal: stop the app, set `DATABASE=data/exploration.sqlite3` in the project's `.env`, then restart. Use a new filename if that database already exists. This preserves your other database. To return, restore the previous DATABASE setting.

| Username | Initial demo password | Purpose                      |
| -------- | --------------------- | ---------------------------- |
| operator | Demo-operator-2026!   | Intake and batch imports     |
| insurer  | Demo-insurer-2026!    | Approve or reject insurance  |
| admin    | Demo-admin-2026!      | Routing policy, audit, users |

Only admin is created automatically on a fresh installation. First sign in as admin and open **Account & access**. Create an operator named `operator` and an insurer named `insurer`, setting the example passwords in the table (or choose your own and use them throughout this guide). Creating the account is the admin's approval; staff cannot self-register. Only one admin is allowed. Existing accounts and changed passwords persist.

## 2. Import the main sample

1. Sign in as operator.
2. On Overview, click **Import a batch**.
3. Choose `explore-batch.json` from this delivery. You may also drag it onto the upload area.
4. Leave partial import and recipient retention unchecked. JSON already contains countries, so no fallback is needed.
5. Click **1. Preview import**. Nothing has been saved yet.
6. Under the default policy, expect **12 valid, 0 rejected; 8 routed and 4 insurance holds**.
7. Proposed department totals, including holds: **Mail 3, Regular 4, Heavy 5**.
8. Click **2. Confirm import** once. Read the batch result and download its results CSV.
9. Close the dialog. Overview shows immediately routed department totals **Mail 2, Regular 3, Heavy 3** if this is the first intake. Holds do not enter this chart until approved.

Opening a new import and submitting the same file is intentionally a new batch. Only retries using the same operation key recover the previous operation.

## 3. Explore batches, filters and exports

Open **Batches & results**. Find `explore-batch.json`; inspect filename, actor, timestamp, accepted/rejected counts and policy version. Click **View this batch** to show its records and **Download results CSV** for all its results.

Open **All parcels**. Search for `EXPLORE-08`, filter status to awaiting insurance, or filter department/country/date/batch ID. Click **Apply filters**. Choose oldest/newest sorting. Export the filtered result. Dates are interpreted by the API in UTC; the displayed browser timestamps use local time. CSV exports are limited to 10,000 rows; narrow filters for larger data.

Read the reason and policy version in the table. Weight 1 is Mail, 1.001 is Regular, 10 is Regular and 10.001 is Heavy under the default rules. Value exactly 1000 does not cause a hold; 1000.01 does.

## 4. Try a single parcel

Click **New parcel**. Enter reference MANUAL-01, weight 10, value 1000.01 and country NL. Submit with **Check & route parcel**. It should propose Regular and await insurance. This adds one to your previous totals.

Use a new reference and value 1000 to compare. Client-side validation prevents missing/invalid required fields; the server also validates direct API requests. The single-parcel form does not currently expose arbitrary attributes; use the sample JSON or policy tester for fragile examples.

## 5. Compare atomic and partial import

1. Choose `explore-partial-import.json` in Import a batch.
2. Keep partial mode off and preview. Expect **2 valid and 3 invalid rows**, with source row numbers 2, 4 and 5 rejected.
3. Confirmation stays disabled. Download all rejected row reasons. No parcels have been inserted.
4. Check **Import valid rows even if some rows fail**. This invalidates the previous preview.
5. Preview again, then confirm. Under default rules, the batch accepts two rows: one routed and one pending insurance.
6. Open Batches & results and download both accepted results and rejected row reasons.

## 6. Approve and reject insurance

Sign out and sign in as insurer. Open **Insurance queue**. Locate EXPLORE-08, click Review, choose Approve and enter `Coverage verified for exploration`. Record the decision. It leaves the queue and becomes routed to Mail.

Review EXPLORE-09, choose Reject, enter `Coverage declined for exploration` and submit. It leaves the queue but does not count as routed. In All parcels, inspect the new reason alongside the original policy version. Each parcel can be reviewed only once. Operator and admin cannot approve insurance.

## 7. Explore policy changes without saving them

Sign in as admin, open **Routing policy**. Look at each rule's ID, priority, department and conditions. Smaller priority numbers win; conditions in one rule are ANDed. The final catch-all has no conditions.

Try **Test a parcel**: weight 12, value 1200, country IN. Under the default policy, expect Heavy and pending insurance. This does not create a parcel or change the dashboard totals.

## 8. Add fragile routing and save a test

1. Click **Add rule**. The new rule defaults to Attribute / fragile / eq / Boolean / true and department Special.
2. Set a unique ID such as `fragile-special`, keep its default priority **0** so it runs first. Existing priorities shift up automatically. Each priority must be unique.
3. In Test a parcel, check Fragile, use weight 12, value 1200, country IN, and test. Expect **Special / pending_insurance**.
4. Click **Keep as activation test**. Independently confirm this is the result you want before keeping it.
5. Inspect **Current versus proposed**. Enter a reason such as `Route fragile parcels through the specialist handling team`.
6. Click **1. Preview impact**. With only the main sample, two inputs change department. Other manual/partial imports may alter that sample. Historical approval state is ignored for this hypothetical comparison.
7. Click **2. Activate policy**. Existing parcels retain their original decisions. Import a new copy of the main sample to see the new rule on newly created parcels; that creates another 12 records.

To demonstrate the saved-test guard, change the fragile department from Special to Other while retaining its expected Special test. Preview: the saved case fails, so activation is blocked. Restore Special or load an earlier version. Do not delete a failing test merely to make an unsafe change pass.

## 9. Add country routing or Bulky

For a country rule, click Add rule, select Country / in, enter IN and choose Customs. It runs first by default. To let fragile win first, swap the country and fragile priorities so fragile is 0 and country is 1. A high-value Customs parcel must still await insurance.

For Bulky, add a rule with department Bulky and condition Weight / lte / 30. Then assign unique ascending priorities in the order Mail, Regular, Bulky, Heavy (place any overrides before these). Heavy must remain last. Because Regular catches weights through 10 first, Bulky effectively covers 10 < weight ≤ 30. Test 10, 10.001, 30 and 30.001. Preview and activate only if desired.

Exactly one rule must remain an unconditional final catch-all. The insurance threshold cannot be raised above 1000. Duplicate IDs/priorities or unknown predicates fail validation.

Advanced JSON: expand the editor, paste a policy, then click **Load JSON into editor** before previewing. Loading alone does not activate it.

## 10. Roll back and inspect evidence

In Version history, load the initial version into the editor. Preview, provide a reason and activate. Rollback creates a new version; it does not delete versions or reroute existing parcels.

Open **Audit trail** as admin. Review login, intake, policy activation and insurer review events, including actors and request IDs. It shows the latest 100 events.

## 11. Account controls

Open **Account & access**. As admin, create a temporary operator named exploration-user with a unique password of at least 12 characters. Sign in as it to verify its permissions. Sign back in as admin and disable that temporary account; its sessions are revoked.

The change-password form requires your current password, sets a new password and signs you out everywhere. Prefer trying this on the temporary account; changing a default demo password persists and the printed default will no longer work. You cannot disable your own account.

## 12. Monitoring and reliability

Overview shows operational signals. An ordinary small sample will not trigger every anomaly threshold. Old insurance holds require more than 24 hours; department-share anomalies require at least 20 recent and 100 baseline parcels, with a 25-percentage-point shift. Validation spikes require ten errors in an hour. Do not repeatedly send bad requests just to manufacture an alert; the automated tests exercise these scenarios safely.

For read-only metrics, generate a token with Node's crypto.randomBytes, set MONITOR_TOKEN in the server environment and restart. Use that token in an Authorization Bearer header to GET `/metrics` and `/api/monitor`. The token cannot read parcel records or mutate data. The monitor command needs the same token in its shell environment; unlike dev/start commands, it does not automatically load `.env`.

See OPERATIONS.md for HTTPS webhooks, retention, backup/restore and proxy settings. No external service is required to explore the UI, and no remote webhook is preconfigured.

## 13. Run developer checks

Inside the project folder:

```sh
npm run lint
npm run format:check
npm test
npm run test:ui
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
npm run benchmark
```

The browser test starts its own server on 8099 with an in-memory database. Tests do not modify your demonstration database. For mobile exploration, resize the browser to about 390px and scroll the navigation horizontally and tables within their containers.

## Sample reference table under the default policy

| Reference suffix | Weight |   Value | Proposed department | Status             |
| ---------------- | -----: | ------: | ------------------- | ------------------ |
| 01-LIGHT         |  0.500 |   25.00 | Mail                | Routed             |
| 02-MAIL-BOUNDARY |  1.000 | 1000.00 | Mail                | Routed             |
| 03-REGULAR-START |  1.001 |   50.00 | Regular             | Routed             |
| 04-REGULAR-END   | 10.000 | 1000.00 | Regular             | Routed             |
| 05-HEAVY-START   | 10.001 |  800.00 | Heavy               | Routed             |
| 06-BULKY-END     | 30.000 |  200.00 | Heavy               | Routed             |
| 07-OVER-BULKY    | 30.001 |  300.00 | Heavy               | Routed             |
| 08-MAIL-HOLD     |  0.800 | 1000.01 | Mail                | Awaiting insurance |
| 09-REGULAR-HOLD  |  5.000 | 1500.00 | Regular             | Awaiting insurance |
| 10-HEAVY-HOLD    | 50.000 | 2500.00 | Heavy               | Awaiting insurance |
| 11-FRAGILE       |  2.000 |  250.00 | Regular             | Routed             |
| 12-FRAGILE-HOLD  | 12.000 | 1200.00 | Heavy               | Awaiting insurance |

Fragile attributes only affect decisions after activating a matching rule. Expected totals assume the default policy, regardless of your current account role.

## Department renaming

Activate a rename from Mail to Whale. Overview immediately lists Whale with zero routed parcels; Mail is dimmed and marked retired with its historical count. Submit a new parcel of weight 0.5 and value 20 to NL: Whale increases by one. Past parcel decisions are preserved.
