# P7 — Test inventory (scaffold vs behavioral)

```yaml
inventory_id: P7-TEST-INVENTORY
pack_version: "1.6"
authority: P7-ANTI-HOLLOW-CONTRACT.md · IMPLEMENTATION-TRUTH-P7.md
```

> **Rule:** Cite tier when claiming a nano or VS is proven. See [P7-VERIFICATION-COMMANDS.yaml](P7-VERIFICATION-COMMANDS.yaml) for canonical commands.

---

## Proof tier legend

| Tier | Abbrev |
| ---- | ------ |
| STATIC | File/wiring/guard only): `p7-pack-integrity` |
| API_MEMORY | In-memory HTTP handler tests |
| DEV_E2E | Playwright on localhost dev servers |
| STAGING_E2E | Playwright `PW_EXTERNAL_SERVERS=1` |
| STAGING_BEHAVIORAL | Postgres integration on staging |
| MANUAL | Walkthrough / T4 sign-off |

---

## P7 gate specs

| Spec | Tier | valid_for_nano | invalid_claim |
| ---- | ---- | -------------- | ------------- |
| `apps/api/test/p7-pack-integrity.spec.ts` | STATIC | P7-3-N-003 · VS-08 doc | Any VS staging |
| `scripts/p7-denali-delivery-gate.sh` | STATIC | P7-3-N-003 | Staging proof |

---

## API (`apps/api/test`)

| Spec | Tier | valid_for_nano | invalid_claim |
| ---- | ---- | -------------- | ------------- |
| `bookings-ops.spec.ts` | API_MEMORY | P7-2-N-003 dev | VS-06 staging alone |
| `finance-ops.spec.ts` | STAGING_BEHAVIORAL | P7-3-N-002 | Without staging `DATABASE_URL` |
| `tours-workspace.spec.ts` | API_MEMORY | P7-2-N-004 · P7-2-N-006 dev | Staging waitlist |
| `p6-guest-slice.spec.ts` | API_MEMORY | P6 regression | P7 staging |
| `p6-member-receipt-flow.spec.ts` | API_MEMORY | P6 regression | VS-05 staging |
| `p6-offline-receipt-gate.spec.ts` | STATIC | P6 markers | Postgres receipt path |

---

## Web (`apps/web/test`)

| Spec | Tier | valid_for_nano | invalid_claim |
| ---- | ---- | -------------- | ------------- |
| `denali-publish-readiness.spec.ts` | API_MEMORY | P7-1-N-005 | VS-01 staging |
| `denali-wizard-draft-contract.spec.ts` | API_MEMORY | P7-1-N-002 · P7-1-N-007 | Staging draft UX |
| `tour-workspace-registrations-logic.spec.ts` | API_MEMORY | P7-2-N-001 | Staging inbox |
| `finance-page.spec.ts` | STATIC | Nav marker | VS-07 finance depth |

---

## Marketing / Portal smoke

| Spec | Tier | valid_for_nano | invalid_claim |
| ---- | ---- | -------------- | ------------- |
| `apps/marketing/tests/e2e/marketing-catalog-smoke.spec.ts` | DEV_E2E / STAGING_E2E | P7-1-N-009 · T2 | localhost as staging |
| `apps/portal/tests/e2e/portal-member-smoke.spec.ts` | DEV_E2E / STAGING_E2E | P7-3-N-001 | Without `PW_EXTERNAL_SERVERS=1` |
| `apps/portal/test/portal-member-receipt-bff.spec.ts` | API_MEMORY | P6 BFF | Staging MinIO upload |

---

## Scripts (expect tokens)

| Script | Tier | expect_token | invalid_claim |
| ------ | ---- | ------------ | --------------- |
| `p7-staging-verify.sh` | STAGING | `P7_STAGING_VERIFY_OK` | Full T2 |
| `p7-staging-gate.sh` | STAGING | `P7_STAGING_GATE_OK` | T4 complete |
| `verify-env-coherence.sh` | STAGING | `verify-env-coherence: OK` | Env matrix doc read |
| `smoke-p6-host-bind.mjs` | STAGING | `P6_HOST_BIND_SMOKE_OK` | Single host only |
| `p7-evidence-pack-verify.sh` | STATIC | `P7_EVIDENCE_PACK_VERIFY_OK` | T4 without manifest |

---

## Hollow pattern registry

| Pattern | Flag |
| ------- | ---- |
| `p7:gate` green → update staging column | `P7_FAIL` |
| Unit test only → VS-0N staging | `P7_FAIL` |
| `finance-ops` skipped on VPS with DATABASE_URL | `hollow_risk` |
| Conditional nano PASS without SKIP doc | `P7_FAIL` |

---

## References

- [P7-AGENT-TURN-SCHEMA.md](P7-AGENT-TURN-SCHEMA.md)
- [SMOKE-SCENARIO-MAP-P7.md](SMOKE-SCENARIO-MAP-P7.md)
