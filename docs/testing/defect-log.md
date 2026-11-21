# Defect log and triage (T-59 / KAN-70)

Scope: auth, boards and frontend. Triage date: 2026-11-21. Severity scale: Highest (feature or
service does not work), High (wrong or unsafe behaviour on a main path), Medium (degraded behaviour,
accessibility, missing AC detail), Low (cosmetic, polish, test-only gap).

## Sources

1. Test campaigns: KAN-56 (T-45, auth coverage, FE and BE), KAN-57 (T-46, OpenAPI contract tests in
   backend e2e), KAN-58 (T-47, Playwright journeys), KAN-65 (T-54, performance and compatibility).
2. Code review findings on the open ticket PRs, fixed on the ticket branches on 2026-11-21: KAN-39,
   KAN-42, KAN-47, KAN-48.

The earlier statement "0 Highest/High defects" in the PR description was wrong: source 2 contains
2 Highest and 5 High defects. All of them are fixed on their branches (not yet merged) and each fix
has a test that failed before it.

## Summary

| Severity | Found | Fixed on branch | Open | Deferred |
| --- | --- | --- | --- | --- |
| Highest | 2 | 2 | 0 | 0 |
| High | 5 | 5 | 0 | 0 |
| Medium | 20 | 19 | 1 | 0 |
| Low | 9 | 8 | 0 | 1 |

Two campaign rows (TC-3, TC-9) found no defect and are not counted. "Fixed on branch" means committed and pushed to the ticket branch; it counts as done only after the
branch is merged and CI is green on `dev`.

## Defects from the test campaigns

| ID | Severity | Area | Defect | Ticket / fix | Status |
| --- | --- | --- | --- | --- | --- |
| TC-1 | Low | FE auth (test gap) | `register`, the silent `me()` restore, the stale-restore guard and a failed login were not asserted in `AuthContext` tests. Mutations of each passed the suite. | KAN-56, `aff3afa` | Fixed |
| TC-2 | Low | FE auth (test quality) | Auth tests rejected with a plain `Error`, spies leaked on assertion failure, three `no-unsafe-return` lint warnings. | KAN-56, `aff3afa` | Fixed |
| TC-3 | Low | BE auth | No gap found. Auth application services 94.3% and 90.0% lines, `jwt-auth.guard` 100%. Expired and tampered tokens and role violations are tested at unit and e2e level. | KAN-56 (no change) | Closed, no defect |
| TC-4 | Medium | BE contract tests | OpenAPI response validation sits in three setup helpers (register, create board, create card, happy path only). Error bodies and most endpoints are not validated. | KAN-57, backend PR 77 | Open, owner of KAN-57 |
| TC-5 | Medium | E2E performance | The 2 s load test ran in parallel with other journeys and could be rescued by the CI retry, so a slow run could pass. | KAN-65, `794f3f4` | Fixed |
| TC-6 | Medium | E2E performance | 100 cards were created concurrently in one column (position race, possible 429). | KAN-65, `794f3f4` | Fixed |
| TC-7 | Low | E2E performance | The layout check ran after the timing assertion, so one failure hid the other. | KAN-65, `794f3f4` | Fixed |
| TC-8 | Medium | Docs, E2E | Measurements and test conditions were not recorded or documented; the browser matrix scope was not stated. | KAN-65, `794f3f4`, `655e3e0` | Fixed |
| TC-9 | Low | E2E | No defect found in the Playwright journeys (auth, board, viewer) during KAN-58. | KAN-58 | Closed, no defect |

## Defects from review findings fixed on 2026-11-21

### KAN-47 (backend, security hardening) - fix `7468406`, revert `d225958`

| ID | Severity | Area | Defect | Status |
| --- | --- | --- | --- | --- |
| RV-1 | Highest | BE bootstrap | The sanitizing logger wrapped `Logger` and recursed forever once installed with `app.useLogger`; the app crashed on its first log line. | Fixed |
| RV-2 | High | BE auth | `@Throttle` on register and login named throttlers that do not exist, so the 100 per minute default applied and the auth limits never did. | Fixed |
| RV-3 | High | BE config | A commit removed the Jira webhook URL and the `manage:jira-webhook` scope from the env files. | Fixed (reverted) |
| RV-4 | Medium | BE logging | Log redaction missed JSON bodies, refresh tokens and client secrets; non-string messages threw. | Fixed |
| RV-5 | Medium | BE | One global rate bucket shared by all clients behind the proxy and by the Jira webhook. | Fixed (`TRUST_PROXY`, `@SkipThrottle`) |
| RV-6 | Medium | BE | Content-Security-Policy was disabled completely. | Fixed (default CSP, relaxed on `/docs` only) |
| RV-7 | Low | BE spec | The security-headers spec contradicted what the code sends (`X-XSS-Protection`). | Fixed |

### KAN-39 (frontend, realtime reconnect) - fix `f6bd835`

| ID | Severity | Area | Defect | Status |
| --- | --- | --- | --- | --- |
| RV-8 | High | FE realtime | The client stopped reconnecting after the attempt cap or a rejected handshake while the indicator still looked healthy. | Fixed |
| RV-9 | Medium | FE a11y | The connection indicator was a coloured dot without role or text. | Fixed |
| RV-10 | Medium | FE realtime | Filtering events by `actorId` also hid the author's other tabs and devices. | Fixed (`X-Socket-Id`) |
| RV-11 | Medium | FE realtime | Refetch and re-join were sent together, so a change in between could be missed. | Fixed |
| RV-12 | Low | FE boards | A remote event during a drag could snap the dragged card back. | Fixed |
| RV-13 | Medium | FE realtime | `member.removed` was not handled. | Fixed |

### KAN-42 (frontend, card panel) - fix `23650f4`

| ID | Severity | Area | Defect | Status |
| --- | --- | --- | --- | --- |
| RV-14 | High | FE cards | Failed saves and comments were silent and could discard the user's input. | Fixed |
| RV-15 | Medium | FE cards | Comments were never paged; older comments were unreachable. | Fixed |
| RV-16 | Medium | FE permissions | Comment Delete was offered to every Member and hidden from keyboard and touch users. | Fixed |
| RV-17 | Medium | FE cards | Labels could not be created, renamed or deleted from the panel (AC gap). | Fixed |
| RV-18 | Medium | FE a11y | Dialog had no initial focus, focus trap or focus return; popover and Esc handling were wrong. | Fixed |
| RV-19 | Medium | FE cards | Drafts were lost when another user edited the card. | Fixed |
| RV-20 | Medium | FE cards | The deadline was sent as a local date-time and on every save. | Fixed |
| RV-21 | Low | FE cards | No live update for `card.commented`, stale labels after `board.updated`, Jira link with a double slash. | Fixed |

### KAN-48 (frontend, deadline badges and Jira conflicts) - fix `57d4cb0`

| ID | Severity | Area | Defect | Status |
| --- | --- | --- | --- | --- |
| RV-22 | Highest | FE Jira sync | Resolve sent `JIRA` / `BOARD` instead of the contract values `jira` / `boardsync`, so every resolve was rejected. | Fixed |
| RV-23 | High | FE Jira sync | Already resolved conflicts were listed with live buttons; the list was not paged. | Fixed |
| RV-24 | Medium | FE boards | Cards in a DONE column showed "Overdue". | Fixed |
| RV-25 | Medium | FE Jira sync | The conflicts panel had no error or empty state and a failed resolve showed nothing. | Fixed |
| RV-26 | Medium | FE Jira sync | Resolving did not refresh the board query. | Fixed |
| RV-27 | Low | FE boards | Deadline badge was not recomputed over time; the deadline row did not wrap at 375 px. | Fixed |
| RV-28 | Low | FE notifications | `jira.conflict` notifications showed the raw type string. | Fixed |

## Deferred

| ID | Severity | Area | Defect | Decision | Owner |
| --- | --- | --- | --- | --- | --- |
| DF-1 | Low | FE responsive | Minor padding inconsistencies on the mobile view during window resize. | Deferred to the UI polish sprint; no Jira ticket yet. | PM to create a ticket |

## Retest

Each fix commit carries tests that failed without it (frontend: `pnpm test`; backend: unit and
`pnpm test:e2e`). Retest of all items after merge: CI on `dev` (typecheck, lint, unit, e2e,
Playwright matrix).
