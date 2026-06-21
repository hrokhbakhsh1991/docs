# P6 exit checklist

```yaml
phase: P6
pack_version: "2.0"
status: in_progress
nano_done: 0
nano_total: 56
exit_nano: P6-4-N-008
milestone_guest_slice: P6-1-N-014
current_task: P6-0-N-001
prerequisite: P5-B-N-016
gate: pnpm run p6:gate
execution_order: [P6-0, P6-1, P6-2, P6-3, P6-4]
```

## Milestones

| ID | Nano | Status |
| -- | ---- | ------ |
| M0 Host parity | P6-0 complete | ⬜ |
| **M1 GUEST_SLICE_OK** | **P6-1-N-014** | ⬜ |
| M2 Admin full | P6-2 complete | ⬜ |
| M3 Member portal | P6-3 complete | ⬜ |
| M4 P6 exit | P6-4-N-008 | ⬜ |

## EPIC progress

| EPIC | Nanos | Done | Status |
| ---- | ----- | ---- | ------ |
| P6-0 Host subdomain | 8 | 0 | ⬜ |
| P6-1 Guest slice | 14 | 0 | ⬜ |
| P6-2 Operator admin | 16 | 0 | ⬜ |
| P6-3 Member portal | 10 | 0 | ⬜ |
| P6-4 Exit gate | 8 | 0 | ⬜ |

## Vertical slice

- [ ] VS-01 Publish active (P6-1)
- [ ] VS-02 Marketing lists tour (P6-1)
- [ ] VS-03 Portal register success (P6-1)
- [ ] VS-04 Portal `/me` lists row (P6-3)
- [ ] VS-05 Member receipt upload (P6-3)
- [ ] VS-06 Operator approve booking (P6-2)
- [ ] VS-07 Operator approve receipt (P6-2)
- [ ] VS-08 `p6:gate` green (P6-4)

---

## P6-0 — Host subdomain

- [ ] P6-0-N-001 Host map runbook
- [ ] P6-0-N-002 tenant-context parity spec
- [ ] P6-0-N-003 Dev host resolver alignment
- [ ] P6-0-N-004 First customer seed
- [ ] P6-0-N-005 site_surfaces defaults
- [ ] P6-0-N-006 Env URL matrix
- [ ] P6-0-N-007 Three-URL smoke script
- [ ] P6-0-N-008 Prod subdomain ingress note

## P6-1 — Guest slice

- [ ] P6-1-N-001 Publish active (admin minimal)
- [ ] P6-1-N-002 Catalog list active tour
- [ ] P6-1-N-003 Catalog detail
- [ ] P6-1-N-004 CTA → portal
- [ ] P6-1-N-005 Portal register page
- [ ] P6-1-N-006 OTP flow E2E
- [ ] P6-1-N-007 Success marker
- [ ] P6-1-N-008 Publish → revalidate → catalog
- [ ] P6-1-N-009 Pending booking row
- [ ] P6-1-N-010 Club home minimal
- [ ] P6-1-N-011 fa-IR default
- [ ] P6-1-N-012 site_surfaces marketing gate
- [ ] P6-1-N-013 Guest slice integration spec
- [ ] P6-1-N-014 **GUEST_SLICE_OK**

## P6-2 — Operator admin

- [ ] P6-2-N-001 Bookings persistence audit
- [ ] P6-2-N-002 Approve/reject path
- [ ] P6-2-N-003 Waitlist promote
- [ ] P6-2-N-004 Workspace registrations embed
- [ ] P6-2-N-005 Operator tour register
- [ ] P6-2-N-006 Finance receipts live
- [ ] P6-2-N-007 Receipt review → ledger
- [ ] P6-2-N-008 MinIO upload
- [ ] P6-2-N-009 Wizard bug sweep
- [ ] P6-2-N-010 Settings persist
- [ ] P6-2-N-011 Dashboard pending KPI
- [ ] P6-2-N-012 Finance widget live
- [ ] P6-2-N-013 Reconciliation triage
- [ ] P6-2-N-014 offline_receipt gate
- [ ] P6-2-N-015 Preservation PC-01..10
- [ ] P6-2-N-016 Operator runbook

## P6-3 — Member portal

- [ ] P6-3-N-001 Member session mdoc
- [ ] P6-3-N-002 GET my registrations API
- [ ] P6-3-N-003 `/me` shell
- [ ] P6-3-N-004 `/me/registrations` list
- [ ] P6-3-N-005 Registration detail
- [ ] P6-3-N-006 Receipt upload BFF
- [ ] P6-3-N-007 POST receipt member
- [ ] P6-3-N-008 Register success → `/me`
- [ ] P6-3-N-009 Portal home redirect
- [ ] P6-3-N-010 Portal member i18n

## P6-4 — Exit gate

- [ ] P6-4-N-001 Vertical slice mdoc
- [ ] P6-4-N-002 Gate script
- [ ] P6-4-N-003 p6:gate package.json
- [ ] P6-4-N-004 Exit spec
- [ ] P6-4-N-005 Customer seed runbook
- [ ] P6-4-N-006 Staging deploy
- [ ] P6-4-N-007 p6:e2e-gate stub
- [ ] P6-4-N-008 P6 closure
