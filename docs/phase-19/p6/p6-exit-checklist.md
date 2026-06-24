# P6 exit checklist

```yaml
phase: P6
pack_version: "2.4"
status: closed_fast
fast_close: p6-fast-close.yaml
nano_done_doc: 58
nano_done_behavioral: 37
nano_done_behavioral_note: "Fast-close 2026-06-23 — honest tiers; full VPS gates deferred P7"
remaining_checklist: p6-remaining-checklist.md
current_task: none
proof_tiers:
  doc: 58
  e2e_vertical_slice: 8
  api_memory_in_gate: 28
  static_wiring: 12
  deferred_p7: 9
  deferred_p10: 4
nano_total: 58
exit_nano: P6-4-N-008
milestone_guest_slice: P6-1-N-014
prerequisite: P5-B-N-016
gate_static: pnpm run p6:gate
gate_live: node scripts/smoke-p6-host-bind.mjs
gate_closure_fast: P6_FAST_CLOSE=1 pnpm run p6:closure
execution_order: [P6-0, P6-1, P6-2, P6-3, P6-4]
addressing_sot: ../p6-host-addressing-architecture.mdoc
truth: appendices/IMPLEMENTATION-TRUTH-P6.md
```

## Fast-close (2026-06-23)

P6 **closed** on local dev slice + VPS staging infra smoke. Slow paths deferred:

- VPS `p6:staging-preflight` / `p6:e2e-gate` → **P7**
- DEV `build-operator-vps` + hollow spec hardening → **P7 / P10**

See **[p6-fast-close.yaml](p6-fast-close.yaml)** and **[p6-remaining-checklist.md](p6-remaining-checklist.md)**.

## Milestones

| ID | Nano | Status |
| -- | ---- | ------ |
| M0 Host parity | P6-0-N-007 live smoke | ✅ behavioral 2026-06-22 |
| **M1 GUEST_SLICE_OK** | **P6-1-N-014** | ✅ behavioral 2026-06-22 |
| M2 Admin full | P6-2-N-016 | ✅ behavioral 2026-06-22 |
| M3 Member portal | P6-3-N-007 | ✅ behavioral 2026-06-22 |
| M4 P6 exit | P6-4-N-008 | ✅ p6:e2e-gate 2026-06-22 |

## EPIC progress

| EPIC | Nanos | Done | Status |
| ---- | ----- | ---- | ------ |
| P6-0 Host subdomain | 9 | 9 | ✅ |
| P6-1 Guest slice | 15 | 15 | ✅ |
| P6-2 Operator admin | 16 | 16 | ✅ |
| P6-3 Member portal | 10 | 10 | ✅ |
| P6-4 Exit gate | 8 | 8 | ✅ |

## Vertical slice (behavioral — complete)

- [x] VS-01 Publish active (P6-1) — SMK-P6-VS-01 + `p6-vs01-admin-publish` + `tour-publish-transition` LC-04/06 · wizard UI PATCH E2E = P7
- [x] VS-02 Marketing lists tour (P6-1) — SMK-MKT-01
- [x] VS-03 Portal register success (P6-1) — SMK-MKT-03 · SMK-PTL-01
- [x] VS-04 Portal `/me` lists row (P6-3) — SMK-PTL-02
- [x] VS-05 Member receipt upload (P6-3) — SMK-PTL-04 · `p6-member-receipt-flow.spec.ts`
- [x] VS-06 Operator approve booking (P6-2) — SMK-P9-04 E2E + `bookings-ops` API-9.5-01 (in `p6:e2e-gate`)
- [x] VS-07 Operator approve receipt (P6-2) — SMK-P6-ADM-02 E2E + `p6-member-receipt-flow` P6-MR-03 (in `p6:e2e-gate`)
- [x] VS-08 `p6:gate` + `p6:e2e-gate` (P6-4) — product + browser smokes green

---

## P6-0 — Host subdomain (dual model)

- [x] P6-0-N-007 Three-URL live smoke (`P6_HOST_BIND_SMOKE_OK` · API :3001)
- [x] P6-0-N-002 tenant-context parity spec
- [x] P6-0-N-003 Dev host resolver alignment (canonical `.portal.` / `.admin.`)
- [x] P6-0-N-004 First customer seed
- [x] P6-0-N-005 site_surfaces defaults
- [x] P6-0-N-006 Env URL matrix (incl. `PORTAL_PUBLIC_BASE_URL` custom domain)
- [x] P6-0-N-007 Three-URL smoke script
- [x] P6-0-N-008 Prod ingress note
- [x] P6-0-N-009 Custom domain addressing (`tenant_domains`)

## P6-1 — Guest slice

- [x] P6-1-N-001 Publish active (admin minimal)
- [x] P6-1-N-002 Catalog list active tour
- [x] P6-1-N-003 Catalog detail
- [x] P6-1-N-004 CTA → portal
- [x] P6-1-N-005 Portal register page
- [x] P6-1-N-006 OTP flow E2E
- [x] P6-1-N-007 Success marker
- [x] P6-1-N-008 Publish → revalidate → catalog (`marketing-catalog-revalidate.spec.ts` in `p6:gate`)
- [x] P6-1-N-009 Pending booking row
- [x] P6-1-N-010 Club home + design-token stack
- [x] P6-1-N-011 fa-IR default
- [x] P6-1-N-012 site_surfaces marketing gate
- [x] P6-1-N-013 Guest slice integration spec
- [x] P6-1-N-015 Enterprise theming file tree
- [x] P6-1-N-014 **GUEST_SLICE_OK** — SMK-MKT-03 + SMK-PTL-01 green (2026-06-22)

## P6-2 — Operator admin

- [x] P6-2-N-001 Bookings persistence audit
- [x] P6-2-N-002 Approve/reject path
- [x] P6-2-N-003 Waitlist promote
- [x] P6-2-N-004 Workspace registrations embed
- [x] P6-2-N-005 Operator tour register
- [x] P6-2-N-006 Finance receipts live
- [x] P6-2-N-007 Receipt review → ledger
- [x] P6-2-N-008 MinIO upload
- [x] P6-2-N-009 Wizard bug sweep
- [x] P6-2-N-010 Settings persist
- [x] P6-2-N-011 Dashboard pending KPI — `finance-dashboard-widget.spec.ts` in `p6:gate`
- [x] P6-2-N-012 Finance widget live
- [x] P6-2-N-013 Reconciliation triage
- [x] P6-2-N-014 offline_receipt gate
- [x] P6-2-N-015 Preservation PC-01..10
- [x] P6-2-N-016 Operator runbook

## P6-3 — Member portal

- [x] P6-3-N-001 Member session mdoc
- [x] P6-3-N-002 GET my registrations API
- [x] P6-3-N-003 `/me` shell
- [x] P6-3-N-004 `/me/registrations` list
- [x] P6-3-N-005 Registration detail
- [x] P6-3-N-006 Receipt upload BFF
- [x] P6-3-N-007 POST receipt member
- [x] P6-3-N-008 Register success → `/me`
- [x] P6-3-N-009 Portal home redirect — SMK-PTL-05 E2E + `portal-home-redirect.spec.ts`
- [x] P6-3-N-010 Portal member i18n

## P6-4 — Exit gate

- [x] P6-4-N-001 Vertical slice mdoc
- [x] P6-4-N-002 Gate script
- [x] P6-4-N-003 p6:gate package.json
- [x] P6-4-N-004 Exit spec
- [x] P6-4-N-005 Customer seed runbook
- [x] P6-4-N-006 Staging deploy — runbook + `p6:staging-deploy-verify.sh` (live deploy = ops)
- [x] P6-4-N-007 p6:e2e-gate wired (`scripts/p6-denali-e2e-gate.sh`)
- [x] P6-4-N-008 P6 closure
