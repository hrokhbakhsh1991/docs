# P8 Agent — sole entry (pack v1.0 AI-hardened)

```yaml
phase: 21
pack: P8
pack_version: "1.0"
status: PLANNED
sole_boot: appendices/P8-BOOT-MANIFEST.yaml
fail_token: P8_FAIL
prerequisite: P7 BEHAVIORAL_COMPLETE · pnpm run p7:gate
current_task: P8-0-N-001
machine_snapshot: AGENT-CURRENT-PHASE.yaml
truth: appendices/P8-IMPLEMENTATION-TRUTH.md
anti_hollow: appendices/P8-ANTI-HOLLOW-CONTRACT.md
verification: appendices/P8-VERIFICATION-COMMANDS.yaml
turn_schema: appendices/P8-AGENT-TURN-SCHEMA.md
discipline: appendices/P8-EXECUTION-DISCIPLINE.md
app_fit: p8-app-fit.md
p8_gate: pnpm run p8:gate
```

> **Agents:** Boot **only** from [P8-BOOT-MANIFEST.yaml](appendices/P8-BOOT-MANIFEST.yaml). Wrong paths → [P8-DEPRECATED-ENTRYPOINTS.md](appendices/P8-DEPRECATED-ENTRYPOINTS.md).

---

## Pre-flight (T0 — every session)

```text
1. READ  appendices/P8-BOOT-MANIFEST.yaml
2. READ  p8-app-fit.md (scope — no P9/P10 leak)
3. READ  appendices/P8-IMPLEMENTATION-TRUTH.md
4. READ  appendices/P8-ANTI-HOLLOW-CONTRACT.md
5. READ  appendices/P8-EXECUTION-DISCIPLINE.md
6. READ  AGENT-CURRENT-PHASE.yaml → current_task
7. RUN    pnpm run p7:gate  (exit 0 or P8_FAIL — stop P8 work)
8. LOAD   P8-VERIFICATION-COMMANDS.yaml#{current_task} only
9. END    turn with P8-AGENT-TURN-SCHEMA.md turn_report
```

---

## What P8 is

**Profile A + B hardening** — ingress · session · env on **4 shared processes** (one VPS).

**Not:** TLS · guest package · web public-auth removal · custom apex SSL.

| EPIC | One line |
| ---- | -------- |
| P8-0 | ingress IP fallback · fail-closed bootstrap · parser |
| P8-1 | cookie rename · JWT↔host · portal middleware |
| P8-2 | 4 env bootstrap/verify · contract · fail-fast |
| P8-3 | `p8:gate` · CI verify |

---

## Agent loop (one nano per turn)

```text
detect_current_nano (BOOT-MANIFEST execution_order)
  → doc-first if apps/api touched
  → LOAD verification YAML for that nano only
  → RUN commands · capture expect_token
  → pnpm run p8:gate if code changed
  → UPDATE IMPLEMENTATION-TRUTH row on PROFILE_A+ PASS
  → EMIT turn_report (mandatory)
```

---

## Load tiers

| Tier | Files |
| ---- | ----- |
| **T0** | BOOT-MANIFEST · app-fit · TRUTH · ANTI-HOLLOW · DISCIPLINE · AGENT-CURRENT-PHASE |
| **T1** | VERIFICATION-COMMANDS#nano · gap row in p8-gap-registry |
| **T2** | audit · action-plan · exit checklist |

Do **not** bulk-read P9/P10 packs during P8 work.

---

## Gates

```bash
pnpm run p7:gate    # prerequisite every session
pnpm run p8:gate    # after any P8 code/doc pack touch
pnpm run p6:gate    # included in p8:gate via p7 chain
```

---

## Forbidden (P8_FAIL)

```text
❌ guest-surface-host · remove web public-auth (P9)
❌ Caddy/TLS/__Host- cookies (P10)
❌ Skip Wave A nanos
❌ p8:gate PASS without running nano verification commands
❌ apps/api change without docs/ update
```

---

## Status

**Current nano:** `P8-0-N-001` · [AGENT-CURRENT-PHASE.yaml](AGENT-CURRENT-PHASE.yaml) · Alignment → [POST-P7-PACK-ALIGNMENT.md](../POST-P7-PACK-ALIGNMENT.md)
