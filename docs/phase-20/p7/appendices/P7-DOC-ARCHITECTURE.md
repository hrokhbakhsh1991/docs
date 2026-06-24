---
title: P7 — Documentation architecture (industry alignment)
phase: 20
format: markdoc
doc_role: meta_sot
pack: P7
pack_version: "1.6"
authority: platform-denali-customer-delivery.mdoc
aligns_with:
  - docs-as-code (in-repo, PR-reviewed)
  - C4 container model (Level 1–2)
  - traceability spine (requirement → nano → code → proof)
  - ADR-lite decisions (DEC-P7-* index)
  - runbook separation (operations vs architecture)
---

# P7 documentation architecture

This pack follows **enterprise docs-as-code** patterns. P7 is a **delivery phase pack** — modular, agent-executable, extensible without rewriting prior EPICs.

---

## 1. Traceability spine (single chain)

```text
North star (umbrella mdoc)
    → EPIC spec (p7-{0..3}-*.md)
        → Nano (P7-x-N-yyy)
            → Code surface (FILE-MAP · TRACEABILITY-MATRIX)
        → Proof (P7-VERIFICATION-COMMANDS.yaml → expect_token)
                    → Truth ledger (IMPLEMENTATION-TRUTH-P7)
                    → Turn report (P7-AGENT-TURN-SCHEMA.md)
```

| Spine link | Canonical home | ID format |
| ---------- | -------------- | --------- |
| Phase umbrella | [platform-denali-customer-delivery.mdoc](../platform-denali-customer-delivery.mdoc) | Phase 20 |
| EPIC | `p7/p7-{0..3}-*.md` | P7-0 .. P7-3 |
| Nano | EPIC §Nanos | P7-x-N-yyy |
| Decision | [DEC-P7-INDEX.md](DEC-P7-INDEX.md) | DEC-P7-00N |
| Port / URL | [P7-PORT-MATRIX.md](P7-PORT-MATRIX.md) | DEC-P7-010 |
| Execution discipline | [P7-EXECUTION-DISCIPLINE.md](P7-EXECUTION-DISCIPLINE.md) | DEC-P7-009 |
| Boundary | [P6-P7-BOUNDARY.md](P6-P7-BOUNDARY.md) | A-P7-* / R-P7-* |
| Proof (canonical) | [P7-VERIFICATION-COMMANDS.yaml](P7-VERIFICATION-COMMANDS.yaml) | P7-x-N-yyy |
| AI boot | [P7-BOOT-MANIFEST.yaml](P7-BOOT-MANIFEST.yaml) | DEC-P7-015 |
| Anti-hollow | [P7-ANTI-HOLLOW-CONTRACT.md](P7-ANTI-HOLLOW-CONTRACT.md) | fail_token P7_FAIL |
| Proof (human index) | [SMOKE-SCENARIO-MAP-P7.md](SMOKE-SCENARIO-MAP-P7.md) | SMK-P7-* · VS-* |
| Operations | `p7/runbooks/*.md` | runbook per nano cluster |

---

## 2. C4 views (delivery scope)

### Level 2 — Containers (four processes)

| Container | P7 EPIC | Extension zone |
| --------- | ------- | -------------- |
| API + Postgres | P7-0 seed · P7-3 T3 | workspace plugin routes |
| web admin | P7-1 wizard · P7-2 workspace | Z3 additive paths only |
| marketing | P7-0 deploy · P7-3 T2 | revalidate endpoint |
| portal | P7-0 deploy · P7-3 T2 | BFF under `app/api/me/*` |

Ports: [P7-PORT-MATRIX.md](P7-PORT-MATRIX.md).

---

## 3. Living documentation tiers

| Tier | Meaning | Update trigger |
| ---- | ------- | -------------- |
| **spec** | Nano written | EPIC edit |
| **dev** | `p7:gate` green | every PR |
| **staging** | T2/T3 on staging | nano proof |
| **manual** | T4 sign-off | P7-3-N-004 |

---

## 4. Agent load tiers (v1.6)

| Tier | Load | Forbidden |
| ---- | ---- | --------- |
| **T0** | [P7-BOOT-MANIFEST.yaml](P7-BOOT-MANIFEST.yaml) `boot_sequence_T0` | [P7-DEPRECATED-ENTRYPOINTS.md](P7-DEPRECATED-ENTRYPOINTS.md) as boot |
| **T1** | `P7-VERIFICATION-COMMANDS.yaml#current_nano` · EPIC nano block · linked runbook | Bulk-read all 27 nanos |
| **T2** | TRACEABILITY · TEST-INVENTORY · SMOKE-MAP · FILE-MAP | Umbrella mdoc as sole SoT |

Sole entry: [AGENT-START.md](../AGENT-START.md).

Every turn ends with [P7-AGENT-TURN-SCHEMA.md](P7-AGENT-TURN-SCHEMA.md) `turn_report`.

---

## 5. Agent entry (legacy summary — use BOOT-MANIFEST)

1. [P7-BOOT-MANIFEST.yaml](P7-BOOT-MANIFEST.yaml)
2. [IMPLEMENTATION-TRUTH-P7.md](IMPLEMENTATION-TRUTH-P7.md)
3. [P7-ANTI-HOLLOW-CONTRACT.md](P7-ANTI-HOLLOW-CONTRACT.md)
4. Current nano from verification YAML only

Staging proof: [p7-staging-e2e.md](../runbooks/p7-staging-e2e.md) (T2).

---

## References

- [p7-implementation-standards.mdoc](../p7-implementation-standards.mdoc)
- [POST-P7-HORIZON.md](POST-P7-HORIZON.md)
