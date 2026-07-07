# P7 — Architecture decisions index (ADR-lite)

```yaml
index_id: DEC-P7-INDEX
pack: P7
version: "1.6"
status: LOCKED
format: adr-lite
authority: platform-denali-customer-delivery.mdoc
```

> **ADR-lite:** frozen decisions for P7 delivery — full ADR prose lives in linked docs; this index is the single lookup table for agents and PR review.

---

## Decisions

| ID | Decision | Status | Rationale | Consequences | Doc anchor |
| -- | -------- | ------ | --------- | ------------ | ---------- |
| **DEC-P7-001** | P7 is staging delivery only — no product rewrite | Accepted | P6 closed product chain | Fixes are P0 blockers + hardening | [P6-P7-BOUNDARY.md](P6-P7-BOUNDARY.md) |
| **DEC-P7-002** | Four-process deploy (API + web + marketing + portal) | Accepted | VS-01..08 needs all surfaces | VPS gap documented until systemd units land | [p7-0-live-infra.md](../p7-0-live-infra.md) N-004 |
| **DEC-P7-003** | Wizard stays at `/tours/new` outside `(app)/` | Accepted | DEC-P9-007 · Z1 freeze | No admin shell migration in P7 | [p7-1-wizard-completion.md](../p7-1-wizard-completion.md) |
| **DEC-P7-004** | Workspace changes are Z3 additive only | Accepted | Protect admin shell | New tabs need P0 justification | [p7-2-workspace-ops.md](../p7-2-workspace-ops.md) |
| **DEC-P7-005** | `offline_receipt` only in P7 (PC-07) | Accepted | First customer scope | Gateway deferred to POST-P7 | [PAYMENT-LEDGER-BOUNDARY.md](PAYMENT-LEDGER-BOUNDARY.md) |
| **DEC-P7-006** | Proof tiers: doc → dev → staging → manual | Accepted | Avoid doc-only "complete" | IMPLEMENTATION-TRUTH columns | [IMPLEMENTATION-TRUTH-P7.md](IMPLEMENTATION-TRUTH-P7.md) |
| **DEC-P7-007** | Every P7 PR runs `p7:gate` (= p6 + pack integrity) | Accepted | Regression safety | No skip without Architect | [AGENT-NAVIGATOR.md](../../AGENT-NAVIGATOR.md) |
| **DEC-P7-009** | Walkthrough-before-code — no implementation without staging P0 | Accepted | Avoid fake fixes | P7-1+ code gated on walkthrough | [P7-EXECUTION-DISCIPLINE.md](P7-EXECUTION-DISCIPLINE.md) |
| **DEC-P7-010** | Canonical ports/URLs — Profile A/B/C | Accepted | End 4000 vs 3001 drift | [P7-PORT-MATRIX.md](P7-PORT-MATRIX.md) wins | [P7-PORT-MATRIX.md](P7-PORT-MATRIX.md) |
| **DEC-P7-011** | `p7:staging-gate` composition frozen | Accepted | T1+infra+T3 in one script | T2 stays manual/e2e runbook | [p7-staging-gate.md](../runbooks/p7-staging-gate.md) |
| **DEC-P7-012** | Profile B tenant via fallback env | Accepted | Raw IP staging | not subdomain DNS | [P7-HOST-PARITY-PROFILE-B.md](P7-HOST-PARITY-PROFILE-B.md) |
| **DEC-P7-013** | Profile C SMS — T4 waiver allowed | Accepted | `otp-delivery.ts` logs only | T4 may sign with `AUTH_ALLOW_DEV_STATIC_OTP=1` + waiver row in evidence manifest | [p7-sms-otp-staging.md](../runbooks/p7-sms-otp-staging.md) |
| **DEC-P7-014** | Remote staging gate via GHA SSH | Accepted | Repeatable T1+infra+T3 | T2 Playwright stays manual until self-hosted runner | [p7-staging-e2e-ci.md](../runbooks/p7-staging-e2e-ci.md) |
| **DEC-P7-015** | P7 AI boot — BOOT-MANIFEST sole T0 | Accepted | Agent anti-hollow | [P7-BOOT-MANIFEST.yaml](P7-BOOT-MANIFEST.yaml) · [P7-ANTI-HOLLOW-CONTRACT.md](P7-ANTI-HOLLOW-CONTRACT.md) |

---

## Supersession

| Decision | Supersedes | Notes |
| -------- | ---------- | ----- |
| DEC-P7-001 | Informal "P7 rebuild" discussions | — |

**Future:** new P7 decisions add rows here with next ID; do not renumber.

---

## Adding a decision (process)

1. Propose in PR with `DEC-P7-00N` row draft
2. Link from affected EPIC nano
3. Update this index + [TRACEABILITY-MATRIX-P7.md](TRACEABILITY-MATRIX-P7.md) if proof band changes

---

## References

- Phase 9 decisions: [IMPLEMENTATION-DECISIONS.md](../../phase-9/appendices/IMPLEMENTATION-DECISIONS.md)
- [P7-DOC-ARCHITECTURE.md](P7-DOC-ARCHITECTURE.md)
