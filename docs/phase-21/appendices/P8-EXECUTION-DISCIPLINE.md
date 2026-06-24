# P8 — Execution discipline (no fake work)

```yaml
discipline_id: P8-EXECUTION-DISCIPLINE
pack_version: "1.0"
authority: P8-IMPLEMENTATION-TRUTH.md · p8-app-fit.md
status: NORMATIVE
```

> **Rule:** P8 hardens **Profile A + B** on the existing 4-process stack — not new product · not P9 dedup · not P10 TLS.

---

## What P8 is (one sentence)

Ingress + session + env **fail-closed** for dev and VPS IP — so P9 consolidation and P10 HTTPS have a stable base.

---

## Execution order (strict)

```text
1. Wave A (P0) — all six action-plan items before Wave B
2. Wave B (P1) — portal middleware · parser · env contract · M+P parity
3. Wave C — p8:gate only after Wave A+B nanos PASS or documented SKIP
```

**Do not start P9** until P8 exit checklist Wave A+B complete.

---

## Doc-first (covenant)

| Touch | Required before code |
| ----- | -------------------- |
| `apps/api` | `docs/phase-21/` markdoc update |
| `packages/platform-core` | docs proposal |
| `packages/workspace-sdk` | docs proposal |

Turn report must set `docs_updated: true` when applicable.

---

## Forbidden patterns (agents)

```text
❌ guest-surface-host package (P9)
❌ Delete web app/api/public-auth/* (P9)
❌ Caddy · TLS · certbot (P10)
❌ __Host- cookie prefix on HTTP VPS (P10)
❌ tenant_domains.surface DB enforce (P10 G-ING-04b)
❌ Marketing full session middleware (not needed)
❌ "Profile B session 10/10" on same IP different ports
❌ Skip G-SES-01 because "redirect exists" (P9 concern)
❌ p8:gate green = P8 exit without Profile B commands when VPS available
❌ Implement P10 env in P8 "early" — P10 only extends Profile C
```

---

## Wave A must complete (no shortcuts)

| ID | Gap | Skip forbidden? |
| -- | --- | --------------- |
| P8-0-N-001 | G-ING-01 | **Yes** — Profile B blocker |
| P8-0-N-002 | G-ING-02 | **Yes** |
| P8-1-N-001 | G-SES-01/02 | **Yes** — IP cookie bleed |
| P8-1-N-002 | G-SES-03/05 | **Yes** |
| P8-2-N-001 | G-ENV-01/02 | **Yes** |
| P8-1-N-004 | G-SES-06 | **Yes** — parity doc + code |

---

## P7 overlap (allowed early)

| P8 nano | P7 note |
| ------- | ------- |
| P8-0-N-001 | May tag `also-P8-A` in P7-0 if blocking customer |
| P8-2-N-001 | P7-0-N-002 env matrix overlap |

If done in P7, mark nano **SKIP** with evidence link — do not redo.

---

## References

- [P8-BOOT-MANIFEST.yaml](P8-BOOT-MANIFEST.yaml)
- [../../POST-P7-PACK-ALIGNMENT.md](../../POST-P7-PACK-ALIGNMENT.md)
