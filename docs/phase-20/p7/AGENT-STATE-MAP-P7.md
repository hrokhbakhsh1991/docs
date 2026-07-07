# ASM-P7 — Denali delivery states (staging)

```yaml
map_id: AGENT-STATE-MAP-P7
phase: 20
authority: platform-denali-customer-delivery.mdoc · IMPLEMENTATION-TRUTH-P7.md
state_count: 12
```

## Staging infra (P7-0)

| State ID | Trigger | Guard | Next |
| -------- | ------- | ----- | ---- |
| ASM-P7-001 | Profile B/C chosen | env matrix documented | four-process deploy |
| ASM-P7-002 | `db:seed` on staging | Postgres + migrations | tenant-context 200 |
| ASM-P7-003 | `smoke-p6-host-bind.mjs` | same tenantId 3 hosts | P7-0 exit |
| ASM-P7-004 | Operator OTP login staging | admin host resolves tenant | P7-1 entry |

**Prove:** SMK-P7-INFRA-01..03 · `verify-env-coherence.sh`

---

## Wizard publish (P7-1)

| State ID | Trigger | Guard | Next |
| -------- | ------- | ----- | ---- |
| ASM-P7-010 | GET `/tours/new` | operator session | wizard bridge shell |
| ASM-P7-011 | Draft PATCH save | Postgres persist | step advance |
| ASM-P7-012 | Publish transition | readiness ok | `publishStatus: active` |
| ASM-P7-013 | Publish active | revalidate | marketing lists tour VS-02 |

**Prove:** `denali-publish-readiness.spec.ts` · staging walkthrough

---

## Workspace ops (P7-2)

| State ID | Trigger | Guard | Next |
| -------- | ------- | ----- | ---- |
| ASM-P7-020 | Portal register | member session | pending booking row |
| ASM-P7-021 | Workspace open tour | tourId preset | pending visible |
| ASM-P7-022 | POST approve booking | admin + txn | VS-06 approved |
| ASM-P7-023 | Waitlist promote | capacity policy | approve path |

**Prove:** `bookings-ops.spec.ts` · `tours-workspace.spec.ts`

---

## Delivery sign-off (P7-3)

| State ID | Trigger | Guard | Next |
| -------- | ------- | ----- | ---- |
| ASM-P7-030 | Member receipt upload | own registration | pending receipt |
| ASM-P7-031 | PATCH approve receipt | admin finance | VS-07 ledger |
| ASM-P7-032 | T4 sign-off complete | VS-01..08 staging | P7 exit |

**Prove:** `finance-ops.spec.ts` · `p7-customer-sign-off.md`

---

## References

- [AGENT-STATE-MAP-P6.md](../../phase-19/p6/AGENT-STATE-MAP-P6.md)
