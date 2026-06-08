# Phase 9 — Operator Admin Parity (doc pack index)

**SOLE ENTRY:** [`phase-9-agent-router.md`](phase-9-agent-router.md)

| Doc                                                                          | Role                                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`phase-9-charter.md`](phase-9-charter.md)                                   | North star · invariants · subphase DAG                     |
| [`phase-9-agent-router.md`](phase-9-agent-router.md)                         | **Mandatory first read** for agents                        |
| [`AGENT-NAVIGATOR.md`](AGENT-NAVIGATOR.md)                                   | **«قدم بعدی؟»** decision tree · scaffold guide             |
| [`phase-9-guards.md`](phase-9-guards.md)                                     | Guard command reference                                    |
| [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md)           | Honesty ledger                                             |
| [`audits/verification-matrix.md`](audits/verification-matrix.md)             | REQ-P9 → proof commands                                    |
| [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml)             | Machine boot + gate chain                                  |
| [`appendices/AGENT-CURRENT-PHASE.yaml`](appendices/AGENT-CURRENT-PHASE.yaml) | **«الان کجاییم؟»** — doc_ready · blockers · next_read      |
| [`appendices/PRECISION-DOC-INDEX.md`](appendices/PRECISION-DOC-INDEX.md)     | Full PEK file register (72 files · ~96% integration depth) |
| [`appendices/TRACEABILITY-MAP.md`](appendices/TRACEABILITY-MAP.md)           | Master REQ ↔ spec ↔ smoke rollup                           |

## Prerequisites

```bash
pnpm run phase-8:gate   # required before Phase 9 behavioral work (9.1+)
pnpm run phase-9:guard  # 32/32 charter gates
pnpm run guard:p9-boundary-diff  # 9.1+ PR boundary allowlist
```

## Subphases

| ID  | Spec                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 9.0 | [`subphases/9.0-entry.md`](subphases/9.0-entry.md)                                                                                    |
| 9.1 | [`subphases/9.1-identity-session.md`](subphases/9.1-identity-session.md)                                                              |
| 9.2 | [`subphases/9.2-admin-shell.md`](subphases/9.2-admin-shell.md) · [`appendices/ADMIN-SHELL-UX.md`](appendices/ADMIN-SHELL-UX.md)       |
| 9.3 | [`subphases/9.3-tours-operator.md`](subphases/9.3-tours-operator.md) · [`appendices/TOURS-LIST-UX.md`](appendices/TOURS-LIST-UX.md)   |
| 9.4 | [`subphases/9.4-users-rbac.md`](subphases/9.4-users-rbac.md) · [`appendices/USERS-DIRECTORY-UX.md`](appendices/USERS-DIRECTORY-UX.md) |
| 9.5 | [`subphases/9.5-bookings-ops.md`](subphases/9.5-bookings-ops.md)                                                                      |
| 9.6 | [`subphases/9.6-settings-templates.md`](subphases/9.6-settings-templates.md)                                                          |
| 9.7 | [`subphases/9.7-finance-denali.md`](subphases/9.7-finance-denali.md) · [`appendices/FINANCE-OPS-UX.md`](appendices/FINANCE-OPS-UX.md) |
| 9.8 | [`subphases/9.8-operator-dod-gate.md`](subphases/9.8-operator-dod-gate.md)                                                            |

## Settings architecture (9.6)

| Doc                                                                                            | Role                                                       |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`appendices/SETTINGS-MODULE-REGISTRY.md`](appendices/SETTINGS-MODULE-REGISTRY.md)             | Manifest-driven registry · hybrid storage (DEC-P9-009/010) |
| [`appendices/SETTINGS-RISK-REGISTER-P9.md`](appendices/SETTINGS-RISK-REGISTER-P9.md)           | S1/S2 risk register + mitigations                          |
| [`appendices/TRACEABILITY-MATRIX-9.6.md`](appendices/TRACEABILITY-MATRIX-9.6.md)               | REQ-P9-060..062 · module map                               |
| [`appendices/settings-api-dispatch-addendum.md`](appendices/settings-api-dispatch-addendum.md) | `/settings/resources` · `/settings/config` v2              |
| [`appendices/IMPLEMENTATION-DECISIONS.md`](appendices/IMPLEMENTATION-DECISIONS.md)             | DEC-P9-008..010 locked decisions                           |

## Bookings / Registration Ops (9.5)

| Doc                                                                                            | Role                                                |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [`appendices/BOOKINGS-OPS-UX.md`](appendices/BOOKINGS-OPS-UX.md)                               | Registration Command Center · manifest (DEC-P9-011) |
| [`appendices/TRACEABILITY-MATRIX-9.5.md`](appendices/TRACEABILITY-MATRIX-9.5.md)               | REQ-P9-050..052 · route unification                 |
| [`appendices/bookings-api-dispatch-addendum.md`](appendices/bookings-api-dispatch-addendum.md) | `/bookings` v2 · summary · bulk-approve             |

## Identity & login (9.1)

| Doc                                                                                            | Role                                              |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [`appendices/OPERATOR-LOGIN-FLOW.md`](appendices/OPERATOR-LOGIN-FLOW.md)                       | End-to-end OTP login · legacy parity (DEC-P9-012) |
| [`appendices/identity-web-bff-addendum.md`](appendices/identity-web-bff-addendum.md)           | Next BFF `/api/auth/*` routes                     |
| [`appendices/IDENTITY-PORT-SCOPE.md`](appendices/IDENTITY-PORT-SCOPE.md)                       | Prisma models · API surface                       |
| [`appendices/identity-api-dispatch-addendum.md`](appendices/identity-api-dispatch-addendum.md) | Fastify dispatch v2                               |

## Admin shell (9.2)

| Doc                                                                                | Role                                                       |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`appendices/ADMIN-SHELL-UX.md`](appendices/ADMIN-SHELL-UX.md)                     | Mobile-first operator chrome · drawer/sidebar (DEC-P9-013) |
| [`appendices/TRACEABILITY-MATRIX-9.2.md`](appendices/TRACEABILITY-MATRIX-9.2.md)   | REQ-P9-013 · REQ-P9-020 · shell proofs                     |
| [`appendices/erip/9.2-cop-admin-shell.md`](appendices/erip/9.2-cop-admin-shell.md) | COP failure modes                                          |

## Tours list (9.3)

| Doc                                                                                                            | Role                                                    |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`appendices/TOURS-LIST-UX.md`](appendices/TOURS-LIST-UX.md)                                                   | Operator list · API projection · card grid (DEC-P9-014) |
| [`appendices/TRACEABILITY-MATRIX-9.3.md`](appendices/TRACEABILITY-MATRIX-9.3.md)                               | REQ-P9-030..032 · list proofs                           |
| [`appendices/tours-operator-api-dispatch-addendum.md`](appendices/tours-operator-api-dispatch-addendum.md)     | `GET /tours?view=operator` v2                           |
| [`appendices/schemas/TOURS-LIST-PROJECTION.schema.json`](appendices/schemas/TOURS-LIST-PROJECTION.schema.json) | List row JSON contract                                  |
| [`appendices/erip/9.3-cop-tours-operator.md`](appendices/erip/9.3-cop-tours-operator.md)                       | COP failure modes                                       |

## Legacy reference

- Web: `legacy/apps/web/app/(app)/`
- API identity: `legacy/apps/api/src/modules/identity/`
- Gap analysis: [`apps/api/docs/legacy-vs-denali-gap-analysis.md`](../apps/api/docs/legacy-vs-denali-gap-analysis.md)
