# P6 ↔ P7 boundary (frozen vs mutable)

```yaml
boundary_id: P6-P7-BOUNDARY
pack: P7
version: "1.0"
authority: platform-denali-customer-delivery.mdoc · platform-denali-first-customer.mdoc
p6_gate: pnpm run p6:gate
p7_gate: pnpm run p7:gate
```

## Executive summary

| Layer | P6 (phase-19) | P7 (phase-20) |
| ----- | ------------- | ------------- |
| **Goal** | Product chain closed in dev | First customer live on staging |
| **Environment** | localhost canonical hosts | staging / VPS / subdomain profiles |
| **Proof** | E2E dev + static gate | T2/T3/T4 on real URLs + Postgres |
| **Data** | smoke seed · memory driver OK | customer seed · Postgres required for T3 |

P6 is **regression baseline** for every P7 PR. P7 does not reopen P6 greenfield.

---

## P6 frozen (do not change semantics)

| ID | Rule | Anchor |
| -- | ---- | ------ |
| R-P6-01 | Three apps: `marketing` · `portal` · `web` | [p6-host-addressing-architecture.mdoc](../../phase-19/p6-host-addressing-architecture.mdoc) |
| R-P6-02 | `offline_receipt` only (PC-07) | [FINANCE-OPS-P6-NOTE.md](../../phase-19/p6/appendices/FINANCE-OPS-P6-NOTE.md) |
| R-P6-03 | Vertical slice VS-01..08 definition | [platform-denali-vertical-slice.mdoc](../../phase-19/platform-denali-vertical-slice.mdoc) |
| R-P6-04 | Denali workspace plugin only | [p6-denali-safety.md](../../phase-19/p6/p6-denali-safety.md) |
| R-P6-05 | Wizard host `/tours/new` (DEC-P9-007) | [wizard-experience.md](../../workspaces/denali/wizard-experience.md) |
| R-P6-06 | Member BFF upstream `GET /bookings?view=mine` | [platform-portal-member.mdoc](../../phase-19/platform-portal-member.mdoc) |
| R-P6-07 | Receipt BFF → `POST /bookings/{id}/receipts` | same |

---

## P7 adds (mutable delivery work)

| ID | P7 scope | EPIC |
| -- | -------- | ---- |
| A-P7-01 | Staging env profiles A/B/C | P7-0 |
| A-P7-02 | Four-process deploy (API + web + marketing + portal) | P7-0 |
| A-P7-03 | Customer seed on staging Postgres | P7-0 |
| A-P7-04 | Wizard P0 blockers for real customer tour publish | P7-1 |
| A-P7-05 | Settings seed for wizard prefill | P7-1 |
| A-P7-06 | Workspace ops hardening on staging | P7-2 |
| A-P7-07 | T2 E2E + T3 finance-ops + T4 manual sign-off | P7-3 |

---

See [P7-EXECUTION-DISCIPLINE.md](P7-EXECUTION-DISCIPLINE.md) before any P7 code change.

---

## Explicit OUT of P7

```text
❌ Gateway / Stripe / Zibal (P5-D — post-P7 horizon)
❌ Workspace commerce mode switch (P5-C — non-Denali)
❌ Urban workspace (phase-7/8)
❌ Metadata platform cutover (phase-16/18)
❌ Wizard rebuild or move into (app)/
❌ Delete/refactor denali rules/composites
❌ Merge three apps into one deploy
❌ Super Admin operator wizard
❌ Custom apex domain (Z4 — unless business blocks sign-off)
```

---

## Verification regression

Every P7 PR must pass:

```bash
pnpm run p7:gate   # includes p6:gate
```

P7-specific proof tiers: [IMPLEMENTATION-TRUTH-P7.md](IMPLEMENTATION-TRUTH-P7.md).

---

## References

- [IMPLEMENTATION-TRUTH-P6.md](../../phase-19/p6/appendices/IMPLEMENTATION-TRUTH-P6.md)
- [POST-P7-HORIZON.md](POST-P7-HORIZON.md)
