# Denali Ticketing Certification Matrix

This matrix is the executable release contract for Ticketing in the Denali
workspace. A capability is not certified merely because a test file exists;
the corresponding CI job must finish with `PASS` at the PR head.

## Required jobs

| Job                             | Proof                                                                                                                 | Required suites                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `ticketing-package`             | Pure domain, HTTP boundary, and wire contracts                                                                        | `ticketing-core`, `ticketing-http`, `ticketing-http-contracts` |
| `ticketing-postgres`            | Prisma persistence, tenant RLS, lifecycle, operations, attachments, notifications, SLA, templates, reports, retention | all Ticketing PostgreSQL specs under `apps/api`                |
| `ticketing-operator-playwright` | Denali operator web: inbox, triage, assignment, bulk actions, templates, reports/settings, a11y                       | `playwright.operator-ticketing.config.ts`                      |
| `ticketing-member-playwright`   | Denali member portal: create, reply, attachment, resolve/reopen, notifications, a11y                                  | `playwright.portal-ticketing.config.ts`                        |

## Matrix rules

1. Every job runs against the exact pull-request head SHA.
2. PostgreSQL jobs use the application role for tenant operations so RLS is
   actually exercised; migrations and fixtures use the admin role.
3. Playwright jobs use the real Denali host routing and approved test fixtures;
   they must not replace authentication with arbitrary headers.
4. A skipped job, pending job, unavailable environment, or stale staging build
   is `UNVERIFIED`, not `PASS`.
5. The PR is Ticketing-certified only when all four required jobs pass.

## Capability traceability

| Capability                                  | Package/API proof                    | Operator proof                 | Member proof          |
| ------------------------------------------- | ------------------------------------ | ------------------------------ | --------------------- |
| create, list, detail, reply                 | commands, HTTP contracts, PostgreSQL | inbox/reply                    | create/detail/reply   |
| lifecycle and concurrency                   | lifecycle, rowVersion, idempotency   | resolve/close/reopen/conflict  | resolved → reopen     |
| permissions and tenant isolation            | permission tests + PostgreSQL/RLS    | viewer read-only/member denied | own-ticket access     |
| categories, tags, queues, teams, assignment | operational PostgreSQL               | filters and triage actions     | —                     |
| attachments and links                       | E1 PostgreSQL + storage contract     | —                              | upload and visibility |
| notifications                               | notification PostgreSQL/relay        | operator notification routes   | member bell/inbox     |
| SLA, templates, reports, settings           | PostgreSQL specs                     | templates/reports/settings UI  | —                     |
| RTL, responsive, accessibility              | contract/UI assertions               | operator a11y/mobile           | portal a11y/mobile    |

## Release interpretation

Passing this matrix proves the tested behavior at the tested commit and
environment. It does not by itself prove that a separately deployed staging
instance runs the same SHA; staging SHA and post-deploy smoke remain separate
evidence.
