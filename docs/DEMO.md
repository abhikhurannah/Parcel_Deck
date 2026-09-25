# React / TypeScript demo: 10–15 minutes

Start with `npm ci` then `npm run dev`. Open http://127.0.0.1:5173. For a fresh rehearsal database, set `DATABASE=data/rehearsal.sqlite3` in `.env` and restart; preserve earlier demo data. A fresh database starts with admin only (`admin` / `Demo-admin-2026!`). Before the demonstration, use Account & access to create an operator and an insurer with individual passwords. Use those credentials when switching roles.

| Time      | Demo                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0–1 min   | Introduce React + TypeScript frontend, Express TypeScript API, SQLite and the business problem                                 |
| 1–3 min   | As operator, preview and confirm the original XML with explicitly confirmed NL fallback; explain 17 total / 11 routed / 6 held |
| 3–4 min   | Show a 1kg/€1000 case and a 10kg/€1000.01 case; distinguish proposed department from routing                                   |
| 4–6 min   | Sign in as insurer, review a hold with a reason, show that it leaves the queue                                                 |
| 6–8 min   | As admin, insert Bulky up to30kg, preview impact, record reason and activate                                                   |
| 8–9 min   | Load previous policy and preview rollback as a new version; show audit evidence                                                |
| 9–11 min  | Show pure `route`, runtime validation, transaction boundary and shared TypeScript types                                        |
| 11–13 min | Explain tests, idempotency, XML security, CSRF/roles and known deployment limits                                               |
| 13–15 min | Discuss AI ownership or perform a short TypeScript debugging drill                                                             |

Use `examples/invalid-parcels.json` to show all-or-nothing validation. Do not silently assume countries or deduplicate repeated XML rows. Extra manually created demo parcels change dashboard totals; distinguish them from the isolated source-file result.

Live extension: add a generic `weight lte 30` rule and order the rules Mail, Regular, Bulky, Heavy with unique ascending priorities. Alternatively add `attributes.fragile eq true` at priority 0 for Special. Use Test a parcel, save expected cases, review the rule diff, preview and activate. Test10,10.001,30,30.001. High value always remains an insurance hold. Existing records retain their original policy. Rollback increases the version rather than deleting history.

Fallback: the editable presentation contains speaker notes. The app itself loads no third-party assets; installation/auditing require network, while an installed local environment works offline. If a session expires, sign in again and repeat any policy preview because it is session-bound.
